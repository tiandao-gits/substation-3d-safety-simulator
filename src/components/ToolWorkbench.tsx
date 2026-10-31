import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  Plane,
  ScanLine,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type {
  Act1ActionSpec,
  Act1Grade,
  Act1PointDef,
  Act1Reading,
  Act1Tool,
} from '../game/act1';
import { dispositionNeedsEvidence } from '../game/act1';
import { DISPOSITION_PROFILES } from '../config/disposition';
import { INSPECTION_POINT_DETAILS } from '../config/inspectionDetails';
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
  covered: boolean;
  observed: boolean;
  completedActions: string[];
  resolved: boolean;
  disposition?: Act1Grade;
  evidenceAttached: boolean;
  evidencePerspective?: 'drone';
  observationText: string;
  readings: Act1Reading[];
  reviewChances?: number;
  message?: string | null;
  completedPointsCount?: number;
  totalPointsCount?: number;
  onToolAction: (tool: Act1Tool | 'visual', actionId: string) => void;
  onVisualInspect: () => void;
  onDisposition: (grade: Act1Grade) => void;
  onCapture: () => void;
  onRequestDrone: () => void;
  onClose: () => void;
}

export function ToolWorkbench({
  point,
  covered,
  observed,
  completedActions,
  resolved,
  disposition,
  evidenceAttached,
  evidencePerspective,
  observationText,
  readings,
  reviewChances = 0,
  message,
  completedPointsCount = 0,
  totalPointsCount = 3,
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

  const detectionActions = useMemo(() => {
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
    const toolActions = Object.values(point.actions)
      .flat()
      .filter(
        (spec): spec is Act1ActionSpec =>
          Boolean(spec) && spec.id !== 'visual' && spec.quality === 'ok'
      );
    return [...droneRecon, ...toolActions];
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

  const canFinish = resolved;
  const visualOnly = detectionActions.length === 0;

  const renderStatus = (action: Act1ActionSpec) => {
    if (!observed) return { label: '待观察', cls: 'border-slate-200 bg-slate-50 text-slate-400' };
    if (covered) return { label: '已检测', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    if (completedIds.has(action.id))
      return { label: '已检测', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    return { label: '待检测', cls: 'border-amber-300 bg-amber-50 text-amber-800' };
  };

  return (
    <>
      <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-[3px] pointer-events-auto select-none sm:p-5">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`巡检：${point.name}`}
          className="modal-panel relative flex max-h-[92vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white text-left text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-amber-800">
                {detail?.voltageLevel ?? '220kV'}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold tracking-wide text-slate-900">
                  {point.name}
                </h2>
                <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {detail?.bayName ?? point.zone}
                </div>
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
            <section className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5">
              <div className="mb-0.5 text-xs font-bold tracking-wide text-sky-800">
                任务说明
              </div>
              <p className="text-[12.5px] leading-5 text-slate-700">
                {detail?.taskIntro ?? point.clue}
              </p>
              <div className="mt-1.5 flex items-start gap-2 border-t border-sky-200 pt-1.5 text-xs leading-4 text-slate-600">
                <span className="shrink-0 font-bold text-amber-700">安规要点</span>
                <span>{detail?.safetyRequirement ?? '与带电体保持 3 m 以上。'}</span>
              </div>
            </section>

            {/* Step 1 — observation is mandatory */}
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 font-mono text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-xs font-bold tracking-wide text-slate-700">
                    观察现场
                  </h3>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                    必做
                  </span>
                  {observed && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <button
                  type="button"
                  onClick={onVisualInspect}
                  className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    observed
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-sky-500 bg-sky-600 text-white hover:bg-sky-500'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{observed ? '重新观察' : '肉眼观察'}</span>
                </button>
              </div>
              {observed && (
                <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
                  {observationText}
                </p>
              )}
            </section>

            {/* Step 2 — every detection point must be measured */}
            <section
              className={`rounded-lg border bg-white p-3 shadow-sm ${
                observed ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 font-mono text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-xs font-bold tracking-wide text-slate-700">
                    逐项检测
                  </h3>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                    {detectionActions.length + (visualOnly ? 1 : 0)} 项
                  </span>
                  {covered && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <span className="text-xs text-slate-400">
                  全部检测完成后才能处置
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {visualOnly && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold text-slate-800">
                        现场观察判定
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        本点位以观察结果作为检测依据
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${
                        observed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      {observed ? '已完成' : '待观察'}
                    </span>
                  </div>
                )}

                {detectionActions.map((action) => {
                  const status = renderStatus(action);
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-slate-800">
                          {action.label}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {action.id === 'drone-recon'
                            ? '启动无人机升空，对准人员取景后完成检测'
                            : action.tool === 'thermometer'
                              ? '选择红外测温仪后可选择三相、单相或扫测'
                              : '选择仪器读取该测点数据'}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${status.cls}`}
                        >
                          {status.label}
                        </span>
                        {action.id === 'drone-recon' ? (
                          <button
                            type="button"
                            disabled={!observed || completedIds.has(action.id)}
                            onClick={onRequestDrone}
                            className={`flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                              observed && !completedIds.has(action.id)
                                ? 'cursor-pointer border-sky-400 bg-sky-50 text-sky-800 hover:bg-sky-100'
                                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Plane className="h-3.5 w-3.5" />
                            <span>
                              {completedIds.has(action.id) ? '已完成' : '升空 [U]'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!observed}
                            onClick={() => {
                              setModeChoices(null);
                              setDrawerAction(action);
                            }}
                            className={`flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                              observed
                                ? 'cursor-pointer border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>检测</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {readings.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                  <span className="text-xs font-bold text-emerald-700">
                    实测读数
                  </span>
                  {readings.map((reading, index) => {
                    const reference = (reading.quality ?? 'ok') !== 'ok';
                    return (
                      <span
                        key={`${reading.label}-${index}`}
                        className={`rounded border px-1.5 py-0.5 font-mono text-xs font-semibold ${
                          reference
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {reading.label} {reading.unit}
                        {reference ? ' · 参考' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Step 3 — 定级即结论：P0 正常记录，P1 及以上必须现场取证 */}
            <section
              className={`rounded-lg border bg-white p-3 shadow-sm ${
                covered ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 font-mono text-xs font-bold text-white">
                    3
                  </span>
                  <h3 className="text-xs font-bold tracking-wide text-slate-700">
                    处置定级
                  </h3>
                  {resolved && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <span className="whitespace-nowrap text-xs font-semibold text-sky-800">
                  {profileDef.subject}
                </span>
              </div>

              <div className="mt-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    处置等级
                  </span>
                  <span className="text-xs text-slate-500">
                    P0 即正常记录；P1 及以上需拍照取证
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                            : selected
                              ? 'cursor-pointer border-amber-500 bg-amber-50 ring-1 ring-amber-300'
                              : 'cursor-pointer border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                        }`}
                      >
                        <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-bold text-slate-800">
                          <span className="font-mono text-amber-700">
                            {option.grade}
                          </span>
                          <span className="truncate">{option.label}</span>
                          {selected && (
                            <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-600" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!covered && (
                  <p className="mt-1 text-xs text-slate-500">
                    完成观察与全部检测后才能定级。
                  </p>
                )}
              </div>

              {disposition === 'P0' && (
                <p className="mt-2 flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-800">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  已按正常记录，不取证、不整改。
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
                        现场拍照
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
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>本幕进度</span>
                <span className="font-bold text-slate-800">
                  {completedPointsCount} / {totalPointsCount}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-amber-700">检查机会 {reviewChances}</span>
                <span className="text-slate-300">|</span>
                <span className={resolved ? 'font-medium text-emerald-700' : ''}>
                  {resolved
                    ? '当前点位已处理'
                    : covered
                      ? needsEvidence && !evidenceAttached
                        ? `${disposition} 级需拍照取证`
                        : '选择处置等级'
                      : '需完成观察与全部检测'}
                </span>
              </div>

              <button
                type="button"
                disabled={!canFinish}
                onClick={onClose}
                className={`flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm font-bold transition-colors ${
                  canFinish
                    ? 'cursor-pointer border-sky-500 bg-sky-600 text-white hover:bg-sky-500'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
              >
                <ScanLine className="h-4 w-4" />
                <span>处理完成</span>
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
