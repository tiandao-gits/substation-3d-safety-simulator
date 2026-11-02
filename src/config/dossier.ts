/**
 * 备忘录（E）的静态资料：设备台账、安规条例、班前会清单口径、玩法说明。
 *
 * 边界：
 * - 这里只放"本幕现场本来就能查到的资料"，不放剧情与对白（dialogues.ts）；
 * - 不放仪器名称（contentAudit 的硬规则：任务卡 / HUD / 对话不得提示用哪件工具）；
 * - 条例为教学要点摘录与归纳，正式判定以现行标准原文为准。
 */

import type { Act1PointId, ActNo } from '../game/act1';
import type { CrewViolationKind } from '../game/workPermit';

export type DossierAssetKind = 'equipment' | 'personnel' | 'site';

export interface DossierAssetSpec {
  label: string;
  value: string;
}

/** 设备 / 人员 / 场地共用的台账条目。 */
export interface DossierAsset {
  id: string;
  kind: DossierAssetKind;
  /** 名称（台账主标题）。 */
  name: string;
  /** 型号、编号或岗位标识，等宽字体显示。 */
  code: string;
  /** 一句话说明"这是什么"。 */
  summary: string;
  /** 台账字段。 */
  specs: DossierAssetSpec[];
  /** 与本幕的关系、核对要点。 */
  note: string;
  /** 关联的检查点；空数组表示只作背景资料。 */
  points: Act1PointId[];
}

export interface DossierRegulation {
  id: string;
  /** 分组标题，仅用于分节展示。 */
  group: string;
  /** 引用出处：标准号 + 条款主题。 */
  citation: string;
  title: string;
  /** 条文要点摘录。 */
  clause: string;
  /** 条文背后的机理与读法，说明数字为什么是这个数。 */
  interpretation: string;
  /** 在本幕现场的适用说明。 */
  application: string;
  points: Act1PointId[];
}

export interface ActDossierLedger {
  equipment: DossierAsset[];
  personnel: DossierAsset[];
  sites: DossierAsset[];
}

export const ASSET_KIND_LABELS: Record<DossierAssetKind, string> = {
  equipment: '设备',
  personnel: '人员',
  site: '场地',
};

/* ------------------------------------------------------------------ */
/* 设备台账                                                            */
/* ------------------------------------------------------------------ */

