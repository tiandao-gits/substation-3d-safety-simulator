import { openSync, readSync, closeSync, fstatSync } from 'node:fs';

type Accessor = { type: string; min?: number[]; max?: number[]; count: number };
type Primitive = { attributes: Record<string, number>; indices?: number };
type MeshDef = { name?: string; primitives: Primitive[] };
type NodeDef = {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
};

type Box = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
type Entry = { name: string; depth: number; box: Box | null; triangles: number };

const path = process.argv[2] ?? 'public/substation_blockout.glb';
const filter = (process.argv[3] ?? '').toUpperCase();
const maxDepth = Number(process.argv[4] ?? 3);

const fd = openSync(path, 'r');
try {
  const header = Buffer.alloc(12);
  readSync(fd, header, 0, 12, 0);
  if (header.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');

  const chunkHead = Buffer.alloc(8);
  readSync(fd, chunkHead, 0, 8, 12);
  const jsonLength = chunkHead.readUInt32LE(0);
  if (chunkHead.readUInt32LE(4) !== 0x4e4f534a) throw new Error('JSON chunk must come first');
  const jsonBuf = Buffer.alloc(jsonLength);
  readSync(fd, jsonBuf, 0, jsonLength, 20);
  const gltf = JSON.parse(jsonBuf.toString('utf8')) as {
    meshes: MeshDef[];
    nodes: NodeDef[];
    accessors: Accessor[];
    scenes: { nodes?: number[] }[];
    asset?: { generator?: string };
  };

  const mul = (a: number[], b: number[]): number[] => {
    const out = new Array<number>(16).fill(0);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  };

  const compose = (node: NodeDef): number[] => {
    if (node.matrix) return node.matrix;
    const t = node.translation ?? [0, 0, 0];
    const q = node.rotation ?? [0, 0, 0, 1];
    const s = node.scale ?? [1, 1, 1];
    const [x, y, z, w] = q;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    return [
      (1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
      (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
      (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1,
    ];
  };

  const transformPoint = (m: number[], p: number[]): number[] => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];

  const emptyBox = (): Box => ({
    minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, minY: Infinity, maxY: -Infinity,
  });

  const unionInto = (a: Box, b: Box) => {
    a.minX = Math.min(a.minX, b.minX); a.maxX = Math.max(a.maxX, b.maxX);
    a.minZ = Math.min(a.minZ, b.minZ); a.maxZ = Math.max(a.maxZ, b.maxZ);
    a.minY = Math.min(a.minY, b.minY); a.maxY = Math.max(a.maxY, b.maxY);
  };

  const worldBoxOfMesh = (node: NodeDef, world: number[]): { box: Box; triangles: number } | null => {
    if (node.mesh == null) return null;
    const mesh = gltf.meshes[node.mesh];
    if (!mesh) return null;
    let acc: { box: Box; triangles: number } | null = null;
    for (const prim of mesh.primitives) {
      const pos = gltf.accessors[prim.attributes.POSITION];
      if (!pos?.min || !pos?.max) continue;
      const local: Box = {
        minX: pos.min[0], maxX: pos.max[0],
        minY: pos.min[1], maxY: pos.max[1],
        minZ: pos.min[2], maxZ: pos.max[2],
      };
      const indices = prim.indices != null ? gltf.accessors[prim.indices]?.count ?? 0 : pos.count;
      const corners: number[][] = [];
      for (const x of [local.minX, local.maxX])
        for (const y of [local.minY, local.maxY])
          for (const z of [local.minZ, local.maxZ]) corners.push([x, y, z]);
      const box = emptyBox();
      for (const c of corners) {
        const w = transformPoint(world, c);
        box.minX = Math.min(box.minX, w[0]); box.maxX = Math.max(box.maxX, w[0]);
        box.minZ = Math.min(box.minZ, w[2]); box.maxZ = Math.max(box.maxZ, w[2]);
        box.minY = Math.min(box.minY, w[1]); box.maxY = Math.max(box.maxY, w[1]);
      }
      if (!acc) acc = { box, triangles: Math.floor(indices / 3) };
      else {
        unionInto(acc.box, box);
        acc.triangles += Math.floor(indices / 3);
      }
    }
    return acc;
  };

  const results: Entry[] = [];
  const walk = (index: number, parentWorld: number[], depth: number): Entry => {
    const node = gltf.nodes[index];
    const world = mul(parentWorld, compose(node));
    const mesh = worldBoxOfMesh(node, world);
    let own: Box | null = mesh ? mesh.box : null;
    let triangles = mesh ? mesh.triangles : 0;
    for (const child of node.children ?? []) {
      const c = walk(child, world, depth + 1);
      triangles += c.triangles;
      if (c.box) {
        if (own) unionInto(own, c.box);
        else own = { ...c.box };
      }
    }
    const entry: Entry = { name: node.name ?? `node_${index}`, depth, box: own, triangles };
    if (depth <= maxDepth) results.push(entry);
    return entry;
  };

  for (const root of gltf.scenes[0]?.nodes ?? []) walk(root, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);

  const inFilter = (name: string) => filter === '' || name.toUpperCase().includes(filter);

  console.log(`// ${path}  ${(fstatSync(fd).size / 1048576).toFixed(1)} MB  generator=${gltf.asset?.generator ?? '?'}`);
  console.log('// game x = gltf x = blender x, game z = gltf z = -blender y, h = gltf y');
  let rootShown = false;
  for (const e of results) {
    if (e.depth === 0) rootShown = inFilter(e.name);
    const shown = e.depth === 0 ? rootShown : rootShown || inFilter(e.name);
    if (!shown) continue;
    if (!e.box) {
      console.log(`${'  '.repeat(e.depth)}${e.name}  (no geometry)`);
      continue;
    }
    const b = e.box;
    const gx1 = Math.min(b.minX, b.maxX), gx2 = Math.max(b.minX, b.maxX);
    const gz1 = Math.min(b.minZ, b.maxZ), gz2 = Math.max(b.minZ, b.maxZ);
    console.log(
      `${'  '.repeat(e.depth)}${e.name}${e.depth === 0 ? '  [ROOT]' : ''}  ` +
        `x ${gx1.toFixed(2)}…${gx2.toFixed(2)}  z ${gz1.toFixed(2)}…${gz2.toFixed(2)}  ` +
        `h ${b.minY.toFixed(2)}…${b.maxY.toFixed(2)}  tris ${e.triangles}`,
    );
  }
  console.log(`// ${results.length} entries (depth<=${maxDepth}, filter='${filter}')`);
} finally {
  closeSync(fd);
}
