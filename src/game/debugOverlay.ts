/**
 * `?storyDebug=1` spatial overlay: collider wireframes, world axes, site bounds
 * and checkpoint labels. Coordinate work against the imported GLB is otherwise
 * invisible, and the anchors have to be checkable without editing the blend.
 */

import * as THREE from 'three';
import { ACT1_POINTS } from './act1';
import { SUBSTATION_OBSTACLES, WORLD_BOUNDS, siteGroundHeight } from './rules';

const LABEL_FONT = '24px "JetBrains Mono", monospace';
const LABEL_PADDING = 14;
const LABEL_HEIGHT = 56;
/** Labels size to their own text, then shrink to stay readable rather than huge. */
const LABEL_WORLD_HEIGHT = 0.42;
const LABEL_WORLD_MAX_WIDTH = 2;

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const body = canvas.getContext('2d');
  // Resizing a canvas resets its 2D state, so measure with the font applied
  // first and re-apply it afterwards.
  if (body) body.font = LABEL_FONT;
  const textWidth = body?.measureText(text).width ?? text.length * 14;
  canvas.width = Math.ceil(textWidth + LABEL_PADDING * 2);
  canvas.height = LABEL_HEIGHT;
  if (body) {
    body.font = LABEL_FONT;
    body.fillStyle = 'rgba(4, 10, 18, 0.78)';
    body.fillRect(0, 0, canvas.width, canvas.height);
    body.strokeStyle = '#38bdf8';
    body.lineWidth = 3;
    body.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    body.fillStyle = '#e2f3ff';
    body.textBaseline = 'middle';
    body.fillText(text, LABEL_PADDING, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  const aspect = canvas.width / canvas.height;
  const height = Math.min(LABEL_WORLD_HEIGHT, LABEL_WORLD_MAX_WIDTH / aspect);
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}

export interface StoryDebugOverlay {
  group: THREE.Group;
  dispose: () => void;
}

export function createStoryDebugOverlay(): StoryDebugOverlay {
  const group = new THREE.Group();
  group.name = 'STORY_DEBUG';

  const hazardMat = new THREE.LineBasicMaterial({ color: 0xff6b35 });
  const solidMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const disposables: Array<{ dispose: () => void }> = [hazardMat, solidMat];

  group.add(new THREE.AxesHelper(6));

  for (const box of SUBSTATION_OBSTACLES) {
    const width = box.maxX - box.minX;
    const depth = box.maxZ - box.minZ;
    const height = Math.max(0.4, box.height);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
    const wire = new THREE.LineSegments(edges, box.isHazard ? hazardMat : solidMat);
    const centerX = (box.minX + box.maxX) / 2;
    const centerZ = (box.minZ + box.maxZ) / 2;
    wire.position.set(centerX, siteGroundHeight(centerX, centerZ) + height / 2, centerZ);
    group.add(wire);
    disposables.push(edges);
  }

  const boundsPoints = [
    new THREE.Vector3(WORLD_BOUNDS.minX, 0.1, WORLD_BOUNDS.minZ),
    new THREE.Vector3(WORLD_BOUNDS.maxX, 0.1, WORLD_BOUNDS.minZ),
    new THREE.Vector3(WORLD_BOUNDS.maxX, 0.1, WORLD_BOUNDS.maxZ),
    new THREE.Vector3(WORLD_BOUNDS.minX, 0.1, WORLD_BOUNDS.maxZ),
    new THREE.Vector3(WORLD_BOUNDS.minX, 0.1, WORLD_BOUNDS.minZ),
  ];
  const boundsGeo = new THREE.BufferGeometry().setFromPoints(boundsPoints);
  const boundsMat = new THREE.LineBasicMaterial({ color: 0xfacc15 });
  group.add(new THREE.Line(boundsGeo, boundsMat));
  disposables.push(boundsGeo, boundsMat);

  for (const point of ACT1_POINTS) {
    const label = makeLabel(`${point.id} ${point.x.toFixed(1)},${point.z.toFixed(1)}`);
    label.position.set(point.x, siteGroundHeight(point.x, point.z) + 2.6, point.z);
    group.add(label);
    const material = label.material as THREE.SpriteMaterial;
    disposables.push(material, material.map!);
  }

  return {
    group,
    dispose() {
      disposables.forEach((item) => item.dispose());
      group.removeFromParent();
    },
  };
}
