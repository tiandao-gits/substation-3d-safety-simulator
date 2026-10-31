import React, { type RefObject } from 'react';
import type { GameState } from '../../game/rules';

export interface ViewportEffectsProps {
  canvasMountRef: RefObject<HTMLDivElement | null>;
  gameState: GameState;
  droneFlashActive: boolean;
  electrocuted: boolean;
}

/**
 * 承载 3D WebGL 画布容器以及全屏视觉滤镜（标题暖金滤镜、无人机快门闪白、越线触电电弧闪光）。
 */
export function ViewportEffects({
  canvasMountRef,
  gameState,
  droneFlashActive,
  electrocuted,
}: ViewportEffectsProps) {
  return (
    <>
      <div
        ref={canvasMountRef}
        data-testid="substation-webgl-canvas"
        className="absolute inset-0 w-full h-full transition-[filter] duration-700 ease-out"
        style={
          gameState === 'title'
            ? {
                filter:
                  'sepia(0.36) saturate(1.35) hue-rotate(-14deg) contrast(1.05) brightness(1.04)',
              }
            : undefined
        }
      />

      {gameState === 'title' && (
        <div
          className="absolute inset-0 pointer-events-none z-[1] transition-opacity duration-700 ease-out"
          style={{
            background:
              'radial-gradient(ellipse at 60% 25%, rgba(254, 240, 138, 0.22) 0%, rgba(245, 158, 11, 0.16) 60%, rgba(180, 83, 9, 0.12) 100%)',
            mixBlendMode: 'color',
          }}
        />
      )}

      {droneFlashActive && (
        <div className="fixed inset-0 z-40 bg-white/70 pointer-events-none transition-opacity" />
      )}

      {electrocuted && (
        <div className="electric-shock-fx fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-sky-100/80 mix-blend-screen" />
          <div className="absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 bg-white/70 blur-2xl" />
        </div>
      )}
    </>
  );
}
