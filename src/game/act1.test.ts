import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT1_POINTS,
  ACT1_REVIEW_CHANCES,
  ACT1_SCORE_BASE,
  applyAct1Action,
  attachAct1Evidence,
  canCaptureDroneRecon,
  classifyClearanceDefect,
  classifyCurrentHeatingDefect,
  classifyEdgeGapDefect,
  classifyResidualCurrentDefect,
  classifyTopOilDefect,
  countResolvedPoints,
  createAct1State,
  DISPOSITION_ERROR_PENALTY,
  evaluateActOutcome,
  findNearestOpenAct1Point,
  getAct1PointStatus,
  getActPointIds,
  getActPoints,
  getAdmissibleReading,
  isActComplete,
  isPointCovered,
  isPointResolved,
  normalizeAct1State,
  pickAct1Variant,
  setAct1Disposition,
  settleActDispositions,
  severityToEquipmentGrade,
  standardGradeFor,
  type Act1PointId,
  type Act1State,
  type Act1Variant,
  type ActNo,
} from './act1';
import { findStandableSpotNear, resolvePlayerCollision } from './rules';
import { isInsideApartmentRoom } from './apartmentDoor';

function seedFor(variant: Act1Variant, act: ActNo = 1): number {
  for (let s = 1; s < 200000; s += 1) {
    if (pickAct1Variant(s, act) === variant) return s;
  }
  throw new Error(`No seed found for variant ${variant} in act ${act}`);
}

function act(
  state: Act1State,
  pointId: Act1PointId,
  tool: Parameters<typeof applyAct1Action>[2],
  actionId: string
): Act1State {
  return applyAct1Action(state, pointId, tool, actionId).state;
}

function detectAll(state: Act1State): Act1State {
  let next = state;
  for (const point of getActPoints(state.act)) {
    for (const actionId of point.requiredActions) {
      const entry = Object.entries(point.actions).find(([, specs]) =>
        specs?.some((spec) => spec.id === actionId)
      );
      if (!entry) continue;
      const [tool, specs] = entry;
      const spec = specs?.find((s) => s.id === actionId);
      if (!spec) continue;
      next = act(next, point.id, tool as Parameters<typeof applyAct1Action>[2], spec.id);
    }
  }
  return next;
}

test('three acts expose 3 / 3 / 3 checkpoints', () => {
  assert.deepEqual(getActPointIds(1), ['hv-10kv', 'aisle', 'bay-temp']);
  assert.deepEqual(getActPointIds(2), ['a2-crew', 'a2-wall', 'a2-oil']);
  assert.deepEqual(getActPointIds(3), ['a3-hardhat', 'a3-pit', 'a3-box']);
  assert.equal(ACT1_POINTS.length, 3);
});

test('第一幕按 10kV → 通道 → BAY 布点，室内点位有可用出生位', () => {
  const [first, second, third] = getActPoints(1);
  assert.equal(first.id, 'hv-10kv');
  assert.equal(second.id, 'aisle');
  assert.equal(third.id, 'bay-temp');
  assert.ok(first.approach, '室内点位必须显式给出出生位');
  assert.equal(isInsideApartmentRoom(first.approach.x, first.approach.z), true);
  assert.equal(first.approach.doorOpen, true, '出生在门内侧时门要开着');
  const spot = resolvePlayerCollision(first.approach.x, first.approach.z, 0.55);
  assert.equal(spot.hitObstacle, null, '出生位不能落在墙或柜体里');
  assert.ok(
    Math.hypot(spot.x - first.x, spot.z - first.z) <= first.radius,
    '出生位要落在该点位的检查半径内'
  );
});

