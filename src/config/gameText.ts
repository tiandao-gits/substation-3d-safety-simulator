import type { ToolType } from '../game/rules';

/**
 * 全站可展示文案唯一来源。
 * 剧情、旁白与角色对白统一放到 `src/config/dialogues.ts`（演出）与 `src/game/act1.ts`（检查点线索）。
 */

export interface BackpackToolText {
  id: ToolType;
  name: string;
  shortName: string;
  modelCode: string;
  rangeSpec: string;
  purpose: string;
}

/** 背包 3×3 九宫格，顺序与 public/assets/tools-3x3.jpg 的行列一一对应。 */
export const BACKPACK_TOOL_TEXT: BackpackToolText[] = [
  {
    id: 'multimeter',
    name: '数字万用表',
    shortName: '万用表',
    modelCode: 'FLUKE-289C True-RMS',
    rangeSpec: 'DC/AC 0~1000V · 精度 ±0.025%',
    purpose: '旋转档位至 DCV 或通断档，点测二次回路、直流控母电压与接地导通。',
  },
  {
    id: 'thermometer',
    name: '红外测温仪',
    shortName: '红外测温仪',
    modelCode: 'FLIR-T865 IR',
    rangeSpec: '-30~500°C · D:S 12:1 · 发射率可调',
    purpose: '对母线接头、柜内元件、电缆终端与设备外壳做同距离同角度温升扫描。',
  },
  {
    id: 'leakage',
    name: '漏电检测仪',
    shortName: '漏电检测仪',
    modelCode: 'ETCR-7400B 钳形剩余电流',
    rangeSpec: '0~2000mA · 分辨 0.1mA',
    purpose: '钳形夹持单根相线或整束电缆，测量配电箱漏电保护与电缆泄漏电流。',
  },
  {
    id: 'flashlight',
    name: '强光手电筒',
    shortName: '强光手电',
    modelCode: '防爆型 ≥1000 lm',
    rangeSpec: '≥1000 lm · IP67 防爆',
    purpose: '检查柜内、电缆沟、油位、渗漏与隐蔽部位外观。',
  },
  {
    id: 'torque',
    name: '力矩扳手',
    shortName: '力矩扳手',
    modelCode: '预置式 20–200 N·m',
    rangeSpec: '20~200 N·m · ±3%',
    purpose: '按设计值复核地脚螺栓、母线连接与接地扁钢螺栓紧固力矩。',
  },
  {
    id: 'hollow-hammer',
    name: '空鼓棒',
    shortName: '空鼓棒',
    modelCode: '检测锤 ≈200 g',
    rangeSpec: '锤头 ≈200 g',
    purpose: '敲击设备基础、防火墙与墙面抹灰层，排查空鼓与脱层。',
  },
  {
    id: 'laser',
    name: '激光测距仪',
    shortName: '激光测距仪',
    modelCode: 'BOSCH GLM 50-27C',
    rangeSpec: '0.05~50 m · ±1.5 mm · Ⅱ类激光',
    purpose: '非接触测量通道净宽、围栏与带电体距离、设备间距与安全净距，可在带电区外使用。',
  },
  {
    id: 'feeler',
    name: '塞尺',
    shortName: '塞尺',
    modelCode: '0.02–1.00mm · 17 片',
    rangeSpec: '0.02~1.00 mm',
    purpose: '检查柜列拼缝、法兰间隙、接地扁钢搭接与隔离开关触头夹紧。',
  },
  {
    id: 'caliper',
    name: '游标卡尺',
    shortName: '游标卡尺',
    modelCode: '0–150mm · 0.02mm',
    rangeSpec: '0~150 mm · 分辨 0.02 mm',
    purpose: '测量接地扁钢/圆钢规格、铜排厚度、导线线径与螺栓直径。',
  },
];

export const TOOL_NAME_MAP = Object.fromEntries(
  BACKPACK_TOOL_TEXT.map((tool) => [tool.id, tool.shortName])
) as Record<ToolType, string>;

export interface BackpackDisplayItem {
  key: string;
  label: string;
  image: string;
  toolId: ToolType;
  spriteCol: number;
  spriteRow: number;
}

export const TOOL_SHEET_IMAGE = `${import.meta.env.BASE_URL}assets/tools-3x3.jpg`;

export const BACKPACK_DISPLAY_ITEMS: BackpackDisplayItem[] =
  BACKPACK_TOOL_TEXT.map((tool, index) => ({
    key: tool.id,
    label: tool.name,
    image: TOOL_SHEET_IMAGE,
    toolId: tool.id,
    spriteCol: index % 3,
    spriteRow: Math.floor(index / 3),
  }));

