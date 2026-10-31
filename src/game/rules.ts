import {
  BACKPACK_TOOL_TEXT,
  SAFETY_LABELS,
  ZONE_NAMES,
} from '../config/gameText';
import {
  APARTMENT_DOOR_OBSTACLE,
  APARTMENT_INTERIOR_FLOOR_Y,
  APARTMENT_WALL_OBSTACLES,
  isInsideApartmentRoom,
} from './apartmentDoor';

export type GameState = 'title' | 'playing' | 'paused';
export type CameraPerspective = 'third-person' | 'first-person' | 'drone';
export type MixamoMotionState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Inspect' | 'Salute';
export type RenderDetailMode = 'detailed' | 'blockout';

/** The 3×3 supervisor toolkit carried in the backpack. */
export type ToolType =
  | 'multimeter'
  | 'thermometer'
  | 'leakage'
  | 'flashlight'
  | 'torque'
  | 'hollow-hammer'
  | 'laser'
  | 'feeler'
  | 'caliper';

export interface BackpackToolSpec {
  id: ToolType;
  name: string;
  shortName: string;
  modelCode: string;
  rangeSpec: string;
  purpose: string;
}

export const BACKPACK_TOOLS: BackpackToolSpec[] = BACKPACK_TOOL_TEXT.map(
  (tool) => ({ ...tool })
);

export interface AABB {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  isHazard?: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  droneX: number;
  droneY: number;
  droneZ: number;
  droneYaw: number;
  dronePitch: number;
  dronePhotoCount: number;
  isGrounded: boolean;
  isSprinting: boolean;
  runLock: boolean;
  isInspecting: boolean;
  inspectTimer: number;
  saluteTimer: number;
  jumpTimer: number;
  jumpLaunchTimer: number;
  hp: number;
  maxHp: number;
  score: number;
  motionState: MixamoMotionState;
  perspective: CameraPerspective;
  activeTool: ToolType;
  flashlightOn: boolean;
}

export const WORLD_BOUNDS = {
  minX: -41.5,
  maxX: 41.5,
  minZ: -32.5,
  maxZ: 32.5,
};

// Live GLB bboxes (2026-10-30 13:54 blend). The 3 vehicles sit in their 3.5 m bays.
const PARKING_CAR_OBSTACLES: AABB[] = [
  { id: 'service-car-1', label: '红色两厢车', minX: 25.74, maxX: 27.66, minZ: 14.81, maxZ: 18.85, height: 1.9, isHazard: false },
  { id: 'service-car-2', label: '白色两厢车', minX: 29.34, maxX: 31.26, minZ: 14.81, maxZ: 18.86, height: 1.9, isHazard: false },
  { id: 'service-car-3', label: '自卸工程车', minX: 32.96, maxX: 35.44, minZ: 14.41, maxZ: 21.61, height: 3.08, isHazard: false },
];

// 220kV 开关间隔实测数据（2026-10-30 13:54 blend / GLB Bay_F0x_ASSEMBLY，单格 7.88 × 10.68 m，间距 8.0 m）。
// game z = -Blender y：前侧间隔 y -20.9..-10.22 → z 10.22..20.9，后侧 y 7.1..17.78 → z -17.78..-7.1。
export const SWITCHGEAR_BAYS = [
  { id: 'F01', centerX: -3.1, centerZ: 15.56 },
  { id: 'F02', centerX: 4.9, centerZ: 15.56 },
  { id: 'F03', centerX: 12.9, centerZ: 15.56 },
  { id: 'R01', centerX: -3.1, centerZ: -12.44 },
  { id: 'R02', centerX: 4.9, centerZ: -12.44 },
  { id: 'R03', centerX: 12.9, centerZ: -12.44 },
] as const;

const BAY_HALF_X = 3.94;
const BAY_HALF_Z = 5.34;

/**
 * 间隔内实测阻挡轮廓（`scripts/glb-occupancy-grid.ts`：人体高度带 0.6–2.2 m、0.6 m 网格），
 * 坐标以间隔中心为原点。两组设备之间只剩 1.1 m 缝隙，相邻间隔设备之间约 4 m 宽的巡视巷
 * 才是设备外侧唯一可走通的通道。
 */
