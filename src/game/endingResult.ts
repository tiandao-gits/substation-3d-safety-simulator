import { hashString, mulberry32 } from './act1';

export interface EndingAccident {
  id: string;
  title: string;
  detail: string;
  keywords: string[];
}

export const ENDING_ACCIDENTS: EndingAccident[] = [
  {
    id: 'pit-fall',
    title: '基坑临边坠落事故',
    detail:
      '北侧施工区基坑临边防护缺失。夜间收工时，一名作业人员从无围栏一侧坠落，送医抢救无效。',
    keywords: ['基坑'],
  },
  {
    id: 'electric-shock',
    title: '临时用电触电事故',
    detail:
      '施工区临时配电箱末级漏保失效。一名作业人员触碰外护套破损的电缆后触电，经抢救脱离生命危险，构成重伤。',
    keywords: ['漏保', '配电箱', '触电'],
  },
  {
    id: 'fallen-object',
    title: '高处坠物伤人事故',
    detail:
      '材料堆吊装作业时，一名未戴安全帽的作业人员被坠落的扣件击中头部，构成重伤。',
    keywords: ['安全帽'],
  },
  {
    id: 'wall-fall',
    title: '防火墙抹灰层脱落伤人事故',
    detail:
      '1# / 2# 主变之间防火墙抹灰层空鼓未及时处理。收工时抹灰层大面积脱落，砸中一名经过的作业人员，构成重伤。',
    keywords: ['防火墙', '空鼓', '脱落'],
  },
  {
    id: 'overheat-fire',
    title: '设备过热起火事故',
    detail:
      '220kV 间隔引线接头持续过热，巡视问题未闭环。接头烧损并引燃周边绝缘材料，设备被迫停运。',
    keywords: ['过热', '接头', '母排'],
  },
  {
    id: 'transformer-oil-fire',
    title: '主变渗漏起火事故',
    detail:
      '主变本体渗漏未及时通知运维，油温持续偏高。渗漏油接触高温部件后起火，检修区被迫扩大停电范围。',
    keywords: ['渗漏', '油温'],
  },
];

/**
 * Picks a random accident for this run. The seed + missed findings make the
 * choice stable while the settlement page is open, but different runs get
 * different accidents.
 */
export function pickEndingAccident(
  seed: number,
  unhandledHazards: string[]
): EndingAccident {
  const roll = mulberry32(
    (seed ^ hashString(unhandledHazards.join('|'))) >>> 0
  )();
  return ENDING_ACCIDENTS[
    Math.floor(roll * ENDING_ACCIDENTS.length) % ENDING_ACCIDENTS.length
  ];
}
