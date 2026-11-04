import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCrewIdlePose,
  computeMeterSweepFrame,
  computeSnappedShadowRig,
  getMeterSweepConfig,
  getPhaseThermalTargets,
  sampleThermalCrosshairTemp,
  temperatureToIronbowRgb,
} from './instrumentSim';

test('getPhaseThermalTargets returns normal and B-phase hotspot temperatures accurately', () => {
  const normalTargets = getPhaseThermalTargets('bay-temp', 'A', 'ir-3');
  assert.equal(normalTargets.length, 3);
  assert.equal(normalTargets[1].phase, 'B');
  assert.equal(normalTargets[1].isHotspot, false);
  assert.ok(normalTargets[1].tempC < 50);

  const defectTargets = getPhaseThermalTargets('bay-temp', 'B', 'ir-3');
  assert.equal(defectTargets[1].phase, 'B');
  assert.equal(defectTargets[1].isHotspot, true);
  assert.ok(defectTargets[1].tempC >= 89.4);
});

test('sampleThermalCrosshairTemp locks onto B phase when aimed at center hotspot', () => {
  const sampleAtB = sampleThermalCrosshairTemp(
    'bay-temp',
    'B',
    1,
    0.5,
    0.45,
    'ir-3'
  );
  assert.ok(sampleAtB.lockedPhase);
  assert.equal(sampleAtB.lockedPhase?.phase, 'B');
  assert.equal(sampleAtB.crosshairTempC, 92.4);

  const sampleAtCorner = sampleThermalCrosshairTemp(
    'bay-temp',
    'B',
    1,
    0.05,
    0.9,
    'ir-3'
  );
  assert.equal(sampleAtCorner.lockedPhase, null);
  assert.ok(sampleAtCorner.crosshairTempC < 40);
});

test('temperatureToIronbowRgb maps low temperature to cool blue/purple and high temperature to bright yellow/white', () => {
  const cool = temperatureToIronbowRgb(26, 25, 100);
  const hot = temperatureToIronbowRgb(92.4, 25, 100);
  assert.ok(cool[2] > cool[0], 'ambient should be blue-dominant');
  assert.ok(hot[0] > 240 && hot[1] > 200, 'hotspot should be bright yellow-white');
});

test('computeMeterSweepFrame animates over 0.8s and settles at exact target value', () => {
  const cfg = getMeterSweepConfig('a3-box', 'leakage-test', 'A');
  assert.ok(cfg);
  const startFrame = computeMeterSweepFrame(cfg!, 0, 800);
  assert.equal(startFrame.settled, false);
  assert.equal(startFrame.displayValue, '0.0');

  const midFrame = computeMeterSweepFrame(cfg!, 400, 800);
  assert.equal(midFrame.settled, false);
  assert.ok(Number(midFrame.displayValue) > 10);

  const endFrame = computeMeterSweepFrame(cfg!, 800, 800);
  assert.equal(endFrame.settled, true);
  assert.equal(endFrame.displayValue, '42.0');
});

test('computeSnappedShadowRig snaps shadow target to texel grid and keeps 22m tight frustum', () => {
  const rig1 = computeSnappedShadowRig(10.001, -5.002, 22, 2048);
  const rig2 = computeSnappedShadowRig(10.004, -5.001, 22, 2048);
  assert.equal(rig1.targetX, rig2.targetX);
  assert.equal(rig1.targetZ, rig2.targetZ);
  assert.ok(Math.abs(rig1.targetX - 10) < 0.05);
});

test('computeCrewIdlePose produces subtle breathing and act-aware motion', () => {
  const act2Pose = computeCrewIdlePose(1.2, 2, 2);
  assert.ok(act2Pose.breathScaleY > 0.99 && act2Pose.breathScaleY < 1.01);
  assert.ok(Math.abs(act2Pose.yawOffset) <= 0.07);

  const act3Pose = computeCrewIdlePose(1.2, 2, 3);
  assert.ok(act3Pose.pitchX >= 0);
});
