import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { SubstationTextures } from './textures';
import { SUBSTATION_OBSTACLES, siteGroundHeight, type RenderDetailMode } from './rules';
import { MESSAGES } from '../config/gameText';
import {
  createApartmentDoorView,
  type ApartmentDoorView,
} from './apartmentDoorView';

/** 由 `scripts/split-glb.ts` 生成的 GLB 分片清单。 */
interface GlbPartsManifest {
  source: string;
  totalBytes: number;
  partBytes: number;
  partCount: number;
  parts: string[];
}

const GLB_PARTS_MANIFEST_SUFFIX = '.parts.json';

/**
 * 按清单并行拉取 GLB 分片，拼回与单文件字节完全一致的 ArrayBuffer。
 *
 * 分片只是传输层的切分（绕过单文件体积限制），不做任何重编码，
 * 因此拼回后的数据与原始模型逐字节相同，画质不受影响。
 *
 * 不做任何降级回退：清单缺失、任一分支 404、总长度对不上都会直接抛错。
 */
async function fetchGlbParts(
  assetBaseUrl: string,
  fileName: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<ArrayBuffer> {
  const manifestUrl = `${assetBaseUrl}${fileName}${GLB_PARTS_MANIFEST_SUFFIX}`;
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`GLB 分片清单读不到（HTTP ${manifestResponse.status}）：${manifestUrl}`);
  }
  const manifest = (await manifestResponse.json()) as GlbPartsManifest;
  if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error(`GLB 分片清单格式不对：${manifestUrl}`);
  }

  const totalBytes = manifest.totalBytes;
  let loadedBytes = 0;
  // 进度回调按 1% 节流，避免每个网络分块都触发一次 React 重渲染。
  const progressStep = Math.max(1, Math.floor(totalBytes / 100));
  let nextReport = progressStep;

  const partBuffers = await Promise.all(
    manifest.parts.map(async (partName) => {
      const partUrl = `${assetBaseUrl}${partName}`;
      const response = await fetch(partUrl);
      if (!response.ok) {
        throw new Error(`GLB 分片读取失败（HTTP ${response.status}）：${partUrl}`);
      }
      if (!response.body) {
        const whole = await response.arrayBuffer();
        loadedBytes += whole.byteLength;
        onProgress?.(loadedBytes, totalBytes);
        return whole;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        chunks.push(value);
        loadedBytes += value.byteLength;
        if (loadedBytes >= nextReport) {
          nextReport = loadedBytes + progressStep;
          onProgress?.(loadedBytes, totalBytes);
        }
      }
      let size = 0;
      for (const chunk of chunks) size += chunk.byteLength;
      const merged = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return merged.buffer;
    })
  );

  const assembled = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const buffer of partBuffers) {
    if (cursor + buffer.byteLength > totalBytes) {
      throw new Error(
        `GLB 分片总长度超出清单声明（${cursor + buffer.byteLength} > ${totalBytes}）`
      );
    }
    assembled.set(new Uint8Array(buffer), cursor);
    cursor += buffer.byteLength;
  }
  if (cursor !== totalBytes) {
    throw new Error(`GLB 分片总长度与清单不符（${cursor} != ${totalBytes}）`);
  }
  onProgress?.(totalBytes, totalBytes);
  return assembled.buffer;
}

export interface CloneSceneNodeOptions {
  x: number;
  z: number;
  /** 默认取站点地面高度。 */
  y?: number;
  rotationY?: number;
  scale?: number | { x: number; y: number; z: number };
  name?: string;
}

export interface SubstationSceneHandles {
  root: THREE.Group;
  detailedGroup: THREE.Group;
  blockoutGroup: THREE.Group;
  customPropsGroup: THREE.Group;
  setRenderDetailMode: (mode: RenderDetailMode) => void;
  setApartmentDoorOpen: (open: boolean) => void;
  updateApartmentDoor: (dt: number) => void;
  loadBlenderPropAsset: (file: File, targetPos: { x: number; z: number }) => Promise<string>;
  /**
   * 从已加载的变电站 GLB 复制一个节点，按目标位置/旋转/缩放重新放置。
   * 用于把施工区的真实木料堆模型复用到第一幕通道占道检查点。
   */
  cloneSceneNode: (
    nodeName: string,
    options: CloneSceneNodeOptions
  ) => THREE.Object3D | null;
}

export interface SceneLoadCallbacks {
  onProgress?: (loadedBytes: number, totalBytes: number) => void;
  onLoaded?: () => void;
  onError?: (message: string) => void;
}

