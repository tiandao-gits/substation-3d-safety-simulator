/**
 * 幕间出生点约束：每一幕都要有明确出生点、面朝西方、可站立且不在带电区；
 * 第三幕额外校验开场过场（下楼 → 开门 → 走到楼下）的脚本数据。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ACT_START_SPAWNS } from './actSpawns';
import type { ActNo } from '../game/act1';
import {
  getLiveZoneAt,
  resolvePlayerCollision,
  SUBSTATION_OBSTACLES,
} from '../game/rules';
import { cutsceneEntryYaw } from '../game/openingCutscene';

const ACTS: ActNo[] = [1, 2, 3];

test('每一幕出生点都可站立、不压建筑、不在带电区', () => {
  for (const act of ACTS) {
    const spawn = ACT_START_SPAWNS[act];
    const safe = resolvePlayerCollision(spawn.x, spawn.z, 0.55);
    assert.ok(
      Math.hypot(safe.x - spawn.x, safe.z - spawn.z) < 0.01,
      `第 ${act} 幕出生点被障碍推开了`
    );
    assert.equal(safe.hitObstacle, null, `第 ${act} 幕出生点压在障碍上`);

    for (const zone of SUBSTATION_OBSTACLES) {
      const inside =
        safe.x > zone.minX &&
        safe.x < zone.maxX &&
        safe.z > zone.minZ &&
        safe.z < zone.maxZ;
      assert.equal(inside, false, `第 ${act} 幕出生点落在 ${zone.id} 内`);
    }

    assert.equal(
      getLiveZoneAt(spawn.x, spawn.z, act),
      null,
      `第 ${act} 幕出生点不应落在带电警戒区内`
    );
  }
});

test('每一幕出生都面朝正西', () => {
  for (const act of ACTS) {
    const { yaw } = ACT_START_SPAWNS[act];
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    assert.ok(Math.abs(forwardX + 1) < 1e-6, `第 ${act} 幕应朝西（forwardX=-1）`);
    assert.ok(Math.abs(forwardZ) < 1e-6, `第 ${act} 幕不应偏南北`);
  }
});

test('第三幕开场过场：侧拍公寓门口，人物出门后走到楼下出生点', () => {
  const act3 = ACT_START_SPAWNS[3];
  const cutscene = act3.cutscene;
  assert.ok(cutscene, '第三幕应带开场过场');

  const first = cutscene.waypoints[0];
  const last = cutscene.waypoints[cutscene.waypoints.length - 1];
  // 起点仍在楼梯上（画面外），终点必须落在出生点。
  assert.ok(first.x > 31.5, '起点应在楼梯上、门内侧');
  assert.ok(first.y > 0.3 && first.y < 1.6, '起点标高应在楼梯踏步范围内');
  assert.equal(first.z, -19.8, '楼梯位于公寓楼北侧 z=-19.8');

  assert.equal(last.x, act3.x, '过场终点必须等于出生点 x');
  assert.equal(last.z, act3.z, '过场终点必须等于出生点 z');
  assert.equal(cutscene.endYaw, act3.yaw, '过场结束后朝向应与出生朝向一致');

  // 时间轴必须单调、起点为 0、末尾与总时长对齐。
  assert.equal(first.t, 0);
  assert.equal(last.t, cutscene.duration);
  for (let i = 1; i < cutscene.waypoints.length; i += 1) {
    assert.ok(
      cutscene.waypoints[i].t >= cutscene.waypoints[i - 1].t,
      '路点时间必须单调不减'
    );
  }

  // 出场方向是西（-x），入场朝向应接近正西。
  const entryYaw = cutsceneEntryYaw(cutscene);
  assert.ok(Math.abs(-Math.sin(entryYaw) + 1) < 1e-3, '入场应面朝西走向门口');

  // 只用一台侧对公寓的机位：不切镜、不拍楼梯间内景。
  assert.equal(cutscene.shots.length, 1, '开场过场应为单机位侧拍');
  assert.equal(cutscene.shots[0].from, 0);

  // 门：在人物走到门口之前打开，且开度窗口合法。
  const door = cutscene.door!;
  assert.ok(door, '第三幕过场必须带门动画');
  assert.ok(door.openTo > door.openFrom, '开门区间必须为正');
  assert.ok(door.closeFrom! > door.openTo, '关门必须晚于开完');
  assert.ok(door.closeTo! <= cutscene.duration, '关门必须在过场内完成');
  // 人物跨出门槛（玻璃门 x≈30.655）的时刻：在路点之间线性插值。
  const doorX = 30.655;
  let crossingT = -1;
  for (let i = 1; i < cutscene.waypoints.length; i += 1) {
    const a = cutscene.waypoints[i - 1];
    const b = cutscene.waypoints[i];
    if (a.x === b.x) continue;
    if ((a.x - doorX) * (b.x - doorX) <= 0) {
      crossingT = a.t + ((a.x - doorX) / (a.x - b.x)) * (b.t - a.t);
      break;
    }
  }
  assert.ok(crossingT > 0, '过场必须跨过门槛');
  assert.ok(door.openTo <= crossingT, '门必须在他跨出门槛前就开到位');

  // 室外路点必须可站立、不压障碍、不在带电区。
  for (const point of cutscene.waypoints) {
    if (point.x > 30.4) continue; // 室内楼梯段由过场接管，不参与碰撞
    const safe = resolvePlayerCollision(point.x, point.z, 0.55);
    assert.ok(
      Math.hypot(safe.x - point.x, safe.z - point.z) < 0.01,
      `路点 (${point.x}, ${point.z}) 被障碍推开`
    );
    assert.equal(
      getLiveZoneAt(point.x, point.z, 3),
      null,
      `路点 (${point.x}, ${point.z}) 落入带电区`
    );
  }
});
