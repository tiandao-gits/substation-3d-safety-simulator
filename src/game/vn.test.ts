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
