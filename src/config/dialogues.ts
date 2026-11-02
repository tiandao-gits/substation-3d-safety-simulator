/**
 * V6.2 story content for the vertical slice. This is the single source of
 * player-facing narrative text; it mirrors DESIGN/story.md §7.1 / §8.2 / §8.3.
 *
 * Hard rule: mission cards, HUD messages, NPC lines and interaction labels must
 * never contain a tool name or a "use this tool" hint (gameplay-v2 §2.5).
 */

import type { VnLine, VnScene } from '../game/vn';

/** Prologue cast: 陈立群 centre, 王振 left, 赵志远 right. 陆川 never appears. */
export const PROLOGUE: VnScene = {
  id: 'prologue',
  bg: 'bg-office-morning',
  skippable: false,
  cast: [
    { charId: 'wang', pose: 'normal', slot: 'left' },
    { charId: 'chen', pose: 'normal', slot: 'center' },
    { charId: 'zhao', pose: 'normal', slot: 'right' },
  ],
  lines: [
    {
      id: 'PRO-01',
      speakerId: 'chen',
      text: '小陆，今天例行巡检后，十点半到主变检修现场参加班前会；下午去下北区施工现场。',
      propFrame: 'prop-route-map',
    },
    { id: 'PRO-02', speakerId: 'luchuan', text: '收到。' },
    { id: 'PRO-03', speakerId: 'chen', text: '王工，北区施工现场那边活做的咋样？' },
    {
      id: 'PRO-04',
      speakerId: 'wang',
      text: '回填、支模，下午还有一段动火——焊接地扁钢。周末要交工作面，人都在赶。',
    },
    { id: 'PRO-05', speakerId: 'chen', text: '安全员谁盯？' },
    {
      id: 'PRO-06',
      speakerId: 'zhao',
      text: '北区是分包，他们安全员请假了。我两头跑，盯不过来。',
    },
    { id: 'PRO-07', speakerId: 'wang', text: '墙这边我们有人看着，出不了事。' },
    {
      id: 'PRO-08',
      speakerId: 'chen',
      text: '防火墙那边就是备变，带着电。一墙之隔，动火、堆料、挖坑，哪样都能捅到墙这边来。',
    },
    { id: 'PRO-09', speakerId: 'luchuan', text: '北区我走细一点。' },
    {
      id: 'PRO-10',
      speakerId: 'wang',
      text: '陆工，周六要交工作面，今天出点小问题，晚上补也行吧？',
    },
    {
      id: 'CHO-PRO-01',
      prompt: '怎么收口？',
      options: [
        {
          text: '能晚上补的先补，补不了的当场停。',
          subText: 'DEFER RECTIFICATION UNTIL TONIGHT / HALT IF CRITICAL',
          nextLineId: 'PRO-11a',
          flag: 'pro_policy=defer',
        },
        {
          text: '今天查出来的，今天必须闭环。',
          subText: 'ALL DEFECTS MUST CLOSE TODAY / ZERO TOLERANCE',
          nextLineId: 'PRO-11b',
          flag: 'pro_policy=today',
        },
      ],
    },
    {
      id: 'PRO-11a',
      speakerId: 'luchuan',
      text: '行。能晚上补的，你们晚上补；补不了的，我当场停。',
      next: 'PRO-12',
    },
    {
      id: 'PRO-11b',
      speakerId: 'luchuan',
      text: '晚上补，等于没补。今天查出来的，今天改完。',
      next: 'PRO-12',
    },
    {
      id: 'PRO-12',
      speakerId: 'chen',
      text: '小陆，发现什么，记什么。别替他们省这一道。',
    },
  ],
};

export interface SectionCard {
  time: string;
  place: string;
}

export const PROLOGUE_SECTION_CARD: SectionCard = {
  time: '同日　08:00　晴',
  place: '10kV 配电室',
};

