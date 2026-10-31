import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StoryState } from '../../game/storySession';

interface EventToastProps {
  story: StoryState;
  reviewChances: number;
  visible: boolean;
}

interface ToastInfo {
  key: string;
  label: string;
  chanceLost: boolean;
}

/** 右下角事件提示：把扣分原因变成可见提示；分数值只在结局结算时出现。 */
export function EventToast({ story, reviewChances, visible }: EventToastProps) {
  const deductionCount = story.act1?.deductions.length ?? 0;
  const previousCount = useRef(deductionCount);
  const previousChances = useRef(reviewChances);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  useEffect(() => {
    const latest =
      deductionCount > previousCount.current && story.act1
        ? story.act1.deductions[deductionCount - 1]
        : null;
    const chanceLost = previousChances.current > reviewChances;
    if (latest) {
      setToast({
        key: `${latest.id}-${deductionCount}`,
        label: latest.label,
        chanceLost,
      });
    }
    previousCount.current = deductionCount;
    previousChances.current = reviewChances;
  }, [deductionCount, reviewChances, story.act1]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!visible || !toast) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 w-[260px]">
      <div className="rounded-xs border border-red-500/70 bg-[#170406]/95 px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 text-xs font-bold text-red-200">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span>{toast.label}</span>
        </div>
        {toast.chanceLost && (
          <div className="mt-1 font-mono text-xs text-amber-300">
            检查机会 −1
          </div>
        )}
      </div>
    </div>
  );
}
