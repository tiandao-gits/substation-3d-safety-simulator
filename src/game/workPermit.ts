import type { Act1Variant } from './act1';

export type CrewBadgeStatus = 'valid' | 'expired' | 'missing';
export type CrewUniformStatus = 'standard' | 'irregular';
/**
 * 安全帽状态固定为 standard（合格佩戴）。
 * 根据建模约束，人头与安全帽共享网格材质，绝不生成安全帽缺陷。
 */
export type CrewHelmetStatus = 'standard';

export interface CrewWorkerVisualSpec {
  /** 对应 GLB 节点名称：MEMBER_02（工作负责人）或 MEMBER_01.001 ~ MEMBER_01.004（班组成员） */
  nodeName:
    | 'MEMBER_02'
    | 'MEMBER_01.001'
    | 'MEMBER_01.002'
    | 'MEMBER_01.003'
    | 'MEMBER_01.004';
  /** 现场编号：0 为负责人，1~4 为班组作业人员 */
  slotIndex: 0 | 1 | 2 | 3 | 4;
  /** 现场头顶/胸前标识牌编号 */
  tagCode: string;
  name: string;
  empId: string;
  role: string;
  certName: string;
  certNo: string;
  certExpiry: string;
  /** 是否在《工作票》票面登记名单内 */
  listedOnPermit: boolean;
  /** 是否实际出现在 3D 变电站现场 */
  presentOnSite: boolean;
  /** 工作证/特种作业证状态（直接映射到 3D 胸牌颜色与挂牌显隐） */
  badgeStatus: CrewBadgeStatus;
  /** 工作服状态（直接映射到 3D 模型 CLOTH_BLUE.003 材质颜色：标准蓝工装 vs 违规便装） */
  uniformStatus: CrewUniformStatus;
  /** 安全帽状态（始终为 standard，不生成安全帽缺陷） */
  helmetStatus: CrewHelmetStatus;
  /** 3D 站位坐标（Act 2 班前会列队位置，消除原始 GLB .001 与 .002 重叠问题） */
  act2Position: { x: number; y: number; z: number };
  /** 3D 服装主色 Hex */
  uniformColorHex: number;
  /** 3D 胸牌颜色 Hex（null 表示未佩戴胸牌） */
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
  /** 工作票票面记载的总人数（含工作负责人 1 人 + 班组成员 N 人） */
  permitTotalCount: number;
  /** 3D 地图现场实际到场的总人数（含工作负责人 1 人 + 现场可见班组成员 M 人） */
  actualSiteCount: number;
  /** 票面人数与现场实际人数是否一致 */
  headcountMatched: boolean;
  /** 工作负责人（对应 MEMBER_02） */
  leader: CrewWorkerVisualSpec;
  /** 班组成员槽位（对应 MEMBER_01.001 ~ MEMBER_01.004） */
  workers: CrewWorkerVisualSpec[];
  /** 是否存在任何票面/人员资质/着装/人数违章 */
  hasDefect: boolean;
  /** 汇总缺陷描述，供核对面板与遥测读数对齐 */
  overallSummary: string;
  /** 样本标签 */
  scenarioLabel: string;
}

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

