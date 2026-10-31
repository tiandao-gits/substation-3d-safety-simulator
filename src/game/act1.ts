/**
 * 巡检规则（三幕共用）。
 *
 * 三幕：
 * 1. 正常巡检：巡视通道、BAY 设备温度、10kV 配电室设备；
 * 2. 主变电维修巡检：检修接地线、主变本体油温与渗漏；
 * 3. 施工现场检查：人员防护、基坑临边、临时配电箱。
 *
 * 纯数据与纯函数：不依赖 React / three.js，方便单测与复用。
 * 工具名只用于判定，不渲染到任务卡、HUD 或对话。
 */

export type ActNo = 1 | 2 | 3;

export type Act1Tool =
  | 'multimeter'
  | 'thermometer'
  | 'leakage'
  | 'flashlight'
  | 'torque'
  | 'hollow-hammer'
  | 'laser'
  | 'feeler'
  | 'caliper';

export type Act1Variant = 'A' | 'B' | 'C' | 'D';

export type Act1PointId =
  | 'aisle'
  | 'bay-temp'
  | 'hv-10kv'
  | 'a2-crew'
  | 'a2-wall'
  | 'a2-oil'
  | 'a3-hardhat'
  | 'a3-pit'
  | 'a3-box';

/** 处置梯度按责任主体区分：设备缺陷（运维）/ 施工隐患（施工单位）。 */
export type Act1DispositionProfile = 'equipment' | 'construction';
/**
 * 处置等级即结论：P0 = 正常记录（不整改、不取证），
 * P1 及以上为隐患处置，必须现场取证后才能闭环。
 */
export type Act1Grade = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type Act1Quality = 'ok' | 'coverage' | 'condition' | 'wrong-point' | 'wrong-tool';
export type Act1FindingClass = 'archive' | 'general' | 'urgent';
export type IrDefectSeverity = 'none' | 'general' | 'serious' | 'critical';

/** 读数质量来自产生它的动作；只有 ok 读数能参与判级。 */
export type Act1ReadingQuality = 'ok' | 'coverage' | 'condition';

export interface Act1Reading {
  label: string;
  note?: string;
  unit: string;
  values: number[];
  quality: Act1ReadingQuality;
}

export interface Act1ActionResult {
  kind: 'reading' | 'clue' | 'invalid';
  text: string;
  reading?: Act1Reading;
  errorType?: Act1Quality;
  penalty: number;
  chanceCost: number;
}

export interface Act1ActionSpec {
  id: string;
  label: string;
  tool: Act1Tool | 'visual';
  quality: Act1Quality;
}

export interface Act1Finding {
  title: string;
  klass: Act1FindingClass;
}

export interface Act1PointDef {
  id: Act1PointId;
  act: ActNo;
  name: string;
  shortName: string;
  zone: string;
  /** 玩家站位（game x/z）。 */
  x: number;
  z: number;
  /** 交互视线高度。 */
  focusY: number;
  radius: number;
  /** 处置梯度：按责任主体选择设备缺陷 / 施工安全监理。 */
  profile: Act1DispositionProfile;
  /** 现场线索，不含工具名。 */
  clue: string;
  /** 完成观察与全部检测所需的动作 id。 */
  requiredActions: string[];
  actions: Partial<Record<Act1Tool | 'visual', Act1ActionSpec[]>>;
  standardGrade: Record<Act1Variant, Act1Grade>;
  finding: Record<Act1Variant, Act1Finding | null>;
  /** 取证时必须使用的视角（第三幕施工区人员点位要求无人机取景）。 */
  evidencePerspective?: 'drone';
  /**
   * 重走本幕的出生位；室内点位必须显式给出，否则按点位居中放人会被外墙挡住。
   * doorOpen 表示该出生位要求门处于开启状态。
   */
  approach?: { x: number; z: number; doorOpen?: boolean };
  /** 取证镜头实际对准的目标（人员防护点站在警示牌旁，人物在施工区西侧）。 */
  evidenceTarget?: { x: number; y: number; z: number };
}

export interface Act1PointState {
  id: Act1PointId;
  completedActions: string[];
  readings: Act1Reading[];
  /** 选定的处置等级；P0 即“正常记录”，P1 及以上需取证。 */
  disposition?: Act1Grade;
  evidenceId?: string;
  mistakeCount: number;
}

export interface Act1Deduction {
  id: string;
  label: string;
  points: number;
}

export type ActFailReason = 'chances' | 'shock';

export interface Act1State {
  act: ActNo;
  seed: number;
  variant: Act1Variant;
  points: Record<Act1PointId, Act1PointState>;
  reviewChances: number;
  score: number;
  deductions: Act1Deduction[];
  pendingLines: string[];
  seenLines: string[];
  actFailed: boolean;
  failReason: ActFailReason | null;
  /** 失败原因的具体对象，例如被越过的带电警戒线区域名称。 */
  failDetail: string | null;
}

export const ACT1_SCORE_BASE = 100;
export const ACT1_REVIEW_CHANCES = 4;
/** 处置错误（多处置 / 处理过当 / 处置不到位）按检查点扣分。 */
export const DISPOSITION_ERROR_PENALTY = 8;
/** 巡视道路设计净宽（DL/T 5056、GB 50060 规范区间 0.7~1.0 m，本工程取上限）。 */
export const ACT1_AISLE_DESIGN_WIDTH_M = 1.0;
/** 220kV 设备不停电时的安全距离（GB 26860 表 1）。 */
export const ACT1_LIVE_PART_CLEARANCE_M = 3.0;
/** 各幕现场气象（与任务卡一致）；判据分母必须用当幕环温。 */
export const ACT_AMBIENT: Record<
  ActNo,
  { temperatureC: number; windMps: number; loadA: number | null }
> = {
  1: { temperatureC: 26, windMps: 2, loadA: 312 },
  2: { temperatureC: 27, windMps: 2, loadA: null },
  3: { temperatureC: 29, windMps: 3, loadA: null },
};

const GRADE_RANK: Record<Act1Grade, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

const ACT_NAMES: Record<ActNo, string> = {
  1: '第一幕 · 正常巡检',
  2: '第二幕 · 主变电维修巡检',
  3: '第三幕 · 施工现场检查',
};

export function getActName(act: ActNo): string {
  return ACT_NAMES[act];
}

/**
 * DL/T 664-2016 电流致热型设备（接头、线夹）判据：
 * 危急：热点 >110 ℃，或 δ≥95% 且热点 >80 ℃；
 * 严重：80~110 ℃，或 δ≥80%；一般：δ≥35%。
 */
