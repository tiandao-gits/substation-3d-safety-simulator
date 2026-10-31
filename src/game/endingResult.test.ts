import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDING_ACCIDENTS,
  pickEndingAccident,
} from './endingResult';

test('ending accident is deterministic for a run', () => {
  const missed = ['基坑无临边防护，坑内积水、无支护、无上下通道'];
  const first = pickEndingAccident(20261030, missed);
  const second = pickEndingAccident(20261030, missed);
  assert.deepEqual(first, second);
  assert.ok(ENDING_ACCIDENTS.includes(first));
});

test('ending accident is randomly drawn from the full pool', () => {
  assert.ok(
    ENDING_ACCIDENTS.includes(pickEndingAccident(1, []))
  );
  assert.ok(
    ENDING_ACCIDENTS.includes(
      pickEndingAccident(2, ['临时配电箱漏保失效'])
    )
  );
});
