import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  canonicalizeMixamoBoneName,
  createAirtimeMatchedJumpClip,
  retargetMixamoClipToModel,
} from './characterRig';

test('retargeting keeps Hips root motion when the model has duplicate shadow bones', () => {
  const root = new THREE.Group();
  const armature = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'mixamorig1Hips';
  hips.position.set(0, 94.75, 0);

  // Mixamo exports can nest duplicate "shadow" bones with the same name.
  const shadowHips = new THREE.Bone();
  shadowHips.name = 'mixamorig1Hips';
  shadowHips.position.set(0, 0, 0);

  const deeperShadowHips = new THREE.Bone();
  deeperShadowHips.name = 'mixamorig1Hips';
  deeperShadowHips.position.set(0, 0, 0);

  hips.add(shadowHips);
  shadowHips.add(deeperShadowHips);
  armature.add(hips);
  root.add(armature);

  const clip = new THREE.AnimationClip('Walk', 1, [
    new THREE.VectorKeyframeTrack(
      'mixamorig1Hips.position',
      [0, 1],
      [0, 94.8, 0, 0, 90, 0]
    ),
  ]);

  const retargeted = retargetMixamoClipToModel(clip, root);
  const track = retargeted.tracks[0];

  assert.equal(track.name, 'mixamorig1Hips.position');
  // If a zero-offset duplicate wins, these become ~0.92 and ~0.88 (cm -> m).
  assert.ok(Math.abs(track.values[1] - 94.8) < 1e-4);
  assert.ok(Math.abs(track.values[4] - 90) < 1e-4);
});

test('canonicalizeMixamoBoneName normalizes Mixamo prefixes', () => {
  assert.equal(canonicalizeMixamoBoneName('mixamorig1Hips'), 'hips');
  assert.equal(canonicalizeMixamoBoneName('mixamorig:LeftArm'), 'leftarm');
  assert.equal(canonicalizeMixamoBoneName('Ch17_RightHand'), 'righthand');
});

test('jump clip is retimed to the requested airtime and clamps upward Hips root motion', () => {
  const sourceClip = new THREE.AnimationClip('Jump', 1.5, [
    new THREE.VectorKeyframeTrack(
      'mixamorig1Hips.position',
      [0, 0.3, 0.6, 0.9, 1.2, 1.5],
      [
        0, 0.92, 0,
        0, 0.72, 0,
        0, 0.72, 0,
        0, 1.2, 0,
        0, 1.0, 0,
        0, 0.92, 0,
      ]
    ),
  ]);

  const result = createAirtimeMatchedJumpClip(sourceClip, 0.7);
  assert.ok(Math.abs(result.clip.duration - 1.5) < 1e-6);
  assert.ok(Math.abs(result.timing.launchDelay - 0.35) < 1e-6);
  assert.ok(Math.abs(result.timing.airTime - 0.7) < 1e-6);
  assert.ok(Math.abs(result.timing.totalDuration - 1.5) < 1e-6);

  const hipsTrack = result.clip.tracks[0] as THREE.VectorKeyframeTrack;
  let maxHipsY = -Infinity;
  for (let i = 1; i < hipsTrack.values.length; i += 3) {
    maxHipsY = Math.max(maxHipsY, hipsTrack.values[i]);
  }
  assert.ok(maxHipsY <= 0.92 + 1e-6);
  assert.ok(
    Math.abs(hipsTrack.times[hipsTrack.times.length - 1] - 1.5) < 1e-6
  );
});
