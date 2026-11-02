import type { ActNo } from './act1';
import { getLiveZoneAt } from './rules';

export type LaserTargetCategory =
  | 'live-220kv'
  | 'live-10kv'
  | 'transformer-1'
  | 'transformer-2'
  | 'aisle-obstacle'
  | 'construction-pit'
  | 'general-structure';

export interface LaserMeasurementResult {
  origin: { x: number; y: number; z: number };
  hitPoint: { x: number; y: number; z: number };
  /** 真实三维空间欧氏距离（米） */
  distanceM: number;
  /** 水平投影距离（米） */
  horizontalM: number;
  /** 高差（米） */
  deltaYM: number;
  /** 俯仰角（度） */
  pitchDeg: number;
  targetCategory: LaserTargetCategory;
  targetLabel: string;
  standardCode: string;
  minSafeMeters: number | null;
  isSafe: boolean;
  safetySummary: string;
}

/**
 * 计算激光发射点到三维射线命中点的精确空间距离、水平距离与仰角。
 */
export function computeLaserGeometry(
  origin: { x: number; y: number; z: number },
  hitPoint: { x: number; y: number; z: number }
): {
  distanceM: number;
  horizontalM: number;
  deltaYM: number;
  pitchDeg: number;
} {
  const dx = hitPoint.x - origin.x;
  const dy = hitPoint.y - origin.y;
  const dz = hitPoint.z - origin.z;
  const horizontalM = Math.hypot(dx, dz);
  const distanceM = Math.hypot(dx, dy, dz);
  const pitchRad = Math.atan2(dy, Math.max(0.0001, horizontalM));
  const pitchDeg = (pitchRad * 180) / Math.PI;
  return {
    distanceM: Math.round(distanceM * 100) / 100,
    horizontalM: Math.round(horizontalM * 100) / 100,
    deltaYM: Math.round(dy * 100) / 100,
    pitchDeg: Math.round(pitchDeg * 10) / 10,
  };
}

/**
 * 根据 Raycaster 命中的 3D 节点名称链与世界坐标识别被测电力设备类别及安全距离判据。
 */