const BAY_LOCAL_BLOCKS = [
  { key: 'bank-a', label: '设备组 A', minX: -1.7, maxX: 2.2, minZ: -3.56, maxZ: -0.56, height: 3.4 },
  { key: 'bank-b', label: '设备组 B', minX: -1.7, maxX: 2.2, minZ: 0.56, maxZ: 3.64, height: 3.4 },
  { key: 'leg-w1', label: '构架格构柱', minX: -BAY_HALF_X, maxX: -3.04, minZ: -BAY_HALF_Z, maxZ: -4.74, height: 8.8 },
  { key: 'leg-w2', label: '构架格构柱', minX: -BAY_HALF_X, maxX: -3.04, minZ: 4.74, maxZ: BAY_HALF_Z, height: 8.8 },
  { key: 'leg-e1', label: '构架格构柱', minX: 3.04, maxX: BAY_HALF_X, minZ: -BAY_HALF_Z, maxZ: -4.74, height: 8.8 },
  { key: 'leg-e2', label: '构架格构柱', minX: 3.04, maxX: BAY_HALF_X, minZ: 4.74, maxZ: BAY_HALF_Z, height: 8.8 },
];

const round2 = (value: number) => Math.round(value * 100) / 100;

const SWITCHGEAR_OBSTACLES: AABB[] = SWITCHGEAR_BAYS.flatMap((bay) =>
  BAY_LOCAL_BLOCKS.map((block) => ({
    id: `switchgear-${bay.id.toLowerCase()}-${block.key}`,
    label: `${bay.id} ${block.label}`,
    minX: round2(bay.centerX + block.minX),
    maxX: round2(bay.centerX + block.maxX),
    minZ: round2(bay.centerZ + block.minZ),
    maxZ: round2(bay.centerZ + block.maxZ),
    height: block.height,
    isHazard: true,
  }))
);

// 与 substation_blockout.glb 的米制坐标一致（game z = -Blender y）。
// Firewall bands: Blender y -24.74/-12.87/-1.00/+10.87/+22.74, x -33.79..-18.96,
// open to the east; the five transformer bays share the same wall stack.
const FIREWALL_Z = [24.74, 12.87, 1.0, -10.87, -22.74];
const FIREWALL_HALF = 0.26;

export const SUBSTATION_OBSTACLES: AABB[] = [
  { id: 'transformer-01', label: '#1 主变（最南端·检修）', minX: -31.09, maxX: -25.63, minZ: 15.22, maxZ: 22.39, height: 6.27, isHazard: true },
  { id: 'transformer-02', label: '#2 主变（运行）', minX: -31.09, maxX: -25.63, minZ: 3.35, maxZ: 10.52, height: 6.27, isHazard: true },
  { id: 'transformer-03', label: '#3 备用变（热备用）', minX: -31.09, maxX: -25.63, minZ: -8.52, maxZ: -1.35, height: 6.27, isHazard: true },
  ...FIREWALL_Z.map((z, i) => ({
    id: `firewall-${i + 1}`,
    label: `主变防火墙 ${i + 1}`,
    minX: -33.79,
    maxX: -18.96,
    minZ: z - FIREWALL_HALF,
    maxZ: z + FIREWALL_HALF,
    height: 6.69,
    isHazard: true,
  })),
  { id: 'firewall-west', label: '主变区西侧防火墙', minX: -33.79, maxX: -33.2, minZ: -22.74, maxZ: 24.74, height: 6.69, isHazard: true },
  { id: 'office-main', label: '综合楼', minX: 27.52, maxX: 37.99, minZ: -15.38, maxZ: 12.73, height: 8.33, isHazard: false },
  ...APARTMENT_WALL_OBSTACLES,
  { id: 'guardhouse', label: '门卫室与安全准入站', minX: 25.0, maxX: 30.6, minZ: 26.1, maxZ: 30.0, height: 2.75, isHazard: false },
  ...SWITCHGEAR_OBSTACLES,
  ...PARKING_CAR_OBSTACLES,
];

/** 门关闭时的世界碰撞集合；开门后使用 SUBSTATION_OBSTACLES。 */
export const SUBSTATION_OBSTACLES_DOOR_CLOSED: AABB[] = [
  ...SUBSTATION_OBSTACLES,
  APARTMENT_DOOR_OBSTACLE,
];

