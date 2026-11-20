/* Pengujian unit sistem pencahayaan dinamis meja kerja 3D dan pantulan RGB saat simulasi nyala PC */

import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDynamicLightingRig } from './workbenchLighting';

test('kondisi merakit normal (PC mati) menjaga pencahayaan studio terang tanpa pantulan RGB di meja', () => {
  const idle = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'blue',
    isPcPoweredOn: false,
    glassPanelClosed: false,
    powerBlend: 0,
    pulsePhase: 0,
  });

  assert.equal(idle.roomDimFactor, 0);
  assert.equal(idle.keyLightIntensity, 1.95);
  assert.equal(idle.hemiLightIntensity, 0.92);
  assert.equal(idle.deskBounceLightIntensity, 0);
  assert.equal(idle.frontFanSpillLightIntensity, 0);
  assert.equal(idle.deskReflectionOpacity, 0);
  assert.equal(idle.frontReflectionOpacity, 0);
  assert.equal(idle.rgbActive, false);
});

test('saat simulasi nyala PC aktif, ruangan sedikit meredup dan pantulan RGB meja aktif penuh', () => {
  const before = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'cyan',
    isPcPoweredOn: false,
    glassPanelClosed: false,
    powerBlend: 0,
    pulsePhase: 0,
  });

  const powered = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'cyan',
    isPcPoweredOn: true,
    glassPanelClosed: false,
    powerBlend: 1,
    pulsePhase: 0,
  });

  assert.ok(powered.roomDimFactor > 0.45 && powered.roomDimFactor < 0.75);
  assert.ok(powered.keyLightIntensity < before.keyLightIntensity);
  assert.ok(powered.hemiLightIntensity < before.hemiLightIntensity);
  assert.ok(powered.rgbEmissiveIntensity > before.rgbEmissiveIntensity);
  assert.ok(powered.interiorRgbLightIntensity >= 4);
  assert.ok(powered.deskBounceLightIntensity >= 3.5);
  assert.ok(powered.frontFanSpillLightIntensity >= 3);
  assert.ok(powered.deskReflectionOpacity >= 0.5);
  assert.ok(powered.frontReflectionOpacity >= 0.45);
  assert.equal(powered.rgbActive, true);
});

test('tema RGB Mati tetap meredupkan suasana saat PC menyala namun mematikan semua pantulan RGB', () => {
  const rgbOff = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'off',
    isPcPoweredOn: true,
    glassPanelClosed: false,
    powerBlend: 1,
    pulsePhase: 0.5,
  });

  assert.ok(rgbOff.roomDimFactor > 0.45);
  assert.equal(rgbOff.rgbEmissiveIntensity, 0);
  assert.equal(rgbOff.interiorRgbLightIntensity, 0);
  assert.equal(rgbOff.deskBounceLightIntensity, 0);
  assert.equal(rgbOff.deskReflectionOpacity, 0);
  assert.equal(rgbOff.frontReflectionOpacity, 0);
  assert.equal(rgbOff.rgbActive, false);
});

test('menutup panel kaca tempered meredam sedikit pantulan sisi jendela namun menjaga semburan kipas depan', () => {
  const glassOpen = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'emerald',
    isPcPoweredOn: true,
    glassPanelClosed: false,
    powerBlend: 1,
    pulsePhase: 0,
  });

  const glassClosed = computeDynamicLightingRig({
    phase: 'case',
    studioLight: 'studio',
    rgbTheme: 'emerald',
    isPcPoweredOn: true,
    glassPanelClosed: true,
    powerBlend: 1,
    pulsePhase: 0,
  });

  assert.ok(glassClosed.deskReflectionOpacity < glassOpen.deskReflectionOpacity);
  assert.ok(glassClosed.deskBounceLightIntensity < glassOpen.deskBounceLightIntensity);
  assert.equal(glassClosed.frontReflectionOpacity, glassOpen.frontReflectionOpacity);
});
