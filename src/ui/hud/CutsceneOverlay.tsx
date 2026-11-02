import { useEffect, useState } from 'react';
import { SkipForward } from 'lucide-react';

interface CutsceneOverlayProps {
  caption?: string;
  subCaption?: string;
  onSkip: () => void;
}

/**
 * 开场过场的电影黑边层。
 *
 * 只做"包装"：上下黑边滑入、左上角场记、右下角跳过。人物走位、机位与门开度
 * 全部由 runtime 的时间轴驱动，这里不参与计时，避免两套时钟对不上。
 */
export function CutsceneOverlay({
  caption,
  subCaption,
  onSkip,
}: CutsceneOverlayProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Space / Enter / Esc 都能立刻跳过，不必去点右上角的小按钮。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' &&
        event.code !== 'Enter' &&
        event.code !== 'Escape'
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onSkip();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSkip]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[75]" data-testid="cutscene-overlay">
      {/* 上下黑边 */}
      <div
        className="absolute inset-x-0 top-0 bg-black transition-transform duration-[450ms] ease-out"
        style={{ height: '9vh', transform: shown ? 'translateY(0)' : 'translateY(-100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-black transition-transform duration-[450ms] ease-out"
        style={{ height: '9vh', transform: shown ? 'translateY(0)' : 'translateY(100%)' }}
      />

      {/* 场记：贴在黑边上沿，不挡画面 */}
      <div
        className="absolute left-8 flex items-baseline gap-3 transition-opacity duration-700"
        style={{ top: 'calc(9vh - 1.65rem)', opacity: shown ? 1 : 0 }}
      >
        <span className="font-mono text-[11px] font-bold tracking-[0.28em] text-amber-400/90">
          {caption ?? '第三幕'}
        </span>
        <span className="h-3 w-px bg-slate-500/60" />
        <span className="font-mono text-[11px] tracking-[0.14em] text-slate-300/80">
          {subCaption ?? ''}
        </span>
      </div>

      {/* 跳过：贴在底边黑条上沿右侧 */}
      <button
        type="button"
        onClick={onSkip}
        className="pointer-events-auto absolute right-8 flex items-center gap-2 rounded-xs border border-slate-500/50 bg-black/55 px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-slate-300 transition-colors hover:border-amber-400/70 hover:text-amber-200"
        style={{ bottom: 'calc(9vh + 0.9rem)', opacity: shown ? 1 : 0 }}
      >
        <SkipForward className="h-3.5 w-3.5" />
        跳过 · SPACE
      </button>
    </div>
  );
}
