import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { isTargetFramedByCamera } from './framing';

function droneCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.15, 1300);
  camera.position.set(-24, 15, -10);
  camera.lookAt(-31.1, 1.2, -13.2);
  camera.updateMatrixWorld();
  return camera;
}

test('无人机取证必须让未戴安全帽人员进入画面', () => {
  const person = { x: -31.1, y: 1.2, z: -13.2 };
  assert.equal(isTargetFramedByCamera(droneCamera(), person), true, '对准人员时通过');

  // 把镜头转向天空，人员离开画面。
  const lookingAway = droneCamera();
  lookingAway.lookAt(-24, 30, -10);
  lookingAway.updateMatrixWorld();
  assert.equal(isTargetFramedByCamera(lookingAway, person), false, '没有对准人员时不通过');

  // 目标偏出画面中央 65% 区域。
  const offCenter = droneCamera();
  offCenter.position.set(-20, 15, -10);
  offCenter.lookAt(-20, 10, -30);
  offCenter.updateMatrixWorld();
  assert.equal(isTargetFramedByCamera(offCenter, person), false, '人员不在取景框内时不通过');
});
