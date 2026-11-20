/* Pengujian unit untuk mesin logika perakitan komputer, validasi kesalahan, dan simulasi POST */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getAccuracyPercent,
  getCompletedStepCount,
  getDamagedPartList,
  getProgressPercent,
  getTotalWattage,
  installPartOnSlot,
  isPartDamaged,
  replaceDamagedPart,
  requestRobotHint,
  rotateCpuOrientation,
  runPostCheck,
  toggleCpuLatch,
  togglePsuSwitch,
} from './assemblyEngine';
import { formatAngle, formatDuration, formatPercent, formatScore, formatWatts } from './formatters';

test('menolak pemasangan CPU jika tuas soket LGA1700 belum dibuka', () => {
  const initial = createInitialState('belajar', 'playing');
  const aligned = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(initial).state).state).state;
  assert.equal(aligned.cpuRotation, 0);

  const attempt = installPartOnSlot(aligned, 'cpu', 'socket_cpu');
  assert.equal(attempt.ok, false);
  assert.equal(attempt.state.mistakes, 1);
  assert.equal(attempt.state.robotMood, 'warning');
  assert.ok(attempt.state.robotMessage.includes('Tuas pengunci'));
});

test('menolak pemasangan CPU jika segitiga emas belum sejajar (rotasi != 0°)', () => {
  const initial = createInitialState('belajar', 'playing');
  const opened = toggleCpuLatch(initial).state;
  assert.equal(opened.cpuLatchOpen, true);
  assert.equal(opened.cpuRotation, 90);

  const attempt = installPartOnSlot(opened, 'cpu', 'socket_cpu');
  assert.equal(attempt.ok, false);
  assert.ok(attempt.state.robotMessage.includes('miring'));
});

test('menolak pemasangan Pendingin CPU jika Pasta Termal belum dioleskan', () => {
  let state = createInitialState('belajar', 'playing');
  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;
  state = installPartOnSlot(state, 'cpu', 'socket_cpu').state;
  state = toggleCpuLatch(state).state;

  const badCooler = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount');
  assert.equal(badCooler.ok, false);
  assert.ok(badCooler.state.robotMessage.includes('Pasta termal'));
});

test('menolak penukaran kabel 8-Pin CPU ke slot 8-Pin GPU dengan peringatan polaritas', () => {
  let state = createInitialState('belajar', 'playing');
  // Selesaikan fase bench
  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;
  state = installPartOnSlot(state, 'cpu', 'socket_cpu').state;
  state = toggleCpuLatch(state).state;
  state = installPartOnSlot(state, 'thermal_paste', 'cpu_ihs').state;
  state = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount').state;
  state = installPartOnSlot(state, 'ram_a2', 'dimm_a2').state;
  state = installPartOnSlot(state, 'ram_b2', 'dimm_b2').state;
  state = installPartOnSlot(state, 'ssd_nvme', 'm2_slot').state;
  assert.equal(state.phase, 'case');

  state = installPartOnSlot(state, 'psu', 'psu_bay').state;
  state = installPartOnSlot(state, 'motherboard', 'case_standoffs').state;
  state = installPartOnSlot(state, 'gpu', 'pcie_x16').state;

  const swapped = installPartOnSlot(state, 'cable_8pin_cpu', 'gpu_power_8pin');
  assert.equal(swapped.ok, false);
  assert.ok(swapped.state.robotMessage.includes('polaritas'));
});