/* ------------------------------------------------------------------ */
/* 地面警戒线（红线=带电，黄线=停电检修）                              */
/* ------------------------------------------------------------------ */

/** 警戒线沿设备基础外扩布设，与 GB 26860 的 3 m 带电安全净距配套。 */
const LIVE_LINE_MARGIN_M = 0.9;

/** 间隔内两组设备的外包轮廓（不含构架格构柱），坐标以间隔中心为原点。 */
const BAY_EQUIPMENT_LOCAL = { minX: -1.7, maxX: 2.2, minZ: -3.56, maxZ: 3.64 };

export interface SafetyLineZone {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** 在这些幕内该区域运行带电，越过红线即触电。 */
  liveActs: readonly number[];
  /** 停电检修的幕仍用黄线围出检修区：可以近前，不触电。 */
  outageLine: boolean;
}

function switchgearLineZone(bay: (typeof SWITCHGEAR_BAYS)[number]): SafetyLineZone {
  return {
    id: `line-${bay.id.toLowerCase()}`,
    label: `220kV ${bay.id} 运行间隔`,
    minX: round2(bay.centerX + BAY_EQUIPMENT_LOCAL.minX - LIVE_LINE_MARGIN_M),
    maxX: round2(bay.centerX + BAY_EQUIPMENT_LOCAL.maxX + LIVE_LINE_MARGIN_M),
    minZ: round2(bay.centerZ + BAY_EQUIPMENT_LOCAL.minZ - LIVE_LINE_MARGIN_M),
    maxZ: round2(bay.centerZ + BAY_EQUIPMENT_LOCAL.maxZ + LIVE_LINE_MARGIN_M),
    liveActs: [1, 2, 3],
    outageLine: false,
  };
}

function transformerLineZone(
  obstacleId: string,
  label: string,
  liveActs: readonly number[],
  outageLine: boolean
): SafetyLineZone {
  const box = SUBSTATION_OBSTACLES.find((zone) => zone.id === obstacleId);
  if (!box) throw new Error(`Missing obstacle for safety line: ${obstacleId}`);
  return {
    id: `line-${obstacleId}`,
    label,
    minX: round2(box.minX - LIVE_LINE_MARGIN_M),
    maxX: round2(box.maxX + LIVE_LINE_MARGIN_M),
    minZ: round2(box.minZ - LIVE_LINE_MARGIN_M),
    maxZ: round2(box.maxZ + LIVE_LINE_MARGIN_M),
    liveActs,
    outageLine,
  };
}

export const SAFETY_LINE_ZONES: SafetyLineZone[] = [
  ...SWITCHGEAR_BAYS.map(switchgearLineZone),
  transformerLineZone('transformer-02', '#2 主变（运行）', [1, 2, 3], false),
  transformerLineZone('transformer-03', '#3 备用变（热备用）', [1, 2, 3], false),
  // 1# 主变全天停电检修：内圈始终为黄色检修边界，不参与触电判定。
  transformerLineZone('transformer-01', '#1 主变（停电检修）', [], true),
];

export function liveLineZones(act: number): SafetyLineZone[] {
  return SAFETY_LINE_ZONES.filter((zone) => zone.liveActs.includes(act));
}

/** 玩家已越过的带电警戒线区域；null 表示仍在线外。 */
export function getLiveZoneAt(x: number, z: number, act: number): SafetyLineZone | null {
  for (const zone of liveLineZones(act)) {
    if (zoneContains(zone, x, z)) return zone;
  }
  return null;
}

/** 到最近一条带电警戒线的水平距离（米），0 表示已在线内。 */
export function distanceToLiveLine(x: number, z: number, act: number): number {
  let nearest = Infinity;
  for (const zone of liveLineZones(act)) {
    const dx = Math.max(zone.minX - x, x - zone.maxX, 0);
    const dz = Math.max(zone.minZ - z, z - zone.maxZ, 0);
    nearest = Math.min(nearest, Math.hypot(dx, dz));
  }
  return nearest;
}

/* ------------------------------------------------------------------ */
/* GLB 地面高压危险线（带警告文字的外圈警戒）                          */
/* ------------------------------------------------------------------ */

