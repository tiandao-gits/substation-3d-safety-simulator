import {
  ACT_AMBIENT,
  type Act1PointId,
  type Act1Variant,
  type ActNo,
} from './act1';

export interface ThermalPhaseTarget {
  phase: 'A' | 'B' | 'C' | 'OIL';
  label: string;
  /** 取景框归一化坐标 (0~1) */
  normX: number;
  normY: number;
  /** 该相真实峰值温度 (℃) */
  tempC: number;
  /** 是否存在过热异常（用于渲染热斑扩散半径） */
  isHotspot: boolean;
}

export interface ThermalViewfinderSample {
  /** 准星当前位置实时测得温度 (℃) */
  crosshairTempC: number;
  /** 准星当前对准的相别（若未对准任何相则为 null） */
  lockedPhase: ThermalPhaseTarget | null;
  /** 画面最高温点温度 (℃) */
  maxTempC: number;
  /** 画面环境基准温度 (℃) */
  ambientC: number;
  /** 三相（或本体）目标列表 */
  targets: ThermalPhaseTarget[];
}

/**
 * 获取指定巡检点在红外热像仪取景框中的各相热源分布。
 */
export function getPhaseThermalTargets(
  pointId: Act1PointId,
  variant: Act1Variant,
  mode: 'ir-3' | 'ir-1' | 'ir-casual' | 'oil-temp' = 'ir-3'
): ThermalPhaseTarget[] {
  if (pointId === 'a2-oil' || mode === 'oil-temp') {
    const hot = variant === 'C';
    const oilTemp = hot ? 96.2 : 64.2;
    return [
      {
        phase: 'OIL',
        label: '1# 主变顶层油箱 / 法兰',
        normX: 0.5,
        normY: 0.52,
        tempC: oilTemp,
        isHotspot: hot,
      },
    ];
  }

  const isHv10kV = pointId === 'hv-10kv';
  const baseTemps = isHv10kV ? [38.4, 39.0, 38.7] : [43.2, 43.7, 43.4];

  if (pointId === 'bay-temp' && variant === 'B') {
    baseTemps[1] = 89.4; // B 相引线接头高温热斑（测温中心峰值 89.4~92.4℃）
    if (mode === 'ir-3') baseTemps[1] = 92.4;
  } else if (isHv10kV && variant === 'C') {
    baseTemps[1] = 96.8;
  }

  if (mode === 'ir-casual') {
    const hasDefect =
      (pointId === 'bay-temp' && variant === 'B') ||
      (isHv10kV && variant === 'C');
    for (let i = 0; i < 3; i++) {
      baseTemps[i] =
        Math.round(
          (baseTemps[i] * 0.9 - 1.2 + (hasDefect && i === 1 ? 8 : 0)) * 10
        ) / 10;
    }
  }

  const phases: Array<{
    phase: 'A' | 'B' | 'C';
    label: string;
    normX: number;
    normY: number;
  }> = [
    { phase: 'A', label: 'A 相接头', normX: 0.23, normY: 0.48 },
    { phase: 'B', label: 'B 相接头', normX: 0.5, normY: 0.45 },
    { phase: 'C', label: 'C 相接头', normX: 0.77, normY: 0.48 },
  ];

  return phases.map((p, idx) => ({
    phase: p.phase,
    label: p.label,
    normX: p.normX,
    normY: p.normY,
    tempC: baseTemps[idx],
    isHotspot: baseTemps[idx] >= 80,
  }));
}

/**
 * 根据准星在取景框中的归一化坐标 (aimX, aimY) 计算实时热像温度与锁定相别。
 */
export function sampleThermalCrosshairTemp(
  pointId: Act1PointId,
  variant: Act1Variant,
  act: ActNo,
  aimX: number,
  aimY: number,
  mode: 'ir-3' | 'ir-1' | 'ir-casual' | 'oil-temp' = 'ir-3'
): ThermalViewfinderSample {
  const ambientC = ACT_AMBIENT[act].temperatureC;
  const targets = getPhaseThermalTargets(pointId, variant, mode);
  const clampedX = Math.max(0.05, Math.min(0.95, aimX));
  const clampedY = Math.max(0.05, Math.min(0.95, aimY));

  let tempSum = ambientC;
  let lockedPhase: ThermalPhaseTarget | null = null;
  let minDist = Infinity;

  for (const target of targets) {
    const dx = clampedX - target.normX;
    const dy = clampedY - target.normY;
    const dist = Math.hypot(dx, dy);
    const sigma = target.isHotspot ? 0.135 : 0.105;
    const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));
    const contribution = ambientC + (target.tempC - ambientC) * weight;
    if (contribution > tempSum) {
      tempSum = contribution;
    }
    if (dist < 0.11 && dist < minDist) {
      minDist = dist;
      lockedPhase = target;
    }
  }

  // 若准星已对准某相中心区域，则平滑趋近该相准确标称温度
  if (lockedPhase && minDist < 0.065) {
    tempSum = lockedPhase.tempC;
  }

  const maxTempC = Math.max(ambientC, ...targets.map((t) => t.tempC));

  return {
    crosshairTempC: Math.round(tempSum * 10) / 10,
    lockedPhase,
    maxTempC: Math.round(maxTempC * 10) / 10,
    ambientC,
    targets,
  };
}

