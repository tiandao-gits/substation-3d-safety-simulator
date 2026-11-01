import * as THREE from 'three';

/**
 * 公寓楼梯间那扇**真实存在的玻璃门**的铰链装配。
 *
 * 背景：SketchUp 导出的 GLB 按材质合并网格，门扇不是独立节点 ——
 * 门框（metal_brown）、玻璃（glass）、拉手与锁具（plastic_black / metal_silver）、
 * 门牌（sign_2）都各自和整栋楼的同材质零件焊在一个 Mesh 里。
 * 所以"再补一扇门"既多余也穿帮：正确做法是按世界坐标把**门扇自己的三角形**
 * 从这些合并网格里切出来，挂到铰链上，剩下的三角形留在原处（门框、门楣不动）。
 *
 * 实测（对 substation_blockout.glb 做三角形质心扫描）：
 * - 玻璃：x = 30.658 的平面，两扇玻璃 z -20.239…-20.089 / -19.941…-19.294，y 0.381…2.052；
 *   更高处 y>2.05 的是门楣亮子，固定不动。
 * - 棕色门框：z -20.280…-19.201、y 0.295…2.141。
 * - 黑色拉手：z -19.941…-19.902（偏北侧）→ 铰链在**南侧** z≈-19.185。
 * - 门洞内在 x 30.5…30.85 / y 0.45…2.0 / z -20.25…-19.25 没有任何墙体三角形，
 *   即门后是真的门洞，人物可以正常走出来。
 */
export const STAIR_DOOR = {
  /** 铰链：门扇南侧下角，向站区（西，-x）旋开。 */
  hinge: { x: 30.655, y: 0.25, z: -19.185 },
  /** 最大开度约 108°，门扇贴到西墙外侧，不挡门洞也不显得半开。 */
  openAngle: Math.PI * 0.6,
  /** 门扇包围盒（世界坐标）：只装门扇，不含门框与门楣。 */
  leafBox: {
    minX: 30.59,
    maxX: 30.705,
    minY: 0.27,
    maxY: 2.155,
    minZ: -20.295,
    maxZ: -19.175,
  },
  /** 参与门扇的合并网格名（顺序无关）。 */
  meshNames: ['metal_brown', 'metal_silver', 'glass', 'plastic_black', 'sign_2'] as readonly string[],
} as const;

export interface StairDoorRig {
  /** 铰链节点：已挂回建筑根节点，旋转它即开门。 */
  pivot: THREE.Group;
  /** open01：0 关 → 1 全开。 */
  setOpen: (open01: number) => void;
  /** 切下来的门扇三角形数；为 0 说明模型里没找到门扇。 */
  leafTriangles: number;
}

const ATTRIBUTE_ITEM_SIZE: Record<string, number> = {
  position: 3,
  normal: 3,
  uv: 2,
  uv1: 2,
  uv2: 2,
  color: 3,
  tangent: 4,
};

interface TriangleBuckets {
  /** 每个属性一份"留下的三角形"数组。 */
  kept: Record<string, number[]>;
  /** 每个属性一份"切走的三角形"数组（世界坐标）。 */
  extracted: Record<string, number[]>;
}