export function buildSubstationEnvironment(
  scene: THREE.Scene,
  textures: SubstationTextures,
  enableShadows: boolean,
  loadCallbacks?: SceneLoadCallbacks,
  /**
   * 贴图各向异性过滤等级。道路、场坪这类大面积水平面在玩家视角下被极度斜视，
   * anisotropy=1 时远处 mipmap 采样不足，走动中会持续出现纹理摩尔纹（抖动闪动），
   * 走近后角度变垂直才恢复正常。用渲染器上限封顶到 8 兼顾画质与采样开销。
   */
  maxAnisotropy = 8
): SubstationSceneHandles {
  const root = new THREE.Group();
  root.name = 'Substation220kVWorld';
  scene.add(root);

  const detailedGroup = new THREE.Group();
  detailedGroup.name = 'BlenderSubstationOriginalMaterials';
  detailedGroup.visible = true;
  root.add(detailedGroup);

  const blockoutGroup = new THREE.Group();
  blockoutGroup.name = 'BlenderSubstationClayLayout';
  blockoutGroup.visible = false;
  root.add(blockoutGroup);

  const customPropsGroup = new THREE.Group();
  customPropsGroup.name = 'ImportedBlenderProps';
  root.add(customPropsGroup);

  const clayMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7cdd2,
    roughness: 0.86,
    metalness: 0.04,
  });
  let currentDetailMode: RenderDetailMode = 'detailed';
  let apartmentDoorView: ApartmentDoorView | null = null;
  let apartmentDoorOpenRequested = false;
  let loadedOriginal: THREE.Object3D | null = null;
  // 墙外地形：外围地面 + 远景山脊 + 场外道路，消除「悬浮半空」感
  const externalTerrain = buildExternalTerrain();
  root.add(externalTerrain.group);

  const glbFileName = 'substation_blockout.glb';
  const assetBaseUrl = import.meta.env.BASE_URL;
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(`${assetBaseUrl}draco/`);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const handleGltfLoaded = (gltf: GLTF) => {
    const original = gltf.scene;
    original.name = 'BlenderSubstationOriginalLayout';
    loadedOriginal = original;
    // glTF cannot carry Blender's procedural/base-color node graphs: several
    // site materials ship as untinted default white. Restore their intended
    // tones. Grass uses embedded PBR maps and deliberately has no flat-color fallback.
    const materialTints: Record<string, number> = {
      'MAT_STEEL.001': 0x8d959d,
      'MAT_DARK_STEEL.001': 0x2b3037,
      'MAT_PORCELAIN_BROWN': 0x7c4a33,
      'MAT_INSULATOR.001': 0x8f867c,
      'MAT_WHITE.001': 0xd6d8d2,
    };
    original.traverse((child) => {
      if (child instanceof THREE.Camera || child instanceof THREE.Light) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Far-field scenery: alpha cards would cast solid-quad shadows in the shadow map.
        const scenery = mesh.name.startsWith('EXT_CONIFER');
        mesh.castShadow = enableShadows && !scenery;
        mesh.receiveShadow = enableShadows && !scenery;
        // 路面标线与沥青路面几乎共面（中心虚线只高出 5mm，危险区红线只高出 2cm），
        // 远处深度缓冲精度不足会让两者交替赢得深度测试，表现为路面标记闪烁抖动。
        // 给标线单独 clone 一份材质并加 polygonOffset，让它们稳定压在路面上。
        if (mesh.name === 'Road_CenterDashes' || mesh.name === 'BAY_DANGER_LINE_220KV') {
          const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const decals = source.map((entry) => {
            const decal = entry.clone();
            decal.polygonOffset = true;
            decal.polygonOffsetFactor = -2;
            decal.polygonOffsetUnits = -4;
            decal.needsUpdate = true;
            return decal;
          });
          mesh.material = Array.isArray(mesh.material) ? decals : decals[0];
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const standard = material as THREE.MeshStandardMaterial;
          // 统一提升各向异性过滤等级。GLB 默认全部是 anisotropy=1，道路/场坪这类
          // 大面积水平面在玩家低视角下被极度斜视，mipmap 采样不足会持续抖动闪烁，
          // 只有走近（视角变垂直）才看起来正常。
          if (standard) {
            for (const tex of [
              standard.map,
              standard.normalMap,
              standard.roughnessMap,
              standard.metalnessMap,
              standard.aoMap,
              standard.emissiveMap,
            ]) {
              if (!tex || tex.anisotropy === maxAnisotropy) continue;
              tex.anisotropy = maxAnisotropy;
              tex.needsUpdate = true;
            }
          }
          // Blender 5.2 cannot export alphaMode MASK, so the leaf cards arrive alpha-blended.
          if (standard?.name === 'MAT_CONIFER_LEAVES') {
            standard.transparent = false;
            standard.alphaTest = 0.3;
            standard.depthWrite = true;
            standard.needsUpdate = true;
          }
          if (standard?.name === 'MAT_GRASS') {
            mesh.castShadow = false;
            standard.metalness = 0;
            standard.roughness = 1;
            if (standard.normalMap) standard.normalScale.set(0.75, 0.75);
            for (const map of [standard.map, standard.normalMap, standard.roughnessMap]) {
              if (!map) continue;
              map.wrapS = THREE.RepeatWrapping;
              map.wrapT = THREE.RepeatWrapping;
            }
            standard.needsUpdate = true;
          }
          const tint = standard?.name ? materialTints[standard.name] : undefined;
          if (tint !== undefined && !standard.map) {
            standard.color.setHex(tint);
            standard.needsUpdate = true;
          }
        }
      }
    });

    const clay = original.clone(true);
    clay.name = 'BlenderSubstationWhiteLayout';
    clay.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = clayMaterial;
      }
    });

    detailedGroup.add(original);
    blockoutGroup.add(clay);
    try {
      root.updateMatrixWorld(true);
      apartmentDoorView = createApartmentDoorView(
        original,
        clay,
        clayMaterial,
        enableShadows
      );
      apartmentDoorView.setDetailMode(currentDetailMode);
      apartmentDoorView.setOpen(apartmentDoorOpenRequested);
      root.add(apartmentDoorView.group);
    } catch (error) {
      console.error('[ApartmentDoor] 蓝门交互初始化失败:', error);
      apartmentDoorView = null;
    }
    loadCallbacks?.onLoaded?.();
  };

  const handleLoadFailed = (error: unknown) => {
    console.error(MESSAGES.substationSceneLoadFailed, error);
    loadCallbacks?.onError?.(
      error instanceof Error ? error.message : MESSAGES.substationSceneLoadError
    );
  };

  // 先按清单把 .part0/.part1 拉下来拼回完整 GLB，再交给 GLTFLoader 解析。
  // 不做单文件回退：清单或任一分片缺失都会直接走 onError。
  void fetchGlbParts(assetBaseUrl, glbFileName, (loaded, total) => {
    loadCallbacks?.onProgress?.(loaded, total);
  })
    .then((glbBuffer) => {
      gltfLoader.parse(glbBuffer, '', handleGltfLoaded, handleLoadFailed);
    })
    .catch(handleLoadFailed);

  // V6.2: the old violation diorama and holographic checkpoint boxes are retired.
  // Act 1 markers/clues are built in `src/game/storyProps.ts`.

  return {
    root,
    detailedGroup,
    blockoutGroup,
    customPropsGroup,
    setRenderDetailMode(mode: RenderDetailMode) {
      currentDetailMode = mode;
      detailedGroup.visible = mode === 'detailed';
      blockoutGroup.visible = mode === 'blockout';
      apartmentDoorView?.setDetailMode(mode);
      externalTerrain.setMode(mode);
    },
    setApartmentDoorOpen(open: boolean) {
      apartmentDoorOpenRequested = open;
      apartmentDoorView?.setOpen(open);
    },
    updateApartmentDoor(dt: number) {
      apartmentDoorView?.update(dt);
    },
    cloneSceneNode(nodeName: string, options: CloneSceneNodeOptions) {
      if (!loadedOriginal) return null;
      const source = loadedOriginal.getObjectByName(nodeName);
      if (!source) return null;

      source.updateWorldMatrix(true, false);
      const clone = source.clone(true);
      // 先归零局部矩阵，再把源节点的世界矩阵套上去，克隆体就落在原始位置。
      clone.position.set(0, 0, 0);
      clone.quaternion.identity();
      clone.scale.set(1, 1, 1);
      clone.applyMatrix4(source.matrixWorld);
      clone.updateMatrixWorld(true);

      // 以几何包围盒中心对齐目标点，底部贴地。
      const box = new THREE.Box3().setFromObject(clone);
      const center = box.getCenter(new THREE.Vector3());
      const centering = new THREE.Group();
      centering.position.set(-center.x, -box.min.y, -center.z);
      centering.add(clone);

      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = enableShadows;
          child.receiveShadow = enableShadows;
        }
      });

      const holder = new THREE.Group();
      holder.name = options.name ?? `cloned-${nodeName}`;
      holder.position.set(
        options.x,
        options.y ?? siteGroundHeight(options.x, options.z),
        options.z
      );
      holder.rotation.y = options.rotationY ?? 0;
      const scale = options.scale ?? 1;
      if (typeof scale === 'number') holder.scale.setScalar(scale);
      else holder.scale.set(scale.x, scale.y, scale.z);
      holder.add(centering);
      customPropsGroup.add(holder);
      return holder;
    },
    async loadBlenderPropAsset(file: File, targetPos: { x: number; z: number }): Promise<string> {
      const url = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      try {
        let model: THREE.Object3D;
        if (ext === 'fbx') {
          const loader = new FBXLoader();
          model = await loader.loadAsync(url);
        } else {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(url);
          model = gltf.scene;
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 8 || maxDim < 0.4) {
          const scale = 2.8 / Math.max(0.01, maxDim);
          model.scale.multiplyScalar(scale);
        }
        const finalBox = new THREE.Box3().setFromObject(model);
        model.position.set(targetPos.x, -finalBox.min.y + 0.02, targetPos.z);

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = enableShadows;
            child.receiveShadow = enableShadows;
          }
        });

        customPropsGroup.add(model);
        return MESSAGES.propMounted(
          targetPos.x.toFixed(1),
          targetPos.z.toFixed(1),
          file.name
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  };
}

