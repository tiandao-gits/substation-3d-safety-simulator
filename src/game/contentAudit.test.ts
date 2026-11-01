import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_BRIEFING_TRIGGERS,
  ACT_DOSSIERS,
  ACT_SECTION_CARDS,
  ACT_TASK_CARDS,
  ACT1_LINES,
  ENDING_DELAY,
  ENDING_END,
  ENDING_GOOD,
  ENDING_STUB,
  PROLOGUE,
} from '../config/dialogues';
import { GAME_TEXT, MESSAGES } from '../config/gameText';
import { ACT_POINTS } from './act1';
import { TOOL_HINT_TERMS, auditPlayerFacingContent, type AuditEntry } from './contentAudit';

/** The hard rule is about the nine inspection tools; the drone is a view mode. */
const INSPECTION_TOOL_TERMS = TOOL_HINT_TERMS.filter((term) => term !== '无人机');

function flatten(prefix: string, value: unknown, out: AuditEntry[]): void {
  if (typeof value === 'string') {
    out.push({ id: prefix, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(`${prefix}[${index}]`, item, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'function') continue;
      flatten(`${prefix}.${key}`, child, out);
    }
  }
}

function storyEntries(): AuditEntry[] {
  const out: AuditEntry[] = [];
  flatten('prologue', PROLOGUE, out);
  flatten('section-cards', ACT_SECTION_CARDS, out);
  flatten('task-cards', ACT_TASK_CARDS, out);
  flatten('dossiers', ACT_DOSSIERS, out);
  flatten('act1-lines', ACT1_LINES, out);
  flatten('ending-good', ENDING_GOOD, out);
  flatten('ending-end', ENDING_END, out);
  flatten('ending-delay', ENDING_DELAY, out);
  flatten('ending-stub', ENDING_STUB, out);
  for (const act of [1, 2, 3] as const) {
    ACT_POINTS[act].forEach((point) => {
      flatten(`act${act}-point-${point.id}`, point, out);
    });
  }
  return out;
}

/** Text shown while the player is roaming: HUD, banners, help, log/review chrome. */
function uiEntries(): AuditEntry[] {
  const out: AuditEntry[] = [];
  const exempt = ['backpack', 'character', 'settings'];
  for (const [key, value] of Object.entries(GAME_TEXT)) {
    if (exempt.includes(key)) continue;
    flatten(`gameText.${key}`, value, out);
  }
  flatten('messages', MESSAGES, out);
  return out;
}

test('story text never names a tool or hints at one', () => {
  const entries = storyEntries();
  assert.ok(entries.length > 40, `expected the story corpus, got ${entries.length} strings`);
  const violations = entries
    .map((entry) => ({
      id: entry.id,
      hints: INSPECTION_TOOL_TERMS.filter((term) => entry.text.includes(term)),
    }))
    .filter((entry) => entry.hints.length > 0);
  assert.deepEqual(violations, []);
});

test('HUD and banner copy never names an inspection tool', () => {
  const entries = uiEntries();
  const violations = entries
    .map((entry) => ({
      id: entry.id,
      hints: INSPECTION_TOOL_TERMS.filter((term) => entry.text.includes(term)),
    }))
    .filter((entry) => entry.hints.length > 0);
  assert.deepEqual(violations, []);
});

test('每个排队播放的现场对话 id 都有对应文案', () => {
  const missing: string[] = [];
  for (const [act, trigger] of Object.entries(ACT_BRIEFING_TRIGGERS)) {
    for (const id of trigger.lines) {
      if (!ACT1_LINES[id]) missing.push(`第${act}幕 ${id}`);
    }
  }
  assert.deepEqual(missing, [], '缺少文案会导致聊天播完后遮罩无法关闭');
});

test('the audit catches a planted hint, so the guard is live', () => {
  const violations = auditPlayerFacingContent([
    { id: 'planted', text: '用红外测温仪测量触头温度后填报。' },
  ]);
  assert.equal(violations.length, 1);
  assert.ok(violations[0].hints.includes('红外测温仪'));
});