export interface PpeItemText {
  name: string;
  spec: string;
}

export const PPE_ITEMS: PpeItemText[] = [
  {
    name: '绝缘安全帽及防电弧披肩',
    spec: 'GB 2811 标准 · 穿戴合规',
  },
  {
    name: '220kV 防电弧反光作业服',
    spec: 'ATPV ≥ 12 cal/cm² · 穿戴合规',
  },
  {
    name: '高压绝缘手套 (35kV级)',
    spec: '气密性试验合格 · 穿戴合规',
  },
  {
    name: '高压绝缘安全靴 (25kV级)',
    spec: '耐压防滑检验合格 · 穿戴合规',
  },
];

export const SAFETY_LABELS = {
  normal: '正常',
  warning: '告警',
  qualified: '达标',
  tooClose: '过近 (<3m)',
};

export const ZONE_NAMES = {
  mainEntrance: '主入口安全准入通道',
  parking: '门卫与工程车辆停放区',
  ringRoad: '站内环形沥青巡检路',
  transformerYard: '西侧主变碎石检修区',
  frontSwitchyard: '前侧 220kV 开关设备区',
  rearSwitchyard: '后侧 220kV 开关设备区',
  apartment10kv: '公寓一层 10kV 配电室',
  eastPlaza: '东侧主控楼前广场',
  concretePath: '站内混凝土巡检通道',
};

export interface KeyBinding {
  /** 同一动作的按键组合，例如 Q / Z 转向。 */
  keys: string[];
  label: string;
  /** 关键交互键用琥珀色强调。 */
  accent?: boolean;
  /** 标题页默认只展示核心按键，其余收进「查看全部按键」。 */
  core?: boolean;
}

/**
 * 快捷键唯一来源：标题页与帮助弹窗都渲染这份数据，按键处理也以它为准。
 * 新增按键时先改这里，再在 App 的 onKeyDown 里接线。
 */
export const KEY_BINDINGS: KeyBinding[] = [
  { keys: ['鼠标'], label: '移动转动视角（进入场景自动锁定）' },
  { keys: ['W', 'A', 'S', 'D'], label: '移动（方向键同样有效）', core: true },
  { keys: ['Shift'], label: '跑动' },
  { keys: ['Space'], label: '原地跳跃' },
  { keys: ['Q', 'Z'], label: '左右转向' },
  { keys: ['F'], label: '检查 / 进出门', accent: true, core: true },
  { keys: ['E'], label: '备忘录', accent: true, core: true },
  { keys: ['G'], label: '现场取证', accent: true, core: true },
  { keys: ['B'], label: '现场背包' },
  { keys: ['C'], label: '角色状态' },
  { keys: ['U'], label: '无人机空中视角', core: true },
  { keys: ['R'], label: '收回无人机' },
  { keys: ['V'], label: '第一 / 第三人称' },
  { keys: ['L'], label: '原色 / 白模' },
  { keys: ['M'], label: '静音切换' },
  { keys: ['P'], label: '系统设置' },
  { keys: ['H'], label: '操作说明' },
  { keys: ['X'], label: '关闭弹窗 / 面板' },
  { keys: ['Esc'], label: '释放鼠标', core: true },
];