/**
 * 构建无人机航拍取证用的主变检修区违章作业场景。
 * An external contractor worker WITHOUT a safety helmet placing a forbidden metal ladder near live equipment.
 */
function buildSafetyViolationScene(x: number, z: number, enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SafetyViolationScene_UAVTarget';
  group.position.set(x, 0, z);

  // 靠近带电设备的违规金属梯。
  const ladderGroup = new THREE.Group();
  ladderGroup.position.set(-1.1, 0, 0.4);
  ladderGroup.rotation.z = -0.26;
  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.88,
  });
  for (const lz of [-0.26, 0.26]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.4, 0.06), aluminumMat);
    rail.position.set(0, 1.7, lz);
    rail.castShadow = enableShadows;
    ladderGroup.add(rail);
  }
  for (let r = 0; r < 8; r++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), aluminumMat);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(0, 0.35 + r * 0.38, 0);
    ladderGroup.add(rung);
  }
  group.add(ladderGroup);

  // 2. Unauthorized Worker Figure (Wearing red-orange jacket, NO safety helmet - bare dark hair)
  const worker = new THREE.Group();
  worker.position.set(0.2, 0, -0.2);
  worker.rotation.y = -0.7;

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48,
    roughness: 0.6,
    metalness: 0.1,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe6b89c,
    roughness: 0.6,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
  });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.85, 0.22), pantsMat);
  legs.position.y = 0.425;
  legs.castShadow = enableShadows;
  worker.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.26), jacketMat);
  torso.position.y = 1.12;
  torso.castShadow = enableShadows;
  worker.add(torso);

  // Raised arm pointing/working near live bay without PPE
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.14), jacketMat);
  rightArm.position.set(0.28, 1.32, -0.12);
  rightArm.rotation.x = -0.85;
  worker.add(rightArm);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), skinMat);
  head.position.y = 1.56;
  worker.add(head);

  // Bare hair (NO yellow safety helmet!)
  const bareHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  bareHair.position.y = 1.58;
  worker.add(bareHair);

  group.add(worker);

  // 3. Toppled Safety Cone & Red Ground Warning Ring so it's unmistakable from the drone aerial camera
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 12), coneMat);
  cone.position.set(0.95, 0.32, 0.75);
  group.add(cone);

  const ringGeo = new THREE.RingGeometry(1.55, 1.85, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.035;
  group.add(ringMesh);

  return group;
}

