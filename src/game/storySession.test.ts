import test from 'node:test';
import assert from 'node:assert/strict';
import { createAct1State, ACT1_SCORE_BASE } from './act1';
import { PROLOGUE } from '../config/dialogues';
import {
  act1PendingLine,
  createStoryState,
  createQaCompletedAct1,
  endingForRun,
  isStoryInputLocked,
  PROLOGUE_DEFER_PENALTY,
  settlementScore,
  settlementScoreForStory,
  storyFromSave,
  storyReducer,
  storyToSave,
  type StoryState,
} from './storySession';

const SEED = 20261030;

/** Each line needs one advance to finish the typewriter and one to move on. */
const STEP_LIMIT = 400;

function entryAt(s: StoryState) {
  return PROLOGUE.lines[s.vn?.index ?? -1];
}

/** Walks the prologue to the mandatory choice. */
function toChoice(): StoryState {
  let s = storyReducer(createStoryState(SEED), { type: 'new-game', seed: SEED });
  s = storyReducer(s, { type: 'start' });
  for (let i = 0; i < STEP_LIMIT; i += 1) {
    const entry = entryAt(s);
    if (entry && 'options' in entry) return s;
    s = storyReducer(s, { type: 'vn-advance' });
  }
  throw new Error('the prologue never reached CHO-PRO-01');
}

function choosePolicy(policy: 'defer' | 'today'): StoryState {
  let s = toChoice();
  const choice = entryAt(s) as { options: { flag: string }[] };
  const optionIndex = choice.options.findIndex((o) => o.flag.endsWith(policy));
  s = storyReducer(s, { type: 'vn-choose', optionIndex });
  for (let i = 0; i < STEP_LIMIT && s.phase === 'prologue'; i += 1) {
    s = storyReducer(s, { type: 'vn-advance' });
  }
  return s;
}

test('the flow runs title → prologue → section card → act 1', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'new-game', seed: SEED });
  assert.equal(s.phase, 'title');
  assert.equal(isStoryInputLocked(s), true);

  s = storyReducer(s, { type: 'start' });
  assert.equal(s.phase, 'prologue');
  assert.equal(s.vn?.sceneId, PROLOGUE.id);

  s = choosePolicy('today');
  assert.equal(s.phase, 'section-card');
  assert.equal(s.policy, 'today');

  s = storyReducer(s, { type: 'section-done' });
  assert.equal(s.phase, 'act1');
  assert.ok(s.act1, 'act 1 state is created when the act opens');
  assert.equal(isStoryInputLocked(s), false);
});

test('序章选"能晚上补的先补"起手扣 5 分，选当天闭环不扣', () => {
  const defer = choosePolicy('defer');
  assert.equal(defer.phase, 'section-card');
  assert.equal(defer.totalScore, ACT1_SCORE_BASE - PROLOGUE_DEFER_PENALTY);

  const today = choosePolicy('today');
  assert.equal(today.phase, 'section-card');
  assert.equal(today.totalScore, ACT1_SCORE_BASE);
});

test('序章扣分只结算一次，第一幕重试不会重复扣', () => {
  let s = choosePolicy('defer');
  s = storyReducer(s, { type: 'section-done' });
  assert.equal(s.act1?.score, ACT1_SCORE_BASE - PROLOGUE_DEFER_PENALTY);
  assert.ok(
    s.act1?.deductions.some((item) => item.id === 'prologue-defer'),
    '第一幕应带上序章扣分明细'
  );

  const retried = storyReducer(s, { type: 'retry-act' });
  assert.equal(
    retried.act1?.score,
    ACT1_SCORE_BASE - PROLOGUE_DEFER_PENALTY,
    '重试本幕不能二次扣分'
  );
});

test('the prologue choice is mandatory and skip never answers it', () => {  let s = toChoice();
  assert.equal(s.policy, null);
  const before = s.vn?.index;
  s = storyReducer(s, { type: 'vn-skip' });
  assert.equal(s.vn?.index, before, 'skip parks on the choice');
  assert.equal(s.phase, 'prologue');
  assert.equal(s.policy, null);

  s = storyReducer(s, { type: 'vn-choose', optionIndex: 0 });
  assert.equal(s.policy, 'defer');
});

test('an act completing moves straight to the next act section card', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, policy: 'today' });
  assert.equal(s.phase, 'act1');
  assert.equal(s.act, 1);

  s = { ...s, act1: createQaCompletedAct1(SEED, 1) };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.phase, 'section-card');
  assert.equal(s.act, 2);
  assert.equal(s.act1, null, 'no report/review UI between acts');

  s = storyReducer(s, { type: 'section-done' });
  assert.equal(s.phase, 'act1');
  assert.equal(s.act, 2);
  assert.equal(Object.keys(s.act1?.points ?? {}).length, 3);
});

