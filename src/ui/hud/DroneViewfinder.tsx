import { AlertTriangle } from 'lucide-react';
import { GAME_TEXT } from '../../config/gameText';
import type { HudSnapshot } from '../../game/hudStore';

interface DroneViewfinderProps {
  hud: HudSnapshot;
  act: number;
  onRecall: () => void;
}

/** 无人机取景框：尺寸随视口缩放，无人机模式只保留遥测 + 取景框 + 收回按钮。 */
export function DroneViewfinder({ hud, act, onRecall }: DroneViewfinderProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between py-16">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-5 rounded-xs border border-red-500/80 bg-red-950/90 px-5 py-2 text-xs tracking-[0.08em] shadow-xl">
          <span className="flex items-center gap-2 font-bold text-red-400">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            {GAME_TEXT.drone.rec}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-mono-num text-red-200">
            {GAME_TEXT.drone.altitude(
              hud.droneY.toFixed(1),
              hud.droneX.toFixed(1),
              hud.droneZ.toFixed(1)
            )}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-amber-300">{GAME_TEXT.drone.protagonistStandby}</span>
        </div>
        {hud.droneViolation && (
          <div className="flex items-center gap-2 rounded-xs border border-red-300 bg-red-700/95 px-5 py-2 text-xs font-bold tracking-[0.08em] text-white shadow-xl">
            <AlertTriangle className="h-4 w-4" />
            <span>
              违规：飞越 {hud.droneViolation} 正上方 · 检查机会 −1
            </span>
          </div>
        )}
      </div>

      <div className="relative flex aspect-[16/10] w-[min(60vw,900px,76vh)] flex-col items-center justify-center">
        <svg
          viewBox="0 0 480 300"
          fill="none"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full pointer-events-none"
        >
          <path d="M 8 56 L 8 8 L 56 8" stroke="#ef4444" strokeWidth="3.5" />
          <path d="M 424 8 L 472 8 L 472 56" stroke="#ef4444" strokeWidth="3.5" />
          <path d="M 8 244 L 8 292 L 56 292" stroke="#ef4444" strokeWidth="3.5" />
          <path d="M 424 292 L 472 292 L 472 244" stroke="#ef4444" strokeWidth="3.5" />
          <rect
            x="24"
            y="24"
            width="432"
            height="252"
            stroke="rgba(239, 68, 68, 0.45)"
            strokeWidth="1.2"
            strokeDasharray="6 6"
          />
          <circle cx="240" cy="132" r="34" stroke="#ef4444" strokeWidth="2" />
          <circle cx="240" cy="132" r="4" fill="#ef4444" />
          <line x1="186" y1="132" x2="216" y2="132" stroke="#ef4444" strokeWidth="2" />
          <line x1="264" y1="132" x2="294" y2="132" stroke="#ef4444" strokeWidth="2" />
          <line x1="240" y1="78" x2="240" y2="108" stroke="#ef4444" strokeWidth="2" />
          <line x1="240" y1="156" x2="240" y2="186" stroke="#ef4444" strokeWidth="2" />
        </svg>

        <div className="absolute left-[6%] top-[10%] rounded-xs border border-red-500/70 bg-red-950/90 px-2.5 py-1 text-xs font-bold tracking-[0.06em] text-red-300">
          {GAME_TEXT.drone.targetLabel}
        </div>

        <div className="absolute right-[6%] top-[10%] rounded-xs border border-red-500/60 bg-slate-950/90 px-2.5 py-1 font-mono-num text-xs tracking-[0.06em] text-red-300">
          {act === 3 ? '取证模式' : '本幕仅观察'}
        </div>

        <div
          className={`absolute inset-x-0 top-[46%] mx-auto w-max max-w-[86%] rounded-xs border px-5 py-2.5 text-center text-xs tracking-[0.08em] ${
            act === 3
              ? 'border-slate-500/70 bg-slate-950/85 text-slate-200'
              : 'border-slate-600/60 bg-slate-950/80 text-slate-400'
          }`}
        >
          {act === 3
            ? '空中取证 · 对准目标后按 G 拍摄'
            : '空中观察 · 本幕无取证任务（G 取证不可用）'}
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label={GAME_TEXT.drone.recallAria}
          onClick={onRecall}
          className="flex items-center gap-3 rounded-xs border-2 border-red-300 bg-red-600 px-8 py-3 text-sm font-bold tracking-[0.12em] text-white shadow-[0_0_24px_rgba(220,38,38,0.75)] transition-transform active:scale-95 hover:bg-red-500 active:bg-red-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <span className="h-2.5 w-2.5 rounded-xs bg-white" />
          <span>{GAME_TEXT.drone.recallButton}</span>
        </button>
      </div>
    </div>
  );
}
