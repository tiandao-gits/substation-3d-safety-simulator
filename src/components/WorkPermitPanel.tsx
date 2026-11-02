import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ClipboardList, PenLine, X } from 'lucide-react';
import {
  SceneMenu,
  SceneReadoutFrame,
  type SceneMenuItem,
} from './SceneMenu';
import { soundEngine } from '../game/sound';
import {
  CREW_VIOLATION_OPTIONS,
  createInitialPermitJudgment,
  getFocusedCrewSlot,
  getPermitListedMembers,
  isCrewVerificationSettled,
  setFocusedCrewSlot,
  subscribeCrewFocus,
  type CrewViolationKind,
  type CrewWorkerVisualSpec,
  type WorkPermitPlayerJudgment,
  type WorkPermitRoster,
} from '../game/workPermit';

interface WorkPermitPanelProps {
  roster: WorkPermitRoster;
  permitSigned: boolean;
  /** 已签注归档的逐人结论：重开处置单时原样回显。 */
  signedEntries?: WorkPermitPlayerJudgment['entries'];
  onSign: (judgment: WorkPermitPlayerJudgment) => void;
}

/**
 * 第二幕班前会处置单：只保留《工作票》名册与逐人核验列。
 * 3D 近景机位、胸牌（含有效期）放大说明在左侧 3D 视窗（CrewFocusStage）。
 * 签注不校验对错：名册只负责归档玩家的核验结论，扣分留到第二幕结束。
 */
export function WorkPermitPanel({
  roster,
  permitSigned,
  signedEntries,
  onSign,
}: WorkPermitPanelProps) {
  const members = useMemo(() => getPermitListedMembers(roster), [roster]);
  const [judgment, setJudgment] = useState<WorkPermitPlayerJudgment>(() =>
    signedEntries
      ? { entries: { ...signedEntries } }
      : createInitialPermitJudgment(roster)
  );
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setJudgment(
      signedEntries
        ? { entries: { ...signedEntries } }
        : createInitialPermitJudgment(roster)
    );
    setNotice(null);
  }, [roster, signedEntries]);

  const settledCount = members.filter((m) =>
    isCrewVerificationSettled(judgment.entries[m.nodeName])
  ).length;

  const setEntry = (
    nodeName: string,
    patch: { passed: boolean | null; violation?: CrewViolationKind | null }
  ) => {
    soundEngine.playUiBeep();
    setNotice(null);
    setJudgment((prev) => ({
      entries: {
        ...prev.entries,
        [nodeName]: {
          passed: patch.passed,
          violation: patch.violation ?? null,
        },
      },
    }));
  };

  const handleSign = () => {
    const unmarked = members.filter(
      (m) => judgment.entries[m.nodeName]?.passed == null
    );
    if (unmarked.length > 0) {
      soundEngine.playHazardWarning();
      setNotice(`还有 ${unmarked.length} 人未给出核验结论，名册不能空项签注。`);
      return;
    }
    soundEngine.playVisualInspect();
    setNotice(null);
    onSign(judgment);
  };

  return (
    <section
      aria-label="班前会名册核验"
      className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-800">
          <ClipboardList className="h-3.5 w-3.5 text-amber-700" />
          <span>班前会名册 · 逐人核验</span>
        </div>
        <span className="shrink-0 font-mono text-[10.5px] text-slate-500">
          {roster.permitNo}
        </span>
      </div>
      <div className="mt-0.5 text-[10.5px] leading-4 text-slate-500">
        登记 {roster.permitTotalCount} 人 · {roster.workUnit}
      </div>

      <table className="mt-1.5 w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-y border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-500">
            <th className="w-[16%] px-1.5 py-1 font-semibold">岗位</th>
            <th className="w-[13%] px-1.5 py-1 font-semibold">姓名</th>
            <th className="w-[13%] px-1.5 py-1 font-semibold">工号</th>
            <th className="w-[32%] px-1.5 py-1 font-semibold">作业证</th>
            <th className="w-[26%] px-1.5 py-1 font-semibold">核验</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {members.map((member) => (
            <RosterRow
              key={member.nodeName}
              member={member}
              entry={judgment.entries[member.nodeName]}
              locked={permitSigned}
              onSet={setEntry}
            />
          ))}
        </tbody>
      </table>

      {notice && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-900">
          {notice}
        </p>
      )}

      {permitSigned && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-emerald-300 bg-emerald-50 p-2 text-[11px] leading-4 text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span>
            <span className="font-bold">名册已签注：</span>
            核验结论随工作票归档，收工核账。
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-slate-500">
          {settledCount}/{members.length} 已核验
        </span>
        <button
          type="button"
          onClick={handleSign}
          disabled={permitSigned}
          className={`flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
            permitSigned
              ? 'cursor-default border-emerald-500 bg-emerald-600 text-white'
              : 'cursor-pointer border-sky-600 bg-sky-600 text-white hover:bg-sky-500'
          }`}
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>{permitSigned ? '已签注核验结论' : '签注工作票'}</span>
        </button>
      </div>
    </section>
  );
}

