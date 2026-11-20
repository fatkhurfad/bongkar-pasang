/* Pengujian unit mesin benchmark, estimasi FPS, termal throttling, dan pengaturan Advanced BIOS (XMP, Voltase CPU, & Kurva Kipas Manual) */

import assert from 'node:assert/strict';
import test from 'node:test';
import { runBenchmarkSimulation } from './benchmarkSim';
import { CLIENT_ORDERS } from './hardwareShop';

test('mengaktifkan XMP meningkatkan kecepatan RAM efektif dan skor multi-core CPU', () => {
  const loadout = CLIENT_ORDERS.gaming_efisien.recommendedLoadout;
  const xmpOff = runBenchmarkSimulation(loadout, 'gaming_efisien', {
    xmpEnabled: false,
    fanCurve: 'seimbang',
  });
  const xmpOn = runBenchmarkSimulation(loadout, 'gaming_efisien', {
    xmpEnabled: true,
    fanCurve: 'seimbang',
  });

  assert.equal(xmpOff.ramEffectiveMhz, 4800);
  assert.equal(xmpOn.ramEffectiveMhz, 5600);
  assert.ok(xmpOn.cpuMultiScore > xmpOff.cpuMultiScore);
  assert.ok(xmpOn.workloads[0].fps >= xmpOff.workloads[0].fps);
});

test('memasangkan Core i9-14900K dengan pendingin Compact Air 92 memicu Thermal Throttling, sedangkan Liquid AIO 240 dingin dan aman', () => {
  const hotBuild = {
    ...CLIENT_ORDERS.ai_dev_rig.recommendedLoadout,
    cpu_cooler: 'cooler_stock',
    thermal_paste: 'paste_std',
  };
  const hotReport = runBenchmarkSimulation(hotBuild, 'ai_dev_rig', {
    xmpEnabled: true,
    fanCurve: 'senyap',
  });
  assert.equal(hotReport.isThermalThrottling, true);
  assert.ok(hotReport.cpuLoadTempC >= 92);

  const aioReport = runBenchmarkSimulation(
    CLIENT_ORDERS.ai_dev_rig.recommendedLoadout,
    'ai_dev_rig',
    { xmpEnabled: true, fanCurve: 'performa' },
  );
  assert.equal(aioReport.isThermalThrottling, false);
  assert.ok(aioReport.cpuLoadTempC < hotReport.cpuLoadTempC);
  assert.ok(aioReport.cpuMultiScore > hotReport.cpuMultiScore);
  assert.equal(aioReport.storageReadMb, 7350);
});

test('kurva kipas Performa menurunkan suhu beban penuh dibandingkan kurva Senyap dengan RPM lebih tinggi', () => {
  const loadout = CLIENT_ORDERS.workstation_pro.recommendedLoadout;
  const silent = runBenchmarkSimulation(loadout, 'workstation_pro', {
    xmpEnabled: true,
    fanCurve: 'senyap',
  });
  const turbo = runBenchmarkSimulation(loadout, 'workstation_pro', {
    xmpEnabled: true,
    fanCurve: 'performa',
  });

  assert.ok(turbo.cpuLoadTempC < silent.cpuLoadTempC);
  assert.ok(turbo.fanRpmLoad > silent.fanRpmLoad);
  assert.ok(turbo.noiseDbLoad > silent.noiseDbLoad);
});

test('semua 5 pesanan klien (termasuk Streaming 240Hz dan Mesin AI Lokal) memenuhi 100% syarat dengan paket rekomendasinya', () => {
  const orderIds = [
    'kantor_hemat',
    'gaming_efisien',
    'streaming_rgb',
    'workstation_pro',
    'ai_dev_rig',
  ] as const;

  for (const id of orderIds) {
    const order = CLIENT_ORDERS[id];
    const rep = runBenchmarkSimulation(order.recommendedLoadout, id, {
      xmpEnabled: true,
      fanCurve: 'seimbang',
    });
    assert.ok(rep.overallScore >= (order.requirements.minBenchmark ?? 50), `Skor ${id} kurang`);
    assert.equal(rep.isThermalThrottling, false, `Paket rekomendasi ${id} tidak boleh throttle`);
  }
});

