import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { getAct1Point, type Act1PointId } from '../../game/act1';
import { MESSAGES } from '../../config/gameText';
import type { ApartmentDoorSide } from '../../game/apartmentDoor';

interface PromptStackProps {
  liveLineDistance: number;
  showWarning: boolean;
  apartmentDoorPrompt: ApartmentDoorSide | null;
  nearbyActPointId: Act1PointId | null;
  onApartmentDoorUse: () => void;
}

/**
 * 底部提示统一堆叠，最多两条：安全警告 > 交互提示。
 * 直接叠放在快捷栏上方，避免各自 fixed 定位互相压住。
 */
export function PromptStack({
  liveLineDistance,
  showWarning,
  apartmentDoorPrompt,
  nearbyActPointId,
  onApartmentDoorUse,
}: PromptStackProps) {
  const interaction = apartmentDoorPrompt ? (
    <button
      type="button"
      onClick={onApartmentDoorUse}
      className="pointer-events-auto flex items-center gap-2 rounded-xs border border-sky-400/80 bg-[#07131f]/95 px-5 py-2 font-mono text-xs tracking-[0.06em] text-slate-100 shadow-[0_0_22px_rgba(56,189,248,0.28)] transition-colors hover:border-sky-300 hover:bg-[#0b2237] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
    >
      <span className="font-bold text-sky-300">[F]</span>
      <span>
        {apartmentDoorPrompt === 'outside'
          ? MESSAGES.apartmentDoorEnterPrompt
          : MESSAGES.apartmentDoorExitPrompt}
      </span>
    </button>
  ) : nearbyActPointId ? (
    <div className="flex items-center gap-2 rounded-xs border border-amber-500/60 bg-[#07131f]/95 px-5 py-2 font-mono text-xs tracking-[0.06em] text-slate-200 shadow-xl">
      <span className="font-bold text-amber-400">[F]</span>
      <span>检查 · {getAct1Point(nearbyActPointId).name}</span>
    </div>
  ) : null;

  const items: ReactNode[] = [];
  // 唯一的安全提示：越线后或进入 1.6 m 内，都只显示同一条距离提示。
  if (showWarning) {
    items.push(
      <div
        key="live-line"
        className="flex items-center gap-2 rounded-xs border border-red-500/70 bg-[#170406]/95 px-5 py-2 font-mono text-xs tracking-[0.06em] text-red-100 shadow-xl animate-pulse"
      >
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <span>
          距带电警戒线 {Math.max(0, liveLineDistance).toFixed(1)} m
          · 红线内为运行带电设备，禁止跨越
        </span>
      </div>
    );
  }
  if (interaction) items.push(<div key="interaction">{interaction}</div>);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-[84px] left-1/2 flex w-[min(620px,92vw)] -translate-x-1/2 flex-col-reverse items-center gap-2">
      {items.slice(0, 2)}
    </div>
  );
}
