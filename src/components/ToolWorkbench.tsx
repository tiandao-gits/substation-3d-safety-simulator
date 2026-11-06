import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Crosshair,
  Flashlight,
  Plane,
  ScanLine,
  ShieldCheck,
  Square,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import {
  ACT_AMBIENT,
  dispositionNeedsEvidence,
  type Act1ActionSpec,
  type Act1Grade,
  type Act1PointDef,
  type Act1PermitSignoff,
  type Act1Reading,
  type Act1Tool,
  type Act1Variant,
} from '../game/act1';
import { DISPOSITION_PROFILES } from '../config/disposition';
import { INSPECTION_POINT_DETAILS } from '../config/inspectionDetails';
import {
  buildInspectionReadout,
  type InspectionReadout,
} from '../config/inspectionReadouts';
import { BACKPACK_DISPLAY_ITEMS } from '../config/gameText';
import { useHudSnapshot } from '../game/hudStore';
import { soundEngine } from '../game/sound';
import {
  generateWorkPermitRoster,
  setFocusedCrewSlot,
  type WorkPermitPlayerJudgment,
  type WorkPermitRoster,
} from '../game/workPermit';
import { useFocusTrap } from './useFocusTrap';
import { ToolSprite } from './ToolSprite';
import {
  ReadoutMetrics,
  SceneMenu,
  SceneReadoutFrame,
  type SceneMenuItem,
} from './SceneMenu';
import {
  CrewReadout,
  CrewStage,
  WorkPermitPanel,
  buildCrewMenuItems,
  crewMenuKey,
  useCrewFocus,
} from './WorkPermitPanel';

type BayPhaseKey = 'A' | 'B' | 'C';

interface BayPhaseSpec {
  phase: BayPhaseKey;
  title: string;
  positionDesc: string;
  colorBadge: string;
  /** 3D 视窗归一化位置 (%) */
  leftPct: number;
  topPct: number;
}

const BAY_PHASE_SPECS: BayPhaseSpec[] = [
  {
    phase: 'A',
    title: '测点1 · A 相（左列引线线夹）',
    positionDesc: 'F02 间隔西侧左列 · 黄色相标静触头与引线线夹连接处',
    colorBadge: 'border-amber-400 bg-amber-500/20 text-amber-200',
    leftPct: 24,
    topPct: 44,
  },
  {
    phase: 'B',
    title: '测点2 · B 相（中列引线线夹）',
    positionDesc: 'F02 间隔中部中列 · 绿色相标静触头与引线线夹连接处',
    colorBadge: 'border-emerald-400 bg-emerald-500/20 text-emerald-200',
    leftPct: 51,
    topPct: 41,
  },
  {
    phase: 'C',
    title: '测点3 · C 相（右列引线线夹）',
    positionDesc: 'F02 间隔东侧右列 · 红色相标静触头与引线线夹连接处',
    colorBadge: 'border-rose-400 bg-rose-500/20 text-rose-200',
    leftPct: 77,
    topPct: 44,
  },
];

interface MultiPointSiteOption {
  id: string;
  label: string;
  locationHint: string;
  measuredSummary: string;
}

interface ToolWorkbenchProps {
  point: Act1PointDef;
  seed?: number;
  variant?: Act1Variant;
  covered: boolean;
  observed: boolean;
  completedActions: string[];
  resolved: boolean;
  disposition?: Act1Grade;
  evidenceAttached: boolean;
  evidenceDataUrl?: string;
  evidencePerspective?: 'drone';
  readings: Act1Reading[];
  reviewChances?: number;
  message?: string | null;
  /** 班前会名册签注记录（结论存于幕状态，关掉处置单再打开仍然保留）。 */
  permitSignoff?: Act1PermitSignoff | null;
  onSyncRosterTo3D?: (roster: WorkPermitRoster) => void;
  onToggleFlashlight?: (force?: boolean) => void;
  onPermitSign: (judgment: WorkPermitPlayerJudgment) => void;
  onToolAction: (tool: Act1Tool | 'visual', actionId: string) => void;
  onDisposition: (grade: Act1Grade) => void;
  onCapture: () => void;
  onRequestDrone: () => void;
  onClose: () => void;
}

/**
 * 巡检工作台分两栏：
 * - 左栏（桌面）：3D 实景特写 + 仪器检测靶点 + 遥测读数屏，是"做检查"的地方；
 * - 右栏：处置单，负责异常部位勾选（多点巡检）与填结论（处置结果 → 取证 → 提交）。
 */