test('variant split is seeded per act (act 2 adds D for qualifications)', () => {
  for (const actNo of [1, 2, 3] as ActNo[]) {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (let seed = 0; seed < 10000; seed += 1) counts[pickAct1Variant(seed, actNo)] += 1;
    if (actNo === 2) {
      assert.ok(Math.abs(counts.A / 10000 - 0.4) < 0.03, `act2 A ${counts.A}`);
      assert.ok(Math.abs(counts.B / 10000 - 0.2) < 0.03, `act2 B ${counts.B}`);
      assert.ok(Math.abs(counts.C / 10000 - 0.2) < 0.03, `act2 C ${counts.C}`);
      assert.ok(Math.abs(counts.D / 10000 - 0.2) < 0.03, `act2 D ${counts.D}`);
    } else {
      assert.ok(Math.abs(counts.A / 10000 - 0.4) < 0.03, `act${actNo} A ${counts.A}`);
      assert.ok(Math.abs(counts.B / 10000 - 0.3) < 0.03, `act${actNo} B ${counts.B}`);
      assert.ok(Math.abs(counts.C / 10000 - 0.3) < 0.03, `act${actNo} C ${counts.C}`);
      assert.equal(counts.D, 0);
    }
  }
});

test('第三幕配电箱漏保读数在 A/B/C 变体下都显示失效', () => {
  for (const variant of ['A', 'B', 'C'] as Act1Variant[]) {
    const state = createAct1State(seedFor(variant, 3), 3);
    const outcome = applyAct1Action(state, 'a3-box', 'leakage', 'leakage-test');
    assert.equal(outcome.result.kind, 'reading');
    assert.deepEqual(outcome.result.reading?.values, [42]);
    assert.match(outcome.result.reading?.note ?? '', /0\.18 s/);
  }
});

test('IR grading follows DL/T 664 bands', () => {
  assert.equal(classifyCurrentHeatingDefect(78.2, 43.4, 26), 'general');
  assert.equal(severityToEquipmentGrade('general'), 'P1');
  assert.equal(classifyCurrentHeatingDefect(92.4, 43.4, 26), 'serious');
  assert.equal(classifyCurrentHeatingDefect(96.8, 38.7, 26), 'serious');
  assert.equal(severityToEquipmentGrade('serious'), 'P2');
  assert.equal(classifyCurrentHeatingDefect(118.5, 43.4, 26), 'critical');
  assert.equal(severityToEquipmentGrade('critical'), 'P3');
  assert.equal(classifyCurrentHeatingDefect(43.2, 43.3, 26), 'none');
});

test('其他测点判据：油温 / 漏保 / 净宽 / 临边缺口', () => {
  assert.equal(classifyTopOilDefect(64.2), 'none');
  assert.equal(classifyTopOilDefect(86), 'general');
  assert.equal(classifyTopOilDefect(96.2), 'serious');
  assert.equal(classifyResidualCurrentDefect(30), 'none');
  assert.equal(classifyResidualCurrentDefect(42), 'critical');
  assert.equal(classifyClearanceDefect(1.05), 'none');
  assert.equal(classifyClearanceDefect(0.78), 'general');
  assert.equal(classifyClearanceDefect(0.65), 'critical');
  assert.equal(classifyEdgeGapDefect(0), 'none');
  assert.equal(classifyEdgeGapDefect(0.2), 'serious');
  assert.equal(classifyEdgeGapDefect(2.4), 'critical');
});

test('读数判级与标准分、隐患表一一对应（全部幕 × 变体）', () => {
  for (const actNo of [1, 2, 3] as ActNo[]) {
    const variants: Act1Variant[] = actNo === 2 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C'];
    for (const variant of variants) {
      const state = detectAll(createAct1State(seedFor(variant, actNo), actNo));
      for (const point of getActPoints(actNo)) {
        const derived = standardGradeFor(state, point.id);
        assert.equal(
          derived,
          point.standardGrade[variant],
          `act${actNo} ${variant} ${point.id} 读数判级应与标准分一致`
        );
        assert.equal(
          Boolean(point.finding[variant]),
          derived !== 'P0',
          `act${actNo} ${variant} ${point.id} 隐患表应与判级一致`
        );
      }
    }
  }
});

