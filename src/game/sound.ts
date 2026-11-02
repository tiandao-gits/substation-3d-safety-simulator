import { BGM_TRACKS, type BgmKey } from '../config/audio';

export interface SpatialListenerInput {
  x: number;
  z: number;
  yaw: number;
  act: 1 | 2 | 3;
  variant: string | null;
  active: boolean;
}

export interface SpatialEmitterState {
  id: 'corona-220kv' | 'pd-10kv' | 'equip-anomaly';
  label: string;
  x: number;
  z: number;
  distanceM: number;
  /** 归一化响度权重 0..1 */
  intensity: number;
  /** 立体声声像 -1（左耳）.. +1（右耳） */
  pan: number;
  /** 是否处于缺陷强化异响状态 */
  isDefectAmplified: boolean;
}

export interface SpatialSoundSnapshot {
  corona: SpatialEmitterState;
  partialDischarge: SpatialEmitterState;
  equipmentAnomaly: SpatialEmitterState;
  dominantEmitter: SpatialEmitterState | null;
}

/**
 * 根据玩家朝向 yaw 与声源坐标计算立体声声像 pan (-1 左声道 .. +1 右声道)。
 * 游戏中角色面朝方向为 (-sin(yaw), -cos(yaw))，右侧方向为 (cos(yaw), -sin(yaw))。
 */
export function computeStereoPan(
  listenerX: number,
  listenerZ: number,
  listenerYaw: number,
  sourceX: number,
  sourceZ: number
): number {
  const dx = sourceX - listenerX;
  const dz = sourceZ - listenerZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return 0;
  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);
  const dotRight = (dx / dist) * rightX + (dz / dist) * rightZ;
  return Math.max(-1, Math.min(1, Math.round(dotRight * 100) / 100));
}

/**
 * 纯函数计算变电站 3D 空间声场（220kV 电晕放电声、10kV 开关柜局部放电异响、主变/配电箱设备异响）。
 */
export function computeSpatialSoundState(
  input: SpatialListenerInput
): SpatialSoundSnapshot {
  const { x, z, yaw, act, variant } = input;

  // 1. 220kV 配电装置区电晕放电声（选取 F02 线夹测点与 F03 间隔中点中的较近声源）
  const coronaCandidates = [
    { x: 4.9, z: 21.6, label: '220kV 间隔母线/线夹电晕放电声', defect: act === 1 && variant === 'B' },
    { x: 12.1, z: 7.4, label: '220kV 高压架空母线电晕声', defect: false },
  ];
  let bestCorona = coronaCandidates[0];
  let minCoronaDist = Math.hypot(x - bestCorona.x, z - bestCorona.z);
  for (const c of coronaCandidates.slice(1)) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < minCoronaDist) {
      minCoronaDist = d;
      bestCorona = c;
    }
  }
  const coronaRadius = bestCorona.defect ? 26 : 20;
  const rawCorona = Math.max(0, Math.min(1, 1 - minCoronaDist / coronaRadius));
  const coronaIntensity = Math.min(
    1,
    Math.pow(rawCorona, 1.35) * (bestCorona.defect ? 1.45 : 0.85)
  );
  const corona: SpatialEmitterState = {
    id: 'corona-220kv',
    label: bestCorona.defect
      ? '220kV 间隔 B 相过热线夹电晕放电异响'
      : bestCorona.label,
    x: bestCorona.x,
    z: bestCorona.z,
    distanceM: Math.round(minCoronaDist * 10) / 10,
    intensity: Math.round(coronaIntensity * 1000) / 1000,
    pan: computeStereoPan(x, z, yaw, bestCorona.x, bestCorona.z),
    isDefectAmplified: bestCorona.defect,
  };

  // 2. 10kV 高压配电室开关柜局部放电与母排电磁异响
  const pdX = 35.2;
  const pdZ = -22.4;
  const pdDist = Math.hypot(x - pdX, z - pdZ);
  const pdDefect = act === 1 && variant === 'C';
  const pdRadius = pdDefect ? 16 : 11;
  const rawPd = Math.max(0, Math.min(1, 1 - pdDist / pdRadius));
  const pdIntensity = Math.min(
    1,
    Math.pow(rawPd, 1.4) * (pdDefect ? 1.5 : 0.75)
  );
  const partialDischarge: SpatialEmitterState = {
    id: 'pd-10kv',
    label: pdDefect
      ? '10kV 开关柜穿墙套管局部放电异响'
      : '10kV 开关柜工频电磁嗡鸣',
    x: pdX,
    z: pdZ,
    distanceM: Math.round(pdDist * 10) / 10,
    intensity: Math.round(pdIntensity * 1000) / 1000,
    pan: computeStereoPan(x, z, yaw, pdX, pdZ),
    isDefectAmplified: pdDefect,
  };

  // 3. 设备本体异响（第二幕 1#主变阀门渗油/风扇异响，第三幕施工区配电箱电火花滋滋异响，或运行主变磁致伸缩声）
  const equipSource =
    act === 3
      ? {
          x: -22.1,
          z: -21.7,
          label:
            variant === 'C'
              ? '施工区二级配电箱接触不良电火花异响'
              : '施工区临时配电箱运行嗡鸣',
          defect: variant === 'C',
          radius: 16,
        }
      : act === 2
        ? {
            x: -26.2,
            z: 18.8,
            label:
              variant === 'C'
                ? '1# 主变散热器蝶阀渗油与呼吸器异响'
                : '邻近 2# 运行主变低频磁致伸缩声',
            defect: variant === 'C',
            radius: 18,
          }
        : {
            x: -28.36,
            z: 6.94,
            label: '220kV 运行主变铁芯磁致伸缩轰鸣',
            defect: false,
            radius: 22,
          };

  const equipDist = Math.hypot(x - equipSource.x, z - equipSource.z);
  const rawEquip = Math.max(0, Math.min(1, 1 - equipDist / equipSource.radius));
  const equipIntensity = Math.min(
    1,
    Math.pow(rawEquip, 1.3) * (equipSource.defect ? 1.4 : 0.8)
  );
  const equipmentAnomaly: SpatialEmitterState = {
    id: 'equip-anomaly',
    label: equipSource.label,
    x: equipSource.x,
    z: equipSource.z,
    distanceM: Math.round(equipDist * 10) / 10,
    intensity: Math.round(equipIntensity * 1000) / 1000,
    pan: computeStereoPan(x, z, yaw, equipSource.x, equipSource.z),
    isDefectAmplified: equipSource.defect,
  };

  const candidates = [corona, partialDischarge, equipmentAnomaly].filter(
    (e) => e.intensity >= 0.08
  );
  candidates.sort((a, b) => b.intensity - a.intensity);

  return {
    corona,
    partialDischarge,
    equipmentAnomaly,
    dominantEmitter: candidates[0] ?? null,
  };
}