/**
 * 将温度映射为工业红外热像仪经典铁红（Ironbow）伪彩 RGB 颜色。
 */
export function temperatureToIronbowRgb(
  tempC: number,
  minTempC = 25,
  maxTempC = 100
): [number, number, number] {
  const t = Math.max(
    0,
    Math.min(1, (tempC - minTempC) / Math.max(1, maxTempC - minTempC))
  );
  // Ironbow 5段关键色标：深靛蓝 -> 紫品红 -> 橙红 -> 亮黄 -> 炽白
  if (t < 0.25) {
    const k = t / 0.25;
    return [
      Math.round(18 + k * 92),
      Math.round(12 + k * 8),
      Math.round(78 + k * 70),
    ];
  }
  if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    return [
      Math.round(110 + k * 95),
      Math.round(20 + k * 36),
      Math.round(148 - k * 96),
    ];
  }
  if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    return [
      Math.round(205 + k * 45),
      Math.round(56 + k * 124),
      Math.round(52 - k * 42),
    ];
  }
  const k = (t - 0.75) / 0.25;
  return [
    Math.round(250 + k * 5),
    Math.round(180 + k * 72),
    Math.round(10 + k * 210),
  ];
}

export interface MeterSweepConfig {
  actionId: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  targetValue: number;
  unit: string;
  decimals: number;
  maxScale: number;
  secondaryMetrics: Array<{ label: string; value: string; unit: string }>;
}

export interface MeterSweepFrame {
  progress01: number;
  settled: boolean;
  displayValue: string;
  needleAngleDeg: number;
  beepTickIndex: number;
}

/**
 * 为接地导通/力矩、末级漏保测试、配电箱零地电位测试提供表盘配置。
 */
export function getMeterSweepConfig(
  pointId: Act1PointId,
  actionId: string,
  variant: Act1Variant
): MeterSweepConfig | null {
  if (actionId === 'leakage-test') {
    return {
      actionId,
      title: 'RCD 漏电保护动作特性测试仪',
      subtitle: '注入递增剩余电流 · 监测脱扣分断时间',
      primaryLabel: '实测漏保动作电流 IΔn',
      targetValue: 42,
      unit: 'mA',
      decimals: 1,
      maxScale: 60,
      secondaryMetrics: [
        { label: '额定动作值', value: '30', unit: 'mA' },
        { label: '实测分断时间', value: '0.18', unit: 's' },
        { label: 'PE 接地导通', value: '接触不良', unit: '' },
      ],
    };
  }
  if (actionId === 'box-voltage') {
    return {
      actionId,
      title: '数字万用表 · 零地电位与进线电压点测',
      subtitle: 'AC 真有效值档 · 测量 N-PE 零地电位差',
      primaryLabel: '实测 N-PE 零地电位差',
      targetValue: 18.4,
      unit: 'V',
      decimals: 1,
      maxScale: 30,
      secondaryMetrics: [
        { label: 'L-N 进线电压', value: '228', unit: 'V' },
        { label: 'PE 线导通电阻', value: '6.8', unit: 'Ω' },
      ],
    };
  }
  if (actionId === 'ground-torque') {
    return {
      actionId,
      title: '接地导通与定矩复合测试表',
      subtitle: '1# 主变本体接地扁铁引下线 · 导通电阻及紧固力矩核验',
      primaryLabel: '接地螺栓紧固力矩',
      targetValue: 42,
      unit: 'N·m',
      decimals: 1,
      maxScale: 60,
      secondaryMetrics: [
        { label: '接地导通电阻', value: '38', unit: 'mΩ' },
        { label: '规程下限要求', value: '≥ 40', unit: 'N·m' },
      ],
    };
  }
  if (actionId === 'wall-hollow') {
    const hollow = variant === 'B' && pointId === 'a2-wall';
    return {
      actionId,
      title: '声学空鼓回波频谱表',
      subtitle: '同点连续三次原位敲击 · 采集声波阻尼衰减',
      primaryLabel: '回波主频读数',
      targetValue: hollow ? 290 : 195,
      unit: 'Hz',
      decimals: 0,
      maxScale: 400,
      secondaryMetrics: [
        { label: '回波阻尼衰减', value: hollow ? '120' : '40', unit: 'ms' },
      ],
    };
  }
  return null;
}

