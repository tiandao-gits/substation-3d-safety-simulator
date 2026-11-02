import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import type { InspectionReadout } from '../config/inspectionReadouts';
import { DetectionIcon, type DetectionGlyph } from './DetectionIcon';

/**
 * 3D 视窗左上角的可选菜单项。
 * 巡检检测项与班前会人员列表共用同一套外观：白底黑字、2px 描边、32px 线稿图标。
 */
export interface SceneMenuItem {
  key: string;
  label: string;
  sublabel?: string;
  glyph: DetectionGlyph;
  /** primary：必测项 / 现场人员；secondary：专项复核。 */
  emphasis?: 'primary' | 'secondary';
  /** 已完成：绿色描边 + 右侧对勾。 */
  done?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface SceneMenuProps {
  items: SceneMenuItem[];
  /** 当前选中项：强调框在鼠标离开后回到这一项。 */
  selectedKey: string | null;
  ariaLabel: string;
}

/**
 * 可选项目菜单：鼠标悬停时强调框跟手滑动，点击后锁定到选中项。
 * 强调框的位置由实际行高测得，因此列表增减、换点、换行都能自适应。
 */
export function SceneMenu({ items, selectedKey, ariaLabel }: SceneMenuProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ top: number; height: number } | null>(null);

  const activeKey = hoverKey ?? selectedKey;
  const activeItem = items.find((item) => item.key === activeKey) ?? null;

  const measure = useCallback(() => {
    const node = activeKey ? nodesRef.current.get(activeKey) : undefined;
    if (!node) {
      setFrame(null);
      return;
    }
    setFrame({ top: node.offsetTop, height: node.offsetHeight });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
  }, [measure, items]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure]);

  // 字体晚到会改变行高，字体就绪后再量一次，避免强调框错位。
  useEffect(() => {
    let alive = true;
    document.fonts?.ready
      .then(() => {
        if (alive) measure();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [measure]);

  return (
    <div
      ref={hostRef}
      role="menu"
      aria-label={ariaLabel}
      className="relative flex flex-col items-stretch gap-2"
    >
      {frame && (
        <span
          aria-hidden="true"
          data-tone={activeItem?.done ? 'done' : 'todo'}
          className="scene-menu-frame pointer-events-none absolute inset-x-0 z-20 rounded-lg border-2"
          style={{ top: frame.top, height: frame.height }}
        />
      )}

      {items.map((item) => {
        const primary = item.emphasis !== 'secondary';
        const selected = item.key === selectedKey;
        return (
          <button
            key={item.key}
            ref={(node) => {
              if (node) nodesRef.current.set(item.key, node);
              else nodesRef.current.delete(item.key);
            }}
            type="button"
            role="menuitem"
            aria-current={selected ? 'true' : undefined}
            disabled={item.disabled}
            onMouseEnter={() => {
              if (!item.disabled) setHoverKey(item.key);
            }}
            onMouseLeave={() =>
              setHoverKey((current) => (current === item.key ? null : current))
            }
            onFocus={() => {
              if (!item.disabled) setHoverKey(item.key);
            }}
            onBlur={() =>
              setHoverKey((current) => (current === item.key ? null : current))
            }
            onClick={item.onSelect}
            className={`group flex items-center rounded-lg border-2 bg-white text-left shadow-[0_8px_26px_rgba(2,6,23,0.4)] transition-colors ${
              primary ? 'gap-2.5 px-3 py-2' : 'gap-2.5 px-3 py-1.5'
            } ${
              item.disabled
                ? 'cursor-not-allowed border-slate-300 opacity-55'
                : item.done
                  ? 'cursor-pointer border-emerald-600/70 hover:border-emerald-600'
                  : 'cursor-pointer border-black/10 hover:border-black/35'
            }`}
          >
            <DetectionIcon
              glyph={item.glyph}
              className={`shrink-0 text-black ${primary ? 'h-8 w-8' : 'h-7 w-7'}`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={
                  primary
                    ? 'block text-base font-black leading-5 tracking-tight text-black'
                    : 'block text-[14.5px] font-bold leading-5 text-black'
                }
              >
                {item.label}
              </span>
              {item.sublabel && (
                <span
                  className={`mt-0.5 block font-mono font-bold leading-3 tracking-[0.08em] text-black/50 ${
                    primary ? 'text-[10px]' : 'text-[9.5px]'
                  }`}
                >
                  {item.sublabel}
                </span>
              )}
            </span>
            {item.done && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 3D 视窗底部的读数屏外壳：仪器遥测与人员档案共用同一块面板。 */
export function SceneReadoutFrame({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-sky-500/40 bg-slate-950/90 px-4 py-3 text-slate-100 shadow-lg">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-sky-300">
        <span className="flex min-w-0 items-center gap-1.5 font-bold">
          <Activity className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="truncate">{title}</span>
          {badge}
        </span>
        {right && <span className="shrink-0">{right}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * 仪器读数主体：主数值超大高亮 + 辅助读数条 + 读数条件。
 * 只呈现"测到了什么"，不含等级、结论、阈值或红黄绿判定色。
 */
export function ReadoutMetrics({ readout }: { readout: InspectionReadout }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
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
  );
}
