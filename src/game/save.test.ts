import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countResolvedPoints,
  createAct1State,
  isActComplete,
} from './act1';
import { SAVE_KEY, loadSave } from './save';
import { settlementScoreForStory, storyFromSave } from './storySession';

function legacyStore(payload: unknown): Storage {
  const raw = JSON.stringify(payload);
  return {
    getItem: (key: string) => (key === SAVE_KEY ? raw : null),
  } as unknown as Storage;
}

test('a legacy save without act/ending/unhandledHazards resumes at act 1', () => {
  const act1 = { ...createAct1State(123) } as Record<string, unknown>;
  delete act1.act;
  const parsed = loadSave(
    legacyStore({
      version: 1,
      seed: 123,
      phase: 'act1',
      policy: 'today',
      act1,
      review: { decisions: {} },
      evidence: [],
      settings: { textSpeedMs: 32, autoDelayMs: 1200 },
      updatedAt: 1730000000000,
    })
  );

  assert.ok(parsed);
  assert.equal(parsed.act, 1);
  assert.equal(parsed.ending, null);
  assert.deepEqual(parsed.unhandledHazards, []);
  assert.equal(parsed.totalScore, 100);
  assert.equal('review' in parsed, false);

  const resumed = storyFromSave(parsed);
  assert.equal(resumed.phase, 'act1');
  assert.equal(resumed.act, 1);
  assert.equal(Object.keys(resumed.act1?.points ?? {}).length, 3);
  assert.equal(countResolvedPoints(resumed.act1!), 0);
  assert.equal(isActComplete(resumed.act1!), false);
});

test('an old save with obsolete checkpoint ids is normalized to the current act', () => {
  const parsed = loadSave(
    legacyStore({
      version: 1,
      seed: 321,
      phase: 'act1',
      act1: {
        seed: 321,
        variant: 'B',
        points: {
          'old-point': { id: 'old-point', completedActions: ['visual'], readings: [] },
        },
        reviewChances: 4,
        score: 88,
        deductions: [],
        pendingLines: [],
        seenLines: [],
        actFailed: false,
      },
      evidence: [],
      settings: { textSpeedMs: 32, autoDelayMs: 1200 },
      updatedAt: 1730000000001,
    })
  );
  assert.ok(parsed);
  const resumed = storyFromSave(parsed);
  assert.equal(resumed.act, 1);
  assert.deepEqual(Object.keys(resumed.act1?.points ?? {}).sort(), [
    'aisle',
    'bay-temp',
    'hv-10kv',
  ]);
  assert.equal(countResolvedPoints(resumed.act1!), 0);
  assert.equal(resumed.act1?.variant, 'B');
  assert.equal(resumed.act1?.score, 88);
});

test('a legacy END save migrates the missed hazard list into the settlement', () => {
  const parsed = loadSave(
    legacyStore({
      version: 1,
      seed: 123,
      phase: 'ending-stub',
      act: 3,
      policy: 'today',
      act1: createAct1State(123, 3),
      ending: 'end',
      missedUrgent: ['基坑无临边防护'],
      evidence: [],
      settings: { textSpeedMs: 32, autoDelayMs: 1200 },
      updatedAt: 1730000000003,
    })
  );
  assert.ok(parsed);
  const resumed = storyFromSave(parsed);
  assert.equal(resumed.phase, 'ending-stub');
  assert.deepEqual(resumed.unhandledHazards, ['基坑无临边防护']);
  assert.equal(resumed.totalScore, 100);
  assert.equal(
    settlementScoreForStory(resumed),
    75,
    'legacy missed hazards still cost 25 points each'
  );
});