const ACT1_LEDGER: ActDossierLedger = {
  equipment: [
    {
      id: 'eq-10kv-cubicles',
      kind: 'equipment',
      name: '10kV 开关柜柜列',
      code: '10kV · 公寓一层配电室',
      summary:
        '金属铠装移开式开关柜柜列，柜列带电运行，柜内母排接头封闭在柜内。',
      specs: [
        { label: '额定电压', value: '10 kV' },
        { label: '运行状态', value: '带电运行' },
        { label: '柜体形式', value: '金属铠装移开式' },
        { label: '柜前设施', value: '绝缘垫 · 柜号标识' },
      ],
      note: '柜内测温由运维人员开启测温窗配合，监理不自行开启带电柜门。',
      points: ['hv-10kv'],
    },
    {
      id: 'eq-f02-ds',
      kind: 'equipment',
      name: 'F02 间隔隔离开关',
      code: '220kV · F02',
      summary:
        '双柱水平旋转式隔离开关，动静触头与引线接头是本幕的测温对象。',
      specs: [
        { label: '额定电流', value: '3150 A' },
        { label: '触头', value: '镀银' },
        { label: '运行状态', value: '带电运行' },
        { label: '间隔编号', value: '前侧 F01–F03' },
      ],
      note: '站在黄黑警戒线外巡视，与带电体保持 3.0 m 以上。',
      points: ['bay-temp'],
    },
    {
      id: 'eq-ct',
      kind: 'equipment',
      name: '220kV 电流互感器',
      code: '220kV · 2×1250/1 A',
      summary: 'F02 间隔电流互感器，一次引线为铝绞线，与隔离开关同属一个导流回路。',
      specs: [
        { label: '变比', value: '2×1250/1 A' },
        { label: '一次引线', value: '铝绞线' },
        { label: '安装位置', value: 'F02 间隔构架' },
        { label: '运行状态', value: '带电运行' },
      ],
      note: '引线接头与触头温升需一起比对，单看一个测点无法判断回路状态。',
      points: ['bay-temp'],
    },
  ],
  personnel: [
    {
      id: 'ps-luchuan',
      kind: 'personnel',
      name: '陆川',
      code: '监理项目部 · 安全监理',
      summary:
        '专业监理工程师（分管安全），本幕负责外观巡视、仪器初筛、记录与通知运维。',
      specs: [
        { label: '隶属', value: '监理项目部' },
        { label: '本幕职责', value: '巡视与初筛' },
        { label: '处置权限', value: '记录 · 通知运维' },
        { label: '记录载体', value: '监理日志' },
      ],
      note: '安全监理不对运行设备做诊断性试验，也不向运行设备下达停运指令。',
      points: ['hv-10kv', 'aisle', 'bay-temp'],
    },
    {
      id: 'ps-ma',
      kind: 'personnel',
      name: '马工',
      code: '运维单位 · 值班人员',
      summary: '当日运维值班人员，陪同巡视并提供设备运行方式与负荷信息。',
      specs: [
        { label: '隶属', value: '运维单位' },
        { label: '本幕配合', value: '开柜测温窗 · 提供负荷' },
        { label: '掌握信息', value: '设备运行方式' },
        { label: '记录', value: '巡检台账' },
      ],
      note: '监理发现异常后通知运维复核，缺陷定性与处理由运维单位负责。',
      points: ['hv-10kv', 'bay-temp'],
    },
    {
      id: 'ps-chen',
      kind: 'personnel',
      name: '陈立群',
      code: '监理项目部 · 主任',
      summary: '本日派工与收口要求的提出人：发现什么，记什么。',
      specs: [
        { label: '隶属', value: '监理项目部' },
        { label: '本幕出场', value: '序章派工' },
        { label: '要求', value: '记录不得漏项' },
        { label: '覆盖范围', value: '本日三幕' },
      ],
      note: '序章确定的本日收口策略，对后续三幕的处置尺度都有效。',
      points: [],
    },
  ],
  sites: [
    {
      id: 'site-10kv-room',
      kind: 'site',
      name: '公寓一层 10kV 配电室',
      code: '室内 · 10kV',
      summary: '公寓一层配电室，柜列带电运行，进入前需确认照明与门禁。',
      specs: [
        { label: '位置', value: '公寓一层' },
        { label: '环境', value: '室内 · 照明与门禁' },
        { label: '通行', value: '柜前绝缘垫' },
        { label: '安全距离', value: '与柜体 ≥0.7 m' },
      ],
      note: '禁止自行开启带电柜门，柜内检查由运维配合完成。',
      points: ['hv-10kv'],
    },
    {
      id: 'site-front-yard',
      kind: 'site',
      name: '前侧 220kV 开关设备区',
      code: '户外 · F01–F03',
      summary: '户外敞开式开关设备区，F01–F03 间隔带电运行，四周设黄黑警戒线。',
      specs: [
        { label: '电压等级', value: '220kV' },
        { label: '间隔', value: 'F01–F03' },
        { label: '状态', value: '带电运行' },
        { label: '警戒', value: '黄黑警戒线' },
      ],
      note: '巡视不得移开或越过遮栏，与带电体保持 3.0 m 以上。',
      points: ['bay-temp'],
    },
    {
      id: 'site-aisle',
      kind: 'site',
      name: '站区中部 巡视通道',
      code: '户外 · 连接前后间隔区',
      summary: '连接前后两片间隔区的巡视与应急疏散通道，设计净宽 1.00 m。',
      specs: [
        { label: '设计净宽', value: '1.00 m' },
        { label: '规范区间', value: '0.7~1.0 m' },
        { label: '沿线单位', value: '北侧扩建施工单位' },
        { label: '用途', value: '巡视 · 应急疏散' },
      ],
      note: '通道一旦被材料挤占，巡视与应急疏散都会受影响；清理责任在占用材料的施工单位。',
      points: ['aisle'],
    },
  ],
};

