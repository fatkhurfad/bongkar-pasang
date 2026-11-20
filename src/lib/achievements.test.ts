/* Pengujian unit untuk sistem pencapaian (lencana waktu, efisiensi kombinasi komponen, akurasi, dan bonus skor) */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAchievementBonus,
  evaluateRunAchievements,
  getPsuLoadPercent,
  mergeUnlockedAchievements,
} from './achievements';

test('lencana Perakit Kilat terbuka pada batas waktu <= 90 detik dan terkunci di 91 detik', () => {
  const fastRun = evaluateRunAchievements({
    elapsedSeconds: 90,
    mistakes: 2,
    postAttempts: 2,
    mode: 'belajar',
    hintsUsed: 1,
    buildPreset: 'hemat',
    totalWattage: 230,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });
  assert.ok(fastRun.includes('perakit_kilat'));

  const slowRun = evaluateRunAchievements({
    elapsedSeconds: 91,
    mistakes: 2,
    postAttempts: 2,
    mode: 'belajar',
    hintsUsed: 1,
    buildPreset: 'hemat',
    totalWattage: 230,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });
  assert.equal(slowRun.includes('perakit_kilat'), false);
});

test('lencana Kombinasi Paling Efisien hanya terbuka untuk paket efisien 50%-65% beban PSU', () => {
  assert.equal(getPsuLoadPercent(380), 58);

  const efficient = evaluateRunAchievements({
    elapsedSeconds: 120,
    mistakes: 1,
    postAttempts: 2,
    mode: 'belajar',
    hintsUsed: 0,
    buildPreset: 'efisien',
    totalWattage: 380,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });
  assert.ok(efficient.includes('kombinasi_efisien'));

  const lightLoad = evaluateRunAchievements({
    elapsedSeconds: 120,
    mistakes: 1,
    postAttempts: 2,
    mode: 'belajar',
    hintsUsed: 0,
    buildPreset: 'hemat',
    totalWattage: 230,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });
  assert.equal(lightLoad.includes('kombinasi_efisien'), false);

  const heavyLoad = evaluateRunAchievements({
    elapsedSeconds: 120,
    mistakes: 1,
    postAttempts: 2,
    mode: 'belajar',
    hintsUsed: 0,
    buildPreset: 'berat',
    totalWattage: 565,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });
  assert.equal(heavyLoad.includes('kombinasi_efisien'), false);
});

test('perakitan sempurna di Mode Mandiri tanpa petunjuk meraih seluruh 5 lencana dan 950 bonus skor', () => {
  const perfect = evaluateRunAchievements({
    elapsedSeconds: 65,
    mistakes: 0,
    postAttempts: 1,
    mode: 'mandiri',
    hintsUsed: 0,
    buildPreset: 'efisien',
    totalWattage: 380,
    hasDualChannelRam: true,
    hasThermalPaste: true,
  });

  assert.equal(perfect.length, 5);
  assert.equal(calculateAchievementBonus(perfect), 950);
});

test('penggabungan lencana terbuka menghapus duplikat secara deterministik', () => {
  const merged = mergeUnlockedAchievements(
    ['perakit_kilat', 'post_sekali_jadi'],
    ['post_sekali_jadi', 'kombinasi_efisien'],
  );
  assert.deepEqual(merged, ['perakit_kilat', 'post_sekali_jadi', 'kombinasi_efisien']);
});
