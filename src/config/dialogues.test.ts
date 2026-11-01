/**
 * VN 演出约束：本场到场的人从第一帧就全部站在画面里，没轮到说话的人只压暗隐退。
 * 这里守三条线：
 * 1. cast 名单里的角色必须在同一场景里有台词（否则就是站着不说话的背景板）；
 * 2. cast 必须有对应立绘资源，否则会退化成剪影占位 —— 同样属于"不该出现的人"；
 * 3. 反过来，在场说话人（电话/无线电、第一人称陆川除外）必须都进 cast，
 *    否则会出现"人在说话、画面里却没这个人"。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ENDING_DELAY, ENDING_END, ENDING_GOOD, PROLOGUE } from './dialogues';
import { VN_CHARACTERS } from './vnAssets';
import { isLine, type VnScene } from '../game/vn';

const SCENES: VnScene[] = [PROLOGUE, ENDING_GOOD, ENDING_END, ENDING_DELAY];

test('VN 立绘名单里的角色必须在同一场景说过话', () => {
  for (const scene of SCENES) {
    const speakers = new Set(
      scene.lines.filter(isLine).map((entry) => entry.speakerId)
    );
    for (const member of scene.cast ?? []) {
      assert.ok(
        speakers.has(member.charId),
        `${scene.id}：${member.charId} 在本场没有台词，不应出现在画面里`
      );
    }
  }
});

test('VN 在场说话人都必须进 cast 名单', () => {
  for (const scene of SCENES) {
    const roster = new Set((scene.cast ?? []).map((member) => member.charId));
    for (const entry of scene.lines) {
      if (!isLine(entry)) continue;
      // 电话/无线电里的声音不在现场；陆川是第一人称视角。
      if (entry.channel) continue;
      if (entry.speakerId === 'luchuan') continue;
      assert.ok(
        roster.has(entry.speakerId),
        `${scene.id}：${entry.id} 由 ${entry.speakerId} 说话，但他不在 cast 名单里，画面上没人`
      );
    }
  }
});

test('VN cast 槽位不重复且立绘资源齐全', () => {
  for (const scene of SCENES) {
    const slots = new Set<string>();
    for (const member of scene.cast ?? []) {
      assert.ok(
        !slots.has(member.slot),
        `${scene.id}：${member.slot} 槽位被重复占用`
      );
      slots.add(member.slot);

      const info = VN_CHARACTERS[member.charId];
      assert.ok(info, `${scene.id}：引用了未定义角色 ${member.charId}`);
      const portrait = info.portraits[member.pose];
      assert.ok(
        portrait,
        `${member.charId} 缺少 ${member.pose} 立绘，会退化成剪影`
      );
      const path = fileURLToPath(
        new URL(`../../public${portrait}`, import.meta.url)
      );
      assert.ok(existsSync(path), `立绘文件缺失：${path}`);
    }
  }
});

test('玩家角色（陆川）永远不占立绘槽位', () => {
  for (const scene of SCENES) {
    for (const member of scene.cast ?? []) {
      assert.notEqual(
        member.charId,
        'luchuan',
        `${scene.id}：陆川是第一人称玩家，不能出现在立绘里`
      );
    }
  }
});