export const ACT1_TASK_CARD = {
  title: '第一幕 · 正常巡检',
  time: '08:00',
  background:
    '例行巡视。前后两片 220kV 开关设备区带电运行，10kV 配电室带电运行，今日无操作、无检修。安全监理只做外观巡视与仪器初筛，发现异常记录并通知运维，不替代运维诊断。',
  scope:
    '10kV 配电室设备、站区中部巡视通道、前侧 F02 间隔 BAY 设备温度。',
  known: '巡检记录与设备台账在备忘录；晴，气温 26 ℃，风速 2 m/s。',
};

export const ACT2_TASK_CARD = {
  title: '第二幕 · 主变电维修巡检',
  time: '10:30',
  background:
    '1# 主变停电检修，施工单位按工作票布置围栏与接地线；2# 主变运行带负荷，一墙之隔。班前会刚结束，检修人员已进入现场。',
  scope: '1# 主变检修区的班组人员资格、主变防火墙空鼓、主变本体油温与渗漏。',
  known: '工作票、班前会交底记录与特种作业人员台账在资料柜；晴，气温 27 ℃，风速 2 m/s。',
};

export const ACT3_TASK_CARD = {
  title: '第三幕 · 施工现场检查',
  time: '13:30',
  background:
    '刚在值班公寓睡完午觉起来，准备去北区施工现场看看。北侧扩建配套施工区进行回填、支模与动火作业，施工方专职安全员请假，且施工区与运行设备区仅一墙之隔。本幕为违规施工检查：未戴安全帽、基坑、临时配电箱三处问题同时存在。',
  scope: '作业人员防护、基坑临边与坑内状况、临时配电箱漏电保护。',
  known: '施工方案与动火票在赵志远处；晴，气温 29 ℃，风速 3 m/s。',
};

export const ACT_SECTION_CARDS: Record<1 | 2 | 3, SectionCard> = {
  1: PROLOGUE_SECTION_CARD,
  2: { time: '同日　10:30　晴', place: '主变区 · 1# 主变检修现场' },
  3: { time: '同日　13:30　晴', place: '北侧 · 扩建配套施工区' },
};

export const ACT_TASK_CARDS = {
  1: ACT1_TASK_CARD,
  2: ACT2_TASK_CARD,
  3: ACT3_TASK_CARD,
} as const;


export const ACT1_DOSSIER = {
  title: '第一幕资料',
  sections: [
    {
      title: '设备台账',
      lines: [
        'F01–F03 / R01–R03：220kV 户外敞开式开关设备，额定电流 3150 A。',
        '电流互感器变比 2×1250/1 A，一次引线为铝绞线。',
        'F02 隔离开关触头镀银，额定电流 3150 A。',
        '巡视通道设计净宽 1.00 m，材料堆放不得侵占。',
      ],
    },
    {
      title: '本次可参考的判据',
      lines: [
        '220kV 设备不停电时的安全距离：3.00 m。',
        '红外判据（DL/T 664）：相对温差 δt ≥35% 一般缺陷；δt ≥80% 或热点 80~110 ℃ 严重缺陷；δt ≥95% 且热点 >80 ℃，或热点 >110 ℃ 危急缺陷。',
        '巡视道路设计净宽 1.0 m（规范区间 0.7~1.0 m），且与带电体保持 3.0 m 以上。',
        'P1 及以上处置必须附现场证据；P0 正常记录不需要取证。',
      ],
    },
  ],
};

