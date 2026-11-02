import type { Act1Variant } from './act1';

export type CrewBadgeStatus = 'valid' | 'expired' | 'missing';
export type CrewUniformStatus = 'standard' | 'irregular';
/**
 * 安全帽状态固定为 standard（合格佩戴）。
 * 根据建模约束，人头与安全帽共享网格材质，绝不生成安全帽缺陷。
 */
export type CrewHelmetStatus = 'standard';

export type CrewNodeName =
  | 'MEMBER_02'
  | 'MEMBER_01.001'
  | 'MEMBER_01.002'
  | 'MEMBER_01.003'
  | 'MEMBER_01.004'
  | 'MEMBER_01.005';

export interface CrewWorkerVisualSpec {
  /** 逻辑槽位标识 */
  nodeName: CrewNodeName;
  /** 现场编号：0 为负责人，1~5 为班组作业人员 */
  slotIndex: 0 | 1 | 2 | 3 | 4 | 5;
  /** 现场头顶编号标识（仅显示编号与姓名，绝不剧透缺陷状态） */
  tagCode: string;
  name: string;
  empId: string;
  role: string;
  certName: string;
  certNo: string;
  certExpiry: string;
  /** 是否在《工作票》票面登记名单内 */
  listedOnPermit: boolean;
  /** 是否实际生成并出现在 3D 变电站现场 */
  presentOnSite: boolean;
  /** 工作证/特种作业证状态（映射到 3D 胸牌颜色与挂牌显隐） */
  badgeStatus: CrewBadgeStatus;
  /** 工作服状态（映射到 3D 模型服装材质颜色与反光条显隐） */
  uniformStatus: CrewUniformStatus;
  /** 安全帽状态（始终为 standard，不生成安全帽缺陷） */
  helmetStatus: CrewHelmetStatus;
  /** 3D 站位坐标（Act 2 班前会列队位置，等距一字排开面向东侧相机） */
  act2Position: { x: number; y: number; z: number };
  /** 3D 服装主色 Hex */
  uniformColorHex: number;
  /** 3D 胸牌颜色 Hex（null 表示胸前未挂工作证） */
  badgeColorHex: number | null;
  /** 该人员存在的具体违章/缺陷说明（无缺陷为 null） */
  defectSummary: string | null;
}

export interface WorkPermitRoster {
  permitNo: string;
  workUnit: string;
  workLocation: string;
  workContent: string;
  plannedStart: string;
  plannedEnd: string;
  /** 工作票票面记载的总人数（含工作负责人 1 人 + 票面登记班组成员 N 人） */
  permitTotalCount: number;
  /** 3D 地图现场实际生成的总人数（含工作负责人 1 人 + 现场实到班组成员 M 人） */
  actualSiteCount: number;
  /** 票面人数与现场实际人数是否一致 */
  headcountMatched: boolean;
  /** 现场是否存在任何胸牌过期或无证人员 */
  hasBadgeDefect: boolean;
  /** 现场是否存在任何违规便装人员 */
  hasUniformDefect: boolean;
  /** 工作负责人 */
  leader: CrewWorkerVisualSpec;
  /** 班组成员槽位 */
  workers: CrewWorkerVisualSpec[];
  /** 当前实际站在 3D 现场的所有人员（按从北向南列队顺序排列，供 3D 生成与镜头对焦使用） */
  sceneWorkers: CrewWorkerVisualSpec[];
  /** 是否存在任何票面/人员资质/着装/人数违章 */
  hasDefect: boolean;
  /** 核对完成后的汇总描述 */
  overallSummary: string;
}

/**
 * 玩家通过目视观察 3D 现场人物模型后，在《工作票》核对表上填写的四项检查结论。
 */
export interface WorkPermitPlayerJudgment {
  /** 玩家清点的 3D 现场实到总人数（含负责人） */
  countedSiteTotal: number | null;
  /** 实到人数与工作票票面登记人数是否相符 */
  headcountVerdict: 'matched' | 'mismatched' | null;
  /** 胸前工作证 / 特种作业证目视核查结论 */
  badgeVerdict: 'all_valid' | 'has_invalid' | null;
  /** 阻燃工作服目视核查结论 */
  uniformVerdict: 'all_standard' | 'has_irregular' | null;
  /** 安全帽规范佩戴目视核查结论 */
  helmetVerdict: 'all_standard' | 'has_defect' | null;
}

export interface WorkPermitEvaluationResult {
  complete: boolean;
  accurate: boolean;
  mismatches: string[];
}

