import { Mouse } from 'lucide-react';
import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}

/** 键帽。英文按键最小 10px，避免在 Windows 中文环境下过小。 */
export function Kbd({ children, accent = false, className = '' }: KbdProps) {
  return (
    <kbd
      className={`inline-flex min-h-5 items-center justify-center rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
        accent
          ? 'border-amber-400 bg-amber-500/20 font-bold text-amber-200'
          : 'border-slate-600 bg-slate-800/90 text-slate-200'
      } ${className}`}
    >
      {children}
    </kbd>
  );
}

interface KeyComboProps {
  keys: string[];
  accent?: boolean;
}

/** 渲染一组按键；鼠标用图标代替 emoji，避免字体缺字变方框。 */
export function KeyCombo({ keys, accent = false }: KeyComboProps) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) =>
        key === '鼠标' ? (
          <Kbd key={key} accent={accent} className="px-1">
            <Mouse className="h-3 w-3" aria-label="鼠标" />
          </Kbd>
        ) : (
          <Kbd key={key} accent={accent}>
            {key}
          </Kbd>
        )
      )}
    </span>
  );
}