export const GAME_TEXT = {
  appTitle: '220kV变电站安全生产3D仿真培训系统',

  title: {
    logoKicker: 'STATE GRID 220KV SUBSTATION SAFETY SUPERVISION',
    operator: '监理项目部 · 专业监理工程师（分管安全）陆川',
    headingLine1: '220kV 变电站安全监理',
    headingLine2: '单日三幕巡检 · 3D 实训',
    description:
      '同一天，三幕路：开关间隔与 10kV 配电室的正常巡检、1# 主变检修巡检、北侧施工现场检查。发现的问题要不要取证、怎么处置，由你判断。',
    startButton: '开始巡检实训 (Enter)',
    fppButton: '第一视角启动 (FPP)',
  },

  sceneLoad: {
    startLoading: '场景加载中…',
    startFailed: '场景加载失败',
    loading: '正在加载 3D 场景与角色资源…',
    loadingCharacter: '正在加载角色模型与动作…',
    finalizing: '资源已下载，正在完成场景初始化…',
    connecting: '连接中',
    loadFailed: '3D 场景加载失败',
    characterLoadFailed: '角色资源加载失败，请重试',
    retryButton: '重试',
  },

  hud: {
    avatarAria: '打开人物状态弹出框',
    avatarTitle: '查看巡检员状态档案',
    inspectorLine: '监理：陆川',
    heldToolPrefix: '手持：',
    progressLabel: '本幕日志',
    scoreLabel: '总分',
    chancesLabel: '检查机会',
    actLabel: '第 1/5 幕',
    exitButton: '退出培训',
    initialZoneName: '220kV 变电站',
    centerPlaque: '220kV 变电站 · 安全监理单日巡检',
    renderLabel: '渲染：',
    detailToggleTitle: '切换渲染模式 (L)',
  },

  help: {
    ariaLabel: '操作说明',
    buttonTitle: '操作说明 (H)',
    dialogAria: '操作说明',
    eyebrow: 'OPERATION MANUAL',
    title: '操作说明与快捷键',
    closeButton: '关闭 [H]',
  },

  exitConfirm: {
    dialogAria: '确认退出培训',
    eyebrow: 'EXIT TRAINING SESSION',
    title: '确认退出本次培训？',
    body: '当前巡检进度与日志已自动保存，退出后可在标题页继续。',
    continueButton: '继续培训',
    confirmButton: '确认退出',
  },

  drone: {
    rec: 'REC · 无人机高空观察视角',
    altitude: (altitude: string, x: string, z: string) =>
      `航高 ${altitude}m · 坐标 (${x}, ${z})`,
    protagonistStandby: '主角状态：地面原地待命',
    targetLabel: '高空观察：220kV 开关间隔区与主变区',
    recallButton: '结束巡检 · 收回无人机',
    recallAria: '结束无人机巡检并收回无人机',
  },

  bottomBanner: {
    regulationLabel: '安全规程',
    inspectLabel: '现场巡检',
    ready: '已就位',
    toolPrefix: '工具：',
    ledger: '巡检台账',
  },

  character: {
    dialogAria: '巡检员人物状态弹出框',
    eyebrow: 'PERSONNEL STATUS · SG-220-0842',
    title: '值班巡检员状态档案 — 张伟',
    closeButton: '关闭',
    labels: {
      status: '当前作业状态',
      clearance: '带电体安全净距',
      tool: '当前手持仪器',
      gait: '当前步态与视角',
    },
    statusSuffix: '（体征平稳）',
    clearanceValue: (distanceLabel: string, meters: number) =>
      `${distanceLabel}（${meters}m / 阈值 ≥3.0m）`,
    gait: {
      running: '跑步',
      walking: '步行',
    },
    perspective: {
      firstPerson: '第一视角',
      drone: '无人机空中视角',
      thirdPerson: '第三视角',
    },
    ppeTitle: '个人安全防护用具 (PPE) 穿戴核验',
    returnButton: '返回现场',
  },

  backpack: {
    dialogAria: '现场工具背包',
    eyebrow: 'FIELD TOOLKIT · 9 ITEMS',
    title: '现场工具背包',
    closeButton: '关闭 [B]',
    equippedAria: '当前已装备',
    equipAria: (label: string) => `装备${label}`,
    displayAria: (label: string) => `${label}（陈列工具）`,
    currentPrefix: '当前手持：',
    returnButton: '返回现场',
  },

  settings: {
    dialogAria: '系统设置与3D资产管理',
    eyebrow: 'SYSTEM CONFIGURATION · 3D ENGINE',
    title: '系统参数与 3D 模型资产挂载',
    closeButton: '关闭 [P]',
    perspectiveLabel: '视角：',
    perspectiveValues: {
      firstPerson: '第一人称',
      drone: '无人机',
      thirdPerson: '第三人称',
    },
    renderLabel: '渲染：',
    renderToggleTitle: '点击切换原色/白模',
    renderValues: {
      detailed: '原色',
      blockout: '白模',
    },
    clickToToggleHint: '点击切换',
    soundLabel: '声场：',
    soundValues: {
      muted: '已静音',
      on: '开启',
    },
    rolesTitle:
      'Mixamo 角色与动作 (Ch17_nonPBR / Standard Walk / Run Forward / Jump)',
    rolesBinding:
      '当前绑定：public/assets/roles/Ch17_nonPBR.fbx · Standard Walk.fbx · Run Forward.fbx · Jump.fbx',
    reloadRolesButton: '重载 roles 目录',
    chooseFbxButton: '选择 FBX',
    propTitle: 'Blender 变电设备道具 (.glb / .gltf / .fbx)',
    propHint: '将外部导出的变压器或避雷器模型挂载至前方工位',
    importPropButton: '导入道具',
    resetButton: '重置本轮培训',
    confirmButton: '确认并返回',
  },

  minimap: {
    ariaLabel: '变电站北向固定任务雷达',
  },
};