test('three completed acts land on GOOD', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED });
  for (const actNo of [1, 2, 3] as const) {
    s = { ...s, phase: 'act1', act: actNo, act1: createQaCompletedAct1(SEED, actNo) };
    s = storyReducer(s, { type: 'act-complete' });
  }
  assert.equal(s.phase, 'ending-vn');
  assert.equal(s.ending, 'good');
  assert.equal(s.vn?.sceneId, 'ending-good');
  assert.deepEqual(s.unhandledHazards, []);
  assert.equal(s.totalScore, 100);
});

test('a discovered hazard recorded as P0 forces the accident ending', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, act: 3 });
  let act3 = createQaCompletedAct1(SEED, 3);
  for (const id of Object.keys(act3.points) as Array<keyof typeof act3.points>) {
    // 全部按“正常记录”闭环：隐患漏闭环，结局必然按事故责任判 BAD。
    act3 = {
      ...act3,
      points: {
        ...act3.points,
        [id]: { ...act3.points[id], disposition: 'P0', evidenceId: undefined },
      },
    };
  }
  s = { ...s, act1: act3 };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.phase, 'ending-vn');
  assert.equal(s.ending, 'end');
  assert.equal(s.vn?.sceneId, 'ending-end');
  assert.equal(s.unhandledHazards.length, 3, 'all three act-3 hazards are open');
  assert.equal(s.totalScore, 100);
  assert.equal(
    settlementScoreForStory(s),
    25,
    'each unclosed hazard costs 25 points'
  );
});

test('settlement rules: unclosed hazards force BAD; 80 is the delay threshold', () => {
  assert.equal(settlementScore(100, []), 100);
  assert.equal(settlementScore(100, ['基坑']), 75);
  assert.equal(settlementScore(100, ['基坑', '配电箱']), 50);
  assert.equal(settlementScore(0, ['基坑']), 0);
  assert.equal(endingForRun(100, ['基坑']), 'end', '任何未闭环隐患都按事故责任判负');
  assert.equal(endingForRun(80, []), 'good');
  assert.equal(endingForRun(79, []), 'end', '低于 80 分判延误工期责任');
});

test('the score carries across acts and never resets per act', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED });
  s = { ...s, act1: { ...createQaCompletedAct1(SEED, 1), score: 90 } };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.totalScore, 90);
  s = storyReducer(s, { type: 'section-done' });
  assert.equal(s.act1?.score, 90, 'act 2 starts from the carried total');

  s = { ...s, act1: { ...createQaCompletedAct1(SEED, 2), score: 80 } };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.totalScore, 80);
  s = storyReducer(s, { type: 'section-done' });
  assert.equal(s.act1?.score, 80, 'act 3 starts from the carried total');
  assert.deepEqual(
    s.act1?.pendingLines,
    ['A3-OPEN-1'],
    '第三幕从幕间卡片进入时自动入队午觉起床自白剧情'
  );
  const retriedAct3 = storyReducer(s, { type: 'retry-act' });
  assert.deepEqual(
    retriedAct3.act1?.pendingLines,
    [],
    '重来第三幕不重播开场 CG 与自白'
  );

  s = { ...s, act1: { ...createQaCompletedAct1(SEED, 3), score: 80 } };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.ending, 'good');
  assert.equal(s.totalScore, 80);
  assert.equal(settlementScoreForStory(s), 80);
});

test('all hazards closed but the total below 80 ends on the delay scene', () => {
  let s = storyReducer(createStoryState(SEED), {
    type: 'qa-act1',
    seed: SEED,
    act: 3,
  });
  s = {
    ...s,
    act1: { ...createQaCompletedAct1(SEED, 3), score: 79 },
  };
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.phase, 'ending-vn');
  assert.equal(s.ending, 'end');
  assert.equal(s.vn?.sceneId, 'ending-delay');
  assert.deepEqual(s.unhandledHazards, []);
  assert.equal(s.totalScore, 79);
});

test('a drone violation costs a chance and fails the act when chances run out', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, act: 3 });
  for (let i = 0; i < 4; i += 1) {
    s = storyReducer(s, {
      type: 'act1-penalty',
      id: `drone-${i}`,
      label: '无人机飞越运行间隔',
      points: 8,
      chanceCost: 1,
      message: '违规',
    });
  }
  assert.equal(s.act1?.reviewChances, 0);
  assert.equal(s.act1?.score, 68);
  assert.equal(s.phase, 'act-failed');
});

