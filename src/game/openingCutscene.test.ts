import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cutsceneEntryYaw,
  sampleCutscene,
  type CutsceneScript,
} from './openingCutscene';

const SCRIPT: CutsceneScript = {
  duration: 4,
  endYaw: Math.PI / 2,
  waypoints: [
    { t: 0, x: 0, y: 0, z: 0 },
    { t: 2, x: -2, y: 0, z: 0 },
    { t: 3, x: -2, y: 0, z: -1 },
    { t: 4, x: -2, y: 0, z: -1 },
  ],
  shots: [
    { from: 0, position: { x: 0, y: 5, z: 5 }, target: { x: 0, y: 1, z: 0 }, fov: 60 },
    { from: 2, position: { x: -5, y: 2, z: -5 } },
  ],
  door: { openFrom: 1, openTo: 2, closeFrom: 3, closeTo: 4 },
};

test('零秒停在下楼起点，朝向沿第一段前进方向', () => {
  const frame = sampleCutscene(SCRIPT, 0);
  assert.equal(frame.x, 0);
  assert.equal(frame.z, 0);
  assert.ok(Math.abs(frame.yaw - Math.PI / 2) < 1e-6, '应面朝西（-x）');
  assert.equal(frame.moving, true);
  assert.equal(frame.speed, 1, '2 m / 2 s');
  assert.equal(frame.shotIndex, 0);
  assert.deepEqual(frame.cameraPosition, { x: 0, y: 5, z: 5 });
  assert.equal(frame.fov, 60);
  assert.equal(frame.doorOpen, 0);
  assert.equal(frame.done, false);
});

test('按时间线性走位，拐点平滑转向', () => {
  const half = sampleCutscene(SCRIPT, 1);
  assert.ok(Math.abs(half.x + 1) < 1e-6, '2 s 走 2 m，一半即 -1');

  // 刚进第二段（z 方向）时还在转向过渡里，不能瞬间转 90°。
  const corner = sampleCutscene(SCRIPT, 2);
  assert.ok(Math.abs(corner.z - 0) < 1e-6);
  assert.ok(
    Math.abs(corner.yaw - Math.PI / 2) < 1e-6,
    '拐点处仍保持上一段朝向（过渡起点）'
  );

  const afterCorner = sampleCutscene(SCRIPT, 2.5);
  assert.ok(Math.abs(afterCorner.z + 0.5) < 1e-6);
  assert.ok(Math.abs(afterCorner.yaw) < 1e-6, '过渡完成后朝 -z');
});

test('最后一段站定：速度为 0，朝向交还给 endYaw', () => {
  const standing = sampleCutscene(SCRIPT, 3.5);
  assert.equal(standing.speed, 0);
  assert.equal(standing.moving, false);
  assert.ok(
    Math.abs(standing.yaw - Math.PI / 4) < 1e-6,
    '站定段把朝向从 0 缓缓转到 endYaw（一半即 π/4）'
  );

  const done = sampleCutscene(SCRIPT, 4);
  assert.equal(done.done, true);
  assert.equal(done.speed, 0);
  assert.ok(Math.abs(done.yaw - SCRIPT.endYaw) < 1e-6);
  assert.equal(done.x, -2);
  assert.equal(done.z, -1);
});

test('镜头按镜号硬切，未给 target 时跟人物胸口', () => {
  const first = sampleCutscene(SCRIPT, 1.9);
  assert.equal(first.shotIndex, 0);
  assert.deepEqual(first.cameraTarget, { x: 0, y: 1, z: 0 });

  const second = sampleCutscene(SCRIPT, 2.1);
  assert.equal(second.shotIndex, 1);
  assert.deepEqual(second.cameraPosition, { x: -5, y: 2, z: -5 });
  assert.ok(Math.abs(second.cameraTarget.x + 2) < 0.05);
  assert.ok(Math.abs(second.cameraTarget.y - 1.15) < 1e-6);
  assert.equal(second.fov, 50, '未声明 fov 时用默认 50');
});

test('门在时间窗内开、在时间窗内关', () => {
  assert.equal(sampleCutscene(SCRIPT, 1).doorOpen, 0, '开窗前保持关闭');
  const halfOpen = sampleCutscene(SCRIPT, 1.5).doorOpen;
  assert.ok(halfOpen > 0.4 && halfOpen < 0.6, `中段应半开，实际 ${halfOpen}`);
  assert.equal(sampleCutscene(SCRIPT, 2).doorOpen, 1, '开完保持全开');
  assert.ok(
    Math.abs(sampleCutscene(SCRIPT, 3.5).doorOpen - 0.5) < 0.02,
    '关到一半'
  );
  assert.equal(sampleCutscene(SCRIPT, 4).doorOpen, 0, '过场结束时门已带上');
});

test('入场朝向取第一段方向', () => {
  assert.ok(Math.abs(cutsceneEntryYaw(SCRIPT) - Math.PI / 2) < 1e-6);
  const single: CutsceneScript = {
    duration: 1,
    endYaw: 1.23,
    waypoints: [{ t: 0, x: 0, y: 0, z: 0 }],
    shots: [{ from: 0, position: { x: 0, y: 0, z: 0 } }],
  };
  assert.equal(cutsceneEntryYaw(single), 1.23, '只有一个路点时退回 endYaw');
});
