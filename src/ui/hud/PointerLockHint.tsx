import { MousePointer2 } from 'lucide-react';

/**
 * 鼠标被释放（Esc / 浏览器拒绝锁定）时的轻提示。
 * 整层不接收指针事件，点击会落到下面的 WebGL 画布上重新锁定。
 */
export function PointerLockHint() {
  return (
    <div
      data-testid="pointer-lock-hint"
      className="pointer-events-none fixed inset-0 z-30 flex items-start justify-center pt-24"
    >
      <div className="flex items-center gap-3 rounded-xs border border-sky-400/60 bg-[#06101c]/90 px-5 py-3 shadow-[0_0_28px_rgba(2,6,23,0.65)] backdrop-blur-sm">
        <MousePointer2 className="h-4 w-4 text-sky-300" />
        <div className="leading-tight">
          <div className="text-xs font-bold tracking-[0.12em] text-sky-100">
            鼠标已释放
          </div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.06em] text-slate-300">
            点击画面重新锁定视角 · 按 Esc 随时释放
          </div>
        </div>
      </div>
    </div>
  );
}