/**
 * 第二幕 1# 主变班前会 4 名班组成员的整齐列队坐标（修复原始 GLB 中 .001 与 .002 坐标完全重合的问题）。
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
  MEMBER_02: { x: -18.52, y: 0.2427, z: 17.39 },
  'MEMBER_01.001': { x: -19.93, y: 0.2587, z: 16.48 },
  'MEMBER_01.002': { x: -19.93, y: 0.2587, z: 17.39 },
  'MEMBER_01.003': { x: -19.93, y: 0.2587, z: 18.32 },
  'MEMBER_01.004': { x: -19.93, y: 0.2587, z: 19.22 },
};

export const CREW_COLORS = {
  leaderSuitHex: 0x181a1f,
  standardBlueUniformHex: 0x1d4ed8,
  irregularJacketAmberHex: 0xb45309,
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
 * 根据种子、本幕变体（variant）和演练偏移量（sampleOffset）生成与 3D 现场模型严格对应的《工作票》人员名单。
 *
 * - 当 sampleOffset === 0 时：
 *   - 若 variant === 'D'（第二幕班组资质缺陷变体）：固定生成与主线读数完全兼容的缺陷（3# 焊工证有效期 2025-06 过期 + 2# 人员违规着装/胸牌异常），保证已有单元测试与判级规则 100% 匹配。
 *   - 若 variant !== 'D'：生成票面与 3D 现场完全匹配的合格班组（3 或 4 名班组成员 + 1 名负责人，全员标准蓝工装、胸牌合格、安全帽合格）。
 * - 当 sampleOffset > 0 时（玩家在核对面板点击「随机生成现场人员与缺陷演练」）：
 *   - 随机切换现场实际人数（3~4名组员）与可视化缺陷组合（工作证过期、未挂工作证混入、着非阻燃便装、票面人数与实到人数不符），且安全帽始终保持 standard 合格。
 */