// Procedural Web Audio API Synthesizer for Substation 3D Simulation
class SubstationAudioEngine {
  private ctx: AudioContext | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  // 3D 空间电晕放电噪声链 (Bandpass filtered noise + 100Hz AC corona modulation + StereoPanner)
  private coronaSource: AudioBufferSourceNode | null = null;
  private coronaGain: GainNode | null = null;
  private coronaPanner: StereoPannerNode | null = null;
  private coronaModOsc: OscillatorNode | null = null;

  // 3D 空间设备异响/局部放电合成链 (150Hz/300Hz harmonic + StereoPanner)
  private anomalyOsc: OscillatorNode | null = null;
  private anomalyGain: GainNode | null = null;
  private anomalyPanner: StereoPannerNode | null = null;
  private lastCrackleAt = 0;
  private lastSpatialSnapshot: SpatialSoundSnapshot | null = null;

  private bgmAudio: HTMLAudioElement | null = null;
  private bgmKey: BgmKey | null = null;
  private bgmWanted: BgmKey | null = null;
  private bgmUnlockArmed = false;
  /** 游戏默认开启声音，玩家可在设置面板 / HUD 声音按钮随时静音。 */
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startAmbientTransformerHum() {
    const ctx = this.ensureContext();
    if (!ctx || this.humOsc1) return;

    try {
      this.humOsc1 = ctx.createOscillator();
      this.humOsc2 = ctx.createOscillator();
      this.humGain = ctx.createGain();

      // 50Hz AC mains fundamental + 100Hz magnetostriction harmonic
      this.humOsc1.type = 'sine';
      this.humOsc1.frequency.value = 50;
      this.humOsc2.type = 'triangle';
      this.humOsc2.frequency.value = 100;

      this.humGain.gain.value = 0.015;
      this.humOsc1.connect(this.humGain);
      this.humOsc2.connect(this.humGain);
      this.humGain.connect(ctx.destination);

      this.humOsc1.start();
      this.humOsc2.start();
      this.ensureSpatialNodes(ctx);
    } catch {
      // Ignore autoplay errors until user gesture
    }
  }

