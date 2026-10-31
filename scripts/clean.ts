import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const targets = ['dist', 'server.js'];

await Promise.all(
  targets.map((target) => rm(resolve(projectRoot, target), { recursive: true, force: true })),
);

console.log(`[clean] Removed ${targets.join(', ')}`);