const ACT2_LEDGER: ActDossierLedger = {
  equipment: [
    {
      id: 'eq-t1',
      kind: 'equipment',
      name: '1# 主变',
      code: 'SFZ11-120000/220',
      summary: '油浸式主变压器，本幕停电检修，本体、散热器与油枕为检查对象。',
      specs: [
        { label: '额定容量', value: '120 MVA' },
        { label: '电压比', value: '220/110/10 kV' },
        { label: '冷却方式', value: 'ONAN/ONAF' },
        { label: '运行状态', value: '停电检修' },
      ],
      note: '上次巡视：顶层油温 64.2 ℃，油位在正常刻度，本体与法兰无渗漏。',
      points: ['a2-oil'],
    },
    {
      id: 'eq-t2',
      kind: 'equipment',
      name: '2# 主变',
      code: '邻近运行设备',
      summary: '与 1# 主变一墙之隔，本幕运行带负荷。',
      specs: [
        { label: '运行状态', value: '带电运行' },
        { label: '与检修区', value: '防火墙分隔' },
        { label: '围栏外', value: '带电通道' },
        { label: '通行', value: '禁止跨越' },
      ],
      note: '工器具与材料不得越过防火墙，检修作业不得进入 2# 主变侧。',
      points: ['a2-wall', 'a2-oil'],
    },
    {
      id: 'eq-firewall',
      kind: 'equipment',
      name: '主变防火墙',
      code: '1# / 2# 主变之间',
      summary: '1# 与 2# 主变之间的防火分隔墙，靠东段抹面局部受潮。',
      specs: [
        { label: '结构', value: '钢筋混凝土防火墙' },
        { label: '抹灰层', value: '局部受潮 · 疑似空鼓' },
        { label: '功能', value: '防火分隔' },
        { label: '检查方式', value: '敲击 + 裂缝观测' },
      ],
      note: '防火墙不得随意开孔或削弱墙体；空鼓应划定范围并凿除重做。',
      points: ['a2-wall'],
    },
    {
      id: 'eq-cooler',
      kind: 'equipment',
      name: '1# 主变散热器与油枕',
      code: '本体附件',
      summary: '散热器、储油柜（油枕）与呼吸器，直接反映油位与油温状态。',
      specs: [
        { label: '油位计', value: '正常刻度' },
        { label: '呼吸器', value: '硅胶颜色待核' },
        { label: '散热器阀门', value: '与记录一致' },
        { label: '渗漏', value: '本体与法兰无渗漏' },
      ],
      note: '背光侧法兰需照亮后观察油迹，正面视角容易漏判渗漏。',
      points: ['a2-oil'],
    },
    {
      id: 'eq-grounding',
      kind: 'equipment',
      name: '主变接地装置',
      code: '接地引下线',
      summary: '主变本体接地引下线与主接地网连接，检修前复核接地可靠性。',
      specs: [
        { label: '连接方式', value: '接地引下线' },
        { label: '螺栓力矩', value: '42 N·m' },
        { label: '设计值', value: '≥40 N·m' },
        { label: '接地点', value: '本体底部' },
      ],
      note: '接地螺栓松动会导致接地电阻超标，力矩按设计值复核而不是凭手感。',
      points: ['a2-oil'],
    },
  ],
  personnel: [
    {
      id: 'ps-wang',
      kind: 'personnel',
      name: '王振',
      code: '工作负责人 · 检修班长',
      summary: '本幕工作票上的工作负责人，主持班前会并组织检修作业。',
      specs: [
        { label: '票面角色', value: '工作负责人' },
        { label: '本幕职责', value: '交底 · 组织开工' },
        { label: '作业证', value: '高压电工作业证' },
        { label: '有效期', value: '2027-11' },
      ],
      note: '工作负责人对现场作业组织与安全措施落实负直接责任。',
      points: ['a2-crew'],
    },
    {
      id: 'ps-zhao',
      kind: 'personnel',
      name: '赵志远',
      code: '专责监护人',
      summary: '本幕专责监护人，同时保管班前会交底记录与工作票台账。',
      specs: [
        { label: '本幕职责', value: '现场监护' },
        { label: '兼管', value: '交底记录 · 台账' },
        { label: '作业证', value: '高压电工作业证' },
        { label: '监护要求', value: '作业期间不得离场' },
      ],
      note: '监护人不得兼做其他工作；本幕他同时保管台账，需注意是否影响监护。',
      points: ['a2-crew'],
    },
    {
      id: 'ps-crew',
      kind: 'personnel',
      name: '检修班组作业人员',
      code: '4~5 人 · 按票面名单',
      summary: '按工作票名单进场的检修班组，工种与持证要求各不相同。',
      specs: [
        { label: '工种', value: '检修 / 试验 / 焊接 / 司索 / 油务' },
        { label: '资格', value: '特种作业操作证' },
        { label: '核对项', value: '证件有效期 · 安全帽 · 实到人数' },
        { label: '记录', value: '处置单名册逐人签注' },
      ],
      note: '名单随工作票生成，逐人核验结论在班前会名册中签注后归档。',
      points: ['a2-crew'],
    },
    {
      id: 'ps-luchuan-2',
      kind: 'personnel',
      name: '陆川',
      code: '监理项目部 · 安全监理',
      summary: '本幕负责班前会名册核验、现场检查与处置定级。',
      specs: [
        { label: '隶属', value: '监理项目部' },
        { label: '本幕职责', value: '核验 · 检查 · 定级' },
        { label: '处置手段', value: '整改 / 暂停 / 报告' },
        { label: '记录', value: '监理日志 · 工作票签注' },
      ],
      note: '监理只核对资格与记录，不替代施工单位日常管理。',
      points: ['a2-crew', 'a2-wall', 'a2-oil'],
    },
  ],
  sites: [
    {
      id: 'site-t1-area',
      kind: 'site',
      name: '1# 主变检修区',
      code: '户外 · 主变区',
      summary: '1# 主变停电检修作业面，围栏、接地线与标示牌已按工作票布置。',
      specs: [
        { label: '状态', value: '停电检修' },
        { label: '安全措施', value: '停电 · 验电 · 接地 · 围栏' },
        { label: '入口', value: '围栏唯一出入口' },
        { label: '地面', value: '防油围堰' },
      ],
      note: '围栏、接地线、监护人三样到位后方可开工。',
      points: ['a2-crew', 'a2-wall', 'a2-oil'],
    },
    {
      id: 'site-t2-area',
      kind: 'site',
      name: '防火墙北侧 · 2# 主变运行区',
      code: '户外 · 带电',
      summary: '防火墙北侧的运行设备区，本幕 2# 主变带负荷运行。',
      specs: [
        { label: '状态', value: '带电运行' },
        { label: '隔离', value: '防火墙 + 围栏' },
        { label: '通行', value: '禁止跨越' },
        { label: '风险', value: '安全距离 · 感应电' },
      ],
      note: '围栏外即为带电通道，任何跨越都属于违章。',
      points: ['a2-wall'],
    },
    {
      id: 'site-t1-passage',
      kind: 'site',
      name: '主变区检修通道',
      code: '户外 · 运输与疏散',
      summary: '主变区内的检修运输与应急疏散通道，本幕需保持畅通。',
      specs: [
        { label: '通行', value: '检修人员与工器具' },
        { label: '要求', value: '不得堆放材料' },
        { label: '功能', value: '消防与应急撤离' },
        { label: '现状', value: '通道畅通' },
      ],
      note: '通道被材料或工器具占用时，消防与应急撤离都会受影响。',
      points: [],
    },
  ],
};