/**
 * Builds the 3-phase 220kV Surge Arrester H-02 (220kV 避雷器 H-02) on a galvanized steel gantry stand
 * with control cabinet and porcelain insulator columns, matching the equipment inside the glowing orange box!
 */
function build220kVArresterBay(x: number, z: number, enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.42,
    metalness: 0.72,
  });
  const porcelainMat = new THREE.MeshStandardMaterial({
    color: 0x6b341e,
    roughness: 0.18,
    metalness: 0.25,
  });
  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.35,
    metalness: 0.65,
  });

  // 2 Vertical Support Legs + Horizontal Steel Table Beam
  for (const dz of [-1.1, 1.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.18), steelMat);
    leg.position.set(0, 1.05, dz);
    leg.castShadow = enableShadows;
    group.add(leg);
  }
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 2.7), steelMat);
  crossBeam.position.set(0, 2.1, 0);
  crossBeam.castShadow = enableShadows;
  group.add(crossBeam);

  // Online Monitoring & Grounding Control Box mounted on leg
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.52), cabinetMat);
  box.position.set(-0.22, 1.25, 0);
  box.castShadow = enableShadows;
  group.add(box);

  // 3-Phase Ribbed Porcelain Surge Arrester Columns (A / B / C Phases)
  for (const pz of [-1.05, 0, 1.05]) {
    const colGroup = new THREE.Group();
    colGroup.position.set(0, 2.18, pz);
    for (let s = 0; s < 10; s++) {
      const shed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.14, 14),
        porcelainMat
      );
      shed.position.y = s * 0.17 + 0.08;
      shed.castShadow = enableShadows;
      colGroup.add(shed);
    }
    // Grading ring at top of arrester
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 8, 20), steelMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.68;
    colGroup.add(ring);
    group.add(colGroup);
  }

  return group;
}

function buildTerrainAndRoadNetwork(
  root: THREE.Group,
  textures: SubstationTextures,
  enableShadows: boolean
) {
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'TerrainAndRoadNetwork';

  const outerGeo = new THREE.PlaneGeometry(2000, 2000, 1, 1);
  outerGeo.rotateX(-Math.PI / 2);
  const outerTerrainMat = new THREE.MeshStandardMaterial({
    color: 0x5f6f56,
    roughness: 0.95,
    metalness: 0.01,
    fog: true,
  });
  const outerTerrain = new THREE.Mesh(outerGeo, outerTerrainMat);
  outerTerrain.position.y = -0.05;
  outerTerrain.receiveShadow = enableShadows;
  terrainGroup.add(outerTerrain);

  // Substation Crushed Gravel Ground Bed (y = 0.0)
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.gravelAlbedo,
    bumpMap: textures.gravelBump,
    bumpScale: 0.08,
    roughness: 0.88,
    metalness: 0.05,
  });
  const gravelBed = new THREE.Mesh(new THREE.PlaneGeometry(86, 108), gravelMat);
  gravelBed.rotation.x = -Math.PI / 2;
  gravelBed.position.y = 0.0;
  gravelBed.receiveShadow = enableShadows;
  terrainGroup.add(gravelBed);

  // Main Central Concrete Inspection Road
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.roadAlbedo,
    bumpMap: textures.roadBump,
    bumpScale: 0.03,
    roughness: 0.72,
    metalness: 0.05,
  });
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.06, 84), roadMat);
  mainRoad.position.set(0, 0.03, 10);
  mainRoad.receiveShadow = enableShadows;
  terrainGroup.add(mainRoad);

  // Cable Trench Drainage Grating alongside East side of road (matching reference image!)
  const trenchMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.75,
  });
  const cableTrench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 48), trenchMat);
  cableTrench.position.set(4.1, 0.022, 12);
  terrainGroup.add(cableTrench);

  // Raised Concrete Road Curbs
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.78,
    metalness: 0.05,
  });
  const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 84), curbMat);
  leftCurb.position.set(-3.32, 0.07, 10);
  leftCurb.castShadow = enableShadows;
  leftCurb.receiveShadow = enableShadows;

  const rightCurb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 84), curbMat);
  rightCurb.position.set(3.32, 0.07, 10);
  rightCurb.castShadow = enableShadows;
  rightCurb.receiveShadow = enableShadows;
  terrainGroup.add(leftCurb, rightCurb);

  // Cross-road walkway & Plazas
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0xbec3c7,
    roughness: 0.75,
    metalness: 0.05,
  });
  const crossRoad = new THREE.Mesh(new THREE.BoxGeometry(56, 0.05, 4.8), plazaMat);
  crossRoad.position.set(0, 0.025, 0);
  crossRoad.receiveShadow = enableShadows;

  const northPlaza = new THREE.Mesh(new THREE.BoxGeometry(44, 0.05, 8.0), plazaMat);
  northPlaza.position.set(0, 0.025, -28.0);
  northPlaza.receiveShadow = enableShadows;

  const southPlaza = new THREE.Mesh(new THREE.BoxGeometry(36, 0.05, 10.0), plazaMat);
  southPlaza.position.set(0, 0.025, 44.0);
  southPlaza.receiveShadow = enableShadows;

  terrainGroup.add(crossRoad, northPlaza, southPlaza);
  root.add(terrainGroup);
}