test('a failed act retries the same act without a score cap', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, act: 2 });
  s = { ...s, act1: { ...createAct1State(SEED, 2), score: 68, reviewChances: 0, actFailed: true } };
  s = storyReducer(s, { type: 'retry-act' });
  assert.equal(s.phase, 'act1');
  assert.equal(s.act, 2);
  assert.equal(s.act1?.actFailed, false);
  assert.equal(s.act1?.reviewChances, 4);
  assert.equal(s.act1?.score, 100, '重走不设 85 分上限，失败幕的扣分不计入总分');
  assert.equal(Object.keys(s.act1?.points ?? {}).length, 3);
});

test('act 1 lines surface one at a time and are consumed in order', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED });
  s = { ...s, act1: { ...createAct1State(SEED), pendingLines: ['第一句', '第二句'] } };
  assert.equal(act1PendingLine(s), '第一句');
  s = storyReducer(s, { type: 'act1-consume-line' });
  assert.equal(act1PendingLine(s), '第二句');
  s = storyReducer(s, { type: 'act1-consume-line' });
  assert.equal(act1PendingLine(s), null);
});

test('the save keeps the policy, act and ending', () => {
  const played = choosePolicy('today');
  const save = storyToSave(played, undefined, 1730000000000);
  assert.equal(save.policy, 'today');
  assert.equal(save.phase, 'section-card');

  const resumed = storyFromSave(save);
  assert.equal(resumed.phase, 'section-card', 'the prologue is not replayed once the policy is set');
  assert.equal(resumed.policy, 'today');
  assert.equal(resumed.act, 1);

  const inAct2 = { ...played, phase: 'act1' as const, act: 2 as const, act1: createAct1State(SEED, 2) };
  const saved2 = storyToSave(inAct2, undefined, 1730000000001);
  assert.equal(saved2.act, 2);
  const resumed2 = storyFromSave(saved2);
  assert.equal(resumed2.act, 2);
  assert.equal(Object.keys(resumed2.act1?.points ?? {}).length, 3);

  const ended = {
    ...played,
    phase: 'ending-stub' as const,
    ending: 'good' as const,
    unhandledHazards: [],
    totalScore: 90,
  };
  const resumedEnd = storyFromSave(storyToSave(ended, undefined, 1730000000002));
  assert.equal(resumedEnd.phase, 'ending-stub');
  assert.equal(resumedEnd.ending, 'good');
  assert.deepEqual(resumedEnd.unhandledHazards, []);
  assert.equal(resumedEnd.totalScore, 90);
});

test('act completion waits until pending chat lines are consumed', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED });
  s = {
    ...s,
    act1: { ...createQaCompletedAct1(SEED, 1), pendingLines: [] },
  };
  s = storyReducer(s, { type: 'queue-lines', lines: ['TEST-CHAT'] });
  assert.equal(s.act1?.pendingLines.length, 1);

  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.phase, 'act1', 'chat still pending');
  assert.equal(s.act, 1);

  s = storyReducer(s, { type: 'act1-consume-line' });
  s = storyReducer(s, { type: 'act-complete' });
  assert.equal(s.phase, 'section-card');
  assert.equal(s.act, 2);
});

test('越线触电按事故失败，重玩后状态复位', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, act: 2 });
  s = storyReducer(s, { type: 'act1-shock', zoneLabel: '220kV F02 运行间隔' });
  assert.equal(s.phase, 'act-failed');
  assert.equal(s.act1?.actFailed, true);
  assert.equal(s.act1?.failReason, 'shock');
  assert.equal(s.act1?.failDetail, '220kV F02 运行间隔');

  s = storyReducer(s, { type: 'retry-act' });
  assert.equal(s.phase, 'act1');
  assert.equal(s.act1?.actFailed, false);
  assert.equal(s.act1?.failReason, null);
  assert.equal(s.act1?.failDetail, null);
});

test('触电事故在存档往返后仍是触电事故', () => {
  let s = storyReducer(createStoryState(SEED), { type: 'qa-act1', seed: SEED, act: 1 });
  s = storyReducer(s, { type: 'act1-shock', zoneLabel: '#2 主变（运行）' });
  const restored = storyFromSave(storyToSave(s));
  assert.equal(restored.phase, 'act-failed');
  assert.equal(restored.act1?.failReason, 'shock');
  assert.equal(restored.act1?.failDetail, '#2 主变（运行）');

  const legacy = storyFromSave({
    ...storyToSave(s),
    act1: { ...createAct1State(SEED, 1), actFailed: true },
  });
  assert.equal(legacy.act1?.failReason, 'chances', '旧存档按检查机会耗尽处理');
});