const ACT3_LEDGER: ActDossierLedger = {
  equipment: [
    {
      id: 'eq-temp-box',
      kind: 'equipment',
      name: '临时配电箱',
      code: 'TN-S · 末级漏保',
      summary: '施工方自备的临时配电箱，为回填、支模与焊接作业供电。',
      specs: [
        { label: '系统', value: 'TN-S 接零保护' },
        { label: '末级漏保', value: '30 mA / 0.1 s' },
        { label: '箱门', value: '未锁' },
        { label: '进出线', value: '沿地面敷设 · 外护套破损' },
      ],
      note: '测试时由施工方电工配合，监理不徒手触碰箱内元件。',
      points: ['a3-box'],
    },
    {
      id: 'eq-pit',
      kind: 'equipment',
      name: '基坑',
      code: '深 2.2 m',
      summary: '施工区中部的回填基坑，紧邻材料堆，是本幕重大隐患所在。',
      specs: [
        { label: '深度', value: '2.2 m' },
        { label: '临边防护', value: '缺失' },
        { label: '坑内', value: '积水 · 无支护' },
        { label: '上下通道', value: '无' },
      ],
      note: '基坑边 1 m 内不得堆物、站人，临边必须设连续防护栏杆。',
      points: ['a3-pit'],
    },
    {
      id: 'eq-hotwork',
      kind: 'equipment',
      name: '动火作业点',
      code: 'DH-2026-1031',
      summary: '北侧施工区的焊接地扁钢作业点，按二级动火管理。',
      specs: [
        { label: '动火级别', value: '二级' },
        { label: '距防火墙', value: '6 m' },
        { label: '监护人', value: '赵志远' },
        { label: '作业内容', value: '焊接地扁钢' },
      ],
      note: '动火票在赵志远处，作业前核对看火人与灭火器材是否到位。',
      points: [],
    },
    {
      id: 'eq-spare-t',
      kind: 'equipment',
      name: '3# 备用变',
      code: '运行设备 · 墙外',
      summary: '防火墙北侧的运行设备，与施工区仅一墙之隔。',
      specs: [
        { label: '状态', value: '带电运行' },
        { label: '位置', value: '防火墙北侧' },
        { label: '与施工区', value: '一墙之隔' },
        { label: '风险', value: '材料/机械/基坑侵入' },
      ],
      note: '施工机械、材料堆与基坑都不得侵入运行区安全距离。',
      points: ['a3-pit'],
    },
    {
      id: 'eq-material',
      kind: 'equipment',
      name: '材料堆（钢管、扣件、木方）',
      code: '施工区中部',
      summary: '堆放在基坑东侧的材料堆，高度遮挡地面视线。',
      specs: [
        { label: '位置', value: '基坑东侧' },
        { label: '高度', value: '遮挡地面视线' },
        { label: '堆载', value: '靠近基坑边' },
        { label: '归属', value: '分包单位' },
      ],
      note: '材料堆既遮挡观察视线，又构成基坑边堆载，需一并记录。',
      points: ['a3-hardhat', 'a3-pit'],
    },
  ],
  personnel: [
    {
      id: 'ps-wang-3',
      kind: 'personnel',
      name: '王振',
      code: '分包单位 · 现场负责人',
      summary: '北侧扩建配套施工的分包现场负责人，本幕为施工单位第一责任人。',
      specs: [
        { label: '单位', value: '北侧扩建分包' },
        { label: '职责', value: '现场组织 · 进度' },
        { label: '本幕问题', value: '安全员缺位仍安排动火' },
        { label: '持有', value: '施工方案 · 动火票' },
      ],
      note: '赶工期不能替代安全措施；重大隐患可要求立即停工。',
      points: ['a3-hardhat'],
    },
    {
      id: 'ps-zhao-3',
      kind: 'personnel',
      name: '赵志远',
      code: '动火监护人 · 兼管安全',
      summary: '本幕动火监护人；分包专职安全员请假后，现场安全由他兼管。',
      specs: [
        { label: '本幕职责', value: '动火监护' },
        { label: '兼职', value: '兼管现场安全' },
        { label: '应到专职安全员', value: '0 人（请假）' },
        { label: '冲突', value: '监护与安全管理不得兼顾' },
      ],
      note: '监护人必须盯住动火点，无法同时兼顾 12 人的作业面。',
      points: ['a3-hardhat', 'a3-pit'],
    },
    {
      id: 'ps-safety-officer',
      kind: 'personnel',
      name: '分包专职安全员',
      code: '今日请假 · 缺位',
      summary: '分包单位应到岗的专职安全管理人员，本幕未到现场。',
      specs: [
        { label: '应到', value: '1 人' },
        { label: '实到', value: '0 人' },
        { label: '影响', value: '现场无人专职监督' },
        { label: '替代', value: '赵志远兼管（不合规）' },
      ],
      note: '专职安全员缺位属施工单位管理问题，应要求到岗或停止作业。',
      points: ['a3-pit'],
    },
    {
      id: 'ps-workers',
      kind: 'personnel',
      name: '作业人员',
      code: '12 人 · 多工种',
      summary: '分包单位现场作业人员，同时进行回填、支模与焊接。',
      specs: [
        { label: '人数', value: '12 人' },
        { label: '作业内容', value: '回填 · 支模 · 焊接' },
        { label: '防护', value: '安全帽 · 反光衣' },
        { label: '现场', value: '1 人未戴安全帽' },
      ],
      note: '人员防护是本幕第一处问题，距离较远，地面视线被材料堆遮挡。',
      points: ['a3-hardhat'],
    },
    {
      id: 'ps-luchuan-3',
      kind: 'personnel',
      name: '陆川',
      code: '监理项目部 · 安全监理',
      summary: '本幕对施工现场进行安全监理检查，按隐患严重程度选择处置手段。',
      specs: [
        { label: '隶属', value: '监理项目部' },
        { label: '本幕职责', value: '现场检查 · 处置' },
        { label: '处置手段', value: '整改 / 停工 / 报告' },
        { label: '记录', value: '监理日志' },
      ],
      note: '施工隐患的处置对象是施工单位，不是运行设备。',
      points: ['a3-hardhat', 'a3-pit', 'a3-box'],
    },
  ],
  sites: [
    {
      id: 'site-north-work',
      kind: 'site',
      name: '北侧扩建配套施工区',
      code: '户外 · 多工序交叉',
      summary: '站区北侧的扩建配套施工区，回填、支模与焊接同时进行。',
      specs: [
        { label: '作业', value: '回填 · 支模 · 焊接地扁钢' },
        { label: '与运行区', value: '一墙之隔' },
        { label: '隔离', value: '围栏与警示标志' },
        { label: '状态', value: '多工序交叉作业' },
      ],
      note: '施工区与运行设备区的隔离是本站扩建期的主要风险点。',
      points: ['a3-hardhat', 'a3-pit', 'a3-box'],
    },
    {
      id: 'site-pit',
      kind: 'site',
      name: '施工区中部 基坑',
      code: '户外 · 深 2.2 m',
      summary: '紧邻材料堆的基坑，临边无连续围栏，坑内有积水。',
      specs: [
        { label: '深度', value: '2.2 m' },
        { label: '位置', value: '材料堆旁' },
        { label: '临边', value: '无连续围栏' },
        { label: '坑内', value: '积水 · 无支护' },
      ],
      note: '检查时不得跨越警戒带，也不得靠近无防护临边。',
      points: ['a3-pit'],
    },
    {
      id: 'site-power',
      kind: 'site',
      name: '施工区南侧 临时用电区',
      code: '户外 · TN-S',
      summary: '施工区南侧的临时用电布置区，配电箱与电缆沿地面敷设。',
      specs: [
        { label: '设备', value: '临时配电箱' },
        { label: '敷设', value: '电缆沿地面' },
        { label: '防护', value: '无防雨 · 无门锁' },
        { label: '测试配合', value: '施工方电工' },
      ],
      note: '用电隐患与动火作业同处一个作业面，处置时需分清责任主体。',
      points: ['a3-box'],
    },
    {
      id: 'site-warning-sign',
      kind: 'site',
      name: '施工区东侧 安全警示牌',
      code: '户外 · 观察位',
      summary: '材料堆东侧的警示牌，是本幕观察人员防护的站位。',
      specs: [
        { label: '位置', value: '材料堆东侧' },
        { label: '作用', value: '警戒与观察位' },
        { label: '视线', value: '被材料堆遮挡' },
        { label: '观察方式', value: '升空观察' },
      ],
      note: '在地面无法看清西侧人员，需先升空观察再定级。',
      points: ['a3-hardhat'],
    },
  ],
};