/**
 * 默认 5 人（负责人 + 4 名组员）在 1# 主变东侧班前会列队基准坐标。
 * 全员统一站在 x = -19.88 一字排开面向东侧（+X），间距 0.78m，彻底消除原始 GLB 坐标重叠与遮挡。
 */
export const ACT2_CREW_LINEUP_POSITIONS: Readonly<
  Record<
    | 'MEMBER_02'
    | 'MEMBER_01.001'
    | 'MEMBER_01.002'
    | 'MEMBER_01.003'
    | 'MEMBER_01.004',
    { x: number; y: number; z: number }
  >
> = {
  MEMBER_02: { x: -19.88, y: 0.2587, z: 16.74 },
  'MEMBER_01.001': { x: -19.88, y: 0.2587, z: 17.52 },
  'MEMBER_01.002': { x: -19.88, y: 0.2587, z: 18.3 },
  'MEMBER_01.003': { x: -19.88, y: 0.2587, z: 19.08 },
  'MEMBER_01.004': { x: -19.88, y: 0.2587, z: 19.86 },
};

export const CREW_COLORS = {
  leaderSuitHex: 0x1e293b,
  standardBlueUniformHex: 0x1d4ed8,
  irregularJacketAmberHex: 0xc2410c,
  irregularJacketCrimsonHex: 0x991b1b,
  validBadgeHex: 0x10b981,
  expiredBadgeHex: 0xef4444,
} as const;

const WORKER_POOL = [
  {
    name: '陈建国',
    empId: 'JX-2041',
    role: '主变检修工',
    certName: '高压电工作业证',
    certNo: 'T320102-8812',
  },
  {
    name: '刘志强',
    empId: 'JX-2056',
    role: '高压试验工',
    certName: '高压电工作业证',
    certNo: 'T320102-8904',
  },
  {
    name: '周大勇',
    empId: 'JX-2083',
    role: '持证电焊工',
    certName: '熔化焊接与热切割作业证',
    certNo: 'T320106-4419',
  },
  {
    name: '赵海峰',
    empId: 'JX-2097',
    role: '起重司索工',
    certName: '特种设备司索作业证',
    certNo: 'Q320111-6205',
  },
  {
    name: '孙立群',
    empId: 'JX-2110',
    role: '油务化验工',
    certName: '高压电工作业证',
    certNo: 'T320102-9132',
  },
  {
    name: '吴少华',
    empId: 'JX-2128',
    role: '辅工/搬运工',
    certName: '高压电工作业证',
    certNo: 'T320102-9308',
  },
] as const;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 为实际到场的 N 名工作人员分配整齐的一字列队坐标（以 z = 18.3 为中心，间距 0.78m）。
 */
export function computeLineupPosition(
  indexInScene: number,
  totalPresent: number
): { x: number; y: number; z: number } {
  const spacing = 0.78;
  const centerZ = 18.3;
  const startZ = centerZ - ((totalPresent - 1) * spacing) / 2;
  return {
    x: -19.88,
    y: 0.2587,
    z: Number((startZ + indexInScene * spacing).toFixed(4)),
  };
}

/**
 * 根据种子（seed）与本幕变体（variant）动态生成《工作票》票面名单及对应的 3D 现场人员模型配置。
 *
 * - 当 variant !== 'D'（正常合格班组）：
 *   - 根据 seed 动态生成 4 人（负责人 + 3 组员）或 5 人（负责人 + 4 组员），票面登记人数与 3D 现场实到模型数量完全一致；
 *   - 全员穿蓝色阻燃工作服（带反光条）、胸前佩戴绿色有效工作证、头戴标准安全帽。
 * - 当 variant === 'D'（班组资质与现场违章变体）：
 *   - #3 周大勇（持证电焊工）胸前工作证有效期为 2025-06（红色超期胸牌）；
 *   - #2 组员穿暗橙色便装（无阻燃反光条）；
 *   - 根据 seed 子模式，还可能伴随现场实到人数与票面不符（例如未登记人员无证穿便装混入列队，或已登记人员未到岗）。
 * - 安全帽在任何种子和变体下始终为 standard（合格佩戴）。
 */