export function ToolWorkbench({
  point,
  seed = 1024,
  variant = 'A',
  covered,
  observed,
  completedActions,
  resolved,
  disposition,
  evidenceAttached,
  evidenceDataUrl,
  evidencePerspective,
  readings,
  reviewChances = 0,
  message,
  permitSignoff = null,
  onSyncRosterTo3D,
  onToggleFlashlight,
  onPermitSign,
  onToolAction,
  onDisposition,
  onCapture,
  onRequestDrone,
  onClose,
}: ToolWorkbenchProps) {
  const ref = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  const hud = useHudSnapshot();

  const detail = INSPECTION_POINT_DETAILS[point.id];
  const profileDef = DISPOSITION_PROFILES[point.profile];
  const needsEvidence = dispositionNeedsEvidence(disposition);
  const selectedOption = profileDef.options.find(
    (option) => option.grade === disposition
  );

  const [drawerAction, setDrawerAction] = useState<Act1ActionSpec | null>(null);
  /** BAY 设备三相测温：记录已测过的相别（A / B / C）及是否已手持红外测温仪 */
  const [measuredBayPhases, setMeasuredBayPhases] = useState<BayPhaseKey[]>([]);
  const [bayThermoEquipped, setBayThermoEquipped] = useState(false);
  const [pendingBayPhase, setPendingBayPhase] = useState<BayPhaseKey | null>(
    null
  );
  /** 多点巡检（BAY 三相、主变防火墙两处、主变本体三处）在处置单上的异常部位多选框 */
  const [checkedDefectSites, setCheckedDefectSites] = useState<string[]>([]);

  const isCrewPoint = point.id === 'a2-crew';
  const isHv10kvPoint = point.id === 'hv-10kv';
  const isAislePoint = point.id === 'aisle';
  const isBayTempPoint = point.id === 'bay-temp';

  const completedIds = useMemo(
    () => new Set(completedActions),
    [completedActions]
  );

  // 如果打开 bay-temp 时 ir-3 已经完成，同步把 A/B/C 三相标为已测
  useEffect(() => {
    if (isBayTempPoint && completedIds.has('ir-3')) {
      setMeasuredBayPhases(['A', 'B', 'C']);
      setBayThermoEquipped(true);
    }
  }, [isBayTempPoint, completedIds]);

  const bayPhaseTemps = useMemo<Record<BayPhaseKey, number>>(
    () => ({
      A: 43.2,
      B: variant === 'B' ? 92.4 : 43.7,
      C: 43.4,
    }),
    [variant]
  );

  /** 班前会名册与 3D 现场人员同源：左栏人员列表与右栏名册共用同一份 roster。 */
  const permitRoster = useMemo(
    () => generateWorkPermitRoster(seed, variant, 0),
    [seed, variant]
  );
  /** 左上菜单的选中项：班前会是人员槽位，其余巡检点是检测项。 */
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const { focusedSlot, select: selectCrewSlot } = useCrewFocus();

  useEffect(() => {
    if (!isCrewPoint) return;
    onSyncRosterTo3D?.(permitRoster);
    return () => {
      setFocusedCrewSlot(null);
    };
  }, [isCrewPoint, permitRoster, onSyncRosterTo3D]);

  useEffect(() => {
    if (!needsEvidence) return;
    const id = window.requestAnimationFrame(() => {
      evidenceRef.current?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [needsEvidence]);

  const handleCloseWorkbench = () => {
    onToggleFlashlight?.(false);
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'KeyG') {
        event.preventDefault();
        event.stopPropagation();
        if (covered && needsEvidence) onCapture();
      } else if (event.code === 'KeyT' && isHv10kvPoint) {
        event.preventDefault();
        event.stopPropagation();
        const nextFlash = !hud.flashlightOn;
        onToggleFlashlight?.(nextFlash);
        if (nextFlash && !completedIds.has('cabinet-light')) {
          onToolAction('flashlight', 'cabinet-light');
        } else {
          soundEngine.playAuxiliaryTool('flashlight');
        }
      } else if (event.code === 'KeyX') {
        event.preventDefault();
        event.stopPropagation();
        if (drawerAction) setDrawerAction(null);
        else handleCloseWorkbench();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    covered,
    needsEvidence,
    onCapture,
    drawerAction,
    isHv10kvPoint,
    hud.flashlightOn,
    completedIds,
    onToggleFlashlight,
    onToolAction,
  ]);

  const { requiredDetectionActions, auxiliaryDetectionActions } = useMemo(() => {
    const droneRecon: Act1ActionSpec[] = point.requiredActions.includes(
      'drone-recon'
    )
      ? [
          {
            id: 'drone-recon',
            label: '升空观察取证',
            tool: 'visual',
            quality: 'ok',
          },
        ]
      : [];
    const allToolActions = Object.values(point.actions)
      .flat()
      .filter(
        (spec): spec is Act1ActionSpec =>
          Boolean(spec) && spec.id !== 'visual' && spec.quality === 'ok'
      );
    const reqIds = new Set(point.requiredActions);
    const required = [
      ...droneRecon,
      ...allToolActions.filter((spec) => reqIds.has(spec.id)),
    ];
    const auxiliary = allToolActions.filter((spec) => !reqIds.has(spec.id));
    return {
      requiredDetectionActions: required,
      auxiliaryDetectionActions: auxiliary,
    };
  }, [point.actions, point.requiredActions]);

  /**
   * 触发 BAY 设备某相测温：
   * - 若尚未从工具箱取出红外测温仪，先打开工具箱让玩家选择红外测温仪；
   * - 选对一次后红外测温仪保持在手，直接点击 A / B / C 三相即可完成各相测温；
   * - 当 A、B、C 三相全部测完（共 3 次）后，自动完成 ir-3 并提取最高相温度 T_max。
   */
  const triggerBayPhaseMeasure = (phase: BayPhaseKey) => {
    setSelectedActionId(`bay-phase-${phase}`);
    if (completedIds.has('ir-3')) return;

    if (!bayThermoEquipped) {
      setPendingBayPhase(phase);
      setDrawerAction({
        id: 'ir-3',
        label: `点测 ${phase} 相引线线夹温度（选定仪器后依次点测 A/B/C 三相）`,
        tool: 'thermometer',
        quality: 'ok',
      });
      return;
    }

    const nextPhases = measuredBayPhases.includes(phase)
      ? measuredBayPhases
      : [...measuredBayPhases, phase];
    setMeasuredBayPhases(nextPhases);
    const isPhaseHot = phase === 'B' && variant === 'B';
    soundEngine.playThermalScan(isPhaseHot);

    if (nextPhases.length >= 3 && !completedIds.has('ir-3')) {
      onToolAction('thermometer', 'ir-3');
    }
  };

  /** 检测项菜单：根据不同巡检点定制清晰直观的交互项。 */
  const detectionMenuItems: SceneMenuItem[] = useMemo(() => {
    // 1. 10kV 配电室：柜面内置表直读（无需工具箱）+ 选做手电筒暗处观察
    if (isHv10kvPoint) {
      const darkChecked = completedIds.has('cabinet-light');
      return [
        {
          key: 'ir-3',
          label: '读取柜面内置温控/电压表',
          sublabel: '机房内置仪表直读 · 已完成',
          glyph: 'thermometer',
          done: true,
          disabled: false,
          onSelect: () => {
            setSelectedActionId('ir-3');
            if (!completedIds.has('ir-3')) {
              onToolAction('thermometer', 'ir-3');
            }
          },
        },
        {
          key: 'cabinet-light',
          label: hud.flashlightOn
            ? '手电筒照明：已开启（点击关闭）'
            : '打开手电观察暗处（选做）',
          sublabel: hud.flashlightOn
            ? '圆形照明跟随移动 · 关单自动关闭'
            : darkChecked
              ? '暗处隐患已排查 · 点击再次开关手电'
              : '选做 · 检查观察窗与电缆沟暗处隐患',
          glyph: 'flashlight',
          emphasis: 'secondary',
          done: darkChecked,
          disabled: false,
          onSelect: () => {
            setSelectedActionId('cabinet-light');
            const nextFlash = !hud.flashlightOn;
            onToggleFlashlight?.(nextFlash);
            if (!darkChecked) {
              onToolAction('flashlight', 'cabinet-light');
            } else {
              soundEngine.playAuxiliaryTool('flashlight');
            }
          },
        },
      ];
    }

    // 2. 巡视通道：严禁堆物，目视已确认违规堆放木方/托盘，无需测距直接填单
    if (isAislePoint) {
      return [
        {
          key: 'visual',
          label: '现场目视：通道违规堆放物料',
          sublabel: '无需测距 · 直接填写右侧处置单',
          glyph: 'visual',
          done: true,
          disabled: false,
          onSelect: () => {
            setSelectedActionId('visual');
          },
        },
      ];
    }

    // 3. BAY 设备温度：明确展示左(A)、中(B)、右(C)三个相位位置，依次测温 3 次取最高值
    if (isBayTempPoint) {
      const allDone = completedIds.has('ir-3');
      return BAY_PHASE_SPECS.map((spec) => {
        const phaseDone = allDone || measuredBayPhases.includes(spec.phase);
        const tempVal = bayPhaseTemps[spec.phase];
        return {
          key: `bay-phase-${spec.phase}`,
          label: spec.title,
          sublabel: phaseDone
            ? `已测温：${tempVal.toFixed(1)} ℃`
            : bayThermoEquipped
              ? '点击直接测温（手持测温仪）'
              : '点击选用测温仪器并点测该相',
          glyph: 'thermometer',
          done: phaseDone,
          disabled: !observed,
          onSelect: () => triggerBayPhaseMeasure(spec.phase),
        };
      });
    }

    // 4. 其余巡检点（主变防火墙两处并列位置、主变本体三处并列位置、第三幕等）
    return [
      ...requiredDetectionActions.map((action, idx) => {
        const done = completedIds.has(action.id) || covered;
        const isParallelMulti =
          point.id === 'a2-wall' || point.id === 'a2-oil';
        return {
          key: action.id,
          label: action.label,
          sublabel: done
            ? '已检测完成'
            : action.id === 'drone-recon'
              ? '升空取证'
              : isParallelMulti
                ? `并列检测点 ${idx + 1}/${requiredDetectionActions.length}`
                : '必测项',
          glyph: action.id === 'drone-recon' ? ('drone' as const) : action.tool,
          done,
          disabled: !observed || (action.id === 'drone-recon' && done),
          onSelect: () => {
            setSelectedActionId(action.id);
            if (action.id === 'drone-recon') {
              onRequestDrone();
              return;
            }
            setDrawerAction(action);
          },
        };
      }),
      ...auxiliaryDetectionActions.map((action) => {
        const done = completedIds.has(action.id);
        return {
          key: action.id,
          label: action.label,
          sublabel: done ? '已完成' : '选做复核',
          glyph: action.tool,
          emphasis: 'secondary' as const,
          done,
          disabled: !observed,
          onSelect: () => {
            setSelectedActionId(action.id);
            setDrawerAction(action);
          },
        };
      }),
    ];
  }, [
    isHv10kvPoint,
    isAislePoint,
    isBayTempPoint,
    completedIds,
    covered,
    observed,
    hud.flashlightOn,
    measuredBayPhases,
    bayThermoEquipped,
    bayPhaseTemps,
    requiredDetectionActions,
    auxiliaryDetectionActions,
    point.id,
    onRequestDrone,
    onToggleFlashlight,
    onToolAction,
  ]);

  /** 班前会点位上，左上菜单换成人员列表；其余点位是检测项菜单。 */
  const sceneMenuItems = useMemo(
    () =>
      isCrewPoint
        ? buildCrewMenuItems(permitRoster, selectCrewSlot)
        : detectionMenuItems,
    [isCrewPoint, permitRoster, selectCrewSlot, detectionMenuItems]
  );

  const selectedActionKey =
    selectedActionId &&
    detectionMenuItems.some((item) => item.key === selectedActionId)
      ? selectedActionId
      : detectionMenuItems[0]?.key ?? null;

  const sceneMenuSelection = isCrewPoint
    ? crewMenuKey(focusedSlot)
    : selectedActionKey;

  const handleDrawerSelect = (toolId: Act1Tool) => {
    if (!drawerAction) return;
    const action = drawerAction;
    if (action.tool !== toolId) {
      setDrawerAction(null);
      setPendingBayPhase(null);
      onToolAction(toolId, 'invalid');
      return;
    }

    setDrawerAction(null);

    // BAY 设备三相测温：不再弹出“三种测温方式”弹窗，直接装备测温仪并完成当前点击相位的测温
    if (isBayTempPoint && action.id === 'ir-3') {
      setBayThermoEquipped(true);
      const targetPhase = pendingBayPhase ?? 'A';
      setPendingBayPhase(null);
      const nextPhases = measuredBayPhases.includes(targetPhase)
        ? measuredBayPhases
        : [...measuredBayPhases, targetPhase];
      setMeasuredBayPhases(nextPhases);
      const isPhaseHot = targetPhase === 'B' && variant === 'B';
      soundEngine.playThermalScan(isPhaseHot);
      if (nextPhases.length >= 3 && !completedIds.has('ir-3')) {
        onToolAction('thermometer', 'ir-3');
      }
      return;
    }

    onToolAction(toolId, action.id);
  };

  const ambientC = ACT_AMBIENT[point.act].temperatureC;

  /**
   * 3D 窗口读数模型：
   * - 对 BAY 设备：即使只测了 1~2 相，也实时显示已测各相温度与当前最高值预览；测满 3 相后锁定最终最高温与最大相间温差。
   */
  const readout = useMemo<InspectionReadout | null>(() => {
    const standard = buildInspectionReadout(
      point,
      readings,
      completedActions,
      variant
    );
    if (standard) return standard;

    if (isBayTempPoint && measuredBayPhases.length > 0) {
      const measuredList = BAY_PHASE_SPECS.filter((s) =>
        measuredBayPhases.includes(s.phase)
      );
      const temps = measuredList.map((s) => bayPhaseTemps[s.phase]);
      const currentPeak = Math.max(...temps);
      return {
        primary: {
          key: 'partial-peak',
          label: `已测 ${measuredList.length}/3 相 · 当前最高温`,
          value: currentPeak.toFixed(1),
          unit: '℃',
        },
        secondary: BAY_PHASE_SPECS.map((s) => ({
          key: `phase-${s.phase}`,
          label: `${s.phase} 相（${s.phase === 'A' ? '左列' : s.phase === 'B' ? '中列' : '右列'}线夹）`,
          value: measuredBayPhases.includes(s.phase)
            ? bayPhaseTemps[s.phase].toFixed(1)
            : '待点测',
          unit: measuredBayPhases.includes(s.phase) ? '℃' : '',
        })),
        note: `请继续点击剩余相位完成全部 3 次测温（已测 ${measuredList.length}/3），测齐三相后自动提取最高相温度判级`,
      };
    }

    return null;
  }, [
    point,
    readings,
    completedActions,
    variant,
    isBayTempPoint,
    measuredBayPhases,
    bayPhaseTemps,
  ]);

  /**
   * 多点检查项目（BAY 三相、主变防火墙两处位置、主变本体三处位置）：
   * 在右侧处置单提供“异常位置多选框”，勾选哪个位置有问题，处置结果仍保持唯一等级。
   */
  const multiPointSiteOptions = useMemo<MultiPointSiteOption[]>(() => {
    if (point.id === 'bay-temp') {
      const allMeasured =
        completedIds.has('ir-3') || measuredBayPhases.length === 3;
      return BAY_PHASE_SPECS.map((s) => ({
        id: `bay-${s.phase}`,
        label: `${s.phase} 相引线线夹（${s.phase === 'A' ? '左列·黄' : s.phase === 'B' ? '中列·绿' : '右列·红'}）`,
        locationHint: s.positionDesc,
        measuredSummary:
          allMeasured || measuredBayPhases.includes(s.phase)
            ? `实测 ${bayPhaseTemps[s.phase].toFixed(1)} ℃`
            : '待测温',
      }));
    }
    if (point.id === 'a2-wall') {
      const hollowDone = completedIds.has('wall-hollow');
      const crackDone = completedIds.has('wall-crack');
      const isDefect = variant === 'B';
      return [
        {
          id: 'wall-east-hollow',
          label: '位置1：防火墙东段受潮抹面（空鼓脱层检查）',
          locationHint: '1# 主变侧靠东段墙面抹灰层',
          measuredSummary: hollowDone
            ? isDefect
              ? '沉闷“咚咚”空响（290 Hz / 脱层空鼓）'
              : '清脆“叮当”实音（195 Hz / 抹面密实）'
            : '待敲击听音',
        },
        {
          id: 'wall-mid-crack',
          label: '位置2：防火墙中段接缝墙面（裂缝宽度检查）',
          locationHint: '防火墙中部抹面收缩/沉降缝处',
          measuredSummary: crackDone
            ? isDefect
              ? '裂缝宽度 1.80 mm（超 0.30 mm 限值）'
              : '表层细纹 0.12 mm（正常 ≤ 0.30 mm）'
            : '待测裂缝宽度',
        },
      ];
    }
    if (point.id === 'a2-oil') {
      const tempDone = completedIds.has('oil-temp');
      const lightDone = completedIds.has('oil-light');
      const torqueDone = completedIds.has('ground-torque');
      const isDefect = variant === 'C';
      return [
        {
          id: 'oil-top-temp',
          label: '测点1：主变本体上部（顶层油温与油位）',
          locationHint: '1# 主变本体顶层温度计与油枕油位表',
          measuredSummary: tempDone
            ? isDefect
              ? '顶层油温 96.2 ℃ · 油位偏低'
              : '顶层油温 64.2 ℃ · 油位正常'
            : '待测顶层油温',
        },
        {
          id: 'oil-bottom-flange',
          label: '测点2：主变底部放油阀法兰（渗漏油迹检查）',
          locationHint: '主变本体底部放油阀法兰与防油围堰',
          measuredSummary: lightDone
            ? isDefect
              ? '法兰边缘见新鲜渗油挂滴与油膜'
              : '法兰密封垫完好无油迹'
            : '待照亮查油迹',
        },
        {
          id: 'oil-ground-bolt',
          label: '测点3：主变本体下部（接地引下线螺栓力矩）',
          locationHint: '主变本体接地扁铁连接螺栓',
          measuredSummary: torqueDone
            ? '紧固力矩 42 N·m（标准 ≥ 40 N·m）'
            : '待复核力矩',
        },
      ];
    }
    return [];
  }, [
    point.id,
    completedIds,
    measuredBayPhases,
    bayPhaseTemps,
    variant,
  ]);

  const toggleDefectSite = (siteId: string) => {
    setCheckedDefectSites((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    );
  };

  const requiresSiteSelection =
    multiPointSiteOptions.length > 0 &&
    Boolean(disposition) &&
    disposition !== 'P0';
  const siteSelectionSatisfied =
    !requiresSiteSelection || checkedDefectSites.length > 0;
  const canSubmit = resolved && siteSelectionSatisfied;

  const statusText = !resolved
    ? needsEvidence && !evidenceAttached
      ? `${disposition} 级处置需附现场证据后才能提交。`
      : covered
        ? '请选择处置等级。'
        : '请先在左侧完成各测点检查。'
    : !siteSelectionSatisfied
      ? '请勾选上方存在异常的具体检测位置（多选框）。'
      : '填写完整，可提交。';

  return (
    <>
      <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center lg:justify-between overflow-hidden bg-slate-950/25 lg:bg-transparent p-3 pointer-events-auto select-none sm:p-5 lg:px-7">
        {/* Left-Side 3D Viewport：不铺任何底色，实景 100% 透出 */}
        <div className="relative hidden lg:flex h-[86vh] flex-1 mr-6 flex-col justify-between pointer-events-auto">
          <div className="flex items-start justify-between gap-3">
            {/* 左上：可选项目菜单（巡检检测项 / 班前会人员，同一套外观 + 滑动强调框） */}
            <div className="w-[320px] max-w-[56%]">
              <SceneMenu
                items={sceneMenuItems}
                selectedKey={sceneMenuSelection}
                ariaLabel={isCrewPoint ? '班前会人员列表' : '现场检测项'}
              />
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded border border-sky-400/40 bg-slate-950/80 px-2.5 py-1 font-mono text-[11px] text-sky-200 shadow-lg">
                <ScanLine className="h-3.5 w-3.5 text-sky-400" />
                <span>3D 实景 · {detail?.bayName ?? point.zone}</span>
              </div>

              {/* 10kV 配电室专属：手电筒圆形照明快捷开关 */}
              {isHv10kvPoint && (
                <button
                  type="button"
                  onClick={() => {
                    const nextFlash = !hud.flashlightOn;
                    onToggleFlashlight?.(nextFlash);
                    if (!completedIds.has('cabinet-light')) {
                      onToolAction('flashlight', 'cabinet-light');
                    } else {
                      soundEngine.playAuxiliaryTool('flashlight');
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-bold shadow-lg transition-colors cursor-pointer ${
                    hud.flashlightOn
                      ? 'border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'border-sky-400/50 bg-slate-950/85 text-sky-100 hover:border-amber-300 hover:text-amber-200'
                  }`}
                >
                  <Flashlight className="h-3.5 w-3.5" />
                  <span>
                    [T] 手电筒照明：{hud.flashlightOn ? '开启中（关单自动关闭）' : '点击开启（观察暗处）'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* BAY 设备温度专属：在 3D 视窗左/中/右三相引线接头位置叠加可点击的实景测温靶点 */}
          {isBayTempPoint && (
            <div className="pointer-events-none relative flex-1 my-2">
              <div className="pointer-events-auto absolute top-2 right-0 rounded-md border border-sky-400/40 bg-slate-950/85 px-3 py-2 text-xs text-slate-200 shadow-lg max-w-[330px]">
                <div className="font-bold text-sky-300">
                  三相测温操作指引（共测 3 次，取最高值判级）
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-300">
                  依次点击画面中 <span className="font-bold text-amber-300">A相(左)</span>、
                  <span className="font-bold text-emerald-300">B相(中)</span>、
                  <span className="font-bold text-rose-300">C相(右)</span> 引线线夹靶点各测温一次（已测{' '}
                  <span className="font-mono font-bold text-white">
                    {completedIds.has('ir-3') ? 3 : measuredBayPhases.length}/3
                  </span>
                  ），系统自动对比三相并求取最高温 <span className="font-mono text-sky-300">T_max</span>。
                </p>
              </div>

              {BAY_PHASE_SPECS.map((spec) => {
                const isMeasured =
                  completedIds.has('ir-3') ||
                  measuredBayPhases.includes(spec.phase);
                const temp = bayPhaseTemps[spec.phase];
                return (
                  <button
                    key={spec.phase}
                    type="button"
                    onClick={() => triggerBayPhaseMeasure(spec.phase)}
                    style={{
                      left: `${spec.leftPct}%`,
                      top: `${spec.topPct}%`,
                    }}
                    className={`pointer-events-auto group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer transition-transform hover:scale-105`}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-[0_0_24px_rgba(2,6,23,0.8)] transition-colors ${
                        isMeasured
                          ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300'
                          : 'border-sky-300 bg-slate-950/85 text-sky-200 group-hover:border-amber-300 group-hover:text-amber-200'
                      }`}
                    >
                      {isMeasured ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Crosshair className="h-5 w-5" />
                      )}
                    </span>
                    <span
                      className={`whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] font-bold shadow-md backdrop-blur-xs ${spec.colorBadge}`}
                    >
                      {spec.phase} 相（{spec.phase === 'A' ? '左列' : spec.phase === 'B' ? '中列' : '右列'}线夹）
                      {isMeasured ? ` · ${temp.toFixed(1)}℃` : ' · 点击测温'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 主变防火墙专属：在 3D 视窗叠加敲击声音辨识说明卡 */}
          {point.id === 'a2-wall' && completedIds.has('wall-hollow') && (
            <div className="my-auto self-start rounded-lg border border-amber-400/50 bg-slate-950/90 px-3.5 py-2.5 text-xs text-slate-100 shadow-lg max-w-[360px]">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Volume2 className="h-4 w-4 shrink-0" />
                <span>
                  空鼓棒原位敲击听音结果：
                  {variant === 'B' ? '沉闷“咚咚”空响' : '清脆“叮当”实音'}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-4 text-slate-300">
                {variant === 'B'
                  ? '东段受潮墙面敲击时声音发闷、回音拖尾长（290 Hz / 120 ms），表明抹灰层与砖混基层已脱层中空；请结合位置2裂缝宽度勾选异常位置。'
                  : '东段墙面敲击时声音清脆短促（195 Hz / 40 ms），表明抹灰层与基层粘结密实，无空鼓脱层。'}
              </p>
            </div>
          )}

          {/* 底部读数位：班前会是人员核对卡，其余点位是同一套 SceneReadoutFrame 遥测读数屏 */}
          {isCrewPoint ? (
            <CrewReadout roster={permitRoster} focusedSlot={focusedSlot} />
          ) : (
            readout && (
              <SceneReadoutFrame
                title={
                  isHv10kvPoint
                    ? '机房柜面内置仪表直读屏（温控仪 + 电压表）'
                    : isAislePoint
                      ? '巡视通道现场目视记录'
                      : '3D 现场遥测读数屏'
                }
                right={`环温 T₀ = ${ambientC} ℃`}
              >
                <ReadoutMetrics readout={readout} />
              </SceneReadoutFrame>
            )
          )}
        </div>

        {/* Right-Side Disposition Sheet */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`处置单：${point.name}`}
          className="modal-panel relative flex h-[86vh] max-h-[92vh] w-full max-w-[560px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-amber-500 bg-white text-left text-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.55)]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.16em] text-amber-700">
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span>处置单 · DISPOSITION</span>
                <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] tracking-normal text-amber-800">
                  {detail?.voltageLevel ?? '220kV'}
                </span>
              </div>
              <h2 className="mt-1 truncate text-base font-bold tracking-wide text-slate-900">
                {point.name}
              </h2>
              <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                {detail?.bayName ?? point.zone}
                {detail?.equipmentType ? ` · ${detail.equipmentType}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseWorkbench}
              className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              [X] 关闭
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
            {isCrewPoint ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <div className="min-w-0 text-[11.5px] leading-4 text-amber-900">
                  <span className="font-bold">安规要点 </span>
                  {detail?.safetyRequirement ?? '证件不在有效期内的人员，不得进入检修作业面。'}
                </div>
              </div>
            ) : (
              <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="mb-1 text-xs font-bold tracking-wide text-slate-700">
                  巡检点说明
                </h3>
                <p className="text-[12.5px] leading-5 text-slate-700">
                  {detail?.taskIntro ?? point.clue}
                </p>
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <div className="min-w-0 text-[11.5px] leading-4 text-amber-900">
                    <span className="font-bold">安规要点 </span>
                    {detail?.safetyRequirement ?? '与带电体保持 3 m 以上。'}
                  </div>
                </div>
              </section>
            )}

            {/* 第二幕 1# 主变检修班前会专属：名册逐人核验（3D 近景机位在左侧视窗） */}
            {isCrewPoint && (
              <WorkPermitPanel
                roster={permitRoster}
                permitSigned={Boolean(permitSignoff)}
                signedEntries={permitSignoff?.entries}
                onSign={onPermitSign}
              />
            )}

            {/* 窄屏看不到左侧 3D：人员列表与档案同样要能操作 */}
            {isCrewPoint && (
              <div className="lg:hidden">
                <CrewStage
                  roster={permitRoster}
                  focusedSlot={focusedSlot}
                  onSelect={selectCrewSlot}
                />
              </div>
            )}

            {/* 窄屏没有左侧 3D 视窗：仪器检测在这里完成，避免流程断掉 */}
            {!isCrewPoint && !isAislePoint && (
              <section className="rounded-lg border border-sky-200 bg-sky-50/70 p-3 lg:hidden">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wide text-sky-900">
                    现场操作
                  </h3>
                  <span className="text-[10.5px] text-sky-700">
                    桌面端在左侧 3D 视窗操作
                  </span>
                </div>

                <div className="mt-2 space-y-1.5">
                  {sceneMenuItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-slate-800">
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div className="truncate text-[10.5px] text-slate-500">
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={item.disabled}
                        onClick={item.onSelect}
                        className={`flex min-h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          item.done
                            ? 'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700'
                            : !item.disabled
                              ? 'cursor-pointer border-amber-400 bg-amber-100 text-amber-800'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {item.key === 'drone-recon' ? (
                          <Plane className="h-3.5 w-3.5" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5" />
                        )}
                        <span>{item.done ? '已完成' : '操作'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 多点检查专属：异常部位勾选（多选框），处置结果仍保持下方唯一等级 */}
            {multiPointSiteOptions.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wide text-slate-800">
                    异常位置勾选（多选框）
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    发现问题勾选对应位置 · 无异常选 P0 免勾选
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {multiPointSiteOptions.map((site) => {
                    const checked = checkedDefectSites.includes(site.id);
                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => toggleDefectSite(site.id)}
                        className={`flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors cursor-pointer ${
                          checked
                            ? 'border-amber-500 bg-amber-50/90 text-slate-900 ring-1 ring-amber-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-slate-800">
                              {site.label}
                            </span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-700">
                              {site.measuredSummary}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {site.locationHint}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wide text-slate-700">
                  处置结果
                </h3>
                <span className="whitespace-nowrap text-[11px] font-semibold text-sky-800">
                  {profileDef.subject}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {profileDef.basis}
              </p>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {profileDef.options.map((option) => {
                  const selected = disposition === option.grade;
                  return (
                    <button
                      key={option.grade}
                      type="button"
                      disabled={!covered}
                      title={option.hint}
                      onClick={() => onDisposition(option.grade)}
                      className={`min-h-9 rounded-md border px-2.5 py-1 text-left transition-colors ${
                        !covered
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                          : selected
                            ? 'cursor-pointer border-amber-500 bg-amber-50 ring-1 ring-amber-300'
                            : 'cursor-pointer border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'
                      }`}
                    >
                      <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-bold text-slate-800">
                        <span className="font-mono text-amber-700">{option.grade}</span>
                        <span className="truncate">{option.label}</span>
                        {selected && (
                          <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {disposition && selectedOption ? (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-amber-900">
                      已填写 {disposition} · {selectedOption.label}
                    </div>
                    <div className="mt-0.5 text-[11.5px] leading-4 text-amber-800">
                      {selectedOption.hint}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11.5px] leading-4 text-slate-500">
                  {covered
                    ? '请选择唯一处置等级；P0 即正常记录，P1 及以上需拍照取证。'
                    : '完成左侧全部检测点后，才能填写处置结果。'}
                </p>
              )}

              {disposition === 'P0' && (
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-sky-800">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  正常记录：不取证、不整改，可直接提交。
                </p>
              )}

              {needsEvidence && (
                <div
                  ref={evidenceRef}
                  className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-xs font-bold text-amber-800">
                        现场取证
                      </span>
                      {evidencePerspective === 'drone' && (
                        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          需空中视角 [U] 取景
                        </span>
                      )}
                      {evidenceAttached && (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                          已取证
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onCapture}
                      className="flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{evidenceAttached ? '重新拍照' : '拍照 [G]'}</span>
                    </button>
                  </div>
                  {evidenceAttached && evidenceDataUrl && (
                    <div className="overflow-hidden rounded-md border border-emerald-300 bg-slate-950">
                      <img
                        src={evidenceDataUrl}
                        alt={`${point.name} 现场取证照片`}
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  )}
                  {!evidenceAttached && (
                    <p className="text-xs text-slate-500">
                      {disposition} 级处置必须附现场证据，拍照后本点位才算闭环。
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>

          <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            {message && (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                {message}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[11.5px] leading-4 text-slate-500">
                {statusText}
              </p>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleCloseWorkbench}
                className={`flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm font-bold transition-colors ${
                  canSubmit
                    ? 'cursor-pointer border-amber-500 bg-amber-600 text-white hover:bg-amber-500'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>提交处置单</span>
              </button>
            </div>
          </footer>
        </div>
      </div>

      {drawerAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="选择检测仪器"
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-[3px] pointer-events-auto select-none"
        >
          <div className="modal-panel relative flex max-h-[90vh] w-full max-w-[700px] flex-col overflow-hidden rounded-xl border border-slate-300 border-t-4 border-t-sky-600 bg-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-[0.16em] text-sky-700">
                  INSTRUMENTS
                </div>
                <h3 className="mt-0.5 truncate text-base font-bold text-slate-900">
                  选择检测仪器
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  测点：{drawerAction.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingBayPhase(null);
                  setDrawerAction(null);
                }}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>取消</span>
              </button>
            </header>

            <div className="min-h-0 overflow-y-auto bg-slate-50 p-3">
              <div className="grid grid-cols-3 gap-2.5">
                {BACKPACK_DISPLAY_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleDrawerSelect(item.toolId as Act1Tool)}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm transition-all hover:border-sky-400 hover:shadow-md cursor-pointer"
                  >
                    <ToolSprite item={item} />
                    <div className="truncate border-t border-slate-100 px-2 py-1.5 text-xs font-bold text-slate-700 group-hover:text-sky-800">
                      {item.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-2.5 text-xs text-slate-500">
              <span>
                选错仪器会消耗检查机会，剩余{' '}
                <span className="font-bold text-amber-700">{reviewChances}</span> 次。
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingBayPhase(null);
                  setDrawerAction(null);
                }}
                className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                取消
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
