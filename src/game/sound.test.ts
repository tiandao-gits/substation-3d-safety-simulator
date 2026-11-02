import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSpatialSoundState, computeStereoPan } from './sound';

test('computeStereoPan pans sound to right (+1) and left (-1) based on listener yaw', () => {
  // Listener at (0,0) facing North (yaw = 0 => forward = (0, -1), right = (1, 0))
  const panRight = computeStereoPan(0, 0, 0, 10, 0);
  assert.equal(panRight, 1);

  const panLeft = computeStereoPan(0, 0, 0, -10, 0);
  assert.equal(panLeft, -1);

  const panFront = computeStereoPan(0, 0, 0, 0, -10);
  assert.equal(panFront, 0);
});

test('computeSpatialSoundState amplifies 220kV corona discharge near F02 bay in variant B', () => {
  const normal = computeSpatialSoundState({
    x: 5.5,
    z: 20.0,
    yaw: 0,
    act: 1,
    variant: 'A',
    active: true,
  });
  const overheated = computeSpatialSoundState({
    x: 5.5,
    z: 20.0,
    yaw: 0,
    act: 1,
    variant: 'B',
    active: true,
  });
  assert.ok(overheated.corona.intensity > normal.corona.intensity);
  assert.equal(overheated.corona.isDefectAmplified, true);
  assert.equal(overheated.dominantEmitter?.id, 'corona-220kv');
});

test('computeSpatialSoundState selects 10kV partial discharge inside 10kV room and Act 3 distribution box spark in north yard', () => {
  const room10kv = computeSpatialSoundState({
    x: 34.8,
    z: -21.8,
    yaw: 0,
    act: 1,
    variant: 'C',
    active: true,
  });
  assert.equal(room10kv.dominantEmitter?.id, 'pd-10kv');
  assert.equal(room10kv.partialDischarge.isDefectAmplified, true);

  const act3Box = computeSpatialSoundState({
    x: -21.5,
    z: -21.0,
    yaw: 0,
    act: 3,
    variant: 'C',
    active: true,
  });
  assert.equal(act3Box.dominantEmitter?.id, 'equip-anomaly');
  assert.equal(act3Box.equipmentAnomaly.isDefectAmplified, true);
});
