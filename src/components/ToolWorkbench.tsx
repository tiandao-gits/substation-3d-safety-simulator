import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  Eye,
  Plane,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  ACT_AMBIENT,
  dispositionNeedsEvidence,
  type Act1ActionSpec,
  type Act1Grade,
  type Act1PointDef,
  type Act1Reading,
  type Act1Tool,
  type Act1Variant,
} from '../game/act1';
import { DISPOSITION_PROFILES } from '../config/disposition';
import { INSPECTION_POINT_DETAILS } from '../config/inspectionDetails';
import { buildInspectionReadout } from '../config/inspectionReadouts';
import { BACKPACK_DISPLAY_ITEMS } from '../config/gameText';
import { useFocusTrap } from './useFocusTrap';
import { ToolSprite } from './ToolSprite';

/** 红外读数方式的能力边界：只有同距同角三相读数能作为判级依据。 */
const MEASURE_MODE_HINT: Record<string, string> = {
  'ir-3': '三相同距同角，可作为定级依据',
  'ir-1': '仅记录 A 相，无法比对相间温差，不计入检测',
  'ir-casual': '距离/角度未稳定，读数仅作参考，不计入检测',
};

interface ToolWorkbenchProps {
  point: Act1PointDef;
  variant?: Act1Variant;
  covered: boolean;
  observed: boolean;
  completedActions: string[];
  resolved: boolean;
  disposition?: Act1Grade;
  evidenceAttached: boolean;
  evidenceDataUrl?: string;
  evidencePerspective?: 'drone';
  observationText: string;
  readings: Act1Reading[];
  reviewChances?: number;
  message?: string | null;
  onToolAction: (tool: Act1Tool | 'visual', actionId: string) => void;
  onVisualInspect: () => void;
  onDisposition: (grade: Act1Grade) => void;
  onCapture: () => void;
  onRequestDrone: () => void;
  onClose: () => void;
}

/**
 * 巡检工作台分两栏：
 * - 左栏（桌面）：3D 实景特写 + 观察/仪器检测靶点 + 遥测判据屏，是"做检查"的地方；
 * - 右栏：处置单，只负责填结论（巡检点说明 → 处置结果 → 提交），不重复检测操作。
 * 窄屏没有左栏，操作区以 compact 形式并入右栏，保证流程不断。
 */