/**
 * 场景 GLB 里画在地面的高压危险线（含警告文字）：
 * - BAY_DANGER_LINE_220KV：开关设备区外圈；
 * - TR_DANGER_LINE_220KV.001：主变检修区东侧边界线。
 * 越过这些线只触发“高压危险”提示，真正越线触电仍由上面的 liveLineZones 判定。
 * 坐标取自 public/substation_blockout.glb 的实测包围盒。
 */
export type DangerLineColor = 'red' | 'yellow';

export interface DangerLineZone {
  id: string;
  label: string;
  /** 线内危险区域（AABB）。 */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** 各幕地面警告线的颜色；黄色表示检修/停电边界，不触发提示。 */
  colorByAct: Record<number, DangerLineColor>;
}

export const DANGER_LINE_ZONES: DangerLineZone[] = [
  {
    id: 'danger-bay-front',
    label: '220kV 前侧开关设备区',
    minX: -7.72,
    maxX: 17.52,
    // 前侧设备区 z 10.22~20.90，地面红线外扩约 2.52 m：
    // 北边 23.42，南边 10.22 - 2.52 = 7.70。
    minZ: 7.7,
    maxZ: 23.42,
    colorByAct: { 1: 'red', 2: 'red', 3: 'red' },
  },
  {
    id: 'danger-bay-rear',
    label: '220kV 后侧开关设备区',
    minX: -7.72,
    maxX: 17.52,
    // 后侧设备区 z -17.78~-7.10，北侧红线同样外扩约 2.52 m：
    // 北边 -7.10 - 2.52 = -4.58，南边取 GLB 实测 -21.42。
    minZ: -21.42,
    maxZ: -4.58,
    colorByAct: { 1: 'red', 2: 'red', 3: 'red' },
  },
  {
    id: 'danger-transformer',
    label: '1#–3# 主变检修区',
    minX: -42.24,
    maxX: -22.16,
    minZ: -10.58,
    maxZ: 24.45,
    // 第一幕 1# 主变运行，外圈线为红色；第二、三幕 1# 停电检修，转黄色。
    colorByAct: { 1: 'red', 2: 'yellow', 3: 'yellow' },
  },
];

export interface DangerLineState {
  inside: boolean;
  color: DangerLineColor | null;
  label: string | null;
  /** 玩家与最近带电红线之间被防火墙隔断：不应触发越线提示。 */
  blockedByFirewall: boolean;
}

const FIREWALL_OBSTACLES = SUBSTATION_OBSTACLES.filter((zone) =>
  zone.id.startsWith('firewall-')
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nearestLiveLinePoint(
  x: number,
  z: number,
  act: number
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDistance = Infinity;
  for (const zone of liveLineZones(act)) {
    const px = clamp(x, zone.minX, zone.maxX);
    const pz = clamp(z, zone.minZ, zone.maxZ);
    const distance = Math.hypot(px - x, pz - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: px, z: pz };
    }
  }
  return best;
}

/** 2D 线段与 AABB 是否相交（Liang-Barsky 裁剪）。 */
function segmentIntersectsAabb(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  box: Pick<AABB, 'minX' | 'maxX' | 'minZ' | 'maxZ'>,
  margin = 0.06
): boolean {
  const minX = box.minX - margin;
  const maxX = box.maxX + margin;
  const minZ = box.minZ - margin;
  const maxZ = box.maxZ + margin;
  const dx = x2 - x1;
  const dz = z2 - z1;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, x1 - minX) &&
    clip(dx, maxX - x1) &&
    clip(-dz, z1 - minZ) &&
    clip(dz, maxZ - z1)
  );
}

/**
 * 玩家到最近带电红线的直线路径是否被防火墙挡住。
 * 用于主变区这类“红线在墙另一侧、无法直接接近”的位置，避免越线提示误报。
 */
function isLiveLineBlockedByFirewall(
  x: number,
  z: number,
  act: number
): boolean {
  const target = nearestLiveLinePoint(x, z, act);
  if (!target) return false;
  return FIREWALL_OBSTACLES.some((box) =>
    segmentIntersectsAabb(x, z, target.x, target.z, box)
  );
}

