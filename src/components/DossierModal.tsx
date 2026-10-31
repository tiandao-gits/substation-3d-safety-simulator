import { useEffect, useState, useRef } from 'react';
import { ACT_DOSSIERS, ACT_TASK_CARDS } from '../config/dialogues';
import { getDispositionOption } from '../config/disposition';
import {
  ACT1_POINT_STATUS_LABELS,
  countResolvedPoints,
  dispositionNeedsEvidence,
  evaluateActOutcome,
  getAct1PointStatus,
  getAct1VisualText,
  getActName,
  getActPoints,
  getAdmissibleReading,
  isActComplete,
  isPointCovered,
  type Act1State,
  type ActNo,
} from '../game/act1';
import { useFocusTrap } from './useFocusTrap';

interface MemoSection {
  title: string;
  lines: string[];
}

function buildLogSection(act: ActNo, state: Act1State | null): MemoSection {
  if (!state) {
    return { title: '监理日志', lines: [`${getActName(act)}：本幕尚未开始。`] };
  }

  const points = getActPoints(act);
  const lines = [
    `本幕：${getActName(act)}`,
    `检查机会 ${state.reviewChances} · 进度 ${countResolvedPoints(state)}/${points.length}`,
  ];

  for (const point of points) {
    const pointState = state.points[point.id];
    const covered = isPointCovered(state, point.id);
    const status = ACT1_POINT_STATUS_LABELS[getAct1PointStatus(state, point.id)];
    const details: string[] = [status];

    const admissible = getAdmissibleReading(pointState);
    const reading = admissible ?? pointState?.readings[0];
    if (reading) {
      const suffix = admissible ? '' : '（参考）';
      details.push(`读数 ${reading.label} ${reading.unit}${suffix}`);
    }
    if (covered) {
      const finding = point.finding[state.variant];
      details.push(finding ? `发现：${finding.title}` : '发现：未见异常');
    }
    const grade = pointState?.disposition;
    if (grade) {
      const option = getDispositionOption(point.profile, grade);
      const needsEvidence = dispositionNeedsEvidence(grade);
      details.push(
        `处置：${needsEvidence ? '取证处理' : '正常记录'}${option ? `（${option.grade} ${option.label}）` : ''}`
      );
      if (needsEvidence) {
        details.push(pointState?.evidenceId ? '证据：已记录' : '证据：待补');
      }
    }

    lines.push(`${point.name}　${details.join('　|　')}`);
  }

  if (isActComplete(state)) {
    const outcome = evaluateActOutcome(state);
    if (outcome.unhandled.length > 0) {
      lines.push(`未闭环隐患：${outcome.unhandled.join('、')}`);
    }
  }

  return { title: '监理日志', lines };
}

function buildInspectionRecords(
  act: ActNo,
  state: Act1State | null
): MemoSection {
  if (!state) {
    return { title: '巡检记录', lines: [`${getActName(act)}：本幕尚未开始。`] };
  }

  const lines = [`本幕：${getActName(act)}`];
  for (const point of getActPoints(act)) {
    const pointState = state.points[point.id];
    const observed = Boolean(pointState?.completedActions.includes('visual'));
    const covered = isPointCovered(state, point.id);
    const status = ACT1_POINT_STATUS_LABELS[getAct1PointStatus(state, point.id)];

    lines.push(`${point.name}　${status}`);
    if (observed) lines.push(getAct1VisualText(point.id, state.variant));
    if (pointState?.completedActions.includes('drone-recon')) {
      lines.push('检测：升空观察取证已完成');
    }
    for (const reading of pointState?.readings ?? []) {
      const suffix = reading.quality === 'ok' ? '' : '（参考）';
      lines.push(`读数：${reading.label} ${reading.unit}${suffix}`);
    }
    if (covered) {
      const finding = point.finding[state.variant];
      lines.push(finding ? `发现：${finding.title}` : '发现：未见异常');
    }
    const grade = pointState?.disposition;
    if (grade) {
      const option = getDispositionOption(point.profile, grade);
      const needsEvidence = dispositionNeedsEvidence(grade);
      lines.push(
        `处置：${needsEvidence ? '取证处理' : '正常记录'}${option ? `（${option.grade} ${option.label}）` : ''}`
      );
      if (needsEvidence) {
        lines.push(pointState?.evidenceId ? '证据：已记录' : '证据：待补');
      }
    }
  }

  return { title: '巡检记录', lines };
}

export function DossierModal({
  act,
  actState,
  onClose,
}: {
  act: ActNo;
  actState: Act1State | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyX') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const dossier = ACT_DOSSIERS[act];
  const task = ACT_TASK_CARDS[act];
  const log = buildLogSection(act, actState);
  const sections = [
    {
      title: '监理日志',
      lines: [
        `任务背景：${task.background}`,
        `任务范围：${task.scope}`,
        `已知：${task.known}`,
        ...log.lines,
      ],
    },
    buildInspectionRecords(act, actState),
    ...dossier.sections,
  ];
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const currentSection = sections[activeTabIdx] ?? sections[0];

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-[3px] pointer-events-auto select-none">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="备忘录"
        className="modal-panel relative flex max-h-[92vh] w-full max-w-[780px] flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white text-left text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-sky-800">
              MEMO
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">
                备忘录
              </h2>
              <div className="truncate text-xs font-medium tracking-[0.1em] text-slate-500">
                {getActName(act)} · 现场记录与规程
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

        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3">
          {sections.map((section, idx) => {
            const isSelected = activeTabIdx === idx;
            return (
              <button
                key={section.title}
                type="button"
                onClick={() => setActiveTabIdx(idx)}
                className={`min-w-0 flex-1 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50 font-bold text-sky-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-300 hover:bg-sky-50'
                }`}
              >
                <span className="mr-1.5 font-mono text-[10px] text-sky-700">
                  0{idx + 1}
                </span>
                <span className="truncate font-semibold">{section.title}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                {currentSection.title}
              </span>
              <span className="whitespace-nowrap font-mono text-[10px] font-medium text-slate-400">
                条款规范 [{activeTabIdx + 1}/{sections.length}]
              </span>
            </h3>

            <ul className="space-y-2.5">
              {currentSection.lines.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-700"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-sky-600">
                    ▪
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">
            现场记录 · 规程汇编 · 本幕监理日志
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 shrink-0 whitespace-nowrap rounded-lg border border-sky-500 bg-sky-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 cursor-pointer"
          >
            返回实训
          </button>
        </footer>
      </div>
    </div>
  );
}