export function classifyCurrentHeatingDefect(
  hotspotC: number,
  referenceC: number,
  ambientC: number
): IrDefectSeverity {
  const delta = hotspotC - referenceC;
  const relative = hotspotC > ambientC ? delta / (hotspotC - ambientC) : 0;
  if (hotspotC > 110 || (relative >= 0.95 && hotspotC > 80)) return 'critical';
  if (hotspotC >= 80 || relative >= 0.8) return 'serious';
  if (relative >= 0.35) return 'general';
  return 'none';
}

export function severityToEquipmentGrade(severity: IrDefectSeverity): Act1Grade {
  switch (severity) {
    case 'critical':
      return 'P3';
    case 'serious':
      return 'P2';
    case 'general':
      return 'P1';
    default:
      return 'P0';
  }
}

/**
 * 其他设备/施工测点的判据。
 * 与 severityToEquipmentGrade 共用 P0–P3 级差：设备档位读作
 * 一般/严重/危急缺陷，施工档位读作当场整改/限期整改/立即停工。
 */
export function classifyTopOilDefect(oilC: number): IrDefectSeverity {
  // DL/T 572 运行控制值 85 ℃；GB/T 6451 顶层油温最高 95 ℃。
  if (oilC > 95) return 'serious';
  if (oilC > 85) return 'general';
  return 'none';
}

/** 末级漏保：实测动作电流高于额定值即视为拒动。 */
export function classifyResidualCurrentDefect(
  actionMa: number,
  ratedMa = 30
): IrDefectSeverity {
  return actionMa > ratedMa ? 'critical' : 'none';
}

/** 巡视通道净宽：低于设计净宽即占道，低于规范下限按堵塞疏散通道处理。 */
export function classifyClearanceDefect(
  widthM: number,
  designM = ACT1_AISLE_DESIGN_WIDTH_M,
  codeMinM = 0.7
): IrDefectSeverity {
  if (widthM < codeMinM) return 'critical';
  if (widthM < designM) return 'general';
  return 'none';
}

/** 基坑临边：0.5 m 以上的无防护缺口按重大隐患。 */
export function classifyEdgeGapDefect(gapM: number): IrDefectSeverity {
  if (gapM >= 0.5) return 'critical';
  if (gapM > 0) return 'serious';
  return 'none';
}

/** 电流致热型读数：热点取最高相，参考相取次高相；单相读数不可判级。 */
export function classifyHeatingReading(
  values: number[],
  ambientC: number
): IrDefectSeverity | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => b - a);
  return classifyCurrentHeatingDefect(sorted[0], sorted[1], ambientC);
}

export const ACT1_VALID_TOOLS: Act1Tool[] = ['thermometer', 'laser', 'leakage'];

export const ACT1_DISTRACTOR_TOOLS: Act1Tool[] = [
  'multimeter',
  'flashlight',
  'torque',
  'hollow-hammer',
  'feeler',
  'caliper',
];

const IR_ACTIONS: Act1ActionSpec[] = [
  { id: 'ir-3', label: '同距同角三相测温', tool: 'thermometer', quality: 'ok' },
  { id: 'ir-1', label: '随手单相测温', tool: 'thermometer', quality: 'coverage' },
  { id: 'ir-casual', label: '快速扫测', tool: 'thermometer', quality: 'condition' },
];

const VISUAL_ACTION: Act1ActionSpec = {
  id: 'visual',
  label: '近观检查',
  tool: 'visual',
  quality: 'ok',
};

const CLEARANCE_ACTION: Act1ActionSpec = {
  id: 'clearance',
  label: '激光测距通道净宽',
  tool: 'laser',
  quality: 'ok',
};

/* ------------------------------------------------------------------ */
/* Checkpoints                                                        */
/* ------------------------------------------------------------------ */

/**
 * 第一幕按"就近先做"排列：公寓一层 10kV 配电室（站区东南）→ 站区中部巡视通道
 * → 前侧 F02 间隔。任务追踪、雷达与重走出生点都按此顺序取当前目标。
 */
const ACT1_POINTS_DEF: Act1PointDef[] = [
  {
    id: 'hv-10kv',
    act: 1,
    name: '10kV 电气设备',
    shortName: '10kV 设备',
    zone: '公寓一层 10kV 配电室',
    x: 35.2,
    z: -22.4,
    focusY: 1.5,
    radius: 4.5,
    profile: 'equipment',
    clue: '10kV 开关柜柜列带电运行，柜前有绝缘垫与柜号标识，柜内母排接头封闭在柜内。',
    /** 室内点位：重走时把人放在门内侧，否则会被外墙挡在建筑外。 */
    approach: { x: 33.2, z: -22.72, doorOpen: true },
    requiredActions: ['visual', 'ir-3'],
    actions: {
      visual: [VISUAL_ACTION],
      thermometer: IR_ACTIONS,
    },
    standardGrade: { A: 'P0', B: 'P0', C: 'P2', D: 'P0' },
    finding: {
      A: null,
      B: null,
      C: { title: '10kV 柜内母排接头过热', klass: 'urgent' },
      D: null,
    },
  },
  {
    id: 'aisle',
    act: 1,
    name: '巡视通道',
    shortName: '通道检测',
    zone: '前侧/后侧间隔区之间',
    x: 8.5,
    z: 1.0,
    focusY: 0.8,
    radius: 5.0,
    profile: 'construction',
    clue: '连接前后两片间隔区的巡视通道，局部堆放木方与木托盘；材料属北侧扩建施工单位。',
    requiredActions: ['visual', 'clearance'],
    actions: {
      visual: [VISUAL_ACTION],
      laser: [CLEARANCE_ACTION],
    },
    standardGrade: { A: 'P1', B: 'P1', C: 'P1', D: 'P1' },
    finding: {
      A: { title: '材料占用巡视通道', klass: 'general' },
      B: { title: '材料占用巡视通道', klass: 'general' },
      C: { title: '材料占用巡视通道', klass: 'general' },
      D: { title: '材料占用巡视通道', klass: 'general' },
    },
  },
  {
    id: 'bay-temp',
    act: 1,
    name: 'BAY 设备温度',
    shortName: 'BAY 测温',
    zone: '前侧开关间隔区 F02',
    x: 4.9,
    z: 21.6,
    focusY: 2.8,
    radius: 5.0,
    profile: 'equipment',
    clue: '220kV F02 间隔隔离开关与引线接头，站在警戒线外巡视，与带电体保持 3 m 以上。',
    requiredActions: ['visual', 'ir-3'],
    actions: {
      visual: [VISUAL_ACTION],
      thermometer: IR_ACTIONS,
    },
    standardGrade: { A: 'P0', B: 'P2', C: 'P0', D: 'P0' },
    finding: {
      A: null,
      B: { title: 'BAY 设备 B 相接头过热', klass: 'urgent' },
      C: null,
      D: null,
    },
  },
];

