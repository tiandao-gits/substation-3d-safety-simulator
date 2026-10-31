import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  PLAYER_JUMP_AIR_TIME,
  type MixamoMotionState,
  type ToolType,
} from './rules';
import { MESSAGES } from '../config/gameText';
import { MIXAMO_FILENAME_KEYWORDS } from '../config/gameText';

/**
 * Default Mixamo character & animation asset paths under public/assets/roles/
 * - Model: public/assets/roles/Ch17_nonPBR.fbx
 * - Walk:  public/assets/roles/Standard Walk.fbx
 * - Run:   public/assets/roles/Run Forward.fbx
 * - Jump:  public/assets/roles/Jump.fbx
 */
export const DEFAULT_MIXAMO_ROLE_ASSETS = {
  characterUrl: '/assets/roles/Ch17_nonPBR.fbx',
  walkAnimUrl: '/assets/roles/Standard Walk.fbx',
  runAnimUrl: '/assets/roles/Run Forward.fbx',
  jumpAnimUrl: '/assets/roles/Jump.fbx',
} as const;

/**
 * Progress hints for the four role files. The loading bar needs a denominator
 * before a slow response reports its Content-Length; real response totals
 * override these values as soon as they arrive. A replaced asset only makes the
 * hint approximate, never blocks the readiness gate.
 */
const EXPECTED_ROLE_ASSET_BYTES: Record<string, number> = {
  [DEFAULT_MIXAMO_ROLE_ASSETS.characterUrl]: 6_208_380,
  [DEFAULT_MIXAMO_ROLE_ASSETS.walkAnimUrl]: 391_872,
  [DEFAULT_MIXAMO_ROLE_ASSETS.runAnimUrl]: 362_208,
  [DEFAULT_MIXAMO_ROLE_ASSETS.jumpAnimUrl]: 507_792,
};

export interface JumpClipTiming {
  /** Full in-place jump sequence: anticipation + airborne + landing recovery. */
  totalDuration: number;
  /** Grounded crouch/anticipation time before physics launch. */
  launchDelay: number;
  /** Time the character's feet are off the ground. */
  airTime: number;
}

export interface MixamoCharacterController {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<MixamoMotionState, THREE.AnimationAction>;
  activeState: MixamoMotionState;
  customModelLoaded: string | null;
  flashlight: THREE.SpotLight;
  laserBeam: THREE.Mesh;
  setMotionState: (next: MixamoMotionState, timeScale?: number) => void;
  startJump: (airTimeSeconds: number) => JumpClipTiming;
  setFirstPersonMode: (isFirstPerson: boolean) => void;
  setFlashlightEnabled: (enabled: boolean) => void;
  setThermometerLaserActive: (active: boolean) => void;
  setEquippedTool: (tool: ToolType) => void;
  update: (dt: number) => void;
  loadDefaultMixamoRoleAssets: (
    onProgress?: (loadedBytes: number, totalBytes: number) => void
  ) => Promise<string>;
  loadExternalMixamoAsset: (fileOrFiles: File | FileList | File[]) => Promise<string>;
}

function quatKeyframes(
  eulerFrames: Array<[number, number, number]>
): number[] {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [rx, ry, rz] of eulerFrames) {
    e.set(rx, ry, rz, 'XYZ');
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return values;
}

/**
 * Canonicalizes a Mixamo bone/node name so tracks from `Standard Walk.fbx` and `Run Forward.fbx`
 * match `Ch17_nonPBR.fbx` regardless of `mixamorig:`, `mixamorig`, `mixamorig1`, or `Ch17_` prefixes.
 */
