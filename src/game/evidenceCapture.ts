import * as THREE from 'three';
import { getAct1Point, type Act1PointId } from './act1';
import type { MixamoCharacterController } from './characterRig';
import { createEvidenceRecord, type CaptureEvidenceResult } from './evidence';
import { isTargetFramedByCamera } from './framing';
import { getSubstationZoneAt, type PlayerState } from './rules';

export interface CaptureSceneEvidenceInput {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  character: MixamoCharacterController | null;
  player: PlayerState;
  pointId: Act1PointId;
  reading: string;
  onShutterFlash?: () => void;
}

/**
 * 从当前 WebGL 场景离屏渲染 480x270 证据图片，叠加区域与时间戳水印后生成 EvidenceRecord。
 */
export function captureSceneEvidence({
  renderer,
  scene,
  camera,
  character,
  player,
  pointId,
  reading,
  onShutterFlash,
}: CaptureSceneEvidenceInput): CaptureEvidenceResult {
  if (!renderer || !scene || !camera) {
    return { record: null, error: '取景失败：3D 场景尚未就绪。' };
  }

  const point = getAct1Point(pointId);
  const fromDrone = player.perspective === 'drone';

  // 无人机取证必须先让目标（未戴安全帽的人员）进入当前取景画面，
  // 不能仅凭按 G 就自动对准并生成有效证据。
  if (
    fromDrone &&
    point.evidencePerspective === 'drone' &&
    point.evidenceTarget &&
    !isTargetFramedByCamera(camera, point.evidenceTarget)
  ) {
    return {
      record: null,
      error:
        '无法拍摄：画面未包含未戴安全帽的作业人员，不是有效证据。请将无人机对准该人员后再按 G。',
    };
  }

  const width = 480;
  const height = 270;
  const target = new THREE.WebGLRenderTarget(width, height);
  const prevTarget = renderer.getRenderTarget();
  const prevPos = camera.position.clone();
  const prevQuat = camera.quaternion.clone();
  const prevAspect = camera.aspect;
  const prevFov = camera.fov;
  const characterWasVisible = character?.root.visible ?? false;

  try {
    const focusTarget = point.evidenceTarget ?? {
      x: point.x,
      y: point.focusY,
      z: point.z,
    };
    const focus = new THREE.Vector3(
      focusTarget.x,
      focusTarget.y,
      focusTarget.z
    );
    if (fromDrone) {
      camera.position.set(player.droneX, player.droneY, player.droneZ);
    } else {
      const back = new THREE.Vector3(
        player.x,
        player.y + 1.5,
        player.z
      ).sub(focus);
      back.y = 0;
      const playerDistance = back.length() || 1;
      back.multiplyScalar(1 / playerDistance);
      const shotDistance = THREE.MathUtils.clamp(playerDistance, 2.4, 6);
      camera.position.copy(focus).addScaledVector(back, shotDistance);
      camera.position.y = focus.y + shotDistance * 0.28;
    }
    camera.aspect = width / height;
    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.lookAt(focus);
    camera.updateMatrixWorld();

    if (character) character.root.visible = false;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    if (character) character.root.visible = characterWasVisible;

    const buffer = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { record: null, error: '取景失败：无法生成证据图片。' };
    }
    const image = ctx.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y += 1) {
      const src = (height - 1 - y) * rowBytes;
      image.data.set(buffer.subarray(src, src + rowBytes), y * rowBytes);
    }
    ctx.putImageData(image, 0, 0);

    const zone = getSubstationZoneAt(point.x, point.z).name;
    ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
    ctx.fillRect(0, height - 34, width, 34);
    ctx.fillStyle = '#c7e7ff';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`${zone} · ${reading}`, 10, height - 18);
    ctx.fillText(
      `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} · X ${player.x.toFixed(1)} / Z ${player.z.toFixed(1)}`,
      10,
      height - 5
    );
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    if (fromDrone) player.dronePhotoCount += 1;
    onShutterFlash?.();

    return {
      record: createEvidenceRecord({
        actId: 'act1',
        pointId,
        reading,
        zone,
        position: fromDrone
          ? { x: player.droneX, y: player.droneY, z: player.droneZ }
          : { x: player.x, y: player.y + 1.5, z: player.z },
        width,
        height,
        dataUrl,
      }),
    };
  } catch (error) {
    console.warn('Evidence capture failed', error);
    return {
      record: null,
      error: '取景失败：请正对目标、保持目标在画面内后再试。',
    };
  } finally {
    if (character) character.root.visible = characterWasVisible;
    camera.position.copy(prevPos);
    camera.quaternion.copy(prevQuat);
    camera.aspect = prevAspect;
    camera.fov = prevFov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.setRenderTarget(prevTarget);
    target.dispose();
  }
}