function buildEnclosedPerimeter(
  root: THREE.Group,
  textures: SubstationTextures,
  enableShadows: boolean
) {
  const perimeter = new THREE.Group();
  perimeter.name = 'EnclosedSubstationPerimeter';

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.wallAlbedo,
    roughness: 0.8,
    metalness: 0.08,
  });
  const copingMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.4,
  });

  const wallSpecs = [
    { x: 0, z: -53, w: 84.6, d: 0.6 },
    { x: 0, z: 53, w: 84.6, d: 0.6 },
    { x: -42, z: 0, w: 0.6, d: 106.6 },
    { x: 42, z: 0, w: 0.6, d: 106.6 },
  ];

  for (const spec of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 3.2, spec.d), wallMat);
    wall.position.set(spec.x, 1.6, spec.z);
    wall.castShadow = enableShadows;
    wall.receiveShadow = enableShadows;
    perimeter.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.1, 0.16, spec.d + 0.1), copingMat);
    cap.position.set(spec.x, 3.28, spec.z);
    perimeter.add(cap);
  }

  const guardGroup = new THREE.Group();
  guardGroup.position.set(-11.5, 0, 46.5);
  const guardBody = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 3.6, 6.2),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65, metalness: 0.1 })
  );
  guardBody.position.y = 1.8;
  guardBody.castShadow = enableShadows;
  guardBody.receiveShadow = enableShadows;
  guardGroup.add(guardBody);

  const guardRoof = new THREE.Mesh(
    new THREE.BoxGeometry(9.1, 0.45, 6.8),
    new THREE.MeshStandardMaterial({ color: 0x2b5b84, roughness: 0.4, metalness: 0.3 })
  );
  guardRoof.position.y = 3.82;
  guardGroup.add(guardRoof);

  perimeter.add(guardGroup);
  root.add(perimeter);
}

function buildMainTransformer(
  name: string,
  x: number,
  z: number,
  facingSign: 1 | -1,
  textures: SubstationTextures,
  enableShadows: boolean
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, 0, z);

  const tankSteelMat = new THREE.MeshStandardMaterial({
    color: 0x5c6662,
    roughness: 0.52,
    metalness: 0.62,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0x6f7975,
    roughness: 0.45,
    metalness: 0.68,
  });
  const conservatorMat = new THREE.MeshStandardMaterial({
    color: 0x7c8682,
    roughness: 0.38,
    metalness: 0.72,
  });
  const porcelainBrownMat = new THREE.MeshStandardMaterial({
    color: 0x6b341e,
    roughness: 0.16,
    metalness: 0.25,
  });
  const aluminumFittingMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.88,
  });
  const padYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd9a406,
    roughness: 0.7,
    metalness: 0.1,
  });
  const padConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.8,
    metalness: 0.05,
  });

  const yellowBorder = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.22, 10.6), padYellowMat);
  yellowBorder.position.y = 0.11;
  yellowBorder.receiveShadow = enableShadows;
  group.add(yellowBorder);

  const innerPad = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.32, 10.0), padConcreteMat);
  innerPad.position.y = 0.16;
  innerPad.receiveShadow = enableShadows;
  group.add(innerPad);

  const mainTank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.8, 6.8), tankSteelMat);
  mainTank.position.set(0, 2.2, 0);
  mainTank.castShadow = enableShadows;
  mainTank.receiveShadow = enableShadows;
  group.add(mainTank);

  const topFlange = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.18, 7.1), tankSteelMat);
  topFlange.position.set(0, 4.15, 0);
  topFlange.castShadow = enableShadows;
  group.add(topFlange);

  const finBankPositions = [
    { bx: facingSign * 2.55, bz: -2.1 },
    { bx: facingSign * 2.55, bz: 0.0 },
    { bx: facingSign * 2.55, bz: 2.1 },
    { bx: -facingSign * 2.55, bz: -2.1 },
    { bx: -facingSign * 2.55, bz: 0.0 },
    { bx: -facingSign * 2.55, bz: 2.1 },
  ];

  for (const pos of finBankPositions) {
    const bank = new THREE.Group();
    bank.position.set(pos.bx, 2.35, pos.bz);

    const bankCore = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.75, 1.55), tankSteelMat);
    bankCore.castShadow = enableShadows;
    bankCore.receiveShadow = enableShadows;
    bank.add(bankCore);

    for (let f = -6; f <= 6; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.65, 0.045), radiatorMat);
      fin.position.z = f * 0.115;
      fin.castShadow = enableShadows;
      bank.add(fin);
    }
    group.add(bank);
  }

  for (const endZ of [-3.75, 3.75]) {
    for (const endX of [-1.15, 1.15]) {
      const frontBank = new THREE.Group();
      frontBank.position.set(endX, 2.35, endZ);
      const core = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.75, 0.85), tankSteelMat);
      core.castShadow = enableShadows;
      frontBank.add(core);
      for (let f = -6; f <= 6; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.65, 1.05), radiatorMat);
        fin.position.x = f * 0.12;
        fin.castShadow = enableShadows;
        frontBank.add(fin);
      }
      group.add(frontBank);
    }
  }

  const conservatorGroup = new THREE.Group();
  conservatorGroup.position.set(facingSign * 1.45, 5.35, 0.8);

  const conservatorCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.78, 4.6, 24),
    conservatorMat
  );
  conservatorCylinder.rotation.x = Math.PI / 2;
  conservatorCylinder.castShadow = enableShadows;
  conservatorGroup.add(conservatorCylinder);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.conservatorCap,
    roughness: 0.35,
    metalness: 0.4,
  });
  const frontCap = new THREE.Mesh(new THREE.CircleGeometry(0.77, 24), capMat);
  frontCap.position.set(0, 0, 2.31);
  conservatorGroup.add(frontCap);

  for (const sz of [-1.4, 1.4]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 0.18), tankSteelMat);
    strut.position.set(0, -0.8, sz);
    conservatorGroup.add(strut);
  }
  group.add(conservatorGroup);

  const bushingPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.22, 0.0),
    new THREE.Vector2(0.22, 0.3),
  ];
  for (let s = 0; s < 12; s++) {
    const yBase = 0.3 + s * 0.19;
    bushingPoints.push(new THREE.Vector2(0.14, yBase));
    bushingPoints.push(new THREE.Vector2(0.27 - s * 0.004, yBase + 0.08));
    bushingPoints.push(new THREE.Vector2(0.13, yBase + 0.15));
  }
  bushingPoints.push(new THREE.Vector2(0.09, 2.75));
  bushingPoints.push(new THREE.Vector2(0.0, 2.75));

  const bushingGeo = new THREE.LatheGeometry(bushingPoints, 18);

  for (const bz of [-2.0, 0.0, 2.0]) {
    const bushingAssembly = new THREE.Group();
    bushingAssembly.position.set(-facingSign * 0.4, 4.15, bz);
    bushingAssembly.rotation.z = -facingSign * 0.14;

    const turretBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 0.65, 16),
      tankSteelMat
    );
    turretBase.position.y = 0.3;
    bushingAssembly.add(turretBase);

    const insulator = new THREE.Mesh(bushingGeo, porcelainBrownMat);
    insulator.position.y = 0.55;
    insulator.castShadow = enableShadows;
    bushingAssembly.add(insulator);

    const topTerminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, 0.55, 12),
      aluminumFittingMat
    );
    topTerminal.position.y = 3.55;
    bushingAssembly.add(topTerminal);

    group.add(bushingAssembly);

    const secBushing = bushingAssembly.clone();
    secBushing.scale.set(0.72, 0.72, 0.72);
    secBushing.position.set(facingSign * 0.45, 4.15, bz - 0.6);
    secBushing.rotation.z = facingSign * 0.1;
    group.add(secBushing);
  }

  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.35, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.75 })
  );
  cabinet.position.set(facingSign * 2.85, 1.8, 3.0);
  cabinet.castShadow = enableShadows;
  group.add(cabinet);

  return group;
}