export function canonicalizeMixamoBoneName(rawName: string): string {
  const withoutNamespace = rawName.includes(':')
    ? rawName.split(':').pop() || rawName
    : rawName;
  return withoutNamespace
    .replace(/^mixamorig\d*_?/i, '')
    .replace(/^ch17_?/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * Retargets a Mixamo AnimationClip (such as `Standard Walk.fbx` or `Run Forward.fbx`)
 * to the target character root's actual bone names, and optionally locks horizontal (X/Z)
 * root motion on Hips so "Run Forward" / "Standard Walk" stay in-place on the character collider.
 */
export function retargetMixamoClipToModel(
  clip: THREE.AnimationClip,
  targetRoot: THREE.Object3D,
  options: { targetClipName?: string; lockHorizontalRootMotion?: boolean } = {}
): THREE.AnimationClip {
  const boneByCanonical = new Map<string, THREE.Object3D>();
  const boneByExact = new Map<string, THREE.Object3D>();

  targetRoot.traverse((node) => {
    if (!node.name) return;
    // Some Mixamo exports contain duplicate "shadow" bones (e.g. a nested
    // mixamorig1Hips chain). AnimationMixer resolves tracks with getObjectByName(),
    // which returns the first match, so keep the first occurrence and ignore later
    // duplicates. Otherwise retargeting can read a zero-offset duplicate bone and
    // rescale Hips root motion by ~1/100, sinking the character into the ground.
    if (!boneByExact.has(node.name)) {
      boneByExact.set(node.name, node);
    }
    const canon = canonicalizeMixamoBoneName(node.name);
    if (canon && !boneByCanonical.has(canon)) {
      boneByCanonical.set(canon, node);
    }
  });

  const retargetedTracks: THREE.KeyframeTrack[] = [];

  for (const track of clip.tracks) {
    const dotIndex = track.name.indexOf('.');
    if (dotIndex === -1) continue;

    const rawNodeName = track.name.slice(0, dotIndex);
    const propertyName = track.name.slice(dotIndex + 1);
    const canonKey = canonicalizeMixamoBoneName(rawNodeName);

    const matchedNode =
      boneByExact.get(rawNodeName) || boneByCanonical.get(canonKey);
    if (!matchedNode) continue;

    // Only keep position tracks on Hips; skip limb translation tracks to avoid scale/bind conflicts
    if (propertyName === 'position' && canonKey !== 'hips') {
      continue;
    }

    const clonedTrack = track.clone();
    clonedTrack.name = `${matchedNode.name}.${propertyName}`;

    if (
      propertyName === 'position' &&
      canonKey === 'hips' &&
      clonedTrack.values.length >= 3
    ) {
      const vals = clonedTrack.values;
      const x0 = vals[0];
      const y0 = vals[1];
      const z0 = vals[2];

      // Convert cm <-> m if animation track and target bone use different unit scales
      const restY = matchedNode.position.y || 0.92;
      let unitScale = 1.0;
      if (Math.abs(y0) > 10 && Math.abs(restY) > 0.05 && Math.abs(restY) < 5) {
        unitScale = restY / y0;
      } else if (
        Math.abs(y0) > 0.05 &&
        Math.abs(y0) < 5 &&
        Math.abs(restY) > 10
      ) {
        unitScale = restY / y0;
      }

      const lockXZ = options.lockHorizontalRootMotion ?? true;
      for (let i = 0; i < vals.length; i += 3) {
        vals[i] = (lockXZ ? x0 : vals[i]) * unitScale;
        vals[i + 1] = vals[i + 1] * unitScale;
        vals[i + 2] = (lockXZ ? z0 : vals[i + 2]) * unitScale;
      }
    }

    retargetedTracks.push(clonedTrack);
  }

  return new THREE.AnimationClip(
    options.targetClipName || clip.name,
    clip.duration,
    retargetedTracks
  );
}

const JUMP_ANTICIPATION_SECONDS = 0.35;
const JUMP_LANDING_RECOVERY_SECONDS = 0.45;
const JUMP_SOURCE_PREP_WINDOW_SECONDS = 0.55;
const JUMP_SOURCE_RECOVERY_WINDOW_SECONDS = 0.55;
const JUMP_RETIME_SAMPLE_FPS = 60;

/**
 * Re-times a retargeted Jump.fbx clip so its feet-off-ground section lasts
 * exactly `airTimeSeconds`, matching the character's physics arc. The source
 * crouch is compressed into a short anticipation window and the landing pose
 * into a recovery window. Positive Hips Y root motion is clamped away because
 * the player root (p.y) drives the jump height; keeping both would double it.
 */
export function createAirtimeMatchedJumpClip(
  sourceClip: THREE.AnimationClip,
  airTimeSeconds: number
): { clip: THREE.AnimationClip; timing: JumpClipTiming } {
  const airTime = Math.max(0.1, airTimeSeconds);
  const sourceDuration = Math.max(sourceClip.duration, 1e-3);

  const hipsTrack = sourceClip.tracks.find((track) => {
    if (!track.name.endsWith('.position')) return false;
    const nodeName = track.name.slice(0, -'.position'.length);
    return canonicalizeMixamoBoneName(nodeName) === 'hips';
  });

  let sourceTakeoff = sourceDuration * 0.35;
  let sourceLanding = sourceDuration * 0.65;

  if (hipsTrack && hipsTrack.values.length >= 6) {
    const times = hipsTrack.times;
    const hipsY: number[] = [];
    for (let i = 1; i < hipsTrack.values.length; i += 3) {
      hipsY.push(hipsTrack.values[i]);
    }

    const restY = hipsY[0];
    let peakIndex = 0;
    for (let i = 1; i < hipsY.length; i++) {
      if (hipsY[i] > hipsY[peakIndex]) peakIndex = i;
    }
    const rise = hipsY[peakIndex] - restY;

    if (rise > 0.01) {
      const threshold = restY + rise * 0.04;
      const crossingTime = (from: number, to: number) => {
        const y0 = hipsY[from];
        const y1 = hipsY[to];
        const t0 = times[from];
        const t1 = times[to];
        if (y1 === y0) return t0;
        const ratio = Math.max(
          0,
          Math.min(1, (threshold - y0) / (y1 - y0))
        );
        return t0 + ratio * (t1 - t0);
      };

      for (let i = peakIndex - 1; i >= 0; i--) {
        if (hipsY[i] <= threshold && hipsY[i + 1] > threshold) {
          sourceTakeoff = crossingTime(i, i + 1);
          break;
        }
      }
      for (let i = peakIndex + 1; i < hipsY.length; i++) {
        if (hipsY[i - 1] > threshold && hipsY[i] <= threshold) {
          sourceLanding = crossingTime(i - 1, i);
          break;
        }
      }
    }
  }

  sourceTakeoff = Math.max(
    0.01,
    Math.min(sourceDuration - 0.01, sourceTakeoff)
  );
  sourceLanding = Math.max(
    sourceTakeoff + 0.01,
    Math.min(sourceDuration, sourceLanding)
  );

  const sourceStart = Math.max(
    0,
    sourceTakeoff - JUMP_SOURCE_PREP_WINDOW_SECONDS
  );
  const sourceEnd = Math.min(
    sourceDuration,
    sourceLanding + JUMP_SOURCE_RECOVERY_WINDOW_SECONDS
  );
  const sourcePreparation = Math.max(1e-3, sourceTakeoff - sourceStart);
  const sourceAir = Math.max(1e-3, sourceLanding - sourceTakeoff);
  const sourceRecovery = Math.max(1e-3, sourceEnd - sourceLanding);

  const anticipation = JUMP_ANTICIPATION_SECONDS;
  const recovery = JUMP_LANDING_RECOVERY_SECONDS;
  const totalDuration = anticipation + airTime + recovery;

  const gameToSourceTime = (gameTime: number): number => {
    if (gameTime <= anticipation) {
      return sourceStart + (gameTime / anticipation) * sourcePreparation;
    }
    if (gameTime <= anticipation + airTime) {
      return (
        sourceTakeoff +
        ((gameTime - anticipation) / airTime) * sourceAir
      );
    }
    return (
      sourceLanding +
      ((gameTime - anticipation - airTime) / recovery) * sourceRecovery
    );
  };

  const sampleCount = Math.max(
    2,
    Math.ceil(totalDuration * JUMP_RETIME_SAMPLE_FPS)
  );
  const sampleTimes = new Float32Array(sampleCount + 1);
  for (let i = 0; i <= sampleCount; i++) {
    sampleTimes[i] = (i / sampleCount) * totalDuration;
  }

  const hipsRestY = hipsTrack?.values[1] ?? 0;
  const tracks = sourceClip.tracks.map((track) => {
    const valueSize = track.getValueSize();
    const interpolant = (
      track as THREE.KeyframeTrack & {
        createInterpolant: () => THREE.Interpolant;
      }
    ).createInterpolant();
    const values = new Float32Array((sampleCount + 1) * valueSize);

    for (let i = 0; i <= sampleCount; i++) {
      const sourceTime = gameToSourceTime(sampleTimes[i]);
      const sampled = interpolant.evaluate(sourceTime);
      for (let j = 0; j < valueSize; j++) {
        values[i * valueSize + j] = sampled[j];
      }
    }

    if (track === hipsTrack) {
      for (let i = 0; i < values.length; i += 3) {
        if (values[i + 1] > hipsRestY) {
          values[i + 1] = hipsRestY;
        }
      }
    }

    const retimedTrack = track.clone();
    retimedTrack.times = sampleTimes.slice();
    retimedTrack.values = values;
    retimedTrack.setInterpolation(THREE.InterpolateLinear);
    return retimedTrack;
  });

  return {
    clip: new THREE.AnimationClip('Jump', totalDuration, tracks),
    timing: { totalDuration, launchDelay: anticipation, airTime },
  };
}

/**
 * Synthesizes a natural standing breathing `Idle` clip from a retargeted `Standard Walk` clip
 * when `Ch17_nonPBR.fbx` is imported in T-pose without an embedded Idle animation.
 */
function deriveIdleClipFromWalkClip(
  walkClip: THREE.AnimationClip
): THREE.AnimationClip {
  const idleTimes = [0, 1.1, 2.2];
  const tracks: THREE.KeyframeTrack[] = [];

  for (const track of walkClip.tracks) {
    if (track.name.endsWith('.position') && track.values.length >= 3) {
      const x = track.values[0];
      const y = track.values[1];
      const z = track.values[2];
      tracks.push(
        new THREE.VectorKeyframeTrack(track.name, idleTimes, [
          x,
          y,
          z,
          x,
          y * 0.992,
          z,
          x,
          y,
          z,
        ])
      );
    } else if (track.name.endsWith('.quaternion') && track.values.length >= 4) {
      // Average quaternion across the symmetric walk cycle produces the neutral upright stance
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let sw = 0;
      const q0 = new THREE.Quaternion(
        track.values[0],
        track.values[1],
        track.values[2],
        track.values[3]
      );
      const qTemp = new THREE.Quaternion();
      const frameCount = Math.floor(track.values.length / 4);
      for (let i = 0; i < frameCount; i++) {
        qTemp.set(
          track.values[i * 4],
          track.values[i * 4 + 1],
          track.values[i * 4 + 2],
          track.values[i * 4 + 3]
        );
        if (q0.dot(qTemp) < 0) {
          qTemp.set(-qTemp.x, -qTemp.y, -qTemp.z, -qTemp.w);
        }
        sx += qTemp.x;
        sy += qTemp.y;
        sz += qTemp.z;
        sw += qTemp.w;
      }
      const qAvg = new THREE.Quaternion(sx, sy, sz, sw).normalize();
      const qBreath = qAvg.clone();
      const canon = canonicalizeMixamoBoneName(track.name.split('.')[0]);
      if (canon.includes('spine') || canon.includes('neck')) {
        const delta = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.022, 0, 0)
        );
        qBreath.multiply(delta);
      } else if (canon.includes('arm')) {
        const delta = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.018, 0, 0)
        );
        qBreath.multiply(delta);
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(track.name, idleTimes, [
          qAvg.x,
          qAvg.y,
          qAvg.z,
          qAvg.w,
          qBreath.x,
          qBreath.y,
          qBreath.z,
          qBreath.w,
          qAvg.x,
          qAvg.y,
          qAvg.z,
          qAvg.w,
        ])
      );
    }
  }

  return new THREE.AnimationClip('Idle', 2.2, tracks);
}

