import { Mouse } from 'lucide-react';
import { CornerBrackets, ImageWithFallback } from './VnChrome';

export interface VnDialogueBoxProps {
  speakerName: string;
  speakerRole?: string;
  speakerRoleEn?: string;
  speakerAvatar?: string;
  channel?: 'phone' | 'radio';
  monologue?: boolean;
  text?: string;
  choicePrompt?: string;
  onClick?: () => void;
  hintLabel?: string;
  className?: string;
}

/**
 * Shared bottom dialogue box used by the prologue VN and in-game cinematic chat.
 * Keeping it in one place guarantees the same speaker header, text scale and
 * confirm hint in both presentation modes.
 */
export function VnDialogueBox({
  speakerName,
  speakerRole,
  speakerRoleEn,
  speakerAvatar,
  channel,
  monologue,
  text,
  choicePrompt,
  onClick,
  hintLabel = '确认',
  className = '',
}: VnDialogueBoxProps) {
  return (
    <div
      role="group"
      aria-label={`${speakerName} 对话`}
      onClick={onClick}
      className={`relative w-full max-w-[980px] bg-[#070e17]/94 border border-slate-700/60 shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-md rounded-xs overflow-hidden transition-all ${
        onClick ? 'cursor-pointer hover:border-amber-400/60' : ''
      } ${className}`}
    >
      <CornerBrackets color="amber" />
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400/90 to-transparent" />

      <div className="p-4 md:p-5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-[#091526] border border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden shrink-0">
              <ImageWithFallback
                src={speakerAvatar}
                alt={speakerName}
                className="h-full w-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600/30 to-sky-900/40">
                    <span className="font-display font-bold text-amber-300 text-sm">
                      {speakerName.slice(0, 1)}
                    </span>
                  </div>
                }
              />
            </div>

            <div className="flex items-baseline flex-wrap gap-x-2">
              <span className="font-display font-bold text-amber-400 text-base md:text-lg tracking-widest">
                {speakerName}
              </span>
              {(speakerRole || speakerRoleEn) && (
                <span className="font-mono text-xs text-slate-400/90 tracking-wider">
                  [ {speakerRole} {speakerRoleEn ? `/ ${speakerRoleEn}` : ''} ]
                </span>
              )}
              {channel && (
                <span className="px-1.5 py-0.5 border border-amber-400/70 bg-amber-500/20 text-amber-300 font-mono text-xs tracking-wider rounded-xs">
                  {channel === 'phone'
                    ? '电话接入 // PHONE CALL'
                    : '对讲接入 // RADIO COMMS'}
                </span>
              )}
              {monologue && (
                <span className="px-1.5 py-0.5 border border-sky-400/70 bg-sky-500/20 text-sky-300 font-mono text-xs tracking-wider rounded-xs">
                  内心独白 // MONOLOGUE
                </span>
              )}
            </div>
          </div>

        </div>

        <div className="min-h-[46px] flex items-start">
          <div className="text-slate-100 text-[16px] md:text-[17px] leading-relaxed tracking-wider font-normal">
            {choicePrompt ? (
              <span className="text-amber-300 font-medium">
                决策指令：{choicePrompt}
              </span>
            ) : (
              text && (
                <>
                  <span className={monologue ? 'italic text-slate-300' : ''}>
                    {text}
                  </span>
                  <span className="inline-block w-[9px] h-[1.15em] bg-amber-400 ml-1.5 align-middle animate-pulse shadow-[0_0_8px_#f59e0b]" />
                </>
              )
            )}
          </div>
        </div>

        <div className="mt-1 pt-1.5 border-t border-slate-800/40 flex items-center justify-end gap-1.5 text-slate-400 text-xs font-mono">
          <kbd className="px-1.5 py-0.5 bg-slate-800/90 border border-slate-600 rounded text-[10px] text-slate-200">
            Space
          </kbd>
          <span>/</span>
          <kbd className="inline-flex items-center px-1.5 py-0.5 bg-slate-800/90 border border-slate-600 rounded text-slate-200">
            <Mouse className="h-3 w-3" aria-label="鼠标" />
          </kbd>
          <span className="ml-1 tracking-wider text-slate-300">{hintLabel}</span>
        </div>
      </div>
    </div>
  );
}
