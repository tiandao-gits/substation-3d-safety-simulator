import { GAME_TEXT, PPE_ITEMS } from '../../config/gameText';
import { useHudSnapshot } from '../../game/hudStore';
import { ModalShell } from '../primitives/ModalShell';

interface CharacterModalProps {
  onClose: () => void;
}

export function CharacterModal({ onClose }: CharacterModalProps) {
  const hud = useHudSnapshot();

  return (
    <ModalShell
      variant="dark"
      ariaLabel={GAME_TEXT.character.dialogAria}
      onClose={onClose}
      maxWidth="max-w-[540px]"
    >
      <div className="flex items-center justify-between border-b border-amber-500/25 bg-[#09111c] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-[3px] border border-amber-400/80 bg-amber-500/15 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-amber-300">
            STATUS
          </span>
          <h2 className="text-sm font-bold tracking-wide text-white">
            {GAME_TEXT.character.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-slate-700 px-3 py-1 text-xs tracking-wider text-slate-300 transition-colors hover:border-amber-400 hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          [ESC] 关闭
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-[#0c1421]/90 p-4">
        <div className="grid grid-cols-3 divide-x divide-slate-800 rounded-xs border border-slate-800 bg-[#070e1a]/85">
          <div className="space-y-0.5 p-3">
            <div className="font-mono text-xs tracking-wide text-slate-400">
              {GAME_TEXT.character.labels.status}
            </div>
            <div
              className={`text-xs font-bold tracking-wide ${
                hud.isSafeDistance ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {hud.statusLabel}
              {GAME_TEXT.character.statusSuffix}
            </div>
          </div>
          <div className="space-y-0.5 p-3">
            <div className="font-mono text-xs tracking-wide text-slate-400">
              {GAME_TEXT.character.labels.clearance}
            </div>
            <div
              className={`font-mono text-xs font-bold ${
                hud.isSafeDistance ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {GAME_TEXT.character.clearanceValue(
                hud.distanceLabel,
                hud.clearanceMeters
              )}
            </div>
          </div>
          <div className="space-y-0.5 p-3">
            <div className="font-mono text-xs tracking-wide text-slate-400">
              {GAME_TEXT.character.labels.gait}
            </div>
            <div className="text-xs font-semibold tracking-wide text-amber-200">
              {hud.runLock || hud.motionState === 'Run'
                ? GAME_TEXT.character.gait.running
                : GAME_TEXT.character.gait.walking}{' '}
              /{' '}
              {hud.perspective === 'first-person'
                ? GAME_TEXT.character.perspective.firstPerson
                : hud.perspective === 'drone'
                  ? GAME_TEXT.character.perspective.drone
                  : GAME_TEXT.character.perspective.thirdPerson}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-amber-400">
            [ 个人防护装备穿戴 // MANDATORY PPE ]
          </div>
          <div className="divide-y divide-slate-800/80 rounded-xs border border-slate-800 bg-[#070e1a]/85">
            {PPE_ITEMS.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-3.5 py-2 text-xs tracking-wide"
              >
                <span className="font-medium text-slate-200">{item.name}</span>
                <span className="font-mono text-xs text-emerald-400">{item.spec}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-amber-500/25 bg-[#09111c] px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xs border border-amber-400/80 bg-amber-500/20 px-5 py-1.5 text-xs font-bold tracking-wider text-amber-200 transition-all hover:bg-amber-500/30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          {GAME_TEXT.character.returnButton}
        </button>
      </div>
    </ModalShell>
  );
}
