import test from 'node:test';
import assert from 'node:assert/strict';
import { RADAR_RANGE_METERS, projectRadarTarget } from './radar';
import { ACT1_POINTS } from './act1';

test('radar projection is north-up with world +x to the right and +z downward', () => {
  const north = projectRadarTarget(0, 0, 0, -25, 100);
  assert.equal(north.dx, 0);
  assert.equal(north.dy, -50);
  assert.equal(north.distanceMeters, 25);

  const east = projectRadarTarget(0, 0, 25, 0, 100);
  assert.equal(east.dx, 50);
  assert.equal(east.dy, 0);

  const southEast = projectRadarTarget(0, 0, RADAR_RANGE_METERS, RADAR_RANGE_METERS, 100);
  assert.equal(southEast.dx, 100);
  assert.equal(southEast.dy, 100);
  assert.ok(Math.abs(southEast.distanceMeters - Math.hypot(50, 50)) < 1e-9);
});

test('radar blips use the same task coordinates as the 3D checkpoints', () => {
  const player = { x: 22, z: 29.4 };
  for (const point of ACT1_POINTS) {
    const projection = projectRadarTarget(
      player.x,
      player.z,
      point.x,
      point.z,
      100
    );
    assert.ok(
      Math.abs(
        projection.distanceMeters -
          Math.hypot(point.x - player.x, point.z - player.z)
      ) < 1e-9
    );
    // Inverse projection must recover the exact checkpoint world position.
    const recoveredX = player.x + (projection.dx / 100) * RADAR_RANGE_METERS;
    const recoveredZ = player.z + (projection.dy / 100) * RADAR_RANGE_METERS;
    assert.ok(Math.abs(recoveredX - point.x) < 1e-9);
    assert.ok(Math.abs(recoveredZ - point.z) < 1e-9);
  }
});
