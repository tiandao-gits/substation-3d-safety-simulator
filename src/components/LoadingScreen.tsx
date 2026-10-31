import { GAME_TEXT } from '../config/gameText';

interface LoadingScreenProps {
  status: 'loading' | 'error';
  progress: number;
  loadedMB: number;
  stage?: 'character' | 'finalizing';
  error?: string;
}

/**
 * Full-screen cover for the blockout download: the station model and the
 * Mixamo role FBX are fetched together, and neither the procedural stand-in
 * nor the title screen shows until both are mounted.
 */
export function LoadingScreen({ status, progress, loadedMB, stage, error }: LoadingScreenProps) {
  const failed = status === 'error';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050b14] px-6">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="relative w-full max-w-xl">
        <div className="text-[11px] font-mono-num tracking-[0.28em] text-sky-400">
          {GAME_TEXT.title.logoKicker}
        </div>
        <h1 className="mt-4 font-display text-3xl md:text-4xl font-bold text-white tracking-[0.05em] leading-tight">
          {GAME_TEXT.title.headingLine1}
          <span className="block text-sky-400 text-2xl md:text-3xl mt-1.5">
            {GAME_TEXT.title.headingLine2}
          </span>
        </h1>

        <div className="mt-10 h-[3px] w-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${failed ? 'bg-red-400' : 'bg-sky-400'}`}
            style={{ width: failed ? '100%' : `${Math.max(3, progress * 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-4 text-xs tracking-[0.08em]">
          <span className={failed ? 'text-red-300' : 'text-sky-200'}>
            {failed
              ? GAME_TEXT.sceneLoad.loadFailed
              : stage === 'character'
                ? GAME_TEXT.sceneLoad.loadingCharacter
                : stage === 'finalizing'
                  ? GAME_TEXT.sceneLoad.finalizing
                  : GAME_TEXT.sceneLoad.loading}
          </span>
          {!failed && (
            <span className="font-mono-num text-sky-300 whitespace-nowrap">
              {progress > 0 ? `${Math.round(progress * 100)}%` : GAME_TEXT.sceneLoad.connecting}
              {loadedMB > 0 ? ` · ${loadedMB.toFixed(1)} MB` : ''}
            </span>
          )}
        </div>

        {failed && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-xs text-red-200/90 leading-relaxed">
              {error ? `${GAME_TEXT.sceneLoad.loadFailed}：${error}` : GAME_TEXT.sceneLoad.loadFailed}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 px-4 py-2 rounded-sm border border-red-400/60 text-red-200 hover:bg-red-950/60 text-xs font-semibold tracking-[0.08em] cursor-pointer"
            >
              {GAME_TEXT.sceneLoad.retryButton}
            </button>
          </div>
        )}

        {!failed && (
          <div className="mt-10 text-xs text-slate-500 tracking-[0.1em]">
            {GAME_TEXT.title.operator}
          </div>
        )}
      </div>
    </div>
  );
}