export const ACT_LEDGERS: Record<ActNo, ActDossierLedger> = {
  1: ACT1_LEDGER,
  2: ACT2_LEDGER,
  3: ACT3_LEDGER,
};

/* ------------------------------------------------------------------ */
/* 安规条例                                                            */
/* ------------------------------------------------------------------ */

const ACT1_REGULATIONS: DossierRegulation[] = [
  {
    id: 'reg-gb26860-distance',
    group: '巡视作业',
    citation: 'GB 26860-2011 · 表 1',
    title: '高压设备巡视的安全距离与行为约束',
    clause:
      '巡视高压设备时，不得移开或越过遮栏，不得进行其他工作；人体与带电体的安全距离不得小于表 1 的规定：220kV 为 3.00 m，10kV 为 0.70 m。',
    application:
      'F02 间隔与 10kV 柜列均在带电运行，测温与测距必须在警戒线外完成；发现异常只记录并通知运维，不替代运维诊断。',
    interpretation:
      '3.00 m 是为 220kV 外绝缘在操作过电压下留出的空气裕度。规程直接禁止移开遮栏，是因为一旦移开，人与带电体的实际距离就失去控制——不是"尽量靠近"，而是根本不能改变既有隔离。',
    points: ['bay-temp', 'hv-10kv'],
  },
  {
    id: 'reg-dlt664-delta',
    group: '设备诊断',
    citation: 'DL/T 664-2016 · 相对温差判据',
    title: '电流致热型设备的红外诊断判据',
    clause:
      '相对温差 δt =（T1 − T2）/（T1 − T0）×100%。δt ≥35% 为一般缺陷；δt ≥80% 或热点温度 80~110 ℃ 为严重缺陷；热点 >110 ℃，或 δt ≥95% 且热点 >80 ℃ 为危急缺陷。',
    application:
      '三相接头要在同一距离、同一角度下比较；单相读数不能直接定级，必须与其余两相和环境温度一起算相对温差。',
    interpretation:
      'T1 是热点温度、T2 是正常相温度、T0 是环境温度。用环温作分母，相当于把负荷与气温的差异约掉，只留下"这一相比同类高多少"；所以同一回路三相齐全，判据才成立。热点超过 110 ℃ 时绝缘材料进入快速老化区，不再看相对值，直接按危急处理。',
    points: ['bay-temp', 'hv-10kv'],
  },
  {
    id: 'reg-dlt5056-aisle',
    group: '巡视作业',
    citation: 'DL/T 5056-2007 · 屋外配电装置通道',
    title: '巡视通道净宽与通道占用',
    clause:
      '屋外配电装置内的巡视道路宽度宜为 0.7~1.0 m；通道内不得堆放材料、构件与建筑垃圾，不得侵占消防与应急疏散通道。',
    application:
      '站区中部通道设计净宽 1.00 m，现场被木方与托盘挤占后剩余净宽不足，属施工单位的文明施工与通道占用问题。',
    interpretation:
      '1.0 m 是设计上限，0.7 m 是仍能侧身通过的下限；被材料挤占后，真正决定应急撤离的是"剩余净宽"而不是图纸宽度。材料属北侧施工单位，清理责任也随之落在施工单位。',
    points: ['aisle'],
  },
];

