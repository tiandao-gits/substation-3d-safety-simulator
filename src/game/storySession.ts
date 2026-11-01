/**
 * 三幕剧情流：
 * title → prologue VN → 第一幕 → 第二幕 → 第三幕 → GOOD / END。
 *
 * 幕间没有上报/复核 UI；一幕的检查点全部处置完成后直接进入下一幕场景卡。
 */

import {
  ACT_SECTION_CARDS,
  ENDING_DELAY,
  ENDING_END,
  ENDING_GOOD,
  PROLOGUE,
} from '../config/dialogues';
import {
  ACT1_SCORE_BASE,
  ACT_POINTS,
  applyAct1Action,
  applyAct1Penalty,
  attachAct1Evidence,
  consumeAct1Line,
  createAct1State,
  dispositionNeedsEvidence,
  evaluateActOutcome,
  failAct1ByShock,
  findingNeedsEvidence,
  getActPointIds,
  getActPoints,
  isActComplete,
  normalizeAct1State,
  queueAct1Lines,
  setAct1Disposition,
  settleActDispositions,
  standardGradeFor,
  type Act1Grade,
  type Act1PointId,
  type Act1State,
  type Act1Tool,
  type ActNo,
} from './act1';
import type { EvidenceRecord } from './evidence';
import { trimEvidence } from './evidence';
import type { SaveV1, StorySettings } from './save';
import { DEFAULT_SETTINGS } from './save';
import type { EndingKind, ProPolicy, StoryPhase } from './storyTypes';
import {
  advanceVn,
  chooseVn,
  createVnState,
  setVnAuto,
  setVnFast,
  skipVn,
  tickVn,
  type VnScene,
  type VnState,
} from './vn';

export interface StoryState {
  phase: StoryPhase;
  act: ActNo;
  seed: number;
  policy: ProPolicy | null;
  vn: VnState | null;
  act1: Act1State | null;
  ending: EndingKind | null;
  /**
   * 已发现但未取证闭环的隐患（含一般隐患）。
   * 任意一项未闭环，结局必然是事故责任的 BAD。
   */
  unhandledHazards: string[];
  /** 三幕累计扣分后的总分：每幕继承上一幕的分数，不再单幕重置。 */
  totalScore: number;
  /** 已完成各幕的完整状态，供结局页逐幕复盘。 */
  actHistory: Act1State[];
  evidence: EvidenceRecord[];
  message: string | null;
}

/** 隐患全部闭环后，总分达到该值才判 GOOD，低于则按延误工期责任判 BAD。 */
export const PASS_SCORE_THRESHOLD = 80;
/** 结算时每项未闭环隐患的扣分，使事故结局必然低于及格线。 */
export const UNHANDLED_HAZARD_PENALTY = 25;
/**
 * 序章选择"能晚上补的先补，补不了的当场停"（pro_policy=defer）的起手扣分。
 * 把整改留到夜间等于让风险多存在半天，评分上必须体现，否则这个选项没有代价。
 */
export const PROLOGUE_DEFER_PENALTY = 5;

/** 终局评分：累计总分减去未闭环隐患扣分。 */
export function settlementScore(
  totalScore: number,
  unhandledHazards: string[]
): number {
  return Math.max(
    0,
    Math.round(totalScore) - unhandledHazards.length * UNHANDLED_HAZARD_PENALTY
  );
}

/**
 * 终局判定：
 * 1. 只要发现隐患未处理 → BAD（事故责任），与分数无关；
 * 2. 隐患全部闭环后，总分 ≥ 80 → GOOD，< 80 → BAD（延误工期责任）。
 */
export function endingForRun(
  totalScore: number,
  unhandledHazards: string[]
): EndingKind {
  if (unhandledHazards.length > 0) return 'end';
  return totalScore >= PASS_SCORE_THRESHOLD ? 'good' : 'end';
}

export function settlementScoreForStory(
  state: Pick<StoryState, 'unhandledHazards' | 'totalScore' | 'act1'>
): number {
  const base = state.act1?.score ?? state.totalScore;
  return settlementScore(base, state.unhandledHazards);
}

export type StoryAction =
  | { type: 'new-game'; seed: number }
  | { type: 'resume'; save: SaveV1 }
  | { type: 'start' }
  | { type: 'vn-tick'; chars: number }
  | { type: 'vn-advance' }
  | { type: 'vn-choose'; optionIndex: number }
  | { type: 'vn-skip' }
  | { type: 'vn-auto'; on: boolean }
  | { type: 'vn-fast'; on: boolean }
  | { type: 'section-done' }
  | { type: 'act1-action'; pointId: Act1PointId; tool: Act1Tool | 'visual'; actionId: string }
  | { type: 'act1-disposition'; pointId: Act1PointId; grade: Act1Grade }
  | { type: 'act1-evidence'; evidence: EvidenceRecord }
  | {
      type: 'act1-penalty';
      id: string;
      label: string;
      points: number;
      chanceCost?: number;
      message: string;
    }
  | { type: 'queue-lines'; lines: string[] }
  | { type: 'act1-shock'; zoneLabel: string }
  | { type: 'act-complete' }
  | { type: 'act1-consume-line' }
  | { type: 'retry-act' }
  | { type: 'qa-act1'; seed?: number; act?: ActNo; policy?: ProPolicy; done?: boolean }
  | {
      type: 'qa-ending';
      seed?: number;
      ending: EndingKind;
      unhandledHazards?: string[];
      score?: number;
    }
  | { type: 'reset' }
  | { type: 'message'; text: string | null };