test('单相/扫测读数只作参考：不能判级，也不能完成检测', () => {
  const s = act(createAct1State(seedFor('C', 1), 1), 'hv-10kv', 'visual', 'visual');
  const single = applyAct1Action(s, 'hv-10kv', 'thermometer', 'ir-1');
  assert.deepEqual(single.result.reading?.values, [38.4], '单相读数不再补 0');
  assert.equal(single.result.reading?.quality, 'coverage');
  assert.equal(single.result.penalty, 10);
  assert.equal(isPointCovered(single.state, 'hv-10kv'), false);
  assert.equal(getAdmissibleReading(single.state.points['hv-10kv']), undefined, '单相读数不能作为判级依据');
  assert.equal(single.state.score, ACT1_SCORE_BASE - 10);

  const casual = applyAct1Action(single.state, 'hv-10kv', 'thermometer', 'ir-casual');
  assert.equal(casual.result.reading?.quality, 'condition');
  assert.equal(casual.result.penalty, 6);
  assert.equal(isPointCovered(casual.state, 'hv-10kv'), false);
  assert.equal(getAdmissibleReading(casual.state.points['hv-10kv']), undefined);

  const three = applyAct1Action(casual.state, 'hv-10kv', 'thermometer', 'ir-3');
  assert.equal(isPointCovered(three.state, 'hv-10kv'), true);
  assert.equal(standardGradeFor(three.state, 'hv-10kv'), 'P2');
  const admissible = getAdmissibleReading(three.state.points['hv-10kv']);
  assert.ok(admissible);
  assert.match(admissible.label, /3 号柜/);
  assert.deepEqual(admissible.values, [38.4, 96.8, 38.7]);
});

test('旧存档的 dispositionKind 迁移为处置等级', () => {
  const base = detectAll(createAct1State(seedFor('B', 1), 1));
  const legacy = {
    ...base,
    points: {
      ...base.points,
      'bay-temp': {
        ...base.points['bay-temp'],
        dispositionKind: 'normal',
        disposition: undefined,
      },
      aisle: {
        ...base.points.aisle,
        dispositionKind: 'evidence',
        disposition: 'P1',
        evidenceId: 'ev-legacy',
      },
    },
  } as unknown as Act1State;

  const migrated = normalizeAct1State(legacy, 1);
  assert.equal(migrated.points['bay-temp'].disposition, 'P0');
  assert.equal(isPointResolved(migrated, 'bay-temp'), true);
  assert.equal(migrated.points.aisle.disposition, 'P1');
  assert.equal(isPointResolved(migrated, 'aisle'), true);
  assert.equal(
    'dispositionKind' in migrated.points.aisle,
    false,
    '归一化后不再保留双分支字段'
  );
});

test('第二幕 D 变体在存档归一化后保持不变', () => {
  const s = createAct1State(seedFor('D', 2), 2);
  const round = normalizeAct1State(
    JSON.parse(JSON.stringify(s)) as Act1State,
    2
  );
  assert.equal(round.variant, 'D');
  const crew = getActPoints(2).find((point) => point.id === 'a2-crew');
  assert.ok(crew);
  assert.equal(crew.finding[round.variant]?.title, '焊工证过期');
});

test('observation is mandatory and every detection must finish before disposition', () => {
  const s = createAct1State(seedFor('B', 1), 1);
  const early = setAct1Disposition(s, 'bay-temp', 'P0');
  assert.equal(early.ok, false);

  let observed = act(s, 'bay-temp', 'visual', 'visual');
  assert.equal(isPointCovered(observed, 'bay-temp'), false);
  const noDetect = setAct1Disposition(observed, 'bay-temp', 'P0');
  assert.equal(noDetect.ok, false);

  observed = act(observed, 'bay-temp', 'thermometer', 'ir-3');
  assert.equal(isPointCovered(observed, 'bay-temp'), true);
  const ok = setAct1Disposition(observed, 'bay-temp', 'P0');
  assert.equal(ok.ok, true);
});