function RosterRow({
  member,
  entry,
  locked,
  onSet,
}: {
  member: CrewWorkerVisualSpec;
  entry: WorkPermitPlayerJudgment['entries'][string] | undefined;
  locked: boolean;
  onSet: (
    nodeName: string,
    patch: { passed: boolean | null; violation?: CrewViolationKind | null }
  ) => void;
}) {
  const passed = entry?.passed ?? null;
  const violated = passed === false;

  return (
    <tr className={violated ? 'bg-red-50/50' : undefined}>
      <td className="px-1.5 py-1.5 text-[11px] font-semibold leading-4 text-sky-900">
        {member.slotIndex === 0 ? '负责人' : `组员 ${member.tagCode}`}
      </td>
      <td className="px-1.5 py-1.5 text-[11.5px] font-bold leading-4 text-slate-900">
        {member.name}
      </td>
      <td className="px-1.5 py-1.5 font-mono text-[10.5px] leading-4 text-slate-500">
        {member.empId}
      </td>
      <td className="px-1.5 py-1.5 text-[10.5px] leading-4 text-slate-700">
        {member.certName}
      </td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={locked}
            aria-label={`${member.name} 核验合格`}
            onClick={() => onSet(member.nodeName, { passed: true })}
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              locked ? 'cursor-default' : 'cursor-pointer'
            } ${
              passed === true
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-500 hover:text-emerald-600'
            }`}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            disabled={locked}
            aria-label={`${member.name} 核验违规`}
            onClick={() => onSet(member.nodeName, { passed: false })}
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              locked ? 'cursor-default' : 'cursor-pointer'
            } ${
              violated
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-slate-300 bg-white text-slate-400 hover:border-red-500 hover:text-red-600'
            }`}
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          {violated && (
            <select
              disabled={locked}
              aria-label={`${member.name} 违规类型`}
              value={entry?.violation ?? ''}
              onChange={(e) =>
                onSet(member.nodeName, {
                  passed: false,
                  violation: (e.target.value || null) as CrewViolationKind | null,
                })
              }
              className={`min-w-0 flex-1 rounded border bg-white px-1 py-0.5 text-[10px] leading-4 outline-none ${
                locked ? 'cursor-default' : 'cursor-pointer'
              } ${
                entry?.violation
                  ? 'border-red-300 text-red-800'
                  : 'border-amber-400 text-amber-800'
              }`}
            >
              <option value="">选类型…</option>
              {CREW_VIOLATION_OPTIONS.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * 左侧 3D 视窗的班前会人员区（窄屏回退用）：
 * 人员列表与巡检检测项共用 SceneMenu，读数位显示所选人员的档案。
 */
export function CrewStage({
  roster,
  focusedSlot,
  onSelect,
}: {
  roster: WorkPermitRoster;
  focusedSlot: number | null;
  onSelect: (slot: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <SceneMenu
        items={buildCrewMenuItems(roster, onSelect)}
        selectedKey={crewMenuKey(focusedSlot)}
        ariaLabel="班前会人员列表"
      />
      <CrewReadout roster={roster} focusedSlot={focusedSlot} />
    </div>
  );
}

/** 全景机位在菜单里占用一个保留键（不参与人员槽位编号）。 */
const PANORAMA_KEY = 'scene-panorama';

/** 班前会人员列表：全景列队 + 现场逐人，与检测项同一套菜单外观。 */
export function buildCrewMenuItems(
  roster: WorkPermitRoster,
  onSelect: (slot: number | null) => void
): SceneMenuItem[] {
  return [
    {
      key: PANORAMA_KEY,
      label: '全景列队',
      sublabel: `实到 ${roster.sceneWorkers.length} 人 · 退到全景机位`,
      glyph: 'lineup',
      onSelect: () => onSelect(null),
    },
    ...roster.sceneWorkers.map((worker, index) => ({
      key: crewMenuKey(index),
      label: worker.name,
      sublabel: `${worker.tagCode} · ${worker.role}`,
      glyph: 'crew' as const,
      onSelect: () => onSelect(index),
    })),
  ];
}

export function crewMenuKey(focusedSlot: number | null): string {
  return focusedSlot === null ? PANORAMA_KEY : `scene-crew-${focusedSlot}`;
}

/**
 * 3D 近景对焦槽位（全局单例）：列表点击、3D 相机、读数位三处共用。
 * 卸载时清空，避免退出处置单后镜头仍停在某人身上。
 */
export function useCrewFocus() {
  const [focusedSlot, setFocusedSlot] = useState<number | null>(() =>
    getFocusedCrewSlot()
  );

  useEffect(() => {
    const unsubscribe = subscribeCrewFocus(() => {
      setFocusedSlot(getFocusedCrewSlot());
    });
    return () => {
      unsubscribe();
      setFocusedCrewSlot(null);
    };
  }, []);

  const select = useCallback((slot: number | null) => {
    soundEngine.playUiBeep();
    setFocusedCrewSlot(slot);
  }, []);

  return { focusedSlot, select };
}

/**
 * 读数位的人员档案：左侧是 3D 胸牌同款卡片，右侧是基础信息与证件信息。
 * 只列台账事实（工号、证号、有效期），不给"是否合格"的任何结论。
 * 未选人时给班前会核对要点，不预先汇总证件结论。
 */
export function CrewReadout({
  roster,
  focusedSlot,
}: {
  roster: WorkPermitRoster;
  focusedSlot: number | null;
}) {
  const focused =
    focusedSlot !== null ? roster.sceneWorkers[focusedSlot] ?? null : null;

  if (focusedSlot === null || !focused) {
    return (
      <SceneReadoutFrame
        title="3D 现场班前会 · 核对记录"
        right={`工作票 ${roster.permitNo}`}
      >
        <ul className="space-y-1 font-mono text-[11px] leading-4 text-slate-300">
          <li>· 逐人比对胸前工作证的证件名称与有效期</li>
          <li>· 观察安全帽佩戴与工装着装规范</li>
          <li>· 与《工作票》登记名单核对实到人员</li>
        </ul>
        <div className="mt-2 border-t border-slate-700/80 pt-1.5 font-mono text-[11px] leading-4 text-slate-500">
          <span className="text-sky-300">操作 </span>
          点击左侧任一人员，读数位切换为该员的基础与证件信息
        </div>
      </SceneReadoutFrame>
    );
  }

  return (
    <SceneReadoutFrame
      title="人员档案 · 现场核对"
      right={`列队第 ${focusedSlot + 1} 位 · ${focused.empId}`}
    >
      <div className="flex items-stretch gap-3">
        <div className="w-[168px] shrink-0 overflow-hidden rounded border border-slate-500 bg-white text-slate-900 sm:w-[196px]">
          <div className="flex items-center justify-between gap-1 bg-slate-700 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-wide text-white">
            <span>变电检修作业胸牌</span>
            <span className="opacity-80">{focused.tagCode}</span>
          </div>
          <div className="px-2 py-1.5">
            <div className="text-[13px] font-bold leading-4">
              {focused.name}
              <span className="ml-1 text-[10px] font-normal text-slate-600">
                {focused.role}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] leading-3.5 text-slate-700">
              {focused.certName}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-slate-800">
              <span className="text-[9px] text-slate-600">有效期至</span>
              <span className="text-[10.5px] font-bold">
                {focused.certExpiry}
              </span>
            </div>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-1 font-mono text-[11px] leading-4">
          <ProfileRow label="工号" value={focused.empId} />
          <ProfileRow label="岗位" value={focused.role} />
          <ProfileRow label="证号" value={focused.certNo} />
          <ProfileRow
            label="现场"
            value={`列队第 ${focusedSlot + 1} 位 / 共 ${roster.sceneWorkers.length} 位`}
          />
        </dl>
      </div>

      <div className="mt-2 border-t border-slate-700/80 pt-1.5 font-mono text-[11px] leading-4 text-slate-500">
        <span className="text-sky-300">核对 </span>
        胸牌已拉近至正前方，可逐项比对证件有效期与安全帽佩戴。
      </div>
    </SceneReadoutFrame>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-9 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-slate-100">{value}</dd>
    </div>
  );
}