/**
 * 玩家是否已经越过带文字的地面警告线。
 * 只判定线内侧：必须真正进入红线围出的区域才返回 inside=true；
 * 线外（包括贴着线外侧）一律不提示。
 * 黄色线返回 inside=true 但 color=yellow，由调用方决定不提示。
 * 若最近带电红线被防火墙隔断，blockedByFirewall=true，调用方同样不提示。
 */
export function getDangerLineState(
  x: number,
  z: number,
  act: number
): DangerLineState {
  for (const zone of DANGER_LINE_ZONES) {
    if (zoneContains(zone, x, z)) {
      return {
        inside: true,
        color: zone.colorByAct[act] ?? 'red',
        label: zone.label,
        blockedByFirewall: isLiveLineBlockedByFirewall(x, z, act),
      };
    }
  }
  return {
    inside: false,
    color: null,
    label: null,
    blockedByFirewall: false,
  };
}

/**
 * 无人机禁飞区：带电间隔整跨与运行主变。
 * 设计规则：飞越运行间隔正上方或站外导线 → 扣分并消耗 1 次检查机会。
 */
const DRONE_BAY_ZONES: AABB[] = SWITCHGEAR_BAYS.map((bay) => ({
  id: `drone-bay-${bay.id}`,
  label: `220kV ${bay.id} 运行间隔`,
  minX: bay.centerX - BAY_HALF_X,
  maxX: bay.centerX + BAY_HALF_X,
  minZ: bay.centerZ - BAY_HALF_Z,
  maxZ: bay.centerZ + BAY_HALF_Z,
  height: 8.8,
  isHazard: true,
}));

const DRONE_TRANSFORMER_ZONES: AABB[] = SUBSTATION_OBSTACLES.filter((zone) =>
  zone.id.startsWith('transformer-')
);

function zoneContains(
  zone: Pick<AABB, 'minX' | 'maxX' | 'minZ' | 'maxZ'>,
  x: number,
  z: number
): boolean {
  return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
}

/**
 * Returns the restricted zone the drone is hovering over, or null.
 * The maintenance transformer (#1) only counts while no outage is scheduled.
 */
export function getDroneViolation(
  x: number,
  z: number,
  act: 1 | 2 | 3 = 3
): string | null {
  for (const zone of DRONE_BAY_ZONES) {
    if (zoneContains(zone, x, z)) return zone.label;
  }
  for (const zone of DRONE_TRANSFORMER_ZONES) {
    // 1# 主变全天停电检修，不属于无人机禁飞区。
    if (zone.id === 'transformer-01') continue;
    if (zoneContains(zone, x, z)) return zone.label;
  }
  return null;
}

export function createInitialPlayerState(): PlayerState {
  return {
    // 出生点：站区东侧广场 (25, 0)，人物与镜头朝向西方（-X）。
    x: 25.0,
    y: SITE_PAD_Y,
    z: 0.0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.PI / 2,
    pitch: 0.02,
    droneX: -6.5,
    droneY: 14.8,
    droneZ: -5.0,
    droneYaw: 0.72,
    dronePitch: -0.55,
    dronePhotoCount: 0,
    isGrounded: true,
    isSprinting: false,
    runLock: false,
    isInspecting: false,
    inspectTimer: 0,
    saluteTimer: 0,
    jumpTimer: 0,
    jumpLaunchTimer: 0,
    hp: 100,
    maxHp: 100,
    score: 88,
    motionState: 'Idle',
    perspective: 'third-person',
    activeTool: 'thermometer',
    flashlightOn: false,
  };
}

/**
 * Resolves circle-vs-AABB and perimeter wall collisions for the player on the XZ plane.
 */
