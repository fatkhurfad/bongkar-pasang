/* Pengujian unit untuk generator log terminal BIOS POST dan status LED diagnostik bertahap */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  installPartOnSlot,
  rotateCpuOrientation,
  runPostCheck,
  toggleCpuLatch,
  togglePsuSwitch,
} from './assemblyEngine';
import { buildPostLogSequence, getPostLedStates } from './postSequence';

function buildReadyCaseState(withAllCables: boolean, psuOn: boolean) {
  let state = createInitialState('belajar', 'playing', 'efisien');
  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;
  state = installPartOnSlot(state, 'cpu', 'socket_cpu').state;
  state = toggleCpuLatch(state).state;
  state = installPartOnSlot(state, 'thermal_paste', 'cpu_ihs').state;
  state = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount').state;
  state = installPartOnSlot(state, 'ram_a2', 'dimm_a2').state;
  state = installPartOnSlot(state, 'ram_b2', 'dimm_b2').state;
  state = installPartOnSlot(state, 'ssd_nvme', 'm2_slot').state;
  state = installPartOnSlot(state, 'psu', 'psu_bay').state;
  state = installPartOnSlot(state, 'motherboard', 'case_standoffs').state;
  state = installPartOnSlot(state, 'gpu', 'pcie_x16').state;
  if (withAllCables) {
    state = installPartOnSlot(state, 'cable_24pin', 'header_24pin').state;
    state = installPartOnSlot(state, 'cable_8pin_cpu', 'header_8pin_cpu').state;
    state = installPartOnSlot(state, 'cable_8pin_gpu', 'gpu_power_8pin').state;
  }
  if (psuOn) {
    state = togglePsuSwitch(state).state;
  }
  return state;
}

test('urutan log POST lengkap menampilkan semua tahap hingga PASS dan menyalakan 4 LED hijau', () => {
  const ready = buildReadyCaseState(true, true);
  const outcome = runPostCheck(ready);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.state.postResult);

  const lines = buildPostLogSequence(outcome.state, outcome.state.postResult);
  assert.ok(lines.length >= 7);
  assert.ok(lines.some((line) => line.stage === 'CPU' && line.status === 'ok'));
  assert.ok(lines.some((line) => line.stage === 'DRAM' && line.status === 'ok'));
  assert.ok(lines.some((line) => line.stage === 'VGA' && line.status === 'ok'));
  assert.ok(lines.some((line) => line.stage === 'BOOT' && line.status === 'ok'));
  assert.equal(lines.some((line) => line.status === 'fail'), false);

  const finalLeds = getPostLedStates(lines, lines.length);
  assert.deepEqual(finalLeds, {
    CPU: 'ok',
    DRAM: 'ok',
    VGA: 'ok',
    BOOT: 'ok',
  });
});

test('urutan log POST berhenti dengan status fail di tahap POWER saat sakelar PSU masih OFF', () => {
  const ready = buildReadyCaseState(true, false);
  const outcome = runPostCheck(ready);
  assert.equal(outcome.ok, false);
  assert.ok(outcome.state.postResult);

  const lines = buildPostLogSequence(outcome.state, outcome.state.postResult);
  const lastLine = lines[lines.length - 1];
  assert.equal(lastLine.stage, 'POWER');
  assert.equal(lastLine.status, 'fail');
});

test('urutan log POST berhenti di tahap CPU dengan LED CPU fail saat kabel 8-Pin CPU belum colok', () => {
  let state = buildReadyCaseState(false, true);
  state = installPartOnSlot(state, 'cable_24pin', 'header_24pin').state;
  const outcome = runPostCheck(state);
  assert.equal(outcome.ok, false);
  assert.ok(outcome.state.postResult);

  const lines = buildPostLogSequence(outcome.state, outcome.state.postResult);
  const leds = getPostLedStates(lines, lines.length);
  assert.equal(leds.CPU, 'fail');
  assert.equal(leds.DRAM, 'off');
});
