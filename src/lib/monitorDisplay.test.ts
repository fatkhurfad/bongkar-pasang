/* Pengujian unit logika layar monitor 3D, periferal RGB, serta peralihan OS Windows 11 dan macOS */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MONITOR_OS_PROFILES,
  resolveMonitorDisplayState,
} from './monitorDisplay';

test('monitor dan periferal mati total saat sakelar PSU masih OFF', () => {
  const res = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: false,
    fansSpinning: false,
    postRunning: false,
    postPassed: null,
    faultLed: null,
    osId: 'windows',
  });

  assert.equal(res.mode, 'off');
  assert.equal(res.isScreenLit, false);
  assert.equal(res.isPeripheralsLit, false);
  assert.equal(res.screenEmissiveIntensity, 0);
  assert.equal(res.monitorLightIntensity, 0);
});

test('monitor masuk mode standby dengan LED kuning saat PSU ON sebelum tombol power ditekan', () => {
  const res = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: true,
    fansSpinning: false,
    postRunning: false,
    postPassed: null,
    faultLed: null,
    osId: 'macos',
  });

  assert.equal(res.mode, 'standby');
  assert.equal(res.isScreenLit, true);
  assert.equal(res.isPeripheralsLit, false);
  assert.equal(res.statusLedHex, 0xf59e0b);
});

test('saat PC menyala dan POST lulus, monitor menyala penuh baik untuk Windows 11 maupun macOS beserta periferal RGB', () => {
  const win = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: true,
    fansSpinning: true,
    postRunning: false,
    postPassed: true,
    faultLed: null,
    osId: 'windows',
  });

  const mac = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: true,
    fansSpinning: true,
    postRunning: false,
    postPassed: true,
    faultLed: null,
    osId: 'macos',
  });

  assert.equal(win.mode, 'desktop');
  assert.equal(win.isScreenLit, true);
  assert.equal(win.isPeripheralsLit, true);
  assert.equal(win.monitorGlowColorHex, MONITOR_OS_PROFILES.windows.screenGlowHex);
  assert.ok(win.screenEmissiveIntensity > 1.2);
  assert.ok(win.statusLabel.includes('Windows 11'));

  assert.equal(mac.mode, 'desktop');
  assert.equal(mac.isScreenLit, true);
  assert.equal(mac.isPeripheralsLit, true);
  assert.equal(mac.monitorGlowColorHex, MONITOR_OS_PROFILES.macos.screenGlowHex);
  assert.ok(mac.screenEmissiveIntensity > 1.2);
  assert.ok(mac.statusLabel.includes('macOS'));
});

test('saat POST sedang berjalan atau gagal, monitor menampilkan status POST atau peringatan kesalahan', () => {
  const postState = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: true,
    fansSpinning: true,
    postRunning: true,
    postPassed: null,
    faultLed: null,
    osId: 'windows',
  });
  assert.equal(postState.mode, 'post');
  assert.equal(postState.isScreenLit, true);
  assert.equal(postState.isPeripheralsLit, true);

  const errState = resolveMonitorDisplayState({
    phase: 'case',
    psuSwitchOn: true,
    fansSpinning: false,
    postRunning: false,
    postPassed: false,
    faultLed: 'VGA',
    osId: 'macos',
  });
  assert.equal(errState.mode, 'error');
  assert.equal(errState.statusLedHex, 0xef4444);
  assert.ok(errState.statusLabel.includes('VGA'));
});