const ACT2_POINTS_DEF: Act1PointDef[] = [
  {
    id: 'a2-crew',
    act: 2,
    name: '班组人员资格',
    shortName: '人员资格',
    zone: '1# 主变检修区 · 班组集合点',
    x: -19.7,
    z: 18.3,
    focusY: 1.6,
    radius: 5.0,
    profile: 'construction',
    clue: '班前会后，检修班组在 1# 主变东侧集合；核对在场人员、列队着装与特种作业台账。',
    requiredActions: ['visual'],
    actions: {
      visual: [VISUAL_ACTION],
    },
    standardGrade: { A: 'P0', B: 'P0', C: 'P0', D: 'P1' },
    finding: {
      A: null,
      B: null,
      C: null,
      D: { title: '焊工证过期', klass: 'general' },
    },
  },
  {
    id: 'a2-wall',
    act: 2,
    name: '主变防火墙',
    shortName: '防火墙空鼓',
    zone: '1# / 2# 主变之间防火墙',
    x: -20.5,
    z: 11.4,
    focusY: 1.6,
    radius: 4.5,
    profile: 'construction',
    clue: '1# 与 2# 主变之间的防火墙，东侧抹面局部受潮；现场敲击检查抹灰层空鼓与脱层。',
    requiredActions: ['visual', 'wall-hollow'],
    actions: {
      visual: [VISUAL_ACTION],
      'hollow-hammer': [
        { id: 'wall-hollow', label: '敲击防火墙检查空鼓', tool: 'hollow-hammer', quality: 'ok' },
      ],
    },
    standardGrade: { A: 'P0', B: 'P2', C: 'P0', D: 'P0' },
    finding: {
      A: null,
      B: { title: '主变防火墙抹灰层空鼓、局部脱层', klass: 'urgent' },
      C: null,
      D: null,
    },
  },
  {
    id: 'a2-oil',
    act: 2,
    name: '主变本体油温',
    shortName: '主变油温',
    zone: '1# 主变检修区',
    x: -28.3,
    z: 13.8,
    focusY: 1.8,
    radius: 5.0,
    profile: 'equipment',
    clue: '1# 主变本体、散热器与油枕朝向检修通道，地面有防油围堰。',
    requiredActions: ['visual', 'oil-temp'],
    actions: {
      visual: [VISUAL_ACTION],
      thermometer: [{ id: 'oil-temp', label: '测量顶层油温', tool: 'thermometer', quality: 'ok' }],
    },
    standardGrade: { A: 'P0', B: 'P0', C: 'P2', D: 'P0' },
    finding: {
      A: null,
      B: null,
      C: { title: '主变本体渗漏、油温偏高', klass: 'urgent' },
      D: null,
    },
  },
];

const ACT3_POINTS_DEF: Act1PointDef[] = [
  {
    id: 'a3-hardhat',
    act: 3,
    name: '作业人员防护',
    shortName: '人员防护',
    zone: '施工区东侧安全警示牌',
    x: -18.5,
    z: -17.1,
    focusY: 1.7,
    radius: 6.0,
    profile: 'construction',
    clue: '施工区东侧安全警示牌旁，材料堆西侧一名作业人员未戴安全帽，距离较远，需升空观察取证。',
    requiredActions: ['visual', 'drone-recon'],
    actions: {
      visual: [VISUAL_ACTION],
    },
    standardGrade: { A: 'P1', B: 'P1', C: 'P1', D: 'P1' },
    finding: {
      A: { title: '作业人员未戴安全帽', klass: 'general' },
      B: { title: '作业人员未戴安全帽', klass: 'general' },
      C: { title: '作业人员未戴安全帽', klass: 'general' },
      D: { title: '作业人员未戴安全帽', klass: 'general' },
    },
    evidencePerspective: 'drone',
    /** 取证对准施工区西侧未戴安全帽的人员（MEMBER_UNSAFE_01）。 */
    evidenceTarget: { x: -31.1, y: 1.2, z: -13.2 },
  },
  {
    id: 'a3-pit',
    act: 3,
    name: '基坑临边防护',
    shortName: '基坑防护',
    zone: '施工区中部基坑',
    x: -26.2,
    z: -18.2,
    focusY: 0.9,
    radius: 5.0,
    profile: 'construction',
    clue: '基坑位于施工区中部材料堆旁，临边围栏缺失，坑内有积水，无支护与上下通道。',
    requiredActions: ['visual', 'pit-gap'],
    actions: {
      visual: [VISUAL_ACTION],
      laser: [{ id: 'pit-gap', label: '测量基坑临边缺口', tool: 'laser', quality: 'ok' }],
    },
    standardGrade: { A: 'P3', B: 'P3', C: 'P3', D: 'P3' },
    finding: {
      A: { title: '基坑无临边防护，坑内积水、无支护、无上下通道', klass: 'urgent' },
      B: { title: '基坑无临边防护，坑内积水、无支护、无上下通道', klass: 'urgent' },
      C: { title: '基坑无临边防护，坑内积水、无支护、无上下通道', klass: 'urgent' },
      D: { title: '基坑无临边防护，坑内积水、无支护、无上下通道', klass: 'urgent' },
    },
  },
  {
    id: 'a3-box',
    act: 3,
    name: '临时配电箱',
    shortName: '配电箱漏保',
    zone: '施工区南侧临时用电',
    x: -22.1,
    z: -21.7,
    focusY: 1.2,
    radius: 5.0,
    profile: 'construction',
    clue: '施工区南侧临时配电箱，箱门未锁，进出线沿地面敷设且外护套破损。',
    requiredActions: ['visual', 'leakage-test'],
    actions: {
      visual: [VISUAL_ACTION],
      leakage: [
        { id: 'leakage-test', label: '测试末级漏保动作值', tool: 'leakage', quality: 'ok' },
      ],
    },
    standardGrade: { A: 'P3', B: 'P3', C: 'P3', D: 'P3' },
    finding: {
      A: { title: '临时配电箱漏保失效', klass: 'urgent' },
      B: { title: '临时配电箱漏保失效', klass: 'urgent' },
      C: { title: '临时配电箱漏保失效', klass: 'urgent' },
      D: { title: '临时配电箱漏保失效', klass: 'urgent' },
    },
  },
];

