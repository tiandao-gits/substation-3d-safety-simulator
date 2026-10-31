import { GAME_TEXT } from '../../config/gameText';
import { ModalShell } from '../primitives/ModalShell';

interface ExitConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

/** 深色警告风格：只用于确认/危险操作。 */
export function ExitConfirmModal({ onClose, onConfirm }: ExitConfirmModalProps) {
  return (
    <ModalShell
      variant="dark"
      accent="red"
      layer="z-50"
      ariaLabel={GAME_TEXT.exitConfirm.dialogAria}
      onClose={onClose}
      maxWidth="max-w-[420px]"
    >
      <div className="border-b border-red-900/60 bg-[#1a0f18] px-5 py-3.5">
        <span className="rounded-[3px] border border-red-500/80 bg-red-950/60 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-red-300">
          退出确认
        </span>
        <h2 className="mt-1.5 text-sm font-bold tracking-wide text-white">
          {GAME_TEXT.exitConfirm.title}
        </h2>
      </div>
      <div className="bg-[#0c1421]/90 px-5 py-4 text-xs leading-relaxed text-slate-200">
        {GAME_TEXT.exitConfirm.body}
      </div>
      <div className="flex justify-end gap-2.5 bg-[#0c1421]/90 px-5 pb-4 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-slate-700 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
        >
          {GAME_TEXT.exitConfirm.continueButton}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xs border border-red-500/80 bg-red-950/80 px-4 py-1.5 text-xs font-bold tracking-wider text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          {GAME_TEXT.exitConfirm.confirmButton}
        </button>
      </div>
    </ModalShell>
  );
}
