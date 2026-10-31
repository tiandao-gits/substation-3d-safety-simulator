import { useState } from 'react';
import { GAME_TEXT, KEY_BINDINGS } from '../../config/gameText';
import { KeyCombo } from '../primitives/Kbd';

interface TitleScreenProps {
  hasStoryProgress: boolean;
  sceneStatus: 'loading' | 'ready' | 'error';
  lastProgress?: string | null;
  onStart: () => void;
  onRestart: () => void;
}

const CORE_BINDINGS = KEY_BINDINGS.filter((binding) => binding.core);

export function TitleScreen({
  hasStoryProgress,
  sceneStatus,
  lastProgress,
  onStart,
  onRestart,
}: TitleScreenProps) {
  const [showAllBindings, setShowAllBindings] = useState(false);
  const bindings = showAllBindings ? KEY_BINDINGS : CORE_BINDINGS;
  const startLabel =
    sceneStatus === 'ready'
      ? hasStoryProgress
        ? '继续巡检'
        : '新的开始'
      : sceneStatus === 'error'
        ? GAME_TEXT.sceneLoad.startFailed
        : GAME_TEXT.sceneLoad.startLoading;

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between px-8 pt-8 pb-10 md:px-12 md:pt-12 md:pb-14 pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(6, 14, 25, 0.82) 0%, rgba(6, 14, 25, 0.52) 42%, rgba(6, 14, 25, 0.15) 75%, transparent 100%)',
      }}
    >
      <div className="max-w-2xl my-auto pointer-events-auto">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
            <svg width="44" height="44" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <polygon
                points="26,3 48,15.5 48,36.5 26,49 4,36.5 4,15.5"
                fill="#0a192c"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <path d="M28 13L17 27H25L23 39L35 24H26.5L28 13Z" fill="#facc15" />
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono tracking-[0.16em] text-sky-400 font-bold uppercase">
              {GAME_TEXT.title.logoKicker}
            </div>
          </div>
        </div>

        <h1
          className="font-display text-4xl md:text-5xl font-extrabold text-white tracking-[0.03em] leading-tight mb-6 drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
          style={{ textWrap: 'balance' }}
        >
          {GAME_TEXT.title.headingLine1}
          <span className="block text-white mt-1">{GAME_TEXT.title.headingLine2}</span>
        </h1>

        <div className="max-w-xl bg-[#08121e]/90 border border-slate-700/60 p-4 rounded-xs shadow-xl mb-6">
          <div className="text-xs font-mono tracking-widest text-slate-400 font-semibold uppercase">
            MISSION BRIEF // 任务简报
          </div>
          <p className="text-slate-200 text-sm leading-relaxed tracking-wide font-normal mt-2">
            {GAME_TEXT.title.description}
          </p>
          <div className="mt-2 text-xs tracking-wider text-amber-300/90">
            [ 监理项目部 · 专业监理工程师 ] 陆川（分管安全）
          </div>
          {lastProgress && (
            <div className="mt-3 border-t border-slate-700/70 pt-2 text-xs text-sky-200">
              上次进度：{lastProgress}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {!hasStoryProgress ? (
            <button
              type="button"
              data-start="true"
              disabled={sceneStatus !== 'ready'}
              onClick={onStart}
              className="relative flex items-center justify-between px-6 py-3 rounded-xs bg-gradient-to-r from-sky-950/90 via-[#0a233c]/95 to-[#071728]/90 border border-sky-400/90 shadow-[0_0_24px_rgba(56,189,248,0.35)] hover:border-sky-300 hover:shadow-[0_0_32px_rgba(56,189,248,0.55)] transition-all cursor-pointer group min-w-[210px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            >
              <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-sky-400" />
              <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-sky-400" />
              <div className="flex items-center gap-3">
                <span className="text-sky-400 text-lg font-bold group-hover:scale-110 transition-transform">
                  ▶
                </span>
                <div className="text-left">
                  <div className="text-white text-base md:text-lg font-bold tracking-wider">
                    {startLabel}
                  </div>
                  <div className="text-sky-400 font-mono text-[10px] tracking-widest font-semibold uppercase">
                    START NEW INSPECTION
                  </div>
                </div>
              </div>
              <span className="text-amber-400 font-mono font-bold text-sm tracking-tighter ml-4">
                &gt;&gt;
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                data-start="true"
                disabled={sceneStatus !== 'ready'}
                onClick={onStart}
                className="relative flex items-center justify-between px-6 py-3 rounded-xs bg-gradient-to-r from-sky-950/90 via-[#0a233c]/95 to-[#071728]/90 border border-sky-400/90 shadow-[0_0_24px_rgba(56,189,248,0.35)] hover:border-sky-300 hover:shadow-[0_0_32px_rgba(56,189,248,0.55)] transition-all cursor-pointer group min-w-[210px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-sky-400" />
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-sky-400" />
                <div className="flex items-center gap-3">
                  <span className="text-sky-400 text-lg font-bold group-hover:scale-110 transition-transform">
                    ▶
                  </span>
                  <div className="text-left">
                    <div className="text-white text-base md:text-lg font-bold tracking-wider">
                      {startLabel}
                    </div>
                    <div className="text-sky-400 font-mono text-[10px] tracking-widest font-semibold uppercase">
                      CONTINUE INSPECTION
                    </div>
                  </div>
                </div>
                <span className="text-amber-400 font-mono font-bold text-sm tracking-tighter ml-4">
                  &gt;&gt;
                </span>
              </button>

              <button
                type="button"
                disabled={sceneStatus !== 'ready'}
                onClick={onRestart}
                className="relative flex items-center gap-3 px-5 py-3 rounded-xs bg-[#071220]/80 hover:bg-[#0f2136]/90 border border-slate-600/70 hover:border-amber-400/80 transition-all cursor-pointer group min-w-[170px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-amber-400/60" />
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-amber-400/60" />
                <span className="text-slate-300 group-hover:text-amber-300 text-lg font-bold transition-transform group-hover:rotate-180 duration-500">
                  ↻
                </span>
                <div className="text-left">
                  <div className="text-slate-100 group-hover:text-white text-[15px] font-semibold tracking-wider">
                    重新开始
                  </div>
                  <div className="text-slate-400 group-hover:text-amber-400/80 font-mono text-[10px] tracking-widest font-semibold uppercase">
                    RESTART
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pointer-events-auto mt-8 md:mt-12">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-semibold tracking-wider text-slate-400">
          <span>操作绑定面板 (CONTROL BINDINGS)</span>
          <button
            type="button"
            onClick={() => setShowAllBindings((prev) => !prev)}
            className="rounded-xs border border-slate-600 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-amber-400 hover:text-amber-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            {showAllBindings ? '收起按键' : `查看全部按键 (${KEY_BINDINGS.length})`}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-xs border border-slate-700/60 bg-[#060e18]/90 px-4 py-3.5 md:px-5 md:py-4">
          {bindings.map((binding) => (
            <div key={binding.label} className="flex items-center gap-1.5">
              <KeyCombo keys={binding.keys} accent={binding.accent} />
              <span
                className={`text-xs ${
                  binding.accent ? 'text-amber-200' : 'text-slate-300'
                }`}
              >
                {binding.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