export function generateWorkPermitRoster(
  seed: number,
  variant: Act1Variant,
  sampleOffset = 0
): WorkPermitRoster {
  const combinedSeed = ((seed ^ Math.imul(sampleOffset + 1, 0x9e3779b9)) >>> 0) || 1;
  const rng = mulberry32(combinedSeed);

  const leader: CrewWorkerVisualSpec = {
    nodeName: 'MEMBER_02',
    slotIndex: 0,
    tagCode: '负责人',
    name: '王振',
    empId: 'JX-1008',
    role: '工作负责人 / 检修班长',
    certName: '高压电工作业证 · 签发人复核',
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

  // 选择班组人员姓名池偏移
  const poolStart = sampleOffset === 0 ? 0 : Math.floor(rng() * WORKER_POOL.length);

  // 决定是否为异常样本及异常类型
  const isDefectSample =
    sampleOffset === 0 ? variant === 'D' : sampleOffset % 4 !== 0;

  // 演练模式：
  // mode 0: 全部合格（3人或4人，票面与3D现场人数、胸牌、工装全匹配）
  // mode 1: 资质过期 + 便装违章（3# 焊工证 2025-06 过期红牌 + 2# 穿暗橙便装）
  // mode 2: 现场人数不符（票面登记 3 人，但 3D 现场站了 4 人，4# 人员无工作证且未登记擅自进场）
  // mode 3: 现场缺员 + 工装违章（票面登记 4 人，3D 现场仅到 3 人，且 1# 穿褐色便装、胸牌缺失）
  let defectMode: 0 | 1 | 2 | 3 = 0;
  if (sampleOffset === 0) {
    defectMode = variant === 'D' ? 1 : 0;
  } else if (isDefectSample) {
    defectMode = ((sampleOffset % 3) + 1) as 1 | 2 | 3;
  }

  // 在无缺陷模式下，随机决定现场是 3 名还是 4 名组员（加上负责人共 4 人或 5 人），票面与 3D 现场严格一致
  const normalWorkerCount = sampleOffset === 0 ? 4 : rng() > 0.45 ? 4 : 3;

  const workers: CrewWorkerVisualSpec[] = nodeNames.map((nodeName, idx) => {
    const slotIndex = (idx + 1) as 1 | 2 | 3 | 4;
    const person =
      idx === 2
        ? WORKER_POOL[2] // 3号位保持持证电焊工，确保 3# 焊工证读数一致
        : WORKER_POOL[(poolStart + idx) % WORKER_POOL.length];

    let listedOnPermit = true;
    let presentOnSite = true;
    let badgeStatus: CrewBadgeStatus = 'valid';
    let uniformStatus: CrewUniformStatus = 'standard';
    let certExpiry = ['2027-09', '2027-12', '2027-09', '2028-03'][idx] ?? '2027-09';
    let uniformColorHex: number = CREW_COLORS.standardBlueUniformHex;
    let badgeColorHex: number | null = CREW_COLORS.validBadgeHex;
    let defectSummary: string | null = null;

    if (defectMode === 0) {
      if (slotIndex > normalWorkerCount) {
        listedOnPermit = false;
        presentOnSite = false;
      }
    } else if (defectMode === 1) {
      // 主线变体 D 默认模式：4名组员全在场，3# 焊工证过期 (2025-06 红牌)，2# 违规穿橙褐便装
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
      // 人数不符（私自加人）：工作票仅登记 1#~3#（共4人），但 4# 未登记无证人员穿便装混入 3D 现场（实到5人）
      if (slotIndex === 4) {
        listedOnPermit = false;
        presentOnSite = true;
        badgeStatus = 'missing';
        uniformStatus = 'irregular';
        uniformColorHex = CREW_COLORS.irregularJacketCrimsonHex;
        badgeColorHex = null;
        certExpiry = '无记录';
        defectSummary = '未在《工作票》班组名单内登记、未佩戴工作证、着红色便装擅自进入检修区';
      }
    } else if (defectMode === 3) {
      // 票面4名组员（共5人），现场仅到3名组员（4#未到岗），且 1# 缺失胸牌、2# 穿便装、3# 焊工证超期
      if (slotIndex === 4) {
        listedOnPermit = true;
        presentOnSite = false;
        defectSummary = '工作票已登记但现场未到岗（票面人数与实到人数不符）';
      } else if (slotIndex === 1) {
        badgeStatus = 'missing';
        badgeColorHex = null;
        defectSummary = '现场未佩戴工作证胸牌';
      } else if (slotIndex === 2) {
        uniformStatus = 'irregular';
        uniformColorHex = CREW_COLORS.irregularJacketAmberHex;
        defectSummary = '未穿标准阻燃工作服（着便装）';
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

  const permitWorkersCount = workers.filter((w) => w.listedOnPermit).length;
  const siteWorkersCount = workers.filter((w) => w.presentOnSite).length;
  const permitTotalCount = 1 + permitWorkersCount;
  const actualSiteCount = 1 + siteWorkersCount;
  const headcountMatched =
    permitTotalCount === actualSiteCount &&
    workers.every((w) => w.listedOnPermit === w.presentOnSite);

  const workerDefects = workers
    .filter((w) => w.defectSummary !== null)
    .map((w) => `${w.tagCode}${w.name}：${w.defectSummary}`);

  const hasDefect = !headcountMatched || workerDefects.length > 0;

  let scenarioLabel = '标准合格样本（人证合一 · 着装规范）';
  let overallSummary = `票面登记 ${permitTotalCount} 人（负责人 1 人 + 班组成员 ${permitWorkersCount} 人），3D 现场实到 ${actualSiteCount} 人；全员工作证与特种作业证在有效期内，全员着标准蓝色阻燃工装、规范佩戴安全帽。`;

  if (defectMode === 1) {
    scenarioLabel = '资质超期与着装违章样本';
    overallSummary = `票面与现场均为 ${actualSiteCount} 人；核查发现 #3 ${workers[2].name} 焊工证有效期至 2025-06（胸前红牌告警），#2 ${workers[1].name} 着橙褐色便装未穿阻燃工装；全员安全帽佩戴合格。`;
  } else if (defectMode === 2) {
    scenarioLabel = '未登记人员擅自进场样本（人数不符）';
    overallSummary = `《工作票》登记共 ${permitTotalCount} 人，但 3D 现场实到 ${actualSiteCount} 人！#4 ${workers[3].name} 未在工作票登记、未挂工作证且着红色便装混入检修列队；全员安全帽佩戴合格。`;
  } else if (defectMode === 3) {
    scenarioLabel = '票面人数不符与多重违章样本';
    overallSummary = `《工作票》登记共 ${permitTotalCount} 人，3D 现场实到 ${actualSiteCount} 人（#4 未到岗）；且 #1 未挂工作证、#2 着便装、#3 焊工证过期；全员安全帽佩戴合格。`;
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
    leader,
    workers,
    hasDefect,
    overallSummary,
    scenarioLabel,
  };
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
