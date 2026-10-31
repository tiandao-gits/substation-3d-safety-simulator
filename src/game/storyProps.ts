/**
 * In-world checkpoint dressing for all three acts (three.js primitives only).
 * One uniform micro-glow marker per checkpoint, plus minimal clue props.
 */

import * as THREE from 'three';
import {
  ACT_POINTS,
  getAct1Point,
  type Act1PointId,
  type Act1Variant,
  type ActNo,
} from './act1';
import { siteGroundHeight } from './rules';

export interface Act1StoryProps {
  group: THREE.Group;
  update: (
    activeId: Act1PointId | null,
    done: Set<Act1PointId>,
    variant: Act1Variant | null,
    visible: boolean,
    elapsed: number,
    act: ActNo
  ) => void;
  dispose: () => void;
}

const MARKER_COLOR = new THREE.Color(0x38bdf8);

export function createAct1StoryProps(): Act1StoryProps {
  const group = new THREE.Group();
  group.name = 'ACT1_STORY_PROPS';
  group.visible = false;

  const markers = new Map<
    Act1PointId,
    { act: ActNo; ring: THREE.Mesh; arrow: THREE.Mesh }
  >();

  for (const act of [1, 2, 3] as ActNo[]) {
    for (const point of ACT_POINTS[act]) {
      const groundY = siteGroundHeight(point.x, point.z);
      const ringMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR.clone(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 32), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, groundY + 0.02, point.z);

      const arrowMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR.clone(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), arrowMat);
      arrow.rotation.x = Math.PI;
      arrow.position.set(point.x, groundY + 2.85, point.z);
      arrow.name = `marker-arrow-${point.id}`;

      group.add(ring, arrow);
      markers.set(point.id, { act, ring, arrow });
    }
  }

  // Act 1 的通道材料堆改用 GLB 施工场景里的木料堆模型，
  // 由 substationBuilder.cloneSceneNode('Planks', ...) 在场景加载完成后放置。
  // Act 2 的防火墙本体来自场景 GLB/碰撞体，不再生成额外道具。

  // Act 2 — oil stain at the transformer base (variant C).
  const oil = getAct1Point('a2-oil');
  const oilY = siteGroundHeight(oil.x, oil.z);
  const oilStain = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1 })
  );
  oilStain.rotation.x = -Math.PI / 2;
  oilStain.position.set(oil.x, oilY + 0.015, oil.z);
  oilStain.name = 'prop-oil-stain';
  group.add(oilStain);

  return {
    group,
    update(activeId, done, variant, visible, elapsed, act) {
      group.visible = visible;
      if (!visible) return;
      oilStain.visible = act === 2 && variant === 'C';
      for (const [id, marker] of markers) {
        const isDone = done.has(id);
        const visible = marker.act === act && !isDone;
        marker.ring.visible = visible;
        marker.arrow.visible = visible;
        if (!visible) continue;
        const isActive = activeId === id;
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3 + id.length);
        const ringMat = marker.ring.material as THREE.MeshBasicMaterial;
        const arrowMat = marker.arrow.material as THREE.MeshBasicMaterial;
        ringMat.color.copy(MARKER_COLOR);
        arrowMat.color.copy(MARKER_COLOR);
        ringMat.opacity = isActive ? 0.95 : 0.4 + pulse * 0.2;
        marker.arrow.position.y =
          siteGroundHeight(marker.ring.position.x, marker.ring.position.z) +
          2.85 +
          Math.sin(elapsed * 2.4 + id.length) * 0.12;
        marker.ring.scale.setScalar(isActive ? 1.18 : 1);
      }
    },
    dispose() {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      });
      group.removeFromParent();
    },
  };
}