function buildTransformerFenceEnclosure(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  roadSide: 'east' | 'west',
  textures: SubstationTextures,
  enableShadows: boolean
): THREE.Group {
  const group = new THREE.Group();
  const fenceHeight = 2.15;

  const steelFenceMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.42,
    metalness: 0.78,
  });

  const signNoClimbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.signNoClimb,
    roughness: 0.35,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  const signHighVoltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.signHighVoltage,
    roughness: 0.35,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  const addFenceWall = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    withSigns: boolean,
    normalX: number,
    normalZ: number
  ) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const panelCount = Math.max(1, Math.round(length / 2.5));
    const dx = (x2 - x1) / panelCount;
    const dz = (z2 - z1) / panelCount;
    const angle = Math.atan2(x2 - x1, z2 - z1);

    for (let i = 0; i <= panelCount; i++) {
      const px = x1 + dx * i;
      const pz = z1 + dz * i;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, fenceHeight + 0.1, 0.08),
        steelFenceMat
      );
      post.position.set(px, (fenceHeight + 0.1) / 2, pz);
      post.castShadow = enableShadows;
      group.add(post);

      if (i < panelCount) {
        const cx = px + dx * 0.5;
        const cz = pz + dz * 0.5;
        const panelLen = Math.hypot(dx, dz);

        const panelGroup = new THREE.Group();
        panelGroup.position.set(cx, 0, cz);
        panelGroup.rotation.y = angle;

        const topRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.045, panelLen),
          steelFenceMat
        );
        topRail.position.y = fenceHeight - 0.12;
        const bottomRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.045, panelLen),
          steelFenceMat
        );
        bottomRail.position.y = 0.22;
        panelGroup.add(topRail, bottomRail);

        const picketCount = Math.floor(panelLen / 0.18);
        for (let p = 1; p < picketCount; p++) {
          const picket = new THREE.Mesh(
            new THREE.BoxGeometry(0.018, fenceHeight - 0.34, 0.018),
            steelFenceMat
          );
          picket.position.set(0, fenceHeight * 0.52, -panelLen / 2 + p * 0.18);
          panelGroup.add(picket);
        }

        group.add(panelGroup);

        if (withSigns && i % 2 === 1) {
          const isHighVolt = i === 1;
          const signMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.86, 0.64),
            isHighVolt ? signHighVoltMat : signNoClimbMat
          );
          signMesh.position.set(cx + normalX * 0.06, 1.32, cz + normalZ * 0.06);
          if (Math.abs(normalX) > 0.5) {
            signMesh.rotation.y = normalX > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            signMesh.rotation.y = normalZ > 0 ? 0 : Math.PI;
          }
          group.add(signMesh);
        }
      }
    }
  };

  addFenceWall(maxX, minZ, maxX, maxZ, roadSide === 'east', 1, 0);
  addFenceWall(minX, minZ, minX, maxZ, roadSide === 'west', -1, 0);
  addFenceWall(minX, maxZ, maxX, maxZ, true, 0, 1);
  addFenceWall(minX, minZ, maxX, minZ, false, 0, -1);

  return group;
}

