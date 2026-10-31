import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldLockGamePointer } from './pointerLock';

test('只有游玩且没有 UI 覆盖层时才锁定鼠标', () => {
  assert.equal(shouldLockGamePointer('playing', false, false), true);
  assert.equal(shouldLockGamePointer('playing', true, false), false);
  assert.equal(shouldLockGamePointer('playing', false, true), false);
  assert.equal(shouldLockGamePointer('title', false, false), false);
});