export function createMixamoInspectorRig(
  contactShadowTex: THREE.Texture,
  enableShadows: boolean,
  options: { autoLoadAssets?: boolean } = {}
): MixamoCharacterController {
  const root = new THREE.Group();
  root.name = 'MixamoCharacter_Ch17_nonPBR';

  // Ground contact shadow disc (y = 0.015 to avoid Z-fighting)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    shadowMat
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Character visual container
  const proceduralRig = new THREE.Group();
  proceduralRig.name = 'Ch17_nonPBR_Rig';
  // Never show the procedural stand-in: the FBX model is part of the initial
  // asset gate, and a load failure surfaces on the loading screen instead.
  proceduralRig.visible = false;
  let firstPersonMode = false;
  let characterMeshLoaded = false;
  root.add(proceduralRig);

  // Materials styled after Mixamo's Ch17_nonPBR utility worker + substation PPE
  const ch17WorkShirtMat = new THREE.MeshStandardMaterial({
    color: 0x2b4c6f,
    roughness: 0.68,
    metalness: 0.1,
  });
  const ch17CargoPantsMat = new THREE.MeshStandardMaterial({
    color: 0x24303f,
    roughness: 0.76,
    metalness: 0.08,
  });
  const vestNeonYellowMat = new THREE.MeshStandardMaterial({
    color: 0xc2d618,
    roughness: 0.42,
    metalness: 0.15,
    emissive: 0x2e3600,
    emissiveIntensity: 0.15,
  });
  const reflectiveSilverMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    roughness: 0.18,
    metalness: 0.85,
  });
  const helmetYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.24,
    metalness: 0.22,
  });
  const hoodGreyMat = new THREE.MeshStandardMaterial({
    color: 0x7c8591,
    roughness: 0.8,
    metalness: 0.05,
  });
  const orangeInsulatingGloveMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.38,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe2b294,
    roughness: 0.62,
    metalness: 0.05,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.48,
    metalness: 0.18,
  });
  const thermoRedBodyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.3,
    metalness: 0.35,
  });
  const thermoBlackGripMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.55,
    metalness: 0.25,
  });
  const thermoLcdMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
  });

  // Mixamo-Named Bone Hierarchy matching Ch17_nonPBR.fbx (Hips at y = 0.92m)
  const hips = new THREE.Group();
  hips.name = 'mixamorigHips';
  hips.position.set(0, 0.92, 0);
  proceduralRig.add(hips);

  // Pelvis / Ch17 Utility Tool Belt
  const pelvisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.16, 0.25),
    ch17CargoPantsMat
  );
  pelvisMesh.castShadow = enableShadows;
  hips.add(pelvisMesh);

  // Spine
  const spine = new THREE.Group();
  spine.name = 'mixamorigSpine';
  spine.position.set(0, 0.08, 0);
  hips.add(spine);

  // Ch17 Torso Work Shirt + High-Vis Vest
  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.41, 0.46, 0.26),
    ch17WorkShirtMat
  );
  torsoMesh.position.set(0, 0.24, 0);
  torsoMesh.castShadow = enableShadows;
  spine.add(torsoMesh);

  const vestMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.43, 0.4, 0.275),
    vestNeonYellowMat
  );
  vestMesh.position.set(0, 0.25, 0);
  vestMesh.castShadow = enableShadows;
  spine.add(vestMesh);

  const hStripe1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.438, 0.04, 0.282),
    reflectiveSilverMat
  );
  hStripe1.position.set(0, 0.14, 0);
  spine.add(hStripe1);
  const hStripe2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.438, 0.04, 0.282),
    reflectiveSilverMat
  );
  hStripe2.position.set(0, 0.26, 0);
  spine.add(hStripe2);
  const vStripeLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.38, 0.282),
    reflectiveSilverMat
  );
  vStripeLeft.position.set(-0.11, 0.25, 0);
  spine.add(vStripeLeft);
  const vStripeRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.38, 0.282),
    reflectiveSilverMat
  );
  vStripeRight.position.set(0.11, 0.25, 0);
  spine.add(vStripeRight);

  // Neck & Head Group
  const headGroup = new THREE.Group();
  headGroup.name = 'mixamorigHead';
  headGroup.position.set(0, 0.5, 0);
  spine.add(headGroup);

  const neckHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.155, 0.21, 14),
    hoodGreyMat
  );
  neckHood.position.set(0, 0.08, 0.015);
  neckHood.castShadow = enableShadows;
  headGroup.add(neckHood);

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 14),
    skinMat
  );
  headMesh.position.set(0, 0.16, -0.01);
  headMesh.castShadow = enableShadows;
  headGroup.add(headMesh);

  const helmetDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmetYellowMat
  );
  helmetDome.position.set(0, 0.18, 0);
  helmetDome.castShadow = enableShadows;
  headGroup.add(helmetDome);

  const helmetBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.172, 0.022, 18),
    helmetYellowMat
  );
  helmetBrim.position.set(0, 0.185, -0.02);
  headGroup.add(helmetBrim);

  const helmetRidge = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.042, 0.27),
    helmetYellowMat
  );
  helmetRidge.position.set(0, 0.305, 0);
  headGroup.add(helmetRidge);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.name = 'mixamorigLeftArm';
  leftArm.position.set(-0.26, 0.42, 0);
  spine.add(leftArm);

  const leftUpperArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.056, 0.28, 10),
    ch17WorkShirtMat
  );
  leftUpperArmMesh.position.set(0, -0.13, 0);
  leftUpperArmMesh.castShadow = enableShadows;
  leftArm.add(leftUpperArmMesh);

  const leftForeArm = new THREE.Group();
  leftForeArm.name = 'mixamorigLeftForeArm';
  leftForeArm.position.set(0, -0.27, 0);
  leftArm.add(leftForeArm);

  const leftForeArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.05, 0.18, 10),
    skinMat
  );
  leftForeArmMesh.position.set(0, -0.08, 0);
  leftForeArm.add(leftForeArmMesh);

  const leftGloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.054, 0.14, 12),
    orangeInsulatingGloveMat
  );
  leftGloveCuff.position.set(0, -0.2, 0);
  leftForeArm.add(leftGloveCuff);

  const leftGloveHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 10, 10),
    orangeInsulatingGloveMat
  );
  leftGloveHand.position.set(0, -0.28, 0);
  leftForeArm.add(leftGloveHand);

  // Right Arm + Handheld Substation Instrument
  const rightArm = new THREE.Group();
  rightArm.name = 'mixamorigRightArm';
  rightArm.position.set(0.26, 0.42, 0);
  spine.add(rightArm);

  const rightUpperArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.056, 0.28, 10),
    ch17WorkShirtMat
  );
  rightUpperArmMesh.position.set(0, -0.13, 0);
  rightUpperArmMesh.castShadow = enableShadows;
  rightArm.add(rightUpperArmMesh);

  const rightForeArm = new THREE.Group();
  rightForeArm.name = 'mixamorigRightForeArm';
  rightForeArm.position.set(0, -0.27, 0);
  rightArm.add(rightForeArm);

  const rightForeArmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.05, 0.16, 10),
    skinMat
  );
  rightForeArmMesh.position.set(0, -0.08, 0);
  rightForeArm.add(rightForeArmMesh);

  const rightGloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.056, 0.15, 12),
    orangeInsulatingGloveMat
  );
  rightGloveCuff.position.set(0, -0.19, 0);
  rightForeArm.add(rightGloveCuff);

  const rightGloveHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 10, 10),
    orangeInsulatingGloveMat
  );
  rightGloveHand.position.set(0, -0.27, 0);
  rightForeArm.add(rightGloveHand);

  // Handheld Instrument Group (mounted on RightForeArm / RightHand)
  const thermoGun = new THREE.Group();
  thermoGun.name = 'HandheldSubstationInstrument';
  thermoGun.position.set(0, -0.28, -0.08);
  thermoGun.rotation.x = Math.PI / 2 - 0.25;

  const gunGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.13, 0.052),
    thermoBlackGripMat
  );
  thermoGun.add(gunGrip);

  const gunBarrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.068, 0.17),
    thermoRedBodyMat
  );
  gunBarrel.position.set(0, 0.065, -0.04);
  thermoGun.add(gunBarrel);

  const gunLcd = new THREE.Mesh(
    new THREE.PlaneGeometry(0.042, 0.038),
    thermoLcdMat
  );
  gunLcd.position.set(0, 0.068, 0.046);
  thermoGun.add(gunLcd);

  const laserGeo = new THREE.CylinderGeometry(0.008, 0.008, 6.0, 6);
  laserGeo.rotateX(Math.PI / 2);
  laserGeo.translate(0, 0, -3.1);
  const laserBeam = new THREE.Mesh(
    laserGeo,
    new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      transparent: true,
      opacity: 0.75,
    })
  );
  laserBeam.position.set(0, 0.07, -0.12);
  laserBeam.visible = false;
  thermoGun.add(laserBeam);
  thermoGun.visible = false;

  rightForeArm.add(thermoGun);

  // Inspection Flashlight SpotLight
  const flashlight = new THREE.SpotLight(
    0xe0f2fe,
    0,
    28,
    Math.PI / 5,
    0.45,
    1.5
  );
  flashlight.position.set(0, 1.45, -0.2);
  flashlight.target.position.set(0, 1.2, -12);
  root.add(flashlight);
  root.add(flashlight.target);

  // Left Leg
  const leftUpLeg = new THREE.Group();
  leftUpLeg.name = 'mixamorigLeftUpLeg';
  leftUpLeg.position.set(-0.11, -0.04, 0);
  hips.add(leftUpLeg);

  const leftThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.068, 0.42, 12),
    ch17CargoPantsMat
  );
  leftThighMesh.position.set(0, -0.21, 0);
  leftThighMesh.castShadow = enableShadows;
  leftUpLeg.add(leftThighMesh);

  const leftLeg = new THREE.Group();
  leftLeg.name = 'mixamorigLeftLeg';
  leftLeg.position.set(0, -0.42, 0);
  leftUpLeg.add(leftLeg);

  const leftCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.054, 0.4, 12),
    ch17CargoPantsMat
  );
  leftCalfMesh.position.set(0, -0.2, 0);
  leftCalfMesh.castShadow = enableShadows;
  leftLeg.add(leftCalfMesh);

  const leftBootMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.09, 0.23),
    bootMat
  );
  leftBootMesh.position.set(0, -0.42, -0.04);
  leftBootMesh.castShadow = enableShadows;
  leftLeg.add(leftBootMesh);

  // Right Leg
  const rightUpLeg = new THREE.Group();
  rightUpLeg.name = 'mixamorigRightUpLeg';
  rightUpLeg.position.set(0.11, -0.04, 0);
  hips.add(rightUpLeg);

  const rightThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.068, 0.42, 12),
    ch17CargoPantsMat
  );
  rightThighMesh.position.set(0, -0.21, 0);
  rightThighMesh.castShadow = enableShadows;
  rightUpLeg.add(rightThighMesh);

  const rightLeg = new THREE.Group();
  rightLeg.name = 'mixamorigRightLeg';
  rightLeg.position.set(0, -0.42, 0);
  rightUpLeg.add(rightLeg);

  const rightCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.054, 0.4, 12),
    ch17CargoPantsMat
  );
  rightCalfMesh.position.set(0, -0.2, 0);
  rightCalfMesh.castShadow = enableShadows;
  rightLeg.add(rightCalfMesh);

  const rightBootMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.09, 0.23),
    bootMat
  );
  rightBootMesh.position.set(0, -0.42, -0.04);
  rightBootMesh.castShadow = enableShadows;
  rightLeg.add(rightBootMesh);

  // Initial AnimationMixer & fallback clips before async FBX role assets finish loading
  const mixer = new THREE.AnimationMixer(root);
  const fallbackClips = buildMixamoKeyframeClips();
  const actions: Record<MixamoMotionState, THREE.AnimationAction> = {
    Idle: mixer.clipAction(fallbackClips.Idle),
    Walk: mixer.clipAction(fallbackClips.Walk),
    Run: mixer.clipAction(fallbackClips.Run),
    Jump: mixer.clipAction(fallbackClips.Jump),
    Inspect: mixer.clipAction(fallbackClips.Inspect),
    Salute: mixer.clipAction(fallbackClips.Salute),
  };

  actions.Idle.play();
  actions.Jump.setLoop(THREE.LoopOnce, 1);
  actions.Jump.clampWhenFinished = true;

  // Keep references to raw loaded FBX clips so if a new character mesh is loaded, clips re-bind cleanly
  let activeModelRoot: THREE.Object3D = root;
  let rawWalkFbxClip: THREE.AnimationClip | null = null;
  let rawRunFbxClip: THREE.AnimationClip | null = null;
  let rawJumpFbxClip: THREE.AnimationClip | null = null;
  let jumpClipCache: {
    airTime: number;
    clip: THREE.AnimationClip;
    timing: JumpClipTiming;
  } | null = null;

  function applyLoadedCharacterMesh(loadedObject: THREE.Object3D) {
    loadedObject.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(loadedObject);
    const size = new THREE.Vector3();
    box.getSize(size);
    let scaleFactor = 1.0;
    if (size.y > 0.01) {
      scaleFactor = 1.82 / size.y;
      loadedObject.scale.multiplyScalar(scaleFactor);
    }

    loadedObject.updateMatrixWorld(true);
    const adjustedBox = new THREE.Box3().setFromObject(loadedObject);
    loadedObject.position.y -= adjustedBox.min.y;
    // Mixamo FBX characters face +Z in local space; rotate 180 deg so character faces -Z (game forward)
    loadedObject.rotation.y = Math.PI;

    loadedObject.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = enableShadows;
        mesh.receiveShadow = enableShadows;
        mesh.frustumCulled = false;

        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          const m = mat as THREE.MeshPhongMaterial & THREE.MeshStandardMaterial;
          // Sanitize Mixamo nonPBR material properties so clothing/skin are opaque and vivid
          m.transparent = false;
          m.opacity = 1.0;
          m.depthWrite = true;
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.needsUpdate = true;
          }
          if ('shininess' in m && typeof m.shininess === 'number') {
            m.shininess = Math.min(m.shininess, 25);
          }
          m.needsUpdate = true;
        }
      }
    });

    // Attach handheld substation instrument to Ch17_nonPBR's right hand bone
    let rightHandNode: THREE.Object3D | null = null;
    loadedObject.traverse((node) => {
      const canon = canonicalizeMixamoBoneName(node.name || '');
      if (canon === 'righthand' || (!rightHandNode && canon === 'rightforearm')) {
        rightHandNode = node;
      }
    });
    if (rightHandNode) {
      const invScale = 1 / Math.max(0.0001, loadedObject.scale.y);
      thermoGun.scale.setScalar(invScale);
      thermoGun.position.set(0, -10 * invScale * 0.01, 6 * invScale * 0.01);
      thermoGun.rotation.set(Math.PI / 2, Math.PI, 0);
      (rightHandNode as THREE.Object3D).add(thermoGun);
    }

    proceduralRig.clear();
    proceduralRig.add(loadedObject);
    characterMeshLoaded = true;
    proceduralRig.visible = !firstPersonMode;
    activeModelRoot = loadedObject;
    jumpClipCache = null;
    controller.mixer.stopAllAction();
    controller.mixer = new THREE.AnimationMixer(loadedObject);
  }

  function buildTimedJumpClip(airTimeSeconds: number) {
    const sourceClip = rawJumpFbxClip || fallbackClips.Jump;
    const retargetedJump = retargetMixamoClipToModel(
      sourceClip,
      activeModelRoot,
      {
        targetClipName: 'Jump',
        lockHorizontalRootMotion: true,
      }
    );
    return createAirtimeMatchedJumpClip(retargetedJump, airTimeSeconds);
  }

  function refreshRetargetedClipsOnActiveRoot() {
    const walkClipSource = rawWalkFbxClip || fallbackClips.Walk;
    const runClipSource = rawRunFbxClip || fallbackClips.Run;

    const retargetedWalk = retargetMixamoClipToModel(
      walkClipSource,
      activeModelRoot,
      {
        targetClipName: 'Walk',
        lockHorizontalRootMotion: true,
      }
    );
    const retargetedRun = retargetMixamoClipToModel(
      runClipSource,
      activeModelRoot,
      {
        targetClipName: 'Run',
        lockHorizontalRootMotion: true,
      }
    );

    const retargetedIdle =
      activeModelRoot === root
        ? retargetMixamoClipToModel(fallbackClips.Idle, activeModelRoot, {
            targetClipName: 'Idle',
          })
        : deriveIdleClipFromWalkClip(retargetedWalk);

    const defaultJump = buildTimedJumpClip(PLAYER_JUMP_AIR_TIME);
    jumpClipCache = {
      airTime: PLAYER_JUMP_AIR_TIME,
      ...defaultJump,
    };
    const retargetedInspect = retargetMixamoClipToModel(
      fallbackClips.Inspect,
      activeModelRoot,
      { targetClipName: 'Inspect' }
    );
    const retargetedSalute = retargetMixamoClipToModel(
      fallbackClips.Salute,
      activeModelRoot,
      { targetClipName: 'Salute' }
    );

    controller.mixer.stopAllAction();
    controller.actions = {
      Idle: controller.mixer.clipAction(retargetedIdle),
      Walk: controller.mixer.clipAction(retargetedWalk),
      Run: controller.mixer.clipAction(retargetedRun),
      Jump: controller.mixer.clipAction(defaultJump.clip),
      Inspect: controller.mixer.clipAction(retargetedInspect),
      Salute: controller.mixer.clipAction(retargetedSalute),
    };
    controller.actions.Jump.setLoop(THREE.LoopOnce, 1);
    controller.actions.Jump.clampWhenFinished = true;

    const currentAction = controller.actions[controller.activeState];
    if (currentAction) {
      currentAction.reset().play();
    }
  }

  const controller: MixamoCharacterController = {
    root,
    mixer,
    actions,
    activeState: 'Idle',
    customModelLoaded: null,
    flashlight,
    laserBeam,

    setMotionState(next: MixamoMotionState, timeScale = 1.0) {
      const nextAction = controller.actions[next];
      if (!nextAction) return;
      nextAction.timeScale = timeScale;

      if (controller.activeState === next) return;
      const prevAction = controller.actions[controller.activeState];
      controller.activeState = next;

      nextAction.reset();
      nextAction.play();
      if (prevAction && prevAction !== nextAction) {
        prevAction.crossFadeTo(nextAction, 0.18, false);
      }
    },

    startJump(airTimeSeconds: number): JumpClipTiming {
      if (
        !jumpClipCache ||
        Math.abs(jumpClipCache.airTime - airTimeSeconds) > 1e-4
      ) {
        const matched = buildTimedJumpClip(airTimeSeconds);
        jumpClipCache = { airTime: airTimeSeconds, ...matched };
      }

      const jumpAction = controller.mixer.clipAction(jumpClipCache.clip);
      jumpAction.setLoop(THREE.LoopOnce, 1);
      jumpAction.clampWhenFinished = true;
      jumpAction.timeScale = 1;

      const prevAction = controller.actions[controller.activeState];
      controller.actions.Jump = jumpAction;
      controller.activeState = 'Jump';

      jumpAction.reset().play();
      if (prevAction && prevAction !== jumpAction) {
        prevAction.crossFadeTo(jumpAction, 0.12, false);
      }

      return jumpClipCache.timing;
    },

    setFirstPersonMode(isFirstPerson: boolean) {
      firstPersonMode = isFirstPerson;
      proceduralRig.visible = characterMeshLoaded && !isFirstPerson;
    },

    setFlashlightEnabled(enabled: boolean) {
      flashlight.intensity = enabled ? 8.5 : 0;
    },

    setThermometerLaserActive(active: boolean) {
      laserBeam.visible = active;
    },

    setEquippedTool(tool: ToolType) {
      thermoGun.visible = false;
      const colorMap: Record<ToolType, number> = {
        multimeter: 0xeab308,
        thermometer: 0xdc2626,
        leakage: 0x7c3aed,
        flashlight: 0x64748b,
        torque: 0x0ea5e9,
        'hollow-hammer': 0xf59e0b,
        laser: 0xfacc15,
        feeler: 0x94a3b8,
        caliper: 0x22d3ee,
      };
      thermoRedBodyMat.color.setHex(colorMap[tool] ?? 0xdc2626);
    },

    update(dt: number) {
      controller.mixer.update(dt);
    },

    async loadDefaultMixamoRoleAssets(
      onProgress?: (loadedBytes: number, totalBytes: number) => void
    ): Promise<string> {
      const fbxLoader = new FBXLoader();
      const loadedSummary: string[] = [];
      const progressByUrl = new Map<string, { loaded: number; total: number }>();

      const reportProgress = () => {
        if (!onProgress) return;
        let loaded = 0;
        let total = 0;
        for (const item of progressByUrl.values()) {
          loaded += item.loaded;
          total += item.total;
        }
        onProgress(loaded, total);
      };

      const loadFbx = (url: string): Promise<THREE.Group> =>
        new Promise((resolve, reject) => {
          progressByUrl.set(url, {
            loaded: 0,
            total: EXPECTED_ROLE_ASSET_BYTES[url] ?? 0,
          });
          fbxLoader.load(
            encodeURI(url),
            (object) => {
              const entry = progressByUrl.get(url);
              if (entry) {
                entry.loaded = Math.max(entry.loaded, entry.total);
                entry.total = Math.max(entry.total, entry.loaded);
              }
              reportProgress();
              resolve(object);
            },
            (event) => {
              const entry = progressByUrl.get(url);
              if (!entry) return;
              if (typeof event.loaded === 'number') entry.loaded = event.loaded;
              if (event.lengthComputable && event.total > 0) {
                entry.total = event.total;
              }
              // Some static servers omit Content-Length; keep the totals
              // monotonic so the bar never runs backwards.
              entry.total = Math.max(entry.total, entry.loaded);
              reportProgress();
            },
            reject
          );
        });

      try {
        const [charRes, walkRes, runRes, jumpRes] = await Promise.allSettled([
          loadFbx(DEFAULT_MIXAMO_ROLE_ASSETS.characterUrl),
          loadFbx(DEFAULT_MIXAMO_ROLE_ASSETS.walkAnimUrl),
          loadFbx(DEFAULT_MIXAMO_ROLE_ASSETS.runAnimUrl),
          loadFbx(DEFAULT_MIXAMO_ROLE_ASSETS.jumpAnimUrl),
        ]);

        if (charRes.status === 'fulfilled') {
          const charObj = charRes.value;
          let meshCount = 0;
          charObj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) meshCount++;
          });
          if (meshCount > 0) {
            applyLoadedCharacterMesh(charObj);
            controller.customModelLoaded = 'Ch17_nonPBR.fbx';
          }
          if (charObj.animations && charObj.animations.length > 0) {
            fallbackClips.Idle = charObj.animations[0];
          }
          loadedSummary.push(MESSAGES.mixamoRoleModel);
        }

        // The FBX role model is mandatory. Reporting the scene as ready
        // without it would expose the procedural stand-in in play.
        if (!controller.customModelLoaded) {
          throw new Error('Ch17_nonPBR.fbx failed to load');
        }

        if (
          walkRes.status === 'fulfilled' &&
          walkRes.value.animations.length > 0
        ) {
          rawWalkFbxClip = walkRes.value.animations[0];
          loadedSummary.push(MESSAGES.mixamoWalkClip);
        }

        if (
          runRes.status === 'fulfilled' &&
          runRes.value.animations.length > 0
        ) {
          rawRunFbxClip = runRes.value.animations[0];
          loadedSummary.push(MESSAGES.mixamoRunClip);
        }

        if (
          jumpRes.status === 'fulfilled' &&
          jumpRes.value.animations.length > 0
        ) {
          rawJumpFbxClip = jumpRes.value.animations[0];
          jumpClipCache = null;
          loadedSummary.push(MESSAGES.mixamoJumpClip);
        }

        refreshRetargetedClipsOnActiveRoot();

        return loadedSummary.length > 0
          ? MESSAGES.mixamoAssetsLoaded(loadedSummary.join(' + '))
          : MESSAGES.mixamoBuiltIn;
      } catch (error) {
        if (!controller.customModelLoaded) throw error;
        return MESSAGES.mixamoBuiltIn;
      }
    },

    async loadExternalMixamoAsset(
      fileOrFiles: File | FileList | File[]
    ): Promise<string> {
      const files: File[] =
        fileOrFiles instanceof File
          ? [fileOrFiles]
          : Array.from(fileOrFiles as ArrayLike<File>);
      if (files.length === 0) return MESSAGES.noFileSelected;

      // Sort so character model files (like Ch17_nonPBR.fbx) load before animation files (Walk / Run)
      const sortedFiles = [...files].sort((a, b) => {
        const aIsAnim = /walk|run|idle|jump/i.test(a.name) ? 1 : 0;
        const bIsAnim = /walk|run|idle|jump/i.test(b.name) ? 1 : 0;
        return aIsAnim - bIsAnim;
      });

      const loadedNames: string[] = [];

      for (const file of sortedFiles) {
        const url = URL.createObjectURL(file);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const lowerName = file.name.toLowerCase();

        try {
          let loadedObject: THREE.Object3D;
          let loadedAnimations: THREE.AnimationClip[] = [];

          if (ext === 'fbx') {
            const fbxLoader = new FBXLoader();
            const fbx = await fbxLoader.loadAsync(url);
            loadedObject = fbx;
            loadedAnimations = fbx.animations || [];
          } else {
            const gltfLoader = new GLTFLoader();
            const gltf = await gltfLoader.loadAsync(url);
            loadedObject = gltf.scene;
            loadedAnimations = gltf.animations || [];
          }

          let meshCount = 0;
          loadedObject.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) meshCount++;
          });

          const isWalkClip = MIXAMO_FILENAME_KEYWORDS.walk.some((kw) =>
            lowerName.includes(kw)
          );
          const isRunClip = MIXAMO_FILENAME_KEYWORDS.run.some((kw) =>
            lowerName.includes(kw)
          );
          const isJumpClip = MIXAMO_FILENAME_KEYWORDS.jump.some((kw) =>
            lowerName.includes(kw)
          );

          // If the file has meshes and isn't purely a Walk/Run/Jump animation file, mount it as the character model
          if (
            meshCount > 0 &&
            !isWalkClip &&
            !isRunClip &&
            !isJumpClip
          ) {
            applyLoadedCharacterMesh(loadedObject);
            controller.customModelLoaded = file.name;
          }

          if (loadedAnimations.length > 0) {
            const clip = loadedAnimations[0];
            if (isWalkClip) {
              rawWalkFbxClip = clip;
            } else if (isRunClip) {
              rawRunFbxClip = clip;
            } else if (isJumpClip) {
              rawJumpFbxClip = clip;
              jumpClipCache = null;
            } else {
              fallbackClips.Idle = clip;
            }
          }

          loadedNames.push(file.name);
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      refreshRetargetedClipsOnActiveRoot();
      return MESSAGES.mixamoFilesLoaded(loadedNames.join(' / '));
    },
  };

  // Automatically load /assets/roles/Ch17_nonPBR.fbx, Standard Walk.fbx, Run Forward.fbx, and Jump.fbx
  if (options.autoLoadAssets !== false) {
    void controller.loadDefaultMixamoRoleAssets();
  }

  return controller;
}

