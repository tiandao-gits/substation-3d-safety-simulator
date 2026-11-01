import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceVn,
  canSkipScene,
  chooseVn,
  createVnState,
  currentChoice,
  currentLine,
  isLineFullyRevealed,
  sceneCastMembers,
  setVnAuto,
  skipVn,
  tickVn,
  VN_HISTORY_LIMIT,
  type VnScene,
} from './vn';

function scene(skippable = false): VnScene {
  return {
    id: 'test',
    bg: 'bg-test',
    skippable,
    lines: [
      { id: 'L1', speakerId: 'chen', text: '第一行。' },
      { id: 'L2', speakerId: 'wang', text: '第二行。' },
      {
        id: 'CHO',
        prompt: '怎么收口？',
        options: [
          { text: '今晚补', nextLineId: 'L3a', flag: 'pro_policy=defer' },
          { text: '今天闭环', nextLineId: 'L3b', flag: 'pro_policy=today' },
        ],
      },
      { id: 'L3a', speakerId: 'luchuan', text: '行，晚上补。', next: 'L4' },
      { id: 'L3b', speakerId: 'luchuan', text: '今天改完。', next: 'L4' },
      { id: 'L4', speakerId: 'chen', text: '记下来。' },
    ],
  };
}

test('advance completes the current line before moving on', () => {
  let s = createVnState(scene());
  assert.equal(currentLine(s, scene())?.id, 'L1');
  s = tickVn(s, scene(), 1);
  assert.equal(isLineFullyRevealed(s, scene()), false);
  s = advanceVn(s, scene());
  assert.equal(s.revealed, '第一行。'.length);
  assert.equal(currentLine(s, scene())?.id, 'L1');
  s = advanceVn(s, scene());
  assert.equal(currentLine(s, scene())?.id, 'L2');
  assert.equal(s.history.at(-1)?.id, 'L1');
});

test('choice blocks advance and skip, and choosing writes the policy flag', () => {
  let s = createVnState(scene());
  s = advanceVn(advanceVn(s, scene()), scene()); // L1 complete, move L2
  s = advanceVn(advanceVn(s, scene()), scene()); // L2 complete, move choice
  assert.equal(currentChoice(s, scene())?.id, 'CHO');
  const blocked = advanceVn(s, scene());
  assert.equal(blocked.index, s.index);
  const skipped = skipVn(s, scene());
  assert.equal(skipped.index, s.index);

  s = chooseVn(s, scene(), 0);
  assert.equal(s.flags.pro_policy, 'defer');
  assert.equal(currentLine(s, scene())?.id, 'L3a');
  s = advanceVn(advanceVn(s, scene()), scene());
  assert.equal(currentLine(s, scene())?.id, 'L4', 'explicit next skips the other branch');
});

test('skip stops at the choice and never answers it', () => {
  const s = skipVn(createVnState(scene(true)), scene(true));
  assert.equal(currentChoice(s, scene(true))?.id, 'CHO');
  assert.equal(canSkipScene(scene(true)), true);
  assert.equal(canSkipScene(scene(false)), false);
});

test('history is capped at 30 entries and auto/fast are toggles', () => {
  const long: VnScene = {
    id: 'long',
    bg: 'bg',
    lines: Array.from({ length: 40 }, (_, i) => ({
      id: `L${i}`,
      speakerId: 'chen',
      text: `第 ${i} 行`,
    })),
  };
  let s = createVnState(long);
  for (let i = 0; i < 35; i += 1) s = advanceVn(advanceVn(s, long), long);
  assert.ok(s.history.length <= VN_HISTORY_LIMIT);
  s = setVnAuto(s, true);
  assert.equal(s.auto, true);
});

test('立绘阵容是本场固定名单，从第一帧全员在场', () => {
  const castScene: VnScene = {
    id: 'cast',
    bg: 'bg',
    cast: [
      { charId: 'wang', pose: 'normal', slot: 'left' },
      { charId: 'chen', pose: 'normal', slot: 'center' },
      { charId: 'zhao', pose: 'normal', slot: 'right' },
    ],
    lines: [
      { id: 'C1', speakerId: 'chen', text: '先布置任务。' },
      { id: 'C2', speakerId: 'wang', text: '北区在回填。' },
      { id: 'C3', speakerId: 'zhao', text: '我两头跑。' },
    ],
  };
  // 第一行只轮到陈立群说话，但三个槽位都要有人 —— 没开口的人靠隐退态区分。
  let s = createVnState(castScene);
  assert.deepEqual(
    sceneCastMembers(castScene, currentLine(s, castScene)?.speakerId ?? null).map(
      (m) => m.charId
    ),
    ['wang', 'chen', 'zhao']
  );

  s = advanceVn(advanceVn(s, castScene), castScene);
  assert.equal(currentLine(s, castScene)?.speakerId, 'wang');
  assert.deepEqual(
    sceneCastMembers(castScene, currentLine(s, castScene)?.speakerId ?? null).map(
      (m) => m.charId
    ),
    ['wang', 'chen', 'zhao']
  );

  // 没有 cast 的场景退化为单人构图，只画当前说话人。
  const soloScene: VnScene = {
    id: 'solo',
    bg: 'bg',
    lines: [{ id: 'S1', speakerId: 'chen', text: '记录呢？' }],
  };
  assert.deepEqual(
    sceneCastMembers(soloScene, 'chen').map((m) => m.charId),
    ['chen']
  );
  assert.deepEqual(sceneCastMembers(soloScene, null), []);

  // 名单外的角色（电话里的周敏、第一人称陆川）不占槽位。
  const phoneScene: VnScene = {
    id: 'phone',
    bg: 'bg',
    cast: [{ charId: 'chen', pose: 'normal', slot: 'center' }],
    lines: [
      { id: 'P1', speakerId: 'chen', text: '记录呢？' },
      { id: 'P2', speakerId: 'zhou', channel: 'phone', text: '我补不了。' },
    ],
  };
  const p = advanceVn(advanceVn(createVnState(phoneScene), phoneScene), phoneScene);
  assert.equal(currentLine(p, phoneScene)?.speakerId, 'zhou');
  assert.deepEqual(
    sceneCastMembers(phoneScene, currentLine(p, phoneScene)?.speakerId ?? null).map(
      (m) => m.charId
    ),
    ['chen']
  );
});

