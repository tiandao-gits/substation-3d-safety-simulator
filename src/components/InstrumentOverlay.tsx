import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair, Flame, Gauge, Radio, Scan } from 'lucide-react';
import { type Act1PointId, type Act1Variant, type ActNo } from '../game/act1';
import {
  computeMeterSweepFrame,
  sampleThermalCrosshairTemp,
  temperatureToIronbowRgb,
  type MeterSweepConfig,
} from '../game/instrumentSim';
import { soundEngine } from '../game/sound';

interface ThermalImagerViewfinderProps {
  pointId: Act1PointId;
  variant: Act1Variant;
  act: ActNo;
  mode: 'ir-3' | 'ir-1' | 'ir-casual' | 'oil-temp';
  alreadyRecorded: boolean;
  onRecordReading: () => void;
  onCloseViewfinder: () => void;
}

/**
 * 便携式红外热像仪取景框（Canvas 铁红伪彩热场 + 准星扫测 A/B/C 三相 + 实时热点追踪）。
 */
export function ThermalImagerViewfinder({
  pointId,
  variant,
  act,
  mode,
  alreadyRecorded,
  onRecordReading,
  onCloseViewfinder,
}: ThermalImagerViewfinderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 默认先对准 A 相，引导玩家扫过 B 相发现高温热斑
  const [aim, setAim] = useState<{ x: number; y: number }>(() =>
    pointId === 'a2-oil' ? { x: 0.5, y: 0.52 } : { x: 0.5, y: 0.45 }
  );
  const [scannedPhases, setScannedPhases] = useState<string[]>(() =>
    pointId === 'a2-oil' ? ['OIL'] : ['B']
  );
  const lastLockedPhaseRef = useRef<string | null>(null);

  const sample = useMemo(
    () =>
      sampleThermalCrosshairTemp(pointId, variant, act, aim.x, aim.y, mode),
    [pointId, variant, act, aim.x, aim.y, mode]
  );

  useEffect(() => {
    const locked = sample.lockedPhase?.phase ?? null;
    if (locked && locked !== lastLockedPhaseRef.current) {
      lastLockedPhaseRef.current = locked;
      soundEngine.playUiBeep();
      setScannedPhases((prev) =>
        prev.includes(locked) ? prev : [...prev, locked]
      );
    } else if (!locked) {
      lastLockedPhaseRef.current = null;
    }
  }, [sample.lockedPhase]);

  // 绘制铁红（Ironbow）伪彩热像图与各相热斑辉光
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    const minScaleC = sample.ambientC - 2;
    const maxScaleC = Math.max(98, sample.maxTempC + 4);

    for (let py = 0; py < h; py++) {
      const ny = py / h;
      const scanlineMod = py % 2 === 0 ? 1 : 0.92;
      for (let px = 0; px < w; px++) {
        const nx = px / w;
        let localTemp = sample.ambientC;
        for (const t of sample.targets) {
          const dx = nx - t.normX;
          const dy = (ny - t.normY) * 1.15;
          const dist2 = dx * dx + dy * dy;
          const sigma = t.isHotspot ? 0.135 : 0.095;
          const weight = Math.exp(-dist2 / (2 * sigma * sigma));
          const contrib = sample.ambientC + (t.tempC - sample.ambientC) * weight;
          if (contrib > localTemp) localTemp = contrib;
        }
        const [r, g, b] = temperatureToIronbowRgb(
          localTemp,
          minScaleC,
          maxScaleC
        );
        const idx = (py * w + px) * 4;
        data[idx] = Math.round(r * scanlineMod);
        data[idx + 1] = Math.round(g * scanlineMod);
        data[idx + 2] = Math.round(b * scanlineMod);
        // 让热斑区域更不透明、背景环境半透叠在 3D 实景设备上
        const heatFactor = Math.max(
          0,
          Math.min(1, (localTemp - sample.ambientC) / 55)
        );
        data[idx + 3] = Math.round((0.46 + heatFactor * 0.44) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // 绘制各相导电杆/接头轮廓与最高温自动追踪框
    for (const t of sample.targets) {
      const tx = t.normX * w;
      const ty = t.normY * h;
      ctx.save();
      ctx.strokeStyle = t.isHotspot
        ? 'rgba(254, 240, 138, 0.95)'
        : 'rgba(125, 211, 252, 0.72)';
      ctx.lineWidth = t.isHotspot ? 1.8 : 1.2;
      ctx.strokeRect(tx - 16, ty - 16, 32, 32);

      ctx.fillStyle = t.isHotspot ? '#fef08a' : '#bae6fd';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(
        `${t.phase === 'OIL' ? '油箱' : `${t.phase}相`} ${t.tempC.toFixed(1)}℃`,
        tx - 24,
        ty - 21
      );
      ctx.restore();
    }

    // 绘制准星十字与中心测温靶标
    const cx = aim.x * w;
    const cy = aim.y * h;
    ctx.save();
    const isHot = sample.crosshairTempC >= 80;
    ctx.strokeStyle = isHot ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 22, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 22);
    ctx.stroke();
    ctx.restore();
  }, [aim.x, aim.y, sample]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = Math.max(0.06, Math.min(0.94, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height));
    setAim({ x: nx, y: ny });
  };

  return (
    <div
      aria-label="便携式红外热像仪取景框"
      className="overflow-hidden rounded-xl border border-sky-400/50 bg-slate-950/90 text-slate-100 shadow-[0_18px_50px_rgba(2,6,23,0.75)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-amber-300">
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span>IR-THERMAL · 便携式红外热像取景框</span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-slate-300">
          <span>ε=0.95</span>
          <span>·</span>
          <span>T₀={sample.ambientC.toFixed(1)}℃</span>
          <button
            type="button"
            onClick={onCloseViewfinder}
            className="ml-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
          >
            收起取景框
          </button>
        </div>
      </div>

      <div className="relative select-none px-3 pt-2.5 pb-2">
        <div className="flex items-stretch gap-2.5">
          {/* 热成像伪彩主视窗 */}
          <div className="relative flex-1 overflow-hidden rounded-lg border border-sky-500/40 bg-slate-950">
            <canvas
              ref={canvasRef}
              width={320}
              height={146}
              onPointerMove={handlePointerMove}
              onClick={handlePointerMove}
              className="block h-[146px] w-full cursor-crosshair"
            />
            {/* 左上实时中心点温度浮层 */}
            <div className="pointer-events-none absolute top-2 left-2 rounded border border-slate-700/90 bg-slate-950/85 px-2 py-1 font-mono text-[11px] leading-4">
              <div className="flex items-center gap-1.5">
                <Crosshair className="h-3 w-3 text-sky-400" />
                <span className="text-slate-400">SPOT</span>
                <span
                  className={`font-bold tabular-nums ${
                    sample.crosshairTempC >= 80
                      ? 'text-amber-300'
                      : 'text-sky-200'
                  }`}
                >
                  {sample.crosshairTempC.toFixed(1)} ℃
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                MAX: <span className="font-bold text-rose-300 tabular-nums">{sample.maxTempC.toFixed(1)} ℃</span>
                {sample.lockedPhase ? ` · 锁定 ${sample.lockedPhase.label}` : ' · 移动准星扫测'}
              </div>
            </div>
          </div>

          {/* 右侧铁红伪彩色标柱 */}
          <div className="flex w-11 shrink-0 flex-col items-center justify-between font-mono text-[9.5px] text-slate-300">
            <span className="font-bold text-amber-200 tabular-nums">
              {Math.max(98, Math.round(sample.maxTempC))}℃
            </span>
            <div
              className="my-1 w-3 flex-1 rounded-sm border border-slate-600"
              style={{
                background:
                  'linear-gradient(to bottom, #fef9c3 0%, #facc15 22%, #ef4444 48%, #9333ea 76%, #1e1b4b 100%)',
              }}
            />
            <span className="text-sky-300 tabular-nums">{sample.ambientC}℃</span>
          </div>
        </div>

        {/* 快速扫测相别切换 + 锁定记录按钮 */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {sample.targets.map((target) => {
              const isAimed = sample.lockedPhase?.phase === target.phase;
              const isScanned = scannedPhases.includes(target.phase);
              return (
                <button
                  key={target.phase}
                  type="button"
                  onClick={() => setAim({ x: target.normX, y: target.normY })}
                  className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10.5px] font-semibold transition-colors cursor-pointer ${
                    isAimed
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : isScanned
                        ? 'border-sky-500/50 bg-slate-900 text-sky-200 hover:border-sky-400'
                        : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>
                    {target.phase === 'OIL'
                      ? '对准顶层油箱'
                      : `对准 ${target.phase} 相`}
                  </span>
                  <span className="tabular-nums opacity-90">
                    ({target.tempC.toFixed(1)}℃)
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playThermalScan();
              onRecordReading();
            }}
            className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-500 px-3 py-1 font-mono text-[11.5px] font-bold text-slate-950 shadow transition-colors hover:bg-amber-400 cursor-pointer"
          >
            {alreadyRecorded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>已记录读数（点击更新）</span>
              </>
            ) : (
              <>
                <Scan className="h-3.5 w-3.5" />
                <span>锁定并记录读数</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AnimatedMeterPanelProps {
  config: MeterSweepConfig;
  triggerKey: number;
}

/**
 * 接地导通 / 漏保动作测试 / 空鼓回波 0.8 秒动态跳字与指针摆动表盘。
 */
export function AnimatedMeterPanel({
  config,
  triggerKey,
}: AnimatedMeterPanelProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastBeepIndexRef = useRef(-1);

  useEffect(() => {
    setElapsedMs(0);
    lastBeepIndexRef.current = -1;
    const startAt = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const dt = now - startAt;
      const frame = computeMeterSweepFrame(config, dt, 800);
      if (
        frame.beepTickIndex > lastBeepIndexRef.current &&
        frame.beepTickIndex <= 3
      ) {
        lastBeepIndexRef.current = frame.beepTickIndex;
        soundEngine.playUiBeep();
      }
      setElapsedMs(dt);
      if (dt < 800) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [config, triggerKey]);

  const frame = useMemo(
    () => computeMeterSweepFrame(config, elapsedMs, 800),
    [config, elapsedMs]
  );

  return (
    <div
      aria-label={config.title}
      className="overflow-hidden rounded-xl border border-sky-400/45 bg-slate-950/92 px-3.5 py-2.5 text-slate-100 shadow-[0_16px_44px_rgba(2,6,23,0.7)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-sky-300">
          <Gauge className="h-3.5 w-3.5 text-sky-400" />
          <span>{config.title}</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-amber-300">
          <Radio className="h-3 w-3" />
          <span>{frame.settled ? '测量锁定 HOLD' : '采样跳动中…'}</span>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-4">
        {/* 模拟指针表盘 SVG */}
        <div className="relative flex h-[74px] w-[124px] shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/90 p-1">
          <svg viewBox="0 0 120 70" className="h-full w-full overflow-visible">
            {/* 刻度弧线 */}
            <path
              d="M 14 58 A 46 46 0 0 1 106 58"
              fill="none"
              stroke="#334155"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 78 21 A 46 46 0 0 1 106 58"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.75"
            />
            {/* 指针 */}
            <g transform={`translate(60, 58) rotate(${frame.needleAngleDeg})`}>
              <line
                x1="0"
                y1="4"
                x2="0"
                y2="-42"
                stroke={frame.settled ? '#38bdf8' : '#facc15'}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="0" cy="0" r="4" fill="#e2e8f0" />
            </g>
            <text
              x="12"
              y="66"
              fill="#64748b"
              fontSize="8"
              fontFamily="monospace"
            >
              0
            </text>
            <text
              x="96"
              y="66"
              fill="#94a3b8"
              fontSize="8"
              fontFamily="monospace"
            >
              {config.maxScale}
            </text>
          </svg>
        </div>

        {/* 数字跳字主读数与分项指标 */}
        <div className="min-w-0 flex-1 font-mono">
          <div className="text-[10.5px] text-slate-400">
            {config.primaryLabel}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight text-amber-300 tabular-nums">
              {frame.displayValue}
            </span>
            <span className="text-xs font-bold text-sky-300">{config.unit}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-slate-300">
            {config.secondaryMetrics.map((m) => (
              <span key={m.label} className="tabular-nums">
                <span className="text-slate-500">{m.label}: </span>
                <span className="font-semibold text-slate-100">{m.value}</span>
                {m.unit ? ` ${m.unit}` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