export const ACT2_DOSSIER = {
  title: '第二幕资料',
  sections: [
    {
      title: '工作票与班前会',
      lines: [
        '工作票号：2026-10-31-01，工作内容：1# 主变本体及散热器检查、油位核对。',
        '安全措施：停电、验电、装设接地线、悬挂标示牌、装设围栏；围栏、接地线、监护人三样到位后方可开工。',
        '2# 主变运行带负荷，与检修区一墙之隔；围栏外为带电通道，不得跨越。',
        '班前会交底：工作负责人、专责监护人、施工人员签名齐全。',
        '特种作业操作证每 3 年复审一次，超期未复审不得上岗（《特种作业人员安全技术培训考核管理规定》）。',
      ],
    },
    {
      title: '主变铭牌与上次数据',
      lines: [
        '1# 主变：SFZ11-120000/220，额定容量 120 MVA，电压比 220/110/10 kV。',
        '上次巡视：顶层油温 64.2 ℃，油位在正常刻度，本体与法兰无渗漏。',
        '冷却方式 ONAN/ONAF，散热器阀门开启位置与记录一致。',
        '防油围堰内无积水、无油迹。',
      ],
    },
    {
      title: '本次可参考的判据',
      lines: [
        '主变顶层油温运行控制值 85 ℃，最高不得超过 95 ℃（DL/T 572、GB/T 6451）。',
        '防火墙抹灰层不得有空鼓、脱层与贯穿裂缝；发现空鼓应划定范围并凿除重做。',
        '防火墙作为主变之间的防火分隔，不得随意开孔或削弱墙体。',
        'P1 及以上处置必须附现场证据；P0 正常记录不需要取证。',
      ],
    },
  ],
};

export const ACT3_DOSSIER = {
  title: '第三幕资料',
  sections: [
    {
      title: '施工方案与动火票',
      lines: [
        '作业内容：北侧扩建配套回填、支模、焊接地扁钢；分包单位现场负责人王振。',
        '动火票：编号 DH-2026-1031，动火级别二级，动火点距防火墙 6 m，监护人赵志远。',
        '分包专职安全员今日请假，现场由赵志远兼管；作业人员 12 人。',
        '施工区与运行设备区仅一墙之隔，墙外为 3# 备用变。',
      ],
    },
    {
      title: '临时用电与防护',
      lines: [
        '临时配电箱由施工方自备，TN-S 接零保护系统，末级漏电保护器额定动作电流 30 mA、动作时间 0.1 s。',
        '基坑深度 2.2 m，按方案设置临边防护栏杆与警戒带，夜间照明由施工方负责接通。',
        '作业人员应佩戴安全帽、反光衣；动火作业配备灭火器材。',
        '现场材料堆放不得侵占运行区通道与消防通道。',
      ],
    },
    {
      title: '本次可参考的判据',
      lines: [
        '基坑临边防护栏杆高度不低于 1.2 m，底部设挡脚板（JGJ 59）。',
        '末级漏保动作电流不大于 30 mA，动作时间不大于 0.1 s。',
        '施工区与带电设备安全距离按 GB 26860 执行，不得飞越运行间隔。',
        'P1 及以上处置必须附现场证据；P0 正常记录不需要取证。',
      ],
    },
  ],
};

export const ACT_DOSSIERS = {
  1: ACT1_DOSSIER,
  2: ACT2_DOSSIER,
  3: ACT3_DOSSIER,
} as const;

