import { useEffect, useRef } from 'react';
import type { VnLine } from '../game/vn';
import { VN_CHARACTERS } from '../config/vnAssets';
import { VnDialogueBox } from './VnDialogueBox';

interface StoryBubbleProps {
  line: VnLine;
  onClose: () => void;
}

/**
 * In-game cinematic chat: the same shared dialogue box as the prologue VN,
 * letterboxed over the live 3D scene. One click / Space / Enter consumes the
 * current line; the parent keeps the layer up until the queue is empty.
 */
export function StoryBubble({ line, onClose }: StoryBubbleProps) {
  const info = VN_CHARACTERS[line.speakerId];
  const isSystem = line.speakerId === 'system';
  const advancedRef = useRef(false);

  useEffect(() => {
    advancedRef.current = false;
  }, [line.id]);

  const advance = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' ||
        event.code === 'Enter' ||
        event.code === 'NumpadEnter'
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) advance();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const speakerName =
    info?.name ?? (isSystem ? '系统记录' : line.speakerId || '现场');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label={`${speakerName}：${line.text}`}
      onClick={advance}
      className="fixed inset-0 z-40 cursor-pointer select-none overflow-hidden bg-transparent"
    >
      {/* Cinematic letterbox */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[13vh] bg-black" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[19vh] bg-black" />
      <div className="pointer-events-none absolute inset-x-0 top-[13vh] h-16 bg-gradient-to-b from-black/85 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[19vh] h-28 bg-gradient-to-t from-black/85 to-transparent" />

      <div className="absolute inset-x-0 bottom-[5vh] flex justify-center px-4">
        <VnDialogueBox
          speakerName={speakerName}
          speakerRole={info?.role}
          speakerRoleEn={info?.roleEn}
          speakerAvatar={info?.avatar}
          channel={line.channel}
          monologue={line.monologue}
          text={line.text}
        />
      </div>
    </div>
  );
}
