import type { AABB } from './rules';

/**
 * 公寓一层 10kV 配电室入口。
 *
 * 坐标来自 public/substation_blockout.glb 的实测包围盒：
 * - 蓝色门扇 HV_DOOR_LEAF_N：x 30.51…30.63，z -23.57…-22.28，h 0.26…2.68
 * - 门洞净宽约 1.29 m，南侧门轴 z=-22.28，向内为正 x 方向
 * - 室内地坪 CTRL_EPOXY_FLOOR 顶面标高 0.30 m
 */
export const APARTMENT_DOOR = {
  centerX: 30.57,
  centerZ: -22.925,
  hingeX: 30.57,
  hingeZ: -22.28,
  /** 门扇向建筑外侧（西）旋开约 97°，避免挡住门洞。 */
  openAngle: Math.PI * 0.54,
  exteriorStand: { x: 28.9, z: -22.925 },
  interiorStand: { x: 33.2, z: -22.72 },
  interiorReturnYaw: -Math.PI / 2,
  exteriorReturnYaw: Math.PI / 2,
  /** 门外提示距离；室内只允许贴近门时提示退出。 */
  exteriorInteractRadius: 3.2,
  interiorInteractRadius: 1.4,
} as const;

/** 室内地坪比站区混凝土板高 5 cm。 */
export const APARTMENT_INTERIOR_FLOOR_Y = 0.3;

export interface ApartmentRoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 可进入的 10kV 控制室（与楼梯间隔墙 z=-21.0 分隔）。 */
export const APARTMENT_ROOM: ApartmentRoomBounds = {
  minX: 30.68,
  maxX: 37.18,
  minZ: -24.18,
  maxZ: -21.12,
};

/**
 * 室内第三人称相机活动边界。
 * z 下限停在 10kV 柜列北侧，避免镜头退进柜体；其余三边留 0.28 m
 * 墙体安全距离。相机被限制在此盒内后，转动视角不会再穿到墙外。
 */
export const APARTMENT_CAMERA_BOUNDS = {
  minX: 30.96,
  maxX: 36.9,
  minY: 0.65,
  maxY: 2.55,
  minZ: -23.15,
  maxZ: -21.4,
} as const;

export function constrainApartmentCameraPosition(
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number } {
  return {
    x: Math.min(
      APARTMENT_CAMERA_BOUNDS.maxX,
      Math.max(APARTMENT_CAMERA_BOUNDS.minX, x)
    ),
    y: Math.min(
      APARTMENT_CAMERA_BOUNDS.maxY,
      Math.max(APARTMENT_CAMERA_BOUNDS.minY, y)
    ),
    z: Math.min(
      APARTMENT_CAMERA_BOUNDS.maxZ,
      Math.max(APARTMENT_CAMERA_BOUNDS.minZ, z)
    ),
  };
}

export type ApartmentDoorSide = 'outside' | 'inside';

export function isInsideApartmentRoom(x: number, z: number): boolean {
  return (
    x >= APARTMENT_ROOM.minX &&
    x <= APARTMENT_ROOM.maxX &&
    z >= APARTMENT_ROOM.minZ &&
    z <= APARTMENT_ROOM.maxZ
  );
}

/**
 * 判断玩家是否处于蓝色大门的可交互范围。
 * 门外按“西侧接近”判定，门内只要在配电室内且靠近门洞即可退出。
 */
export function getApartmentDoorInteraction(
  x: number,
  z: number
): ApartmentDoorSide | null {
  const distance = Math.hypot(
    x - APARTMENT_DOOR.centerX,
    z - APARTMENT_DOOR.centerZ
  );
  if (isInsideApartmentRoom(x, z)) {
    return distance <= APARTMENT_DOOR.interiorInteractRadius ? 'inside' : null;
  }
  if (
    x < APARTMENT_DOOR.centerX - 0.05 &&
    distance <= APARTMENT_DOOR.exteriorInteractRadius
  ) {
    return 'outside';
  }
  return null;
}

/**
 * 公寓外墙分段碰撞。旧实现把整栋楼当作一个实心 AABB，导致玩家在门前
 * 被一块看不见的整楼包围盒挡住；这里只保留真实墙体、隔墙和柜列。
 */
export const APARTMENT_WALL_OBSTACLES: AABB[] = [
  {
    id: 'apartment-west-south',
    label: '公寓西墙（门洞南侧）',
    minX: 30.43,
    maxX: 30.73,
    minZ: -24.76,
    maxZ: -23.57,
    height: 13.8,
    isHazard: false,
  },
  {
    id: 'apartment-west-north',
    label: '公寓西墙（门洞北侧）',
    minX: 30.43,
    maxX: 30.73,
    minZ: -22.23,
    maxZ: -18.81,
    height: 13.8,
    isHazard: false,
  },
  {
    id: 'apartment-east',
    label: '公寓东墙',
    minX: 37.15,
    maxX: 37.55,
    minZ: -24.76,
    maxZ: -18.81,
    height: 13.8,
    isHazard: false,
  },
  {
    id: 'apartment-south',
    label: '公寓南墙',
    minX: 30.43,
    maxX: 37.55,
    minZ: -24.76,
    maxZ: -24.2,
    height: 13.8,
    isHazard: false,
  },
  {
    id: 'apartment-north',
    label: '公寓北墙',
    minX: 30.43,
    maxX: 37.55,
    minZ: -19.05,
    maxZ: -18.81,
    height: 13.8,
    isHazard: false,
  },
  {
    id: 'apartment-control-partition',
    label: '10kV 控制室隔墙',
    minX: 30.6,
    maxX: 37.22,
    minZ: -21.08,
    maxZ: -20.92,
    height: 2.9,
    isHazard: false,
  },
  {
    id: 'apartment-hv-switchgear',
    label: '10kV 开关柜列',
    minX: 31.4,
    maxX: 35.86,
    minZ: -24.1,
    maxZ: -23.33,
    height: 1.9,
    isHazard: true,
  },
];

/** 门扇关闭时补上的门洞碰撞体；门打开后从碰撞集合中移除。 */
export const APARTMENT_DOOR_OBSTACLE: AABB = {
  id: 'apartment-door',
  label: '公寓 10kV 配电室蓝色大门',
  minX: 30.43,
  maxX: 30.73,
  minZ: -23.62,
  maxZ: -22.23,
  height: 2.75,
  isHazard: false,
};