test('alur perakitan lengkap dari awal hingga POST sukses dan masuk layar gameover', () => {
  let state = createInitialState('belajar', 'playing');

  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(state).state; // 180
  state = rotateCpuOrientation(state).state; // 270
  state = rotateCpuOrientation(state).state; // 0
  state = installPartOnSlot(state, 'cpu', 'socket_cpu').state;
  state = toggleCpuLatch(state).state;
  state = installPartOnSlot(state, 'thermal_paste', 'cpu_ihs').state;
  state = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount').state;
  state = installPartOnSlot(state, 'ram_a2', 'dimm_a2').state;
  state = installPartOnSlot(state, 'ram_b2', 'dimm_b2').state;
  state = installPartOnSlot(state, 'ssd_nvme', 'm2_slot').state;

  assert.equal(state.phase, 'case');
  assert.equal(getTotalWattage(state), 145);

  state = installPartOnSlot(state, 'psu', 'psu_bay').state;
  state = installPartOnSlot(state, 'motherboard', 'case_standoffs').state;
  state = installPartOnSlot(state, 'gpu', 'pcie_x16').state;

  // Uji POST saat sakelar PSU masih mati -> gagal tanpa daya
  const failOff = runPostCheck(state);
  assert.equal(failOff.ok, false);
  assert.equal(failOff.state.postResult?.passed, false);
  assert.ok(failOff.state.robotMessage.includes('OFF'));

  // Nyalakan PSU tapi kabel 24-pin belum terpasang
  state = togglePsuSwitch(state).state;
  const fail24 = runPostCheck(state);
  assert.equal(fail24.ok, false);
  assert.ok(fail24.state.robotMessage.includes('24-Pin'));

  // Pasang 24-pin tapi belum 8-pin CPU -> LED CPU merah
  state = installPartOnSlot(state, 'cable_24pin', 'header_24pin').state;
  const failCpuCable = runPostCheck(state);
  assert.equal(failCpuCable.ok, false);
  assert.equal(failCpuCable.state.postResult?.faultLed, 'CPU');

  // Pasang 8-pin CPU tapi belum 8-pin GPU -> LED VGA putih
  state = installPartOnSlot(state, 'cable_8pin_cpu', 'header_8pin_cpu').state;
  const failGpuCable = runPostCheck(state);
  assert.equal(failGpuCable.ok, false);
  assert.equal(failGpuCable.state.postResult?.faultLed, 'VGA');

  // Pasang kabel 8-pin GPU lalu uji POST -> sukses!
  state = installPartOnSlot(state, 'cable_8pin_gpu', 'gpu_power_8pin').state;
  const passed = runPostCheck(state);
  assert.equal(passed.ok, true);
  assert.equal(passed.state.screen, 'gameover');
  assert.equal(passed.state.fansSpinning, true);
  assert.equal(passed.state.postResult?.passed, true);
  assert.equal(getCompletedStepCount(passed.state), 10);
  assert.equal(getProgressPercent(passed.state), 100);
  assert.equal(getTotalWattage(passed.state), 380);
});

test('mode mandiri mengurangi 25 poin saat meminta bantuan BIMO dan menghitung akurasi', () => {
  let state = createInitialState('mandiri', 'playing');
  assert.equal(state.hintActive, false);
  state = toggleCpuLatch(state).state; // +50
  assert.equal(state.score, 50);

  state = requestRobotHint(state);
  assert.equal(state.hintActive, true);
  assert.equal(state.score, 25);
  assert.equal(state.hintsUsed, 1);
  assert.equal(getAccuracyPercent(state), 100);
});

test('fungsi format angka dan durasi berjalan sesuai spesifikasi', () => {
  assert.equal(formatWatts(380.4), '380 W');
  assert.equal(formatDuration(125), '02:05');
  assert.equal(formatScore(1450), '1.450');
  assert.equal(formatPercent(87.6), '88%');
  assert.equal(formatAngle(450), '90°');
});

test('setiap tindakan mekanis dan komponen menghasilkan variasi event suara yang tepat', () => {
  let state = createInitialState('belajar', 'playing');
  const openRes = toggleCpuLatch(state);
  assert.equal(openRes.sound, 'latch_open');
  state = openRes.state;

  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;
  const cpuRes = installPartOnSlot(state, 'cpu', 'socket_cpu');
  assert.equal(cpuRes.sound, 'install_cpu');
  state = cpuRes.state;

  const closeRes = toggleCpuLatch(state);
  assert.equal(closeRes.sound, 'latch_close');
  state = closeRes.state;

  const pasteRes = installPartOnSlot(state, 'thermal_paste', 'cpu_ihs');
  assert.equal(pasteRes.sound, 'install_thermal_paste');
  state = pasteRes.state;

  const coolerRes = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount');
  assert.equal(coolerRes.sound, 'install_cpu_cooler');
  state = coolerRes.state;

  const ramRes = installPartOnSlot(state, 'ram_a2', 'dimm_a2');
  assert.equal(ramRes.sound, 'install_ram');
  state = ramRes.state;

  state = installPartOnSlot(state, 'ram_b2', 'dimm_b2').state;
  const ssdRes = installPartOnSlot(state, 'ssd_nvme', 'm2_slot');
  assert.equal(ssdRes.sound, 'install_ssd_nvme');
  state = ssdRes.state;

  const psuRes = installPartOnSlot(state, 'psu', 'psu_bay');
  assert.equal(psuRes.sound, 'install_psu');
  state = psuRes.state;

  const swOn = togglePsuSwitch(state);
  assert.equal(swOn.sound, 'psu_switch_on');
  const swOff = togglePsuSwitch(swOn.state);
  assert.equal(swOff.sound, 'psu_switch_off');
});