test('Advanced BIOS: profil XMP 2 OC dan overclock Vcore 1,32 V menaikkan skor CPU Multi dan daya puncak', () => {
  const loadout = CLIENT_ORDERS.gaming_efisien.recommendedLoadout;
  const stock = runBenchmarkSimulation(loadout, 'gaming_efisien', {
    xmpEnabled: false,
    xmpProfile: 'jedec',
    cpuVoltageV: 1.22,
    fanCurve: 'seimbang',
  });
  const tuned = runBenchmarkSimulation(loadout, 'gaming_efisien', {
    xmpEnabled: true,
    xmpProfile: 'xmp2_oc',
    cpuVoltageV: 1.32,
    fanCurve: 'performa',
  });

  assert.equal(stock.ramEffectiveMhz, 4800);
  assert.equal(tuned.ramEffectiveMhz, 6000);
  assert.equal(tuned.voltageStatus, 'overclock');
  assert.ok(tuned.cpuMultiScore > stock.cpuMultiScore);
  assert.ok(tuned.overallScore >= stock.overallScore);
  assert.ok(tuned.peakPowerWatts > stock.peakPowerWatts);
});

test('Advanced BIOS: undervolt ekstrem (< 1,10 V) memicu instabilitas skor sedangkan undervolt optimal (1,15 V) mendinginkan CPU', () => {
  const loadout = CLIENT_ORDERS.workstation_pro.recommendedLoadout;
  const nominal = runBenchmarkSimulation(loadout, 'workstation_pro', {
    xmpEnabled: true,
    xmpProfile: 'xmp1',
    cpuVoltageV: 1.22,
    fanCurve: 'seimbang',
  });
  const optimalUndervolt = runBenchmarkSimulation(loadout, 'workstation_pro', {
    xmpEnabled: true,
    xmpProfile: 'xmp1',
    cpuVoltageV: 1.15,
    fanCurve: 'seimbang',
  });
  const unstableUndervolt = runBenchmarkSimulation(loadout, 'workstation_pro', {
    xmpEnabled: true,
    xmpProfile: 'xmp1',
    cpuVoltageV: 1.06,
    fanCurve: 'seimbang',
  });

  assert.equal(optimalUndervolt.voltageStatus, 'undervolt_optimal');
  assert.ok(optimalUndervolt.cpuLoadTempC < nominal.cpuLoadTempC);
  assert.ok(optimalUndervolt.cpuMultiScore > nominal.cpuMultiScore);

  assert.equal(unstableUndervolt.voltageStatus, 'undervolt_unstable');
  assert.ok(unstableUndervolt.cpuMultiScore < nominal.cpuMultiScore);
});

test('Advanced BIOS: kurva kipas PWM manual rendah menaikkan suhu beban penuh dibanding kurva manual 100%', () => {
  const loadout = CLIENT_ORDERS.ai_dev_rig.recommendedLoadout;
  const lowManual = runBenchmarkSimulation(loadout, 'ai_dev_rig', {
    xmpEnabled: true,
    xmpProfile: 'xmp1',
    cpuVoltageV: 1.26,
    fanCurve: 'manual',
    manualFanCurve: { pwmAt40C: 20, pwmAt60C: 25, pwmAt75C: 30, pwmAt90C: 35 },
  });
  const maxManual = runBenchmarkSimulation(loadout, 'ai_dev_rig', {
    xmpEnabled: true,
    xmpProfile: 'xmp1',
    cpuVoltageV: 1.26,
    fanCurve: 'manual',
    manualFanCurve: { pwmAt40C: 60, pwmAt60C: 80, pwmAt75C: 95, pwmAt90C: 100 },
  });

  assert.ok(maxManual.cpuLoadTempC < lowManual.cpuLoadTempC);
  assert.ok(maxManual.fanRpmLoad > lowManual.fanRpmLoad);
  assert.ok(maxManual.fanDutyLoadPercent > lowManual.fanDutyLoadPercent);
});