function buildGeometry(
  buckets: Record<string, number[]>,
  source: THREE.BufferGeometry
): THREE.BufferGeometry | null {
  const positions = buckets.position;
  if (!positions || positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  for (const [name, array] of Object.entries(buckets)) {
    const attribute = source.getAttribute(name) as THREE.BufferAttribute;
    const itemSize = ATTRIBUTE_ITEM_SIZE[name] ?? attribute.itemSize;
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, itemSize));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * 把一个合并网格按"三角形质心是否落在门扇包围盒里"拆成两份。
 * 直接操作非索引展开后的属性，避免索引/分组（multi-material）带来的边角情况。
 */
function splitMeshByLeafBox(
  mesh: THREE.Mesh,
  leafBox: THREE.Box3
): { kept: THREE.BufferGeometry | null; extracted: THREE.BufferGeometry | null } {
  const source = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  const position = source.getAttribute('position');
  const names = Object.keys(source.attributes);
  const buckets: TriangleBuckets = { kept: {}, extracted: {} };
  for (const name of names) {
    buckets.kept[name] = [];
    buckets.extracted[name] = [];
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let tri = 0; tri < position.count / 3; tri += 1) {
    const base = tri * 3;
    a.fromBufferAttribute(position, base).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, base + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, base + 2).applyMatrix4(mesh.matrixWorld);
    centroid
      .set((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
    const inside = leafBox.containsPoint(centroid);
    const target = inside ? buckets.extracted : buckets.kept;

    for (const name of names) {
      const attribute = source.getAttribute(name) as THREE.BufferAttribute;
      const itemSize = ATTRIBUTE_ITEM_SIZE[name] ?? attribute.itemSize;
      // 切走的三角形需要世界坐标（稍后再换算到铰链局部），留下的保持原始局部坐标。
      for (let k = 0; k < 3; k += 1) {
        const vertexIndex = base + k;
        if (name === 'position' && inside) {
          const v = k === 0 ? a : k === 1 ? b : c;
          target[name].push(v.x, v.y, v.z);
        } else {
          for (let comp = 0; comp < itemSize; comp += 1) {
            target[name].push(attribute.array[vertexIndex * itemSize + comp] as number);
          }
        }
      }
    }
  }

  const result = {
    kept: buildGeometry(buckets.kept, source),
    extracted: buildGeometry(buckets.extracted, source),
  };
  source.dispose();
  return result;
}

/**
 * 从已加载的建筑模型里切出玻璃门扇并挂到铰链上。
 * @param host 建筑根节点（gltf.scene）。门扇 pivot 会作为它的子节点。
 * @returns 找不到门扇时返回 null，调用方直接不做门动画即可。
 */
export function createStairDoorRig(host: THREE.Object3D): StairDoorRig | null {
  host.updateMatrixWorld(true);
  const box = new THREE.Box3(
    new THREE.Vector3(STAIR_DOOR.leafBox.minX, STAIR_DOOR.leafBox.minY, STAIR_DOOR.leafBox.minZ),
    new THREE.Vector3(STAIR_DOOR.leafBox.maxX, STAIR_DOOR.leafBox.maxY, STAIR_DOOR.leafBox.maxZ)
  );

  const pivot = new THREE.Group();
  pivot.name = 'STAIR_DOOR_HINGE';
  pivot.position.copy(
    host.worldToLocal(
      new THREE.Vector3(STAIR_DOOR.hinge.x, STAIR_DOOR.hinge.y, STAIR_DOOR.hinge.z)
    )
  );
  host.add(pivot);
  host.updateMatrixWorld(true);
  const worldToPivot = pivot.matrixWorld.clone().invert();

  let leafTriangles = 0;
  const targets: THREE.Mesh[] = [];
  host.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && STAIR_DOOR.meshNames.includes(mesh.name)) targets.push(mesh);
  });

  for (const mesh of targets) {
    if (Array.isArray(mesh.material)) continue;
    const { kept, extracted } = splitMeshByLeafBox(mesh, box);
    if (!extracted) continue;
    leafTriangles += extracted.getAttribute('position').count / 3;

    // 原网格只保留门框/门楣等不在门扇包围盒里的部分。
    if (kept) {
      mesh.geometry.dispose();
      mesh.geometry = kept;
      mesh.geometry.computeBoundingSphere();
    } else {
      mesh.visible = false;
    }

    // 切下来的门扇：世界坐标 → 铰链局部坐标，材质、阴影设置与原网格一致。
    extracted.applyMatrix4(worldToPivot);
    extracted.computeBoundingSphere();
    const leaf = new THREE.Mesh(extracted, mesh.material);
    leaf.name = `STAIR_DOOR_LEAF_${mesh.name}`;
    leaf.castShadow = mesh.castShadow;
    leaf.receiveShadow = mesh.receiveShadow;
    pivot.add(leaf);
  }

  if (leafTriangles === 0) {
    pivot.removeFromParent();
    return null;
  }

  return {
    pivot,
    leafTriangles,
    setOpen(open01: number) {
      const t = Math.max(0, Math.min(1, open01));
      // 门扇自铰链向北（-z）展开；绕 +Y 正转即把自由端甩向站区（西，-x）。
      pivot.rotation.y = STAIR_DOOR.openAngle * t;
    },
  };
}