export const MESSAGES = {
  initialBanner:
    '已进入巡检区域。按 E 打开备忘录查看本幕任务；重要处置需附现场证据。',
  initialAssetStatus:
    '已挂载 Mixamo 角色：/assets/roles/Ch17_nonPBR.fbx | 行走：Standard Walk.fbx | 跑步：Run Forward.fbx | 跳跃：Jump.fbx',

  toolEquipped: (_name: string, _purpose: string) =>
    '已切换随身工具。',

  droneStandby: '当前处于空中视角，主角在地面保持原地待命。',
  gaitFast:
    '当前步态：快速巡视（6.6m/s），行进时请留意地面电缆沟盖板与警戒线。',
  gaitNormal:
    '当前步态：标准步行（3.6m/s），适合在设备安全工位内开展定点精测。',

  viewFirstPerson:
    '已切换至第一视角，可近距离读取仪表读数。',
  viewDrone:
    '已开启空中观察视角（主角原地待命）。本幕无取证任务。',
  viewThirdPerson: () =>
    '已返回地面第三视角。',

  apartmentDoorEnter:
    '已进入公寓一层 10kV 配电室。柜列带电运行，请沿巡视通道保持安全距离；按 F 可开门离开。',
  apartmentDoorExit:
    '已离开 10kV 配电室，蓝色大门已关闭。',
  apartmentDoorEnterPrompt: '进入 · 公寓 10kV 配电室',
  apartmentDoorExitPrompt: '离开 · 公寓 10kV 配电室',

  detailBlockout:
    '已切换至 Blender 灰白白模视图，场景布局与碰撞保持不变。',
  detailDetailed:
    '已切换至 Blender 原色材质视图，场景布局与碰撞保持不变。',

  droneCruise: (x: string, z: string) =>
    `无人机已巡航至上空坐标 (${x}, ${z})，主角在地面保持原地待命。`,
  teleported: (x: string, z: string) =>
    `已移动至坐标 (${x}, ${z})，请保持高压带电安全距离。`,

  mixamoParsing: (fileNames: string) =>
    `正在解析 Mixamo 角色/动作文件 (${fileNames})...`,
  mixamoLoadFailed: (message: string) => `加载失败: ${message}`,
  mixamoFileFormatHint: '请确认文件格式为 .glb 或 .fbx',
  blenderPropLoading: (fileName: string) =>
    `正在加载 Blender 道具模型: ${fileName}...`,
  blenderPropLoadFailed: (message: string) => `加载失败: ${message}`,
  propFileFormatHint: '请确认文件格式为 .glb / .gltf / .fbx',
  propMounted: (x: string, z: string, fileName: string) =>
    `成功在坐标 (${x}, ${z}) 挂载 Blender 道具: ${fileName}`,

  jumpTriggered:
    '原地跳跃已触发：起跳、腾空与落地缓冲将与实际滞空时间同步。',
  jumpMustStop:
    '原地跳跃需先停稳：请松开 WASD/方向键，待步伐停止后再按 Space。',

  skyboxLoadFailed: '无法加载 360°天空盒背景 skybox-8k.webp:',

  substationSceneLoadFailed: '无法加载变电站白模场景:',
  substationSceneLoadError: '变电站 3D 场景加载失败',

  mixamoRoleModel: 'Ch17_nonPBR.fbx (角色模型)',
  mixamoWalkClip: 'Standard Walk.fbx (行走动作)',
  mixamoRunClip: 'Run Forward.fbx (跑步动作)',
  mixamoJumpClip: 'Jump.fbx (跳跃动作)',
  mixamoAssetsLoaded: (summary: string) =>
    `已加载 Mixamo 资产: ${summary}`,
  mixamoBuiltIn: '已启用内置 Mixamo Ch17 角色与标准动作',
  noFileSelected: '未选择文件',
  mixamoFilesLoaded: (names: string) =>
    `已加载 Mixamo 角色与动作: ${names}`,
};

/** 场景内 canvas 绘制的警示牌与设备铭牌文字（textures.ts 唯一来源）。 */
export const SCENE_SIGN_TEXT = {
  noClimbBanner: '禁止攀登，高压有电',
  highVoltageDanger: '高压危险',
  conservatorTitle: '储油柜',
  conservatorSubtitle: '油位刻度监视',
};

/** 拖入 Mixamo 动作文件时按文件名归类（小写包含匹配）。 */
export const MIXAMO_FILENAME_KEYWORDS: Record<'walk' | 'run' | 'jump', string[]> = {
  walk: ['walk', 'walking'],
  run: ['run', 'running', 'sprint', 'jog'],
  jump: ['jump', 'jumping', 'leap'],
};