export const ACT_POINTS: Record<ActNo, Act1PointDef[]> = {
  1: ACT1_POINTS_DEF,
  2: ACT2_POINTS_DEF,
  3: ACT3_POINTS_DEF,
};

const ALL_POINTS: Act1PointDef[] = [
  ...ACT1_POINTS_DEF,
  ...ACT2_POINTS_DEF,
  ...ACT3_POINTS_DEF,
];

/** 兼容旧引用：第一幕检查点。 */
export const ACT1_POINTS = ACT1_POINTS_DEF;

export function getActPoints(act: ActNo): Act1PointDef[] {
  return ACT_POINTS[act];
}

export function getActPointIds(act: ActNo): Act1PointId[] {
  return ACT_POINTS[act].map((p) => p.id);
}

export const ACT1_POINT_IDS: Act1PointId[] = ACT1_POINTS_DEF.map((p) => p.id);

export function getAct1Point(id: Act1PointId): Act1PointDef {
  const point = ALL_POINTS.find((p) => p.id === id);
  if (!point) throw new Error(`Unknown checkpoint: ${id}`);
  return point;
}

export function findNearestAct1Point(
  x: number,
  z: number,
  act: ActNo = 1
): { point: Act1PointDef; distance: number } | null {
  let best: { point: Act1PointDef; distance: number } | null = null;
  for (const point of ACT_POINTS[act]) {
    const distance = Math.hypot(x - point.x, z - point.z);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}

/** Nearest checkpoint that is not resolved yet; resolved points cannot be re-opened. */
export function findNearestOpenAct1Point(
  x: number,
  z: number,
  act: ActNo,
  isResolved: (id: Act1PointId) => boolean
): { point: Act1PointDef; distance: number } | null {
  let best: { point: Act1PointDef; distance: number } | null = null;
  for (const point of ACT_POINTS[act]) {
    if (isResolved(point.id)) continue;
    const distance = Math.hypot(x - point.x, z - point.z);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Seeded variants                                                     */
/* ------------------------------------------------------------------ */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 第一/三幕 40/30/30；第二幕增加人员资格 D 变体（40/20/20/20）。 */
export function pickAct1Variant(seed: number, act: ActNo = 1): Act1Variant {
  const roll = mulberry32((seed ^ hashString(`act${act}`)) >>> 0)();
  if (act === 2) {
    if (roll < 0.4) return 'A';
    if (roll < 0.6) return 'B';
    if (roll < 0.8) return 'C';
    return 'D';
  }
  if (roll < 0.4) return 'A';
  if (roll < 0.7) return 'B';
  return 'C';
}

function emptyPointState(id: Act1PointId): Act1PointState {
  return { id, completedActions: [], readings: [], mistakeCount: 0 };
}

export function createAct1State(
  seed = Date.now() >>> 0,
  act: ActNo = 1
): Act1State {
  const variant = pickAct1Variant(seed, act);
  return {
    act,
    seed: seed >>> 0,
    variant,
    points: Object.fromEntries(
      getActPointIds(act).map((id) => [id, emptyPointState(id)])
    ) as Record<Act1PointId, Act1PointState>,
    reviewChances: ACT1_REVIEW_CHANCES,
    score: ACT1_SCORE_BASE,
    deductions: [],
    pendingLines: [],
    seenLines: [],
    actFailed: false,
    failReason: null,
    failDetail: null,
  };
}

/**
 * Repairs a persisted act state: older saves may predate the `act` field,
 * carry checkpoints that no longer exist, or miss newly added ones.
 * Unknown ids are dropped and missing ids start empty so play can continue.
 */
export function normalizeAct1State(state: Act1State, act: ActNo): Act1State {
  const rawPoints = (state.points ?? {}) as Record<
    string,
    (Partial<Act1PointState> & { dispositionKind?: string }) | undefined
  >;
  const points = Object.fromEntries(
    getActPointIds(act).map((id) => {
      const raw = rawPoints[id];
      // 旧存档用 dispositionKind 区分“正常不处理 / 取证处理”，现在等级即结论。
      const legacyNormal = raw?.dispositionKind === 'normal';
      return [
        id,
        {
          id,
          completedActions: Array.isArray(raw?.completedActions)
            ? raw.completedActions
            : [],
          readings: Array.isArray(raw?.readings)
            ? raw.readings.map(normalizeReading)
            : [],
          disposition: raw?.disposition ?? (legacyNormal ? 'P0' : undefined),
          evidenceId: raw?.evidenceId,
          mistakeCount:
            typeof raw?.mistakeCount === 'number' ? raw.mistakeCount : 0,
        } satisfies Act1PointState,
      ];
    })
  ) as Record<Act1PointId, Act1PointState>;

  const variant: Act1Variant =
    state.variant === 'B' || state.variant === 'C' || state.variant === 'D'
      ? state.variant
      : 'A';
  return {
    ...state,
    act,
    variant,
    points,
    reviewChances:
      typeof state.reviewChances === 'number'
        ? state.reviewChances
        : ACT1_REVIEW_CHANCES,
    score: typeof state.score === 'number' ? state.score : ACT1_SCORE_BASE,
    deductions: Array.isArray(state.deductions) ? state.deductions : [],
    pendingLines: Array.isArray(state.pendingLines) ? state.pendingLines : [],
    seenLines: Array.isArray(state.seenLines) ? state.seenLines : [],
    actFailed: Boolean(state.actFailed),
    failReason:
      state.failReason === 'shock' || state.failReason === 'chances'
        ? state.failReason
        : state.actFailed
          ? 'chances'
          : null,
    failDetail: typeof state.failDetail === 'string' ? state.failDetail : null,
  };
}

/* ------------------------------------------------------------------ */
/* Readings                                                           */
/* ------------------------------------------------------------------ */

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function reading(
  label: string,
  values: number[],
  unit: string,
  quality: Act1ReadingQuality,
  note?: string
): Act1Reading {
  return { label, values, unit, note, quality };
}

/**
 * 旧存档可能缺少读数质量，或把单相记录补成 [A, 0, 0]。
 * 这里补齐质量并把单相记录还原成一个值，避免 0 ℃ 参考相污染判级。
 */
function normalizeReading(reading: Act1Reading): Act1Reading {
  const quality: Act1ReadingQuality =
    reading.quality === 'coverage' || reading.quality === 'condition'
      ? reading.quality
      : 'ok';
  const values = Array.isArray(reading.values) ? reading.values : [];
  const paddedSingle =
    values.length === 3 && values[1] === 0 && values[2] === 0;
  return {
    ...reading,
    unit: typeof reading.unit === 'string' ? reading.unit : '',
    quality,
    values: paddedSingle ? [values[0]] : values,
  };
}

export const ACT1_IR_DEFECT_PHASE = 1;
/** 10kV 柜列进线负荷（A），与 220kV 线路负荷分开记录。 */
export const ACT1_10KV_LOAD_A = 186;

function irBase(pointId: Act1PointId, variant: Act1Variant): number[] {
  const isHv = pointId === 'hv-10kv';
  const base = isHv ? 38.4 : 43.2;
  const spread = isHv ? [0, 0.6, 0.3] : [0, 0.5, 0.2];
  const values = spread.map((d) => round1(base + d));
  if (pointId === 'bay-temp' && variant === 'B') values[ACT1_IR_DEFECT_PHASE] = 92.4;
  if (isHv && variant === 'C') values[ACT1_IR_DEFECT_PHASE] = 96.8;
  return values;
}

function irTarget(pointId: Act1PointId): { object: string; target: string } {
  return pointId === 'hv-10kv'
    ? { object: '3 号柜', target: '母排接头' }
    : { object: 'F02 间隔', target: '引线接头' };
}

function irNote(pointId: Act1PointId, act: ActNo): string {
  const ambient = ACT_AMBIENT[act];
  if (pointId === 'hv-10kv') {
    // 柜内母排必须靠运维开启柜门测温窗才能测到，监理不自行开柜。
    return `环温 ${ambient.temperatureC} ℃ · 负荷 ${ACT1_10KV_LOAD_A} A · 运维配合开启柜门测温窗 · 距离 0.8 m · 发射率 0.95`;
  }
  return `距离 3.2 m（≥${ACT1_LIVE_PART_CLEARANCE_M.toFixed(1)} m）· 角度 15° · 发射率 0.95 · 负荷 ${ambient.loadA} A · 环温 ${ambient.temperatureC} ℃ · 风速 ${ambient.windMps} m/s`;
}

function irReading(
  pointId: Act1PointId,
  variant: Act1Variant,
  act: ActNo,
  mode: 'three' | 'single' | 'casual'
): Act1Reading {
  const values = irBase(pointId, variant);
  const hasDefect =
    (pointId === 'bay-temp' && variant === 'B') ||
    (pointId === 'hv-10kv' && variant === 'C');

  if (mode === 'casual') {
    for (let i = 0; i < 3; i += 1) {
      values[i] = round1(values[i] * 0.9 - 1.2 + (hasDefect && i === 1 ? 8 : 0));
    }
  } else if (mode === 'single') {
    values.length = 1;
  }

  const { object, target } = irTarget(pointId);
  const shown = values.map((value) => value.toFixed(1)).join(' / ');
  return reading(
    mode === 'single'
      ? `${object} A 相 ${shown}`
      : `${object} ${target} A / B / C  ${shown}`,
    values,
    '℃',
    mode === 'three' ? 'ok' : mode === 'single' ? 'coverage' : 'condition',
    mode === 'three'
      ? irNote(pointId, act)
      : mode === 'single'
        ? '仅记录 A 相，无法比对相间温差'
        : '距离/角度未稳定，读数仅作参考'
  );
}

function clearanceReading(pointId: Act1PointId): Act1Reading {
  if (pointId === 'a3-pit') {
    return reading('临边缺口 2.4', [2.4], 'm', 'ok', '围栏缺失长度 · 夜间照明未接通');
  }
  return reading(
    '通道净宽 0.78',
    [0.78],
    'm',
    'ok',
    `激光测距 · 设计净宽 ${ACT1_AISLE_DESIGN_WIDTH_M.toFixed(1)} m（规范 0.7~1.0 m）· 距带电体 3.4 m`
  );
}

/** 判级只认合格读数（quality='ok'），读数组按最新在前排列。 */
export function getAdmissibleReading(
  pointState: Act1PointState | null | undefined
): Act1Reading | undefined {
  return pointState?.readings.find(
    (item) => (item.quality ?? 'ok') === 'ok'
  );
}

function severityForPoint(
  pointId: Act1PointId,
  readingItem: Act1Reading,
  ambientC: number
): IrDefectSeverity | null {
  const value = readingItem.values[0];
  switch (pointId) {
    case 'bay-temp':
    case 'hv-10kv':
      return classifyHeatingReading(readingItem.values, ambientC);
    case 'a2-oil':
      return readingItem.values.length === 1 ? classifyTopOilDefect(value) : null;
    case 'a3-box':
      return readingItem.values.length === 1
        ? classifyResidualCurrentDefect(value)
        : null;
    case 'a3-pit':
      return readingItem.values.length === 1 ? classifyEdgeGapDefect(value) : null;
    case 'aisle':
      return readingItem.values.length === 1
        ? classifyClearanceDefect(value)
        : null;
    default:
      return null;
  }
}

/**
 * 标准处置分：由合格读数经判据推出；没有可判读数（墙面、台账、人员防护）
 * 才回退到检查点的固定标准。
 */
export function standardGradeFor(
  state: Act1State,
  pointId: Act1PointId
): Act1Grade {
  const point = getAct1Point(pointId);
  const readingItem = getAdmissibleReading(state.points[pointId]);
  if (readingItem) {
    const severity = severityForPoint(
      pointId,
      readingItem,
      ACT_AMBIENT[state.act].temperatureC
    );
    if (severity) return severityToEquipmentGrade(severity);
  }
  return point.standardGrade[state.variant];
}


/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

function deduction(state: Act1State, id: string, label: string, points: number): Act1State {
  return {
    ...state,
    score: Math.max(0, state.score - points),
    deductions: [...state.deductions, { id, label, points }],
  };
}

function spendChance(state: Act1State, count = 1): Act1State {
  const reviewChances = Math.max(0, state.reviewChances - count);
  const actFailed = reviewChances <= 0;
  return {
    ...state,
    reviewChances,
    actFailed,
    failReason: actFailed ? 'chances' : state.failReason,
  };
}

/** 越过带电警戒线：本幕直接按触电事故失败。 */
export function failAct1ByShock(state: Act1State, zoneLabel: string): Act1State {
  if (state.actFailed) return state;
  return {
    ...state,
    actFailed: true,
    failReason: 'shock',
    failDetail: zoneLabel,
  };
}

/** Applies an out-of-band penalty (e.g. a drone flying over a live bay). */
export function applyAct1Penalty(
  state: Act1State,
  id: string,
  label: string,
  points: number,
  chanceCost = 0
): Act1State {
  if (state.actFailed) return state;
  let next = deduction(state, id, label, points);
  if (chanceCost > 0) next = spendChance(next, chanceCost);
  return next;
}

function pushLine(state: Act1State, ...ids: string[]): Act1State {
  if (state.act !== 1) return state;
  const fresh = ids.filter(
    (id) => !state.seenLines.includes(id) && !state.pendingLines.includes(id)
  );
  if (fresh.length === 0) return state;
  return {
    ...state,
    pendingLines: [...state.pendingLines, ...fresh],
    seenLines: [...state.seenLines, ...fresh],
  };
}

/** Queues briefing lines for any act (spatial triggers); duplicates are ignored. */
export function queueAct1Lines(state: Act1State, ids: string[]): Act1State {
  const fresh = ids.filter(
    (id) => !state.seenLines.includes(id) && !state.pendingLines.includes(id)
  );
  if (fresh.length === 0) return state;
  return {
    ...state,
    pendingLines: [...state.pendingLines, ...fresh],
    seenLines: [...state.seenLines, ...fresh],
  };
}

function actionFor(
  point: Act1PointDef,
  tool: Act1Tool | 'visual',
  actionId: string
): Act1ActionSpec | undefined {
  return point.actions[tool]?.find((a) => a.id === actionId);
}

export function getAct1Actions(
  pointId: Act1PointId,
  tool: Act1Tool | 'visual' | null
): Act1ActionSpec[] {
  const point = getAct1Point(pointId);
  if (!tool) return [];
  return point.actions[tool] ?? [];
}

export function isPointCovered(state: Act1State, pointId: Act1PointId): boolean {
  const point = getAct1Point(pointId);
  const ps = state.points[pointId];
  if (!ps) return false;
  return point.requiredActions.every((a) => ps.completedActions.includes(a));
}

/** 处置等级是否需要现场取证：P0 只需记录，P1 及以上必须留证。 */
export function dispositionNeedsEvidence(grade: Act1Grade | undefined): boolean {
  return Boolean(grade) && grade !== 'P0';
}

/** Drone-observation checkpoints can only be covered by a drone photo. */
export function canCaptureDroneRecon(
  state: Act1State,
  pointId: Act1PointId
): boolean {
  const point = getAct1Point(pointId);
  const pointState = state.points[pointId];
  if (!pointState) return false;
  return (
    point.evidencePerspective === 'drone' &&
    point.requiredActions.includes('drone-recon') &&
    pointState.completedActions.includes('visual') &&
    !pointState.completedActions.includes('drone-recon')
  );
}

export function isPointResolved(state: Act1State, pointId: Act1PointId): boolean {
  const ps = state.points[pointId];
  if (!ps?.disposition) return false;
  return dispositionNeedsEvidence(ps.disposition) ? Boolean(ps.evidenceId) : true;
}

export function isActComplete(state: Act1State): boolean {
  return getActPointIds(state.act).every((id) => isPointResolved(state, id));
}

export function countResolvedPoints(state: Act1State): number {
  return getActPointIds(state.act).filter((id) => isPointResolved(state, id)).length;
}

/** 检查点在 HUD / 备忘录里的统一状态机。 */
export type Act1PointStatus =
  | 'unchecked'
  | 'observed'
  | 'covered'
  | 'awaiting-evidence'
  | 'resolved';

export const ACT1_POINT_STATUS_LABELS: Record<Act1PointStatus, string> = {
  unchecked: '未检查',
  observed: '已观察',
  covered: '待处置',
  'awaiting-evidence': '待取证',
  resolved: '已完成',
};

export function getAct1PointStatus(
  state: Act1State,
  pointId: Act1PointId
): Act1PointStatus {
  const pointState = state.points[pointId];
  if (!pointState) return 'unchecked';
  if (isPointResolved(state, pointId)) return 'resolved';
  if (isPointCovered(state, pointId)) {
    if (
      dispositionNeedsEvidence(pointState.disposition) &&
      !pointState.evidenceId
    ) {
      return 'awaiting-evidence';
    }
    return 'covered';
  }
  if (pointState.completedActions.length > 0) return 'observed';
  return 'unchecked';
}

export interface Act1ActionOutcome {
  state: Act1State;
  result: Act1ActionResult;
}

export function applyAct1Action(
  state: Act1State,
  pointId: Act1PointId,
  tool: Act1Tool | 'visual',
  actionId: string
): Act1ActionOutcome {
  if (state.actFailed) {
    return {
      state,
      result: { kind: 'invalid', text: '本幕检查机会已耗尽。', penalty: 0, chanceCost: 0 },
    };
  }

  const point = getAct1Point(pointId);
  const action = actionFor(point, tool, actionId);
  const isDistractor = tool !== 'visual' && ACT1_DISTRACTOR_TOOLS.includes(tool);
  // 某些检查点有专属工具（例如防火墙空鼓用空鼓棒），只在该点位视为有效工具。
  const isPointTool = tool !== 'visual' && Boolean(point.actions[tool]?.length);
  const isActTool =
    tool === 'visual' || ACT1_VALID_TOOLS.includes(tool) || isPointTool;
  let next = state;

  if (!action) {
    if (isDistractor) {
      next = spendChance(
        deduction(next, `wrong-tool-${pointId}`, '工具不适用于该检查项', 8),
        1
      );
      return {
        state: next,
        result: {
          kind: 'invalid',
          text: '读数无效：当前工具无法获取该检查项的数据。',
          errorType: 'wrong-tool',
          penalty: 8,
          chanceCost: 1,
        },
      };
    }
    if (!isActTool) {
      return {
        state,
        result: { kind: 'invalid', text: '该工具不属于本次巡检装备。', penalty: 0, chanceCost: 0 },
      };
    }
    next = deduction(next, `wrong-point-${pointId}-${tool}`, '测点选择不适用', 6);
    return {
      state: next,
      result: {
        kind: 'invalid',
        text: '该目标没有此类测点，未取得有效数据。',
        errorType: 'wrong-point',
        penalty: 6,
        chanceCost: 0,
      },
    };
  }

  const spec = action;
  if (spec.quality === 'coverage') {
    const r = irReading(point.id, state.variant, state.act, 'single');
    next = deduction(next, `coverage-${pointId}`, '覆盖不足：仅记录了单相', 10);
    next = pushLine(next, 'A1-01');
    return {
      state: {
        ...next,
        points: {
          ...next.points,
          [pointId]: {
            ...next.points[pointId],
            readings: [r, ...next.points[pointId].readings],
          },
        },
      },
      result: {
        kind: 'reading',
        text: `记录：${r.label} ${r.unit}`,
        reading: r,
        errorType: 'coverage',
        penalty: 10,
        chanceCost: 0,
      },
    };
  }

  if (spec.quality === 'condition') {
    const r = irReading(point.id, state.variant, state.act, 'casual');
    next = deduction(next, `condition-${pointId}`, '测量条件不符：距离/角度未稳定', 6);
    next = pushLine(next, 'A1-01');
    return {
      state: {
        ...next,
        points: {
          ...next.points,
          [pointId]: {
            ...next.points[pointId],
            readings: [r, ...next.points[pointId].readings],
          },
        },
      },
      result: {
        kind: 'reading',
        text: `记录：${r.label} ${r.unit}（测量条件不稳）`,
        reading: r,
        errorType: 'condition',
        penalty: 6,
        chanceCost: 0,
      },
    };
  }

  let text = '';
  let r: Act1Reading | undefined;

  if (spec.id === 'ir-3' || spec.id === 'ir-1' || spec.id === 'ir-casual') {
    r = irReading(
      point.id,
      state.variant,
      state.act,
      spec.id === 'ir-3' ? 'three' : 'single'
    );
    text = `记录：${r.label} ${r.unit}`;
  } else if (spec.id === 'clearance' || spec.id === 'pit-gap') {
    r = clearanceReading(point.id);
    text = `记录：${r.label} ${r.unit}`;
  } else if (spec.id === 'wall-hollow') {
    text =
      state.variant === 'B'
        ? '敲击：防火墙东侧抹灰层回声发空，局部脱层。'
        : '敲击：防火墙抹面密实，回声均匀。';
  } else if (spec.id === 'oil-temp') {
    // 1# 主变已停电，读数取停电后复测值：停电前负荷与渗漏/油位一起作为佐证。
    const hot = state.variant === 'C';
    const oilC = hot ? 96.2 : 64.2;
    const ambientC = ACT_AMBIENT[state.act].temperatureC;
    r = reading(
      `顶层油温 ${oilC.toFixed(1)}`,
      [oilC],
      '℃',
      'ok',
      hot
        ? `停电前负荷 62% · 停电后 1 h 复测 · 环温 ${ambientC} ℃ · 油位低于正常刻度 · 本体底部渗漏`
        : `停电后 1 h 复测 · 环温 ${ambientC} ℃ · 油位在正常刻度 · 本体无渗漏`
    );
    text = `记录：顶层油温 ${oilC.toFixed(1)} ℃`;
  } else if (spec.id === 'leakage-test') {
    // 第三幕配电箱隐患常驻，漏保读数在所有变体下都显示失效。
    r = reading(
      '漏保动作电流 42',
      [42],
      'mA',
      'ok',
      '额定 30 mA · 动作时间 0.18 s'
    );
    text = '记录：漏保动作电流 42 mA';
  } else if (spec.id === 'visual') {
    text = getAct1VisualText(point.id, state.variant);
  }

  const completed = next.points[pointId].completedActions.includes(spec.id)
    ? next.points[pointId].completedActions
    : [...next.points[pointId].completedActions, spec.id];

  next = {
    ...next,
    points: {
      ...next.points,
      [pointId]: {
        ...next.points[pointId],
        completedActions: completed,
        readings: r ? [r, ...next.points[pointId].readings] : next.points[pointId].readings,
      },
    },
  };

  next = pushLine(next, 'A1-00', 'A1-01');
  if (pointId === 'bay-temp' && spec.id === 'ir-3') {
    next = pushLine(next, 'A1-02', 'A1-03', 'A1-04');
  }
  if (pointId === 'bay-temp' && state.variant === 'B' && spec.id === 'ir-3') {
    next = pushLine(next, 'A1-05');
  }
  if (pointId === 'aisle' && spec.id === 'clearance') {
    next = pushLine(next, 'A1-08', 'A1-11', 'A1-12');
  }

  return {
    state: next,
    result: {
      kind: r ? 'reading' : 'clue',
      text,
      reading: r,
      penalty: 0,
      chanceCost: 0,
    },
  };
}

export function getAct1VisualText(
  pointId: Act1PointId,
  variant: Act1Variant
): string {
  switch (pointId) {
    case 'aisle':
      return '观察：钢管与扣件堆在巡视通道内，剩余净宽不足。';
    case 'bay-temp':
      return variant === 'B'
        ? '观察：B 相引线接头线夹有轻微变色，其余两相正常。'
        : '观察：三相触头合闸到位，瓷瓶与均压环外观无异常。';
    case 'hv-10kv':
      return variant === 'C'
        ? '观察：3 号柜柜体温度偏高，柜前闻到轻微焦糊味。'
        : '观察：柜列运行指示正常，柜门关闭，无放电声响与异味。';
    case 'a2-crew':
      return variant === 'D'
        ? '观察：人员列队、着装齐全；核对特种作业台账时发现一名焊工证已过期。'
        : '观察：人员列队、着装齐全，特种作业台账与在场人员一致。';
    case 'a2-wall':
      return variant === 'B'
        ? '观察：防火墙东侧抹灰层有细微裂缝与受潮痕迹。'
        : '观察：防火墙表面平整，无裂缝、空鼓与脱层。';
    case 'a2-oil':
      return variant === 'C'
        ? '观察：本体底部有油迹，油位计低于正常刻度。'
        : '观察：本体、法兰与阀门无渗漏，油位在正常范围。';
    case 'a3-hardhat':
      return '观察：材料堆西侧一名作业人员未戴安全帽；距离较远，地面难以取景。';
    case 'a3-pit':
      return '观察：基坑临边无连续围栏，坑内有积水，无支护与上下通道。';
    case 'a3-box':
      return '观察：配电箱箱门未锁，进出线沿地面敷设且外护套破损。';
    default:
      return '观察：外观未见明显异常。';
  }
}

/* ------------------------------------------------------------------ */
/* Disposition                                                        */
/* ------------------------------------------------------------------ */

export interface Act1DispositionOutcome {
  state: Act1State;
  ok: boolean;
  message: string;
}

/**
 * 记录处置等级。等级即结论：P0 表示正常记录、闭环完成；
 * P1 及以上表示隐患处置，还需现场取证（attachAct1Evidence）才算闭环。
 *
 * 这里不做对错判定，也不提示轻重，玩家可以自由选择；判定只在幕结算时统一进行。
 */
export function setAct1Disposition(
  state: Act1State,
  pointId: Act1PointId,
  grade: Act1Grade
): Act1DispositionOutcome {
  if (state.actFailed) {
    return { state, ok: false, message: '本幕检查机会已耗尽。' };
  }
  if (!isPointCovered(state, pointId)) {
    return { state, ok: false, message: '请先完成观察与全部检测。' };
  }

  return {
    state: {
      ...state,
      points: {
        ...state.points,
        [pointId]: {
          ...state.points[pointId],
          disposition: grade,
          evidenceId:
            grade === 'P0' ? undefined : state.points[pointId].evidenceId,
        },
      },
    },
    ok: true,
    message:
      grade === 'P0'
        ? '已按正常记录，不取证、不整改。'
        : '处置等级已记录，请拍照取证。',
  };
}

/* ------------------------------------------------------------------ */
/* Evidence                                                           */
/* ------------------------------------------------------------------ */

export function attachAct1Evidence(
  state: Act1State,
  pointId: Act1PointId,
  evidenceId: string
): Act1State {
  const firstEvidence = state.act === 1 && !state.seenLines.includes('A1-10');
  const point = getAct1Point(pointId);
  const pointState = state.points[pointId];
  const completedActions =
    point.requiredActions.includes('drone-recon') &&
    !pointState.completedActions.includes('drone-recon')
      ? [...pointState.completedActions, 'drone-recon']
      : pointState.completedActions;
  return {
    ...state,
    points: {
      ...state.points,
      [pointId]: { ...pointState, evidenceId, completedActions },
    },
    pendingLines: firstEvidence ? [...state.pendingLines, 'A1-10'] : state.pendingLines,
    seenLines: firstEvidence ? [...state.seenLines, 'A1-10'] : state.seenLines,
  };
}

/* ------------------------------------------------------------------ */
/* Disposition scoring                                                */
/* ------------------------------------------------------------------ */

export type Act1DispositionIssueKind = 'unnecessary' | 'over' | 'under';

export interface Act1DispositionIssue {
  id: string;
  pointId: Act1PointId;
  kind: Act1DispositionIssueKind;
  label: string;
  points: number;
}

const DISPOSITION_ISSUE_LABEL: Record<Act1DispositionIssueKind, string> = {
  unnecessary: '无需处置的检查点被要求整改（多处置）',
  over: '处置等级高于标准（处理过当）',
  under: '处置等级低于标准（处置不到位）',
};

/** 该发现是否必须走“取证处理”闭环（归档类只需记录）。 */
export function findingNeedsEvidence(
  finding: Act1Finding | null | undefined
): boolean {
  return Boolean(finding && finding.klass !== 'archive');
}

function dispositionIssue(
  point: Act1PointDef,
  kind: Act1DispositionIssueKind
): Act1DispositionIssue {
  return {
    id: `disposition-${kind}-${point.id}`,
    pointId: point.id,
    kind,
    label: DISPOSITION_ISSUE_LABEL[kind],
    points: DISPOSITION_ERROR_PENALTY,
  };
}

/**
 * 处置正确性只在幕结算时统一判定：
 * - 没有隐患的检查点标准答案是 P0（正常记录），选到 P1 及以上属于多处置；
 * - 有隐患的检查点等级高于 / 低于标准分别记处理过当 / 不到位；
 * - 有隐患却记 P0 属于漏闭环，不在这里扣分，由结局判定为事故责任。
 */
export function evaluateDispositionIssues(
  state: Act1State
): Act1DispositionIssue[] {
  const issues: Act1DispositionIssue[] = [];
  for (const point of getActPoints(state.act)) {
    const pointState = state.points[point.id];
    const grade = pointState?.disposition;
    if (!grade) continue;
    if (!findingNeedsEvidence(point.finding[state.variant])) {
      if (dispositionNeedsEvidence(grade)) {
        issues.push(dispositionIssue(point, 'unnecessary'));
      }
      continue;
    }
    if (!dispositionNeedsEvidence(grade)) continue;
    const diff =
      GRADE_RANK[grade] - GRADE_RANK[standardGradeFor(state, point.id)];
    if (diff > 0) issues.push(dispositionIssue(point, 'over'));
    else if (diff < 0) issues.push(dispositionIssue(point, 'under'));
  }
  return issues;
}

/** 把处置错误扣分写入幕状态；幕结算时调用一次。 */
export function settleActDispositions(state: Act1State): Act1State {
  let next = state;
  for (const issue of evaluateDispositionIssues(state)) {
    if (next.deductions.some((item) => item.id === issue.id)) continue;
    next = deduction(next, issue.id, issue.label, issue.points);
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Findings & ending                                                  */
/* ------------------------------------------------------------------ */

export interface ActOutcome {
  /**
   * 已发现但未按隐患处置闭环的隐患（记 P0 或未处置都算漏闭环）。
   * 任意一项未闭环即按事故责任判 BAD。
   */
  unhandled: string[];
  handled: string[];
}

/** 结算：发现的隐患都必须定级并取证闭环，P0 记录不算闭环。 */
export function evaluateActOutcome(state: Act1State): ActOutcome {
  const unhandled: string[] = [];
  const handled: string[] = [];
  for (const id of getActPointIds(state.act)) {
    const point = getAct1Point(id);
    const finding = point.finding[state.variant];
    if (!findingNeedsEvidence(finding)) continue;
    if (dispositionNeedsEvidence(state.points[id].disposition)) {
      handled.push(finding!.title);
    } else {
      unhandled.push(finding!.title);
    }
  }
  return { unhandled, handled };
}

export function getAct1UrgentTruth(state: Act1State): string[] {
  return getActPoints(state.act)
    .filter((p) => p.finding[state.variant]?.klass === 'urgent')
    .map((p) => p.finding[state.variant]!.title);
}

export function gradeRank(grade: Act1Grade): number {
  return GRADE_RANK[grade];
}

/** Pops the next queued story line (VN bubble / phone window). */
export function consumeAct1Line(state: Act1State): {
  state: Act1State;
  lineId: string | null;
} {
  if (state.pendingLines.length === 0) return { state, lineId: null };
  const [lineId, ...rest] = state.pendingLines;
  return { state: { ...state, pendingLines: rest }, lineId };
}