test('uji POST sukses mengevaluasi lencana pencapaian dan menambahkan bonus skor ke skor akhir', () => {
  let state = createInitialState('mandiri', 'playing', 'efisien');
  state = { ...state, elapsedSeconds: 55 };
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
  state = installPartOnSlot(state, 'cable_24pin', 'header_24pin').state;
  state = installPartOnSlot(state, 'cable_8pin_cpu', 'header_8pin_cpu').state;
  state = installPartOnSlot(state, 'cable_8pin_gpu', 'gpu_power_8pin').state;
  state = togglePsuSwitch(state).state;

  const scoreBeforePost = state.score;
  const passed = runPostCheck(state);
  assert.equal(passed.ok, true);
  assert.equal(passed.state.earnedAchievements.length, 5);
  assert.equal(passed.state.achievementBonus, 950);
  assert.equal(passed.state.score, scoreBeforePost + 300 + 250 + 950);
});

test('memasang RAM paksa sebelum CPU memicu status Part Rusak dan hanya bisa dipasang setelah diganti (RMA)', () => {
  const initial = createInitialState('belajar', 'playing');
  const forcedRam = installPartOnSlot(initial, 'ram_a2', 'dimm_a2');

  assert.equal(forcedRam.ok, false);
  assert.equal(forcedRam.sound, 'part_damaged');
  assert.equal(isPartDamaged(forcedRam.state, 'ram_a2'), true);
  assert.equal(forcedRam.state.damagedParts.ram_a2?.cause, 'forced_order');
  assert.equal(forcedRam.state.damageEventsCount, 1);
  assert.ok(forcedRam.state.robotMessage.includes('Part Rusak'));

  // Mencoba memasang lagi saat masih berstatus Part Rusak tetap ditolak
  const retryWhileDamaged = installPartOnSlot(forcedRam.state, 'ram_a2', 'dimm_a2');
  assert.equal(retryWhileDamaged.ok, false);
  assert.ok(retryWhileDamaged.state.robotMessage.includes('Part Rusak'));

  // Ganti komponen rusak lewat RMA
  const repaired = replaceDamagedPart(forcedRam.state, 'ram_a2');
  assert.equal(repaired.ok, true);
  assert.equal(repaired.sound, 'part_repaired');
  assert.equal(isPartDamaged(repaired.state, 'ram_a2'), false);
  assert.equal(repaired.state.repairedPartsCount, 1);
  assert.equal(getDamagedPartList(repaired.state).length, 0);
});

test('skenario kerusakan acak (ESD/DOA) aktif secara deterministik, tidak mengurangi akurasi, dan memblokir POST jika belum diganti', () => {
  let state = createInitialState('belajar', 'playing', 'efisien', true);
  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;
  state = installPartOnSlot(state, 'cpu', 'socket_cpu', 0.99).state;
  state = toggleCpuLatch(state).state;
  state = installPartOnSlot(state, 'thermal_paste', 'cpu_ihs', 0.99).state;
  state = installPartOnSlot(state, 'cpu_cooler', 'cooler_mount', 0.99).state;
  state = installPartOnSlot(state, 'ram_a2', 'dimm_a2', 0.99).state;

  // Simulasikan kerusakan acak ESD/DOA pada RAM B2 (roll 0.05 < 0.25)
  const randomHit = installPartOnSlot(state, 'ram_b2', 'dimm_b2', 0.05);
  assert.equal(randomHit.ok, false);
  assert.equal(randomHit.sound, 'part_damaged');
  assert.equal(isPartDamaged(randomHit.state, 'ram_b2'), true);
  assert.equal(randomHit.state.damagedParts.ram_b2?.cause, 'random_esd');
  assert.equal(randomHit.state.randomFaultTriggered, true);
  assert.equal(randomHit.state.mistakes, 0);

  // Jika masuk fase case dalam kondisi masih ada Part Rusak, POST berhenti dengan LED DRAM merah
  const postOnFault = runPostCheck({ ...randomHit.state, phase: 'case' });
  assert.equal(postOnFault.ok, false);
  assert.equal(postOnFault.state.postResult?.faultLed, 'DRAM');
  assert.ok(postOnFault.state.postResult?.headline.includes('Part Rusak'));

  // Setelah RMA, roll rendah kedua tidak lagi memicu kerusakan acak (maks 1x per sesi)
  const replaced = replaceDamagedPart(randomHit.state, 'ram_b2').state;
  const installedAfterRma = installPartOnSlot(replaced, 'ram_b2', 'dimm_b2', 0.01);
  assert.equal(installedAfterRma.ok, true);
  assert.equal(isPartDamaged(installedAfterRma.state, 'ram_b2'), false);
});



