import React, { useEffect, useRef } from 'react';
import { GAME_TEXT } from '../config/gameText';
import { RADAR_RANGE_METERS, projectRadarTarget } from '../game/radar';

export interface RadarMarker {
  id: string;
  x: number;
  z: number;
  done: boolean;
  /** 任务序号（1–6），显示在光点旁。 */
  label?: string;
  /** 当前建议前往的任务点，使用琥珀色脉冲环突出。 */
  active?: boolean;
}

/** 雷达在界面上的显示尺寸（画布内部按 DPR 放大）。 */
const RADAR_CSS_SIZE = 184;

interface SubstationMinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  markers: RadarMarker[];
  allowTeleport?: boolean;
  onTeleport?: (x: number, z: number) => void;
}

export const SubstationMinimap: React.FC<SubstationMinimapProps> = ({
  playerX,
  playerZ,
  playerYaw,
  markers,
  allowTeleport = false,
  onTeleport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 按设备像素比放大画布内部分辨率，高 DPI 屏上不再发糊。
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(RADAR_CSS_SIZE * dpr);
    canvas.height = Math.round(RADAR_CSS_SIZE * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRadar(ctx, RADAR_CSS_SIZE, RADAR_CSS_SIZE);
  }, [playerX, playerZ, playerYaw, markers]);

  const drawRadar = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const cx = width / 2;
    const cy = height / 2;
    const r = width / 2 - 8;

    ctx.clearRect(0, 0, width, height);

    // Clip to radar circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // 1. Radar Background (Military Deep Tactical Green Gradient)
    const bgGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    bgGrad.addColorStop(0, 'rgba(6, 32, 20, 0.96)');
    bgGrad.addColorStop(0.7, 'rgba(4, 20, 13, 0.98)');
    bgGrad.addColorStop(1, 'rgba(2, 10, 6, 0.99)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Concentric Range Rings (Neon Green)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.32)';
    ctx.lineWidth = 1;
    for (const frac of [0.33, 0.66, 0.95]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Crosshairs (Green axes)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.38)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // 4. Objective Markers / Blips (north-up, 50 m task map)
    const plotRadius = r * 0.88;
    const projected = markers.map((marker) => ({
      marker,
      projection: projectRadarTarget(
        playerX,
        playerZ,
        marker.x,
        marker.z,
        plotRadius,
        RADAR_RANGE_METERS
      ),
    }));
    const activeTarget = projected.find((entry) => entry.marker.active);

    if (activeTarget) {
      const targetRadius = Math.hypot(
        activeTarget.projection.dx,
        activeTarget.projection.dy
      );
      const scale =
        targetRadius > r - 8 ? (r - 8) / Math.max(targetRadius, 0.001) : 1;
      const tx = cx + activeTarget.projection.dx * scale;
      const ty = cy + activeTarget.projection.dy * scale;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    for (const { marker, projection } of projected) {
      const distancePx = Math.hypot(projection.dx, projection.dy);
      if (distancePx > r - 6 && !marker.active) continue;
      const scale = distancePx > r - 8 ? (r - 8) / distancePx : 1;
      const px = cx + projection.dx * scale;
      const py = cy + projection.dy * scale;
      const color = marker.done
        ? '#94a3b8'
        : marker.active
          ? '#f59e0b'
          : '#38bdf8';

      // Glow halo
      ctx.beginPath();
      ctx.arc(px, py, marker.active ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = marker.active
        ? 'rgba(245, 158, 11, 0.3)'
        : marker.done
          ? 'rgba(148, 163, 184, 0.2)'
          : 'rgba(56, 189, 248, 0.25)';
      ctx.fill();

      // Core blip
      ctx.beginPath();
      ctx.arc(px, py, marker.active ? 4.6 : marker.done ? 4.0 : 4.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = marker.active ? '#fff7ed' : '#e0f2fe';
      ctx.lineWidth = marker.active ? 1.4 : 1;
      ctx.stroke();

      // 已完成点位画一个灰色勾，给玩家进度感。
      if (marker.done) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px - 2, py);
        ctx.lineTo(px - 0.5, py + 1.8);
        ctx.lineTo(px + 2.2, py - 1.8);
        ctx.stroke();
      }

      // Task index + live distance for the active target
      if (marker.label) {
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = marker.done
          ? 'rgba(148, 163, 184, 0.85)'
          : marker.active
            ? '#fde68a'
            : 'rgba(226, 232, 240, 0.95)';
        ctx.fillText(marker.label, px, py - 9);
      }
      if (marker.active) {
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fde68a';
        ctx.fillText(`${Math.round(projection.distanceMeters)}m`, px, py + 11);
      }
    }

    // 7. Center Player Pointer (Chevron pointing along yaw)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerYaw);

    // Forward vision cone
    const fovGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.65);
    fovGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    fovGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
    ctx.fillStyle = fovGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.65, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    ctx.closePath();
    ctx.fill();

    // Player arrow
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // 8. Cardinal Directions (Amber / Gold)
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, 14);
    ctx.fillText('S', cx, height - 14);
    ctx.fillText('W', 14, cy);
    ctx.fillText('E', width - 14, cy);

    ctx.restore();

    // 9. Outer Bezel & Degree Ticks (Drawn on unclipped canvas)
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Degree ticks
    for (let deg = 0; deg < 360; deg += 10) {
      const angle = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const tickLen = isMajor ? 5 : 3;
      const x1 = cx + Math.cos(angle) * (r - tickLen);
      const y1 = cy + Math.sin(angle) * (r - tickLen);
      const x2 = cx + Math.cos(angle) * r;
      const y2 = cy + Math.sin(angle) * r;

      ctx.strokeStyle = isMajor
        ? 'rgba(245, 158, 11, 0.85)'
        : 'rgba(74, 222, 128, 0.5)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Gauge accent arcs on outer bezel (Amber / Green segments)
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI * 0.65, Math.PI * 0.75);
    ctx.stroke();

    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, Math.PI * 1.65, Math.PI * 1.78);
    ctx.stroke();
  };

  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!allowTeleport || !onTeleport || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;
    const wx = playerX + (clickX / (rect.width * 0.44)) * RADAR_RANGE_METERS;
    const wz = playerZ + (clickY / (rect.height * 0.44)) * RADAR_RANGE_METERS;
    onTeleport(wx, wz);
  };

  return (
    <div className="pointer-events-auto select-none">
      <canvas
        ref={canvasRef}
        onClick={handleRadarClick}
        aria-label={GAME_TEXT.minimap.ariaLabel}
        style={{ width: RADAR_CSS_SIZE, height: RADAR_CSS_SIZE }}
        className={`block rounded-full shadow-[0_0_24px_rgba(4,20,13,0.95)] ${
          allowTeleport ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />
      <div className="pointer-events-none mt-1 whitespace-nowrap text-center font-mono text-xs tracking-wider text-emerald-300/80">
        坐标 X {playerX.toFixed(1)} / Z {playerZ.toFixed(1)}
      </div>
    </div>
  );
};
