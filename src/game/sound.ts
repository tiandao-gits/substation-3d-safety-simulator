import { BGM_TRACKS, type BgmKey } from '../config/audio';

// Procedural Web Audio API Synthesizer for Substation 3D Simulation
class SubstationAudioEngine {
  private ctx: AudioContext | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmKey: BgmKey | null = null;
  private bgmWanted: BgmKey | null = null;
  private bgmUnlockArmed = false;
  /** 游戏默认静音，由设置面板 / HUD 声音按钮开启。 */
  public muted = true;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    } catch {
      // Ignore autoplay errors until user gesture
    }
  }

  public updateTransformerProximity(minDistanceToTransformer: number, active: boolean) {
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

  public playFootstep(surface: 'concrete-road' | 'gravel-yard' | 'plaza', isRunning: boolean) {
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
      gain.gain.setValueAtTime(isOverheated ? 0.045 : 0.032, now + idx * 0.065);
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
