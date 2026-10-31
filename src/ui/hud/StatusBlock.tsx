import { useEffect, useRef, useState } from 'react';
import { ACT1_REVIEW_CHANCES } from '../../game/act1';
import { HudPanel } from '../primitives/HudPanel';

interface StatusBlockProps {
  reviewChances: number;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

/**
 * 右上状态块：检查机会 | 进度。
 * 评分只在结局结算时出现，游戏过程中不显示分数。
 */
export function StatusBlock({
  reviewChances,
  completedCount,
  totalCount,
  progressPercent,
}: StatusBlockProps) {
  const [chancesShake, setChancesShake] = useState(false);
  const prevChances = useRef(reviewChances);

  useEffect(() => {
    if (reviewChances === prevChances.current) return;
    const lost = reviewChances < prevChances.current;
    prevChances.current = reviewChances;
    if (!lost) return;
    setChancesShake(true);
    const timer = window.setTimeout(() => setChancesShake(false), 420);
    return () => window.clearTimeout(timer);
  }, [reviewChances]);

  const chancesDanger = reviewChances <= 1;

  return (
    <HudPanel className="absolute right-4 top-3 flex h-16 items-center gap-3 px-3.5">
      <div className="min-w-[108px]">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-xs ${chancesDanger ? 'text-red-300' : 'text-slate-300'}`}>
            检查机会
          </span>
          <span
            className={`font-mono text-xs font-bold ${
              chancesDanger ? 'text-red-300' : 'text-slate-100'
            }`}
          >
            {reviewChances}/{ACT1_REVIEW_CHANCES}
          </span>
        </div>
        <div
          className={`mt-1 flex items-center gap-1 ${
            chancesShake ? 'hud-chance-shake' : ''
          }`}
          role="img"
          aria-label={`检查机会 ${reviewChances} / ${ACT1_REVIEW_CHANCES}`}
        >
          {Array.from({ length: ACT1_REVIEW_CHANCES }).map((_, index) => (
            <span
              key={index}
              className={`h-2.5 w-4 rounded-[2px] border ${
                index < reviewChances
                  ? chancesDanger || chancesShake
                    ? 'border-red-300 bg-red-400'
                    : 'border-amber-300 bg-amber-400'
                  : 'border-slate-600 bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-w-[96px] border-l border-slate-700/80 pl-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-slate-300">进度</span>
          <span className="font-mono text-xs font-bold text-slate-100">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-700/80">
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
        <div className="mt-0.5 text-right font-mono text-[10px] text-slate-400">
          {progressPercent}%
        </div>
      </div>
    </HudPanel>
  );
}
