export const RADAR_RANGE_METERS = 50;

export interface RadarProjection {
  /** 相对雷达中心的画布偏移（右为 +x）。 */
  dx: number;
  /** 相对雷达中心的画布偏移（下为 +z，北向上时为负）。 */
  dy: number;
  distanceMeters: number;
}

/**
 * 北向固定的任务雷达投影：世界 +x → 画布右，世界 +z → 画布下。
 * 雷达中心始终是玩家，因此标记位置就是任务点相对玩家的真实方位。
 */
export function projectRadarTarget(
  playerX: number,
  playerZ: number,
  targetX: number,
  targetZ: number,
  plotRadius: number,
  rangeMeters = RADAR_RANGE_METERS
): RadarProjection {
  const worldDx = targetX - playerX;
  const worldDz = targetZ - playerZ;
  return {
    dx: (worldDx / rangeMeters) * plotRadius,
    dy: (worldDz / rangeMeters) * plotRadius,
    distanceMeters: Math.hypot(worldDx, worldDz),
  };
}