export function generateWorkPermitRoster(
  seed: number,
  variant: Act1Variant,
  sampleOffset = 0
): WorkPermitRoster {
  const combinedSeed =
    ((seed ^ Math.imul(sampleOffset + 1, 0x9e3779b9)) >>> 0) || 1;
  const rng = mulberry32(combinedSeed);

  const leader: CrewWorkerVisualSpec = {
    nodeName: 'MEMBER_02',
    slotIndex: 0,
    tagCode: '负责人',
    name: '王振',
    empId: 'JX-1008',
    role: '工作负责人 / 检修班长',
    certName: '高压电工作业证',
    certNo: 'T320101-1008',
    certExpiry: '2027-11',
    listedOnPermit: true,
    presentOnSite: true,
    badgeStatus: 'valid',
    uniformStatus: 'standard',
    helmetStatus: 'standard',
    act2Position: ACT2_CREW_LINEUP_POSITIONS.MEMBER_02,
    uniformColorHex: CREW_COLORS.leaderSuitHex,
    badgeColorHex: CREW_COLORS.validBadgeHex,
    defectSummary: null,
  };

  const nodeNames: Array<
    'MEMBER_01.001' | 'MEMBER_01.002' | 'MEMBER_01.003' | 'MEMBER_01.004'
  > = ['MEMBER_01.001', 'MEMBER_01.002', 'MEMBER_01.003', 'MEMBER_01.004'];

  const poolStart =
    sampleOffset === 0 && seed === 1024
      ? 0
      : Math.floor(rng() * WORKER_POOL.length);

  const isDefectSample =
    sampleOffset === 0 ? variant === 'D' : sampleOffset % 4 !== 0;

  // 违章子模式：
  // mode 0: 全员合格（票面与 3D 现场人数一致，可为 4 人或 5 人）
  // mode 1: 票面与现场均 5 人，#3 焊工证 2025-06 超期红牌 + #2 穿橙褐便装
  // mode 2: 人数不符（私自加人）：票面仅登记负责人 + #1~#3（共 4 人），但 3D 现场站了 5 人（#4 未登记且无胸牌、穿红便装）+ #3 焊工证超期
  // mode 3: 人数不符（现场缺员）：票面登记负责人 + #1~#4（共 5 人），但 3D 现场仅站 4 人（#4 未到岗）+ #2 穿便装 + #3 焊工证超期
  let defectMode: 0 | 1 | 2 | 3 = 0;
  if (!isDefectSample) {
    defectMode = 0;
  } else if (sampleOffset > 0) {
    defectMode = ((sampleOffset % 3) + 1) as 1 | 2 | 3;
  } else if (seed === 1024) {
    defectMode = 1;
  } else {
    const sub = Math.abs(seed) % 3;
    defectMode = (sub === 0 ? 1 : sub === 1 ? 2 : 3) as 1 | 2 | 3;
  }

  const nonWelderPool = [
    WORKER_POOL[0],
    WORKER_POOL[1],
    WORKER_POOL[3],
    WORKER_POOL[4],
    WORKER_POOL[5],
  ];

  // 在无缺陷模式下，根据种子动态决定本局是 3 名组员（共 4 人）还是 4 名组员（共 5 人）
  const normalWorkerCount =
    sampleOffset === 0 && seed === 1024 ? 4 : rng() > 0.42 ? 4 : 3;

  const workers: CrewWorkerVisualSpec[] = nodeNames.map((nodeName, idx) => {
    const slotIndex = (idx + 1) as 1 | 2 | 3 | 4;
    const person =
      idx === 2
        ? WORKER_POOL[2] // 3号位保持持证电焊工周大勇，确保主线焊工证台账一致
        : nonWelderPool[(poolStart + idx) % nonWelderPool.length];

    let listedOnPermit = true;
    let presentOnSite = true;
    let badgeStatus: CrewBadgeStatus = 'valid';
    let uniformStatus: CrewUniformStatus = 'standard';
    let certExpiry =
      ['2027-09', '2027-12', '2027-09', '2028-03'][idx] ?? '2027-09';
    let uniformColorHex: number = CREW_COLORS.standardBlueUniformHex;
    let badgeColorHex: number | null = CREW_COLORS.validBadgeHex;
    let defectSummary: string | null = null;

    if (defectMode === 0) {
      if (slotIndex > normalWorkerCount) {
        listedOnPermit = false;
        presentOnSite = false;
      }
    } else if (defectMode === 1) {
      if (slotIndex === 3) {
        certExpiry = '2025-06';
        badgeStatus = 'expired';
        badgeColorHex = CREW_COLORS.expiredBadgeHex;
        defectSummary = '特种作业操作证（焊工证）有效期至 2025-06，已超期未复审';
      } else if (slotIndex === 2) {
        uniformStatus = 'irregular';
        uniformColorHex = CREW_COLORS.irregularJacketAmberHex;
        defectSummary = '未穿蓝色阻燃检修服（着橙褐色便装进场）';
      }
    } else if (defectMode === 2) {
      if (slotIndex === 3) {
        certExpiry = '2025-06';
        badgeStatus = 'expired';
        badgeColorHex = CREW_COLORS.expiredBadgeHex;
        defectSummary = '特种作业操作证（焊工证）有效期至 2025-06，已超期未复审';
      } else if (slotIndex === 4) {
        listedOnPermit = false;
        presentOnSite = true;
        badgeStatus = 'missing';
        uniformStatus = 'irregular';
        uniformColorHex = CREW_COLORS.irregularJacketCrimsonHex;
        badgeColorHex = null;
        certExpiry = '无记录';
        defectSummary =
          '未在《工作票》班组名单登记、胸前未佩戴工作证、着暗红便装混入检修列队';
      }
    } else if (defectMode === 3) {
      if (slotIndex === 4) {
        listedOnPermit = true;
        presentOnSite = false;
        defectSummary = '工作票已登记但现场未到岗（实到人数少于票面人数）';
      } else if (slotIndex === 2) {
        uniformStatus = 'irregular';
        uniformColorHex = CREW_COLORS.irregularJacketAmberHex;
        defectSummary = '未穿标准蓝色阻燃工作服（着便装）';
      } else if (slotIndex === 3) {
        certExpiry = '2025-06';
        badgeStatus = 'expired';
        badgeColorHex = CREW_COLORS.expiredBadgeHex;
        defectSummary = '焊工特种作业证（2025-06）超期未复审';
      }
    }

    return {
      nodeName,
      slotIndex,
      tagCode: `#${slotIndex}`,
      name: person.name,
      empId: person.empId,
      role: person.role,
      certName: person.certName,
      certNo: person.certNo,
      certExpiry,
      listedOnPermit,
      presentOnSite,
      badgeStatus,
      uniformStatus,
      helmetStatus: 'standard',
      act2Position: ACT2_CREW_LINEUP_POSITIONS[nodeName],
      uniformColorHex,
      badgeColorHex,
      defectSummary,
    };
  });

  // 为所有实际到场的 3D 人员重新计算居中整齐列队坐标與现场顺序编号
  const presentList = [leader, ...workers.filter((w) => w.presentOnSite)];
  const sceneWorkers: CrewWorkerVisualSpec[] = presentList.map((spec, idx) => {
    const pos = computeLineupPosition(idx, presentList.length);
    spec.act2Position = pos;
    return spec;
  });

  const permitWorkersCount = workers.filter((w) => w.listedOnPermit).length;
  const siteWorkersCount = workers.filter((w) => w.presentOnSite).length;
  const permitTotalCount = 1 + permitWorkersCount;
  const actualSiteCount = 1 + siteWorkersCount;
  const headcountMatched =
    permitTotalCount === actualSiteCount &&
    workers.every((w) => w.listedOnPermit === w.presentOnSite);

  const hasBadgeDefect = sceneWorkers.some((w) => w.badgeStatus !== 'valid');
  const hasUniformDefect = sceneWorkers.some(
    (w) => w.uniformStatus !== 'standard'
  );

  const workerDefects = workers
    .filter((w) => w.defectSummary !== null)
    .map((w) => `${w.tagCode}${w.name}：${w.defectSummary}`);

  const hasDefect =
    !headcountMatched ||
    hasBadgeDefect ||
    hasUniformDefect ||
    workerDefects.length > 0;

  let overallSummary = `票面登记 ${permitTotalCount} 人，3D 现场实到 ${actualSiteCount} 人（人票相符）；全员工作证在有效期内，全员着蓝色标准阻燃工装、规范佩戴安全帽。`;
  if (hasDefect) {
    overallSummary = `票面登记 ${permitTotalCount} 人，3D 现场实到 ${actualSiteCount} 人（${
      headcountMatched ? '人数相符' : '人数不符'
    }）；现场检出：${workerDefects.join('；')}。`;
  }

  return {
    permitNo: `BDZ1-2026-0815-${String((combinedSeed % 89) + 10).padStart(2, '0')}`,
    workUnit: '盛达电力工程有限公司 · 变电检修一班',
    workLocation: '220kV 1# 主变间隔本体及散热器检修区',
    workContent: '1# 主变停电清扫、散热器蝶阀渗油消缺及铁芯接地复测',
    plannedStart: '2026-08-15 09:30',
    plannedEnd: '2026-08-15 17:30',
    permitTotalCount,
    actualSiteCount,
    headcountMatched,
    hasBadgeDefect,
    hasUniformDefect,
    leader,
    workers,
    sceneWorkers,
    hasDefect,
    overallSummary,
  };
}