const SCENES: Record<string, VnScene> = {
  [PROLOGUE.id]: PROLOGUE,
  [ENDING_GOOD.id]: ENDING_GOOD,
  [ENDING_END.id]: ENDING_END,
  [ENDING_DELAY.id]: ENDING_DELAY,
};

/**
 * BAD 结局分两种追责：有未闭环隐患 → 事故责任；隐患全部闭环但总分不够
 * → 延误工期责任。
 */
function endingSceneFor(
  ending: EndingKind,
  unhandledHazards: string[]
): VnScene {
  if (ending === 'good') return ENDING_GOOD;
  return unhandledHazards.length > 0 ? ENDING_END : ENDING_DELAY;
}

export function createStoryState(seed: number): StoryState {
  return {
    phase: 'title',
    act: 1,
    seed: seed >>> 0,
    policy: null,
    vn: null,
    act1: null,
    ending: null,
    unhandledHazards: [],
    totalScore: ACT1_SCORE_BASE,
    actHistory: [],
    evidence: [],
    message: null,
  };
}

export function sceneFor(state: StoryState): VnScene | null {
  if (!state.vn) return null;
  return SCENES[state.vn.sceneId] ?? null;
}

function policyFromVn(vn: VnState): ProPolicy | null {
  const value = vn.flags.pro_policy;
  return value === 'defer' || value === 'today' ? value : null;
}

function enterSectionCard(state: StoryState, vn: VnState): StoryState {
  const policy = policyFromVn(vn);
  // 序章选"能晚上补的先补"= 把整改风险留到夜里，起手先扣 5 分。
  // 只在这一处结算，后续 startAct / 重试本幕都不会重复扣。
  const totalScore =
    policy === 'defer'
      ? Math.max(0, state.totalScore - PROLOGUE_DEFER_PENALTY)
      : state.totalScore;
  return {
    ...state,
    phase: 'section-card',
    act: 1,
    vn,
    policy,
    totalScore,
  };
}

function withAct(state: StoryState, act1: Act1State, message: string | null): StoryState {
  return {
    ...state,
    act1,
    message,
    phase: act1.actFailed ? 'act-failed' : state.phase === 'act-failed' ? 'act1' : state.phase,
  };
}

/** 幕间只继承总分：重走本幕不设分数上限，失败幕的扣分不会进入总分。 */
function startAct(state: StoryState, act: ActNo): StoryState {
  const fresh = { ...createAct1State(state.seed, act), score: state.totalScore };
  // 分数已在序章收口时扣过，这里只补一条可追溯的扣分明细（结局复盘会用到）。
  if (act === 1 && state.policy === 'defer') {
    fresh.deductions = [
      ...fresh.deductions,
      {
        id: 'prologue-defer',
        label: '序章采纳"能晚上补的先补"，整改风险留到夜间',
        points: PROLOGUE_DEFER_PENALTY,
      },
    ];
  }
  return {
    ...state,
    act,
    act1: fresh,
    phase: 'act1',
    vn: null,
    message: null,
  };
}

/** Dev-only QA fixture: a fully inspected act, every hazard evidenced and closed. */
export function createQaCompletedAct1(seed: number, act: ActNo = 1): Act1State {
  let state = createAct1State(seed, act);
  for (const point of getActPoints(act)) {
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
    const pointState = state.points[point.id];
    const missingActions = point.requiredActions.filter(
      (actionId) => !pointState.completedActions.includes(actionId)
    );
    if (missingActions.length > 0) {
      state = {
        ...state,
        points: {
          ...state.points,
          [point.id]: {
            ...pointState,
            completedActions: [
              ...pointState.completedActions,
              ...missingActions,
            ],
          },
        },
      };
    }
    // 有隐患 → 按读数推导出的标准等级处置并取证；无隐患 → P0 正常记录。
    const grade: Act1Grade = findingNeedsEvidence(point.finding[state.variant])
      ? standardGradeFor(state, point.id)
      : 'P0';
    state = setAct1Disposition(state, point.id, grade).state;
    if (dispositionNeedsEvidence(grade)) {
      state = attachAct1Evidence(state, point.id, `qa-${point.id}`);
    }
  }
  // QA fixtures represent a finished act; chat lines must not block the state guard.
  return { ...state, pendingLines: [] };
}

