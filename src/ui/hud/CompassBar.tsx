import { HudPanel } from '../primitives/HudPanel';

interface CompassBarProps {
  zoneName: string;
  yaw: number;
}

const TAPE_DEGREES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const CARDINALS: Record<number, string> = {
  0: 'N',
  90: 'E',
  180: 'S',
  270: 'W',
};

/** 顶部罗盘条：替代零信息量的游戏标题牌，同时显示当前区域名。 */
export function CompassBar({ zoneName, yaw }: CompassBarProps) {
  const heading = ((-yaw * 180) / Math.PI % 360 + 360) % 360;

  return (
    <HudPanel className="absolute left-1/2 top-3 h-16 w-[360px] max-w-[36vw] -translate-x-1/2 overflow-hidden px-3 py-1">
      <div className="relative h-9 overflow-hidden">
        {TAPE_DEGREES.map((degree) => {
          const delta = ((degree - heading + 540) % 360) - 180;
          if (Math.abs(delta) > 70) return null;
          const cardinal = CARDINALS[degree];
          return (
            <div
              key={degree}
              className="absolute top-0 flex h-9 flex-col items-center justify-start"
              style={{
                left: `calc(50% + ${delta * 2.35}px)`,
                transform: 'translateX(-50%)',
                opacity: 1 - Math.abs(delta) / 90,
              }}
            >
              <span
                className={
                  cardinal
                    ? 'font-mono text-xs font-bold text-amber-300'
                    : 'font-mono text-[10px] text-slate-400'
                }
              >
                {cardinal ?? `${degree}°`}
              </span>
              <span
                className={`mt-1 block w-px ${
                  cardinal ? 'h-2 bg-amber-400/80' : 'h-1.5 bg-slate-500/70'
                }`}
              />
            </div>
          );
        })}
        <span className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-amber-400" />
        <span className="absolute inset-x-0 bottom-0 h-px bg-slate-600/60" />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-700/70">
        <span className="truncate text-xs font-semibold text-slate-100">{zoneName}</span>
        <span className="shrink-0 font-mono text-[10px] text-amber-300/90">
          {Math.round(heading).toString().padStart(3, '0')}°
        </span>
      </div>
    </HudPanel>
  );
}
