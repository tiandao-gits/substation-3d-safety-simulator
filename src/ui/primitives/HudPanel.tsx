import type { ReactNode } from 'react';

/** HUD 面板统一底色与描边；不再使用 backdrop-blur，避免每帧合成开销。 */
export const HUD_PANEL =
  'rounded-md border border-[color:var(--hud-border)] bg-[var(--hud-bg)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]';

interface HudPanelProps {
  children: ReactNode;
  className?: string;
}

export function HudPanel({ children, className = '' }: HudPanelProps) {
  return (
    <div className={`${HUD_PANEL} ${className}`}>{children}</div>
  );
}
