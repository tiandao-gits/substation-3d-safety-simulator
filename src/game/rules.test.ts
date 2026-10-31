import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKPACK_TOOLS,
  SITE_PAD_Y,
  SITE_ROAD_Y,
  WORLD_BOUNDS,
  applyMouseLookDelta,
  canStartJump,
  computeCameraRigTransform,
  computeSafetyClearance,
  createInitialPlayerState,
  distanceToLiveLine,
  getDangerLineState,
  findStandableSpotNear,
  getLiveZoneAt,
  getSubstationZoneAt,
  getDroneViolation,
  resolvePlayerCollision,
  selectMixamoAnimationState,
  siteGroundHeight,
  SUBSTATION_OBSTACLES,
  SUBSTATION_OBSTACLES_DOOR_CLOSED,
} from './rules';
import {
  APARTMENT_CAMERA_BOUNDS,
  APARTMENT_INTERIOR_FLOOR_Y,
  APARTMENT_ROOM,
  constrainApartmentCameraPosition,
  getApartmentDoorInteraction,
  isInsideApartmentRoom,
} from './apartmentDoor';
import { getActPoints } from './act1';

test('initial player spawns on the east plaza facing west', () => {
  const player = createInitialPlayerState();
  assert.equal(player.score, 88);
  assert.equal(player.x, 25);
  assert.equal(player.z, 0);
  assert.equal(player.y, 0.25, 'spawn sits on the concrete pad');
  assert.equal(
    player.yaw,
    Math.PI / 2,
    'yaw +90° looks toward -X (west)'
  );
  assert.equal(player.perspective, 'third-person');
  assert.equal(player.activeTool, 'thermometer');
});

test('backpack holds the 9 supervision tools in tools-3x3.jpg 3×3 order', () => {
  const shortNames = BACKPACK_TOOLS.map((t) => t.shortName);
  assert.deepEqual(shortNames, [
    '万用表',
    '红外测温仪',
    '漏电检测仪',
    '强光手电',
    '力矩扳手',
    '空鼓棒',
    '激光测距仪',
    '塞尺',
    '游标卡尺',
  ]);
});

test('collision keeps the player inside the perimeter', () => {
  const resWest = resolvePlayerCollision(-55, 0, 0.5);
  assert.equal(resWest.hitBoundary, true);
  assert.equal(resWest.x, WORLD_BOUNDS.minX + 0.5);

  const resNorth = resolvePlayerCollision(0, -60, 0.5);
  assert.equal(resNorth.hitBoundary, true);
  assert.equal(resNorth.z, WORLD_BOUNDS.minZ + 0.5);
});

test('live transformer and switchgear AABBs block the player', () => {
  const tr = resolvePlayerCollision(-28, 18.8, 0.55);
  assert.equal(tr.hitObstacle?.id, 'transformer-01');
  assert.ok(tr.x >= -25.63 + 0.54 || tr.x <= -31.09 - 0.54 || tr.z >= 22.39 + 0.54 || tr.z <= 15.22 - 0.54);

  const bay = resolvePlayerCollision(3.9, 18.2, 0.55);
  assert.equal(bay.hitObstacle?.id, 'switchgear-f02-bank-b');

  // 相邻间隔设备之间约 4 m 宽的巡视巷必须可走通。
  const alley = resolvePlayerCollision(2.6, 18.2, 0.55);
  assert.equal(alley.hitObstacle, null);

  const firewall = SUBSTATION_OBSTACLES.find((o) => o.id === 'firewall-1');
  assert.ok(firewall);
  const wall = resolvePlayerCollision(-20, 24.74, 0.55);
  assert.equal(wall.hitObstacle?.id, 'firewall-1');
});

test('zone detection follows the moved switchyard and transformer yard', () => {
  const front = getSubstationZoneAt(4.9, 15.56);
  assert.equal(front.safetyLevel, 'high-voltage');
  const yard = getSubstationZoneAt(-28, 18.8);
  assert.equal(yard.safetyLevel, 'high-voltage');
  const road = getSubstationZoneAt(0, 0);
  assert.ok(road.name.length > 0);
});