export function isStoryInputLocked(state: StoryState): boolean {
  return state.phase !== 'act1';
}

export function act1PendingLine(state: StoryState): string | null {
  return state.act1?.pendingLines[0] ?? null;
}

export function storyToSave(
  state: StoryState,
  settings: StorySettings = DEFAULT_SETTINGS,
  now = Date.now()
): SaveV1 {
  return {
    version: 1,
    seed: state.seed,
    phase: state.phase,
    act: state.act,
    policy: state.policy,
    act1: state.act1,
    ending: state.ending,
    unhandledHazards: state.unhandledHazards,
    totalScore: state.totalScore,
    actHistory: state.actHistory,
    evidence: state.evidence,
    settings,
    updatedAt: now,
  };
}

export function storyFromSave(save: SaveV1): StoryState {
  const base = createStoryState(save.seed);
  if (save.phase === 'title') return base;

  if (
    save.phase === 'act1' ||
    save.phase === 'section-card' ||
    save.phase === 'act-failed' ||
    save.phase === 'ending-vn' ||
    save.phase === 'ending-stub'
  ) {
    const rawAct = save.act ?? save.act1?.act;
    const act: ActNo = rawAct === 2 || rawAct === 3 ? rawAct : 1;
    const act1 = save.act1
      ? normalizeAct1State(save.act1, act)
      : save.phase === 'act1'
        ? createAct1State(save.seed, act)
        : null;
    const unhandledHazards = Array.isArray(save.unhandledHazards)
      ? save.unhandledHazards.filter(
          (title): title is string => typeof title === 'string'
        )
      : [];
    const ending = save.ending ?? null;
    const actHistory = Array.isArray(save.actHistory)
      ? save.actHistory.flatMap((entry, index) => {
          if (!entry) return [];
          const entryAct = entry.act === 2 || entry.act === 3 ? entry.act : null;
          const actNo: ActNo = entryAct ?? ((index + 1) as ActNo);
          return [normalizeAct1State(entry, actNo)];
        })
      : [];
    const totalScore =
      typeof save.totalScore === 'number' && Number.isFinite(save.totalScore)
        ? Math.max(0, Math.min(ACT1_SCORE_BASE, save.totalScore))
        : act1
          ? act1.score
          : ACT1_SCORE_BASE;
    return {
      ...base,
      phase: save.phase,
      act,
      policy: save.policy,
      act1,
      ending,
      unhandledHazards,
      totalScore,
      actHistory,
      evidence: save.evidence ?? [],
      vn:
        save.phase === 'ending-vn'
          ? createVnState(endingSceneFor(save.ending ?? 'end', unhandledHazards))
          : null,
    };
  }

  return base;
}

