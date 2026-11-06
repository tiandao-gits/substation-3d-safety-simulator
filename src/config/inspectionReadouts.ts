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
    case 'hv-10kv': {
      // 若传入了单相读数（如单元测试覆盖不足分支），保留单相提示
      if (admissible && admissible.values.length < 2) {
        const singleVal = admissible.values[0] ?? 0;
        return {
          primary: {
            key: 'peak',
            label: '最高相温度',
            value: singleVal.toFixed(1),
            unit: '℃',
          },
          secondary: [
            {
              key: 'phase-0',
              label: 'A 相',
              value: singleVal.toFixed(1),
              unit: '℃',
            },
          ],
          note: `${admissible.note ?? ''} · 仅记录单相，未测参考相`,
        };
      }
      if (!admissible && !acts.has('visual')) return null;
      const values =
        admissible && admissible.values.length >= 3
          ? admissible.values
          : v === 'C'
            ? [38.4, 96.8, 38.7]
            : [38.4, 39.0, 38.7];
      const peak = Math.max(...values);
      const secondary: ReadoutMetric[] = [
        ...values.map((value, index) => ({
          key: `phase-${index}`,
          label: `${phaseLabel(index)}母排`,
          value: value.toFixed(1),
          unit: '℃',
        })),
        {
          key: 'bus-voltage',
          label: '柜面母线电压',
          value: '10.4',
          unit: 'kV',
        },
        {
          key: 'load-current',
          label: '进线负荷电流',
          value: '186',
          unit: 'A',
        },
      ];
      if (acts.has('cabinet-light')) {
        secondary.push({
          key: 'dark-check',
          label: '暗处手电排查',
          value: v === 'C' ? '3号柜B相接头氧化变色' : '观察窗与电缆沟封堵完好',
          unit: '',
        });
      }
      return {
        primary: {
          key: 'peak',
          label: '柜面内置表 · 最高相温度',
          value: peak.toFixed(1),
          unit: '℃',
        },
        secondary,
        note: '机房柜面内置智能温控仪与微机电压表直读 · 看到读数即可直接填写处置单',
      };
    }

    case 'bay-temp': {
      if (!admissible) return null;
      const values = admissible.values;
      const peak = values.length > 0 ? Math.max(...values) : 0;
      const minVal = values.length > 1 ? Math.min(...values) : peak;
      const deltaT = Math.max(0, peak - minVal);
      const posNames = ['A 相（左列线夹）', 'B 相（中列线夹）', 'C 相（右列线夹）'];
      const secondary: ReadoutMetric[] = values.map((value, index) => ({
        key: `phase-${index}`,
        label: posNames[index] ?? phaseLabel(index),
        value: value.toFixed(1),
        unit: '℃',
      }));
      if (values.length >= 2) {
        secondary.push({
          key: 'delta-t',
          label: '最大相间温差 ΔT',
          value: deltaT.toFixed(1),
          unit: '℃',
        });
      }
      return {
        primary: {
          key: 'peak',
          label: '三相 3 次测温 · 最高相温度',
          value: peak.toFixed(1),
          unit: '℃',
        },
        secondary,
        note:
          values.length < 2
            ? `${admissible.note ?? ''} · 仅记录单相，未测参考相`
            : `${admissible.note ?? ''} · 左(A)/中(B)/右(C)三相测温 3 次求取最高值`,
      };
    }

    case 'a2-oil': {
      if (!admissible && !acts.has('oil-light') && !acts.has('ground-torque')) {
        return null;
      }
      const oilC = admissible?.values[0] ?? (v === 'C' ? 96.2 : 64.2);
      const secondary: ReadoutMetric[] = [];
      if (admissible || acts.has('oil-temp')) {
        secondary.push({
          key: 'oil-temp-item',
          label: '测点1 · 顶层油温',
          value: oilC.toFixed(1),
          unit: '℃',
        });
      }
      if (acts.has('oil-light')) {
        secondary.push({
          key: 'oil-light',
          label: '测点2 · 底部法兰',
          value: v === 'C' ? '见渗油挂滴与油膜' : '密封完好未见油迹',
          unit: '',
        });
      }
      if (acts.has('ground-torque')) {
        secondary.push({
          key: 'torque',
          label: '测点3 · 接地螺栓力矩',
          value: '42',
          unit: 'N·m',
        });
      }
      return {
        primary: {
          key: 'oil',
          label: '主变顶层油温',
          value: oilC.toFixed(1),
          unit: '℃',
        },
        secondary,
        note:
          admissible?.note ??
          '主变本体三处并列检测（测点1顶层油温 / 测点2底部法兰油迹 / 测点3接地螺栓力矩）',
      };
    }

    case 'aisle': {
      if (!acts.has('visual') && !admissible) return null;
      const hasNumericWidth = Boolean(admissible && admissible.values.length > 0);
      const width = admissible?.values[0] ?? 0.78;
      return {
        primary: {
          key: 'width',
          label: hasNumericWidth ? '巡视通道净宽' : '现场目视巡检',
          value: hasNumericWidth ? width.toFixed(2) : '木方/托盘违规占道',
          unit: hasNumericWidth ? 'm' : '',
        },
        secondary: [
          {
            key: 'obstruction',
            label: '现场堆积物',
            value: '施工木方与托盘',
            unit: '',
          },
          {
            key: 'clearance',
            label: '距带电体',
            value: '3.4',
            unit: 'm',
          },
        ],
        note: '巡视与应急通道严禁堆放任何杂物 · 无需测距可直接开具处置单',
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
      if (!acts.has('wall-hollow') && !acts.has('wall-crack')) return null;
      const hollow = v === 'B';
      const secondary: ReadoutMetric[] = [
        {
          key: 'decay',
          label: '位置1（东段）回波衰减',
          value: hollow ? '120' : '40',
          unit: 'ms',
        },
        {
          key: 'sound-desc',
          label: '位置1（东段）敲击听音',
          value: hollow ? '沉闷“咚咚”空响（中空脱层声）' : '清脆“叮当”实音（抹面密实声）',
          unit: '',
        },
      ];
      if (acts.has('wall-crack')) {
        secondary.push({
          key: 'crack',
          label: '位置2（中段）裂缝宽度',
          value: hollow ? '1.80' : '0.12',
          unit: 'mm',
        });
      }
      return {
        primary: {
          key: 'echo',
          label: '位置1（东段）回波主频',
          value: hollow ? '290' : '195',
          unit: 'Hz',
        },
        secondary,
        note: hollow
          ? '听音说明：东段敲击发出沉闷“咚咚”空鼓声（墙体抹灰层与基层脱离中空）；中段实测裂缝宽 1.80 mm'
          : '听音说明：东段敲击发出清脆短促实音（抹灰层粘结密实）；中段仅见 0.12 mm 表面细纹',
      };
    }

    case 'a2-crew': {
      if (!acts.has('visual')) return null;
      const expired = v === 'D';
      const secondary: ReadoutMetric[] = [
        { key: 'total', label: '受检人员', value: '5', unit: '人' },
        { key: 'certs', label: '台账证件', value: '5', unit: '份' },
      ];
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