function buildPortalGantry(zPos: number, enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, zPos);

  const galvanizedMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.45,
    metalness: 0.72,
  });
  const insulatorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.2,
    metalness: 0.5,
  });

  const colHeight = 13.5;
  const halfSpan = 5.6;

  for (const side of [-1, 1]) {
    const colX = side * halfSpan;
    const mainPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.34, colHeight, 14),
      galvanizedMat
    );
    mainPole.position.set(colX, colHeight / 2, 0);
    mainPole.castShadow = enableShadows;
    mainPole.receiveShadow = enableShadows;
    group.add(mainPole);

    const bracePole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, colHeight, 12),
      galvanizedMat
    );
    bracePole.position.set(colX, colHeight / 2, -0.85);
    bracePole.rotation.x = 0.05;
    group.add(bracePole);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 4.8, 10), galvanizedMat);
    spire.position.set(colX, colHeight + 2.4, 0);
    group.add(spire);
  }

  const beamWidth = halfSpan * 2 + 0.8;
  const topChord = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, 0.22, 0.65), galvanizedMat);
  topChord.position.set(0, 12.6, -0.35);
  topChord.castShadow = enableShadows;
  const bottomChord = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, 0.22, 0.65), galvanizedMat);
  bottomChord.position.set(0, 11.75, -0.35);
  bottomChord.castShadow = enableShadows;
  group.add(topChord, bottomChord);

  for (let bx = -halfSpan + 0.5; bx <= halfSpan - 0.5; bx += 0.9) {
    const vStrut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.6), galvanizedMat);
    vStrut.position.set(bx, 12.18, -0.35);
    const dStrut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.15, 0.08), galvanizedMat);
    dStrut.position.set(bx + 0.45, 12.18, -0.05);
    dStrut.rotation.z = 0.65;
    group.add(vStrut, dStrut);
  }

  for (const ix of [-3.2, 0.0, 3.2]) {
    const stringGroup = new THREE.Group();
    stringGroup.position.set(ix, 11.65, -0.35);
    for (let d = 0; d < 8; d++) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.12, 12),
        insulatorGlassMat
      );
      disc.position.y = -d * 0.22;
      stringGroup.add(disc);
    }
    group.add(stringGroup);
  }

  return group;
}

function buildOverheadPowerLines(): THREE.Group {
  const group = new THREE.Group();
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.5,
  });

  const addCatenaryWire = (p1: THREE.Vector3, p2: THREE.Vector3, sag = 1.3, radius = 0.032) => {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
    const geo = new THREE.TubeGeometry(curve, 20, radius, 6, false);
    const mesh = new THREE.Mesh(geo, wireMat);
    group.add(mesh);
  };

  for (const phaseX of [-3.2, 0.0, 3.2]) {
    addCatenaryWire(
      new THREE.Vector3(phaseX * 1.1, 13.5, 32),
      new THREE.Vector3(phaseX, 10.1, 13.65),
      1.2
    );
    addCatenaryWire(
      new THREE.Vector3(phaseX, 10.1, 13.65),
      new THREE.Vector3(phaseX, 10.1, -4.35),
      1.4
    );
    addCatenaryWire(
      new THREE.Vector3(phaseX, 10.1, -4.35),
      new THREE.Vector3(phaseX, 10.1, -25.35),
      1.35
    );

    // Droppers to Surge Arrester H-02 & Transformers
    addCatenaryWire(
      new THREE.Vector3(phaseX, 10.1, 13.65),
      new THREE.Vector3(3.8, 3.9, 16.5 + phaseX * 0.32),
      0.6
    );
    addCatenaryWire(
      new THREE.Vector3(phaseX, 10.1, -4.35),
      new THREE.Vector3(-9.2, 7.6, 12.0 + phaseX * 0.6),
      1.2
    );
    addCatenaryWire(
      new THREE.Vector3(phaseX, 10.1, -4.35),
      new THREE.Vector3(9.2, 7.6, 10.5 + phaseX * 0.6),
      1.2
    );
  }

  for (const offsetZ of [-2, 0, 2]) {
    addCatenaryWire(
      new THREE.Vector3(-9.2, 7.6, 12.0 + offsetZ),
      new THREE.Vector3(-34, 15.5, 8.0 + offsetZ * 1.5),
      1.5
    );
    addCatenaryWire(
      new THREE.Vector3(9.2, 7.6, 10.5 + offsetZ),
      new THREE.Vector3(34, 15.5, 10.0 + offsetZ * 1.5),
      1.5
    );
  }

  return group;
}

function buildControlBuilding(enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MainControlBuilding';
  group.position.set(0, 0, -38.5);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.72,
    metalness: 0.08,
  });
  const dadoMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.78,
    metalness: 0.1,
  });
  const blueFasciaMat = new THREE.MeshStandardMaterial({
    color: 0x2b5b84,
    roughness: 0.42,
    metalness: 0.28,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.15,
    metalness: 0.85,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.4,
    metalness: 0.5,
  });

  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(36, 7.2, 12), wallMat);
  mainBody.position.y = 3.6;
  mainBody.castShadow = enableShadows;
  mainBody.receiveShadow = enableShadows;
  group.add(mainBody);

  const dado = new THREE.Mesh(new THREE.BoxGeometry(36.1, 1.2, 12.1), dadoMat);
  dado.position.y = 0.6;
  group.add(dado);

  const blueRoofBand = new THREE.Mesh(new THREE.BoxGeometry(36.6, 0.85, 12.6), blueFasciaMat);
  blueRoofBand.position.y = 7.35;
  blueRoofBand.castShadow = enableShadows;
  group.add(blueRoofBand);

  const midCanopy = new THREE.Mesh(new THREE.BoxGeometry(36.4, 0.24, 12.5), blueFasciaMat);
  midCanopy.position.y = 4.1;
  group.add(midCanopy);

  for (let wx = -14; wx <= 14; wx += 3.5) {
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.55, 0.12), frameMat);
    winFrame.position.set(wx, 5.55, 6.02);
    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.35, 0.15), glassMat);
    winGlass.position.set(wx, 5.55, 6.03);
    group.add(winFrame, winGlass);
  }

  const groundOpenings = [-12, -8, -2.2, 0.0, 2.2, 8, 12];
  for (const gx of groundOpenings) {
    const isDoor = Math.abs(gx - 2.2) < 0.1 || Math.abs(gx) < 0.1;
    const h = isDoor ? 2.5 : 1.65;
    const y = isDoor ? 1.3 : 2.1;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, h, 0.12), frameMat);
    frame.position.set(gx, y, 6.02);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.55, h - 0.2, 0.15), glassMat);
    glass.position.set(gx, y, 6.03);
    group.add(frame, glass);
  }

  const fireBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.65, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.3 })
  );
  fireBox.position.set(1.15, 1.5, 6.08);
  group.add(fireBox);

  return group;
}

