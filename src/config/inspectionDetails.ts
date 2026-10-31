import type { Act1PointId } from '../game/act1';

export interface InspectionPointDetail {
  pointId: Act1PointId;
  voltageLevel: string;
  bayName: string;
  equipmentType: string;
  taskIntro: string;
  safetyRequirement: string;
}

/**
 * 检查点说明文案。
 *
 * 边界：安全监理只做外观巡视、仪器初筛、记录与通知，不对运行设备做诊断性试验，
 * 也不向运行设备下达停运指令；缺陷定性与处理由运维单位负责。
 */
export const INSPECTION_POINT_DETAILS: Record<Act1PointId, InspectionPointDetail> = {
  aisle: {
    pointId: 'aisle',
    voltageLevel: '220kV',
    bayName: '前侧/后侧间隔区间',
    equipmentType: '站内室外设备巡视与应急疏散通道',
    taskIntro:
      '前后间隔区之间的巡视与应急疏散通道。核查实际剩余净宽、木料堆与 220kV 带电体的距离、堆码稳定性及消防通道占用情况。材料属北侧扩建施工单位，监理可要求其立即清理。',
    safetyRequirement:
      '通道内严禁堆放木方、托盘与建筑垃圾；测量时不得使用金属量具靠近带电体，人员与带电体保持 3.0 m 以上。',
  },
  'bay-temp': {
    pointId: 'bay-temp',
    voltageLevel: '220kV',
    bayName: '前侧开关间隔区 F02',
    equipmentType: '双柱水平旋转式隔离开关与引线接头',
    taskIntro:
      '220kV F02 间隔隔离开关动静触头与引线接头。核对触头合闸位置、瓷瓶与均压环外观、导流回路有无异常温升。测温只作初筛，发现异常记录并通知运维复核，不替代运维诊断。',
    safetyRequirement:
      '站在黄黑警戒线外巡视，与 220kV 带电体保持不小于 3.0 m；不得移开或越过遮栏，不得在巡视中做其他工作。',
  },
  'hv-10kv': {
    pointId: 'hv-10kv',
    voltageLevel: '10kV',
    bayName: '公寓一层 10kV 配电室',
    equipmentType: '10kV 开关柜柜列与柜内母排接头',
    taskIntro:
      '公寓一层 10kV 配电室柜列带电运行。核对柜体外观、柜号与运行指示，检查柜前通道、绝缘垫与封堵，并对柜内母排接头做红外初筛：由运维开启柜门测温窗配合，监理只记录读数。',
    safetyRequirement:
      '进入配电室先确认照明与门禁，禁止自行开启带电柜门；与柜体保持 0.7 m 以上，不得触碰柜内元件。',
  },
  'a2-crew': {
    pointId: 'a2-crew',
    voltageLevel: '检修区',
    bayName: '1# 主变检修区 · 班组集合点',
    equipmentType: '班组人员与特种作业资格',
    taskIntro:
      '班前会结束后，检修班组在 1# 主变东侧集合。核对在场人员、列队与着装，并核对特种作业台账中的焊工证是否在有效期内。',
    safetyRequirement:
      '人员未完成交底、特种作业证件不在有效期内的，不得进入检修作业面；监理只核对资格与记录，不替代施工单位管理。',
  },
  'a2-wall': {
    pointId: 'a2-wall',
    voltageLevel: '检修区',
    bayName: '1# / 2# 主变之间防火墙',
    equipmentType: '主变防火墙抹灰层',
    taskIntro:
      '1# 与 2# 主变之间的防火墙，东侧抹面局部受潮。核查墙面裂缝、空鼓与脱层范围，用敲击法判断抹灰层是否空鼓，发现空鼓应划定范围并凿除重做。',
    safetyRequirement:
      '站在防火墙外侧检查，不进入相邻带电主变通道；敲击时不得攀爬或倚靠墙体。',
  },
  'a2-oil': {
    pointId: 'a2-oil',
    voltageLevel: '220kV',
    bayName: '1# 主变检修区',
    equipmentType: '油浸式主变压器本体',
    taskIntro:
      '1# 主变本体、散热器与油枕。核查本体与法兰有无渗漏、油位是否在正常范围、呼吸器硅胶是否变色，并测量顶层油温。',
    safetyRequirement:
      '主变已停电，但邻近 2# 主变带电；不得攀爬本体，不得在散热器上放置工具材料。',
  },
  'a3-hardhat': {
    pointId: 'a3-hardhat',
    voltageLevel: '施工区',
    bayName: '施工区东侧 · 安全警示牌',
    equipmentType: '作业人员安全帽与反光衣（远程观察）',
    taskIntro:
      '站在施工区东侧安全警示牌旁，越过材料堆观察西侧作业人员的安全帽与反光衣。人员距离较远，地面视线受材料遮挡；检测需先升空观察取证，完成后才能处置。',
    safetyRequirement:
      '在警示牌外观察，不进入吊装与基坑作业半径；升空后不得飞越运行设备区。',
  },
  'a3-pit': {
    pointId: 'a3-pit',
    voltageLevel: '施工区',
    bayName: '施工区中部 · 基坑',
    equipmentType: '基坑临边防护与坑内状况',
    taskIntro:
      '基坑位于施工区中部材料堆旁，深度约 2 m。核查临边围栏、警戒带、坑内积水、支护与上下通道，以及夜间照明与临边堆载。',
    safetyRequirement:
      '基坑边 1 m 内不得堆物、站人；检查时不得跨越警戒带，不得靠近无防护临边。',
  },
  'a3-box': {
    pointId: 'a3-box',
    voltageLevel: '施工区',
    bayName: '施工区南侧 · 临时用电',
    equipmentType: '临时配电箱与末级漏电保护',
    taskIntro:
      '施工区南侧临时配电箱，箱门未锁，进出线沿地面敷设。核查箱体防雨、接地、门锁与末级漏保动作值，测试时由施工方电工配合。',
    safetyRequirement:
      '不得徒手触碰箱内元件；测试前确认箱体接地，人员站在绝缘垫上，与带电部位保持安全距离。',
  },
};
