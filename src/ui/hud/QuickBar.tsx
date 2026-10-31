import { BookOpen, Briefcase, Footprints, Plane } from 'lucide-react';
import { HudPanel } from '../primitives/HudPanel';

interface QuickBarProps {
  runLock: boolean;
  onToggleRunWalk: () => void;
  onOpenDossier: () => void;
  onEnterDrone: () => void;
  onOpenBackpack: () => void;
}

const ITEM_BASE =
  'flex h-[56px] w-[78px] flex-col items-center justify-center rounded-lg border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60';

/** 合并后的底部快捷栏：跑动 / 备忘录 / 无人机 / 背包。 */
export function QuickBar({
  runLock,
  onToggleRunWalk,
  onOpenDossier,
  onEnterDrone,
  onOpenBackpack,
}: QuickBarProps) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 select-none">
      <HudPanel className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={onToggleRunWalk}
          aria-pressed={runLock}
          title="切换步行 / 跑步（Shift）"
          className={`${ITEM_BASE} ${
            runLock
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-slate-700/80 bg-[#091522]/90 text-slate-300 hover:border-amber-400/70 hover:bg-[#0d2238]'
          }`}
        >
          <Footprints className="h-[18px] w-[18px]" />
          <span className="mt-1 text-xs font-bold leading-none">
            {runLock ? '跑步' : '行走'}
          </span>
          <span className="mt-1 font-mono text-[10px] leading-none text-slate-500">
            Shift
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenDossier}
          title="打开备忘录（E）"
          className={`${ITEM_BASE} border-slate-700/80 bg-[#091522]/90 text-slate-300 hover:border-amber-400/70 hover:bg-[#0d2238]`}
        >
          <BookOpen className="h-[18px] w-[18px]" />
          <span className="mt-1 text-xs font-bold leading-none">备忘录</span>
          <span className="mt-1 font-mono text-[10px] leading-none text-slate-500">
            E
          </span>
        </button>

        <button
          type="button"
          onClick={onEnterDrone}
          title="无人机空中视角（U）"
          className={`${ITEM_BASE} border-slate-700/80 bg-[#091522]/90 text-slate-300 hover:border-sky-400/70 hover:bg-[#0d2238]`}
        >
          <Plane className="h-[18px] w-[18px]" />
          <span className="mt-1 text-xs font-bold leading-none">无人机</span>
          <span className="mt-1 font-mono text-[10px] leading-none text-slate-500">
            U
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenBackpack}
          title="打开现场背包（B）"
          className={`${ITEM_BASE} border-slate-700/80 bg-[#091522]/90 text-slate-300 hover:border-amber-400/70 hover:bg-[#0d2238]`}
        >
          <Briefcase className="h-[18px] w-[18px]" />
          <span className="mt-1 text-xs font-bold leading-none">背包</span>
          <span className="mt-1 font-mono text-[10px] leading-none text-slate-500">
            B
          </span>
        </button>
      </HudPanel>
    </div>
  );
}