test('apartment entrance is a walkable doorway, not a solid building block', () => {
  // 默认世界碰撞只保留真实墙体，蓝色门洞位置可通行。
  const doorway = resolvePlayerCollision(30.58, -22.925, 0.55);
  assert.equal(doorway.hitObstacle, null);

  // 门扇关闭时，门洞由动态挡板封闭。
  const closedDoor = resolvePlayerCollision(
    30.58,
    -22.925,
    0.55,
    SUBSTATION_OBSTACLES_DOOR_CLOSED
  );
  assert.equal(closedDoor.hitObstacle?.id, 'apartment-door');

  // 室内原点与柜前巡视通道均无墙体阻挡。
  assert.equal(resolvePlayerCollision(32.15, -22.72, 0.55).hitObstacle, null);
  assert.equal(resolvePlayerCollision(33.2, -21.7, 0.55).hitObstacle, null);

  // 柜列和隔墙仍然是实体。
  assert.equal(
    resolvePlayerCollision(33.2, -23.7, 0.55).hitObstacle?.id,
    'apartment-hv-switchgear'
  );
  assert.equal(
    resolvePlayerCollision(33.2, -21.0, 0.55).hitObstacle?.id,
    'apartment-control-partition'
  );
});

test('blue door interaction resolves outside and inside correctly', () => {
  assert.equal(getApartmentDoorInteraction(28.9, -22.925), 'outside');
  assert.equal(getApartmentDoorInteraction(31.6, -22.72), 'inside');
  assert.equal(getApartmentDoorInteraction(32.35, -22.72), null);
  assert.equal(getApartmentDoorInteraction(36.5, -22.7), null);

  assert.equal(isInsideApartmentRoom(30.9, -22.9), true);
  assert.equal(isInsideApartmentRoom(30.3, -22.9), false);
  assert.equal(APARTMENT_ROOM.minX, 30.68);
});

test('indoor camera cannot leave the 10kV room shell', () => {
  const behindWestWall = constrainApartmentCameraPosition(25, 1.8, -22.8);
  assert.equal(behindWestWall.x, APARTMENT_CAMERA_BOUNDS.minX);
  assert.equal(behindWestWall.z, -22.8);

  const throughCeiling = constrainApartmentCameraPosition(33, 5, -22.2);
  assert.equal(throughCeiling.y, APARTMENT_CAMERA_BOUNDS.maxY);

  const insideSwitchgear = constrainApartmentCameraPosition(33, 1.8, -25);
  assert.equal(insideSwitchgear.z, APARTMENT_CAMERA_BOUNDS.minZ);
});

test('10kV room uses its epoxy floor elevation and indoor zone name', () => {
  assert.equal(siteGroundHeight(33.2, -22.7), APARTMENT_INTERIOR_FLOOR_Y);
  assert.equal(siteGroundHeight(29.1, -22.925), SITE_PAD_Y);
  const zone = getSubstationZoneAt(33.2, -22.7);
  assert.equal(zone.name, '公寓一层 10kV 配电室');
  assert.equal(zone.safetyLevel, 'high-voltage');
});

test('site ground height uses the raised pad and the inset road strips', () => {
  assert.equal(siteGroundHeight(5, 15.56), SITE_PAD_Y);
  assert.equal(siteGroundHeight(0, 0), SITE_ROAD_Y);
  assert.equal(siteGroundHeight(21.3, 32.5), SITE_ROAD_Y);
  assert.equal(siteGroundHeight(-13, 0), SITE_ROAD_Y);
  assert.equal(SITE_PAD_Y, 0.25);
  assert.equal(SITE_ROAD_Y, 0.038);
});

test('Mixamo animation state machine selects Idle, Walk, Run, Jump, Inspect accurately', () => {
  assert.equal(
    selectMixamoAnimationState({
      horizontalSpeed: 0,
      isGrounded: true,
      isSprinting: false,
      inspectTimer: 0,
      saluteTimer: 0,
    }),
    'Idle'
  );
  assert.equal(
    selectMixamoAnimationState({
      horizontalSpeed: 2.5,
      isGrounded: true,
      isSprinting: false,
      inspectTimer: 0,
      saluteTimer: 0,
    }),
    'Walk'
  );
  assert.equal(
    selectMixamoAnimationState({
      horizontalSpeed: 5.5,
      isGrounded: true,
      isSprinting: true,
      inspectTimer: 0,
      saluteTimer: 0,
    }),
    'Run'
  );
  assert.equal(
    selectMixamoAnimationState({
      horizontalSpeed: 0,
      isGrounded: false,
      isSprinting: false,
      inspectTimer: 0,
      saluteTimer: 0,
    }),
    'Jump'
  );
  assert.equal(
    selectMixamoAnimationState({
      horizontalSpeed: 0,
      isGrounded: true,
      isSprinting: false,
      inspectTimer: 1,
      saluteTimer: 0,
    }),
    'Inspect'
  );
});

