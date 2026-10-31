import type { ChangeEvent } from 'react';
import { BGM_CREDIT } from '../../config/audio';
import { GAME_TEXT } from '../../config/gameText';
import { useHudSnapshot } from '../../game/hudStore';
import { ModalShell } from '../primitives/ModalShell';

interface SettingsModalProps {
  isMuted: boolean;
  assetStatusMsg: string;
  onToggleMute: () => void;
  onReloadRoles: () => void;
  onUploadCharacter: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadProp: (event: ChangeEvent<HTMLInputElement>) => void;
  onTogglePerspective: () => void;
  onToggleDetailMode: () => void;
  onRestart: () => void;
  onClose: () => void;
}

/** 白色平台风格：系统菜单属于「纸面/平板」类，保留白底。 */
export function SettingsModal({
  isMuted,
  assetStatusMsg,
  onToggleMute,
  onReloadRoles,
  onUploadCharacter,
  onUploadProp,
  onTogglePerspective,
  onToggleDetailMode,
  onRestart,
  onClose,
}: SettingsModalProps) {
  const hud = useHudSnapshot();

  return (
    <ModalShell
      variant="paper"
      ariaLabel={GAME_TEXT.settings.dialogAria}
      onClose={onClose}
      maxWidth="max-w-[600px]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-sky-800">
            SETTINGS
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">
              {GAME_TEXT.settings.title}
            </h2>
            <div className="truncate text-xs font-medium text-slate-500">
              画面、声场与 3D 资产配置
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          [ESC] 关闭
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={onTogglePerspective}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <span className="block text-xs font-medium text-slate-400">
              {GAME_TEXT.settings.perspectiveLabel}
            </span>
            <span className="mt-0.5 block font-bold text-slate-900">
              {hud.perspective === 'first-person'
                ? GAME_TEXT.settings.perspectiveValues.firstPerson
                : hud.perspective === 'drone'
                  ? GAME_TEXT.settings.perspectiveValues.drone
                  : GAME_TEXT.settings.perspectiveValues.thirdPerson}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleDetailMode}
            aria-pressed={hud.detailMode === 'detailed'}
            title={GAME_TEXT.settings.renderToggleTitle}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <span className="block text-xs font-medium text-slate-400">
              {GAME_TEXT.settings.renderLabel}
            </span>
            <span className="mt-0.5 block font-bold text-slate-900">
              {hud.detailMode === 'detailed'
                ? GAME_TEXT.settings.renderValues.detailed
                : GAME_TEXT.settings.renderValues.blockout}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-slate-400">
              {GAME_TEXT.settings.clickToToggleHint}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={isMuted}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-sky-400 hover:bg-sky-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            <span className="block text-xs font-medium text-slate-400">
              {GAME_TEXT.settings.soundLabel}
            </span>
            <span className="mt-0.5 block font-bold text-slate-900">
              {isMuted
                ? GAME_TEXT.settings.soundValues.muted
                : GAME_TEXT.settings.soundValues.on}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs font-medium text-slate-400">
          <span>{BGM_CREDIT}</span>
          <span>单曲循环 · 默认静音</span>
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-slate-900">
                {GAME_TEXT.settings.rolesTitle}
              </div>
              <div className="text-xs leading-5 text-slate-500">
                {GAME_TEXT.settings.rolesBinding}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onReloadRoles}
                className="whitespace-nowrap rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-800 transition-colors hover:bg-sky-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              >
                {GAME_TEXT.settings.reloadRolesButton}
              </button>
              <label className="cursor-pointer whitespace-nowrap rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 focus-within:ring-2 focus-within:ring-sky-400/60">
                <span>{GAME_TEXT.settings.chooseFbxButton}</span>
                <input
                  type="file"
                  multiple
                  accept=".fbx,.glb,.gltf"
                  onChange={onUploadCharacter}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-slate-900">
                {GAME_TEXT.settings.propTitle}
              </div>
              <div className="text-xs leading-5 text-slate-500">
                {GAME_TEXT.settings.propHint}
              </div>
            </div>
            <label className="shrink-0 cursor-pointer whitespace-nowrap rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-200 focus-within:ring-2 focus-within:ring-amber-400/60">
              <span>{GAME_TEXT.settings.importPropButton}</span>
              <input
                type="file"
                accept=".glb,.gltf,.fbx"
                onChange={onUploadProp}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-500">
          {assetStatusMsg}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
        <button
          type="button"
          onClick={onRestart}
          className="whitespace-nowrap rounded-md border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
        >
          {GAME_TEXT.settings.resetButton}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="whitespace-nowrap rounded-md border border-sky-600 bg-sky-600 px-5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          {GAME_TEXT.settings.confirmButton}
        </button>
      </footer>
    </ModalShell>
  );
}
