import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACT2_CREW_LINEUP_POSITIONS,
  createInitialPermitJudgment,
  evaluateWorkPermitJudgment,
  generateWorkPermitRoster,
  getCrewExpectedViolation,
  getPermitListedMembers,
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
  assert.equal(defectRoster.workers[2].certExpiry, '2025-06');
  assert.equal(defectRoster.workers[2].badgeStatus, 'expired');
  // 工装不再是名册核验项，3D 现场全员统一标准工装色。
  assert.equal(
    defectRoster.sceneWorkers.every(
      (w) => w.uniformColorHex === 0x1d4ed8 || w.slotIndex === 0
    ),
    true
  );
});

test('evaluateWorkPermitJudgment validates per-crew roster verdicts against 3D roster truth', () => {
  const defectRoster = generateWorkPermitRoster(1024, 'D');
  const emptyJudgment = createInitialPermitJudgment(defectRoster);
  const emptyEval = evaluateWorkPermitJudgment(defectRoster, emptyJudgment);
  assert.equal(emptyEval.complete, false);

  // 全部打勾：漏判超期证件，必须被判为不准确。
  const allPassEntries = Object.fromEntries(
    getPermitListedMembers(defectRoster).map((m) => [
      m.nodeName,
      { passed: true, violation: null },
    ])
  );
  const wrongEval = evaluateWorkPermitJudgment(defectRoster, {
    entries: allPassEntries,
  });
  assert.equal(wrongEval.complete, true);
  assert.equal(wrongEval.accurate, false);
  assert.equal(wrongEval.mismatches.length, 1);

  // 打叉但不选违规类型：仍可签注，但按错项计。
  const missingKind = evaluateWorkPermitJudgment(defectRoster, {
    entries: {
      ...allPassEntries,
      [defectRoster.workers[2].nodeName]: { passed: false, violation: null },
    },
  });
  assert.equal(missingKind.complete, true);
  assert.equal(missingKind.accurate, false);
  assert.equal(missingKind.mismatches.length, 1);

  // 按现场事实逐人填写：全部准确。
  const rightEntries = Object.fromEntries(
    getPermitListedMembers(defectRoster).map((m) => {
      const expected = getCrewExpectedViolation(m);
      return [
        m.nodeName,
        expected === null
          ? { passed: true, violation: null }
          : { passed: false, violation: expected },
      ];
    })
  );
  const rightEval = evaluateWorkPermitJudgment(defectRoster, {
    entries: rightEntries,
  });
  assert.equal(rightEval.complete, true);
  assert.equal(rightEval.accurate, true);
  assert.equal(rightEval.mismatches.length, 0);
});

test('getCrewExpectedViolation maps scene defects onto roster violation kinds', () => {
  const defectRoster = generateWorkPermitRoster(1024, 'D');
  assert.equal(
    getCrewExpectedViolation(defectRoster.workers[2]),
    'cert-expired',
    '焊工证超期应判为证件过期'
  );
  // 工装不作核验项：同一名穿便装的工人在名册上一律按合规处理。
  assert.equal(getCrewExpectedViolation(defectRoster.workers[1]), null);
  assert.equal(getCrewExpectedViolation(defectRoster.leader), null);
});