export function createInitialPermitJudgment(): WorkPermitPlayerJudgment {
  return {
    countedSiteTotal: null,
    headcountVerdict: null,
    badgeVerdict: null,
    uniformVerdict: null,
    helmetVerdict: null,
  };
}

/**
 * 校验玩家在《工作票》现场核对单中填写的目视核查结论是否与 3D 场景中的真实人物模型一致。
 */
export function evaluateWorkPermitJudgment(
  roster: WorkPermitRoster,
  judgment: WorkPermitPlayerJudgment
): WorkPermitEvaluationResult {
  if (
    judgment.countedSiteTotal === null ||
    judgment.headcountVerdict === null ||
    judgment.badgeVerdict === null ||
    judgment.uniformVerdict === null ||
    judgment.helmetVerdict === null
  ) {
    return {
      complete: false,
      accurate: false,
      mismatches: ['请先完成全部目视核对项的选择。'],
    };
  }

  const mismatches: string[] = [];

  if (judgment.countedSiteTotal !== roster.actualSiteCount) {
    mismatches.push(
      `现场实到人数清点有误：请切换左侧【全景列队】镜头，重新清点 3D 场景中站立的工作人员总数（含负责人）。`
    );
  }

  const expectedHeadcountVerdict = roster.headcountMatched
    ? 'matched'
    : 'mismatched';
  if (judgment.headcountVerdict !== expectedHeadcountVerdict) {
    mismatches.push(
      `票面与实到人数比对有误：请对照《工作票》票面登记总人数（${roster.permitTotalCount} 人）与 3D 现场实际到场人数。`
    );
  }

  const expectedBadgeVerdict = roster.hasBadgeDefect
    ? 'has_invalid'
    : 'all_valid';
  if (judgment.badgeVerdict !== expectedBadgeVerdict) {
    mismatches.push(
      `工作证有效性核对有误：请点击镜头逐一对准现场人员胸前挂牌，核查是否存在红牌超期（2025-06）或胸前未挂牌人员。`
    );
  }

  const expectedUniformVerdict = roster.hasUniformDefect
    ? 'has_irregular'
    : 'all_standard';
  if (judgment.uniformVerdict !== expectedUniformVerdict) {
    mismatches.push(
      `工作服着装核对有误：请观察 3D 现场队列中全员是否均穿蓝色阻燃工装（带银色反光条），有无穿便装人员。`
    );
  }

  if (judgment.helmetVerdict !== 'all_standard') {
    mismatches.push(
      `安全帽佩戴核对有误：请观察 3D 现场队列，当前在场人员均已规范佩戴安全帽。`
    );
  }

  return {
    complete: true,
    accurate: mismatches.length === 0,
    mismatches,
  };
}

