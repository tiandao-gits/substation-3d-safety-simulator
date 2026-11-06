import React, { useEffect, useState, type RefObject } from 'react';
import { useHudSnapshot } from '../../game/hudStore';
import type { GameState } from '../../game/rules';

export interface ViewportEffectsProps {
  canvasMountRef: RefObject<HTMLDivElement | null>;
  gameState: GameState;
  droneFlashActive: boolean;
  electrocuted: boolean;
}

/**
 * 承载 3D WebGL 画布容器以及全屏视觉滤镜（标题暖金滤镜、10kV 暗室与圆形手电筒随动光斑、无人机快门闪白、越线触电电弧闪光）。
 */
export function ViewportEffects({
  canvasMountRef,
  gameState,
  droneFlashActive,
  electrocuted,
}: ViewportEffectsProps) {
  const hud = useHudSnapshot();
  const [pointerNorm, setPointerNorm] = useState<{ x: number; y: number }>({
    x: 0.36,
    y: 0.48,
  });

  const in10kVRoom = gameState === 'playing' && hud.insideApartmentRoom;

  useEffect(() => {
    if (!in10kVRoom || !hud.flashlightOn) return;
    const onPointerMove = (e: PointerEvent) => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      setPointerNorm({
        x: Math.max(0.08, Math.min(0.92, e.clientX / w)),
        y: Math.max(0.1, Math.min(0.9, e.clientY / h)),
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [in10kVRoom, hud.flashlightOn]);

  // 主角移动/转向时，手电筒圆形光斑中心随之平滑偏移（兼顾主角走动摇摆、朝向偏角与鼠标瞄准）
  const walkSwayX = Math.sin(hud.x * 1.9 + hud.z * 1.7) * 9.5;
  const walkSwayY = Math.cos(hud.x * 2.3 - hud.z * 2.1) * 6.5;
  const yawSweepX = Math.sin(hud.yaw) * 14;
  const pitchSweepY = -hud.pitch * 24;
  const beamCenterX = Math.max(
    14,
    Math.min(86, pointerNorm.x * 100 * 0.55 + (46 + yawSweepX + walkSwayX) * 0.45)
  );
  const beamCenterY = Math.max(
    16,
    Math.min(84, pointerNorm.y * 100 * 0.55 + (48 + pitchSweepY + walkSwayY) * 0.45)
  );

  return (
    <>
      <div
        ref={canvasMountRef}
        data-testid="substation-webgl-canvas"
        className="absolute inset-0 w-full h-full transition-[filter] duration-500 ease-out"
        style={
          gameState === 'title'
            ? {
                filter:
                  'sepia(0.36) saturate(1.35) hue-rotate(-14deg) contrast(1.05) brightness(1.04)',
              }
            : in10kVRoom
              ? {
                  filter: hud.flashlightOn
                    ? 'brightness(0.92) contrast(1.08)'
                    : 'brightness(0.58) contrast(1.1) saturate(0.85)',
                }
              : undefined
        }
      />

      {in10kVRoom && !hud.flashlightOn && (
        <div
          data-testid="room-dim-overlay"
          className="pointer-events-none fixed inset-0 z-[2] transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at 45% 48%, rgba(2, 6, 23, 0.34) 0%, rgba(2, 6, 23, 0.62) 65%, rgba(2, 6, 23, 0.82) 100%)',
          }}
        />
      )}

      {in10kVRoom && hud.flashlightOn && (
        <div
          data-testid="room-flashlight-beam"
          className="pointer-events-none fixed inset-0 z-[2] transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle 210px at ${beamCenterX.toFixed(1)}% ${beamCenterY.toFixed(1)}%, rgba(255, 251, 235, 0.28) 0%, rgba(254, 243, 199, 0.14) 48%, rgba(2, 6, 23, 0.48) 74%, rgba(2, 6, 23, 0.78) 100%)`,
          }}
        >
          <div
            className="pointer-events-none absolute h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/35 shadow-[0_0_60px_rgba(254,243,199,0.28),inset_0_0_45px_rgba(255,251,235,0.22)]"
            style={{
              left: `${beamCenterX.toFixed(1)}%`,
              top: `${beamCenterY.toFixed(1)}%`,
            }}
          />
        </div>
      )}

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
