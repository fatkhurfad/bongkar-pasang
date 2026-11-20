/* Pengujian unit mesin benchmark, estimasi FPS, termal throttling, dan profil UEFI BIOS */

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