const ACT2_REGULATIONS: DossierRegulation[] = [
  {
    id: 'reg-dlt572-oiltemp',
    group: '设备与土建',
    citation: 'DL/T 572-2021 · 运行油温',
    title: '油浸式变压器顶层油温控制',
    clause:
      '油浸式变压器顶层油温正常运行不应超过 85 ℃，最高不得超过 95 ℃；超过控制值时应查明原因，并采取转移负荷、加强冷却等措施。',
    application:
      '1# 主变已停电，读数为停电后复测值，仍需与上次巡视的 64.2 ℃ 对比；油温偏高要与油位、渗漏一起看。',
    interpretation:
      '85 ℃ 是运行控制值，超过它就说明冷却或负荷出了问题；95 ℃ 是保护动作前的最后边界，再往上绝缘油会加速裂解、内部压力升高。两个数字之间是"必须处理但还不一定跳闸"的窗口。',
    points: ['a2-oil'],
  },
  {
    id: 'reg-gbt6451-rise',
    group: '设备与土建',
    citation: 'GB/T 6451-2015 · 温升限值',
    title: '油浸式变压器的温升限值',
    clause:
      '油浸式变压器在额定负载下，顶层油温升不应超过 55 K（自然循环）；超过限值时应核对负载率、环境温度与冷却装置运行状态。',
    application:
      '本幕环温 27 ℃，读数需结合停电前负荷与冷却方式判断，不能只看温度绝对值。',
    interpretation:
      '温升 = 顶层油温 − 环境温度，55 K 是自然循环冷却的允许温升。同样是 64.2 ℃，冬天和夏天对应的温升完全不同；停电后测得的是残余油温，还要结合停电前的负荷率才有意义。',
    points: ['a2-oil'],
  },
  {
    id: 'reg-gb50210-plaster',
    group: '设备与土建',
    citation: 'GB 50210-2018 · 一般抹灰工程',
    title: '抹灰层与基层的粘结要求',
    clause:
      '抹灰层与基层之间及各抹灰层之间必须粘结牢固，抹灰层应无脱层、空鼓，面层应无爆灰和裂缝。',
    application:
      '防火墙抹灰层空鼓、局部脱层，应划定范围凿除重做；只做表面修补不能恢复防火分隔的完整性。',
    interpretation:
      '空鼓意味着抹灰层与基层已经脱离，只靠边缘咬合挂着；受振动或温差后容易成片脱落。凿除到基层重新抹灰才能恢复粘结，表面再抹一层只是把空鼓盖住。',
    points: ['a2-wall'],
  },
  {
    id: 'reg-special-work-cert',
    group: '人员资格',
    citation: '《特种作业人员安全技术培训考核管理规定》· 复审',
    title: '特种作业操作证的复审与上岗',
    clause:
      '特种作业操作证每 3 年复审 1 次；证件超过有效期未复审的，不得继续从事特种作业。用人单位应建立台账，核对证件有效期与作业范围。',
    application:
      '班前会名册逐人核对作业证有效期；焊工证 2025-06 到期即属超期，不得进入检修作业面。',
    interpretation:
      '复审考的是证件是否仍然有效，不是技能高低；在安全管理口径里，过期证等同于无证上岗。所以名册核验看的是"有效期"这一列事实，而不是这个人平时干得好不好。',
    points: ['a2-crew'],
  },
  {
    id: 'reg-safety-reg-14',
    group: '监理职责',
    citation: '《建设工程安全生产管理条例》· 第十四条',
    title: '监理单位对安全隐患的处置手段',
    clause:
      '工程监理单位在实施监理过程中，发现存在安全事故隐患的，应当要求施工单位整改；情况严重的，应当要求施工单位暂时停止施工，并及时报告建设单位。',
    application:
      '施工隐患按"整改 → 暂停施工 → 报告建设单位"逐级升级；对运行设备缺陷不能套用停工令，只能通知运维。',
    interpretation:
      '监理没有直接的停工权，只有要求整改、建议暂停、报告建设单位三项手段。对施工单位越权下停工令是处置不当；对运行设备套用停工令同样是处置不当——设备缺陷只能通知运维，由运维按缺陷等级处理。',
    points: ['a2-wall'],
  },
];