/**
 * 计算 0.8 秒表盘跳动与指针偏转动画帧。
 */
export function computeMeterSweepFrame(
  config: MeterSweepConfig,
  elapsedMs: number,
  durationMs = 800
): MeterSweepFrame {
  const progress01 = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
  const settled = progress01 >= 1;

  let currentVal: number;
  if (settled) {
    currentVal = config.targetValue;
  } else {
    // 阻尼弹簧过冲曲线：前 0.65s 快速爬升并微幅摆动，0.65~1.0s 收敛至真实读数
    const easeOut = 1 - Math.pow(1 - progress01, 3);
    const dampedOsc =
      Math.sin(progress01 * Math.PI * 4.5) *
      Math.pow(1 - progress01, 1.8) *
      0.16;
    currentVal = Math.max(0, config.targetValue * (easeOut + dampedOsc));
  }

  const ratio = Math.max(0, Math.min(1.08, currentVal / config.maxScale));
  const needleAngleDeg = -58 + ratio * 116;
  const beepTickIndex = Math.min(4, Math.floor(progress01 * 4));

  return {
    progress01,
    settled,
    displayValue: currentVal.toFixed(config.decimals),
    needleAngleDeg: Math.round(needleAngleDeg * 10) / 10,
    beepTickIndex,
  };
}

/**
 * 计算按阴影纹素网格对齐的紧致平行光阴影相机目标位置，
 * 将阴影范围缩小至玩家/焦点周围 ±22m（清晰度提升 4 倍）且移动时不产生边缘闪烁。
 */
export function computeSnappedShadowRig(
  focusX: number,
  focusZ: number,
  frustumHalfSize = 22,
  mapSize = 2048,
  sunOffset = { x: -28, y: 42, z: 24 }
): {
  targetX: number;
  targetZ: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  texelSize: number;
} {
  const texelSize = (frustumHalfSize * 2) / Math.max(1, mapSize);
  const targetX = Math.round(focusX / texelSize) * texelSize;
  const targetZ = Math.round(focusZ / texelSize) * texelSize;
  return {
    targetX,
    targetZ,
    lightX: targetX + sunOffset.x,
    lightY: sunOffset.y,
    lightZ: targetZ + sunOffset.z,
    texelSize,
  };
}

export interface CrewIdlePose {
  breathScaleY: number;
  breathScaleXZ: number;
  swayRollZ: number;
  pitchX: number;
  yawOffset: number;
}

/**
 * 为 DynamicCrewDetailedGroup 中的工人模型计算轻量级程序化微动画（呼吸起伏、重心微摆、转头巡视、作业动作）。
 */
export function computeCrewIdlePose(
  elapsedSec: number,
  slotIndex: number,
  act: ActNo
): CrewIdlePose {
  const phase = slotIndex * 1.37;
  // 呼吸起伏：周期约 3 秒，保持体积微守恒
  const breathWave = Math.sin(elapsedSec * 2.15 + phase);
  const breathScaleY = 1 + breathWave * 0.0085;
  const breathScaleXZ = 1 - breathWave * 0.0042;

  // 重心左右微摆
  const swayRollZ = Math.sin(elapsedSec * 0.92 + phase * 1.7) * 0.012;

  if (act === 3 && slotIndex > 0) {
    // 第三幕施工区作业人员：带轻微俯身检查/手持工具节律动作与左右观察
    const workCycle = Math.sin(elapsedSec * 1.85 + phase);
    const pitchX = Math.max(0, workCycle) * 0.045;
    const yawOffset = Math.sin(elapsedSec * 0.78 + phase) * 0.095;
    return {
      breathScaleY,
      breathScaleXZ,
      swayRollZ,
      pitchX,
      yawOffset,
    };
  }

  // 第二幕班前会列队或项目经理：自然平稳呼吸 + 偶发轻微转头看向监理员或主变
  const glanceWave =
    Math.sin(elapsedSec * 0.65 + phase) *
    Math.pow(Math.sin(elapsedSec * 0.32 + phase * 0.5), 2);
  const yawOffset = glanceWave * 0.065;
  const pitchX = Math.sin(elapsedSec * 1.1 + phase) * 0.01;

  return {
    breathScaleY,
    breathScaleXZ,
    swayRollZ,
    pitchX,
    yawOffset,
  };
}