/** In-act bubbles / phone lines. Keys match the ids queued by `act1.ts`. */
export const ACT1_LINES: Record<string, VnLine> = {
  'A1-00': {
    id: 'A1-00',
    speakerId: 'luchuan',
    monologue: true,
    text: '定期巡检不是走一圈。带电的设备，靠数说话。',
  },
  'A1-01': { id: 'A1-01', speakerId: 'ma', text: '都正常，昨天刚巡过。' },
  'A1-02': { id: 'A1-02', speakerId: 'luchuan', text: 'A、B、C 三相，读数在这。' },
  'A1-03': { id: 'A1-03', speakerId: 'ma', text: '差一点很正常吧？' },
  'A1-04': {
    id: 'A1-04',
    speakerId: 'luchuan',
    text: '同一时间、同一角度、同一距离。差多少，看数。',
  },
  'A1-05': {
    id: 'A1-05',
    speakerId: 'luchuan',
    text: '这一相引线接头，比另外两相高。',
  },
  'A1-08': {
    id: 'A1-08',
    speakerId: 'luchuan',
    text: '通道上堆了材料,得清理掉',
  },
  'A1-10': {
    id: 'A1-10',
    speakerId: 'system',
    text: '已取证：三相温升 / 引线接头 / 通道净宽。',
  },
  'A1-13': {
    id: 'A1-13',
    speakerId: 'luchuan',
    text: 'B 相触头这一相，温度不对。',
  },
  'A2-00': {
    id: 'A2-00',
    speakerId: 'system',
    text: '班组已在 1# 主变检修区集合，班前会准备开始。',
  },
  'A2-01': {
    id: 'A2-01',
    speakerId: 'wang',
    text: '人都到齐了，我主持，长话短说：今天放油、拆附件，围栏、接地线、监护人，三样到位才准开工。散会就干。',
  },
  'A2-02': {
    id: 'A2-02',
    speakerId: 'luchuan',
    text: '先等等。人、证、现场，我都要过一遍。',
  },
  'A2-03': {
    id: 'A2-03',
    speakerId: 'ma',
    text: '陆工，都是老班底了，证都齐全。',
  },
  'A2-04': {
    id: 'A2-04',
    speakerId: 'wang',
    text: '台账在赵志远那儿，你要看随时看。',
  },
  'A2-05': {
    id: 'A2-05',
    speakerId: 'luchuan',
    text: '人先站好，证拿出来。核完人再干活。',
  },
  'A3-OPEN-1': {
    id: 'A3-OPEN-1',
    speakerId: 'luchuan',
    monologue: true,
    text: '在值班公寓眯了个午觉，总算缓过点神来。',
  },
  'A3-00': {
    id: 'A3-00',
    speakerId: 'luchuan',
    text: '材料堆西侧那名工人没戴安全帽。',
  },
  'A3-01': {
    id: 'A3-01',
    speakerId: 'luchuan',
    text: '距离太远，地面拍不清；',
  },
  'A3-02': {
    id: 'A3-02',
    speakerId: 'luchuan',
    text: '升空取景，把人和头部放在画面正中。',
  },
  'A3-03': {
    id: 'A3-03',
    speakerId: 'luchuan',
    text: '别以为躲后面吸烟就拍不到了。',
  },
  'A1-11': {
    id: 'A1-11',
    speakerId: 'wang',
    channel: 'phone',
    text: '陆工，材料先放那儿，下午就挪。',
  },
  'A1-12': {
    id: 'A1-12',
    speakerId: 'luchuan',
    channel: 'phone',
    text: '现在挪。通道不是给木料堆躺的。',
  },
  'A1-END-1': {
    id: 'A1-END-1',
    speakerId: 'luchuan',
    monologue: true,
    text: '上午运行区三处查完了。10kV 配电室与 F02 间隔的三相温升读数已登记，巡视通道被施工木料堆挤占。',
  },
  'A2-END-1': {
    id: 'A2-END-1',
    speakerId: 'wang',
    text: '陆工，这边人也核了、墙和本体也看了，活排得满，我们先开工，手续边干边补？',
  },
  'A2-END-2': {
    id: 'A2-END-2',
    speakerId: 'luchuan',
    text: '安全不能后行。人员资格、防火墙和主变本体记录今天必须按规程落纸。',
  },
};

/** Ending labels. The ending body copy lives in EndingStub. */
export const ENDING_STUB = {
  retryLabel: '重走全程',
  titleLabel: '返回标题',
};


/** Spatial briefing triggers: walk near the crew / construction sign. */
export const ACT_BRIEFING_TRIGGERS: Partial<
  Record<2 | 3, { x: number; z: number; radius: number; lines: string[] }>
> = {
  2: {
    x: -20.0,
    z: 18.3,
    radius: 6,
    lines: ['A2-00', 'A2-01', 'A2-02', 'A2-03', 'A2-04', 'A2-05'],
  },
  3: {
    x: -18.5,
    z: -17.1,
    radius: 8,
    lines: ['A3-00', 'A3-01', 'A3-02', 'A3-03'],
  },
};


