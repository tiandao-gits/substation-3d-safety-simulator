import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getActPoints, type ActNo } from './act1';
import { createAct1StoryProps } from './storyProps';

function meshesOf(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) out.push(obj as THREE.Mesh);
  });
  return out;
}

const ALL_POINTS = ([1, 2, 3] as ActNo[]).flatMap((act) => getActPoints(act));

function distanceToNearestAnchor(point: THREE.Vector3): number {
  let best = Infinity;
  for (const anchor of ALL_POINTS) {
    best = Math.min(best, Math.hypot(point.x - anchor.x, point.z - anchor.z));
  }
  return best;
}

test('every clue prop sits near one of the checkpoints', () => {
  const props = createAct1StoryProps();
  props.update(null, new Set(), 'A', true, 0, 1);
  const meshes = meshesOf(props.group);
  assert.ok(meshes.length >= 18, `expected markers plus clue props, got ${meshes.length}`);
  const world = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.getWorldPosition(world);
    const nearest = distanceToNearestAnchor(world);
    assert.ok(
      nearest <= 2.5,
      `prop at (${world.x.toFixed(1)}, ${world.z.toFixed(1)}) is ${nearest.toFixed(1)} m from the nearest checkpoint`
    );
  }
  props.dispose();
});

test('only the current act markers are visible', () => {
  const props = createAct1StoryProps();
  const act1Arrow = props.group.getObjectByName('marker-arrow-aisle') as THREE.Mesh;
  const act2Arrow = props.group.getObjectByName('marker-arrow-a2-oil') as THREE.Mesh;
  const act3Arrow = props.group.getObjectByName('marker-arrow-a3-pit') as THREE.Mesh;
  assert.ok(act1Arrow && act2Arrow && act3Arrow);

  props.update(null, new Set(), 'A', true, 0, 2);
  assert.equal(act1Arrow.visible, false);
  assert.equal(act2Arrow.visible, true);
  assert.equal(act3Arrow.visible, false);
  props.dispose();
});

test('variant props only appear for their own seed variant', () => {
  const props = createAct1StoryProps();
  const oil = props.group.getObjectByName('prop-oil-stain') as THREE.Mesh;
  const wallHollow = props.group.getObjectByName('prop-wall-hollow') as THREE.Mesh;
  const boxFault = props.group.getObjectByName('prop-box-fault') as THREE.Mesh;
  const aisleLaser = props.group.getObjectByName('prop-aisle-laser') as THREE.Mesh;
  const pitLaser = props.group.getObjectByName('prop-pit-laser') as THREE.Mesh;
  assert.ok(oil && wallHollow && boxFault && aisleLaser && pitLaser);

  props.update(null, new Set(), 'A', true, 0, 1);
  assert.equal(aisleLaser.visible, true);

  props.update(null, new Set(), 'A', true, 0, 2);
  assert.equal(oil.visible, false);
  assert.equal(wallHollow.visible, false);

  props.update(null, new Set(), 'B', true, 0, 2);
  assert.equal(oil.visible, false);
  assert.equal(wallHollow.visible, true);

  props.update(null, new Set(), 'C', true, 0, 2);
  assert.equal(oil.visible, true);
  assert.equal(wallHollow.visible, false);

  props.update(null, new Set(), 'A', true, 0, 3);
  assert.equal(pitLaser.visible, true);
  assert.equal(boxFault.visible, true);

  props.update(null, new Set(['a3-box']), 'A', true, 0, 3);
  assert.equal(boxFault.visible, false);
  props.dispose();
});

test('过热巡检点不放置任何可被看穿的故障标记', () => {
  const props = createAct1StoryProps();
  // 过热属于"要考玩家发现"的缺陷：场景里不能有只出现在故障点上的热斑/红点，
  // 否则玩家不测温就能直接看出哪个点有问题。
  for (const variant of ['A', 'B', 'C'] as const) {
    props.update(null, new Set(), variant, true, 0, 1);
    assert.equal(
      props.group.getObjectByName('prop-hv10kv-hotspot'),
      undefined,
      `variant ${variant} 不应生成 10kV 热斑`
    );
    assert.equal(
      props.group.getObjectByName('prop-bay-hotspot'),
      undefined,
      `variant ${variant} 不应生成 F02 间隔热斑`
    );
  }
  props.dispose();
});

test('props stay hidden until the story layer shows them', () => {
  const props = createAct1StoryProps();
  assert.equal(props.group.visible, false);
  props.update('aisle', new Set(['bay-temp']), 'B', true, 1.25, 1);
  assert.equal(props.group.visible, true);
  props.update(null, new Set(), 'B', false, 2, 1);
  assert.equal(props.group.visible, false);
  props.dispose();
});

test('completed checkpoints disappear from the world', () => {
  const props = createAct1StoryProps();
  const aisleArrow = props.group.getObjectByName('marker-arrow-aisle') as THREE.Mesh;
  assert.ok(aisleArrow);
  props.update(null, new Set(['aisle']), 'A', true, 0, 1);
  assert.equal(aisleArrow.visible, false);
  props.update(null, new Set(), 'A', true, 0, 1);
  assert.equal(aisleArrow.visible, true);
  props.dispose();
});
