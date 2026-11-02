import * as THREE from 'three';
import type { ActNo } from './act1';
import {
  evaluateLaserMeasurement,
  type LaserMeasurementResult,
} from './laserRangefinder';
import type { PlayerState } from './rules';

export interface LaserBeamRig {
  group: THREE.Group;
  setActive: (active: boolean) => void;
  isActive: () => boolean;
  updateFromRaycast: (
    camera: THREE.PerspectiveCamera,
    targetRoot: THREE.Object3D,
    player: PlayerState,
    act: ActNo,
    ndc?: { x: number; y: number },
    useCameraOrigin?: boolean,
    elapsedSeconds?: number
  ) => LaserMeasurementResult | null;
  dispose: () => void;
}

const MAX_LASER_RANGE_M = 65;

export function createLaserBeamRig(): LaserBeamRig {
  const group = new THREE.Group();
  group.name = 'LaserRangefinderRayRig';
  group.visible = false;
  group.userData.ignoreLaserRaycast = true;

  // 1. 3D 红色激光束主线
  const linePositions = new Float32Array(6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(linePositions, 3)
  );
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xff1e38,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  });
  const beamLine = new THREE.Line(lineGeo, lineMat);
  beamLine.frustumCulled = false;
  beamLine.userData.ignoreLaserRaycast = true;
  group.add(beamLine);

  // 2. 命中点高亮红色激光靶点球 + 脉冲波纹环
  const hitDotGroup = new THREE.Group();
  hitDotGroup.userData.ignoreLaserRaycast = true;

  const dotGeo = new THREE.SphereGeometry(0.055, 14, 14);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xff2a44,
  });
  const dotMesh = new THREE.Mesh(dotGeo, dotMat);
  dotMesh.userData.ignoreLaserRaycast = true;
  hitDotGroup.add(dotMesh);

  const ringGeo = new THREE.RingGeometry(0.09, 0.145, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff4d6d,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.userData.ignoreLaserRaycast = true;
  hitDotGroup.add(ringMesh);

  group.add(hitDotGroup);

  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.2;
  raycaster.far = MAX_LASER_RANGE_M;
  const ndcVec = new THREE.Vector2(0, 0);

  let active = false;

  const isIgnoredObject = (obj: THREE.Object3D): boolean => {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      if (!curr.visible) return true;
      if (curr.userData?.ignoreLaserRaycast) return true;
      const name = curr.name || '';
      if (
        name === 'LaserRangefinderRayRig' ||
        name === 'Act1StoryProps' ||
        name === 'SubstationSafetyLines' ||
        name === 'StoryDebugOverlay' ||
        name.startsWith('Mixamo') ||
        name.startsWith('CrewOverheadTag_')
      ) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  };

  return {
    group,
    setActive(next: boolean) {
      active = next;
      group.visible = next;
    },
    isActive() {
      return active;
    },
    updateFromRaycast(
      camera: THREE.PerspectiveCamera,
      targetRoot: THREE.Object3D,
      player: PlayerState,
      act: ActNo,
      ndc = { x: 0, y: 0 },
      useCameraOrigin = false,
      elapsedSeconds = 0
    ): LaserMeasurementResult | null {
      if (!active) {
        group.visible = false;
        return null;
      }
      group.visible = true;
      ndcVec.set(ndc.x, ndc.y);
      raycaster.setFromCamera(ndcVec, camera);

      const rawHits = raycaster.intersectObject(targetRoot, true);
      let validHit: THREE.Intersection | null = null;
      for (const hit of rawHits) {
        if ((hit.object as THREE.Sprite).isSprite) continue;
        if ((hit.object as THREE.Line).isLine) continue;
        if (isIgnoredObject(hit.object)) continue;
        validHit = hit;
        break;
      }

      // 计算激光发射源点：工作台或第一人称下从相机右下方发出；第三人称巡视时从角色右手测距仪位置发出
      let originX: number;
      let originY: number;
      let originZ: number;
      if (useCameraOrigin || player.perspective === 'first-person') {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3()
          .crossVectors(forward, camera.up)
          .normalize();
        originX = camera.position.x + right.x * 0.18 + forward.x * 0.25;
        originY = camera.position.y - 0.14 + forward.y * 0.25;
        originZ = camera.position.z + right.z * 0.18 + forward.z * 0.25;
      } else {
        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);
        const rightX = cosY;
        const rightZ = -sinY;
        const forwardX = -sinY;
        const forwardZ = -cosY;
        originX = player.x + rightX * 0.26 + forwardX * 0.32;
        originY = player.y + 1.34;
        originZ = player.z + rightZ * 0.26 + forwardZ * 0.32;
      }

      let hitPoint: THREE.Vector3;
      const ancestorNames: string[] = [];

      if (validHit) {
        hitPoint = validHit.point;
        let curr: THREE.Object3D | null = validHit.object;
        while (curr && ancestorNames.length < 8) {
          if (curr.name) ancestorNames.push(curr.name);
          curr = curr.parent;
        }
      } else {
        hitPoint = new THREE.Vector3()
          .copy(raycaster.ray.origin)
          .addScaledVector(raycaster.ray.direction, 28);
      }

      // 更新 3D 射线顶点
      const posAttr = lineGeo.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, originX, originY, originZ);
      posAttr.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
      posAttr.needsUpdate = true;
      lineGeo.computeBoundingSphere();

      // 更新命中点靶标与法线朝向
      hitDotGroup.position.copy(hitPoint);
      ringMesh.lookAt(camera.position);
      const pulse = 1 + 0.22 * Math.sin(elapsedSeconds * 9);
      ringMesh.scale.setScalar(pulse);

      const result = evaluateLaserMeasurement(
        { x: originX, y: originY, z: originZ },
        { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
        ancestorNames,
        act
      );

      // 安全距离不足时激光束闪烁告警亮红，合格时保持标准测距红光
      lineMat.color.setHex(result.isSafe ? 0xff1e38 : 0xffaa00);
      dotMat.color.setHex(result.isSafe ? 0xff2a44 : 0xff9900);

      return result;
    },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
