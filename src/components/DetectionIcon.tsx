import type { ReactNode } from 'react';
import type { Act1Tool } from '../game/act1';

/**
 * 3D 视窗按钮图标：无人机取证、目视、班前会人员与列队单独成类，
 * 其余按持有的仪器区分。
 */
export type DetectionGlyph =
  | Act1Tool
  | 'drone'
  | 'visual'
  | 'crew'
  | 'lineup';

interface DetectionIconProps {
  glyph: DetectionGlyph;
  className?: string;
}

/**
 * 现场检测按钮的仪器线稿图标（24×24 网格，随字号缩放）。
 * 统一 1.6 描边、无填充，白底按钮上按 currentColor 呈现纯黑，放大后仍然清晰。
 */
export function DetectionIcon({ glyph, className = '' }: DetectionIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[glyph] ?? GLYPHS.visual}
    </svg>
  );
}

const GLYPHS: Record<DetectionGlyph, ReactNode> = {
  /** 红外测温：温度计 + 热辐射。 */
  thermometer: (
    <>
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
      <path d="M12 8.6v6" />
      <path d="M17.6 5.2c1 1.2 1 2.8 0 4" />
      <path d="M20.2 3.2c1.7 1.9 1.7 4.7 0 6.6" />
    </>
  ),
  /** 力矩扳手：开口扳手头 + 长手柄。 */
  torque: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  /** 塞尺：以铆钉为轴展开的成套塞片。 */
  feeler: (
    <>
      <circle cx="6.2" cy="5.4" r="1.5" />
      <path d="M7 6.6l11.2 9.4" />
      <path d="M7.6 5.4l11.2 7.8" />
      <path d="M5.4 7.4l9.4 11.2" />
    </>
  ),
  /** 激光测距：手持机 + 虚线激光束 + 被测面。 */
  laser: (
    <>
      <rect x="2.4" y="8.4" width="8.2" height="7.2" rx="1.6" />
      <path d="M4.8 10.8h3.4" />
      <path d="M4.8 13.2h1.6" />
      <path d="M10.6 12h7.2" strokeDasharray="2.2 1.8" />
      <path d="M19.6 7.4v9.2" strokeWidth={2.4} />
    </>
  ),
  /** 空鼓锤：锤头 + 加粗手柄。 */
  'hollow-hammer': (
    <>
      <path d="M14.4 3.6l6 6-3.4 3.4-6-6z" />
      <path d="M13 10.2 4.8 18.4a1.8 1.8 0 0 0 2.5 2.5l8.2-8.2" />
    </>
  ),
  /** 强光手电：灯头镜面 + 筒身 + 出光束。 */
  flashlight: (
    <>
      <path d="M7.6 6.6h8.8v11a2.4 2.4 0 0 1-2.4 2.4h-4a2.4 2.4 0 0 1-2.4-2.4z" />
      <ellipse cx="12" cy="6.6" rx="4.4" ry="1.6" />
      <path d="M12 1.4v2.2M6.2 2.8l1.4 1.4M17.8 2.8l-1.4 1.4" />
    </>
  ),
  /** 万用表：表身 + 显示屏 + 表盘 + 表笔。 */
  multimeter: (
    <>
      <rect x="3.4" y="2.6" width="12.4" height="18.8" rx="1.8" />
      <rect x="5.8" y="5.2" width="7.6" height="4" rx="0.6" />
      <circle cx="9.6" cy="14.6" r="2.8" />
      <path d="M9.6 14.6l1.9-1.8" />
      <path d="M17.4 6.6l2.8-2.2M17.4 10.6l2.8 2.2" />
    </>
  ),
  /** 漏保测试：插头 + 漏电火花。 */
  leakage: (
    <>
      <path d="M8.6 2.8v4.4M15.4 2.8v4.4" />
      <path d="M6.2 7.2h11.6v2.6a5.8 5.8 0 0 1-11.6 0z" />
      <path d="M13.1 10.4 10.9 13.2h2.3l-2.1 2.8" />
      <path d="M12 15.6V21" />
    </>
  ),
  /** 无人机取证：四旋翼 + 机身。 */
  drone: (
    <>
      <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.4" />
      <path d="M9.2 9.2 6.4 6.4M14.8 9.2l2.8-2.8M9.2 14.8l-2.8 2.8M14.8 14.8l2.8 2.8" />
      <circle cx="4.6" cy="4.6" r="2.2" />
      <circle cx="19.4" cy="4.6" r="2.2" />
      <circle cx="4.6" cy="19.4" r="2.2" />
      <circle cx="19.4" cy="19.4" r="2.2" />
    </>
  ),
  /** 目视观察 / 未识别仪器时的准星。 */
  visual: (
    <>
      <circle cx="12" cy="12" r="6.6" />
      <path d="M12 2.2v3.2M12 18.6v3.2M2.2 12h3.2M18.6 12h3.2" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  /** 游标卡尺（当前无巡检点使用，保留图标以覆盖全部仪器）。 */
  caliper: (
    <>
      <path d="M4 16.4 15.2 5.2" />
      <path d="M7.6 20 18.8 8.8" />
      <path d="M15.2 5.2l2.6 2.6M7.6 20l-2.6-2.6M11 12.6l3.6 3.6" />
    </>
  ),
  /** 单人：安全帽 + 头肩，用于班前会人员列表。 */
  crew: (
    <>
      <path d="M6.6 8.4a5.4 5.4 0 0 1 10.8 0" />
      <path d="M5.4 8.4h13.2" />
      <circle cx="12" cy="11.2" r="2.7" />
      <path d="M5.2 20.6v-1.2a4.6 4.6 0 0 1 4.6-4.6h4.4a4.6 4.6 0 0 1 4.6 4.6v1.2" />
    </>
  ),
  /** 列队：中间一人略高，左右各一人，用于全景列队。 */
  lineup: (
    <>
      <circle cx="5.9" cy="9.2" r="1.9" strokeWidth={1.4} />
      <path d="M2.8 18.6v-1.3a3.1 3.1 0 0 1 3.1-3.1h0a3.1 3.1 0 0 1 3.1 3.1v1.3" strokeWidth={1.4} />
      <circle cx="18.1" cy="9.2" r="1.9" strokeWidth={1.4} />
      <path d="M15 18.6v-1.3a3.1 3.1 0 0 1 3.1-3.1h0a3.1 3.1 0 0 1 3.1 3.1v1.3" strokeWidth={1.4} />
      <circle cx="12" cy="7.6" r="2.2" />
      <path d="M8.4 18.6v-1.6a3.6 3.6 0 0 1 3.6-3.6h0a3.6 3.6 0 0 1 3.6 3.6v1.6" />
    </>
  ),
};
