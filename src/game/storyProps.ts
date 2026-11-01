/**
 * In-world checkpoint dressing for all three acts (three.js primitives only).
 * Includes uniform micro-glow markers per checkpoint plus 3D defect & measurement clue props
 * bound to the actual substation model coordinates.
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
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.58, 32),
        ringMat
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, groundY + 0.02, point.z);

      const arrowMat = new THREE.MeshBasicMaterial({
        color: MARKER_COLOR.clone(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.42, 4),
        arrowMat
      );
      arrow.rotation.x = Math.PI;
      arrow.position.set(point.x, groundY + 2.85, point.z);
      arrow.name = `marker-arrow-${point.id}`;

      group.add(ring, arrow);
      markers.set(point.id, { act, ring, arrow });
    }
  }

  // 1. Act 1 — 10kV 3号柜 B相母排接头过热微红热斑（variant C）
  const hv = getAct1Point('hv-10kv');
  const hvHotspotMat = new THREE.MeshBasicMaterial({
    color: 0xff3b1f,
    transparent: true,
    opacity: 0.85,
  });
  const hvHotspot = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 16, 12),
    hvHotspotMat
  );
  hvHotspot.position.set(hv.x, 1.48, hv.z - 0.82);
  hvHotspot.name = 'prop-hv10kv-hotspot';
  group.add(hvHotspot);

  // 2. Act 1 — 巡视通道净宽 0.78m 红色激光测距标尺线
  const aisle = getAct1Point('aisle');
  const aisleY = siteGroundHeight(aisle.x, aisle.z);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.9,
  });
  const aisleLaser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.78, 12),
    laserMat
  );
  aisleLaser.rotation.z = Math.PI / 2;
  aisleLaser.position.set(aisle.x, aisleY + 0.16, aisle.z);
  aisleLaser.name = 'prop-aisle-laser';
  group.add(aisleLaser);

  // 3. Act 1 — F02 间隔 B 相引线接头过热热斑（variant B）
  const bay = getAct1Point('bay-temp');
  const bayHotspotMat = new THREE.MeshBasicMaterial({
    color: 0xff451a,
    transparent: true,
    opacity: 0.88,
  });
  const bayHotspot = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 12),
    bayHotspotMat
  );
  bayHotspot.position.set(bay.x, 2.75, bay.z - 1.3);
  bayHotspot.name = 'prop-bay-hotspot';
  group.add(bayHotspot);

  // 4. Act 2 — 1#/2# 主变防火墙东侧受潮暗斑与空鼓红粉笔圈记（variant B）
  const wall = getAct1Point('a2-wall');
  const wallDamp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.62),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.92,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })
  );
  wallDamp.rotation.y = Math.PI / 2;
  wallDamp.position.set(wall.x - 0.35, 1.55, wall.z);
  wallDamp.name = 'prop-wall-damp';

  const wallHollowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.33, 28),
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
  );
  wallHollowRing.rotation.y = Math.PI / 2;
  wallHollowRing.position.set(wall.x - 0.33, 1.55, wall.z);
  wallHollowRing.name = 'prop-wall-hollow';
  group.add(wallDamp, wallHollowRing);

  // 5. Act 2 — 1# 主变本体底部渗漏油迹（variant C）
  const oil = getAct1Point('a2-oil');
  const oilY = siteGroundHeight(oil.x, oil.z);
  const oilStain = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.25,
      metalness: 0.35,
    })
  );
  oilStain.rotation.x = -Math.PI / 2;
  oilStain.position.set(oil.x, oilY + 0.015, oil.z);
  oilStain.name = 'prop-oil-stain';
  group.add(oilStain);

  // 6. Act 3 — 基坑临边 2.4m 缺口激光测距线与坑内积水反光面
  const pit = getAct1Point('a3-pit');
  const pitY = siteGroundHeight(pit.x, pit.z);
  const pitLaser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 2.4, 12),
    laserMat
  );
  pitLaser.rotation.z = Math.PI / 2;
  pitLaser.position.set(pit.x, pitY + 0.42, pit.z);
  pitLaser.name = 'prop-pit-laser';

  const pitWater = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 24),
    new THREE.MeshStandardMaterial({
      color: 0x134e4a,
      roughness: 0.15,
      metalness: 0.65,
      transparent: true,
      opacity: 0.78,
    })
  );
  pitWater.rotation.x = -Math.PI / 2;
  pitWater.position.set(pit.x, pitY + 0.012, pit.z);
  pitWater.name = 'prop-pit-water';
  group.add(pitLaser, pitWater);

  // 7. Act 3 — 临时配电箱接地/漏保异常警示光圈
  const box = getAct1Point('a3-box');
  const boxY = siteGroundHeight(box.x, box.z);
  const boxFault = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.38, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
    })
  );
  boxFault.rotation.x = -Math.PI / 2;
  boxFault.position.set(box.x, boxY + 0.024, box.z);
  boxFault.name = 'prop-box-fault';
  group.add(boxFault);

  return {
    group,
    update(activeId, done, variant, visible, elapsed, act) {
      group.visible = visible;
      if (!visible) return;

      const thermalPulse = 0.65 + 0.35 * Math.sin(elapsed * 5.2);
      hvHotspot.visible = act === 1 && variant === 'C';
      hvHotspotMat.opacity = thermalPulse;
      hvHotspot.scale.setScalar(0.92 + 0.16 * Math.sin(elapsed * 4.5));

      aisleLaser.visible = act === 1 && !done.has('aisle');

      bayHotspot.visible = act === 1 && variant === 'B';
      bayHotspotMat.opacity = thermalPulse;
      bayHotspot.scale.setScalar(0.92 + 0.18 * Math.sin(elapsed * 4.8));

      const showWallDefect = act === 2 && variant === 'B';
      wallDamp.visible = showWallDefect;
      wallHollowRing.visible = showWallDefect;

      oilStain.visible = act === 2 && variant === 'C';

      const showPitClues = act === 3 && !done.has('a3-pit');
      pitLaser.visible = showPitClues;
      pitWater.visible = showPitClues;

      boxFault.visible = act === 3 && !done.has('a3-box');

      for (const [id, marker] of markers) {
        const isDone = done.has(id);
        const markerVisible = marker.act === act && !isDone;
        marker.ring.visible = markerVisible;
        marker.arrow.visible = markerVisible;
        if (!markerVisible) continue;
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