  private ensureSpatialNodes(ctx: AudioContext) {
    if (this.coronaGain) return;
    try {
      // 创建 2 秒循环的高频电晕白噪声缓冲
      const sampleRate = ctx.sampleRate || 44100;
      const bufferLength = sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i++) {
        // 带有轻微脉冲毛刺的电晕噪声基底
        const spike = Math.random() > 0.985 ? (Math.random() - 0.5) * 2.8 : 0;
        data[i] = (Math.random() * 2 - 1) * 0.35 + spike;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 3400;
      bandpass.Q.value = 2.4;

      const modGain = ctx.createGain();
      modGain.gain.value = 0.7;

      // 100Hz 工频倍频电晕调制
      const modOsc = ctx.createOscillator();
      modOsc.type = 'sawtooth';
      modOsc.frequency.value = 100;
      const modDepth = ctx.createGain();
      modDepth.gain.value = 0.3;
      modOsc.connect(modDepth);
      modDepth.connect(modGain.gain);

      const coronaGain = ctx.createGain();
      coronaGain.gain.value = 0;

      const coronaPanner =
        typeof ctx.createStereoPanner === 'function'
          ? ctx.createStereoPanner()
          : null;

      noise.connect(bandpass);
      bandpass.connect(modGain);
      modGain.connect(coronaGain);
      if (coronaPanner) {
        coronaGain.connect(coronaPanner);
        coronaPanner.connect(ctx.destination);
      } else {
        coronaGain.connect(ctx.destination);
      }

      noise.start();
      modOsc.start();

      this.coronaSource = noise;
      this.coronaGain = coronaGain;
      this.coronaPanner = coronaPanner;
      this.coronaModOsc = modOsc;

      // 创建局部放电/设备异响谐波通道
      const anomalyOsc = ctx.createOscillator();
      anomalyOsc.type = 'sawtooth';
      anomalyOsc.frequency.value = 150;

      const anomalyFilter = ctx.createBiquadFilter();
      anomalyFilter.type = 'bandpass';
      anomalyFilter.frequency.value = 420;
      anomalyFilter.Q.value = 3.0;

      const anomalyGain = ctx.createGain();
      anomalyGain.gain.value = 0;

      const anomalyPanner =
        typeof ctx.createStereoPanner === 'function'
          ? ctx.createStereoPanner()
          : null;

      anomalyOsc.connect(anomalyFilter);
      anomalyFilter.connect(anomalyGain);
      if (anomalyPanner) {
        anomalyGain.connect(anomalyPanner);
        anomalyPanner.connect(ctx.destination);
      } else {
        anomalyGain.connect(ctx.destination);
      }

      anomalyOsc.start();
      this.anomalyOsc = anomalyOsc;
      this.anomalyGain = anomalyGain;
      this.anomalyPanner = anomalyPanner;
    } catch {
      // Ignore Web Audio node creation errors on restricted runtimes
    }
  }

  public updateTransformerProximity(
    minDistanceToTransformer: number,
    active: boolean
  ) {
    if (!this.humGain || !this.ctx) return;
    if (!active || this.muted) {
      this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    // Louder 100Hz hum when near the 220kV transformers
    const proximity = Math.max(0, Math.min(1, 1 - minDistanceToTransformer / 28));
    const targetGain = 0.008 + proximity * 0.032;
    this.humGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.12);
  }

