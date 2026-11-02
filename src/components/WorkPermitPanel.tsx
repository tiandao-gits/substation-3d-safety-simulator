import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  Eye,
  HardHat,
  Shirt,
  Users,
} from 'lucide-react';
import type { Act1Variant } from '../game/act1';
import { soundEngine } from '../game/sound';
import {
  createInitialPermitJudgment,
  evaluateWorkPermitJudgment,
  generateWorkPermitRoster,
  getFocusedCrewSlot,
  setFocusedCrewSlot,
  subscribeCrewFocus,
  type WorkPermitPlayerJudgment,
  type WorkPermitRoster,
} from '../game/workPermit';

interface WorkPermitPanelProps {
  seed: number;
  variant: Act1Variant;
  observed: boolean;
  permitVerified: boolean;
  onSyncRosterTo3D?: (roster: WorkPermitRoster) => void;
  onCompletePermitCheck: () => void;
}

export function WorkPermitPanel({
  seed,
  variant,
  permitVerified,
  onSyncRosterTo3D,
  onCompletePermitCheck,
}: WorkPermitPanelProps) {
  const roster = useMemo(
    () => generateWorkPermitRoster(seed, variant, 0),
    [seed, variant]
  );

  const [judgment, setJudgment] = useState<WorkPermitPlayerJudgment>(() =>
    createInitialPermitJudgment()
  );
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [focusedSlot, setFocusedSlotState] = useState<number | null>(() =>
    getFocusedCrewSlot()
  );

  useEffect(() => {
    setJudgment(createInitialPermitJudgment());
    setErrorMessages([]);
    setFocusedCrewSlot(null);
    onSyncRosterTo3D?.(roster);
    return () => {
      setFocusedCrewSlot(null);
    };
  }, [roster, onSyncRosterTo3D]);

  useEffect(() => {
    return subscribeCrewFocus(() => {
      setFocusedSlotState(getFocusedCrewSlot());
    });
  }, []);

  /** 票面登记名单（仅展示《工作票》纸面填写的登记人员，不剧透现场实到与违章状态） */
  const permitListedMembers = useMemo(
    () =>
      [roster.leader, ...roster.workers].filter((w) => w.listedOnPermit),
    [roster]
  );

  const handleSelectFocus = (slotIdx: number | null) => {
    soundEngine.playUiBeep();
    setFocusedCrewSlot(slotIdx);
  };

  const updateJudgment = <K extends keyof WorkPermitPlayerJudgment>(
    key: K,
    value: WorkPermitPlayerJudgment[K]
  ) => {
    soundEngine.playUiBeep();
    setErrorMessages([]);
    setJudgment((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleVerifySubmit = () => {
    const result = evaluateWorkPermitJudgment(roster, judgment);
    if (!result.complete || !result.accurate) {
      soundEngine.playHazardWarning();
      setErrorMessages(result.mismatches);
      return;
    }
    soundEngine.playVisualInspect();
    setErrorMessages([]);
    onCompletePermitCheck();
  };

  const focusedWorker =
    focusedSlot !== null ? roster.sceneWorkers[focusedSlot] ?? null : null;

  return (
    <section
      aria-label="工作票现场核对面板"
      className="rounded-lg border-2 border-sky-600/80 bg-slate-50 p-3 text-slate-900 shadow-sm"
    >
      {/* 1. 票头与票面基本信息 */}
      <div className="border-b border-slate-200 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-sky-900">
            <ClipboardList className="h-3.5 w-3.5 text-sky-600" />
            <span>《变电站第一种工作票》票面台账与现场目视核对</span>
          </div>
          <span className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-800">
            票号 {roster.permitNo}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
          <div className="truncate">作业单位：{roster.workUnit}</div>
          <div className="truncate">
            票面记载总人数：
            <strong className="font-mono text-slate-900">
              {roster.permitTotalCount} 人
            </strong>
            （负责人 1 + 组员 {roster.permitTotalCount - 1}）
          </div>
        </div>
      </div>

      {/* 2. 纸面工作票登记名单（仅显示纸面申报信息，需玩家对照 3D 现场人物模型核查） */}
      <div className="mt-2.5 rounded-md border border-slate-200 bg-white p-2">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-800">
            一、工作票纸面申报人员名册（共登记 {roster.permitTotalCount} 人）
          </span>
          <span className="text-[10.5px] text-slate-500">
            请与左侧 3D 现场实到人员逐一比对
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-slate-600">
                <th className="px-2 py-1">票面岗位</th>
                <th className="px-2 py-1">姓名</th>
                <th className="px-2 py-1">工号</th>
                <th className="px-2 py-1">申报特种作业证号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permitListedMembers.map((member) => (
                <tr key={member.nodeName} className="text-slate-800">
                  <td className="px-2 py-1 font-sans font-semibold text-sky-900">
                    {member.slotIndex === 0 ? '工作负责人' : `班组成员 ${member.tagCode}`}
                  </td>
                  <td className="px-2 py-1 font-sans font-bold">{member.name}</td>
                  <td className="px-2 py-1 text-slate-500">{member.empId}</td>
                  <td className="px-2 py-1 text-slate-600">
                    {member.certName} ({member.certNo})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 3D 现场镜头切换与近景端详 */}
      <div className="mt-2.5 rounded-md border border-sky-200 bg-sky-50/70 p-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1 font-bold text-sky-950">
            <Camera className="h-3.5 w-3.5 text-sky-700" />
            <span>二、3D 现场人物模型近景端详（切换左侧 3D 摄像机机位）</span>
          </span>
          <span className="text-[10.5px] text-sky-800">
            观察胸前实体工牌、阻燃服与安全帽
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectFocus(null)}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              focusedSlot === null
                ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
            }`}
          >
            <Users className="h-3 w-3" />
            <span>全景列队视角</span>
          </button>

          {roster.sceneWorkers.map((worker, idx) => (
            <button
              key={worker.nodeName}
              type="button"
              onClick={() => handleSelectFocus(idx)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                focusedSlot === idx
                  ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>
                近景 #{idx + 1} · {worker.name}
              </span>
            </button>
          ))}
        </div>

        {/* 当镜头对准某位 3D 人员时，同步展示该员胸前实体挂牌的近景目视图像 */}
        {focusedWorker ? (
          <div className="mt-2 rounded border border-slate-300 bg-slate-900 p-2.5 text-slate-100">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5">
              <span className="font-mono text-[11px] font-bold text-sky-300">
                3D 镜头当前聚焦：列队 #{focusedSlot! + 1} · {focusedWorker.name}（
                {focusedWorker.role}）
              </span>
              <span className="font-mono text-[10.5px] text-slate-400">
                请结合左侧 3D 模型外观判断
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {/* 胸前工作证微距实拍卡片 */}
              <div className="rounded border border-slate-700 bg-slate-950 p-2">
                <div className="text-[10px] font-semibold text-slate-400">
                  【胸前挂牌目视放大】
                </div>
                {focusedWorker.badgeStatus === 'missing' ? (
                  <div className="mt-1.5 rounded border border-dashed border-amber-500/60 bg-amber-950/40 px-2 py-2 text-center font-mono text-xs font-bold text-amber-300">
                    胸前空缺（未悬挂工作证）
                  </div>
                ) : (
                  <div
                    className={`mt-1 rounded border-2 bg-white p-2 text-slate-900 ${
                      focusedWorker.badgeStatus === 'expired'
                        ? 'border-red-500'
                        : 'border-emerald-500'
                    }`}
                  >
                    <div
                      className={`-mx-2 -mt-2 mb-1 px-2 py-0.5 text-[10px] font-bold text-white ${
                        focusedWorker.badgeStatus === 'expired'
                          ? 'bg-red-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      变电检修作业胸牌 · {focusedWorker.empId}
                    </div>
                    <div className="font-bold text-slate-900">
                      {focusedWorker.name}（{focusedWorker.certName}）
                    </div>
                    <div className="font-mono text-[10.5px] text-slate-600">
                      证号：{focusedWorker.certNo}
                    </div>
                    <div
                      className={`mt-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                        focusedWorker.badgeStatus === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      有效期至：{focusedWorker.certExpiry}
                    </div>
                  </div>
                )}
              </div>

              {/* 3D 模型外观特征提示 */}
              <div className="flex flex-col justify-between rounded border border-slate-700 bg-slate-950 p-2">
                <div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    【3D 模型着装与安全帽目视】
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-300">
                    请直接观察左侧 3D 视窗中该人员模型的上衣颜色、胸腰处是否有银色阻燃反光条，以及头顶安全帽佩戴情况。
                  </p>
                </div>
                <div className="mt-2 rounded bg-slate-900 px-2 py-1 font-mono text-[10.5px] text-sky-300">
                  提示：标准检修工装为深蓝阻燃服（配银色反光带）
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-600">
            当前为【全景列队视角】：可在左侧 3D 视窗直接清点到场总人数、观察全员工作服颜色与安全帽；点击上方人员按钮可拉近镜头查看其胸前工作证有效期。
          </p>
        )}
      </div>

      {/* 4. 玩家手动勾选的目视核对表 */}
      <div className="mt-2.5 space-y-2 rounded-md border border-slate-200 bg-white p-2.5">
        <div className="text-[11px] font-bold text-slate-800">
          三、监理现场目视核对结论（请根据 3D 视窗观察结果如实勾选）：
        </div>

        {/* (1) 现场实到人数清点 */}
        <div className="grid grid-cols-1 gap-1.5 rounded border border-slate-100 bg-slate-50/70 p-2 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
              <Users className="h-3.5 w-3.5 text-sky-700" />
              <span>1. 清点 3D 现场实到总人数：</span>
            </div>
            <div className="mt-1 flex gap-1.5">
              {[4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => updateJudgment('countedSiteTotal', count)}
                  className={`flex-1 rounded border py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    judgment.countedSiteTotal === count
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
                  }`}
                >
                  {count} 人
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-700">
              2. 实到人数与票面登记（{roster.permitTotalCount}人）比对：
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateJudgment('headcountVerdict', 'matched')}
                className={`rounded border py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.headcountVerdict === 'matched'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
                }`}
              >
                人数相符
              </button>
              <button
                type="button"
                onClick={() => updateJudgment('headcountVerdict', 'mismatched')}
                className={`rounded border py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.headcountVerdict === 'mismatched'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400'
                }`}
              >
                人数不符
              </button>
            </div>
          </div>
        </div>

        {/* (2) 工作证有效性核对 */}
        <div className="rounded border border-slate-100 bg-slate-50/70 p-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
            <BadgeCheck className="h-3.5 w-3.5 text-sky-700" />
            <span>3. 现场人员胸前工作证 / 特种作业证有效期核对：</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateJudgment('badgeVerdict', 'all_valid')}
              className={`rounded border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                judgment.badgeVerdict === 'all_valid'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
              }`}
            >
              全员持有效绿牌（未过期）
            </button>
            <button
              type="button"
              onClick={() => updateJudgment('badgeVerdict', 'has_invalid')}
              className={`rounded border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                judgment.badgeVerdict === 'has_invalid'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400'
              }`}
            >
              存在红牌超期或未挂胸牌
            </button>
          </div>
        </div>

        {/* (3) 阻燃工作服与安全帽核对 */}
        <div className="grid grid-cols-1 gap-1.5 rounded border border-slate-100 bg-slate-50/70 p-2 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
              <Shirt className="h-3.5 w-3.5 text-sky-700" />
              <span>4. 阻燃工作服着装核对：</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateJudgment('uniformVerdict', 'all_standard')}
                className={`rounded border px-1.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.uniformVerdict === 'all_standard'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
                }`}
              >
                全员标准阻燃服
              </button>
              <button
                type="button"
                onClick={() =>
                  updateJudgment('uniformVerdict', 'has_irregular')
                }
                className={`rounded border px-1.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.uniformVerdict === 'has_irregular'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400'
                }`}
              >
                存在便装/非标服
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
              <HardHat className="h-3.5 w-3.5 text-sky-700" />
              <span>5. 安全帽佩戴核对：</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => updateJudgment('helmetVerdict', 'all_standard')}
                className={`rounded border px-1.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.helmetVerdict === 'all_standard'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400'
                }`}
              >
                全员规范佩戴
              </button>
              <button
                type="button"
                onClick={() => updateJudgment('helmetVerdict', 'has_defect')}
                className={`rounded border px-1.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  judgment.helmetVerdict === 'has_defect'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-amber-400'
                }`}
              >
                存在未戴安全帽
              </button>
            </div>
          </div>
        </div>

        {/* 核对不符提示 */}
        {errorMessages.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-900">
            <div className="flex items-center gap-1 font-bold text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>目视核对结论与 3D 现场实情不符，请复核：</span>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {errorMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 核对通过后的签认状态栏 */}
        {permitVerified && (
          <div className="flex items-start gap-1.5 rounded border border-emerald-300 bg-emerald-50 p-2 text-[11px] text-emerald-950">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <div>
              <span className="font-bold">《工作票》现场核对已签认：</span>
              <span>{roster.overallSummary}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-500">
            {permitVerified
              ? '已完成人证与着装核对，请在下方选择处置等级'
              : '完成全部 5 项视觉比对后点击右侧按钮签认'}
          </span>
          <button
            type="button"
            onClick={handleVerifySubmit}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
              permitVerified
                ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500'
                : 'border-sky-600 bg-sky-600 text-white hover:bg-sky-500'
            }`}
          >
            {permitVerified
              ? '✓ 已签认《工作票》核对结论'
              : '确认核对结论并签注工作票'}
          </button>
        </div>
      </div>
    </section>
  );
}