export function resolvePlayerCollision(
  x: number,
  z: number,
  radius = 0.55,
  obstacles: AABB[] = SUBSTATION_OBSTACLES
): { x: number; z: number; hitObstacle: AABB | null; hitBoundary: boolean } {
  let nextX = x;
  let nextZ = z;
  let hitObstacle: AABB | null = null;
  let hitBoundary = false;

  if (nextX - radius < WORLD_BOUNDS.minX) {
    nextX = WORLD_BOUNDS.minX + radius;
    hitBoundary = true;
  } else if (nextX + radius > WORLD_BOUNDS.maxX) {
    nextX = WORLD_BOUNDS.maxX - radius;
    hitBoundary = true;
  }

  if (nextZ - radius < WORLD_BOUNDS.minZ) {
    nextZ = WORLD_BOUNDS.minZ + radius;
    hitBoundary = true;
  } else if (nextZ + radius > WORLD_BOUNDS.maxZ) {
    nextZ = WORLD_BOUNDS.maxZ - radius;
    hitBoundary = true;
  }

  for (const box of obstacles) {
    const closestX = Math.max(box.minX, Math.min(nextX, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(nextZ, box.maxZ));

    const dx = nextX - closestX;
    const dz = nextZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      hitObstacle = box;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = radius - dist;
        nextX += (dx / dist) * overlap;
        nextZ += (dz / dist) * overlap;
      } else {
        const distLeft = Math.abs(nextX - box.minX);
        const distRight = Math.abs(box.maxX - nextX);
        const distTop = Math.abs(nextZ - box.minZ);
        const distBottom = Math.abs(box.maxZ - nextZ);
        const minEdge = Math.min(distLeft, distRight, distTop, distBottom);
        if (minEdge === distLeft) nextX = box.minX - radius;
        else if (minEdge === distRight) nextX = box.maxX + radius;
        else if (minEdge === distTop) nextZ = box.minZ - radius;
        else nextZ = box.maxZ + radius;
      }
    }
  }

  return { x: nextX, z: nextZ, hitObstacle, hitBoundary };
}

/**
 * Nearest collision-free standing spot around a target, searched outward in rings.
 * Returns the distance so callers can assert an inspection point stays reachable.
 */
export function findStandableSpotNear(
  x: number,
  z: number,
  maxRadius = 6.5
): { x: number; z: number; distance: number } | null {
  for (let ring = 0.6; ring <= maxRadius; ring += 0.2) {
    for (let deg = 0; deg < 360; deg += 10) {
      const rad = (deg * Math.PI) / 180;
      const spot = resolvePlayerCollision(
        x + Math.cos(rad) * ring,
        z + Math.sin(rad) * ring,
        0.55
      );
      if (spot.hitObstacle) continue;
      const distance = Math.hypot(spot.x - x, spot.z - z);
      if (distance > ring + 0.001) continue;
      return { x: spot.x, z: spot.z, distance };
    }
  }
  return null;
}

/**
 * Computes distance to the nearest live 220kV core and evaluates whether safety distance (>= 3.0m) is met.
 */
export function computeSafetyClearance(x: number, z: number): {
  clearanceMeters: number;
  isSafeDistance: boolean;
  statusLabel: string;
  distanceLabel: string;
} {
  const liveCores = [
    { x: -28.36, z: 18.8 },
    { x: -28.36, z: 6.94 },
    { x: -28.36, z: -4.94 },
  ];
  let minCoreDist = Infinity;
  for (const c of liveCores) {
    const d = Math.hypot(x - c.x, z - c.z) - 3.4;
    if (d < minCoreDist) minCoreDist = d;
  }
  const clearanceMeters = Math.max(1.2, Number(minCoreDist.toFixed(1)));
  const isSafeDistance = clearanceMeters >= 3.0;
  return {
    clearanceMeters,
    isSafeDistance,
    statusLabel: isSafeDistance ? SAFETY_LABELS.normal : SAFETY_LABELS.warning,
    distanceLabel: isSafeDistance
      ? SAFETY_LABELS.qualified
      : SAFETY_LABELS.tooClose,
  };
}

/**
 * Determines which functional substation zone a coordinate belongs to.
 */
