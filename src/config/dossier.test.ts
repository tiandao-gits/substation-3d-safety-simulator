import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_LEDGERS,
  ACT_REGULATIONS,
  ASSET_KIND_LABELS,
  GAMEPLAY_CONTROLS,
  GAMEPLAY_STEPS,
  PERMIT_CHECK_CRITERIA,
  PERMIT_ROSTER_COLUMNS,
} from './dossier';
import { ACT_POINTS } from '../game/act1';
import { CREW_VIOLATION_OPTIONS } from '../game/workPermit';

const ACTS = [1, 2, 3] as const;

test('每幕的设备台账三类都非空，且每个检查点至少有一条台账', () => {
  for (const act of ACTS) {
    const ledger = ACT_LEDGERS[act];
    const groups = [ledger.equipment, ledger.personnel, ledger.sites];
    for (const group of groups) {
      assert.ok(group.length >= 3, `第${act}幕台账分组条目过少：${group.length}`);
    }

    const pointIds = new Set(ACT_POINTS[act].map((point) => point.id));
    const covered = new Set(
      [...ledger.equipment, ...ledger.personnel, ...ledger.sites].flatMap(
        (asset) => asset.points
      )
    );
    for (const pointId of pointIds) {
      assert.ok(covered.has(pointId), `第${act}幕 ${pointId} 没有对应的台账条目`);
    }
  }
});

test('台账条目的 id 唯一、字段完整、关联点位属于本幕', () => {
  for (const act of ACTS) {
    const ledger = ACT_LEDGERS[act];
    const assets = [...ledger.equipment, ...ledger.personnel, ...ledger.sites];
    const ids = new Set<string>();
    const pointIds = new Set(ACT_POINTS[act].map((point) => point.id));

    for (const asset of assets) {
      assert.ok(!ids.has(asset.id), `第${act}幕台账 id 重复：${asset.id}`);
      ids.add(asset.id);

      assert.ok(asset.name.trim(), `${asset.id} 缺少名称`);
      assert.ok(asset.code.trim(), `${asset.id} 缺少型号/编号`);
      assert.ok(asset.summary.trim(), `${asset.id} 缺少说明`);
      assert.ok(asset.specs.length >= 3, `${asset.id} 台账字段过少`);
      assert.ok(asset.note.trim(), `${asset.id} 缺少核对要点`);
      assert.ok(ASSET_KIND_LABELS[asset.kind], `${asset.id} 的分类没有中文标签`);

      for (const spec of asset.specs) {
        assert.ok(spec.label.trim() && spec.value.trim(), `${asset.id} 有空字段`);
      }
      for (const pointId of asset.points) {
        assert.ok(pointIds.has(pointId), `${asset.id} 关联了不属于第${act}幕的 ${pointId}`);
      }
    }
  }
});

test('安规条例都带引用出处，并覆盖本幕每一个检查点', () => {
  for (const act of ACTS) {
    const regulations = ACT_REGULATIONS[act];
    assert.ok(regulations.length >= 3, `第${act}幕安规条例过少`);

    const covered = new Set(regulations.flatMap((reg) => reg.points));
    for (const point of ACT_POINTS[act]) {
      assert.ok(covered.has(point.id), `第${act}幕 ${point.id} 没有对应的安规条例`);
    }

    const ids = new Set<string>();
    for (const reg of regulations) {
      assert.ok(!ids.has(reg.id), `第${act}幕条例 id 重复：${reg.id}`);
      ids.add(reg.id);
      assert.match(reg.citation, /[A-Z]{2,}|《/, `${reg.id} 的引用出处不像标准号`);
      assert.ok(reg.group.trim(), `${reg.id} 缺少分组`);
      assert.ok(reg.title.trim(), `${reg.id} 缺少标题`);
      assert.ok(reg.clause.length >= 30, `${reg.id} 的条文摘录过短，不足以支撑判据`);
      assert.ok(
        reg.interpretation.length >= 30,
        `${reg.id} 缺少对条文的解读，安规手册会退化成数字清单`
      );
      assert.ok(reg.application.trim(), `${reg.id} 缺少适用说明`);

      const pointIds = new Set(ACT_POINTS[act].map((point) => point.id));
      for (const pointId of reg.points) {
        assert.ok(pointIds.has(pointId), `${reg.id} 关联了不属于第${act}幕的 ${pointId}`);
      }
    }
  }
});

test('班前会清单覆盖全部违规类型，名册不含有效期列', () => {
  for (const option of CREW_VIOLATION_OPTIONS) {
    const criterion = PERMIT_CHECK_CRITERIA[option.kind];
    assert.ok(criterion, `缺少 ${option.kind} 的核验口径`);
    assert.ok(criterion.scene.trim(), `${option.kind} 缺少现场判据`);
    assert.ok(criterion.rule.trim(), `${option.kind} 缺少核验要求`);
  }

  assert.deepEqual(
    [...PERMIT_ROSTER_COLUMNS],
    ['岗位', '姓名', '工号', '作业证', '核验'],
    '名册列必须与界面表头一致，且不包含有效期'
  );
});

test('玩法说明的步骤与按键完整', () => {
  assert.equal(GAMEPLAY_STEPS.length, 7);
  assert.deepEqual(
    GAMEPLAY_STEPS.map((step) => step.step),
    ['01', '02', '03', '04', '05', '06', '07']
  );
  for (const step of GAMEPLAY_STEPS) {
    assert.ok(step.title.trim() && step.text.trim(), `${step.step} 文案不完整`);
  }

  const keys: readonly string[] = GAMEPLAY_CONTROLS.map((control) => control.keys);
  for (const required of ['F', 'G', 'E', 'B', 'X']) {
    assert.ok(keys.includes(required), `玩法说明缺少 ${required} 键`);
  }
});