  /**
   * 实时更新 3D 空间音效（220kV 电晕放电声、10kV 局部放电声、施工配电箱/主变异响），
   * 按玩家坐标与视角朝向动态调节双耳声像（StereoPanner）与距离衰减。
   */
  public updateSpatialAudio(input: SpatialListenerInput): SpatialSoundSnapshot {
    const snapshot = computeSpatialSoundState(input);
    this.lastSpatialSnapshot = snapshot;

    if (!this.ctx || this.muted || !input.active) {
      if (this.ctx && this.coronaGain) {
        this.coronaGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      if (this.ctx && this.anomalyGain) {
        this.anomalyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return snapshot;
    }

    this.ensureSpatialNodes(this.ctx);
    const now = this.ctx.currentTime;

    // 1. 更新 220kV 电晕放电通道
    if (this.coronaGain) {
      const targetCoronaGain = snapshot.corona.intensity * 0.042;
      this.coronaGain.gain.setTargetAtTime(targetCoronaGain, now, 0.1);
    }
    if (this.coronaPanner) {
      this.coronaPanner.pan.setTargetAtTime(snapshot.corona.pan, now, 0.08);
    }

    // 2. 更新 10kV 局部放电 / 设备异响通道（取两者中较强的一个驱动谐波异响通道）
    const strongerAnomaly =
      snapshot.partialDischarge.intensity >= snapshot.equipmentAnomaly.intensity
        ? snapshot.partialDischarge
        : snapshot.equipmentAnomaly;

    if (this.anomalyGain && this.anomalyOsc) {
      const targetAnomalyGain = strongerAnomaly.intensity * 0.028;
      this.anomalyGain.gain.setTargetAtTime(targetAnomalyGain, now, 0.1);
      const targetFreq =
        strongerAnomaly.id === 'pd-10kv'
          ? strongerAnomaly.isDefectAmplified
            ? 200
            : 100
          : strongerAnomaly.isDefectAmplified
            ? 150
            : 100;
      this.anomalyOsc.frequency.setTargetAtTime(targetFreq, now, 0.12);
    }
    if (this.anomalyPanner) {
      this.anomalyPanner.pan.setTargetAtTime(strongerAnomaly.pan, now, 0.08);
    }

    // 3. 当靠近存在过热/电弧缺陷的测点时，间歇触发短促高频电晕“噼啪”脉冲声
    const dominant = snapshot.dominantEmitter;
    if (
      dominant &&
      dominant.intensity > 0.38 &&
      (dominant.id === 'corona-220kv' || dominant.isDefectAmplified)
    ) {
      const intervalSec = dominant.isDefectAmplified ? 0.55 : 1.35;
      if (now - this.lastCrackleAt > intervalSec && Math.random() < 0.35) {
        this.lastCrackleAt = now;
        this.playCoronaCrackle(dominant.intensity * 0.032, dominant.pan);
      }
    }

    return snapshot;
  }

  public getLastSpatialSnapshot(): SpatialSoundSnapshot | null {
    return this.lastSpatialSnapshot;
  }

  /** 短促的 3D 电晕放电“滋啦/噼啪”脉冲声（带左右声像定位）。 */
  private playCoronaCrackle(gainLevel: number, pan: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400 + Math.random() * 1800, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.038);
      gain.gain.setValueAtTime(Math.min(0.05, gainLevel), now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.042);

      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore transient synthesis error
    }
  }