export function ToolWorkbench({
  point,
  variant = 'A',
  covered,
  observed,
  completedActions,
  resolved,
  disposition,
  evidenceAttached,
  evidenceDataUrl,
  evidencePerspective,
  observationText,
  readings,
  reviewChances = 0,
  message,
  onToolAction,
  onVisualInspect,
  onDisposition,
  onCapture,
  onRequestDrone,
  onClose,
}: ToolWorkbenchProps) {
  const ref = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  const detail = INSPECTION_POINT_DETAILS[point.id];
  const profileDef = DISPOSITION_PROFILES[point.profile];
  const needsEvidence = dispositionNeedsEvidence(disposition);
  const selectedOption = profileDef.options.find(
    (option) => option.grade === disposition
  );

  const [drawerAction, setDrawerAction] = useState<Act1ActionSpec | null>(null);
  const [modeChoices, setModeChoices] = useState<{
    toolId: Act1Tool;
    specs: Act1ActionSpec[];
  } | null>(null);

  useEffect(() => {
    if (!needsEvidence) return;
    const id = window.requestAnimationFrame(() => {
      evidenceRef.current?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [needsEvidence]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'KeyG') {
        event.preventDefault();
        event.stopPropagation();
        if (covered && needsEvidence) onCapture();
      } else if (event.code === 'KeyX') {
        event.preventDefault();
        event.stopPropagation();
        if (modeChoices) setModeChoices(null);
        else if (drawerAction) setDrawerAction(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [covered, needsEvidence, onCapture, onClose, drawerAction, modeChoices]);

  const { requiredDetectionActions, auxiliaryDetectionActions } = useMemo(() => {
    const droneRecon: Act1ActionSpec[] = point.requiredActions.includes(
      'drone-recon'
    )
      ? [
          {
            id: 'drone-recon',
            label: '升空观察取证',
            tool: 'visual',
            quality: 'ok',
          },
        ]
      : [];
    const allToolActions = Object.values(point.actions)
      .flat()
      .filter(
        (spec): spec is Act1ActionSpec =>
          Boolean(spec) && spec.id !== 'visual' && spec.quality === 'ok'
      );
    const reqIds = new Set(point.requiredActions);
    const required = [
      ...droneRecon,
      ...allToolActions.filter((spec) => reqIds.has(spec.id)),
    ];
    const auxiliary = allToolActions.filter((spec) => !reqIds.has(spec.id));
    return {
      requiredDetectionActions: required,
      auxiliaryDetectionActions: auxiliary,
    };
  }, [point.actions, point.requiredActions]);

  const completedIds = useMemo(() => new Set(completedActions), [completedActions]);

  const handleDrawerSelect = (toolId: Act1Tool) => {
    if (!drawerAction) return;
    const action = drawerAction;
    if (action.tool !== toolId) {
      setDrawerAction(null);
      onToolAction(toolId, 'invalid');
      return;
    }
    // 同一仪器在同一测点有多种读数方式（红外三相/单相/扫测）时先选方式。
    const specs = point.actions[toolId] ?? [];
    if (specs.length > 1) {
      setModeChoices({ toolId, specs });
      return;
    }
    setDrawerAction(null);
    onToolAction(toolId, action.id);
  };

  const handleModeSelect = (spec: Act1ActionSpec) => {
    if (!modeChoices) return;
    setModeChoices(null);
    setDrawerAction(null);
    onToolAction(modeChoices.toolId, spec.id);
  };

  const ambientC = ACT_AMBIENT[point.act].temperatureC;

  /** 所有巡检点统一走这套读数模型：只给仪器读数，判定权留给玩家。 */
  const readout = useMemo(
    () => buildInspectionReadout(point, readings, completedActions, variant),
    [point, readings, completedActions, variant]
  );

  const statusText = resolved
    ? '填写完整，可提交。'
    : needsEvidence && !evidenceAttached
      ? `${disposition} 级处置需附现场取证照片后才能提交。`
      : covered
        ? '请选择处置等级。'
        : '处置单尚未填写完整。';

  return (
    <>
      <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center lg:justify-between overflow-hidden bg-slate-950/20 p-3 pointer-events-auto select-none sm:p-5 lg:px-7">
        {/* Left-Side Interactive 3D Viewport & Instrument HUD */}
        <div className="relative hidden lg:flex flex-col justify-between h-[86vh] flex-1 mr-6 rounded-xl border border-sky-400/40 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/45 p-4 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-sky-400/50 bg-slate-950/85 px-3 py-1.5 font-mono text-xs text-sky-200 shadow-lg">
              <ScanLine className="h-3.5 w-3.5 text-sky-400" />
              <span>3D 实景特写 · {detail?.bayName ?? point.zone}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
                可直接点击 3D 视窗靶点实操
              </span>
              <span className="rounded border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 font-mono text-[11px] text-slate-300">
                检查机会 {reviewChances}
              </span>
              <span className="rounded border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 font-mono text-[11px] text-slate-300">
                坐标 X {point.x.toFixed(1)} / Z {point.z.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Interactive 3D Target Reticle Hotspots overlaid on the 3D close-up */}
          <div className="relative my-auto flex flex-col items-center justify-center gap-3 py-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onVisualInspect}
                className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                  observed
                    ? 'border-emerald-400/80 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900/90'
                    : 'border-sky-400 bg-sky-950/85 text-sky-100 ring-2 ring-sky-400/40 hover:bg-sky-900'
                }`}
              >
                <Eye className="h-4 w-4 text-sky-300" />
                <span>[1] 3D 实景观察：{point.shortName}</span>
                {observed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </button>

              {requiredDetectionActions.map((action) => {
                const done = completedIds.has(action.id) || covered;
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={!observed || (action.id === 'drone-recon' && done)}
                    onClick={() => {
                      if (action.id === 'drone-recon') {
                        onRequestDrone();
                      } else {
                        setModeChoices(null);
                        setDrawerAction(action);
                      }
                    }}
                    className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur-md transition-all ${
                      !observed
                        ? 'cursor-not-allowed border-slate-700 bg-slate-950/65 text-slate-500'
                        : done
                          ? 'cursor-pointer border-emerald-400/80 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900/90'
                          : 'cursor-pointer border-amber-400 bg-amber-950/85 text-amber-100 ring-2 ring-amber-400/40 hover:bg-amber-900/90'
                    }`}
                  >
                    <Crosshair className="h-4 w-4 text-amber-300" />
                    <span>[2] 实景测点：{action.label}</span>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                );
              })}

              {auxiliaryDetectionActions.map((action) => {
                const done = completedIds.has(action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={!observed}
                    onClick={() => {
                      setModeChoices(null);
                      setDrawerAction(action);
                    }}
                    className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all ${
                      !observed
                        ? 'cursor-not-allowed border-slate-700 bg-slate-950/60 text-slate-500'
                        : done
                          ? 'cursor-pointer border-emerald-400/70 bg-emerald-950/75 text-emerald-200'
                          : 'cursor-pointer border-sky-400/70 bg-slate-950/80 text-sky-200 hover:border-sky-300 hover:bg-sky-950/90'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                    <span>[专项复核] {action.label}</span>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom 3D Instrument Telemetry & Scene Clue Card */}
          <div className="space-y-2">
            {observed && (
              <div className="rounded-lg border border-sky-500/40 bg-slate-950/90 px-4 py-3 text-slate-100 shadow-lg">
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-sky-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Activity className="h-3.5 w-3.5 text-sky-400" />
                    <span>3D 现场遥测读数屏</span>
                  </span>
                  <span>环温 T₀ = {ambientC} ℃</span>
                </div>

                {readout ? (
                  <>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold tracking-[0.12em] text-sky-300/90">
                          {readout.primary.label}
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span
                            className="text-[54px] font-black leading-none tabular-nums text-white"
                            style={{
                              textShadow:
                                '0 0 22px rgba(186,230,253,0.45), 0 0 48px rgba(56,189,248,0.22)',
                            }}
                          >
                            {readout.primary.value}
                          </span>
                          {readout.primary.unit && (
                            <span className="text-xl font-bold text-slate-300">
                              {readout.primary.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {readout.secondary.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-stretch gap-1.5">
                        {readout.secondary.map((metric) => (
                          <span
                            key={metric.key}
                            className="inline-flex items-baseline gap-1.5 rounded border border-slate-600/70 bg-slate-800/60 px-2 py-1 font-mono text-slate-200"
                          >
                            <span className="text-[11px] opacity-80">{metric.label}</span>
                            <span className="text-base font-black tabular-nums">
                              {metric.value}
                            </span>
                            {metric.unit && (
                              <span className="text-[11px] opacity-80">{metric.unit}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {readout.note && (
                      <div className="mt-2 border-t border-slate-700/80 pt-1.5 font-mono text-[11px] leading-4 text-slate-500">
                        <span className="text-sky-300">读数 </span>
                        {readout.note}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs leading-5 text-slate-400">
                    已观察，尚未取得仪器读数 —— 点击上方测点选择仪器检测，读数会在这里放大显示。
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-slate-700/70 bg-slate-950/85 px-3.5 py-2.5 text-xs leading-5 text-slate-200 shadow-lg">
              <span className="font-bold text-sky-300">现场特征：</span>
              <span>{point.clue}</span>
            </div>
          </div>
        </div>

        {/* Right-Side Disposition Sheet */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`处置单：${point.name}`}
          className="modal-panel relative flex max-h-[92vh] w-full max-w-[560px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-amber-500 bg-white text-left text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.55)]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.16em] text-amber-700">
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>处置单 · DISPOSITION</span>
                <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] tracking-normal text-amber-800">
                  {detail?.voltageLevel ?? '220kV'}
                </span>
              </div>
              <h2 className="mt-1 truncate text-base font-bold tracking-wide text-slate-900">
                {point.name}
              </h2>
              <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                {detail?.bayName ?? point.zone}
                {detail?.equipmentType ? ` · ${detail.equipmentType}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              [X] 关闭
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-700">
                巡检点说明
              </h3>
              <p className="text-[12.5px] leading-5 text-slate-700">
                {detail?.taskIntro ?? point.clue}
              </p>
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <div className="min-w-0 text-[11.5px] leading-4 text-amber-900">
                  <span className="font-bold">安规要点 </span>
                  {detail?.safetyRequirement ?? '与带电体保持 3 m 以上。'}
                </div>
              </div>
            </section>

            {/* 窄屏没有左侧 3D 视窗：观察与仪器检测在这里完成，避免流程断掉 */}
            <section className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 lg:hidden">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-sky-900">
                  现场操作
                </h3>
                <span className="text-[10.5px] text-sky-700">
                  桌面端在左侧 3D 视窗操作
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                    <Eye className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                    <span className="truncate">现场观察</span>
                    {observed && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={onVisualInspect}
                    className={`flex min-h-8 shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                      observed
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-sky-500 bg-sky-600 text-white'
                    }`}
                  >
                    {observed ? '重新观察' : '观察'}
                  </button>
                </div>

                {requiredDetectionActions.map((action) => {
                  const done = completedIds.has(action.id) || covered;
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <span className="min-w-0 truncate text-[12px] font-semibold text-slate-800">
                        {action.label}
                      </span>
                      <button
                        type="button"
                        disabled={!observed || done}
                        onClick={() => {
                          if (action.id === 'drone-recon') onRequestDrone();
                          else {
                            setModeChoices(null);
                            setDrawerAction(action);
                          }
                        }}
                        className={`flex min-h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          done
                            ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                            : observed
                              ? 'cursor-pointer border-amber-400 bg-amber-100 text-amber-800'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {action.id === 'drone-recon' ? (
                          <Plane className="h-3.5 w-3.5" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5" />
                        )}
                        <span>{done ? '已完成' : action.id === 'drone-recon' ? '升空' : '检测'}</span>
                      </button>
                    </div>
                  );
                })}

                {auxiliaryDetectionActions.map((action) => {
                  const done = completedIds.has(action.id);
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-dashed border-sky-200 bg-white px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-slate-800">
                        <span className="truncate">{action.label}</span>
                        <span className="shrink-0 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold text-sky-700">
                          复核
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={!observed || done}
                        onClick={() => {
                          setModeChoices(null);
                          setDrawerAction(action);
                        }}
                        className={`flex min-h-8 shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          done
                            ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                            : observed
                              ? 'cursor-pointer border-sky-400 bg-white text-sky-800'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {done ? '已完成' : '复核'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {observed && (
                <p className="mt-2 rounded bg-white/85 px-2.5 py-1.5 text-[11.5px] leading-4 text-slate-600">
                  {observationText}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-slate-700">
                  处置结果
                </h3>
                <span className="whitespace-nowrap text-[11px] font-semibold text-sky-800">
                  {profileDef.subject}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {profileDef.basis}
              </p>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {profileDef.options.map((option) => {
                  const selected = disposition === option.grade;
                  return (
                    <button
                      key={option.grade}
                      type="button"
                      disabled={!covered}
                      title={option.hint}
                      onClick={() => onDisposition(option.grade)}
                      className={`min-h-9 rounded-md border px-2.5 py-1 text-left transition-colors ${
                        !covered
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                          : selected
                            ? 'cursor-pointer border-amber-500 bg-amber-50 ring-1 ring-amber-300'
                            : 'cursor-pointer border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-bold text-slate-800">
                        <span className="font-mono text-amber-700">{option.grade}</span>
                        <span className="truncate">{option.label}</span>
                        {selected && (
                          <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {disposition && selectedOption ? (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-amber-900">
                      已填写 {disposition} · {selectedOption.label}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-4 text-amber-800">
                      {selectedOption.hint}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11.5px] leading-4 text-slate-500">
                  {covered
                    ? '请选择处置等级；P0 即正常记录，P1 及以上需拍照取证。'
                    : '完成现场观察与全部必测项后，才能填写处置结果。'}
                </p>
              )}

              {disposition === 'P0' && (
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-sky-800">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  正常记录：不取证、不整改，可直接提交。
                </p>
              )}

              {needsEvidence && (
                <div
                  ref={evidenceRef}
                  className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-xs font-bold text-amber-800">
                        现场取证
                      </span>
                      {evidencePerspective === 'drone' && (
                        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          需空中视角 [U] 取景
                        </span>
                      )}
                      {evidenceAttached && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                          已取证
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onCapture}
                      className="flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{evidenceAttached ? '重新拍照' : '拍照 [G]'}</span>
                    </button>
                  </div>
                  {evidenceAttached && evidenceDataUrl && (
                    <div className="overflow-hidden rounded-md border border-emerald-300 bg-slate-950">
                      <img
                        src={evidenceDataUrl}
                        alt={`${point.name} 现场取证照片`}
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  )}
                  {!evidenceAttached && (
                    <p className="text-xs text-slate-500">
                      {disposition} 级处置必须附现场证据，拍照后本点位才算闭环。
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            {message && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                {message}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[11.5px] leading-4 text-slate-500">
                {statusText}
              </p>
              <button
                type="button"
                disabled={!resolved}
                onClick={onClose}
                className={`flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm font-bold transition-colors ${
                  resolved
                    ? 'cursor-pointer border-amber-500 bg-amber-600 text-white hover:bg-amber-500'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>提交处置单</span>
              </button>
            </div>
          </footer>
        </div>
      </div>

      {drawerAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="选择检测仪器"
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-[3px] pointer-events-auto select-none"
        >
          <div className="modal-panel relative flex max-h-[90vh] w-full max-w-[700px] flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-[0.16em] text-sky-700">
                  INSTRUMENTS
                </div>
                <h3 className="mt-0.5 truncate text-base font-bold text-slate-900">
                  {modeChoices ? '选择读数方式' : '选择检测仪器'}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  测点：{drawerAction.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModeChoices(null);
                  setDrawerAction(null);
                }}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>取消</span>
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto bg-slate-50 p-3">
              {modeChoices ? (
                <div className="space-y-2">
                  {modeChoices.specs.map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => handleModeSelect(spec)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-bold text-slate-800">
                          {spec.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {MEASURE_MODE_HINT[spec.id] ?? ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${
                          spec.quality === 'ok'
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {spec.quality === 'ok' ? '可判级' : '仅参考'}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setModeChoices(null)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
                  >
                    返回仪器列表
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {BACKPACK_DISPLAY_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleDrawerSelect(item.toolId as Act1Tool)}
                      className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm transition-all hover:border-sky-400 hover:shadow-md cursor-pointer"
                    >
                      <ToolSprite item={item} />
                      <div className="truncate border-t border-slate-100 px-2 py-1.5 text-xs font-bold text-slate-700 group-hover:text-sky-800">
                        {item.label}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-2.5 text-xs text-slate-500">
              <span>
                选错仪器会消耗检查机会，剩余{' '}
                <span className="font-bold text-amber-700">{reviewChances}</span> 次。
              </span>
              <button
                type="button"
                onClick={() => {
                  setModeChoices(null);
                  setDrawerAction(null);
                }}
                className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
