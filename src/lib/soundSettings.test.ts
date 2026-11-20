/* Pengujian unit untuk pemetaan profil suara per komponen, kalkulasi gain mixer, dan normalisasi pengaturan audio */

import test from 'node:test';
import assert from 'node:assert/strict';
import { HARDWARE_PARTS } from '../config';
import {
  clampVolume,
  COMPONENT_SOUND_PROFILES,
  computeEffectiveGain,
  getPartSoundEvent,
  getSoundAcousticCue,
  normalizeSoundSettings,
} from './soundSettings';

test('setiap komponen hardware memiliki profil suara pemasangan unik yang terdefinisi', () => {
  for (const part of HARDWARE_PARTS) {
    const soundEvent = getPartSoundEvent(part.id);
    assert.ok(soundEvent.startsWith('install_'), `Expected install_* event for ${part.id}`);
    const cue = getSoundAcousticCue(soundEvent);
    assert.ok(cue && cue.length > 5, `Expected acoustic cue description for ${soundEvent}`);
  }

  // Pastikan variasi spesifik yang diminta pengguna terpetakan tepat
  assert.equal(getPartSoundEvent('ram_a2'), 'install_ram');
  assert.equal(getPartSoundEvent('ram_b2'), 'install_ram');
  assert.ok(getSoundAcousticCue('install_ram')?.toLowerCase().includes('klik halus'));

  assert.equal(getPartSoundEvent('cpu_cooler'), 'install_cpu_cooler');
  assert.ok(getSoundAcousticCue('install_cpu_cooler')?.toLowerCase().includes('desis'));

  // Pastikan variasi antar komponen berbeda (tidak semua memakai satu bunyi yang sama)
  const uniqueEvents = new Set(HARDWARE_PARTS.map((p) => getPartSoundEvent(p.id)));
  assert.ok(uniqueEvents.size >= 11, `Expected >= 11 distinct component sound variations, got ${uniqueEvents.size}`);
  assert.ok(COMPONENT_SOUND_PROFILES.length >= 10);
});

test('kalkulasi gain multi-kanal mematikan output saat muted dan mengalikan master dengan kanal', () => {
  assert.equal(computeEffectiveGain(80, 90, false), 0.72);
  assert.equal(computeEffectiveGain(80, 90, true), 0);
  assert.equal(computeEffectiveGain(150, 50, false), 0.5);
  assert.equal(computeEffectiveGain(-20, 80, false), 0);
  assert.equal(clampVolume(120), 100);
  assert.equal(clampVolume(-5), 0);
});

test('normalisasi pengaturan audio menangani nilai rusak atau kosong dengan aman', () => {
  const fallback = normalizeSoundSettings(null);
  assert.equal(fallback.masterVolume, 80);
  assert.equal(fallback.sfxVolume, 90);
  assert.equal(fallback.ambientVolume, 65);
  assert.equal(fallback.muted, false);

  const partial = normalizeSoundSettings({ masterVolume: 140, muted: true });
  assert.equal(partial.masterVolume, 100);
  assert.equal(partial.sfxVolume, 90);
  assert.equal(partial.muted, true);
});