  public playFootstep(
    surface: 'concrete-road' | 'gravel-yard' | 'plaza',
    isRunning: boolean
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pitchJitter = 0.92 + Math.random() * 0.16;

    if (surface === 'gravel-yard') {
      // Crisp gravel crunch impulse
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.065);
      gain.gain.setValueAtTime(isRunning ? 0.06 : 0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    } else {
      // Solid safety boot tap on concrete road
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.055);
      gain.gain.setValueAtTime(isRunning ? 0.055 : 0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playCameraSwitch() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playUiBeep() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playInspectionComplete() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.06, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.24);
    });
  }

  public playHazardWarning() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.08);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  /** 肉眼近观检查：轻柔的双频对焦确认音。 */
  public playVisualInspect() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.03, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.055 + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.09);
    });
  }

  /** 红外测温仪：正常温升为清脆锁定音，发现过热缺陷时发出高频双促告警滴声。 */
  public playThermalScan(isOverheated = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = isOverheated ? [1480, 980, 1560] : [960, 1280];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isOverheated ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(
        isOverheated ? 0.045 : 0.032,
        now + idx * 0.065
      );
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.065 + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.065);
    });
  }

  /** 激光测距仪：高频脉冲发射与回波锁定滴声。 */
  public playLaserMeasure() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(2350, now + 0.075);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * 空鼓锤敲击防火墙：
   * - 密实墙面（isHollow=false）：短促高阻尼实心敲击声；
   * - 空鼓墙面（isHollow=true）：带空腔共鸣尾音的“咚咚”空鼓声。
   */
  public playHollowHammerTap(isHollow: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const taps = [0, 0.14];
    taps.forEach((offset) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      if (isHollow) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(290, t);
        osc.frequency.exponentialRampToValueAtTime(135, t + 0.11);
        gain.gain.setValueAtTime(0.075, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(195, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.04);
        gain.gain.setValueAtTime(0.055, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + (isHollow ? 0.13 : 0.05));
    });
  }

  /** 漏电保护测试仪：模拟试验电流注入与拒动告警蜂鸣。 */
  public playLeakageTest() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const buzz = ctx.createOscillator();
    const gain = ctx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(100, now);
    buzz.frequency.setValueAtTime(820, now + 0.09);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    buzz.connect(gain);
    gain.connect(ctx.destination);
    buzz.start(now);
    buzz.stop(now + 0.23);
  }

  /** 辅助工具音效（强光手电开关、力矩扳手咔哒、塞尺/卡尺量具、万用表蜂鸣）。 */
  public playAuxiliaryTool(tool: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (tool === 'torque') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.setValueAtTime(680, now + 0.045);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    } else if (tool === 'flashlight') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.035);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    } else if (tool === 'multimeter') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1920, now);
      gain.gain.setValueAtTime(0.038, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.055);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** 现场取证相机快门声。 */
  public playCameraShutter() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [1400, 620].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      osc.frequency.exponentialRampToValueAtTime(180, now + idx * 0.035 + 0.03);
      gain.gain.setValueAtTime(0.055, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.04);
    });
  }

  /** 越过带电警戒线：工频电流嗡鸣 + 电弧爆裂，收尾一记低频倒地冲击。 */
  public playElectricShock(durationSeconds = 2.6) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const end = now + durationSeconds;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    bus.gain.setValueAtTime(0.16, end - 0.35);
    bus.gain.exponentialRampToValueAtTime(0.0001, end);
    bus.connect(ctx.destination);

    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(100, now);
    buzz.connect(bus);
    buzz.start(now);
    buzz.stop(end);

    const arc = ctx.createOscillator();
    const arcGain = ctx.createGain();
    arc.type = 'square';
    arcGain.gain.value = 0.1;
    for (let t = 0; t < durationSeconds; t += 0.05) {
      arc.frequency.setValueAtTime(600 + Math.random() * 2600, now + t);
    }
    arc.connect(arcGain);
    arcGain.connect(bus);
    arc.start(now);
    arc.stop(end);

    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(120, end - 0.3);
    thud.frequency.exponentialRampToValueAtTime(38, end);
    thudGain.gain.setValueAtTime(0.0001, end - 0.3);
    thudGain.gain.exponentialRampToValueAtTime(0.2, end - 0.2);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, end + 0.35);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(end - 0.3);
    thud.stop(end + 0.4);
  }

  public get currentBgmKey(): BgmKey | null {
    return this.bgmKey;
  }

  /**
   * Switches the looping BGM for the current scene. Autoplay is retried after
   * the next pointer/key gesture because browsers block it before interaction.
   */
  public setBgm(key: BgmKey | null) {
    this.bgmWanted = key;
    if (typeof window === 'undefined') return;
    if (key === null) {
      this.disposeBgm();
      return;
    }
    if (this.muted) {
      this.disposeBgm();
      return;
    }
    if (this.bgmKey === key && this.bgmAudio) {
      this.bgmAudio.volume = BGM_TRACKS[key].volume;
      if (this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => this.armBgmUnlock());
      }
      return;
    }

    this.disposeBgm();
    const track = BGM_TRACKS[key];
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = track.volume;
    this.bgmAudio = audio;
    this.bgmKey = key;
    audio.play().catch(() => this.armBgmUnlock());
  }

  public stopBgm() {
    this.bgmWanted = null;
    this.disposeBgm();
  }

  private disposeBgm() {
    if (!this.bgmAudio) return;
    const audio = this.bgmAudio;
    this.bgmAudio = null;
    this.bgmKey = null;
    audio.pause();
    audio.loop = false;
    audio.removeAttribute('src');
    try {
      audio.load();
    } catch {
      // Ignore teardown races in older browsers
    }
  }

  private armBgmUnlock() {
    if (this.bgmUnlockArmed || typeof window === 'undefined') return;
    this.bgmUnlockArmed = true;
    const retry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      this.bgmUnlockArmed = false;
      if (
        !this.muted &&
        this.bgmWanted &&
        this.bgmAudio &&
        this.bgmAudio.paused
      ) {
        this.bgmAudio.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.humGain && this.ctx) {
        this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      if (this.coronaGain && this.ctx) {
        this.coronaGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      if (this.anomalyGain && this.ctx) {
        this.anomalyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      this.disposeBgm();
    } else {
      // 静音期间 ensureContext 直接返回，底噪可能从未创建；取消静音时补上。
      this.startAmbientTransformerHum();
      if (this.bgmWanted) {
        this.setBgm(this.bgmWanted);
      }
    }
    return this.muted;
  }
}

export const soundEngine = new SubstationAudioEngine();
