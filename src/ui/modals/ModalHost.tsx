import type { ChangeEvent } from 'react';
import { BackpackModal } from './BackpackModal';
import { CharacterModal } from './CharacterModal';
import { ExitConfirmModal } from './ExitConfirmModal';
import { HelpModal } from './HelpModal';
import { SettingsModal } from './SettingsModal';

export type ActiveModal =
  | 'character'
  | 'backpack'
  | 'settings'
  | 'help'
  | 'exit'
  | null;

interface ModalHostProps {
  activeModal: ActiveModal;
  onClose: () => void;
  onConfirmExit: () => void;
  isMuted: boolean;
  assetStatusMsg: string;
  onToggleMute: () => void;
  onReloadRoles: () => void;
  onUploadCharacter: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadProp: (event: ChangeEvent<HTMLInputElement>) => void;
  onTogglePerspective: () => void;
  onToggleDetailMode: () => void;
  onRestart: () => void;
}

/** 单一弹窗栈：同一时间只允许一个系统弹窗。 */
export function ModalHost({
  activeModal,
  onClose,
  onConfirmExit,
  isMuted,
  assetStatusMsg,
  onToggleMute,
  onReloadRoles,
  onUploadCharacter,
  onUploadProp,
  onTogglePerspective,
  onToggleDetailMode,
  onRestart,
}: ModalHostProps) {
  switch (activeModal) {
    case 'character':
      return <CharacterModal onClose={onClose} />;
    case 'backpack':
      return <BackpackModal onClose={onClose} />;
    case 'help':
      return <HelpModal onClose={onClose} />;
    case 'exit':
      return <ExitConfirmModal onClose={onClose} onConfirm={onConfirmExit} />;
    case 'settings':
      return (
        <SettingsModal
          isMuted={isMuted}
          assetStatusMsg={assetStatusMsg}
          onToggleMute={onToggleMute}
          onReloadRoles={onReloadRoles}
          onUploadCharacter={onUploadCharacter}
          onUploadProp={onUploadProp}
          onTogglePerspective={onTogglePerspective}
          onToggleDetailMode={onToggleDetailMode}
          onRestart={onRestart}
          onClose={onClose}
        />
      );
    default:
      return null;
  }
}
