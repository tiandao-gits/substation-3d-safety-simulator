/**
 * 评分值对应关系审计：逐幕 × 逐变体 × 逐测点，核对
 * 实测读数 → 判据函数 → standardGradeFor → 硬编码标准分 是否一致。
 *
 * 运行：bun run scripts/audit-scoring-values.ts
 */

import {
  ACT_AMBIENT,
  applyAct1Action,
  createAct1State,
  getActPoints,
  getAdmissibleReading,
  standardGradeFor,
  type Act1Tool,
  type Act1Variant,
  type ActNo,
  type Act1State,
} from '../src/game/act1';

const VARIANTS: Act1Variant[] = ['A', 'B', 'C', 'D'];
const ACTS: ActNo[] = [1, 2, 3];

function seedFor(variant: Act1Variant, act: ActNo): number {
  for (let s = 1; s < 400000; s += 1) {
    if (createAct1State(s, act).variant === variant) return s;
  }
  throw new Error(`no seed for ${variant} act ${act}`);
}

/** 与真实流程一致：只执行 requiredActions 里的合格动作。 */
function detectAll(base: Act1State): Act1State {
  let state = base;
  for (const point of getActPoints(base.act)) {
    for (const actionId of point.requiredActions) {
      const found = Object.entries(point.actions).find(([, specs]) =>
        specs?.some((spec) => spec.id === actionId)
      );
      if (!found) continue;
      const [tool, specs] = found;
      const spec = specs?.find((s) => s.id === actionId);
      if (!spec) continue;
      state = applyAct1Action(
        state,
        point.id,
        tool as Act1Tool | 'visual',
        spec.id
      ).state;
    }
  }
  return state;
}

let failures = 0;

for (const act of ACTS) {
  console.log(`═══ 第${act}幕 · 环温 ${ACT_AMBIENT[act].temperatureC} ℃ ═══`);
  for (const variant of VARIANTS) {
    if (act !== 2 && variant === 'D') continue;
    let state = createAct1State(seedFor(variant, act), act);
    state = detectAll(state);
    console.log(`  ── 变体 ${variant} ──`);
    for (const point of getActPoints(act)) {
      const reading = getAdmissibleReading(state.points[point.id]);
      const derived = standardGradeFor(state, point.id);
      const authored = point.standardGrade[variant];
      const finding = point.finding[variant];
      const consistent =
        derived === authored && Boolean(finding) === (derived !== 'P0');
      if (!consistent) failures += 1;
      const readingText = reading
        ? `${reading.label} ${reading.unit} [${reading.quality}]`
        : '无合格读数（人工判定）';
      console.log(
        `  ${point.id.padEnd(9)} ${readingText.padEnd(48)} → ${derived}` +
          ` ｜ 标准 ${authored} · 隐患 ${finding ? finding.klass : 'none'}` +
          (consistent ? '' : '  ⚠ 不一致')
      );
    }
  }
  console.log('');
}

console.log(
  failures === 0
    ? '一致：所有测点的读数判级与标准分、隐患表完全对应。'
    : `发现 ${failures} 处不一致。`
);
if (failures > 0) process.exitCode = 1;