const ACT3_REGULATIONS: DossierRegulation[] = [
  {
    id: 'reg-jgj80-edge',
    group: '基坑与临边',
    citation: 'JGJ 80-2016 · 临边防护',
    title: '基坑临边防护栏杆的构造要求',
    clause:
      '基坑周边、尚未安装栏杆或栏板的平台周边，都必须设置防护栏杆；防护栏杆上杆离地高度 1.2 m，下杆离地 0.6 m，底部设高度不小于 180 mm 的挡脚板。',
    application:
      '基坑深 2.2 m，现场无临边栏杆、无挡脚板、无上下通道，属重大隐患，应立即停止坑边作业。',
    interpretation:
      '上杆 1.2 m 挡住站立时的重心高度，下杆 0.6 m 防止身体滑入，180 mm 挡脚板挡住工具与碎料。三者是同一套构造：只立一根横杆，人仍可能从杆下钻过或被工具砸中。',
    points: ['a3-pit'],
  },
  {
    id: 'reg-jgj59-pit',
    group: '基坑与临边',
    citation: 'JGJ 59-2011 · 基坑工程检查',
    title: '基坑施工的专项方案与坑边堆载',
    clause:
      '基坑施工应编制专项施工方案并按规定审批；基坑边 1 m 内不得堆土、堆料、停置机具；坑内积水应及时排除。',
    application:
      '材料堆紧邻基坑边，坑内有积水，专项方案与验收记录需一并核查。',
    interpretation:
      '坑边 1 m 内堆载会增大边坡附加应力，积水会降低土体强度，两者叠加就是坍塌的直接诱因。专项方案的作用是把支护、排水、堆载限值提前算清楚，现场按方案验收。',
    points: ['a3-pit'],
  },
  {
    id: 'reg-gbt13955-rcd',
    group: '临时用电',
    citation: 'GB/T 13955-2017 · 末级保护',
    title: '剩余电流动作保护装置的整定与检验',
    clause:
      '末级剩余电流动作保护装置的额定剩余动作电流不应大于 30 mA，动作时间不应大于 0.1 s；应定期试跳并记录，失灵的装置必须立即更换。',
    application:
      '临时配电箱末级漏保实测动作电流 42 mA、动作时间 0.18 s，已超出限值；箱门未锁、进出线外护套破损同时存在。',
    interpretation:
      '30 mA 大致是人体能够自行摆脱的电流上限，0.1 s 是避免心室颤动的时间窗口。动作电流调到 42 mA、时间拖到 0.18 s，看起来只差一点，实际已经越过保命边界。',
    points: ['a3-box'],
  },
  {
    id: 'reg-gb50720-hotwork',
    group: '动火与隔离',
    citation: 'GB 50720-2011 · 动火作业',
    title: '施工现场动火作业的审批与看火',
    clause:
      '动火作业应办理动火许可证，作业前清除可燃物、配备灭火器材，并设专人看火；动火作业结束后应检查确认无火灾隐患。',
    application:
      '动火票 DH-2026-1031 为二级动火，监护人赵志远同时兼管现场安全，看火与安全管理不能由同一人兼顾。',
    interpretation:
      '动火票管的是"在哪动火、什么时候、谁看火、配什么器材"四件事。看火人必须始终盯着动火点，兼管安全就等于没有专职看火；票面再齐全，现场执行也落空。',
    points: ['a3-hardhat'],
  },
  {
    id: 'reg-dl5009-3-separation',
    group: '动火与隔离',
    citation: 'DL 5009.3-2013 · 施工区隔离',
    title: '运行变电站内施工区与运行设备的隔离',
    clause:
      '在运行变电站内进行扩建、改建施工时，施工区应与运行设备区可靠隔离，设置围栏与警示标志，并保持规定的安全距离；不得跨越运行间隔。',
    application:
      '施工区与 3# 备用变仅一墙之隔，材料堆、基坑与临时用电都不得侵入运行区通道与安全距离。',
    interpretation:
      '运行站内施工的最大风险不是施工本身，而是机械、材料、基坑侵入带电间隔。隔离围栏一旦失效，普通的回填或堆料动作就会直接变成电气事故，所以隔离设施要按带电体来对待。',
    points: ['a3-pit', 'a3-box'],
  },
];

