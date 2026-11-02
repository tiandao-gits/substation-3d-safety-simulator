import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACT2_CREW_LINEUP_POSITIONS,
  createInitialPermitJudgment,
  evaluateWorkPermitJudgment,
  generateWorkPermitRoster,
} from './workPermit';

test('ACT2_CREW_LINEUP_POSITIONS separates all 5 lineup positions cleanly with no overlapping coordinates', () => {
  const coords = Object.values(ACT2_CREW_LINEUP_POSITIONS);
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = Math.hypot(
        coords[i].x - coords[j].x,
        coords[i].z - coords[j].z
      );
      assert.ok(
        dist >= 0.75,
        `Expected crew positions ${i} and ${j} to be at least 0.75m apart, got ${dist}`
      );
    }
  }
});

test('generateWorkPermitRoster never generates safety helmet defects across all seeds and variants', () => {
  const variants = ['A', 'B', 'C', 'D'] as const;
  for (let seed = 1; seed <= 40; seed++) {
    for (const variant of variants) {
      const roster = generateWorkPermitRoster(seed, variant);
      assert.equal(roster.leader.helmetStatus, 'standard');
      for (const worker of roster.workers) {
        assert.equal(
          worker.helmetStatus,
          'standard',
          `Worker ${worker.nodeName} must always have standard helmetStatus`
        );
      }
      for (let i = 0; i < roster.sceneWorkers.length; i++) {
        for (let j = i + 1; j < roster.sceneWorkers.length; j++) {
          const d = Math.hypot(
            roster.sceneWorkers[i].act2Position.x -
              roster.sceneWorkers[j].act2Position.x,
            roster.sceneWorkers[i].act2Position.z -
              roster.sceneWorkers[j].act2Position.z
          );
          assert.ok(d >= 0.75, `Scene workers ${i} and ${j} must not overlap`);
        }
      }
    }
  }
});

test('generateWorkPermitRoster matches main story variant D vs normal variants', () => {
  const normalRoster = generateWorkPermitRoster(1024, 'A');
  assert.equal(normalRoster.hasDefect, false);
  assert.equal(normalRoster.headcountMatched, true);
  assert.equal(normalRoster.permitTotalCount, normalRoster.actualSiteCount);
  assert.equal(normalRoster.sceneWorkers.length, normalRoster.actualSiteCount);
  assert.equal(normalRoster.workers[2].certExpiry, '2027-09');
  assert.equal(normalRoster.workers[2].badgeStatus, 'valid');

  const defectRoster = generateWorkPermitRoster(1024, 'D');
  assert.equal(defectRoster.hasDefect, true);
  assert.equal(defectRoster.hasBadgeDefect, true);
  assert.equal(defectRoster.hasUniformDefect, true);
  assert.equal(defectRoster.workers[2].certExpiry, '2025-06');
  assert.equal(defectRoster.workers[2].badgeStatus, 'expired');
  assert.equal(defectRoster.workers[1].uniformStatus, 'irregular');
});

test('evaluateWorkPermitJudgment validates player visual inspection answers against 3D roster truth', () => {
  const defectRoster = generateWorkPermitRoster(1024, 'D');
  const emptyJudgment = createInitialPermitJudgment();
  assert.equal(evaluateWorkPermitJudgment(defectRoster, emptyJudgment).complete, false);

  const wrongJudgment = {
    countedSiteTotal: 5,
    headcountVerdict: 'matched' as const,
    badgeVerdict: 'all_valid' as const,
    uniformVerdict: 'all_standard' as const,
    helmetVerdict: 'all_standard' as const,
  };
  const wrongEval = evaluateWorkPermitJudgment(defectRoster, wrongJudgment);
  assert.equal(wrongEval.complete, true);
  assert.equal(wrongEval.accurate, false);
  assert.equal(wrongEval.mismatches.length, 2);

  const rightJudgment = {
    countedSiteTotal: defectRoster.actualSiteCount,
    headcountVerdict: 'matched' as const,
    badgeVerdict: 'has_invalid' as const,
    uniformVerdict: 'has_irregular' as const,
    helmetVerdict: 'all_standard' as const,
  };
  const rightEval = evaluateWorkPermitJudgment(defectRoster, rightJudgment);
  assert.equal(rightEval.complete, true);
  assert.equal(rightEval.accurate, true);
  assert.equal(rightEval.mismatches.length, 0);
});
