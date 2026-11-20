/* Pengujian unit untuk katalog toko perangkat keras, transaksi beli/jual modul, pesanan klien, dan proteksi PSU overload */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoFillRecommendedBuild,
  buyCatalogModule,
  buyDualChannelRamKit,
  createWorkshopState,
  getPsuCapacityWatts,
  getTotalWattage,
  installPartOnSlot,
  isPartOwned,
  rotateCpuOrientation,
  runPostCheck,
  sellCatalogModule,
  toggleCpuLatch,
  togglePsuSwitch,
} from './assemblyEngine';
import { formatRupiah } from './formatters';
import {
  CLIENT_ORDERS,
  evaluateBuildLoadout,
} from './hardwareShop';

test('formatRupiah memformat bilangan bulat ke standar Rupiah tanpa spasi dan tanpa desimal', () => {
  assert.equal(formatRupiah(0), 'Rp0');
  assert.equal(formatRupiah(50000), 'Rp50.000');
  assert.equal(formatRupiah(12500000), 'Rp12.500.000');
  assert.equal(formatRupiah(-75000), '-Rp75.000');
});

test('transaksi beli, tukar, dan jual kembali modul memperbarui saldo dan inventaris secara akurat', () => {
  const initial = createWorkshopState('gaming_efisien', 'belajar', {
    startWithEmptyCart: true,
  });
  assert.equal(initial.balance, 23500000);
  assert.equal(isPartOwned(initial, 'cpu'), false);

  // Beli Core i5-14600K (Rp4.850.000)
  const boughtCpu = buyCatalogModule(initial, 'cpu_i5_14600k');
  assert.equal(boughtCpu.ok, true);
  assert.equal(boughtCpu.sound, 'shop_buy');
  assert.equal(isPartOwned(boughtCpu.state, 'cpu'), true);
  assert.equal(boughtCpu.state.balance, 23500000 - 4850000);

  // Tukar CPU ke Core i3-14100 (Rp2.150.000) -> selisih Rp2.700.000 dikembalikan
  const swappedCpu = buyCatalogModule(boughtCpu.state, 'cpu_i3_14100');
  assert.equal(swappedCpu.ok, true);
  assert.equal(swappedCpu.state.purchasedModules.cpu, 'cpu_i3_14100');
  assert.equal(swappedCpu.state.balance, 23500000 - 2150000);

  // Beli paket Dual-Channel 2x 16 GB DDR5-5600 (2 x Rp875.000 = Rp1.750.000)
  const boughtRam = buyDualChannelRamKit(swappedCpu.state, 'ram_16gb_5600');
  assert.equal(boughtRam.ok, true);
  assert.equal(boughtRam.state.purchasedModules.ram_a2, 'ram_16gb_5600');
  assert.equal(boughtRam.state.purchasedModules.ram_b2, 'ram_16gb_5600');
  assert.equal(boughtRam.state.balance, 23500000 - 2150000 - 1750000);

  // Jual kembali CPU yang belum dipasang -> refund penuh Rp2.150.000
  const soldCpu = sellCatalogModule(boughtRam.state, 'cpu');
  assert.equal(soldCpu.ok, true);
  assert.equal(soldCpu.sound, 'shop_sell');
  assert.equal(isPartOwned(soldCpu.state, 'cpu'), false);
  assert.equal(soldCpu.state.balance, 23500000 - 1750000);
});

test('tidak bisa memasang komponen yang belum dibeli di Toko Modul dan menolak pembelian melebihi saldo', () => {
  let state = createWorkshopState('kantor_hemat', 'belajar', {
    startWithEmptyCart: true,
  });
  state = toggleCpuLatch(state).state;
  state = rotateCpuOrientation(rotateCpuOrientation(rotateCpuOrientation(state).state).state).state;

  // Coba pasang CPU sebelum dibeli
  const unownedAttempt = installPartOnSlot(state, 'cpu', 'socket_cpu');
  assert.equal(unownedAttempt.ok, false);
  assert.ok(unownedAttempt.state.robotMessage.includes('belum dibeli'));

  // Coba beli RTX 4080 Super (Rp16.500.000) saat anggaran kantor hanya Rp13.500.000
  const tooExpensive = buyCatalogModule(state, 'gpu_4080s');
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.sound, 'error');
  assert.ok(tooExpensive.state.robotMessage.includes('tidak cukup'));
});

