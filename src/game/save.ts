import type { Act1State, ActNo } from './act1';
import type { EvidenceRecord } from './evidence';
import type { EndingKind, ProPolicy, StoryPhase } from './storyTypes';

export interface StorySettings {
  textSpeedMs: number;
  autoDelayMs: number;
}

export interface SaveV1 {
  version: 1;
  seed: number;
  phase: StoryPhase;
  act: ActNo;
  policy: ProPolicy | null;
  act1: Act1State | null;
  ending: EndingKind | null;
  /** 已发现但未闭环的隐患，任意一项都会走向事故责任的 BAD 结局。 */
  unhandledHazards: string[];
  /** 三幕累计扣分后的总分。 */
  totalScore: number;
  /** 已完成各幕快照，用于结局复盘；旧存档可能没有该字段。 */
  actHistory: Act1State[];
  evidence: EvidenceRecord[];
  settings: StorySettings;
  updatedAt: number;
}

export const SAVE_KEY = 'substation.v62.save';
export const DEFAULT_SETTINGS: StorySettings = {
  textSpeedMs: 32,
  autoDelayMs: 1200,
};

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

type ParsedSave = Partial<SaveV1> & {
  /** v62 旧字段：只记录重大隐患。 */
  missedUrgent?: unknown;
  /** v62 旧字段：分幕得分，结局取平均。 */
  actScores?: unknown;
  /** v62 旧字段：结算分。 */
  finalScore?: unknown;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 旧存档的分幕得分换算成累计总分：100 减去各幕扣分之和。 */
function legacyTotalScore(actScores: unknown): number {
  if (!Array.isArray(actScores)) return 100;
  const lost = actScores
    .filter(isFiniteNumber)
    .reduce((sum, value) => sum + Math.max(0, 100 - value), 0);
  return Math.max(0, Math.min(100, 100 - lost));
}

export function loadSave(store: Storage | null = storage()): SaveV1 | null {
  if (!store) return null;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParsedSave;
    if (parsed.version !== 1) return null;
    if (typeof parsed.seed !== 'number') return null;
    const unhandledHazards = Array.isArray(parsed.unhandledHazards)
      ? parsed.unhandledHazards.filter(
          (title): title is string => typeof title === 'string'
        )
      : Array.isArray(parsed.missedUrgent)
        ? parsed.missedUrgent.filter(
            (title): title is string => typeof title === 'string'
          )
        : [];
    return {
      version: 1,
      seed: parsed.seed,
      phase: (parsed.phase ?? 'title') as StoryPhase,
      act: (parsed.act ?? parsed.act1?.act ?? 1) as ActNo,
      policy: (parsed.policy ?? null) as ProPolicy | null,
      act1: (parsed.act1 ?? null) as Act1State | null,
      ending: (parsed.ending ?? null) as EndingKind | null,
      unhandledHazards,
      totalScore: isFiniteNumber(parsed.totalScore)
        ? parsed.totalScore
        : isFiniteNumber(parsed.finalScore)
          ? parsed.finalScore
          : legacyTotalScore(parsed.actScores),
      actHistory: Array.isArray(parsed.actHistory)
        ? (parsed.actHistory as Act1State[])
        : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeSave(save: SaveV1, store: Storage | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    // Quota exceeded: retry once without the heaviest evidence thumbnails.
    try {
      const light: SaveV1 = {
        ...save,
        evidence: save.evidence.slice(-6).map((e) => ({ ...e, dataUrl: '' })),
      };
      store.setItem(SAVE_KEY, JSON.stringify(light));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearSave(store: Storage | null = storage()): void {
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
