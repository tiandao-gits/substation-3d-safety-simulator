import { Crosshair, Lock, Radio, Volume2, X } from 'lucide-react';
import { hudStore, useHudSnapshot } from '../../game/hudStore';
import { soundEngine } from '../../game/sound';

export function LaserRangefinderHud() {
  const hud = useHudSnapshot();
  const {
    laserModeActive,
    laserMeasurement,
    laserLockedMeasurement,
    spatialSoundLabel,
    spatialSoundPan,
  } = hud;

  const handleLockReading = () => {
    if (!laserMeasurement) return;
    soundEngine.playLaserMeasure();
    hudStore.update({ laserLockedMeasurement: laserMeasurement });
  };

  const handleCloseLaser = () => {
    soundEngine.playUiBeep();
    hudStore.update({ laserModeActive: false, laserMeasurement: null });
  };

  return (
    <>
      {/* 3D 空间音效（电晕放电声 / 设备异响）双耳声像定位指示条 */}
      {spatialSoundLabel && (
        <div
          aria-label="3D 空间声学监测"
          className="pointer-events-none fixed top-16 left-1/2 z-20 -translate-x-1/2 select-none"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-sky-400/45 bg-slate-950/85 px-3.5 py-1 font-mono text-[11px] text-sky-200 shadow-lg backdrop-blur-md">
            <Volume2 className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            <span>3D 空间声场：{spatialSoundLabel}</span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-amber-300">
              <span>L</span>
              <span className="relative inline-block h-1.5 w-10 rounded-full bg-slate-700">
                <span
                  className="absolute top-0 h-1.5 w-2 rounded-full bg-amber-400 transition-all"
                  style={{
                    left: `${Math.round(((spatialSoundPan + 1) / 2) * 80)}%`,
                  }}
                />
              </span>
              <span>R</span>
            </span>
          </div>
        </div>
      )}

      {/* 激光测距仪实时 Raycast 瞄准准星与实测遥测浮窗 */}
      {laserModeActive && (
        <>
          {/* 屏幕中央激光瞄准十字准星 */}
          <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_#ef4444]" />
              <div className="h-9 w-9 rounded-full border border-red-500/70" />
              <div className="absolute h-px w-12 bg-red-500/50" />
              <div className="absolute h-12 w-px bg-red-500/50" />
            </div>
          </div>

          {/* 右下角 Raycast 激光测距实时数显仪面板 */}
          <div
            role="region"
            aria-label="Raycast 实时激光测距仪"
            className="pointer-events-auto fixed right-5 bottom-22 z-30 w-[330px] rounded-xl border border-red-500/60 bg-slate-950/92 p-3.5 text-slate-100 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md select-none"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-red-300">
                <Crosshair className="h-4 w-4 text-red-400" />
                <span>RAYCAST 3D 激光测距仪</span>
              </div>
              <button
                type="button"
                onClick={handleCloseLaser}
                className=" inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 hover:border-red-400 hover:text-white cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>关闭 [T]</span>
              </button>
            </div>

            {laserMeasurement ? (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-baseline justify-between rounded-lg border border-red-500/35 bg-slate-900/90 px-3 py-2">
                  <div>
                    <div className="font-mono text-[10px] tracking-wider text-red-300/90">
                      REAL-TIME 3D RAYCAST DISTANCE
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1.5 font-mono">
                      <span className="text-3xl font-black tabular-nums text-white">
                        {laserMeasurement.distanceM.toFixed(2)}
                      </span>
                      <span className="text-sm font-bold text-red-300">m</span>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-300">
                    <div>水平：{laserMeasurement.horizontalM.toFixed(2)} m</div>
                    <div>
                      高差：{laserMeasurement.deltaYM >= 0 ? '+' : ''}
                      {laserMeasurement.deltaYM.toFixed(2)} m (
                      {laserMeasurement.pitchDeg.toFixed(1)}°)
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-slate-900/75 px-2.5 py-1.5 text-[11.5px]">
                  <div className="flex items-center gap-1.5 font-semibold text-sky-300">
                    <Radio className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    <span className="truncate">{laserMeasurement.targetLabel}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-slate-400">
                    {laserMeasurement.standardCode}
                  </div>
                  <div
                    className={`mt-1 font-mono text-[11px] font-bold ${
                      laserMeasurement.isSafe ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {laserMeasurement.safetySummary}
                  </div>
                </div>

                {laserLockedMeasurement && (
                  <div className="flex items-center justify-between rounded border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 font-mono text-[11px] text-emerald-200">
                    <span className="flex items-center gap-1 truncate">
                      <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
                      <span className="truncate">
                        锁定值：{laserLockedMeasurement.distanceM.toFixed(2)} m (
                        {laserLockedMeasurement.targetLabel})
                      </span>
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10.5px] text-slate-400">
                    移动视角或鼠标对准带电体实测
                  </span>
                  <button
                    type="button"
                    onClick={handleLockReading}
                    className="rounded border border-red-400/70 bg-red-950/80 px-2.5 py-1 font-mono text-[11px] font-bold text-red-100 hover:bg-red-900 cursor-pointer"
                  >
                    锁定读数 [R]
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                正在初始化激光射线...
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
