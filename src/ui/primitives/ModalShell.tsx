import { useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../../components/useFocusTrap';

export type ModalVariant = 'dark' | 'paper';
export type ModalAccent = 'amber' | 'red' | 'sky';

interface ModalShellProps {
  variant: ModalVariant;
  accent?: ModalAccent;
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  layer?: 'z-40' | 'z-50';
}

/**
 * 弹窗外壳：遮罩淡入 + 面板上浮动画 + 焦点陷阱 + 点击遮罩关闭。
 *
 * 风格规则：
 * - paper 只用于阅读/填写文档与系统菜单（备忘录、工作台、背包、设置）。
 * - dark 只用于警告与确认（人物状态、帮助、退出确认、失败提示）。
 */
export function ModalShell({
  variant,
  accent = 'amber',
  ariaLabel,
  onClose,
  children,
  maxWidth = 'max-w-[560px]',
  layer = 'z-40',
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const accentBorder =
    accent === 'red'
      ? 'border-red-500/50 border-t-red-500'
      : accent === 'sky'
        ? 'border-sky-500/45 border-t-sky-500'
        : 'border-amber-500/40 border-t-amber-400';

  const backdrop =
    variant === 'paper'
      ? 'bg-slate-950/55 backdrop-blur-[3px]'
      : 'bg-black/75 backdrop-blur-[4px]';

  const panel =
    variant === 'paper'
      ? `rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.45)]`
      : `rounded-xs border ${accentBorder} bg-[#0c1421]/98 text-left text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.9)]`;

  return (
    <div
      className={`modal-backdrop fixed inset-0 ${layer} flex items-center justify-center overflow-hidden p-4 ${backdrop} pointer-events-auto select-none`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`modal-panel relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden ${panel}`}
      >
        {children}
      </div>
    </div>
  );
}