export const ACT_REGULATIONS: Record<ActNo, DossierRegulation[]> = {
  1: ACT1_REGULATIONS,
  2: ACT2_REGULATIONS,
  3: ACT3_REGULATIONS,
};

/* ------------------------------------------------------------------ */
/* 班前会名册口径                                                      */
/* ------------------------------------------------------------------ */

export interface PermitCheckCriterion {
  /** 现场如何判出这一类违规。 */
  scene: string;
  /** 核验时注意什么。 */
  rule: string;
}

/** key 必须覆盖 `CREW_VIOLATION_OPTIONS` 的全部类型。 */
export const PERMIT_CHECK_CRITERIA: Record<CrewViolationKind, PermitCheckCriterion> = {
  absent: {
    scene: '票面登记的人没有出现在列队里，或被未登记的人顶替。',
    rule: '按票面名单逐人核对实到人数；缺员与私自加人都要向工作负责人确认。',
  },
  'cert-expired': {
    scene: '胸前未挂工作证，或胸牌有效期已过、作业证不在有效期内。',
    rule: '有效期印在 3D 现场胸牌上，名册不再单列这一列；过期即不得进入作业面。',
  },
  'no-helmet': {
    scene: '进入作业面未佩戴安全帽，或安全帽未按规定系紧下颏带。',
    rule: '安全帽属现场目视可判的事实，与证件核验分开记录。',
  },
};

/** 名册列定义：与 WorkPermitPanel 的表头保持同一口径。 */
export const PERMIT_ROSTER_COLUMNS = ['岗位', '姓名', '工号', '作业证', '核验'] as const;

/* ------------------------------------------------------------------ */
/* 玩法说明                                                            */
/* ------------------------------------------------------------------ */

export const GAMEPLAY_CONTROLS = [
  { keys: 'W A S D / Shift', label: '移动与跑动，鼠标转动视角' },
  { keys: 'F', label: '靠近检查点：打开处置单 / 进出门' },
  { keys: 'G', label: '对已定级的检查点现场取证' },
  { keys: 'E', label: '打开或关闭备忘录' },
  { keys: 'B', label: '现场背包：切换随身仪器' },
  { keys: 'U / R', label: '升空观察 / 收回' },
  { keys: 'X', label: '关闭当前弹窗或面板' },
] as const;

export const GAMEPLAY_STEPS = [
  {
    step: '01',
    title: '接近检查点',
    text: '按任务追踪走到检查点，站进工位范围；越警戒线会直接中止本幕。',
  },
  {
    step: '02',
    title: '打开处置单',
    text: '按 F 打开处置单，左侧 3D 实景列出本点的检测项，逐项完成。',
  },
  {
    step: '03',
    title: '先观察再检测',
    text: '目视观察是本幕第一项动作；未观察时检测项不可用，读数也不完整。',
  },
  {
    step: '04',
    title: '读数分质量',
    text: '只有条件合格的读数能参与判级；覆盖不足或条件不符的读数标注为"参考"。',
  },
  {
    step: '05',
    title: '对照判据定级',
    text: '在安规手册里找对应判据，自己算相对温差或核对限值，再选择处置等级。',
  },
  {
    step: '06',
    title: '现场取证',
    text: 'P1 及以上处置必须按 G 完成取证；没有证据的处置无法闭环，会在结算时记为未闭环隐患。',
  },
  {
    step: '07',
    title: '归档结算',
    text: '处置随监理日志归档；本幕结束时统一核账，判错的处置在这里扣分。',
  },
] as const;
