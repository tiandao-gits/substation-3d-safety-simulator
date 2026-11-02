import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyLaserHitTarget,
  computeLaserGeometry,
  evaluateLaserMeasurement,
} from './laserRangefinder';

test('computeLaserGeometry calculates exact 3D Euclidean distance, horizontal projection, and pitch angle', () => {
  const res = computeLaserGeometry(
    { x: 0, y: 1.5, z: 0 },
    { x: 3, y: 5.5, z: 4 }
  );
  // horizontal = sqrt(3^2 + 4^2) = 5.0m; dy = 4.0m; 3D = sqrt(25 + 16) = 6.40m
  assert.equal(res.horizontalM, 5);
  assert.equal(res.deltaYM, 4);
  assert.equal(res.distanceM, 6.4);
  assert.ok(res.pitchDeg > 38 && res.pitchDeg < 39);
});

test('classifyLaserHitTarget identifies 220kV live bays, 10kV cabinets, and aisle obstacles', () => {
  const bay = classifyLaserHitTarget(['MAT_PORCELAIN_BROWN', 'INSULATOR_F02'], {
    x: 4.9,
    y: 2.8,
    z: 21.6,
  });
  assert.equal(bay.category, 'live-220kv');
  assert.equal(bay.minSafeMeters, 3.0);

  const hv10 = classifyLaserHitTarget(['CABINET_10KV'], {
    x: 35.2,
    y: 1.6,
    z: -22.4,
  });
  assert.equal(hv10.category, 'live-10kv');
  assert.equal(hv10.minSafeMeters, 0.7);

  const aisle = classifyLaserHitTarget(['clue-wood-pile-aisle'], {
    x: 16.5,
    y: 0.4,
    z: 12.8,
  });
  assert.equal(aisle.category, 'aisle-obstacle');
  assert.equal(aisle.minSafeMeters, 1.2);
});

test('evaluateLaserMeasurement flags unsafe clearance when 220kV distance < 3.00m and safe when >= 3.00m', () => {
  const unsafe = evaluateLaserMeasurement(
    { x: 4.9, y: 1.6, z: 19.2 },
    { x: 4.9, y: 2.2, z: 21.6 },
    ['INSULATOR_F02'],
    1
  );
  assert.equal(unsafe.targetCategory, 'live-220kv');
  assert.equal(unsafe.isSafe, false);
  assert.ok(unsafe.distanceM < 3.0);

  const safe = evaluateLaserMeasurement(
    { x: 4.9, y: 1.6, z: 17.5 },
    { x: 4.9, y: 2.2, z: 21.6 },
    ['INSULATOR_F02'],
    1
  );
  assert.equal(safe.targetCategory, 'live-220kv');
  assert.equal(safe.isSafe, true);
  assert.ok(safe.distanceM >= 3.0);
});
