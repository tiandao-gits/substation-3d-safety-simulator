/**
 * Dump an XZ occupancy grid for one GLB node so colliders can be derived from
 * measured geometry instead of guessed footprints.
 *   bun run scripts/glb-occupancy-grid.ts [glb] [nodeName] [cell] [hMin] [hMax]
 */
import { openSync, readSync, closeSync } from 'node:fs';

const path = process.argv[2] ?? 'public/substation_blockout.glb';
const target = (process.argv[3] ?? 'Bay_F02_ASSEMBLY').toUpperCase();
const cell = Number(process.argv[4] ?? 0.6);
const hMin = Number(process.argv[5] ?? 0.6);
const hMax = Number(process.argv[6] ?? 2.2);

type Box = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };

const fd = openSync(path, 'r');
const header = Buffer.alloc(12);
readSync(fd, header, 0, 12, 0);
if (header.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');

const jsonHead = Buffer.alloc(8);
readSync(fd, jsonHead, 0, 8, 12);
const jsonLen = jsonHead.readUInt32LE(0);
const jsonBuf = Buffer.alloc(jsonLen);
readSync(fd, jsonBuf, 0, jsonLen, 20);
const gltf = JSON.parse(jsonBuf.toString('utf8')) as Record<string, any>;

if (gltf.extensionsUsed?.includes('KHR_draco_mesh_compression')) {
  throw new Error(
    'GLB is Draco-compressed: raw POSITION accessors are unavailable. Export an uncompressed copy for occupancy audits.'
  );
}

const binHead = Buffer.alloc(8);
readSync(fd, binHead, 0, 8, 20 + jsonLen);
const binLen = binHead.readUInt32LE(0);
const binOffset = 20 + jsonLen + 8;

const readFloats = (byteOffset: number, byteLength: number): Float32Array => {
  const buf = Buffer.alloc(byteLength);
  readSync(fd, buf, 0, byteLength, binOffset + byteOffset);
  return new Float32Array(buf.buffer, buf.byteOffset, byteLength / 4);
};

const mul = (a: number[], b: number[]) => {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
};

const compose = (n: any): number[] => {
  if (n.matrix) return n.matrix;
  const t = n.translation ?? [0, 0, 0];
  const q = n.rotation ?? [0, 0, 0, 1];
  const s = n.scale ?? [1, 1, 1];
  const [x, y, z, w] = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
    (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
    (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};

const apply = (m: number[], p: number[]): [number, number, number] => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

const cells = new Map<string, Box>();
let vertexCount = 0;

const collectMesh = (node: any, world: number[]) => {
  for (const meshIdx of node.mesh != null ? [node.mesh] : []) {
    for (const prim of gltf.meshes[meshIdx].primitives ?? []) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      const view = gltf.bufferViews[acc.bufferView];
      if (view.byteStride && view.byteStride !== 12) continue; // interleaved: skip
      const data = readFloats(view.byteOffset ?? 0, view.byteLength);
      for (let i = 0; i < acc.count; i++) {
        const p = apply(world, [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
        vertexCount++;
        if (p[1] < hMin || p[1] > hMax) continue;
        const cx = Math.floor(p[0] / cell);
        const cz = Math.floor(p[2] / cell);
        const key = `${cx},${cz}`;
        const box = cells.get(key);
        if (!box) {
          cells.set(key, {
            minX: cx * cell, maxX: (cx + 1) * cell, minZ: cz * cell, maxZ: (cz + 1) * cell,
            minY: p[1], maxY: p[1],
          });
        } else {
          box.minY = Math.min(box.minY, p[1]);
          box.maxY = Math.max(box.maxY, p[1]);
        }
      }
    }
  }
};

const walk = (index: number, parentWorld: number[], isTarget: boolean) => {
  const node = gltf.nodes[index];
  const world = mul(parentWorld, compose(node));
  const mine = isTarget || (node.name ?? '').toUpperCase().includes(target);
  if (mine) collectMesh(node, world);
  for (const c of node.children ?? []) walk(c, world, mine);
};

for (const root of gltf.scenes[0]?.nodes ?? []) walk(root, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], false);
closeSync(fd);

const keys = [...cells.keys()].map((k) => k.split(',').map(Number));
if (keys.length === 0) {
  console.log(`// no vertices matched node containing '${target}' in band ${hMin}…${hMax} m`);
  process.exit(0);
}
const minCx = Math.min(...keys.map((k) => k[0])), maxCx = Math.max(...keys.map((k) => k[0]));
const minCz = Math.min(...keys.map((k) => k[1])), maxCz = Math.max(...keys.map((k) => k[1]));
const occupied = new Set(keys.map((k) => `${k[0]},${k[1]}`));

console.log(`// '${target}'  ${vertexCount} verts, ${cells.size} cells of ${cell} m, band ${hMin}…${hMax} m`);
console.log(`// x ${minCx * cell}…${(maxCx + 1) * cell}   z ${minCz * cell}…${(maxCz + 1) * cell}   (columns = x, rows = z)`);

// ASCII map: rows are z, columns are x.
for (let cz = minCz; cz <= maxCz; cz++) {
  let row = `${String(cz * cell).padStart(7)} |`;
  for (let cx = minCx; cx <= maxCx; cx++) row += occupied.has(`${cx},${cz}`) ? '#' : '.';
  console.log(row);
}

// Maximal rectangles, greedy over the occupancy grid (descending x-width then z-depth).
const free = new Set<string>();
const rects: Box[] = [];
const isBlocked = (cx: number, cz: number) => occupied.has(`${cx},${cz}`);
for (let cz = minCz; cz <= maxCz; cz++) {
  for (let cx = minCx; cx <= maxCx; cx++) {
    if (!isBlocked(cx, cz) || free.has(`${cx},${cz}`)) continue;
    let w = 1;
    while (isBlocked(cx + w, cz) && !free.has(`${cx + w},${cz}`)) w++;
    let d = 1;
    grow: while (true) {
      for (let k = 0; k < w; k++) {
        if (!isBlocked(cx + k, cz + d) || free.has(`${cx + k},${cz + d}`)) break grow;
      }
      d++;
    }
    for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) free.add(`${cx + a},${cz + b}`);
    rects.push({
      minX: cx * cell, maxX: (cx + w) * cell, minZ: cz * cell, maxZ: (cz + d) * cell, minY: 0, maxY: 0,
    });
  }
}
console.log(`// ${rects.length} blocking rectangles (merge cell size ${cell} m):`);
for (const r of rects) {
  console.log(
    `  minX ${r.minX.toFixed(2)}, maxX ${r.maxX.toFixed(2)}, minZ ${r.minZ.toFixed(2)}, maxZ ${r.maxZ.toFixed(2)}, ` +
      `w ${(r.maxX - r.minX).toFixed(2)} d ${(r.maxZ - r.minZ).toFixed(2)}`,
  );
}
