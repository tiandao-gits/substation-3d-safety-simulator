#!/usr/bin/env bun
/**
 * 把 GLB 切成若干 < 15MB 的分片，并生成加载器需要的清单文件。
 *
 * 用法：
 *   bun run scripts/split-glb.ts                       # 切 public/substation_blockout.glb
 *   bun run scripts/split-glb.ts <input.glb> [outDir]  # 自定义源文件与输出目录
 *
 * 产物（默认与源文件同目录）：
 *   <name>.glb.part0 / .part1 / ...
 *   <name>.glb.parts.json   ← 分片清单（片数、总字节、每片文件名）
 *
 * 分片只是字节切分，客户端拼回完整 ArrayBuffer 后再交给 GLTFLoader，
 * 因此不会损失任何几何或贴图精度。
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** 单片上限：15MiB。取 15*1024*1024 是为了无论按 MiB 还是十进制 MB 都严格小于 15MB。 */
const PART_LIMIT = 15 * 1024 * 1024;

const input = process.argv[2] ?? 'public/substation_blockout.glb';
const outDir = process.argv[3] ?? path.dirname(input);

const info = await stat(input).catch(() => null);
if (!info) {
  console.error(`找不到源文件：${input}`);
  process.exit(1);
}
if (info.size === 0) {
  console.error(`源文件为空：${input}`);
  process.exit(1);
}

const data = await readFile(input);
const total = data.byteLength;
const baseName = path.basename(input);

// 保证每一片都严格小于 PART_LIMIT（total 恰为上限整数倍时也要多切一片）
const partCount = Math.floor(total / PART_LIMIT) + 1;
const partBytes = Math.ceil(total / partCount);

await mkdir(outDir, { recursive: true });

const parts: string[] = [];
const written: { name: string; bytes: number }[] = [];
for (let i = 0; i < partCount; i++) {
  const start = i * partBytes;
  const end = Math.min(start + partBytes, total);
  const name = `${baseName}.part${i}`;
  const chunk = data.subarray(start, end);
  await writeFile(path.join(outDir, name), chunk);
  parts.push(name);
  written.push({ name, bytes: chunk.byteLength });
}

const manifest = {
  source: baseName,
  totalBytes: total,
  partBytes,
  partCount,
  parts,
};
const manifestName = `${baseName}.parts.json`;
await writeFile(path.join(outDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MiB`;
console.log(`源文件  ${input}  ${mb(total)} (${total} B)`);
console.log(`输出目录 ${outDir}`);
console.log(`切片数  ${partCount}（上限 ${mb(PART_LIMIT)}）`);
for (const w of written) {
  const flag = w.bytes >= PART_LIMIT ? '  ⚠ 超过上限' : '';
  console.log(`  ${w.name.padEnd(34)} ${mb(w.bytes).padStart(10)}  ${String(w.bytes).padStart(10)} B${flag}`);
}
console.log(`  ${manifestName.padEnd(34)} ${mb((await stat(path.join(outDir, manifestName))).size).padStart(10)}`);
console.log(`合计 ${mb(written.reduce((a, w) => a + w.bytes, 0))} / 原 ${mb(total)}`);
