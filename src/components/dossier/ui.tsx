import { useEffect, useRef, type ReactNode } from 'react';
import {
  ACT1_POINT_STATUS_LABELS,
  type Act1PointStatus,
} from '../../game/act1';

/**
 * 备忘录三个分页共用的版式基元：左侧索引栏 + 右侧内容区。
 *
 * 统一的交互约定：
 * - 左栏只做选择，不承载正文；选中项用左侧色条 + 浅底表示。
 * - 右栏是本页唯一的滚动容器，切换左侧索引时回到顶部由调用方负责。
 */

export type BadgeTone = 'slate' | 'sky' | 'amber' | 'rose' | 'emerald';

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  slate: 'border-slate-300 bg-slate-100 text-slate-600',
  sky: 'border-sky-300 bg-sky-100 text-sky-800',
  amber: 'border-amber-300 bg-amber-100 text-amber-800',
  rose: 'border-rose-300 bg-rose-100 text-rose-700',
  emerald: 'border-emerald-300 bg-emerald-100 text-emerald-800',
};

export function Badge({
  tone = 'slate',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded border px-1.5 py-px font-mono text-[9.5px] font-bold leading-4 ${BADGE_TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<Act1PointStatus, BadgeTone> = {
  unchecked: 'slate',
  observed: 'sky',
  covered: 'amber',
  'awaiting-evidence': 'rose',
  resolved: 'emerald',
};

export function StatusChip({ status }: { status: Act1PointStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ACT1_POINT_STATUS_LABELS[status]}</Badge>;
}

export function RailLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-3 font-mono text-[9.5px] font-bold tracking-[0.16em] text-slate-400">
      {children}
    </div>
  );
}

export function RailItem({
  active,
  onClick,
  title,
  subtitle,
  leading,
  badge,
  badgeTone = 'slate',
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  badge?: string;
  badgeTone?: BadgeTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`relative flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
        active
          ? 'border-sky-400 bg-sky-50'
          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      {active && (
        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-sky-600" />
      )}
      {leading && (
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${
            active ? 'text-sky-700' : 'text-slate-400'
          }`}
        >
          {leading}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1.5">
          <span
            className={`truncate text-[12.5px] font-bold leading-5 ${
              active ? 'text-sky-900' : 'text-slate-700'
            }`}
          >
            {title}
          </span>
          {badge && <Badge tone={badgeTone}>{badge}</Badge>}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[10.5px] leading-4 text-slate-500">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

export function DossierPane({
  rail,
  scrollKey,
  children,
}: {
  rail: ReactNode;
  /** 变化时把右栏滚回顶部（切换索引项 / 分页）。 */
  scrollKey?: string;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="max-h-[34vh] shrink-0 overflow-y-auto border-b border-slate-200 bg-white px-2.5 py-2 lg:max-h-none lg:w-[272px] lg:border-b-0 lg:border-r">
        {rail}
      </aside>
      <section
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-5"
      >
        {children}
      </section>
    </div>
  );
}

export function PaneHeading({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-sky-700">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-[17px] font-bold leading-6 text-slate-900">{title}</h3>
        {description && (
          <p className="mt-1 max-w-[560px] text-[11.5px] leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {right}
    </header>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-[11.5px] leading-5 text-slate-500">
      {children}
    </p>
  );
}

/** 检查点跳转标签：台账与安规卡片用它把玩家送回监理日志。 */
export function PointTag({
  name,
  onClick,
}: {
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-800 cursor-pointer"
    >
      <span className="h-1 w-1 rounded-full bg-sky-500" />
      {name}
    </button>
  );
}