test('P0 直接闭环，P1 及以上必须取证后才算闭环', () => {
  const seed = seedFor('A', 1);
  const s = detectAll(createAct1State(seed, 1));

  // 无隐患点位：P0 即正常记录，不需要拍照。
  const normal = setAct1Disposition(s, 'bay-temp', 'P0');
  assert.equal(normal.ok, true);
  assert.equal(isPointResolved(normal.state, 'bay-temp'), true);
  assert.equal(normal.state.score, ACT1_SCORE_BASE);

  // 定级 P3 属于隐患处置：先定级，再拍照，拍照后才闭环。
  const graded = setAct1Disposition(s, 'bay-temp', 'P3');
  assert.equal(graded.ok, true);
  assert.equal(isPointResolved(graded.state, 'bay-temp'), false);
  assert.equal(getAct1PointStatus(graded.state, 'bay-temp'), 'awaiting-evidence');
  const withPhoto = attachAct1Evidence(graded.state, 'bay-temp', 'ev-1');
  assert.equal(isPointResolved(withPhoto, 'bay-temp'), true);
  assert.equal(withPhoto.score, ACT1_SCORE_BASE, '幕内不即时判定处置对错');

  // Variant A has no defect here: grading it as a hazard is over-processing and
  // is deducted once the act settles.
  const settled = settleActDispositions(withPhoto);
  assert.equal(settled.score, ACT1_SCORE_BASE - DISPOSITION_ERROR_PENALTY);
  assert.ok(
    settled.deductions.some((item) => item.id === 'disposition-unnecessary-bay-temp')
  );
});

test('wrong instrument costs a chance; wrong point does not', () => {
  const s = createAct1State(seedFor('A', 1), 1);

  const wrongTool = applyAct1Action(s, 'bay-temp', 'multimeter', 'invalid');
  assert.equal(wrongTool.result.errorType, 'wrong-tool');
  assert.equal(wrongTool.result.penalty, 8);
  assert.equal(wrongTool.state.reviewChances, ACT1_REVIEW_CHANCES - 1);
  assert.equal(wrongTool.state.actFailed, false);

  const wrongPoint = applyAct1Action(s, 'bay-temp', 'laser', 'invalid');
  assert.equal(wrongPoint.result.errorType, 'wrong-point');
  assert.equal(wrongPoint.state.reviewChances, ACT1_REVIEW_CHANCES);
});

test('exhausting chances fails the act', () => {
  let s = createAct1State(seedFor('A', 1), 1);
  for (let i = 0; i < ACT1_REVIEW_CHANCES; i += 1) {
    s = applyAct1Action(s, 'bay-temp', 'multimeter', 'invalid').state;
  }
  assert.equal(s.reviewChances, 0);
  assert.equal(s.actFailed, true);
  const blocked = applyAct1Action(s, 'bay-temp', 'thermometer', 'ir-3');
  assert.equal(blocked.result.penalty, 0);
});

test('resolving every point completes the act', () => {
  const seed = seedFor('B', 1);
  let s = detectAll(createAct1State(seed, 1));
  for (const id of getActPointIds(1)) {
    s = setAct1Disposition(s, id, 'P0').state;
  }
  assert.equal(countResolvedPoints(s), 3);
  assert.equal(isActComplete(s), true);
});

test('act outcome reports every discovered hazard left unclosed', () => {
  const seed = seedFor('B', 1);
  let s = detectAll(createAct1State(seed, 1));
  for (const id of getActPointIds(1)) {
    s = setAct1Disposition(s, id, 'P0').state;
  }
  assert.deepEqual(evaluateActOutcome(s).unhandled, [
    '材料占用巡视通道',
    'BAY 设备 B 相接头过热',
  ]);

  let handled = detectAll(createAct1State(seed, 1));
  for (const id of getActPointIds(1)) {
    handled = setAct1Disposition(handled, id, 'P2').state;
    handled = attachAct1Evidence(handled, id, `ev-${id}`);
  }
  assert.deepEqual(evaluateActOutcome(handled).unhandled, []);
  assert.deepEqual(evaluateActOutcome(handled).handled, [
    '材料占用巡视通道',
    'BAY 设备 B 相接头过热',
  ]);
});

