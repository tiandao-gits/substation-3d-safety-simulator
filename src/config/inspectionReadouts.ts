/**
 * 巡检点的「检测数据」视图模型。
 *
 * 目的：左栏 3D 特写窗必须对**每一个**巡检点给出同一套体检读数 ——
 * 主数值（超大高亮）+ 辅助读数 + 读数条件。
 *
 * 设计红线：这里只呈现"仪器测到了什么"，任何能替玩家下结论的东西都不出现。
 * - 不出现缺陷等级（一般/严重/危急）、不出现建议处置 P 级、不出现"合格/超标"；
 * - 数值不配红/黄/绿颜色，避免用配色代替玩家判断；
 * - 不出现规程阈值与判据原文 —— 判据在备忘录（Dossier）里，玩家自己对照。
 */

import {
  type Act1PointDef,
  type Act1Reading,
  type Act1Variant,
} from '../game/act1';

export interface ReadoutMetric {
  key: string;
  label: string;
  value: string;
  unit: string;
}

export interface InspectionReadout {
  /** 主读数：在 3D 窗口里放大、加粗、高亮显示（中性色，不带判定）。 */
  primary: ReadoutMetric;
  /** 辅助读数 / 分相 / 现场记录值。 */
  secondary: ReadoutMetric[];
  /** 仪器读数条件（距离、角度、环温、负荷等），不含判据。 */
  note?: string;
}

function phaseLabel(index: number): string {
  return `${'ABC'[index] ?? index + 1} 相`;
}

export function buildInspectionReadout(
  point: Act1PointDef,
  readings: Act1Reading[],
  completedActions: string[],
  variant: Act1Variant | undefined
): InspectionReadout | null {
  const v = variant ?? 'A';
  const acts = new Set(completedActions);
  const admissible = readings.find((item) => (item.quality ?? 'ok') === 'ok');

  switch (point.id) {
    case 'hv-10kv':
    case 'bay-temp': {
      if (!admissible) return null;
      const values = admissible.values;
      const peak = values.length > 0 ? Math.max(...values) : 0;
      return {
        primary: {
          key: 'peak',
          label: '最高相温度',
          value: peak.toFixed(1),
          unit: '℃',
        },
        secondary: values.map((value, index) => ({
          key: `phase-${index}`,
          label: phaseLabel(index),
          value: value.toFixed(1),
          unit: '℃',
        })),
        note:
          values.length < 2
            ? `${admissible.note ?? ''} · 仅记录单相，未测参考相`
            : admissible.note,
      };
    }

    case 'a2-oil': {
      if (!admissible) return null;
      const oilC = admissible.values[0] ?? 0;
      const secondary: ReadoutMetric[] = [];
      if (acts.has('oil-light')) {
        secondary.push({
          key: 'oil-light',
          label: '背光侧法兰',
          value: v === 'C' ? '见油迹挂滴' : '未见油迹',
          unit: '',
        });
      }
      return {
        primary: {
          key: 'oil',
          label: '顶层油温',
          value: oilC.toFixed(1),
          unit: '℃',
        },
        secondary,
        note: admissible.note,
      };
    }

    case 'aisle': {
      if (!admissible) return null;
      const width = admissible.values[0] ?? 0;
      return {
        primary: {
          key: 'width',
          label: '巡视通道净宽',
          value: width.toFixed(2),
          unit: 'm',
        },
        secondary: [
          {
            key: 'clearance',
            label: '距带电体',
            value: '3.4',
            unit: 'm',
          },
        ],
        note: '激光测距 · 测点位于材料堆与构架柱之间',
      };
    }

    case 'a3-pit': {
      if (!admissible) return null;
      const gap = admissible.values[0] ?? 0;
      return {
        primary: {
          key: 'gap',
          label: '临边无防护缺口',
          value: gap.toFixed(2),
          unit: 'm',
        },
        secondary: [
          { key: 'water', label: '坑内积水', value: '有', unit: '' },
          { key: 'support', label: '坑壁支护', value: '未见', unit: '' },
          { key: 'ladder', label: '上下通道', value: '未见', unit: '' },
        ],
        note: '激光测距 · 围栏缺失段两侧端点之间 · 夜间照明未接通',
      };
    }

    case 'a3-box': {
      if (!admissible) return null;
      const actionMa = admissible.values[0] ?? 0;
      const secondary: ReadoutMetric[] = [];
      if (acts.has('box-voltage')) {
        secondary.push(
          { key: 'voltage', label: '进线电压', value: '228', unit: 'V' },
          { key: 'pe', label: '零地电位差', value: '18.4', unit: 'V' }
        );
      }
      return {
        primary: {
          key: 'leakage',
          label: '漏保动作电流',
          value: actionMa.toFixed(0),
          unit: 'mA',
        },
        secondary,
        note: '漏保测试仪注入试验电流 · 实测动作时间 0.18 s',
      };
    }

    case 'a2-wall': {
      if (!acts.has('wall-hollow')) return null;
      const hollow = v === 'B';
      const secondary: ReadoutMetric[] = [
        {
          key: 'decay',
          label: '回波阻尼衰减',
          value: hollow ? '120' : '40',
          unit: 'ms',
        },
      ];
      if (acts.has('wall-crack')) {
        secondary.push({
          key: 'crack',
          label: '裂缝宽度',
          value: hollow ? '1.80' : '0.12',
          unit: 'mm',
        });
      }
      return {
        primary: {
          key: 'echo',
          label: '空鼓锤回波频率',
          value: hollow ? '290' : '195',
          unit: 'Hz',
        },
        secondary,
        note: hollow
          ? '同点敲击三次读数一致，回波拖尾 120 ms，已按原位标定'
          : '同点敲击三次读数一致，回波短促',
      };
    }

    case 'a2-crew': {
      if (!acts.has('visual')) return null;
      const expired = v === 'D';
      const secondary: ReadoutMetric[] = [
        { key: 'total', label: '受检人员', value: '5', unit: '人' },
        { key: 'certs', label: '台账证件', value: '5', unit: '份' },
      ];
      if (acts.has('ground-torque')) {
        secondary.push({
          key: 'torque',
          label: '接地螺栓力矩',
          value: '42',
          unit: 'N·m',
        });
      }
      if (acts.has('ground-caliper')) {
        secondary.push({
          key: 'caliper',
          label: '接地铜排截面',
          value: '30.2×4.1',
          unit: 'mm',
        });
      }
      return {
        primary: {
          key: 'expiry',
          label: '证件最早到期',
          value: expired ? '2025-06' : '2027-09',
          unit: '',
        },
        secondary,
        note: expired
          ? '3 号焊工证复审记录时间 2022-06，台账与在场人员一致'
          : '特种作业台账与在场人员一致，逐份核对复审时间',
      };
    }

    case 'a3-hardhat': {
      if (!acts.has('drone-recon')) return null;
      return {
        primary: {
          key: 'nohat',
          label: '未戴安全帽',
          value: '1',
          unit: '人',
        },
        secondary: [
          { key: 'view', label: '取景方式', value: '无人机', unit: '' },
          { key: 'range', label: '取证距离', value: '约 15', unit: 'm' },
        ],
        note: '地面视线受材料堆遮挡，升空后对准西侧作业人员取景',
      };
    }

    default:
      return null;
  }
}
