/**
 * 每一幕开场时玩家站在哪里、面朝哪里。
 *
 * 三幕都有明确定义，用于：
 * - 幕间卡片 → 进入该幕时的传送；
 * - 每一幕"重走本幕"时回到同一出生点、统一面朝西方。
 *
 * 第三幕额外带一段开场过场：从公寓楼梯间下楼、推开那扇**模型里本来就有的玻璃门**、
 * 走到楼下空地，再交还控制。机位是"楼梯间内低角度 → 门外固定 → 跟随"三段。
 */

import type { ActNo } from '../game/act1';
import type { CutsceneScript } from '../game/openingCutscene';

export interface ActStartSpawn {
  x: number;
  z: number;
  /** 朝向：引擎里 forward = (-sin(yaw), -cos(yaw))；π/2 即正西。 */
  yaw: number;
  /** 进入该幕时打在屏幕上的提示。 */
  note?: string;
  /** 可选开场过场；有就走完再把控制交给玩家。 */
  cutscene?: CutsceneScript;
}

/** 正西：forward = (-1, 0)。 */
const WEST_YAW = Math.PI / 2;

export const ACT_START_SPAWNS: Record<ActNo, ActStartSpawn> = {
  1: {
    // 站区东侧广场，与全局初始点一致。
    x: 25.0,
    z: 0.0,
    yaw: WEST_YAW,
    note: '站区东侧广场集合，开始上午的例行巡视。',
  },
  2: {
    // 前侧 F02 间隔区北侧道路，正对 1# 主变检修现场。
    x: 2.9,
    z: 23.9,
    yaw: WEST_YAW,
    note: '10:30，走到 1# 主变检修现场参加班前会。',
  },
  3: {
    // 公寓楼西侧门外空地，刚午觉起来从楼内楼梯下来、出楼门再走到这里。
    x: 27.2,
    z: -19.0,
    yaw: WEST_YAW,
    note: '刚午觉起来：从值班公寓下楼，准备去北区施工现场看看。',
    cutscene: {
      duration: 5.8,
      endYaw: WEST_YAW,
      caption: '13:30 · 值班公寓',
      subCaption: '刚午觉起来，准备去北区看看',
      openingLines: ['A3-OPEN-1'],
      // 全程一个机位：站在公寓西侧、隔着西立面看门口（侧对建筑）。
      // 不拍楼梯间内部 —— 人物在门内时被墙挡着，门开了才出现在画面里。
      // 走位与 GLB 实测对齐：楼梯 z 恒为 -19.8；玻璃门在 x=30.655，
      // 门内楼梯间地坪 0.30 m，门外场坪 0.25 m。
      waypoints: [
        // 楼梯中段（画面外），先沿 z=-19.8 朝正西下楼，再对准主门扇中心（z≈-19.63）出门
        { t: 0.0, x: 33.4, y: 1.12, z: -19.8 },
        { t: 1.6, x: 31.35, y: 0.3, z: -19.8 },
        { t: 2.1, x: 30.9, y: 0.3, z: -19.64 },
        // 沿主门扇中心跨出门槛、走到楼下空地
        { t: 3.0, x: 29.6, y: 0.25, z: -19.62 },
        { t: 4.8, x: 27.2, y: 0.25, z: -19.0 },
        // 站定，把朝向缓缓交给正西
        { t: 5.8, x: 27.2, y: 0.25, z: -19.0 },
      ],
      // 人走到门口前先把门推开，走出 2 m 后门自己带上。
      door: { openFrom: 0.55, openTo: 1.75, closeFrom: 4.2, closeTo: 5.3 },
      shots: [
        {
          from: 0.0,
          position: { x: 25.4, y: 1.95, z: -22.8 },
          endPosition: { x: 25.55, y: 1.93, z: -22.55 },
          target: { x: 30.3, y: 1.4, z: -19.85 },
          // 只做很小的摇镜：终点仍把公寓西立面留在画面里，
          // 人物走到出生点时落在画面右侧三分之一，不会把楼摇出画外。
          endTarget: { x: 28.9, y: 1.35, z: -19.55 },
          fov: 40,
        },
      ],
    },
  },
};