test('over- and under-graded dispositions are deducted at settlement', () => {
  const seed = seedFor('B', 1);
  let s = detectAll(createAct1State(seed, 1));

  // aisle: general hazard, standard P1 → P3 is over-processing.
  s = setAct1Disposition(s, 'aisle', 'P3').state;
  s = attachAct1Evidence(s, 'aisle', 'ev-aisle');
  // bay-temp: urgent hazard, standard P2 → P1 is under-processing.
  s = setAct1Disposition(s, 'bay-temp', 'P1').state;
  s = attachAct1Evidence(s, 'bay-temp', 'ev-bay');
  // hv-10kv: no finding in variant B → normal is correct.
  s = setAct1Disposition(s, 'hv-10kv', 'P0').state;

  const settled = settleActDispositions(s);
  assert.equal(settled.score, ACT1_SCORE_BASE - DISPOSITION_ERROR_PENALTY * 2);
  assert.deepEqual(
    settled.deductions.map((item) => item.id),
    ['disposition-over-aisle', 'disposition-under-bay-temp']
  );
});

test('every checkpoint in every act has standable ground within reach', () => {
  for (const actNo of [1, 2, 3] as ActNo[]) {
    for (const point of getActPoints(actNo)) {
      const spot = findStandableSpotNear(point.x, point.z);
      assert.ok(
        spot && spot.distance <= 2.5,
        `act${actNo} ${point.id} at (${point.x}, ${point.z}) has no free standing spot (closest ${
          spot ? spot.distance.toFixed(2) : 'none'
        } m)`
      );
    }
  }
});

test('checkpoints inside one act stay far enough apart', () => {
  for (const actNo of [1, 2, 3] as ActNo[]) {
    const points = getActPoints(actNo);
    for (const a of points) {
      for (const b of points) {
        if (a.id === b.id) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        assert.ok(d >= 4.0, `act${actNo} ${a.id} and ${b.id} are only ${d.toFixed(2)} m apart`);
      }
    }
  }
});

test('checkpoint profiles follow the responsible party', () => {
  const profiles = Object.fromEntries(getActPoints(1).map((p) => [p.id, p.profile]));
  assert.deepEqual(profiles, {
    aisle: 'construction',
    'bay-temp': 'equipment',
    'hv-10kv': 'equipment',
  });
  assert.equal(getActPoints(3).every((p) => p.profile === 'construction'), true);
});

test('resolved checkpoints are skipped by proximity prompts', () => {
  const next = findNearestOpenAct1Point(8.5, 1.0, 1, (id) => id === 'aisle');
  assert.ok(next);
  assert.equal(next.point.id, 'bay-temp');

  const allDone = findNearestOpenAct1Point(8.5, 1.0, 1, () => true);
  assert.equal(allDone, null);
});


test('personnel protection needs a drone capture before disposition', () => {
  let s = createAct1State(seedFor('A', 3), 3);
  s = act(s, 'a3-hardhat', 'visual', 'visual');
  assert.equal(isPointCovered(s, 'a3-hardhat'), false);
  assert.equal(canCaptureDroneRecon(s, 'a3-hardhat'), true);

  const blocked = setAct1Disposition(s, 'a3-hardhat', 'P0');
  assert.equal(blocked.ok, false);

  s = attachAct1Evidence(s, 'a3-hardhat', 'ev-drone');
  assert.equal(isPointCovered(s, 'a3-hardhat'), true);
  assert.equal(canCaptureDroneRecon(s, 'a3-hardhat'), false);
  const ok = setAct1Disposition(s, 'a3-hardhat', 'P0');
  assert.equal(ok.ok, true);
});

