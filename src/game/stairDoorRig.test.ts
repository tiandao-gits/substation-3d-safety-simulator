/**
 * 玻璃门装配：验证"只切门扇、不动门框"，以及铰链旋转确实把门扇甩到门外侧。
 * 用合成几何代替真实 GLB（真实模型在运行期加载），保证这条逻辑可回归。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStairDoorRig, STAIR_DOOR } from './stairDoorRig';

/** 门扇内的三角形（贴着 x=30.65 的门板平面）与远处的三角形各一个。 */
function buildHost(meshName = 'glass') {
  const host = new THREE.Group();
  const positions = new Float32Array([
    // 门扇内
    30.65, 0.8, -19.8,
    30.65, 2.0, -19.8,
    30.65, 0.8, -19.3,
    // 门框外（远处墙面）
    5, 0, 5,
    6, 0, 5,
    5, 0, 6,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = meshName;
  host.add(mesh);
  return { host, mesh };
}

function leafWorldPoints(rig: ReturnType<typeof createStairDoorRig>) {
  assert.ok(rig);
  // 渲染循环里由 renderer 每帧刷新矩阵；测试里手动从铰链往下刷。
  rig.pivot.updateMatrixWorld(true);
  const leaf = rig.pivot.children[0] as THREE.Mesh;
  leaf.updateMatrixWorld(true);
  const position = leaf.geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i += 1) {
    points.push(
      new THREE.Vector3()
        .fromBufferAttribute(position as THREE.BufferAttribute, i)
        .applyMatrix4(leaf.matrixWorld)
    );
  }
  return points;
}

test('门扇被切出来，门框留在原网格里', () => {
  const { host, mesh } = buildHost();
  const rig = createStairDoorRig(host);
  assert.ok(rig, '应能找到门扇');
  assert.equal(rig.leafTriangles, 1);
  assert.equal(rig.pivot.parent, host, '铰链挂回建筑根节点');

  const remaining = mesh.geometry.getAttribute('position');
  assert.equal(remaining.count, 3, '原网格只剩门外那个三角形');
  const leaf = rig.pivot.children[0] as THREE.Mesh;
  assert.equal(leaf.geometry.getAttribute('position').count, 3);
  assert.equal(leaf.name, 'STAIR_DOOR_LEAF_glass');
});

test('关门时门扇贴在门洞上，开门后甩到站区一侧且不穿入南侧门廊墙体', () => {
  const { host } = buildHost();
  const rig = createStairDoorRig(host);
  assert.ok(rig);

  rig.setOpen(0);
  const closed = leafWorldPoints(rig);
  assert.ok(Math.abs(closed[0].x - 30.65) < 1e-4, '关门时门扇仍在 x=30.65 的墙面上');
  assert.ok(closed.some((p) => Math.abs(p.z + 19.8) < 1e-4));

  rig.setOpen(1);
  const opened = leafWorldPoints(rig);
  // 铰链在南端 z=-19.20，门扇向北展开；开门后自由端被甩向 -x（站区），且全程停留在南墙面 z=-19.174 以北。
  assert.ok(opened[0].x < 30.65 - 0.2, '门扇自由端应离开墙面、朝站区张开');
  assert.ok(
    opened.every((p) => p.z > -19.9 && p.z < -19.174),
    '门扇不应挡在门洞北侧，也不能越过 z=-19.174 穿入南侧砖墙'
  );
});

test('跨越主门扇盒边界的通高外框与北侧亮子不会被误切走', () => {
  const host = new THREE.Group();
  const positions = new Float32Array([
    // 主门扇内三角形（应被切出）
    30.655, 0.8, -19.8,
    30.655, 2.0, -19.8,
    30.655, 0.8, -19.3,
    // 通高外门框立柱（顶点延伸到 y=2.838，质心虽在盒内但顶部越界，必须留在原网格）
    30.655, 0.27, -19.201,
    30.655, 0.27, -19.202,
    30.655, 2.838, -19.201,
    // 北侧固定窄亮子（z < -20.0315，必须留在原网格）
    30.658, 0.4, -20.23,
    30.658, 2.0, -20.23,
    30.658, 0.4, -20.09,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = 'metal_brown';
  host.add(mesh);

  const rig = createStairDoorRig(host);
  assert.ok(rig);
  assert.equal(rig.leafTriangles, 1, '只切出主门扇内的 1 个三角形');
  assert.equal(
    mesh.geometry.getAttribute('position').count,
    6,
    '通高外门框与北侧固定亮子的 2 个三角形都留在原网格'
  );
});

test('开度被夹在 0…1，且是单调旋转', () => {
  const { host } = buildHost();
  const rig = createStairDoorRig(host);
  assert.ok(rig);

  rig.setOpen(-1);
  const clampedLow = rig.pivot.rotation.y;
  assert.equal(clampedLow, 0);

  rig.setOpen(0.5);
  const mid = rig.pivot.rotation.y;
  assert.ok(Math.abs(mid - STAIR_DOOR.openAngle * 0.5) < 1e-6);

  rig.setOpen(2);
  assert.ok(Math.abs(rig.pivot.rotation.y - STAIR_DOOR.openAngle) < 1e-6);
  assert.ok(mid > 0 && mid < rig.pivot.rotation.y, '开度越大转角越大');
});

test('模型里找不到门扇时返回 null，不做假门', () => {
  const { host } = buildHost('not_a_door_mesh');
  assert.equal(createStairDoorRig(host), null);
});

test('门扇盒外的网格完全不动', () => {
  const host = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      3
    )
  );
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = 'glass';
  host.add(mesh);
  const rig = createStairDoorRig(host);
  // 所有玻璃都在门扇盒外：不应切出任何东西，也不能把门扇整体藏掉。
  assert.equal(rig, null);
  assert.equal(mesh.visible, true);
  assert.equal(mesh.geometry.getAttribute('position').count, 3);
});