// 兼容旧测试导出的辅助函数
export interface WorkerCheckRecord {
  badgeChecked: boolean;
  uniformChecked: boolean;
  helmetChecked: boolean;
  flaggedAnomaly: boolean;
}

export interface WorkPermitVerificationState {
  headcountChecked: boolean;
  workers: Record<string, WorkerCheckRecord>;
}

export function createInitialPermitVerification(
  roster: WorkPermitRoster
): WorkPermitVerificationState {
  const workers: Record<string, WorkerCheckRecord> = {
    [roster.leader.nodeName]: {
      badgeChecked: false,
      uniformChecked: false,
      helmetChecked: false,
      flaggedAnomaly: false,
    },
  };
  for (const w of roster.workers) {
    if (w.listedOnPermit || w.presentOnSite) {
      workers[w.nodeName] = {
        badgeChecked: false,
        uniformChecked: false,
        helmetChecked: false,
        flaggedAnomaly: false,
      };
    }
  }
  return {
    headcountChecked: false,
    workers,
  };
}

let activeRosterState: WorkPermitRoster = generateWorkPermitRoster(1024, 'A');
let focusedCrewSlotState: number | null = null;
const focusListeners = new Set<() => void>();

export function getActiveWorkPermitRoster(): WorkPermitRoster {
  return activeRosterState;
}

export function setActiveWorkPermitRoster(roster: WorkPermitRoster): void {
  activeRosterState = roster;
  if (
    focusedCrewSlotState !== null &&
    focusedCrewSlotState >= roster.sceneWorkers.length
  ) {
    focusedCrewSlotState = null;
  }
  for (const fn of focusListeners) fn();
}

export function getFocusedCrewSlot(): number | null {
  return focusedCrewSlotState;
}

export function setFocusedCrewSlot(slotIndexInScene: number | null): void {
  focusedCrewSlotState = slotIndexInScene;
  for (const fn of focusListeners) fn();
}

export function subscribeCrewFocus(listener: () => void): () => void {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}

