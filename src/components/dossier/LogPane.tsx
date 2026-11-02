import type { ReactNode } from 'react';
import { ChevronRight, ClipboardList, Gauge, ShieldAlert } from 'lucide-react';
import { ACT_TASK_CARDS } from '../../config/dialogues';
import { getDispositionOption } from '../../config/disposition';
import {
  ACT_LEDGERS,
  ACT_REGULATIONS,
  type DossierAssetKind,
} from '../../config/dossier';
import { INSPECTION_POINT_DETAILS } from '../../config/inspectionDetails';
import {
  ACT1_REVIEW_CHANCES,
  ACT_AMBIENT,
  countResolvedPoints,
  dispositionNeedsEvidence,
  evaluateActOutcome,
  getAct1PointStatus,
  getAct1VisualText,
  getActName,
  getActPoints,
  isActComplete,
  isPointCovered,
  type Act1PointId,
  type Act1PointStatus,
  type Act1State,
  type ActNo,
} from '../../game/act1';
import {
  Badge,
  DossierPane,
  EmptyLine,
  PaneHeading,
  RailItem,
  RailLabel,
  StatusChip,
} from './ui';

export type LogSelection = { kind: 'task' } | { kind: 'point'; id: Act1PointId };

type DotTone = 'sky' | 'slate' | 'indigo' | 'rose' | 'emerald' | 'amber';

const DOT_CLASS: Record<DotTone, string> = {
  sky: 'bg-sky-500',
  slate: 'bg-slate-400',
  indigo: 'bg-indigo-500',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
};

const RAIL_STATUS: Record<
  Act1PointStatus,
  { label: string; tone: 'slate' | 'sky' | 'amber' | 'rose' | 'emerald' }
> = {
  unchecked: { label: '未检查', tone: 'slate' },
  observed: { label: '已观察', tone: 'sky' },
  covered: { label: '待处置', tone: 'amber' },
  'awaiting-evidence': { label: '待取证', tone: 'rose' },
  resolved: { label: '已完成', tone: 'emerald' },
};

/** 关联台账跨多个分类时，打开条目最多的那一类。 */
function dominantAssetKind(assets: { kind: DossierAssetKind }[]): DossierAssetKind {
  const counts: Record<DossierAssetKind, number> = {
    equipment: 0,
    personnel: 0,
    site: 0,
  };
  for (const asset of assets) counts[asset.kind] += 1;
  return (Object.keys(counts) as DossierAssetKind[]).sort(
    (a, b) => counts[b] - counts[a]
  )[0];
}