export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'new-game':
      return createStoryState(action.seed);

    case 'resume':
      return storyFromSave(action.save);

    case 'start':
      if (state.phase !== 'title') return state;
      return {
        ...state,
        phase: 'prologue',
        act: 1,
        vn: createVnState(PROLOGUE),
        act1: null,
        ending: null,
        unhandledHazards: [],
        totalScore: ACT1_SCORE_BASE,
        actHistory: [],
        evidence: [],
        policy: null,
        message: null,
      };

    case 'vn-tick': {
      const scene = sceneFor(state);
      if (!state.vn || !scene) return state;
      return { ...state, vn: tickVn(state.vn, scene, action.chars) };
    }

    case 'vn-advance': {
      const scene = sceneFor(state);
      if (!state.vn || !scene) return state;
      const next = advanceVn(state.vn, scene);
      if (next.done) {
        if (state.phase === 'ending-vn') {
          return { ...state, vn: next, phase: 'ending-stub' };
        }
        return enterSectionCard(state, next);
      }
      return { ...state, vn: next, policy: policyFromVn(next) ?? state.policy };
    }

    case 'vn-choose': {
      const scene = sceneFor(state);
      if (!state.vn || !scene) return state;
      const next = chooseVn(state.vn, scene, action.optionIndex);
      if (next === state.vn) return state;
      if (next.done) return enterSectionCard(state, next);
      return { ...state, vn: next, policy: policyFromVn(next) ?? state.policy };
    }

    case 'vn-skip': {
      const scene = sceneFor(state);
      if (!state.vn || !scene) return state;
      const next = skipVn(state.vn, scene);
      if (next.done) {
        if (state.phase === 'ending-vn') {
          return { ...state, vn: next, phase: 'ending-stub' };
        }
        return enterSectionCard(state, next);
      }
      return { ...state, vn: next, policy: policyFromVn(next) ?? state.policy };
    }

    case 'vn-auto': {
      if (!state.vn) return state;
      return { ...state, vn: setVnAuto(state.vn, action.on) };
    }

    case 'vn-fast': {
      if (!state.vn) return state;
      return { ...state, vn: setVnFast(state.vn, action.on) };
    }

    case 'section-done': {
      if (state.phase !== 'section-card') return state;
      return startAct(state, state.act);
    }

    case 'act1-action': {
      if (state.phase !== 'act1' || !state.act1) return state;
      const outcome = applyAct1Action(
        state.act1,
        action.pointId,
        action.tool,
        action.actionId
      );
      return withAct(state, outcome.state, outcome.result.text);
    }

    case 'act1-disposition': {
      if (state.phase !== 'act1' || !state.act1) return state;
      const outcome = setAct1Disposition(state.act1, action.pointId, action.grade);
      return withAct(state, outcome.state, outcome.message);
    }

    case 'act1-evidence': {
      if (state.phase !== 'act1' || !state.act1) return state;
      const nextAct = attachAct1Evidence(
        state.act1,
        action.evidence.pointId as Act1PointId,
        action.evidence.id
      );
      return {
        ...state,
        act1: nextAct,
        evidence: trimEvidence([...state.evidence, action.evidence]),
        message: '现场证据已记录。',
      };
    }

    case 'act1-penalty': {
      if (state.phase !== 'act1' || !state.act1) return state;
      const nextAct = applyAct1Penalty(
        state.act1,
        action.id,
        action.label,
        action.points,
        action.chanceCost ?? 0
      );
      return withAct(state, nextAct, action.message);
    }

    case 'queue-lines': {
      if (!state.act1) return state;
      return { ...state, act1: queueAct1Lines(state.act1, action.lines) };
    }

    case 'act1-shock': {
      if (state.phase !== 'act1' || !state.act1) return state;
      return withAct(state, failAct1ByShock(state.act1, action.zoneLabel), null);
    }

    case 'act-complete': {
      if (state.phase !== 'act1' || !state.act1) return state;
      if (!isActComplete(state.act1) || state.act1.pendingLines.length > 0) {
        return state;
      }
      // 处置正确性在此统一结算：多处置 / 过当 / 不到位在这里扣分。
      const closedAct1 = settleActDispositions(state.act1);
      const outcome = evaluateActOutcome(closedAct1);
      const unhandledHazards = [...state.unhandledHazards, ...outcome.unhandled];
      const totalScore = closedAct1.score;
      const actHistory = [...state.actHistory, closedAct1];
      if (state.act < 3) {
        return {
          ...state,
          act: (state.act + 1) as ActNo,
          phase: 'section-card',
          act1: null,
          unhandledHazards,
          totalScore,
          actHistory,
          vn: null,
          message: null,
        };
      }
      const ending = endingForRun(totalScore, unhandledHazards);
      return {
        ...state,
        phase: 'ending-vn',
        ending,
        unhandledHazards,
        totalScore,
        actHistory,
        vn: createVnState(endingSceneFor(ending, unhandledHazards)),
        message: null,
      };
    }

    case 'act1-consume-line': {
      if (!state.act1) return state;
      const next = consumeAct1Line(state.act1);
      return { ...state, act1: next.state };
    }

    case 'retry-act': {
      return startAct(state, state.act);
    }

    case 'qa-act1': {
      const seed = action.seed ?? state.seed;
      const act = action.act ?? 1;
      const base = createStoryState(seed);
      return {
        ...base,
        act,
        phase: 'act1',
        policy: action.policy ?? 'today',
        act1: action.done
          ? createQaCompletedAct1(seed, act)
          : createAct1State(seed, act),
      };
    }

    case 'qa-ending': {
      const seed = action.seed ?? state.seed;
      const ending = action.ending;
      const unhandledHazards = action.unhandledHazards ?? [];
      const totalScore = action.score ?? ACT1_SCORE_BASE;
      return {
        ...createStoryState(seed),
        phase: 'ending-vn',
        act: 3,
        ending,
        unhandledHazards,
        totalScore,
        actHistory: ([1, 2, 3] as ActNo[]).map((act) =>
          createQaCompletedAct1(seed, act)
        ),
        vn: createVnState(endingSceneFor(ending, unhandledHazards)),
      };
    }

    case 'reset':
      return createStoryState(state.seed);

    case 'message':
      return { ...state, message: action.text };

    default:
      return state;
  }
}

/** Player-facing strings that must not mention tools. */
export function act1AuditEntries(act1Title: string, scope: string, known: string) {
  return [
    { id: 'act1-title', text: act1Title },
    { id: 'act1-scope', text: scope },
    { id: 'act1-known', text: known },
    ...ACT_POINTS[1].map((p) => ({ id: `point-${p.id}`, text: `${p.name} ${p.clue}` })),
  ];
}

export { ACT_SECTION_CARDS, getActPointIds };