test('semua paket rekomendasi pesanan klien masuk anggaran dan memenuhi 100% syarat klien', () => {
  for (const orderId of ['kantor_hemat', 'gaming_efisien', 'workstation_pro'] as const) {
    const order = CLIENT_ORDERS[orderId];
    const start = createWorkshopState(orderId, 'belajar', { startWithEmptyCart: true });
    const filled = autoFillRecommendedBuild(start);
    assert.equal(filled.ok, true, `Auto-fill harus berhasil untuk ${orderId}`);
    assert.ok(filled.state.balance >= 0, `Saldo akhir tidak boleh negatif untuk ${orderId}`);

    const evalResult = evaluateBuildLoadout(filled.state.purchasedModules, orderId);
    assert.equal(evalResult.missingSlots.length, 0, `Semua 9 modul harus terisi pada ${orderId}`);
    assert.equal(evalResult.isPsuOverloaded, false, `PSU tidak boleh overload pada ${orderId}`);
    assert.equal(
      evalResult.allOrderRequirementsMet,
      true,
      `Semua target klien harus terpenuhi untuk ${orderId}`,
    );
    assert.ok(evalResult.totalSpent <= order.budget);
  }
});

test('kombinasi beban berat dengan PSU 550 W memicu proteksi OCP saat POST dan bisa diselamatkan dengan upgrade PSU di Toko', () => {
  let state = createWorkshopState('rakit_bebas', 'belajar', { startWithEmptyCart: true });
  state = buyCatalogModule(state, 'cpu_i7_14700k').state; // 190 W
  state = buyCatalogModule(state, 'paste_nth2').state;
  state = buyCatalogModule(state, 'cooler_dual_240').state; // 8 W
  state = buyDualChannelRamKit(state, 'ram_32gb_6400').state; // 10 W
  state = buyCatalogModule(state, 'ssd_2tb_gen4').state; // 8 W
  state = buyCatalogModule(state, 'psu_550_bronze').state; // 550 W (kurang!)
  state = buyCatalogModule(state, 'mobo_b760_pro').state; // 35 W
  state = buyCatalogModule(state, 'gpu_4080s').state; // 320 W -> total 571 W > 550 W

  const preEval = evaluateBuildLoadout(state.purchasedModules, 'rakit_bebas');
  assert.equal(preEval.isPsuOverloaded, true);
  assert.equal(preEval.estimatedWattage, 571);
  assert.equal(preEval.psuCapacityWatts, 550);

  // Rakit seluruh PC
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

  assert.equal(getTotalWattage(state), 571);
  assert.equal(getPsuCapacityWatts(state), 550);

  // POST harus gagal karena OCP (PSU Overload)
  const ocpFail = runPostCheck(state);
  assert.equal(ocpFail.ok, false);
  assert.ok(ocpFail.state.postResult?.beepCode.includes('OCP'));

  // Upgrade PSU langsung ke 850 W Platinum di Toko Modul
  const upgraded = buyCatalogModule(ocpFail.state, 'psu_850_plat');
  assert.equal(upgraded.ok, true);
  assert.equal(getPsuCapacityWatts(upgraded.state), 850);

  // Uji POST ulang -> sukses!
  const postPass = runPostCheck(upgraded.state);
  assert.equal(postPass.ok, true);
  assert.equal(postPass.state.screen, 'gameover');
  assert.ok(postPass.state.postResult?.ramModeLabel.includes('64 GB DDR5-6400'));
});