export function classifyLaserHitTarget(
  nodeNames: readonly string[],
  hitPoint: { x: number; y: number; z: number },
  act: ActNo = 1
): {
  category: LaserTargetCategory;
  targetLabel: string;
  standardCode: string;
  minSafeMeters: number | null;
} {
  const joined = nodeNames.join(' ').toUpperCase();

  // 1. 优先识别巡视通道木料堆或围栏
  if (
    joined.includes('CLUE-WOOD-PILE') ||
    joined.includes('PLANKS') ||
    (Math.hypot(hitPoint.x - 16.5, hitPoint.z - 12.8) <= 3.0 && hitPoint.y < 2.2)
  ) {
    return {
      category: 'aisle-obstacle',
      targetLabel: '巡视通道堆放木料 / 净宽受限点',
      standardCode: 'GB 50059 站内巡视通道净宽 ≥ 1.20 m',
      minSafeMeters: 1.2,
    };
  }

  // 2. 10kV 高压配电室开关柜区域
  if (
    joined.includes('10KV') ||
    joined.includes('CABINET') ||
    (hitPoint.x >= 30.5 && hitPoint.x <= 41.5 && hitPoint.z >= -26.5 && hitPoint.z <= -16.5)
  ) {
    return {
      category: 'live-10kv',
      targetLabel: '10kV 高压开关柜间隔',
      standardCode: 'GB 26860 10kV 设备不停电安全距离 ≥ 0.70 m',
      minSafeMeters: 0.7,
    };
  }

  // 3. 1# 主变区域（x: -32..-23, z: 14..23.5）
  if (
    hitPoint.x >= -32.5 &&
    hitPoint.x <= -23.0 &&
    hitPoint.z >= 14.0 &&
    hitPoint.z <= 23.5
  ) {
    const isOutage = act === 2 || act === 3;
    return {
      category: 'transformer-1',
      targetLabel: isOutage
        ? '1# 主变本体（停电检修区）'
        : '220kV 1# 主变带电间隔',
      standardCode: isOutage
        ? '停电检修状态 · 临近带电间隔保持 ≥ 3.00 m'
        : 'GB 26860 220kV 设备不停电安全距离 ≥ 3.00 m',
      minSafeMeters: isOutage ? null : 3.0,
    };
  }

  // 4. 2# / 3# 运行主变区域
  if (
    hitPoint.x >= -32.5 &&
    hitPoint.x <= -23.0 &&
    hitPoint.z >= -9.0 &&
    hitPoint.z < 14.0
  ) {
    return {
      category: 'transformer-2',
      targetLabel: '220kV 运行主变带电间隔',
      standardCode: 'GB 26860 220kV 设备不停电安全距离 ≥ 3.00 m',
      minSafeMeters: 3.0,
    };
  }

  // 5. 北侧施工区基坑与临时配电箱（x: -36..-16, z: -28..-8）
  if (
    hitPoint.x >= -36.0 &&
    hitPoint.x <= -16.0 &&
    hitPoint.z >= -28.0 &&
    hitPoint.z <= -8.0
  ) {
    return {
      category: 'construction-pit',
      targetLabel: '北侧扩建区基坑临边 / 施工临时配电点',
      standardCode: 'DL 5009.3 基坑临边及吊装警戒距离 ≥ 1.50 m',
      minSafeMeters: 1.5,
    };
  }

  // 6. 检查是否命中 220kV 带电间隔或绝缘子/母线架构
  const liveZone = getLiveZoneAt(hitPoint.x, hitPoint.z, act);
  if (
    liveZone ||
    joined.includes('INSULATOR') ||
    joined.includes('PORCELAIN') ||
    joined.includes('ARRESTER') ||
    joined.includes('BUSBAR') ||
    joined.includes('DISCONNECTOR') ||
    joined.includes('BREAKER') ||
    (hitPoint.x >= -12.0 && hitPoint.x <= 24.0 && hitPoint.z >= -10.0 && hitPoint.z <= 28.0 && hitPoint.y > 0.35)
  ) {
    return {
      category: 'live-220kv',
      targetLabel: liveZone ? `220kV ${liveZone.label}带电体` : '220kV 配电装置带电构架/套管',
      standardCode: 'GB 26860 220kV 设备不停电安全距离 ≥ 3.00 m',
      minSafeMeters: 3.0,
    };
  }

  return {
    category: 'general-structure',
    targetLabel: '站区建构筑物 / 地面基准点',
    standardCode: '常规空间激光测距参考',
    minSafeMeters: null,
  };
}

/**
 * 综合发射点、Raycast 命中点、命中节点链与幕次，生成完整激光测距结果。
 */
export function evaluateLaserMeasurement(
  origin: { x: number; y: number; z: number },
  hitPoint: { x: number; y: number; z: number },
  nodeNames: readonly string[],
  act: ActNo = 1
): LaserMeasurementResult {
  const geom = computeLaserGeometry(origin, hitPoint);
  const target = classifyLaserHitTarget(nodeNames, hitPoint, act);

  const isSafe =
    target.minSafeMeters === null ? true : geom.distanceM >= target.minSafeMeters;

  const safetySummary =
    target.minSafeMeters === null
      ? `实测空间距离 ${geom.distanceM.toFixed(2)} m（水平 ${geom.horizontalM.toFixed(2)} m）`
      : isSafe
        ? `实测 ${geom.distanceM.toFixed(2)} m ≥ 安全限值 ${target.minSafeMeters.toFixed(2)} m（符合安规）`
        : `实测 ${geom.distanceM.toFixed(2)} m < 安全限值 ${target.minSafeMeters.toFixed(2)} m（安全距离不足！）`;

  return {
    origin,
    hitPoint,
    distanceM: geom.distanceM,
    horizontalM: geom.horizontalM,
    deltaYM: geom.deltaYM,
    pitchDeg: geom.pitchDeg,
    targetCategory: target.category,
    targetLabel: target.targetLabel,
    standardCode: target.standardCode,
    minSafeMeters: target.minSafeMeters,
    isSafe,
    safetySummary,
  };
}