test('Phase 2 专项工具核验无扣分且不改变标准判级', () => {
  // Act 1: flashlight on hv-10kv before primary ir-3
  let s1 = createAct1State(seedFor('C', 1), 1);
  const flash1 = applyAct1Action(s1, 'hv-10kv', 'flashlight', 'cabinet-light');
  assert.equal(flash1.result.penalty, 0);
  assert.equal(flash1.result.kind, 'clue');
  s1 = detectAll(flash1.state);
  assert.equal(standardGradeFor(s1, 'hv-10kv'), 'P2');

  // Act 2: torque & caliper on a2-crew, feeler on a2-wall, flashlight on a2-oil
  let s2 = createAct1State(seedFor('C', 2), 2);
  const torqueRes = applyAct1Action(s2, 'a2-crew', 'torque', 'ground-torque');
  assert.equal(torqueRes.result.penalty, 0);
  assert.equal(torqueRes.result.kind, 'clue');
  const caliperRes = applyAct1Action(torqueRes.state, 'a2-crew', 'caliper', 'ground-caliper');
  assert.equal(caliperRes.result.penalty, 0);
  assert.equal(caliperRes.result.kind, 'clue');
  const feelerRes = applyAct1Action(caliperRes.state, 'a2-wall', 'feeler', 'wall-crack');
  assert.equal(feelerRes.result.penalty, 0);
  assert.equal(feelerRes.result.kind, 'clue');
  const oilLightRes = applyAct1Action(feelerRes.state, 'a2-oil', 'flashlight', 'oil-light');
  assert.equal(oilLightRes.result.penalty, 0);
  assert.equal(oilLightRes.result.kind, 'clue');
  s2 = detectAll(oilLightRes.state);
  assert.equal(standardGradeFor(s2, 'a2-oil'), 'P2');

  // Act 3: multimeter on a3-box before leakage-test
  let s3 = createAct1State(seedFor('A', 3), 3);
  const multiRes = applyAct1Action(s3, 'a3-box', 'multimeter', 'box-voltage');
  assert.equal(multiRes.result.penalty, 0);
  assert.equal(multiRes.result.kind, 'clue');
  s3 = detectAll(multiRes.state);
  assert.equal(standardGradeFor(s3, 'a3-box'), 'P3');
});

test('单巡检点闭环不弹剧情聊天，仅在第一幕、第二幕全点位闭环时入队幕末聊天，第三幕不入队', () => {
  // Act 1: 3 points
  let s1 = detectAll(createAct1State(seedFor('B', 1), 1));
  assert.deepEqual(s1.pendingLines, [], '检测动作不再入队单点聊天');

  s1 = setAct1Disposition(s1, 'hv-10kv', 'P0').state;
  assert.deepEqual(s1.pendingLines, [], '第 1 个点闭环不弹聊天');

  s1 = setAct1Disposition(s1, 'aisle', 'P1').state;
  s1 = attachAct1Evidence(s1, 'aisle', 'ev-aisle');
  assert.deepEqual(s1.pendingLines, [], '第 2 个点取证闭环不弹聊天');

  s1 = setAct1Disposition(s1, 'bay-temp', 'P2').state;
  assert.deepEqual(s1.pendingLines, [], '第 3 个点未拍照前尚未闭环');
  s1 = attachAct1Evidence(s1, 'bay-temp', 'ev-bay');
  assert.deepEqual(
    s1.pendingLines,
    ['A1-END-1', 'A1-11', 'A1-12'],
    '第一幕全部闭环后触发幕末剧情聊天'
  );

  // Act 2: 3 points
  let s2 = detectAll(createAct1State(seedFor('A', 2), 2));
  s2 = setAct1Disposition(s2, 'a2-crew', 'P0').state;
  s2 = setAct1Disposition(s2, 'a2-wall', 'P0').state;
  assert.deepEqual(s2.pendingLines, [], '第二幕前两个点闭环不弹聊天');
  s2 = setAct1Disposition(s2, 'a2-oil', 'P0').state;
  assert.deepEqual(
    s2.pendingLines,
    ['A2-END-1', 'A2-END-2'],
    '第二幕全部闭环后触发幕末剧情聊天'
  );

  // Act 3: 3 points (no chat at end of Act 3 because Ending VN plays)
  let s3 = detectAll(createAct1State(seedFor('A', 3), 3));
  s3 = attachAct1Evidence(s3, 'a3-hardhat', 'ev-drone');
  s3 = setAct1Disposition(s3, 'a3-hardhat', 'P2').state;
  s3 = attachAct1Evidence(s3, 'a3-hardhat', 'ev-hardhat');
  s3 = setAct1Disposition(s3, 'a3-pit', 'P0').state;
  s3 = setAct1Disposition(s3, 'a3-box', 'P3').state;
  s3 = attachAct1Evidence(s3, 'a3-box', 'ev-box');
  assert.equal(isActComplete(s3), true);
  assert.deepEqual(s3.pendingLines, [], '第三幕结束不触发气泡聊天（直接进入终章 VN）');
});

