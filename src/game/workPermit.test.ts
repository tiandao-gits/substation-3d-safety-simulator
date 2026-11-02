import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACT2_CREW_LINEUP_POSITIONS,
  createInitialPermitVerification,
  generateWorkPermitRoster,
} from './workPermit';

test('ACT2_CREW_LINEUP_POSITIONS separates all 4 crew workers cleanly with no overlapping coordinates', () => {
  const coords = Object.values(ACT2_CREW_LINEUP_POSITIONS);
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = Math.hypot(coords[i].x - coords[j].x, coords[i].z - coords[j].z);
      assert.ok(
        dist >= 0.8,
        `Expected crew positions ${i} and ${j} to be at least 0.8m apart, got ${dist}`
      );
    }
  }
});

test('generateWorkPermitRoster never generates safety helmet defects across all seeds, variants, and sample offsets', () => {
  const variants = ['A', 'B', 'C', 'D'] as const;
  for (let seed = 1; seed <= 40; seed++) {
    for (const variant of variants) {
      for (let offset = 0; offset <= 6; offset++) {
        const roster = generateWorkPermitRoster(seed, variant, offset);
        assert.equal(roster.leader.helmetStatus, 'standard');
        for (const worker of roster.workers) {
          assert.equal(
            worker.helmetStatus,
            'standard',
            `Worker ${worker.nodeName} must always have standard helmetStatus`
          );
        }
      }
    }
  }
});

test('generateWorkPermitRoster matches main story variant D vs normal variants at sampleOffset 0', () => {
  const normalRoster = generateWorkPermitRoster(1024, 'A', 0);
  assert.equal(normalRoster.hasDefect, false);
  assert.equal(normalRoster.headcountMatched, true);
  assert.equal(normalRoster.permitTotalCount, normalRoster.actualSiteCount);
  assert.equal(normalRoster.workers[2].certExpiry, '2027-09');
  assert.equal(normalRoster.workers[2].badgeStatus, 'valid');

  const defectRoster = generateWorkPermitRoster(1024, 'D', 0);
  assert.equal(defectRoster.hasDefect, true);
  assert.equal(defectRoster.workers[2].certExpiry, '2025-06');
  assert.equal(defectRoster.workers[2].badgeStatus, 'expired');
  assert.equal(defectRoster.workers[1].uniformStatus, 'irregular');
});

test('generateWorkPermitRoster supports headcount mismatch and missing badge visual defects in drill offsets', () => {
  const mismatchRoster = generateWorkPermitRoster(2026, 'A', 1); // sampleOffset=1 => defectMode=2
  assert.equal(mismatchRoster.headcountMatched, false);
  assert.equal(mismatchRoster.permitTotalCount, 4);
  assert.equal(mismatchRoster.actualSiteCount, 5);
  const fourth = mismatchRoster.workers[3];
  assert.equal(fourth.listedOnPermit, false);
  assert.equal(fourth.presentOnSite, true);
  assert.equal(fourth.badgeStatus, 'missing');
  assert.equal(fourth.uniformStatus, 'irregular');

  const initVer = createInitialPermitVerification(mismatchRoster);
  assert.equal(initVer.headcountChecked, false);
  assert.ok(initVer.workers['MEMBER_02']);
  assert.ok(initVer.workers['MEMBER_01.004']);
});
