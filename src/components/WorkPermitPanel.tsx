import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  HardHat,
  RefreshCw,
  ShieldAlert,
  Shirt,
  Users,
} from 'lucide-react';
import type { Act1Variant } from '../game/act1';
import { soundEngine } from '../game/sound';
import {
  createInitialPermitVerification,
  generateWorkPermitRoster,
  type CrewWorkerVisualSpec,
  type WorkPermitRoster,
} from '../game/workPermit';

interface WorkPermitPanelProps {
  seed: number;
  variant: Act1Variant;
  observed: boolean;
  logDone: boolean;
  onSyncRosterTo3D?: (roster: WorkPermitRoster) => void;
  onCompletePermitCheck: () => void;
}

export function WorkPermitPanel({
  seed,
  variant,
  observed,
  logDone,
  onSyncRosterTo3D,
  onCompletePermitCheck,
}: WorkPermitPanelProps) {
  const [sampleOffset, setSampleOffset] = useState(0);

  const roster = useMemo(
    () => generateWorkPermitRoster(seed, variant, sampleOffset),
    [seed, variant, sampleOffset]
  );

  const [verification, setVerification] = useState(() =>
    createInitialPermitVerification(roster)
  );

  useEffect(() => {
    setVerification(createInitialPermitVerification(roster));
    onSyncRosterTo3D?.(roster);
  }, [roster, onSyncRosterTo3D]);

  const visibleOrListedWorkers = useMemo(
    () =>
      [roster.leader, ...roster.workers].filter(
        (w) => w.listedOnPermit || w.presentOnSite
      ),
    [roster]
  );

  const toggleWorkerField = (
    nodeName: string,
    field: 'badgeChecked' | 'uniformChecked' | 'helmetChecked' | 'flaggedAnomaly'
  ) => {
    soundEngine.playUiBeep();
    setVerification((prev) => {
      const current = prev.workers[nodeName] ?? {
        badgeChecked: false,
        uniformChecked: false,
        helmetChecked: false,
        flaggedAnomaly: false,
      };
      return {
        ...prev,
        workers: {
          ...prev.workers,
          [nodeName]: {
            ...current,
            [field]: !current[field],
          },
        },
      };
    });
  };

  const handleConfirmAllPerson = (spec: CrewWorkerVisualSpec) => {
    soundEngine.playUiBeep();
    const hasDefect =
      spec.badgeStatus !== 'valid' ||
      spec.uniformStatus !== 'standard' ||
      !spec.listedOnPermit ||
      !spec.presentOnSite;
    setVerification((prev) => ({
      ...prev,
      workers: {
        ...prev.workers,
        [spec.nodeName]: {
          badgeChecked: true,
          uniformChecked: true,
          helmetChecked: true,
          flaggedAnomaly: hasDefect,
        },
      },
    }));
  };

  const handleQuickVerifyAll = () => {
    soundEngine.playLaserMeasure();
    const nextWorkers: typeof verification.workers = {};
    for (const w of visibleOrListedWorkers) {
      const hasDefect =
        w.badgeStatus !== 'valid' ||
        w.uniformStatus !== 'standard' ||
        !w.listedOnPermit ||
        !w.presentOnSite;
      nextWorkers[w.nodeName] = {
        badgeChecked: true,
        uniformChecked: true,
        helmetChecked: true,
        flaggedAnomaly: hasDefect,
      };
    }
    setVerification({
      headcountChecked: true,
      workers: nextWorkers,
    });
    if (observed) {
      onCompletePermitCheck();
    }
  };

  const checkedWorkerCount = visibleOrListedWorkers.filter((w) => {
    const rec = verification.workers[w.nodeName];
    return rec && rec.badgeChecked && rec.uniformChecked && rec.helmetChecked;
  }).length;

  return (
    <section
      aria-label="工作票现场核对面板"
      className="rounded-lg border-2 border-sky-600/80 bg-slate-50 p-3 text-slate-900 shadow-sm"
    >
      {/* 票头与随机演练切换栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-wider text-sky-800">
            <ClipboardList className="h-3.5 w-3.5 text-sky-600" />
            <span>《变电站第一种工作票》现场人证与着装核对单</span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-600">
            票号：{roster.permitNo} · 样本：{roster.scenarioLabel}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {sampleOffset > 0 && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiBeep();
                setSampleOffset(0);
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              恢复主线样本
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiBeep();
              setSampleOffset((prev) => prev + 1);
            }}
            title="随机切换现场班组人数、工装颜色与工作证缺陷，并同步更新左侧 3D 场景中的工作人员模型"
            className="inline-flex items-center gap-1 rounded border border-sky-400 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-800 transition-colors hover:bg-sky-100 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>随机切换 3D 班组样本</span>
          </button>
        </div>
      </div>

      {/* 1. 票面人数 vs 3D 地图实到人数核对 */}
      <div className="mt-2.5 rounded-md border border-slate-200 bg-white p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-700" />
            <div className="text-xs">
              <span className="font-bold text-slate-800">人数匹配核查：</span>
              <span className="font-mono text-slate-700">
                工作票登记 <strong>{roster.permitTotalCount}</strong> 人（负责人1 + 组员
                {roster.permitTotalCount - 1}）
              </span>
              <span className="mx-1.5 text-slate-400">|</span>
              <span
                className={`font-mono font-bold ${
                  roster.headcountMatched ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                3D 现场实到 {roster.actualSiteCount} 人
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiBeep();
              setVerification((prev) => ({
                ...prev,
                headcountChecked: !prev.headcountChecked,
              }));
            }}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
              verification.headcountChecked
                ? roster.headcountMatched
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-red-400 bg-red-50 text-red-800'
                : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>
              {verification.headcountChecked
                ? roster.headcountMatched
                  ? '已确认：票面与现场人数一致'
                  : '已确认：票面与现场人数不符！'
                : '点击核对现场人数'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. 班组人员工作证、服装、安全帽逐人核对列表 */}
      <div className="mt-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span className="font-bold text-slate-800">
            现场人员逐一核验（对照 3D 视窗头顶标牌 #1~#4、胸前工牌与工装颜色）：
          </span>
          <span className="font-mono">
            已核验 {checkedWorkerCount}/{visibleOrListedWorkers.length} 人
          </span>
        </div>

        {visibleOrListedWorkers.map((person) => {
          const rec = verification.workers[person.nodeName] ?? {
            badgeChecked: false,
            uniformChecked: false,
            helmetChecked: false,
            flaggedAnomaly: false,
          };
          const allChecked =
            rec.badgeChecked && rec.uniformChecked && rec.helmetChecked;
          const hasAnyDefect =
            person.badgeStatus !== 'valid' ||
            person.uniformStatus !== 'standard' ||
            !person.listedOnPermit ||
            !person.presentOnSite;

          return (
            <div
              key={person.nodeName}
              className={`rounded-md border p-2.5 transition-colors ${
                hasAnyDefect && allChecked
                  ? 'border-red-300 bg-red-50/70'
                  : allChecked
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                      {person.tagCode}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {person.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      ({person.empId} · {person.role})
                    </span>
                    {!person.listedOnPermit && (
                      <span className="rounded border border-red-300 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                        票面未登记
                      </span>
                    )}
                    {!person.presentOnSite && (
                      <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        3D 现场未到岗
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-600">
                    <span>
                      证书：{person.certName} ({person.certNo})
                    </span>
                    <span
                      className={
                        person.badgeStatus === 'expired'
                          ? 'font-bold text-red-600'
                          : person.badgeStatus === 'missing'
                            ? 'font-bold text-amber-700'
                            : 'text-emerald-700'
                      }
                    >
                      有效期：{person.certExpiry}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleConfirmAllPerson(person)}
                  className="shrink-0 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-100 cursor-pointer"
                >
                  {allChecked ? '已核验该员' : '一键核验该员'}
                </button>
              </div>

              {/* 三项可视化特征核对按钮：工作证、工作服、安全帽（安全帽恒为合格） */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleWorkerField(person.nodeName, 'badgeChecked')}
                  className={`flex items-center justify-between rounded border px-2 py-1 text-left text-[11px] font-semibold cursor-pointer ${
                    rec.badgeChecked
                      ? person.badgeStatus === 'valid'
                        ? 'border-emerald-400 bg-emerald-100/80 text-emerald-900'
                        : 'border-red-400 bg-red-100/90 text-red-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                  }`}
                >
                  <span className="flex items-center gap-1 truncate">
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {rec.badgeChecked
                        ? person.badgeStatus === 'valid'
                          ? '工证:绿牌有效'
                          : person.badgeStatus === 'expired'
                            ? '工证:红牌超期!'
                            : '工证:胸前未挂!'
                        : '核对工作证'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleWorkerField(person.nodeName, 'uniformChecked')
                  }
                  className={`flex items-center justify-between rounded border px-2 py-1 text-left text-[11px] font-semibold cursor-pointer ${
                    rec.uniformChecked
                      ? person.uniformStatus === 'standard'
                        ? 'border-emerald-400 bg-emerald-100/80 text-emerald-900'
                        : 'border-red-400 bg-red-100/90 text-red-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                  }`}
                >
                  <span className="flex items-center gap-1 truncate">
                    <Shirt className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {rec.uniformChecked
                        ? person.uniformStatus === 'standard'
                          ? '服装:标准工装'
                          : '服装:违规便装!'
                        : '核对工作服'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    toggleWorkerField(person.nodeName, 'helmetChecked')
                  }
                  className={`flex items-center justify-between rounded border px-2 py-1 text-left text-[11px] font-semibold cursor-pointer ${
                    rec.helmetChecked
                      ? 'border-emerald-400 bg-emerald-100/80 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300'
                  }`}
                >
                  <span className="flex items-center gap-1 truncate">
                    <HardHat className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {rec.helmetChecked ? '安全帽:合格' : '核对安全帽'}
                    </span>
                  </span>
                </button>
              </div>

              {person.defectSummary && allChecked && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded border border-red-200 bg-red-100/70 px-2 py-1 text-[11px] font-semibold text-red-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>3D 实景违章项：{person.defectSummary}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. 核对汇总结论与登记入口 */}
      <div className="mt-3 rounded-md border border-sky-200 bg-sky-50/90 p-2.5">
        <div className="flex items-start gap-2 text-[11.5px] leading-4 text-slate-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div>
            <span className="font-bold text-sky-950">票面与 3D 现场核对摘要：</span>
            <span>{roster.overallSummary}</span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-600">
            {!observed
              ? '请先点击「[1] 3D 实景观察」后再完成工作票核查登记'
              : logDone
                ? '已完成《工作票》人证及三交核查记录'
                : '核对无误后点击右侧按钮写入工作台遥测读数'}
          </span>
          <button
            type="button"
            disabled={!observed}
            onClick={handleQuickVerifyAll}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
              !observed
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : logDone
                  ? 'cursor-pointer border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'cursor-pointer border-sky-600 bg-sky-600 text-white hover:bg-sky-500'
            }`}
          >
            {logDone ? '已签认《工作票》核对结果' : '一键核验全员并登记工作票'}
          </button>
        </div>
      </div>
    </section>
  );
}