export function getSubstationZoneAt(x: number, z: number): {
  name: string;
  surface: 'concrete-road' | 'gravel-yard' | 'plaza';
  safetyLevel: 'safe' | 'caution' | 'high-voltage';
} {
  const atMainEntrance = x >= 22 && x <= 30 && z >= 29;
  const inApartment = x >= 29.49 && x <= 37.86 && z >= -24.94 && z <= -18.56;
  const inParking = x >= 23.5 && x <= 41 && z >= 9.5 && z <= 30;
  const withinOuterRoad = x >= -39 && x <= 23 && z >= -30 && z <= 30;
  const withinRoadIsland = x > -33 && x < 17 && z > -24 && z < 24;
  const onRingRoad = withinOuterRoad && !withinRoadIsland;
  const inTransformerYard = x >= -34 && x <= -17.5 && z >= -24.5 && z <= 24.5;
  const inFrontSwitchyard = x >= -8.5 && x <= 17.5 && z >= 9.5 && z <= 21.5;
  const inRearSwitchyard = x >= -8.5 && x <= 17.5 && z >= -18.5 && z <= -6.5;

  if (atMainEntrance) {
    return {
      name: ZONE_NAMES.mainEntrance,
      surface: 'concrete-road',
      safetyLevel: 'safe',
    };
  }
  if (inApartment) {
    return {
      name: ZONE_NAMES.apartment10kv,
      surface: 'plaza',
      safetyLevel: isInsideApartmentRoom(x, z) ? 'high-voltage' : 'caution',
    };
  }
  if (inParking) {
    return {
      name: ZONE_NAMES.parking,
      surface: 'plaza',
      safetyLevel: 'safe',
    };
  }
  if (onRingRoad) {
    return {
      name: ZONE_NAMES.ringRoad,
      surface: 'concrete-road',
      safetyLevel: 'safe',
    };
  }
  if (inTransformerYard) {
    return {
      name: ZONE_NAMES.transformerYard,
      surface: 'gravel-yard',
      safetyLevel: 'high-voltage',
    };
  }
  if (inFrontSwitchyard) {
    return {
      name: ZONE_NAMES.frontSwitchyard,
      surface: 'gravel-yard',
      safetyLevel: 'high-voltage',
    };
  }
  if (inRearSwitchyard) {
    return {
      name: ZONE_NAMES.rearSwitchyard,
      surface: 'gravel-yard',
      safetyLevel: 'high-voltage',
    };
  }
  if (x > 21) {
    return {
      name: ZONE_NAMES.eastPlaza,
      surface: 'plaza',
      safetyLevel: 'safe',
    };
  }
  return {
    name: ZONE_NAMES.concretePath,
    surface: 'concrete-road',
    safetyLevel: 'caution',
  };
}

export const PLAYER_GRAVITY = 14.5;
export const PLAYER_JUMP_VELOCITY = 5.2;

/** 站区混凝土板顶标高（Blender 0.25 m），比站内沥青路面高出台阶。 */
export const SITE_PAD_Y = 0.25;
/** 站内环形路与联络路的沥青面标高（Blender 0.038 m）。 */
export const SITE_ROAD_Y = 0.038;

// 路面范围按 Blender 模型的洞口实测：game z = -blender y。
const RING_OUTER = [-41, 24.3, -30, 32] as const;
const RING_INNER = [-35, 18.3, -24, 26] as const;
const ROAD_STRIPS = [
  [-14.5, -8.5, -24, 26], // 西侧联络路
  [-8.5, 18.3, -2, 4], // 中部联络路
  [18.3, 24.3, 32, 33], // 大门通道
] as const;

function inBox(
  x: number,
  z: number,
  box: readonly [number, number, number, number]
): boolean {
  return x >= box[0] && x <= box[1] && z >= box[2] && z <= box[3];
}

/** 站内行走标高：沥青路面下凹一个台阶，其余区域为混凝土板顶。 */
export function siteGroundHeight(x: number, z: number): number {
  if (isInsideApartmentRoom(x, z)) return APARTMENT_INTERIOR_FLOOR_Y;
  const onRing = inBox(x, z, RING_OUTER) && !inBox(x, z, RING_INNER);
  const onStrip = ROAD_STRIPS.some((box) => inBox(x, z, box));
  return onRing || onStrip ? SITE_ROAD_Y : SITE_PAD_Y;
}

/** Time from leaving the ground to landing for the vertical jump arc. */
export const PLAYER_JUMP_AIR_TIME =
  (2 * PLAYER_JUMP_VELOCITY) / PLAYER_GRAVITY;
const JUMP_MOVE_SPEED_EPSILON = 0.15;

/**
 * A jump may only start from a stable standing position. This keeps the
 * in-place Jump.fbx animation aligned with the character collider and avoids
 * launching while directional input (or residual walking momentum) is active.
 */
export function canStartJump(params: {
  isGrounded: boolean;
  isJumping: boolean;
  horizontalSpeed: number;
  isMoving: boolean;
}): boolean {
  if (!params.isGrounded || params.isJumping) return false;
  if (params.isMoving) return false;
  if (params.horizontalSpeed > JUMP_MOVE_SPEED_EPSILON) return false;
  return true;
}