function buildMixamoKeyframeClips(): Record<
  MixamoMotionState,
  THREE.AnimationClip
> {
  // 1. IDLE CLIP
  const idleTimes = [0, 1.0, 2.0];
  const idleClip = new THREE.AnimationClip('Idle', 2.0, [
    new THREE.VectorKeyframeTrack(
      'mixamorigHips.position',
      idleTimes,
      [0, 0.92, 0, 0, 0.91, 0, 0, 0.92, 0]
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigSpine.quaternion',
      idleTimes,
      quatKeyframes([
        [0.02, -0.05, 0],
        [0.03, -0.02, 0],
        [0.02, -0.05, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigHead.quaternion',
      idleTimes,
      quatKeyframes([
        [0.02, -0.08, 0],
        [0.0, -0.03, 0],
        [0.02, -0.08, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftArm.quaternion',
      idleTimes,
      quatKeyframes([
        [0.06, 0, 0.08],
        [0.02, 0, 0.1],
        [0.06, 0, 0.08],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightArm.quaternion',
      idleTimes,
      quatKeyframes([
        [0.32, -0.15, -0.14],
        [0.36, -0.12, -0.16],
        [0.32, -0.15, -0.14],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightForeArm.quaternion',
      idleTimes,
      quatKeyframes([
        [1.15, 0.1, 0],
        [1.2, 0.12, 0],
        [1.15, 0.1, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftUpLeg.quaternion',
      idleTimes,
      quatKeyframes([
        [0, 0, 0],
        [0.02, 0, 0],
        [0, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightUpLeg.quaternion',
      idleTimes,
      quatKeyframes([
        [0, 0, 0],
        [-0.02, 0, 0],
        [0, 0, 0],
      ])
    ),
  ]);

  // 2. WALK CLIP (Standard Walk)
  const walkTimes = [0, 0.22, 0.44, 0.66, 0.88];
  const walkClip = new THREE.AnimationClip('Walk', 0.88, [
    new THREE.VectorKeyframeTrack(
      'mixamorigHips.position',
      walkTimes,
      [0, 0.92, 0, 0, 0.955, 0, 0, 0.92, 0, 0, 0.955, 0, 0, 0.92, 0]
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigSpine.quaternion',
      walkTimes,
      quatKeyframes([
        [0.05, -0.06, 0],
        [0.06, 0, 0],
        [0.05, 0.06, 0],
        [0.06, 0, 0],
        [0.05, -0.06, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftUpLeg.quaternion',
      walkTimes,
      quatKeyframes([
        [-0.45, 0, 0],
        [0.0, 0, 0],
        [0.42, 0, 0],
        [0.05, 0, 0],
        [-0.45, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftLeg.quaternion',
      walkTimes,
      quatKeyframes([
        [0.12, 0, 0],
        [0.08, 0, 0],
        [0.25, 0, 0],
        [0.62, 0, 0],
        [0.12, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightUpLeg.quaternion',
      walkTimes,
      quatKeyframes([
        [0.42, 0, 0],
        [0.05, 0, 0],
        [-0.45, 0, 0],
        [0.0, 0, 0],
        [0.42, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightLeg.quaternion',
      walkTimes,
      quatKeyframes([
        [0.25, 0, 0],
        [0.62, 0, 0],
        [0.12, 0, 0],
        [0.08, 0, 0],
        [0.25, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftArm.quaternion',
      walkTimes,
      quatKeyframes([
        [0.36, 0, 0.05],
        [0.0, 0, 0.05],
        [-0.36, 0, 0.05],
        [0.0, 0, 0.05],
        [0.36, 0, 0.05],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightArm.quaternion',
      walkTimes,
      quatKeyframes([
        [0.28, -0.1, -0.1],
        [0.34, -0.1, -0.1],
        [0.22, -0.1, -0.1],
        [0.34, -0.1, -0.1],
        [0.28, -0.1, -0.1],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightForeArm.quaternion',
      walkTimes,
      quatKeyframes([
        [1.1, 0.08, 0],
        [1.18, 0.08, 0],
        [1.05, 0.08, 0],
        [1.18, 0.08, 0],
        [1.1, 0.08, 0],
      ])
    ),
  ]);

  // 3. RUN CLIP (Run Forward)
  const runTimes = [0, 0.16, 0.32, 0.48, 0.64];
  const runClip = new THREE.AnimationClip('Run', 0.64, [
    new THREE.VectorKeyframeTrack(
      'mixamorigHips.position',
      runTimes,
      [0, 0.89, 0, 0, 0.97, 0, 0, 0.89, 0, 0, 0.97, 0, 0, 0.89, 0]
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigSpine.quaternion',
      runTimes,
      quatKeyframes([
        [-0.18, -0.1, 0],
        [-0.15, 0, 0],
        [-0.18, 0.1, 0],
        [-0.15, 0, 0],
        [-0.18, -0.1, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftUpLeg.quaternion',
      runTimes,
      quatKeyframes([
        [-0.78, 0, 0],
        [0.0, 0, 0],
        [0.68, 0, 0],
        [0.1, 0, 0],
        [-0.78, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftLeg.quaternion',
      runTimes,
      quatKeyframes([
        [0.2, 0, 0],
        [0.15, 0, 0],
        [0.45, 0, 0],
        [1.05, 0, 0],
        [0.2, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightUpLeg.quaternion',
      runTimes,
      quatKeyframes([
        [0.68, 0, 0],
        [0.1, 0, 0],
        [-0.78, 0, 0],
        [0.0, 0, 0],
        [0.68, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightLeg.quaternion',
      runTimes,
      quatKeyframes([
        [0.45, 0, 0],
        [1.05, 0, 0],
        [0.2, 0, 0],
        [0.15, 0, 0],
        [0.45, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftArm.quaternion',
      runTimes,
      quatKeyframes([
        [0.65, 0, 0.08],
        [0, 0, 0.08],
        [-0.65, 0, 0.08],
        [0, 0, 0.08],
        [0.65, 0, 0.08],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightArm.quaternion',
      runTimes,
      quatKeyframes([
        [-0.65, 0, -0.08],
        [0, 0, -0.08],
        [0.65, 0, -0.08],
        [0, 0, -0.08],
        [-0.65, 0, -0.08],
      ])
    ),
  ]);

  // 4. JUMP CLIP
  const jumpTimes = [0, 0.3, 0.6];
  const jumpClip = new THREE.AnimationClip('Jump', 0.6, [
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftUpLeg.quaternion',
      jumpTimes,
      quatKeyframes([
        [-0.35, 0, 0],
        [-0.55, 0, 0],
        [-0.25, 0, 0],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightUpLeg.quaternion',
      jumpTimes,
      quatKeyframes([
        [-0.2, 0, 0],
        [-0.4, 0, 0],
        [-0.15, 0, 0],
      ])
    ),
  ]);

  // 5. INSPECT CLIP
  const inspectTimes = [0, 0.35, 0.95, 1.4];
  const inspectClip = new THREE.AnimationClip('Inspect', 1.4, [
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightArm.quaternion',
      inspectTimes,
      quatKeyframes([
        [0.32, -0.15, -0.14],
        [0.85, -0.1, -0.08],
        [0.88, -0.06, -0.08],
        [0.32, -0.15, -0.14],
      ])
    ),
    new THREE.QuaternionKeyframeTrack(
      'mixamorigRightForeArm.quaternion',
      inspectTimes,
      quatKeyframes([
        [1.15, 0.1, 0],
        [0.75, 0.05, 0],
        [0.72, 0.05, 0],
        [1.15, 0.1, 0],
      ])
    ),
  ]);

  // 6. SALUTE CLIP
  const saluteTimes = [0, 0.35, 0.85, 1.2];
  const saluteClip = new THREE.AnimationClip('Salute', 1.2, [
    new THREE.QuaternionKeyframeTrack(
      'mixamorigLeftArm.quaternion',
      saluteTimes,
      quatKeyframes([
        [0, 0, 0.06],
        [-1.35, 0.2, 0.3],
        [-1.35, 0.2, 0.3],
        [0, 0, 0.06],
      ])
    ),
  ]);

  return {
    Idle: idleClip,
    Walk: walkClip,
    Run: runClip,
    Jump: jumpClip,
    Inspect: inspectClip,
    Salute: saluteClip,
  };
}