/** Ending VN scenes — same presentation as the prologue. */
export const ENDING_GOOD: VnScene = {
  id: 'ending-good',
  bg: 'bg-site-dusk',
  skippable: true,
  cast: [
    { charId: 'wang', pose: 'normal', slot: 'left' },
    { charId: 'chen', pose: 'normal', slot: 'center' },
    { charId: 'zhao', pose: 'normal', slot: 'right' },
  ],
  lines: [
    {
      id: 'END-G01',
      speakerId: 'chen',
      text: '今天看见的，都记下了？',
    },
    {
      id: 'END-G02',
      speakerId: 'luchuan',
      text: '都记下了。北侧两处停工整改，主变本体缺陷已报运维，证据和通知都在。',
    },
    {
      id: 'END-G03',
      speakerId: 'wang',
      text: '陆工，今天你盯得紧。该补的我们补完了，明天开工前再交一遍底。',
    },
    {
      id: 'END-G04',
      speakerId: 'zhao',
      text: '人员那头也重新核过，证件和交底都补齐了。',
    },
    {
      id: 'END-G05',
      speakerId: 'chen',
      text: '小陆，监理的活，不是挑毛病，是让问题有人负责。',
    },
    {
      id: 'END-G06',
      speakerId: 'luchuan',
      text: '明白。今天的记录，我留在备忘录里。',
    },
  ],
};

export const ENDING_END: VnScene = {
  id: 'ending-end',
  bg: 'bg-meeting-night',
  skippable: true,
  // 事故复盘为现场沟通：陈立群、王振与运维值班负责人周敏都在场。
  cast: [
    { charId: 'wang', pose: 'normal', slot: 'left' },
    { charId: 'chen', pose: 'normal', slot: 'center' },
    { charId: 'zhou', pose: 'normal', slot: 'right' },
  ],
  lines: [
    {
      id: 'END-E01',
      speakerId: 'chen',
      text: '事故调查组要今天的记录。北侧基坑那道口子，最后是谁看见的？',
    },
    {
      id: 'END-E02',
      speakerId: 'luchuan',
      text: '我看见了。当时按正常处理，没有取证。',
    },
    {
      id: 'END-E03',
      speakerId: 'chen',
      text: '没取证，就等于没发现。',
    },
    {
      id: 'END-E04',
      speakerId: 'wang',
      text: '陆工，当时工期……',
    },
    {
      id: 'END-E05',
      speakerId: 'luchuan',
      text: '责任在我。漏项我列出来。',
    },
    {
      id: 'END-E06',
      speakerId: 'zhou',
      text: '运维这边的通知记录我手里也没有，这份我补不了。',
    },
    {
      id: 'END-E07',
      speakerId: 'chen',
      text: '把漏项列出来。今天没闭环的，明天从第一项补。',
    },
  ],
};

/** 隐患全部闭环、但总评分不足 80：按延误工期责任收尾。 */
export const ENDING_DELAY: VnScene = {
  id: 'ending-delay',
  bg: 'bg-meeting-night',
  skippable: true,
  cast: [
    { charId: 'wang', pose: 'normal', slot: 'left' },
    { charId: 'chen', pose: 'normal', slot: 'center' },
    { charId: 'zhao', pose: 'normal', slot: 'right' },
  ],
  lines: [
    {
      id: 'END-D01',
      speakerId: 'chen',
      text: '隐患都处理了，可工期为什么拖了三天？',
    },
    {
      id: 'END-D02',
      speakerId: 'luchuan',
      text: '基坑和配电箱那两处，我按最重的等级处置，两个作业面停了整整两天。',
    },
    {
      id: 'END-D03',
      speakerId: 'wang',
      text: '陆工，你要求停工的，我们只能停。可有些点，本来不需要动。',
    },
    {
      id: 'END-D04',
      speakerId: 'chen',
      text: '监理的处置要准，不是越重越好。过度处置，一样是失职。',
    },
    {
      id: 'END-D05',
      speakerId: 'zhao',
      text: '业主按合同工期考核，这笔延误要有人担。',
    },
    {
      id: 'END-D06',
      speakerId: 'luchuan',
      text: '我认。处置记录我逐条复核，该改的改。',
    },
    {
      id: 'END-D07',
      speakerId: 'chen',
      text: '把过当的处置列清楚，明天向建设单位说明。',
    },
  ],
};
