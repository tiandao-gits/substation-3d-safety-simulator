import { Navigation } from 'lucide-react';
import * as THREE from 'three';
import type { RefObject } from 'react';
import type { Act1PointDef } from '../../game/act1';
import type { HudSnapshot } from '../../game/hudStore';

interface WorldMarkerProps {
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  point: Act1PointDef | null;
  hud: HudSnapshot;
  visible: boolean;
}

/**
 * 当前检查点的屏幕投影标记：在视野内时贴在目标上，离开视野时吸附到屏幕边缘并显示方向箭头。
 * 只在 HUD 的 80ms 快照上更新，不额外驱动 React。
 */
export function WorldMarker({ cameraRef, point, hud, visible }: WorldMarkerProps) {
  const camera = cameraRef.current;
  if (!visible || !point || !camera) return null;

  const world = new THREE.Vector3(point.x, point.focusY + 1.0, point.z);
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const behind = world.clone().sub(camera.position).dot(forward) < 0;
  const ndc = world.clone().project(camera);

  const width = window.innerWidth;
  const height = window.innerHeight;
  let x = behind ? -ndc.x : ndc.x;
  let y = behind ? -ndc.y : ndc.y;
  const offscreen =
    behind || Math.abs(ndc.x) > 0.96 || Math.abs(ndc.y) > 0.94;

  const screenX = x * (width / 2) + width / 2;
  const screenY = -y * (height / 2) + height / 2;
  const marginX = 110;
  const marginTop = 100;
  const marginBottom = 150;
  const clampedX = Math.min(
    width - marginX,
    Math.max(marginX, screenX)
  );
  const clampedY = Math.min(
    height - marginBottom,
    Math.max(marginTop, screenY)
  );
  const distance = Math.round(
    Math.hypot(point.x - hud.x, point.z - hud.z)
  );
  const angle =
    Math.atan2(clampedY - height / 2, clampedX - width / 2) * (180 / Math.PI) + 90;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: clampedX,
        top: clampedY,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex items-center gap-1.5">
        {offscreen && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/80 bg-[#07131f]/95">
            <Navigation
              className="h-3.5 w-3.5 text-amber-300"
              style={{ transform: `rotate(${angle}deg)` }}
            />
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-xs border border-amber-400/70 bg-[#07131f]/95 px-2.5 py-1 shadow-[0_4px_14px_rgba(0,0,0,0.6)]">
          <span className="text-xs font-semibold text-amber-100">
            {point.shortName}
          </span>
          <span className="font-mono text-[10px] text-amber-300/90">
            {distance}m
          </span>
        </span>
      </div>
    </div>
  );
}
