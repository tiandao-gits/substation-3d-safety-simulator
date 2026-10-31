/**
 * 地面警戒线：红线=运行带电（禁止跨越，越线即触电），黄线=停电检修区边界。
 * 区域取自 rules.SAFETY_LINE_ZONES，与 GLB 实测设备轮廓一致；贴图用画布生成，
 * 不依赖外部图片资源。
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SAFETY_LINE_ZONES, siteGroundHeight, type SafetyLineZone } from './rules';

const TAPE_WIDTH_M = 0.4;
/** 一个贴图平铺对应的带长（米），决定斜纹间距。 */
const TAPE_TILE_M = 1.0;
const TAPE_LIFT_M = 0.035;
const ALL_ACTS = [1, 2, 3];

function createTapeTexture(stripe: string, base: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // 45° 斜纹：剪切量等于画布高度，保证左右平铺无缝。
  ctx.fillStyle = stripe;
  for (let x = -size; x < size * 2; x += size / 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + size / 4, 0);
    ctx.lineTo(x + size / 4 + size, size);
    ctx.lineTo(x + size, size);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function bandGeometry(zone: SafetyLineZone, from: [number, number], to: [number, number]) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const geometry = new THREE.PlaneGeometry(length, TAPE_WIDTH_M);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, uv.getX(i) * (length / TAPE_TILE_M), uv.getY(i));
  }
  uv.needsUpdate = true;

  geometry.rotateX(-Math.PI / 2);
  geometry.rotateY(Math.atan2(-(to[1] - from[1]), to[0] - from[0]));
  const midX = (from[0] + to[0]) / 2;
  const midZ = (from[1] + to[1]) / 2;
  geometry.translate(midX, siteGroundHeight(midX, midZ) + TAPE_LIFT_M, midZ);
  return geometry;
}

function zoneBands(zone: SafetyLineZone) {
  const { minX, maxX, minZ, maxZ } = zone;
  return [
    bandGeometry(zone, [minX, minZ], [maxX, minZ]),
    bandGeometry(zone, [maxX, minZ], [maxX, maxZ]),
    bandGeometry(zone, [maxX, maxZ], [minX, maxZ]),
    bandGeometry(zone, [minX, maxZ], [minX, minZ]),
  ];
}

function tapeMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: texture,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: THREE.DoubleSide,
  });
}

export interface SafetyLineHandles {
  group: THREE.Group;
  update: (act: number, visible: boolean) => void;
  dispose: () => void;
}

export function createSafetyLines(): SafetyLineHandles {
  const group = new THREE.Group();
  group.name = 'SAFETY_LINES';
  group.visible = false;

  const redTexture = createTapeTexture('#c81e1e', '#f8fafc');
  const yellowTexture = createTapeTexture('#facc15', '#1f2937');
  const redMaterial = tapeMaterial(redTexture);
  const yellowMaterial = tapeMaterial(yellowTexture);

  const alwaysLive = SAFETY_LINE_ZONES.filter((zone) =>
    ALL_ACTS.every((act) => zone.liveActs.includes(act))
  );
  /** 停电检修区（1# 主变全天检修，始终黄线）。 */
  const outageZones = SAFETY_LINE_ZONES.filter(
    (zone) => zone.outageLine && !ALL_ACTS.every((act) => zone.liveActs.includes(act))
  );

  const meshes: THREE.Mesh[] = [];
  const addMesh = (
    geometries: THREE.BufferGeometry[],
    material: THREE.Material,
    name: string
  ) => {
    if (geometries.length === 0) return;
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.renderOrder = 2;
    group.add(mesh);
    meshes.push(mesh);
  };

  const outageBands = outageZones.flatMap(zoneBands);
  addMesh(alwaysLive.flatMap(zoneBands), redMaterial, 'live-lines');
  addMesh(outageBands, redMaterial, 'outage-live-lines');
  addMesh(outageBands.map((band) => band.clone()), yellowMaterial, 'outage-idle-lines');

  const outageLiveMesh = group.getObjectByName('outage-live-lines') as THREE.Mesh | undefined;
  const outageIdleMesh = group.getObjectByName('outage-idle-lines') as THREE.Mesh | undefined;

  return {
    group,
    update(act, visible) {
      group.visible = visible;
      // 1# 主变 liveActs 为空：任何一幕都不显示红线段，只显示黄色检修边界。
      const hasOutageLive = outageZones.some((zone) =>
        zone.liveActs.includes(act)
      );
      if (outageLiveMesh) outageLiveMesh.visible = visible && hasOutageLive;
      if (outageIdleMesh) outageIdleMesh.visible = visible && !hasOutageLive;
    },
    dispose() {
      for (const mesh of meshes) mesh.geometry.dispose();
      redMaterial.dispose();
      yellowMaterial.dispose();
      redTexture.dispose();
      yellowTexture.dispose();
      group.removeFromParent();
    },
  };
}
