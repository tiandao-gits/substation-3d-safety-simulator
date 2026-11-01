import test from 'node:test';
import assert from 'node:assert/strict';
import { ACT_POINTS, getAct1Point, type Act1Reading, type ActNo } from '../game/act1';
import { buildInspectionReadout } from './inspectionReadouts';

function reading(values: number[], unit: string, label = '读数'): Act1Reading {
  return { label, values, unit, quality: 'ok' };
}

/** 每个点位"做完检测"时应当产生的合格读数。 */
function readyReadings(pointId: string): Act1Reading[] {
  switch (pointId) {
    case 'hv-10kv':
      return [reading([43.2, 96.8, 43.5], '℃', '母排接头 A / B / C')];
    case 'bay-temp':
      return [reading([43.2, 92.4, 43.4], '℃', '引线接头 A / B / C')];
    case 'aisle':
      return [reading([0.78], 'm', '通道净宽 0.78')];
    case 'a3-pit':
      return [reading([2.4], 'm', '临边缺口 2.4')];
    case 'a3-box':
      return [reading([42], 'mA', '漏保动作电流 42')];
    case 'a2-oil':
      return [reading([96.2], '℃', '顶层油温 96.2')];
    default:
      return [];
  }
}

const FULL_ACTIONS: Record<string, string[]> = {
  'hv-10kv': ['visual', 'ir-3', 'cabinet-light'],
  aisle: ['visual', 'clearance'],
  'bay-temp': ['visual', 'ir-3'],
  'a2-crew': ['visual', 'ground-torque', 'ground-caliper'],
  'a2-wall': ['visual', 'wall-hollow', 'wall-crack'],
  'a2-oil': ['visual', 'oil-temp', 'oil-light'],
  'a3-hardhat': ['visual', 'drone-recon'],
  'a3-pit': ['visual', 'pit-gap'],
  'a3-box': ['visual', 'leakage-test', 'box-voltage'],
};

test('每个巡检点在完成检测后都能产出 3D 窗口读数', () => {
  for (const act of [1, 2, 3] as ActNo[]) {
    for (const point of ACT_POINTS[act]) {
      const readout = buildInspectionReadout(
        point,
        readyReadings(point.id),
        FULL_ACTIONS[point.id] ?? ['visual'],
        'C'
      );
      assert.ok(readout, `${point.id} 缺少检测数据`);
      assert.ok(readout.primary.value.length > 0, `${point.id} 主读数不能为空`);
      assert.ok(readout.primary.label.length > 0, `${point.id} 主读数缺少标签`);
    }
  }
});

test('读数模型不得包含任何判定、等级或规程判据', () => {
  for (const act of [1, 2, 3] as ActNo[]) {
    for (const point of ACT_POINTS[act]) {
      const readout = buildInspectionReadout(
        point,
        readyReadings(point.id),
        FULL_ACTIONS[point.id] ?? ['visual'],
        'C'
      );
      assert.ok(readout);
      const raw = readout as unknown as Record<string, unknown>;
      for (const banned of ['verdict', 'criteria', 'status', 'grade', 'severity']) {
        assert.equal(
          banned in raw,
          false,
          `${point.id} 的读数模型不应带 ${banned} 字段`
        );
      }
      const primaryRaw = readout.primary as unknown as Record<string, unknown>;
      for (const banned of ['status', 'grade', 'tone', 'level']) {
        assert.equal(
          banned in primaryRaw,
          false,
          `${point.id} 的主读数不应带 ${banned} 字段`
        );
      }
    }
  }
});

test('定性点位未做检测时不提前给出读数', () => {
  const wall = getAct1Point('a2-wall');
  assert.equal(
    buildInspectionReadout(wall, [], ['visual'], 'B'),
    null,
    '未敲击墙面不得提前显示空鼓读数'
  );
  const hardhat = getAct1Point('a3-hardhat');
  assert.equal(
    buildInspectionReadout(hardhat, [], ['visual'], 'A'),
    null,
    '未升空取证不得提前显示人员防护读数'
  );
  const crew = getAct1Point('a2-crew');
  assert.equal(
    buildInspectionReadout(crew, [], [], 'D'),
    null,
    '未观察不得提前显示证件数据'
  );
});

test('单相读数只标注缺参考相，不给结论', () => {
  const hv = buildInspectionReadout(
    getAct1Point('hv-10kv'),
    [reading([43.2], '℃', '3 号柜 A 相 43.2')],
    ['visual', 'ir-1'],
    'A'
  );
  assert.ok(hv);
  assert.equal(hv.primary.value, '43.2');
  assert.equal(hv.secondary.length, 1);
  assert.match(hv.note ?? '', /未测参考相/);
});

test('防火墙与人员资格按变体给出不同读数，但不给判定', () => {
  const wall = getAct1Point('a2-wall');
  const hollow = buildInspectionReadout(wall, [], ['visual', 'wall-hollow'], 'B');
  assert.equal(hollow?.primary.value, '290');
  assert.equal(hollow?.secondary[0]?.value, '120');
  const solid = buildInspectionReadout(wall, [], ['visual', 'wall-hollow'], 'A');
  assert.equal(solid?.primary.value, '195');
  assert.equal(solid?.secondary[0]?.value, '40');

  const crew = getAct1Point('a2-crew');
  const expired = buildInspectionReadout(crew, [], ['visual'], 'D');
  assert.equal(expired?.primary.value, '2025-06');
  const ok = buildInspectionReadout(crew, [], ['visual'], 'A');
  assert.equal(ok?.primary.value, '2027-09');
});
