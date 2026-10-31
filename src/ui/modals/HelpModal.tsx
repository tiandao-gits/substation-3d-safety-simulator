import { GAME_TEXT, KEY_BINDINGS } from '../../config/gameText';
import { KeyCombo } from '../primitives/Kbd';
import { ModalShell } from '../primitives/ModalShell';

interface HelpModalProps {
  onClose: () => void;
}

/** 帮助弹窗与标题页共用 KEY_BINDINGS，避免三处快捷键说明再次漂移。 */
export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <ModalShell
      variant="dark"
      ariaLabel={GAME_TEXT.help.dialogAria}
      onClose={onClose}
      maxWidth="max-w-[620px]"
    >
      <div className="flex items-center justify-between border-b border-amber-500/25 bg-[#09111c] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-[3px] border border-amber-400/80 bg-amber-500/15 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-amber-300">
            HELP
          </span>
          <h2 className="text-sm font-bold tracking-wide text-white">
            {GAME_TEXT.help.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-slate-700 px-3 py-1 text-xs tracking-wider text-slate-300 transition-colors hover:border-amber-400 hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          [X] 关闭
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0c1421]/90 p-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {KEY_BINDINGS.map((binding) => (
            <div
              key={binding.label}
              className="flex items-center justify-between gap-3 border-b border-slate-800/80 py-1.5"
            >
              <KeyCombo keys={binding.keys} accent={binding.accent} />
              <span
                className={`text-right text-xs ${
                  binding.accent ? 'text-amber-200' : 'text-slate-300'
                }`}
              >
                {binding.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xs border border-slate-700/70 bg-[#08121e]/80 px-3 py-2 text-xs leading-5 text-slate-400">
          选错仪器会消耗检查机会，机会耗尽本幕直接失败。靠近带电红线会触发屏幕红色警示与蜂鸣，请勿跨越。
        </div>
      </div>

      <div className="flex justify-end border-t border-amber-500/25 bg-[#09111c] px-5 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-amber-400/80 bg-amber-500/20 px-5 py-1 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          关闭
        </button>
      </div>
    </ModalShell>
  );
}