function LogItem({
  label,
  tone,
  children,
}: {
  label: string;
  tone: DotTone;
  children: ReactNode;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[21px] top-2 h-2 w-2 rounded-full ring-2 ring-white ${DOT_CLASS[tone]}`}
      />
      <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-[12.5px] leading-6 text-slate-700">{children}</div>
    </li>
  );
}

function TaskBrief({ act, state }: { act: ActNo; state: Act1State | null }) {
  const task = ACT_TASK_CARDS[act];
  const points = getActPoints(act);
  const resolved = state ? countResolvedPoints(state) : 0;
  const chances = state?.reviewChances ?? ACT1_REVIEW_CHANCES;
  const outcome = state && isActComplete(state) ? evaluateActOutcome(state) : null;
  const ambient = ACT_AMBIENT[act];
  const pct = points.length > 0 ? Math.round((resolved / points.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <PaneHeading
          eyebrow={`TASK BRIEF · ${task.time}`}
          title={task.title}
          right={<Badge tone="sky">{points.length} 个检查点</Badge>}
        />
        <p className="mt-3 text-[12.5px] leading-6 text-slate-700">{task.background}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <dt className="font-mono text-[9.5px] font-bold tracking-[0.14em] text-slate-400">
              任务范围
            </dt>
            <dd className="mt-1 text-[12px] leading-5 text-slate-700">{task.scope}</dd>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <dt className="font-mono text-[9.5px] font-bold tracking-[0.14em] text-slate-400">
              已知条件
            </dt>
            <dd className="mt-1 text-[12px] leading-5 text-slate-700">{task.known}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
            <Gauge className="h-3.5 w-3.5 text-sky-600" />
            本幕进度
          </h4>
          <span className="font-mono text-[11px] font-bold tabular-nums text-slate-600">
            {resolved} / {points.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">剩余检查机会</span>
          <div className="flex items-center gap-1" aria-label={`剩余检查机会 ${chances} 次`}>
            {Array.from({ length: ACT1_REVIEW_CHANCES }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-5 rounded-sm ${
                  index < chances ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              />
            ))}
            <span className="ml-1 font-mono text-[11px] font-bold text-slate-600">
              {chances}
            </span>
          </div>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-500">
          处置结论随监理日志归档；本幕结束时统一核账，判错的处置在结算时扣分。
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
          <ClipboardList className="h-3.5 w-3.5 text-sky-600" />
          记录信息
        </h4>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ['记录人', '陆川 · 专业监理工程师（安全）'],
            ['本幕时段', `${task.time} 起`],
            ['现场气象', `${ambient.temperatureC} ℃ · 风速 ${ambient.windMps} m/s`],
            [
              '归档',
              act === 2 ? '监理日志 · 处置单 · 工作票名册' : '监理日志 · 处置单',
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-1.5"
            >
              <dt className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-slate-400">
                {label}
              </dt>
              <dd className="mt-0.5 text-[11.5px] font-semibold text-slate-700">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {outcome && outcome.unhandled.length > 0 && (
        <section className="rounded-lg border border-rose-300 bg-rose-50 p-3">
          <h4 className="flex items-center gap-1.5 text-[12px] font-bold text-rose-900">
            <ShieldAlert className="h-3.5 w-3.5" />
            未闭环隐患 {outcome.unhandled.length} 项
          </h4>
          <ul className="mt-1.5 space-y-1 text-[11.5px] leading-5 text-rose-800">
            {outcome.unhandled.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PointRecord({
  act,
  state,
  pointId,
  onOpenRegulations,
  onOpenAssets,
}: {
  act: ActNo;
  state: Act1State | null;
  pointId: Act1PointId;
  onOpenRegulations: (pointId: Act1PointId) => void;
  onOpenAssets: (kind: DossierAssetKind) => void;
}) {
  const points = getActPoints(act);
  const point = points.find((item) => item.id === pointId)!;
  const detail = INSPECTION_POINT_DETAILS[pointId];
  const pointState = state?.points[pointId];
  const observed = Boolean(pointState?.completedActions.includes('visual'));
  const covered = state ? isPointCovered(state, pointId) : false;
  const status = state ? getAct1PointStatus(state, pointId) : 'unchecked';
  const grade = pointState?.disposition;
  const option = grade ? getDispositionOption(point.profile, grade) : undefined;
  const needsEvidence = dispositionNeedsEvidence(grade);
  const evidence = Boolean(pointState?.evidenceId);
  const readings = pointState?.readings ?? [];

  const actionLabels = new Map<string, string>();
  for (const list of Object.values(point.actions)) {
    for (const action of list ?? []) actionLabels.set(action.id, action.label);
  }
  const completedActions = (pointState?.completedActions ?? [])
    .filter((id) => id !== 'visual')
    .map((id) => ({
      id,
      label: id === 'drone-recon' ? '升空观察取证' : actionLabels.get(id),
    }))
    .filter((item): item is { id: string; label: string } => Boolean(item.label));

  const finding = covered && state ? point.finding[state.variant] : null;
  const hasRecord =
    observed || completedActions.length > 0 || readings.length > 0 || Boolean(grade);

  const relatedRegs = ACT_REGULATIONS[act].filter((reg) => reg.points.includes(pointId));
  const ledger = ACT_LEDGERS[act];
  const relatedAssets = [
    ...ledger.equipment,
    ...ledger.personnel,
    ...ledger.sites,
  ].filter((asset) => asset.points.includes(pointId));

  const index = points.findIndex((item) => item.id === pointId) + 1;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[9.5px] font-bold tracking-[0.18em] text-slate-400">
              CHECKPOINT {String(index).padStart(2, '0')} / {String(points.length).padStart(2, '0')}
            </div>
            <h3 className="mt-1 text-lg font-bold leading-6 text-slate-900">{point.name}</h3>
            <div className="mt-0.5 text-[11.5px] text-slate-500">
              {point.zone} · {detail?.equipmentType ?? '现场检查点'}
            </div>
          </div>
          <StatusChip status={status} />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone="slate">
            {point.profile === 'equipment' ? '运行设备缺陷' : '施工安全监理'}
          </Badge>
          <Badge tone="slate">{point.requiredActions.length} 项必测</Badge>
        </div>
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] leading-6 text-slate-700">
          {point.clue}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-[12.5px] font-bold text-slate-800">
          <ClipboardList className="h-3.5 w-3.5 text-sky-600" />
          检查记录
          <span className="ml-auto font-mono text-[9.5px] font-normal tracking-[0.12em] text-slate-400">
            FIELD LOG
          </span>
        </h4>

        {!hasRecord ? (
          <div className="mt-3">
            <EmptyLine>
              本检查点尚未开始记录。走到点位后按 F 打开处置单，先完成目视观察，再逐项检测。
            </EmptyLine>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {['观察', '检测', '读数', '发现', '处置'].map((label, index) => (
                <div
                  key={label}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center"
                >
                  <div className="font-mono text-[9px] text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="text-[10.5px] font-bold text-slate-600">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
              记录顺序固定：观察 → 检测 → 读数 → 发现 → 处置，完成后逐条写入本页。
            </p>
          </div>
        ) : (
          <ol className="relative mt-3 space-y-3 border-l border-slate-200 pl-4">
            {observed && (
              <LogItem label="观察 · OBSERVE" tone="sky">
                {getAct1VisualText(point.id, state!.variant)}
              </LogItem>
            )}

            {(completedActions.length > 0 || readings.length > 0) && (
              <LogItem label="检测 · DETECT" tone="slate">
                {completedActions.length > 0 ? (
                  <ul className="space-y-1">
                    {completedActions.map((action) => (
                      <li key={action.id} className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                        {action.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">尚未完成检测动作。</span>
                )}

                {readings.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {readings.map((reading, readingIndex) => (
                      <li
                        key={`${reading.label}-${readingIndex}`}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                      >
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="font-mono text-[12px] font-bold text-slate-900">
                            {reading.label}
                          </span>
                          <span className="text-[10.5px] text-slate-500">{reading.unit}</span>
                          {reading.quality !== 'ok' && <Badge tone="amber">仅参考</Badge>}
                        </div>
                        {reading.note && (
                          <div className="mt-0.5 font-mono text-[10px] leading-4 text-slate-500">
                            {reading.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </LogItem>
            )}

            {covered && (
              <LogItem label="发现 · FINDING" tone={finding ? 'rose' : 'slate'}>
                {finding ? (
                  <span className="font-semibold text-slate-900">{finding.title}</span>
                ) : (
                  <span className="text-slate-500">外观与读数未见异常，按正常记录归档。</span>
                )}
              </LogItem>
            )}

            {grade && (
              <LogItem label="处置 · DISPOSITION" tone="emerald">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-slate-900 px-1.5 py-px font-mono text-[10px] font-bold text-white">
                    {grade}
                  </span>
                  <span className="font-bold text-slate-900">{option?.label ?? grade}</span>
                  <Badge tone="slate">{needsEvidence ? '取证处理' : '正常记录'}</Badge>
                  {needsEvidence && (
                    <Badge tone={evidence ? 'emerald' : 'amber'}>
                      {evidence ? '已取证' : '待取证'}
                    </Badge>
                  )}
                </div>
                {option?.hint && (
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{option.hint}</p>
                )}
              </LogItem>
            )}

            {point.id === 'a2-crew' && state && (
              <LogItem
                label="名册 · ROSTER"
                tone={state.permitSignoff ? 'slate' : 'amber'}
              >
                {state.permitSignoff
                  ? `工作票名册已签注，${state.permitSignoff.total} 人参检，核验结论随工作票归档。`
                  : '工作票名册尚未签注：本幕结算前需在处置单的名册逐人核验并签注。'}
              </LogItem>
            )}
          </ol>
        )}
      </section>

      {(relatedRegs.length > 0 || relatedAssets.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {relatedRegs.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenRegulations(pointId)}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-900 transition-colors hover:border-sky-400 hover:bg-sky-100 cursor-pointer"
            >
              查看本点判据 · {relatedRegs.length} 条
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          {relatedAssets.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenAssets(dominantAssetKind(relatedAssets))}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              相关台账 · {relatedAssets.length} 项
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LogPane({
  act,
  state,
  selection,
  onSelect,
  onOpenRegulations,
  onOpenAssets,
}: {
  act: ActNo;
  state: Act1State | null;
  selection: LogSelection;
  onSelect: (selection: LogSelection) => void;
  onOpenRegulations: (pointId: Act1PointId) => void;
  onOpenAssets: (kind: DossierAssetKind) => void;
}) {
  const points = getActPoints(act);
  const resolved = state ? countResolvedPoints(state) : 0;
  const selectedPoint =
    selection.kind === 'point'
      ? points.find((item) => item.id === selection.id) ?? null
      : null;
  const scrollKey = selection.kind === 'point' ? selection.id : 'task';

  const rail = (
    <>
      <RailLabel>{getActName(act)}</RailLabel>
      <RailItem
        active={selection.kind === 'task'}
        onClick={() => onSelect({ kind: 'task' })}
        title="任务说明"
        subtitle={`${ACT_TASK_CARDS[act].time} · 背景 / 范围 / 已知条件`}
        leading={<ClipboardList className="h-4 w-4" />}
      />
      <RailLabel>
        检查点 {resolved}/{points.length}
      </RailLabel>
      {points.map((point, index) => {
        const status = state ? getAct1PointStatus(state, point.id) : 'unchecked';
        return (
          <RailItem
            key={point.id}
            active={selectedPoint?.id === point.id}
            onClick={() => onSelect({ kind: 'point', id: point.id })}
            title={point.name}
            subtitle={point.zone}
            leading={
              <span className="font-mono text-[10px] font-bold">
                {String(index + 1).padStart(2, '0')}
              </span>
            }
            badge={status === 'unchecked' ? undefined : RAIL_STATUS[status].label}
            badgeTone={RAIL_STATUS[status].tone}
          />
        );
      })}
    </>
  );

  return (
    <DossierPane rail={rail} scrollKey={scrollKey}>
      {selectedPoint ? (
        <PointRecord
          act={act}
          state={state}
          pointId={selectedPoint.id}
          onOpenRegulations={onOpenRegulations}
          onOpenAssets={onOpenAssets}
        />
      ) : (
        <TaskBrief act={act} state={state} />
      )}
    </DossierPane>
  );
}