test('canStartJump only allows a stationary, grounded jump', () => {
  assert.equal(
    canStartJump({ isGrounded: true, isJumping: false, horizontalSpeed: 0, isMoving: false }),
    true
  );
  assert.equal(
    canStartJump({ isGrounded: true, isJumping: false, horizontalSpeed: 0, isMoving: true }),
    false
  );
  assert.equal(
    canStartJump({ isGrounded: true, isJumping: false, horizontalSpeed: 0.4, isMoving: false }),
    false
  );
  assert.equal(
    canStartJump({ isGrounded: false, isJumping: false, horizontalSpeed: 0, isMoving: false }),
    false
  );
});

test('safety clearance marks the central road as safe', () => {
  const roadCheck = computeSafetyClearance(0, 20);
  assert.equal(roadCheck.isSafeDistance, true);
  assert.equal(roadCheck.distanceLabel, '达标');
  const near = computeSafetyClearance(-28.36, 18.8);
  assert.equal(near.isSafeDistance, false);
});

test('first-person, third-person, and drone camera rig transforms compute distinct positions', () => {
  const tpp = computeCameraRigTransform({
    x: 0,
    y: 0,
    z: 10,
    yaw: 0,
    pitch: 0,
    perspective: 'third-person',
  });
  const fpp = computeCameraRigTransform({
    x: 0,
    y: 0,
    z: 10,
    yaw: 0,
    pitch: 0,
    perspective: 'first-person',
  });
  const drone = computeCameraRigTransform({
    x: 0,
    y: 0,
    z: 10,
    yaw: 0,
    pitch: 0,
    droneX: 2.5,
    droneY: 14.8,
    droneZ: 2.0,
    droneYaw: -0.64,
    dronePitch: -0.46,
    perspective: 'drone',
  });
  assert.ok(tpp.camZ > 10);
  assert.ok(Math.abs(fpp.camZ - 10) < 0.3);
  assert.ok(drone.camY > 14);
});

test('applyMouseLookDelta updates yaw and clamps pitch on mouse movement', () => {
  const moved = applyMouseLookDelta(0, 0, 120, -80);
  assert.ok(moved.yaw < 0);
  assert.ok(moved.pitch > 0);
  const clamped = applyMouseLookDelta(0, 0, 0, -5000);
  assert.equal(clamped.pitch, 0.72);
});

test('drone restricted zones cover live bays and running transformers', () => {
  assert.ok(getDroneViolation(4.9, 15.56, 3), 'F02 bay is a no-fly zone');
  assert.ok(getDroneViolation(-28.4, 6.9, 3), '#2 transformer is running');
  assert.equal(
    getDroneViolation(-28.4, 18.8, 1),
    null,
    '#1 is under maintenance all day, so it is not a no-fly zone'
  );
  assert.equal(getDroneViolation(-28.4, 18.8, 2), null, '#1 is under maintenance in act 2');
  assert.equal(getDroneViolation(-24.8, -16, 3), null, 'the construction yard is clear');
  assert.equal(getDroneViolation(-6.5, -5, 3), null, 'the default drone hover is clear');
});

test('红色警戒线贴住运行设备，留出相邻间隔之间的巡视巷', () => {
  assert.equal(getLiveZoneAt(4.9, 15.56, 1)?.label, '220kV F02 运行间隔');
  assert.equal(getLiveZoneAt(4.9, 21.6, 1), null, 'bay-temp 站在 F02 警戒线外');
  assert.equal(getLiveZoneAt(9.15, 15.56, 1), null, 'F02 与 F03 之间的巡视巷可通行');
  assert.equal(getLiveZoneAt(-28.4, 6.9, 3)?.label, '#2 主变（运行）');
});

