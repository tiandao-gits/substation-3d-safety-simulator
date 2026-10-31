import * as THREE from 'three';
import type { RenderDetailMode } from './rules';
import { APARTMENT_DOOR } from './apartmentDoor';

export interface ApartmentDoorView {
  group: THREE.Group;
  setOpen: (open: boolean) => void;
  update: (dt: number) => void;
  setDetailMode: (mode: RenderDetailMode) => void;
  dispose: () => void;
}

function findDoorLeaf(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (!found && child.name === 'HV_DOOR_LEAF_N') found = child;
  });
  return found;
}

/**
 * 原始贴图在西门洞背光下接近黑色。保留法线与粗糙度贴图，只替换基色，
 * 让“蓝色大门”在游戏里可被识别，同时不改变门扇造型。
 */
function makeBlueDoorMaterial(material: THREE.Material): THREE.Material {
  if (!material.name.includes('DOOR_BLUE')) return material;
  const source = material as THREE.MeshStandardMaterial;
  const blue = source.clone();
  blue.name = `${source.name}_GAME_BLUE`;
  blue.map = null;
  blue.color.setHex(0x3b7fae);
  blue.metalness = 0.32;
  blue.roughness = 0.5;
  blue.emissive.setHex(0x236387);
  blue.emissiveIntensity = 1.15;
  blue.needsUpdate = true;
  return blue;
}

function repaintBlueDoor(leaf: THREE.Object3D): void {
  leaf.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(makeBlueDoorMaterial);
    } else {
      mesh.material = makeBlueDoorMaterial(mesh.material);
    }
  });
}

function createSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 10kV 配电室门牌纹理');
  ctx.fillStyle = '#0b2a4a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 86px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('10kV 配电室', canvas.width / 2, 102);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 38px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.fillText('高压危险 · 闲人免进', canvas.width / 2, 190);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 将 GLB 自带的蓝色门扇重新挂到门轴下，实现可动画开启。
 * 原门扇顶点在模型空间内已烘焙到世界坐标，直接旋转节点会绕远处原点甩飞，
 * 因此必须用 `attach` 保留世界变换后，再旋转门轴组。
 */
export function createApartmentDoorView(
  detailedApartment: THREE.Object3D,
  blockoutApartment: THREE.Object3D,
  clayMaterial: THREE.Material,
  enableShadows: boolean
): ApartmentDoorView {
  const group = new THREE.Group();
  group.name = 'APARTMENT_10KV_ENTRANCE';

  const detailedLeaf = findDoorLeaf(detailedApartment);
  const blockoutLeaf = findDoorLeaf(blockoutApartment);
  if (!detailedLeaf) {
    throw new Error('GLB 中未找到蓝色大门节点 HV_DOOR_LEAF_N');
  }

  group.updateMatrixWorld(true);

  const detailedPivot = new THREE.Group();
  detailedPivot.name = 'HV_DOOR_PIVOT_DETAILED';
  detailedPivot.position.set(
    APARTMENT_DOOR.hingeX,
    0,
    APARTMENT_DOOR.hingeZ
  );
  group.add(detailedPivot);
  detailedPivot.updateMatrixWorld(true);
  detailedLeaf.updateWorldMatrix(true, true);
  detailedPivot.attach(detailedLeaf);
  repaintBlueDoor(detailedLeaf);

  let blockoutPivot: THREE.Group | null = null;
  if (blockoutLeaf) {
    blockoutPivot = new THREE.Group();
    blockoutPivot.name = 'HV_DOOR_PIVOT_BLOCKOUT';
    blockoutPivot.position.copy(detailedPivot.position);
    group.add(blockoutPivot);
    blockoutPivot.updateMatrixWorld(true);
    blockoutLeaf.updateWorldMatrix(true, true);
    blockoutPivot.attach(blockoutLeaf);
    blockoutLeaf.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = clayMaterial;
      }
    });
  }

  const signTexture = createSignTexture();
  const signMaterial = new THREE.MeshBasicMaterial({
    map: signTexture,
    transparent: true,
    toneMapped: false,
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.22),
    signMaterial
  );
  sign.name = 'HV_DOOR_SIGN_10KV';
  sign.position.set(
    -0.16,
    2.43,
    APARTMENT_DOOR.centerZ - APARTMENT_DOOR.hingeZ
  );
  sign.rotation.y = -Math.PI / 2;
  detailedPivot.add(sign);

  // 室内无天光直射，补两盏冷白灯让已建好的柜列与屏柜可读。
  const interiorLights = [
    { x: 32.8, z: -22.6 },
    { x: 35.8, z: -22.6 },
  ].map(({ x, z }, index) => {
    const light = new THREE.PointLight(0xdcecff, 9, 8.5, 2);
    light.name = `HV_ROOM_LIGHT_${index + 1}`;
    light.position.set(x, 2.45, z);
    group.add(light);
    return light;
  });

  let targetOpen = false;
  let openAmount = 0;

  const applyMode = (mode: RenderDetailMode) => {
    detailedPivot.visible = mode === 'detailed';
    if (blockoutPivot) blockoutPivot.visible = mode === 'blockout';
  };
  applyMode('detailed');

  return {
    group,
    setOpen(open: boolean) {
      targetOpen = open;
    },
    update(dt: number) {
      const target = targetOpen ? 1 : 0;
      openAmount = THREE.MathUtils.damp(openAmount, target, 5.2, dt);
      if (Math.abs(openAmount - target) < 0.001) openAmount = target;
      const angle = APARTMENT_DOOR.openAngle * openAmount;
      detailedPivot.rotation.y = angle;
      if (blockoutPivot) blockoutPivot.rotation.y = angle;
    },
    setDetailMode(mode: RenderDetailMode) {
      applyMode(mode);
      for (const light of interiorLights) light.visible = true;
    },
    dispose() {
      sign.geometry.dispose();
      signMaterial.dispose();
      signTexture.dispose();
      if (enableShadows) {
        for (const light of interiorLights) light.dispose();
      }
    },
  };
}
