/**
 * Enforces the "no tool hints" hard rule (gameplay-v2 §2.5).
 * Mission cards, HUD messages, NPC lines and interaction labels are audited;
 * the backpack and the tool workbench are exempt because they name the held
 * tool by design.
 */

export const TOOL_HINT_TERMS = [
  '数字万用表',
  '万用表',
  '红外测温仪',
  '测温仪',
  '漏电检测仪',
  '强光手电筒',
  '强光手电',
  '手电筒',
  '力矩扳手',
  '空鼓棒',
  '激光测距仪',
  '测距仪',
  '钢卷尺',
  '卷尺',
  '塞尺',
  '游标卡尺',
  '卡尺',
  '兆欧表',
  '接地电阻仪',
  '验电器',
  '无人机',
];

export function findToolHints(text: string): string[] {
  return TOOL_HINT_TERMS.filter((term) => text.includes(term));
}

export interface AuditEntry {
  id: string;
  text: string;
}

export interface AuditViolation {
  id: string;
  hints: string[];
}

export function auditPlayerFacingContent(entries: AuditEntry[]): AuditViolation[] {
  return entries
    .map((entry) => ({ id: entry.id, hints: findToolHints(entry.text) }))
    .filter((entry) => entry.hints.length > 0);
}