/**
 * Selects the active Mixamo skeletal animation state based on player kinematics and actions.
 */
export function selectMixamoAnimationState(params: {
  horizontalSpeed: number;
  isGrounded: boolean;
  isSprinting: boolean;
  inspectTimer: number;
  saluteTimer: number;
}): MixamoMotionState {
  if (!params.isGrounded) {
    return 'Jump';
  }
  if (params.inspectTimer > 0) {
    return 'Inspect';
  }
  if (params.saluteTimer > 0) {
    return 'Salute';
  }
  if (params.horizontalSpeed > 4.2 || (params.horizontalSpeed > 0.3 && params.isSprinting)) {
    return 'Run';
  }
  if (params.horizontalSpeed > 0.15) {
    return 'Walk';
  }
  return 'Idle';
}

/**
 * Computes camera position and look-at target for First-Person, Over-the-Shoulder Third-Person, and Aerial Drone perspectives.
 */
export function computeCameraRigTransform(
  player: Pick<PlayerState, 'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'perspective'> &
    Partial<Pick<PlayerState, 'droneX' | 'droneY' | 'droneZ' | 'droneYaw' | 'dronePitch'>>,
  thirdPersonDistance = 3.2
): {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
} {
  if (player.perspective === 'drone') {
    const dX = player.droneX ?? 1.8;
    const dY = player.droneY ?? 14.2;
    const dZ = player.droneZ ?? -1.5;
    const dYaw = player.droneYaw ?? -0.82;
    const dPitch = Math.max(-1.15, Math.min(0.25, player.dronePitch ?? -0.44));

    const sinDYaw = Math.sin(dYaw);
    const cosDYaw = Math.cos(dYaw);
    const forwardX = -sinDYaw * Math.cos(dPitch);
    const forwardY = Math.sin(dPitch);
    const forwardZ = -cosDYaw * Math.cos(dPitch);

    return {
      camX: dX,
      camY: dY,
      camZ: dZ,
      lookX: dX + forwardX * 22,
      lookY: dY + forwardY * 22,
      lookZ: dZ + forwardZ * 22,
    };
  }

  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);
  const clampedPitch = Math.max(-0.65, Math.min(0.65, player.pitch));

  const forwardX = -sinYaw * Math.cos(clampedPitch);
  const forwardY = Math.sin(clampedPitch);
  const forwardZ = -cosYaw * Math.cos(clampedPitch);

  const rightX = cosYaw;
  const rightZ = -sinYaw;

  if (player.perspective === 'first-person') {
    const eyeY = player.y + 1.68;
    const camX = player.x + forwardX * 0.12;
    const camY = eyeY;
    const camZ = player.z + forwardZ * 0.12;
    return {
      camX,
      camY,
      camZ,
      lookX: camX + forwardX * 12,
      lookY: camY + forwardY * 12,
      lookZ: camZ + forwardZ * 12,
    };
  }

  const pivotY = player.y + 1.52;
  const dist = Math.max(1.8, Math.min(8.0, thirdPersonDistance));
  const shoulderOffset = 0.68;
  const camX = player.x - forwardX * dist + rightX * shoulderOffset;
  const camY = Math.max(0.6, pivotY - forwardY * dist + 0.35);
  const camZ = player.z - forwardZ * dist + rightZ * shoulderOffset;

  return {
    camX,
    camY,
    camZ,
    lookX: player.x + forwardX * 14 + rightX * 0.9,
    lookY: pivotY + forwardY * 6 + 0.25,
    lookZ: player.z + forwardZ * 14 + rightZ * 0.9,
  };
}

/**
 * Applies mouse movement delta (dx, dy in pixels) to camera yaw and pitch angles.
 */
export function applyMouseLookDelta(
  currentYaw: number,
  currentPitch: number,
  dx: number,
  dy: number,
  sensitivity = 0.0042
): { yaw: number; pitch: number } {
  const nextYaw = currentYaw - dx * sensitivity;
  const nextPitch = Math.max(
    -0.72,
    Math.min(0.72, currentPitch - dy * (sensitivity * 0.85))
  );
  return { yaw: nextYaw, pitch: nextPitch };
}