test('1# 主变全天停电检修，内圈为黄线且不触电', () => {
  assert.equal(getLiveZoneAt(-28.4, 18.8, 1), null, '第 1 幕也不按带电处理');
  assert.equal(getLiveZoneAt(-28.4, 18.8, 2), null);
  assert.equal(getLiveZoneAt(-28.4, 18.8, 3), null);
});

test('带警告文字的外圈危险线：只在越线时触发，并区分红/黄颜色', () => {
  assert.equal(getDangerLineState(22, 29, 1).inside, false, '出生点在外圈线外');
  assert.equal(
    getDangerLineState(8.5, 1.0, 1).inside,
    false,
    '前后开关设备区之间的巡视通道不属于越线区域'
  );
  assert.equal(
    getDangerLineState(-1.6, 7.8, 1).inside,
    true,
    '已越过前侧红线内侧的 (-1.6, 7.8) 必须提示'
  );
  assert.equal(
    getDangerLineState(-1.6, 7.8, 1).blockedByFirewall,
    false,
    '前侧红线与玩家之间没有防火墙'
  );
  const firewallIsolated = getDangerLineState(-24.7, 14.0, 1);
  assert.equal(firewallIsolated.inside, true, '位置在主变区红线内');
  assert.equal(
    firewallIsolated.blockedByFirewall,
    true,
    '最近带电红线被防火墙隔断，(-24.7, 14.0) 不应提示'
  );
  assert.equal(getDangerLineState(4.9, 21.6, 1).inside, true, '前侧 BAY 检查点已越过外圈线');
  assert.equal(getDangerLineState(4.9, 21.6, 2).color, 'red', '开关设备区外圈线始终为红色');
  assert.equal(getDangerLineState(4.9, -12.4, 1).inside, true, '后侧 BAY 设备区在内圈');
  assert.equal(
    getDangerLineState(-2.8, -22.0, 1).inside,
    false,
    '后侧红线外侧的 (-2.8, -22.0) 不应提示'
  );
  assert.equal(
    getDangerLineState(18.3, -14.5, 1).inside,
    false,
    '后侧红线东侧的 (18.3, -14.5) 不应提示'
  );
  assert.equal(
    getDangerLineState(-8.7, -17.6, 1).inside,
    false,
    '后侧红线西侧的 (-8.7, -17.6) 不应提示'
  );
  assert.equal(getDangerLineState(-28.3, 13.8, 1).inside, true, '主变油温点已越过主变区外圈线');
  assert.equal(getDangerLineState(-28.3, 13.8, 1).color, 'red', '第一幕 1# 主变运行，线为红色');
  assert.equal(getDangerLineState(-28.3, 13.8, 2).color, 'yellow', '第二幕 1# 主变停电，线转黄色');
  assert.equal(getDangerLineState(-19.7, 18.3, 1).inside, false, '班组集合点仍在主变区线外');
  assert.equal(getDangerLineState(35.2, -22.4, 1).inside, false, '10kV 配电室远离两条外圈线');
});

test('警戒线距离：线内 0，线外为到最近红线的水平距离', () => {
  assert.equal(distanceToLiveLine(4.9, 15.56, 1), 0);
  assert.ok(Math.abs(distanceToLiveLine(4.9, 21.6, 1) - 1.5) < 0.01);
});

test('全部检查点、站立点与重玩出生点都在带电警戒线外', () => {
  for (const act of [1, 2, 3] as const) {
    for (const point of getActPoints(act)) {
      assert.equal(
        getLiveZoneAt(point.x, point.z, act),
        null,
        `act${act} ${point.id} 检查点本身在线内`
      );
      const spot = findStandableSpotNear(point.x, point.z);
      if (spot) {
        assert.equal(
          getLiveZoneAt(spot.x, spot.z, act),
          null,
          `act${act} ${point.id} 站立点在线内`
        );
      }
      const retry = resolvePlayerCollision(point.x - 1.2, point.z + 3.6, 0.55);
      assert.equal(
        getLiveZoneAt(retry.x, retry.z, act),
        null,
        `act${act} ${point.id} 重玩出生点在线内，会立即再次触电`
      );
    }
  }
});
