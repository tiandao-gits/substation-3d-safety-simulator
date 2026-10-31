import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  ACT1_POINT_STATUS_LABELS,
  getAct1PointStatus,
  getActPoints,
  isPointResolved,
  type Act1PointId,
  type Act1PointStatus,
} from '../../game/act1';
import type { HudSnapshot } from '../../game/hudStore';
import type { StoryState } from '../../game/storySession';
import { HudPanel } from '../primitives/HudPanel';

interface ObjectiveTrackerProps {
  story: StoryState;
  hud: HudSnapshot;
  onOpenSettings: () => void;
  onExit: () => void;
}

const STATUS_STYLE: Record<Act1PointStatus, string> = {
  unchecked: 'text-slate-400',
  observed: 'text-sky-300',
  covered: 'text-amber-300',
  'awaiting-evidence': 'text-amber-300',
  resolved: 'text-emerald-300',
};

const STATUS_DOT: Record<Act1PointStatus, string> = {
  unchecked: 'border-slate-500 bg-transparent',
  observed: 'border-sky-400 bg-sky-400/40',
  covered: 'border-amber-400 bg-amber-400/40',
  'awaiting-evidence': 'border-amber-400 bg-amber-400/40',
  resolved: 'border-emerald-400 bg-emerald-400',
};

export function ObjectiveTracker({
  story,
  hud,
  onOpenSettings,
  onExit,
}: ObjectiveTrackerProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (story.phase !== 'act1' || !story.act1) return null;

  const act1 = story.act1;
  const points = getActPoints(story.act);
  const activeId: Act1PointId | null =
    points.find((point) => !isPointResolved(act1, point.id))?.id ?? null;
  const activeIndex = activeId
    ? points.findIndex((point) => point.id === activeId)
    : -1;
  const activePoint = activeIndex >= 0 ? points[activeIndex] : null;

  return (
    <HudPanel
      className={`pointer-events-auto absolute left-4 top-3 w-[300px] max-w-[26vw] px-3.5 ${
        collapsed ? 'flex h-16 flex-col justify-center py-0' : 'py-2.5'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.16em] text-amber-300/90">
            任务追踪
          </div>
          <div className="mt-0.5 truncate text-xs font-bold text-slate-100">
            {act1.act === 1
              ? '第一幕 · 正常巡检'
              : act1.act === 2
                ? '第二幕 · 主变电维修巡检'
                : '第三幕 · 施工现场检查'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? '展开任务面板' : '收起任务面板'}
            title={collapsed ? '展开任务面板' : '收起任务面板'}
            className="rounded-xs border border-slate-700/80 p-1 text-slate-400 transition-colors hover:border-amber-400 hover:text-amber-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="打开系统设置"
            title="系统设置 (P)"
            className="rounded-xs border border-slate-700/80 p-1 text-slate-400 transition-colors hover:border-amber-400 hover:text-amber-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="退出游戏"
            title="退出游戏"
            className="rounded-xs border border-red-500/40 p-1 text-red-300/80 transition-colors hover:border-red-400 hover:text-red-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-700/70 pt-1.5">
        <span className="text-xs text-slate-300">
          {activePoint ? (
            <>
              <span className="font-mono text-amber-300">
                {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <span className="mx-1 text-slate-500">·</span>
              {activePoint.shortName}
            </>
          ) : (
            <span className="text-emerald-300">本幕检查点已全部完成</span>
          )}
        </span>
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-xs font-bold text-amber-300">
            {hud.completedCount}/{hud.totalCount}
          </span>
          {activePoint && (
            <span className="font-mono text-[10px] text-slate-400">
              {Math.round(
                Math.hypot(activePoint.x - hud.x, activePoint.z - hud.z)
              )}
              m
            </span>
          )}
        </span>
      </div>

      <ul className="mt-1.5 space-y-1">
        {points.map((point, index) => {
          const status = getAct1PointStatus(act1, point.id);
          const isActive = point.id === activeId;
          return (
            <li
              key={point.id}
              className={`flex items-center justify-between gap-2 rounded-[3px] px-1.5 py-0.5 ${
                isActive ? 'bg-amber-400/10' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full border ${STATUS_DOT[status]}`}
                />
                <span
                  className={`truncate font-mono text-[10px] ${
                    isActive ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={`truncate text-xs ${
                    isActive ? 'font-semibold text-amber-100' : 'text-slate-300'
                  }`}
                >
                  {point.shortName}
                </span>
              </span>
              <span className={`shrink-0 text-xs ${STATUS_STYLE[status]}`}>
                {ACT1_POINT_STATUS_LABELS[status]}
              </span>
            </li>
          );
        })}
      </ul>
        </>
      )}
    </HudPanel>
  );
}
