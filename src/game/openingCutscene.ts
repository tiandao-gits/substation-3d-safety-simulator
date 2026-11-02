/**
 * 开场过场（cutscene）采样器。
 *
 * 纯计算、不碰渲染：给定脚本与已播放秒数，返回这一帧的人物位置/朝向/步速、
 * 机位与看点、门的开度。3D 运行时负责消费结果；UI 负责黑边与字幕。
 *
 * 与旧 walkIn 的区别：
 * - 人物按**时间轴**走位（而不是匀速跑完整条路径），可以精确对上开门与切镜；
 * - 镜头是多机位**硬切**，每个机位可选缓慢推移，避免"一台相机从头跟到尾"的廉价感；
 * - 门有独立的开/关时间窗。
 */

export interface CutsceneVec3 {
  x: number;
  y: number;
  z: number;
}

export interface CutsceneWaypoint extends CutsceneVec3 {
  /** 到达该点的秒数，第一个点必须为 0。 */
  t: number;
}

export interface CutsceneShot {
  /** 从这一秒起切到本机位。 */
  from: number;
  position: CutsceneVec3;
  /** 给了就在本镜头内做一次缓慢推移（ease-in-out）。 */
  endPosition?: CutsceneVec3;
  /** 固定看点；缺省跟人物胸口。 */
  target?: CutsceneVec3;
  endTarget?: CutsceneVec3;
  fov?: number;
}

export interface CutsceneScript {
  duration: number;
  waypoints: CutsceneWaypoint[];
  shots: CutsceneShot[];
  door?: {
    openFrom: number;
    openTo: number;
    closeFrom?: number;
    closeTo?: number;
  };
  /** 过场结束后人物必须保持的朝向（forward = (-sin(yaw), -cos(yaw))）。 */
  endYaw: number;
  caption?: string;
  subCaption?: string;
  /** 开场过场启动时同步入队的角色自白/剧情对话行 id（对应 ACT1_LINES）。 */
  openingLines?: string[];
}

export interface CutsceneFrame {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 水平速度 m/s，用于给 Walk 动画配 timeScale，避免滑步。 */
  speed: number;
  moving: boolean;
  cameraPosition: CutsceneVec3;
  cameraTarget: CutsceneVec3;
  fov: number;
  doorOpen: number;
  shotIndex: number;
  done: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpVec(a: CutsceneVec3, b: CutsceneVec3, k: number): CutsceneVec3 {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) };
}

/** 角色朝向约定与 runtime 一致：forward = (-sin(yaw), -cos(yaw))。 */
function directionYaw(dx: number, dz: number): number {
  if (Math.hypot(dx, dz) < 1e-5) return 0;
  return Math.atan2(-dx, -dz);
}

/** 过场第一帧人物应该面朝的朝向（沿第一段路径前进方向）。 */
export function cutsceneEntryYaw(script: CutsceneScript): number {
  const [a, b] = script.waypoints;
  if (!a || !b) return script.endYaw;
  return directionYaw(b.x - a.x, b.z - a.z);
}

function lerpAngle(a: number, b: number, k: number): number {
  let delta = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * k;
}

/** 转角平滑时长：走到拐点前后各用 0.35 s 把朝向过渡过去，避免瞬间转身。 */
const YAW_BLEND_SECONDS = 0.35;

export function sampleCutscene(script: CutsceneScript, timeSeconds: number): CutsceneFrame {
  const points = script.waypoints;
  const last = points[points.length - 1];
  const shots = script.shots;
  const t = Math.max(0, timeSeconds);

  // ---- 人物 ----
  let x = last.x;
  let y = last.y;
  let z = last.z;
  let yaw = script.endYaw;
  let speed = 0;
  let segmentIndex = Math.max(0, points.length - 2);

  if (points.length >= 2 && t < script.duration) {
    segmentIndex = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      if (t >= points[i].t && t <= points[i + 1].t) {
        segmentIndex = i;
        break;
      }
      if (t > points[i + 1].t) segmentIndex = i;
    }
    const a = points[segmentIndex];
    const b = points[segmentIndex + 1];
    const span = Math.max(1e-4, b.t - a.t);
    const k = clamp01((t - a.t) / span);
    x = lerp(a.x, b.x, k);
    y = lerp(a.y, b.y, k);
    z = lerp(a.z, b.z, k);
    const segmentLength = Math.hypot(b.x - a.x, b.z - a.z);
    speed = segmentLength / span;
    yaw = directionYaw(b.x - a.x, b.z - a.z);
    const prevYaw =
      segmentIndex > 0
        ? directionYaw(a.x - points[segmentIndex - 1].x, a.z - points[segmentIndex - 1].z)
        : yaw;

    if (segmentLength < 1e-4) {
      // 站定段（结尾常见）：保持上一段朝向，并缓缓转到交还控制时的朝向。
      speed = 0;
      yaw = lerpAngle(prevYaw, script.endYaw, smoothstep(k));
    } else if (segmentIndex > 0) {
      // 拐点平滑：刚进这一段的前 0.35 s 里，从上一段的朝向过渡过来。
      const blend = smoothstep((t - a.t) / YAW_BLEND_SECONDS);
      yaw = lerpAngle(prevYaw, yaw, blend);
    }
  } else if (points.length >= 2) {
    yaw = script.endYaw;
  }

  // ---- 镜头（硬切）----
  let shotIndex = 0;
  for (let i = 0; i < shots.length; i += 1) {
    if (t >= shots[i].from) shotIndex = i;
  }
  const shot = shots[shotIndex];
  const shotEnd = shotIndex + 1 < shots.length ? shots[shotIndex + 1].from : script.duration;
  const shotProgress = smoothstep((t - shot.from) / Math.max(1e-4, shotEnd - shot.from));
  const cameraPosition = shot.endPosition
    ? lerpVec(shot.position, shot.endPosition, shotProgress)
    : { ...shot.position };
  const cameraTarget = shot.target
    ? shot.endTarget
      ? lerpVec(shot.target, shot.endTarget, shotProgress)
      : { ...shot.target }
    : { x, y: y + 1.15, z };

  // ---- 门 ----
  let doorOpen = 0;
  if (script.door) {
    const door = script.door;
    doorOpen = smoothstep((t - door.openFrom) / Math.max(1e-4, door.openTo - door.openFrom));
    if (door.closeFrom !== undefined && door.closeTo !== undefined) {
      doorOpen -= smoothstep(
        (t - door.closeFrom) / Math.max(1e-4, door.closeTo - door.closeFrom)
      );
    }
    doorOpen = clamp01(doorOpen);
  }

  return {
    x,
    y,
    z,
    yaw,
    speed,
    moving: speed > 0.05 && t < script.duration,
    cameraPosition,
    cameraTarget,
    fov: shot.fov ?? 50,
    doorOpen,
    shotIndex,
    done: t >= script.duration,
  };
}
