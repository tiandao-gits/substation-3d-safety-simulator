import * as THREE from 'three';

/**
 * 判断目标点是否落在取景相机当前画面内（用于无人机取证构图校验）。
 * margin 以 NDC 为基准：0.65 表示目标需位于画面中央约 65% 区域，
 * 留出余量给更窄的取证镜头（42°）裁剪。
 */
export function isTargetFramedByCamera(
  camera: THREE.PerspectiveCamera,
  target: { x: number; y: number; z: number },
  margin = 0.65
): boolean {
  camera.updateMatrixWorld();
  const targetPos = new THREE.Vector3(target.x, target.y, target.z);
  const ndc = targetPos.clone().project(camera);
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const toTarget = targetPos.clone().sub(camera.position);
  return (
    forward.dot(toTarget) > 0 &&
    ndc.z < 1 &&
    Math.abs(ndc.x) <= margin &&
    Math.abs(ndc.y) <= margin
  );
}
