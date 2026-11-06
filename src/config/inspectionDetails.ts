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
      '前后间隔区之间的巡视与应急疏散通道，按规程严禁堆放任何施工物料或杂物。现场目视可见北侧扩建施工单位违规堆放木方与木托盘，无需测距，直接定级开具处置单并拍照取证要求清理。',
    safetyRequirement:
      '巡视与消防通道内严禁堆放木方、托盘与建筑垃圾；人员与 220kV 带电体保持 3.0 m 以上。',
  },
  'bay-temp': {
    pointId: 'bay-temp',
    voltageLevel: '220kV',
    bayName: '前侧开关间隔区 F02',
    equipmentType: '双柱水平旋转式隔离开关与三相引线接头',
    taskIntro:
      '220kV F02 间隔上方水平排列着左（A相·黄）、中（B相·绿）、右（C相·红）三组隔离开关触头与引线线夹。选用红外测温仪后，依次点击左、中、右三个相位的引线接头各测温 1 次（共测 3 次），系统自动提取三相最高温 T_max 与相间温差 ΔT 供定级判断。',
    safetyRequirement:
      '站在黄黑警戒线外同距同角依次点测 A、B、C 三相引线接头，与 220kV 带电体保持不小于 3.0 m。',
  },
  'hv-10kv': {
    pointId: 'hv-10kv',
    voltageLevel: '10kV',
    bayName: '公寓一层 10kV 配电室',
    equipmentType: '10kV 开关柜柜列（柜面内置温控/电压表）',
    taskIntro:
      '公寓一层 10kV 配电室光线较暗。柜面内置智能温控仪与电压表已直接显示三相母排温度与 10kV 母线电压读数，无需调用工具箱即可直接填写处置单；也可打开手电（选做）照亮柜内观察窗与电缆沟暗处排查隐患。',
    safetyRequirement:
      '配电室巡检注意脚下绝缘垫，禁止自行开启带电柜门；关闭处置单时手电照明将自动关闭。',
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
    equipmentType: '主变防火墙（东段空鼓 + 中段裂缝两处并列测点）',
    taskIntro:
      '1# 与 2# 主变之间的防火墙设两处并列检测位置：① 东段受潮区用空鼓棒敲击听音（清脆“叮当”实音为密实，沉闷“咚咚”空响为空鼓脱层）；② 中段接缝区用塞尺测量裂缝宽度。两处测完后在处置单勾选异常位置并统一定级。',
    safetyRequirement:
      '站在防火墙 1# 主变侧检查，不进入相邻带电 2# 主变通道；敲击与测缝时不得攀爬墙体。',
  },
  'a2-oil': {
    pointId: 'a2-oil',
    voltageLevel: '220kV',
    bayName: '1# 主变检修区',
    equipmentType: '1# 主变本体检测（油温 + 法兰油迹 + 接地力矩三处测点）',
    taskIntro:
      '1# 主变本体设三个并列检测点：① 本体上部测量顶层油温；② 底部放油阀法兰背光照亮检查有无渗油挂滴；③ 本体下部复核接地扁铁螺栓紧固力矩。三处检测完成后，在处置单勾选存在异常的部位并给出统一处置等级。',
    safetyRequirement:
      '1# 主变已停电，邻近 2# 主变带电；不得攀爬本体，不得在散热器上放置工具材料。',
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