function buildAuxiliaryFacilities(enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();

  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.72,
    metalness: 0.1,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2b5b84,
    roughness: 0.45,
    metalness: 0.25,
  });

  const westHall = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.4, 42), bldgMat);
  westHall.position.set(-34, 3.2, 0);
  westHall.castShadow = enableShadows;
  westHall.receiveShadow = enableShadows;
  const westTrim = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.6, 42.4), trimMat);
  westTrim.position.set(-34, 6.5, 0);
  group.add(westHall, westTrim);

  const eastHall = new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.0, 42), bldgMat);
  eastHall.position.set(34, 3.0, 0);
  eastHall.castShadow = enableShadows;
  eastHall.receiveShadow = enableShadows;
  const eastTrim = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.6, 42.4), trimMat);
  eastTrim.position.set(34, 6.1, 0);
  group.add(eastHall, eastTrim);

  return group;
}

function buildLatticeTower(x: number, z: number, enableShadows: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x717d8a,
    roughness: 0.5,
    metalness: 0.7,
  });

  const legHeight = 22;
  const baseHalf = 2.4;
  const topHalf = 0.75;

  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  for (const [sx, sz] of corners) {
    const p1 = new THREE.Vector3(sx * baseHalf, 0, sz * baseHalf);
    const p2 = new THREE.Vector3(sx * topHalf, legHeight, sz * topHalf);
    const curve = new THREE.LineCurve3(p1, p2);
    const legGeo = new THREE.TubeGeometry(curve, 4, 0.1, 6, false);
    const legMesh = new THREE.Mesh(legGeo, steelMat);
    legMesh.castShadow = enableShadows;
    group.add(legMesh);
  }

  for (let tier = 1; tier <= 7; tier++) {
    const ty = tier * 3.0;
    const tRatio = ty / legHeight;
    const w = THREE.MathUtils.lerp(baseHalf * 2, topHalf * 2, tRatio);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, w), steelMat);
    ring.position.y = ty;
    group.add(ring);
  }

  for (const armY of [13.5, 17.0, 20.5]) {
    const armSpan = armY === 17.0 ? 8.4 : 6.8;
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(armSpan, 0.35, 0.8), steelMat);
    crossArm.position.y = armY;
    group.add(crossArm);
  }

  return group;
}

function buildBlockoutProxies(
  blockoutGroup: THREE.Group,
  textures: SubstationTextures,
  enableShadows: boolean
) {
  const hazardBoxMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.65,
    metalness: 0.25,
  });
  const buildingBoxMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.7,
    metalness: 0.15,
  });
  const signMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.signNoClimb,
    roughness: 0.4,
  });

  for (const obs of SUBSTATION_OBSTACLES) {
    const w = obs.maxX - obs.minX;
    const d = obs.maxZ - obs.minZ;
    const h = obs.height;
    const cx = (obs.minX + obs.maxX) * 0.5;
    const cz = (obs.minZ + obs.maxZ) * 0.5;

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      obs.isHazard ? hazardBoxMat : buildingBoxMat
    );
    box.position.set(cx, h * 0.5, cz);
    box.castShadow = enableShadows;
    box.receiveShadow = enableShadows;
    blockoutGroup.add(box);

    if (obs.isHazard && !obs.id.startsWith('switchgear-')) {
      const coreBlock = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.55, 5.2, d * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.4 })
      );
      coreBlock.position.set(cx, 2.6, cz);
      coreBlock.castShadow = enableShadows;
      blockoutGroup.add(coreBlock);

      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), signMat);
      const roadSideX = cx < 0 ? obs.maxX + 0.05 : obs.minX - 0.05;
      sign.position.set(roadSideX, 1.4, cz);
      sign.rotation.y = cx < 0 ? Math.PI / 2 : -Math.PI / 2;
      blockoutGroup.add(sign);
    }
  }
}

/**
 * 围墙外的地平线环境。
 * 实际陆地由 GLB 中 140 × 130 m 的 PBR 草地承载；这里只保留远处水面和
 * 场外道路，避免旧浅色圆盘盖住草地贴图，也避免地图继续向可玩区域外扩张。
 */
function buildExternalTerrain(): {
  group: THREE.Group;
  setMode: (mode: RenderDetailMode) => void;
} {
  const group = new THREE.Group();
  group.name = 'ExternalTerrainHorizon';

  const themed: Array<{
    mat: THREE.MeshStandardMaterial;
    detailed: number;
    blockout: number;
  }> = [];
  const makeMat = (
    detailed: number,
    blockout: number,
    roughness = 1,
    metalness = 0
  ) => {
    const mat = new THREE.MeshStandardMaterial({
      color: blockout,
      roughness,
      metalness,
    });
    themed.push({ mat, detailed, blockout });
    return mat;
  };

  // 远处水面与天空盒地平线融合；它不是可行走的地图范围。
  const waterMat = makeMat(0x6ea3b8, 0xa9c3d3, 0.28, 0.25);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1500, 128), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.5;
  group.add(water);

  // 主入口道路止于草地南缘（game z = 62），不再伸到地图之外。
  const roadMat = makeMat(0x4c5257, 0x979ea3);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 29), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(21.3, -0.04, 47.5);
  group.add(road);

  return {
    group,
    setMode(mode: RenderDetailMode) {
      for (const t of themed) {
        t.mat.color.setHex(mode === 'detailed' ? t.detailed : t.blockout);
      }
    },
  };
}
