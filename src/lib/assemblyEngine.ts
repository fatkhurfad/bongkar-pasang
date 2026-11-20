/* Mesin logika murni perakitan komputer, validasi hardware realistis, dan simulasi POST */

import {
  ASSEMBLY_STEPS,
  BUILD_PRESETS,
  HARDWARE_PARTS,
  MODE_DESCRIPTIONS,
  PARTS_BY_ID,
  PSU_CAPACITY_WATTS,
  type AssemblyStepDef,
  type BuildPresetId,
  type GameMode,
  type PartId,
  type RobotMood,
  type SlotId,
  type WorkbenchPhase,
} from '../config';
import {
  calculateAchievementBonus,
  evaluateRunAchievements,
  type AchievementId,
} from './achievements';
import { formatRupiah } from './formatters';
import {
  BUYABLE_SLOTS,
  CATALOG_BY_SKU,
  CLIENT_ORDERS,
  computeLoadoutCost,
  evaluateBuildLoadout,
  getStarterLoadoutForPreset,
  isBuyableSlot,
  type BuyableSlotId,
  type CatalogModuleSpec,
  type ClientOrderId,
} from './hardwareShop';
import { getPartSoundEvent, type SoundEvent } from './soundSettings';

export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type PostLedKey = 'CPU' | 'DRAM' | 'VGA' | 'BOOT';

export interface PostDiagnosticResult {
  passed: boolean;
  faultLed: PostLedKey | null;
  beepCode: string;
  headline: string;
  explanation: string;
  idleTempC: number;
  ramModeLabel: string;
}

export type DamageCause =
  | 'forced_order'
  | 'wrong_orientation'
  | 'polarity_short'
  | 'random_esd';

export interface PartDamageInfo {
  partId: PartId;
  cause: DamageCause;
  label: string;
  explanation: string;
}

export interface AssemblyState {
  screen: GameScreenState;
  mode: GameMode;
  buildPreset: BuildPresetId;
  orderId: ClientOrderId;
  budget: number;
  balance: number;
  purchasedModules: Partial<Record<BuyableSlotId, string>>;
  phase: WorkbenchPhase;
  installedParts: PartId[];
  damagedParts: Partial<Record<PartId, PartDamageInfo>>;
  damageEventsCount: number;
  repairedPartsCount: number;
  randomFaultEnabled: boolean;
  randomFaultTriggered: boolean;
  cpuLatchOpen: boolean;
  cpuRotation: number; // 0 = sejajar benar, 90 / 180 / 270 = miring
  psuSwitchOn: boolean;
  selectedPart: PartId | null;
  inspectedPart: PartId | null;
  score: number;
  mistakes: number;
  correctActions: number;
  postAttempts: number;
  hintsUsed: number;
  hintActive: boolean;
  elapsedSeconds: number;
  robotMood: RobotMood;
  robotMessage: string;
  lastErrorSlot: SlotId | null;
  lastInstalledSlot: SlotId | null;
  postResult: PostDiagnosticResult | null;
  fansSpinning: boolean;
  earnedAchievements: AchievementId[];
  achievementBonus: number;
}

export interface ActionOutcome {
  state: AssemblyState;
  ok: boolean;
  sound: SoundEvent | null;
}

export function createInitialState(
  mode: GameMode = 'belajar',
  screen: GameScreenState = 'title',
  buildPreset: BuildPresetId = 'efisien',
  randomFaultEnabled = false,
): AssemblyState {
  const firstStep = ASSEMBLY_STEPS[0];
  const orderId: ClientOrderId =
    buildPreset === 'hemat'
      ? 'kantor_hemat'
      : buildPreset === 'berat'
        ? 'workstation_pro'
        : 'gaming_efisien';
  const starterModules = getStarterLoadoutForPreset(buildPreset);
  const starterCost = computeLoadoutCost(starterModules);
  const orderBudget = Math.max(CLIENT_ORDERS[orderId].budget, starterCost);

  return {
    screen,
    mode,
    buildPreset,
    orderId,
    budget: orderBudget,
    balance: orderBudget - starterCost,
    purchasedModules: { ...starterModules },
    phase: 'bench',
    installedParts: [],
    damagedParts: {},
    damageEventsCount: 0,
    repairedPartsCount: 0,
    randomFaultEnabled,
    randomFaultTriggered: false,
    cpuLatchOpen: false,
    cpuRotation: 90, // Mulai miring 90° agar pengguna belajar menyelaraskan segitiga emas CPU!
    psuSwitchOn: false,
    selectedPart: null,
    inspectedPart: null,
    score: 0,
    mistakes: 0,
    correctActions: 0,
    postAttempts: 0,
    hintsUsed: 0,
    hintActive: mode === 'belajar',
    elapsedSeconds: 0,
    robotMood: 'guiding',
    robotMessage: firstStep.bimoPrompt,
    lastErrorSlot: null,
    lastInstalledSlot: null,
    postResult: null,
    fansSpinning: false,
    earnedAchievements: [],
    achievementBonus: 0,
  };
}

export function createWorkshopState(
  orderId: ClientOrderId,
  mode: GameMode = 'belajar',
  options: {
    screen?: GameScreenState;
    randomFaultEnabled?: boolean;
    startWithEmptyCart?: boolean;
  } = {},
): AssemblyState {
  const order = CLIENT_ORDERS[orderId];
  const startEmpty = options.startWithEmptyCart ?? true;
  const presetFromOrder: BuildPresetId =
    orderId === 'kantor_hemat'
      ? 'hemat'
      : orderId === 'workstation_pro' || orderId === 'ai_dev_rig'
        ? 'berat'
        : 'efisien';
  const purchasedModules: Partial<Record<BuyableSlotId, string>> = startEmpty
    ? {}
    : { ...order.recommendedLoadout };
  const spent = computeLoadoutCost(purchasedModules);
  const base = createInitialState(
    mode,
    options.screen ?? 'playing',
    presetFromOrder,
    options.randomFaultEnabled ?? false,
  );

  return {
    ...base,
    orderId,
    budget: order.budget,
    balance: Math.max(0, order.budget - spent),
    purchasedModules,
    robotMood: 'guiding',
    robotMessage: startEmpty
      ? `Halo! Aku BIMO. Kita menerima proyek "${order.title}" dengan anggaran ${formatRupiah(order.budget)}. Belanja dulu modul CPU, pendingin, RAM, SSD, PSU, motherboard, dan GPU di Toko Modul!`
      : `Paket modul untuk "${order.title}" sudah siap di meja anti-statis! Klik tuas soket LGA1700 untuk memulai perakitan.`,
  };
}

export function hasPart(state: AssemblyState, partId: PartId): boolean {
  return state.installedParts.includes(partId);
}

export function isPartDamaged(state: AssemblyState, partId: PartId): boolean {
  return Boolean(state.damagedParts[partId]);
}

export function getDamagedPartList(state: AssemblyState): PartDamageInfo[] {
  return Object.values(state.damagedParts).filter(
    (entry): entry is PartDamageInfo => Boolean(entry),
  );
}

export function getFaultLedForPart(partId: PartId): PostLedKey | null {
  switch (partId) {
    case 'cpu':
    case 'cpu_cooler':
    case 'thermal_paste':
    case 'cable_8pin_cpu':
      return 'CPU';
    case 'ram_a2':
    case 'ram_b2':
      return 'DRAM';
    case 'gpu':
    case 'cable_8pin_gpu':
      return 'VGA';
    case 'ssd_nvme':
      return 'BOOT';
    default:
      return null;
  }
}

export function isBenchComplete(state: AssemblyState): boolean {
  return (
    hasPart(state, 'cpu') &&
    !state.cpuLatchOpen &&
    hasPart(state, 'thermal_paste') &&
    hasPart(state, 'cpu_cooler') &&
    hasPart(state, 'ram_a2') &&
    hasPart(state, 'ram_b2') &&
    hasPart(state, 'ssd_nvme')
  );
}

export function getCurrentStepIndex(state: AssemblyState): number {
  if (!hasPart(state, 'cpu')) {
    return state.cpuLatchOpen ? 1 : 0;
  }
  if (state.cpuLatchOpen) {
    return 2;
  }
  if (!hasPart(state, 'thermal_paste')) {
    return 3;
  }
  if (!hasPart(state, 'cpu_cooler')) {
    return 4;
  }
  if (!hasPart(state, 'ram_a2') || !hasPart(state, 'ram_b2')) {
    return 5;
  }
  if (!hasPart(state, 'ssd_nvme')) {
    return 6;
  }
  if (!hasPart(state, 'psu') || !hasPart(state, 'motherboard')) {
    return 7;
  }
  if (!hasPart(state, 'gpu')) {
    return 8;
  }
  return 9;
}

export function getCurrentStep(state: AssemblyState): AssemblyStepDef {
  return ASSEMBLY_STEPS[getCurrentStepIndex(state)];
}

export function getCompletedStepCount(state: AssemblyState): number {
  if (state.postResult?.passed) return ASSEMBLY_STEPS.length;
  return getCurrentStepIndex(state);
}

export function getProgressPercent(state: AssemblyState): number {
  return Math.round((getCompletedStepCount(state) / ASSEMBLY_STEPS.length) * 100);
}

export function getPurchasedSku(
  state: AssemblyState,
  partId: PartId,
): CatalogModuleSpec | null {
  if (!isBuyableSlot(partId)) return null;
  const skuId = state.purchasedModules[partId];
  return skuId ? (CATALOG_BY_SKU[skuId] ?? null) : null;
}

export function isPartOwned(state: AssemblyState, partId: PartId): boolean {
  if (isBuyableSlot(partId)) {
    return Boolean(state.purchasedModules[partId]);
  }
  // Kabel modular (24-Pin, 8-Pin CPU, 8-Pin GPU) otomatis tersedia saat PSU sudah dibeli
  return Boolean(state.purchasedModules.psu);
}

export function getEffectivePartInfo(
  state: AssemblyState,
  partId: PartId,
): { model: string; specLine: string; shortCode: string; wattage: number; price: number } {
  const sku = getPurchasedSku(state, partId);
  if (sku) {
    return {
      model: sku.model,
      specLine: sku.specLine,
      shortCode: sku.shortCode,
      wattage: sku.wattage,
      price: sku.price,
    };
  }
  const preset = BUILD_PRESETS[state.buildPreset];
  const base = PARTS_BY_ID[partId];
  if (partId === 'cpu') {
    return {
      model: preset.cpuModel,
      specLine: preset.cpuSpecLine,
      shortCode: preset.cpuShortCode,
      wattage: preset.cpuWattage,
      price: 0,
    };
  }
  if (partId === 'gpu') {
    return {
      model: preset.gpuModel,
      specLine: preset.gpuSpecLine,
      shortCode: preset.gpuShortLabel,
      wattage: preset.gpuWattage,
      price: 0,
    };
  }
  return {
    model: base.model,
    specLine: base.specLine,
    shortCode: base.shortName,
    wattage: base.wattage,
    price: 0,
  };
}

export function getPsuCapacityWatts(state: AssemblyState): number {
  const psuSku = getPurchasedSku(state, 'psu');
  return psuSku?.psuCapacityWatts ?? PSU_CAPACITY_WATTS;
}

export function getEffectiveIdleTempC(state: AssemblyState): number {
  const evaluation = evaluateBuildLoadout(state.purchasedModules, state.orderId);
  if (state.purchasedModules.cpu) {
    return evaluation.estimatedIdleTempC;
  }
  return BUILD_PRESETS[state.buildPreset].idleTempC;
}

export function getRamSummaryLabel(state: AssemblyState): string {
  const ramA2 = getPurchasedSku(state, 'ram_a2');
  const ramB2 = getPurchasedSku(state, 'ram_b2');
  const totalGb = (ramA2?.ramGb ?? 16) + (ramB2?.ramGb ?? 16);
  const speed = Math.min(ramA2?.ramSpeedMhz ?? 5600, ramB2?.ramSpeedMhz ?? 5600);
  const dual = hasPart(state, 'ram_a2') && hasPart(state, 'ram_b2');
  return `${totalGb} GB DDR5-${speed} (${dual ? 'Dual-Channel' : 'Single-Channel'})`;
}

export function getPartWattage(state: AssemblyState, partId: PartId): number {
  const sku = getPurchasedSku(state, partId);
  if (sku) return sku.wattage;
  const preset = BUILD_PRESETS[state.buildPreset];
  if (partId === 'cpu') return preset.cpuWattage;
  if (partId === 'gpu') return preset.gpuWattage;
  return PARTS_BY_ID[partId].wattage;
}

export function getTotalWattage(state: AssemblyState): number {
  return state.installedParts.reduce((sum, partId) => sum + getPartWattage(state, partId), 0);
}

export function buyCatalogModule(
  state: AssemblyState,
  skuId: string,
  preferredSlot?: BuyableSlotId,
): ActionOutcome {
  const sku = CATALOG_BY_SKU[skuId];
  if (!sku) return { ok: false, sound: 'error', state };

  let targetSlot: BuyableSlotId = sku.slotFamily;
  if (sku.slotFamily === 'ram_a2') {
    if (preferredSlot === 'ram_a2' || preferredSlot === 'ram_b2') {
      targetSlot = preferredSlot;
    } else if (!state.purchasedModules.ram_a2) {
      targetSlot = 'ram_a2';
    } else if (!state.purchasedModules.ram_b2) {
      targetSlot = 'ram_b2';
    } else if (!hasPart(state, 'ram_b2')) {
      targetSlot = 'ram_b2';
    } else {
      targetSlot = 'ram_a2';
    }
  }

  // Izinkan upgrade PSU langsung bila PSU yang terpasang kurang daya (OCP overload)
  const allowInstalledPsuUpgrade =
    targetSlot === 'psu' &&
    hasPart(state, 'psu') &&
    (sku.psuCapacityWatts ?? 0) > getPsuCapacityWatts(state);

  if (hasPart(state, targetSlot) && !allowInstalledPsuUpgrade) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'thinking',
        robotMessage: `${PARTS_BY_ID[targetSlot].shortName} sudah terpasang secara fisik di rakitan sehingga tidak bisa ditukar.`,
      },
    };
  }

  const previousSkuId = state.purchasedModules[targetSlot];
  const previousRefund = previousSkuId ? (CATALOG_BY_SKU[previousSkuId]?.price ?? 0) : 0;
  const netCost = sku.price - previousRefund;

  if (state.balance < netCost) {
    const shortfall = netCost - state.balance;
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'warning',
        robotMessage: `Saldo anggaran tidak cukup untuk membeli ${sku.model} (kurang ${formatRupiah(shortfall)}). Jual modul lain atau pilih seri yang lebih hemat.`,
      },
    };
  }

  const nextPurchased: Partial<Record<BuyableSlotId, string>> = {
    ...state.purchasedModules,
    [targetSlot]: sku.skuId,
  };
  const nextDamaged: Partial<Record<PartId, PartDamageInfo>> = { ...state.damagedParts };
  delete nextDamaged[targetSlot];

  return {
    ok: true,
    sound: 'shop_buy',
    state: {
      ...state,
      balance: state.balance - netCost,
      purchasedModules: nextPurchased,
      damagedParts: nextDamaged,
      postResult: null,
      robotMood: 'happy',
      robotMessage: allowInstalledPsuUpgrade
        ? `PSU berhasil di-upgrade ke ${sku.model} (${sku.psuCapacityWatts} W)! Sekarang uji nyala POST kembali.`
        : `${sku.model} dibeli untuk ${PARTS_BY_ID[targetSlot].shortName}. Sisa saldo: ${formatRupiah(state.balance - netCost)}.`,
    },
  };
}

export function buyDualChannelRamKit(state: AssemblyState, skuId: string): ActionOutcome {
  const sku = CATALOG_BY_SKU[skuId];
  if (!sku || sku.slotFamily !== 'ram_a2') {
    return { ok: false, sound: 'error', state };
  }
  if (hasPart(state, 'ram_a2') || hasPart(state, 'ram_b2')) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'thinking',
        robotMessage: 'Salah satu atau kedua modul RAM sudah terpasang di motherboard.',
      },
    };
  }

  const refundA2 = state.purchasedModules.ram_a2
    ? (CATALOG_BY_SKU[state.purchasedModules.ram_a2]?.price ?? 0)
    : 0;
  const refundB2 = state.purchasedModules.ram_b2
    ? (CATALOG_BY_SKU[state.purchasedModules.ram_b2]?.price ?? 0)
    : 0;
  const netCost = sku.price * 2 - (refundA2 + refundB2);

  if (state.balance < netCost) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'warning',
        robotMessage: `Saldo tidak cukup untuk paket 2 keping ${sku.model} (kurang ${formatRupiah(netCost - state.balance)}).`,
      },
    };
  }

  const nextPurchased: Partial<Record<BuyableSlotId, string>> = {
    ...state.purchasedModules,
    ram_a2: sku.skuId,
    ram_b2: sku.skuId,
  };

  return {
    ok: true,
    sound: 'shop_buy',
    state: {
      ...state,
      balance: state.balance - netCost,
      purchasedModules: nextPurchased,
      robotMood: 'happy',
      robotMessage: `Paket Dual-Channel 2× ${sku.model} dibeli untuk slot A2 & B2! Sisa saldo: ${formatRupiah(state.balance - netCost)}.`,
    },
  };
}

export function sellCatalogModule(state: AssemblyState, slotId: BuyableSlotId): ActionOutcome {
  const existingSkuId = state.purchasedModules[slotId];
  if (!existingSkuId) {
    return { ok: false, sound: null, state };
  }
  if (hasPart(state, slotId)) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'warning',
        robotMessage: `${PARTS_BY_ID[slotId].shortName} sudah terpasang di rakitan dan tidak dapat dijual kembali.`,
      },
    };
  }

  const sku = CATALOG_BY_SKU[existingSkuId];
  const refund = sku?.price ?? 0;
  const nextPurchased: Partial<Record<BuyableSlotId, string>> = { ...state.purchasedModules };
  delete nextPurchased[slotId];

  return {
    ok: true,
    sound: 'shop_sell',
    state: {
      ...state,
      balance: state.balance + refund,
      purchasedModules: nextPurchased,
      selectedPart: state.selectedPart === slotId ? null : state.selectedPart,
      robotMood: 'idle',
      robotMessage: `${sku?.model ?? PARTS_BY_ID[slotId].shortName} dikembalikan ke toko (+${formatRupiah(refund)}).`,
    },
  };
}

export function autoFillRecommendedBuild(state: AssemblyState): ActionOutcome {
  const order = CLIENT_ORDERS[state.orderId];
  const nextPurchased: Partial<Record<BuyableSlotId, string>> = { ...state.purchasedModules };
  let remainingBalance = state.balance;
  let boughtCount = 0;

  for (const slot of BUYABLE_SLOTS) {
    if (nextPurchased[slot]) continue;
    const recSkuId = order.recommendedLoadout[slot];
    const sku = CATALOG_BY_SKU[recSkuId];
    if (!sku) continue;
    if (remainingBalance >= sku.price) {
      nextPurchased[slot] = sku.skuId;
      remainingBalance -= sku.price;
      boughtCount += 1;
    }
  }

  if (boughtCount === 0) {
    const missing = BUYABLE_SLOTS.filter((slot) => !nextPurchased[slot]);
    return {
      ok: false,
      sound: missing.length === 0 ? null : 'error',
      state: {
        ...state,
        robotMood: missing.length === 0 ? 'happy' : 'warning',
        robotMessage:
          missing.length === 0
            ? 'Semua 9 modul utama sudah kamu miliki! Kamu siap menuju Meja Rakit 3D.'
            : 'Sisa saldo belum cukup untuk melengkapi modul yang tersisa secara otomatis. Coba tukar beberapa modul ke kelas yang lebih hemat.',
      },
    };
  }

  return {
    ok: true,
    sound: 'shop_buy',
    state: {
      ...state,
      balance: remainingBalance,
      purchasedModules: nextPurchased,
      robotMood: 'happy',
      robotMessage: `${boughtCount} modul rekomendasi berhasil dibeli sesuai spesifikasi "${order.title}". Sisa anggaran: ${formatRupiah(remainingBalance)}.`,
    },
  };
}

export function getAccuracyPercent(state: AssemblyState): number {
  const total = state.correctActions + state.mistakes;
  if (total === 0) return 100;
  return Math.round((state.correctActions / total) * 100);
}

export function isPartReadyToSelect(state: AssemblyState, partId: PartId): boolean {
  if (hasPart(state, partId)) return false;
  const spec = PARTS_BY_ID[partId];
  return spec.phase === state.phase;
}

export function getActiveHintTarget(state: AssemblyState): {
  slot?: SlotId;
  part?: PartId;
  control?: 'cpu_latch' | 'rotate_cpu' | 'psu_switch' | 'power_button';
} {
  if (!state.hintActive) return {};
  const stepIdx = getCurrentStepIndex(state);
  switch (stepIdx) {
    case 0:
      return { control: 'cpu_latch' };
    case 1:
      if (state.selectedPart === 'cpu' && state.cpuRotation !== 0) {
        return { part: 'cpu', control: 'rotate_cpu' };
      }
      return { part: 'cpu', slot: 'socket_cpu' };
    case 2:
      return { control: 'cpu_latch' };
    case 3:
      return { part: 'thermal_paste', slot: 'cpu_ihs' };
    case 4:
      return { part: 'cpu_cooler', slot: 'cooler_mount' };
    case 5:
      if (!hasPart(state, 'ram_a2')) return { part: 'ram_a2', slot: 'dimm_a2' };
      return { part: 'ram_b2', slot: 'dimm_b2' };
    case 6:
      return { part: 'ssd_nvme', slot: 'm2_slot' };
    case 7:
      if (!hasPart(state, 'psu')) return { part: 'psu', slot: 'psu_bay' };
      return { part: 'motherboard', slot: 'case_standoffs' };
    case 8:
      return { part: 'gpu', slot: 'pcie_x16' };
    case 9:
      if (!hasPart(state, 'cable_24pin')) return { part: 'cable_24pin', slot: 'header_24pin' };
      if (!hasPart(state, 'cable_8pin_cpu')) return { part: 'cable_8pin_cpu', slot: 'header_8pin_cpu' };
      if (!hasPart(state, 'cable_8pin_gpu')) return { part: 'cable_8pin_gpu', slot: 'gpu_power_8pin' };
      if (!state.psuSwitchOn) return { control: 'psu_switch' };
      return { control: 'power_button' };
    default:
      return {};
  }
}

export function selectPart(state: AssemblyState, partId: PartId | null): AssemblyState {
  if (partId === null) {
    return { ...state, selectedPart: null };
  }
  if (hasPart(state, partId)) {
    return {
      ...state,
      inspectedPart: partId,
      robotMood: 'idle',
      robotMessage: `${PARTS_BY_ID[partId].name} sudah terpasang rapi. Kamu bisa melihat detail teknisnya di panel info.`,
    };
  }
  const spec = PARTS_BY_ID[partId];
  if (spec.phase !== state.phase) {
    return {
      ...state,
      robotMood: 'thinking',
      robotMessage:
        spec.phase === 'case'
          ? `${spec.name} dipasang setelah kita pindah ke dalam casing ATX.`
          : `${spec.name} termasuk tahap persiapan motherboard.`,
    };
  }

  if (!isPartOwned(state, partId)) {
    return {
      ...state,
      selectedPart: null,
      inspectedPart: partId,
      robotMood: 'guiding',
      robotMessage: `Kamu belum membeli ${spec.name}. Buka Toko Modul untuk memilih dan membeli komponen yang kamu inginkan terlebih dahulu.`,
    };
  }

  const damagedInfo = state.damagedParts[partId];
  if (damagedInfo) {
    return {
      ...state,
      selectedPart: null,
      inspectedPart: partId,
      robotMood: 'warning',
      robotMessage: `Status Part Rusak pada ${spec.name} (${damagedInfo.label}). Klik tombol Ganti Part (RMA) di Baki Komponen terlebih dahulu sebelum memasang!`,
    };
  }

  let prompt = `${spec.name} dipilih. Klik atau jatuhkan pada slot yang sesuai di papan.`;
  if (partId === 'cpu' && state.cpuRotation !== 0) {
    prompt = `Perhatikan segitiga emas di pojok CPU (posisi ${state.cpuRotation}°). Tekan tombol Putar 90° hingga menghadap kiri bawah (0°) sebelum memasangnya!`;
  } else if (partId === 'cpu' && !state.cpuLatchOpen) {
    prompt = 'CPU sudah dipilih, tetapi tuas soket LGA1700 masih terkunci. Buka tuas soket terlebih dahulu.';
  }

  return {
    ...state,
    selectedPart: partId,
    inspectedPart: partId,
    lastErrorSlot: null,
    robotMood: 'guiding',
    robotMessage: prompt,
  };
}

export function rotateCpuOrientation(state: AssemblyState): ActionOutcome {
  if (hasPart(state, 'cpu')) {
    return {
      ok: false,
      sound: null,
      state: {
        ...state,
        robotMood: 'idle',
        robotMessage: 'CPU sudah terpasang di soket dan tidak perlu diputar lagi.',
      },
    };
  }
  const nextRotation = (state.cpuRotation + 90) % 360;
  const aligned = nextRotation === 0;
  return {
    ok: true,
    sound: 'rotate',
    state: {
      ...state,
      cpuRotation: nextRotation,
      selectedPart: 'cpu',
      inspectedPart: 'cpu',
      robotMood: aligned ? 'happy' : 'guiding',
      robotMessage: aligned
        ? 'Tepat! Segitiga emas CPU sudah sejajar di pojok kiri bawah (0°). Sekarang pasang ke soket LGA1700.'
        : `CPU diputar ke ${nextRotation}°. Putar lagi sampai segitiga emas berada di pojok kiri bawah (0°).`,
    },
  };
}

export function toggleCpuLatch(state: AssemblyState): ActionOutcome {
  if (state.phase !== 'bench') {
    return { ok: false, sound: null, state };
  }
  if (hasPart(state, 'cpu_cooler')) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'warning',
        robotMessage: 'Tuas soket sudah tertutup di bawah Pendingin CPU dan terkunci aman.',
      },
    };
  }

  const nextOpen = !state.cpuLatchOpen;
  const latchSound: SoundEvent = nextOpen ? 'latch_open' : 'latch_close';

  if (!hasPart(state, 'cpu') && nextOpen) {
    return {
      ok: true,
      sound: latchSound,
      state: {
        ...state,
        cpuLatchOpen: true,
        score: state.score + 50,
        correctActions: state.correctActions + 1,
        lastErrorSlot: null,
        robotMood: 'happy',
        robotMessage:
          'Bagus! Tutup soket LGA1700 terbuka. Sekarang pilih CPU Core i5, sejajarkan segitiga emasnya ke 0°, lalu pasang perlahan.',
      },
    };
  }

  if (hasPart(state, 'cpu') && !nextOpen) {
    return {
      ok: true,
      sound: latchSound,
      state: {
        ...state,
        cpuLatchOpen: false,
        score: state.score + 50,
        correctActions: state.correctActions + 1,
        lastErrorSlot: null,
        robotMood: 'happy',
        robotMessage:
          'Soket CPU terkunci rapat! Langkah selanjutnya: oleskan Pasta Termal di tengah permukaan logam CPU.',
      },
    };
  }

  return {
    ok: true,
    sound: latchSound,
    state: {
      ...state,
      cpuLatchOpen: nextOpen,
      robotMood: 'thinking',
      robotMessage: nextOpen
        ? 'Tuas soket dibuka kembali. Pastikan CPU tetap rata di dudukannya sebelum mengunci lagi.'
        : 'Tuas soket ditutup, tetapi CPU belum dipasang. Buka lagi tuasnya untuk memasang CPU.',
    },
  };
}

const RANDOM_FAULT_CANDIDATES: PartId[] = ['ram_b2', 'ssd_nvme', 'gpu'];
const RANDOM_FAULT_PROBABILITY = 0.25;

export function replaceDamagedPart(state: AssemblyState, partId: PartId): ActionOutcome {
  const existing = state.damagedParts[partId];
  if (!existing) {
    return { ok: false, sound: null, state };
  }

  const nextDamaged: Partial<Record<PartId, PartDamageInfo>> = { ...state.damagedParts };
  delete nextDamaged[partId];
  const spec = PARTS_BY_ID[partId];

  return {
    ok: true,
    sound: 'part_repaired',
    state: {
      ...state,
      damagedParts: nextDamaged,
      repairedPartsCount: state.repairedPartsCount + 1,
      selectedPart: spec.phase === state.phase && !hasPart(state, partId) ? partId : null,
      inspectedPart: partId,
      lastErrorSlot: null,
      postResult: null,
      robotMood: 'happy',
      robotMessage: `${spec.name} yang rusak sudah diganti dengan unit cadangan baru (RMA). Pastikan urutan dan orientasi sudah tepat sebelum memasang lagi!`,
    },
  };
}

export function installPartOnSlot(
  state: AssemblyState,
  partId: PartId,
  slotId: SlotId,
  randomRoll: number = Math.random(),
): ActionOutcome {
  if (hasPart(state, partId)) {
    return {
      ok: false,
      sound: null,
      state: {
        ...state,
        robotMood: 'idle',
        robotMessage: `${PARTS_BY_ID[partId].name} sudah terpasang di tempatnya.`,
      },
    };
  }

  const spec = PARTS_BY_ID[partId];

  if (!isPartOwned(state, partId)) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        selectedPart: null,
        robotMood: 'guiding',
        robotMessage: `${spec.name} belum dibeli. Buka Toko Modul untuk membelinya terlebih dahulu sebelum dipasang.`,
      },
    };
  }

  const existingDamage = state.damagedParts[partId];
  if (existingDamage) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        lastErrorSlot: slotId,
        robotMood: 'warning',
        robotMessage: `${spec.name} berstatus Part Rusak (${existingDamage.label}) dan tidak boleh dipasang. Klik Ganti Part (RMA) di Baki Komponen terlebih dahulu.`,
      },
    };
  }

  const reject = (message: string, mood: RobotMood = 'warning'): ActionOutcome => ({
    ok: false,
    sound: 'error',
    state: {
      ...state,
      mistakes: state.mistakes + 1,
      score: Math.max(0, state.score - 15),
      lastErrorSlot: slotId,
      robotMood: mood,
      robotMessage: message,
    },
  });

  const markDamaged = (
    targetPartId: PartId,
    cause: DamageCause,
    label: string,
    explanation: string,
    isRandomFault = false,
  ): ActionOutcome => {
    const info: PartDamageInfo = {
      partId: targetPartId,
      cause,
      label,
      explanation,
    };
    return {
      ok: false,
      sound: 'part_damaged',
      state: {
        ...state,
        damagedParts: {
          ...state.damagedParts,
          [targetPartId]: info,
        },
        damageEventsCount: state.damageEventsCount + 1,
        randomFaultTriggered: state.randomFaultTriggered || isRandomFault,
        selectedPart: null,
        inspectedPart: targetPartId,
        mistakes: isRandomFault ? state.mistakes : state.mistakes + 1,
        score: isRandomFault ? state.score : Math.max(0, state.score - 25),
        lastErrorSlot: slotId,
        robotMood: 'warning',
        robotMessage: `Part Rusak! ${explanation}`,
      },
    };
  };

  // 1. Cek kesesuaian slot fisik (keying / konektor berbeda)
  if (spec.targetSlot !== slotId) {
    // Pesan khusus & status Part Rusak jika pengguna memaksa menukar kabel CPU dan GPU
    if (
      (partId === 'cable_8pin_cpu' && slotId === 'gpu_power_8pin') ||
      (partId === 'cable_8pin_gpu' && slotId === 'header_8pin_cpu')
    ) {
      return markDamaged(
        partId,
        'polarity_short',
        'Konektor 12V Korslet (Polaritas Terbalik)',
        'Hati-hati! Pin kabel 8-Pin CPU (EPS 4+4) dan 8-Pin GPU (PCIe 6+2) memiliki polaritas tegangan berbeda. Memaksanya merusak konektor — ganti kabel rusak lewat tombol RMA!',
      );
    }
    if (
      (partId === 'ram_a2' && slotId === 'dimm_b2') ||
      (partId === 'ram_b2' && slotId === 'dimm_a2')
    ) {
      // Izinkan fleksibel jika memasang keping RAM mana pun ke slot Dual-Channel yang masih kosong
      const targetPartForSlot: PartId = slotId === 'dimm_a2' ? 'ram_a2' : 'ram_b2';
      if (!hasPart(state, targetPartForSlot)) {
        return installPartOnSlot(state, targetPartForSlot, slotId, randomRoll);
      }
    }
    return reject(
      `${spec.name} tidak cocok di slot ini. Bentuk fisik konektor (keying) hanya pas pada dudukan khususnya.`,
    );
  }

  // 2. Cek prasyarat mekanis realistis & pemicu Part Rusak jika dipaksa tidak sesuai urutan
  if (partId === 'cpu') {
    if (!state.cpuLatchOpen) {
      return reject(
        'Tuas pengunci soket LGA1700 masih tertutup! Klik tuas logam di sisi kanan soket dulu sebelum meletakkan CPU.',
      );
    }
    if (state.cpuRotation !== 0) {
      return markDamaged(
        'cpu',
        'wrong_orientation',
        'Pin Kontak LGA Bengkok (Salah Orientasi)',
        `Posisi CPU masih miring (${state.cpuRotation}°)! Memaksanya masuk membuat pin kontak bengkok. Klik Ganti Part (RMA) lalu putar segitiga emas ke kiri bawah (0°).`,
      );
    }
  }

  if (partId === 'thermal_paste') {
    if (!hasPart(state, 'cpu')) {
      return reject('Pasang CPU ke soket terlebih dahulu sebelum mengoleskan pasta termal.');
    }
    if (state.cpuLatchOpen) {
      return reject('Kunci tuas soket LGA1700 dulu agar CPU tidak bergeser saat mengoleskan pasta termal.');
    }
  }

  if (partId === 'cpu_cooler') {
    if (!hasPart(state, 'cpu') || state.cpuLatchOpen) {
      return reject('Pastikan CPU sudah terpasang dan tuas soket sudah dikunci terlebih dahulu.');
    }
    if (!hasPart(state, 'thermal_paste')) {
      return markDamaged(
        'cpu_cooler',
        'forced_order',
        'Pelat Heatsink Tergores (Tanpa Pasta Termal)',
        'Tunggu dulu! Pasta termal belum dioleskan. Memaksa heatsink menempel langsung ke IHS menggores pelat tembaga dan memicu overheat 100°C. Ganti pendingin lalu oleskan pasta termal dulu.',
      );
    }
  }

  if ((partId === 'ram_a2' || partId === 'ram_b2') && (!hasPart(state, 'cpu') || state.cpuLatchOpen)) {
    return markDamaged(
      partId,
      'forced_order',
      'Pin Kontak RAM Bengkok (Dipasang Sebelum CPU)',
      'Memasang RAM secara paksa sebelum CPU terpasang dan soket terkunci melenturkan PCB motherboard dan merusak pin emas DDR5! Ganti modul RAM rusak (RMA) lalu pasang CPU terlebih dahulu.',
    );
  }

  if (partId === 'ssd_nvme' && (!hasPart(state, 'cpu') || state.cpuLatchOpen)) {
    return markDamaged(
      'ssd_nvme',
      'forced_order',
      'Konektor M.2 Retak (Dipasang Sebelum CPU)',
      'Sebaiknya pasang dan kunci CPU terlebih dahulu sebelum memasang SSD NVMe M.2 agar papan sirkuit tidak tertekan miring. Ganti SSD yang rusak lewat RMA!',
    );
  }

  if (partId === 'motherboard' && !hasPart(state, 'psu')) {
    return reject(
      'Pasang Power Supply (PSU) di kompartemen bawah casing dulu agar pemasangan kabel lebih mudah dan tidak terhalang motherboard.',
    );
  }

  if (partId === 'gpu' && !hasPart(state, 'motherboard')) {
    return reject('Motherboard harus dipasang ke casing terlebih dahulu sebelum memasang Kartu Grafis.');
  }

  if (
    (partId === 'cable_24pin' || partId === 'cable_8pin_cpu') &&
    (!hasPart(state, 'psu') || !hasPart(state, 'motherboard'))
  ) {
    return reject('Pasang PSU dan Motherboard dulu sebelum menyambungkan kabel daya.');
  }

  if (partId === 'cable_8pin_gpu' && !hasPart(state, 'gpu')) {
    return reject('Pasang Kartu Grafis (GPU) ke slot PCIe x16 dulu sebelum mencolokkan kabel daya PCIe 8-Pin.');
  }

  // 2b. Skenario Kerusakan Komponen Acak (ESD / Cacat Pabrik DOA) — maks 1 kejadian per sesi
  if (
    state.randomFaultEnabled &&
    !state.randomFaultTriggered &&
    RANDOM_FAULT_CANDIDATES.includes(partId) &&
    randomRoll < RANDOM_FAULT_PROBABILITY
  ) {
    return markDamaged(
      partId,
      'random_esd',
      'Cacat Pabrik / Lonjakan ESD (Acak)',
      `Terdeteksi gangguan listrik statis (ESD) atau cacat bawaan pabrik (DOA) saat memasang ${spec.name}! Jangan paksa lanjut — klik Ganti Part (RMA) di Baki Komponen untuk menukar unit baru.`,
      true,
    );
  }

  // 3. Berhasil memasang komponen!
  const nextInstalled: PartId[] = [...state.installedParts, partId];
  let nextPhase: WorkbenchPhase = state.phase;
  let message = `${spec.name} terpasang sempurna!`;

  const tempState: AssemblyState = {
    ...state,
    installedParts: nextInstalled,
  };

  if (state.phase === 'bench' && isBenchComplete(tempState)) {
    nextPhase = 'case';
    message =
      'Mantap! Semua komponen meja motherboard (CPU, Pendingin, RAM Dual-Channel, dan SSD NVMe) selesai. Sekarang kita masuk ke interior Casing ATX. Pasang PSU 650 W terlebih dahulu!';
  } else {
    const nextStep = getCurrentStep({ ...tempState, phase: nextPhase });
    if (partId === 'ram_a2' && !nextInstalled.includes('ram_b2')) {
      message = 'RAM Modul 1 terkunci di slot A2! Sekarang pasang RAM Modul 2 di slot B2 untuk mengaktifkan Dual-Channel.';
    } else if (partId === 'ram_b2' && !nextInstalled.includes('ram_a2')) {
      message = 'RAM Modul 2 terkunci di slot B2! Sekarang pasang RAM Modul 1 di slot A2 untuk mengaktifkan Dual-Channel.';
    } else if (partId === 'psu') {
      message = 'PSU 650 W terpasang di ruang bawah casing! Sekarang pasang Motherboard Terakit di atas 9 titik standoff.';
    } else if (partId === 'cable_24pin' || partId === 'cable_8pin_cpu' || partId === 'cable_8pin_gpu') {
      const remainingCables = (['cable_24pin', 'cable_8pin_cpu', 'cable_8pin_gpu'] as PartId[]).filter(
        (id) => !nextInstalled.includes(id),
      );
      if (remainingCables.length > 0) {
        message = `${spec.name} tersambung erat! Masih tersisa ${remainingCables.length} kabel daya lagi: ${remainingCables
          .map((id) => PARTS_BY_ID[id].shortName)
          .join(', ')}.`;
      } else {
        message =
          'Semua kabel daya terhubung sempurna! Sekarang ubah sakelar PSU di bawah ke posisi ON (I), lalu tekan Tombol Power Casing untuk uji POST.';
      }
    } else {
      message = `${spec.name} terpasang dengan benar! ${nextStep.bimoPrompt}`;
    }
  }

  return {
    ok: true,
    sound: getPartSoundEvent(partId),
    state: {
      ...state,
      phase: nextPhase,
      installedParts: nextInstalled,
      selectedPart: null,
      inspectedPart: partId,
      score: state.score + 100,
      correctActions: state.correctActions + 1,
      lastErrorSlot: null,
      lastInstalledSlot: slotId,
      postResult: null,
      robotMood: 'happy',
      robotMessage: message,
    },
  };
}

export function togglePsuSwitch(state: AssemblyState): ActionOutcome {
  if (!hasPart(state, 'psu')) {
    return {
      ok: false,
      sound: 'error',
      state: {
        ...state,
        robotMood: 'warning',
        robotMessage: 'PSU belum terpasang di dalam casing.',
      },
    };
  }
  const nextOn = !state.psuSwitchOn;
  return {
    ok: true,
    sound: nextOn ? 'psu_switch_on' : 'psu_switch_off',
    state: {
      ...state,
      psuSwitchOn: nextOn,
      postResult: null,
      robotMood: nextOn ? 'happy' : 'idle',
      robotMessage: nextOn
        ? 'Sakelar PSU sekarang ON (I) — arus siaga 5VSB sudah mengalir ke motherboard. Tekan Tombol Power Casing untuk memulai uji POST!'
        : 'Sakelar PSU dimatikan ke posisi OFF (O). Aman untuk mencabut atau memeriksa kabel.',
    },
  };
}

export function runPostCheck(state: AssemblyState): ActionOutcome {
  if (state.phase !== 'case') {
    return { ok: false, sound: 'error', state };
  }

  const nextPostAttempts = state.postAttempts + 1;

  const fail = (
    faultLed: PostLedKey | null,
    beepCode: string,
    headline: string,
    explanation: string,
  ): ActionOutcome => ({
    ok: false,
    sound: 'post_fail',
    state: {
      ...state,
      postAttempts: nextPostAttempts,
      mistakes: state.mistakes + 1,
      score: Math.max(0, state.score - 10),
      fansSpinning: false,
      postResult: {
        passed: false,
        faultLed,
        beepCode,
        headline,
        explanation,
        idleTempC: 0,
        ramModeLabel: '-',
      },
      robotMood: 'warning',
      robotMessage: `${headline} ${explanation}`,
    },
  });

  const damagedList = getDamagedPartList(state);
  if (damagedList.length > 0) {
    const firstFault = damagedList[0];
    const faultPart = PARTS_BY_ID[firstFault.partId];
    return fail(
      getFaultLedForPart(firstFault.partId),
      '3 Beep Panjang (Part Rusak)',
      `POST Gagal — Part Rusak Terdeteksi (${faultPart.shortName})!`,
      `${firstFault.label}. Ganti komponen yang rusak lewat tombol RMA sebelum menyalakan PC.`,
    );
  }

  if (!hasPart(state, 'psu') || !hasPart(state, 'motherboard')) {
    return fail(
      null,
      'Tidak ada daya',
      'Sistem belum bisa dinyalakan.',
      'Pastikan PSU dan Motherboard sudah terpasang di dalam casing terlebih dahulu.',
    );
  }

  if (!state.psuSwitchOn) {
    return fail(
      null,
      'Hening (Tanpa Arus)',
      'Tidak ada respons daya!',
      'Ini kesalahan paling sering terjadi pada perakit baru: sakelar belakang PSU masih di posisi OFF (O). Klik sakelar PSU ke posisi ON (I).',
    );
  }

  if (!hasPart(state, 'cable_24pin')) {
    return fail(
      null,
      'Hening (No Power)',
      'Motherboard belum menerima daya utama.',
      'Colokkan Kabel ATX 24-Pin ke sisi kanan motherboard agar sirkuit daya aktif.',
    );
  }

  if (!hasPart(state, 'cable_8pin_cpu')) {
    return fail(
      'CPU',
      'LED Merah CPU',
      'POST Gagal di Tahap CPU!',
      'Kipas menyala sesaat tetapi LED diagnostik CPU merah. Kabel EPS 8-Pin CPU di pojok kiri atas motherboard belum dicolokkan.',
    );
  }

  if (!hasPart(state, 'gpu')) {
    return fail(
      'VGA',
      '1 Panjang 3 Pendek',
      'POST Gagal di Tahap VGA!',
      'Kartu Grafis (GPU) belum terpasang di slot PCIe x16 sehingga tampilan tidak terdeteksi.',
    );
  }

  if (!hasPart(state, 'cable_8pin_gpu')) {
    return fail(
      'VGA',
      'LED Putih VGA',
      'Kartu Grafis Kekurangan Daya!',
      'GPU sudah terpasang, tetapi Kabel PCIe 8-Pin GPU belum dicolokkan. Sambungkan kabel daya GPU lalu coba lagi.',
    );
  }

  // Cek realistik kelebihan beban daya PSU (Over-Current Protection / OCP Trip)
  const totalWattage = getTotalWattage(state);
  const psuCapacity = getPsuCapacityWatts(state);
  if (totalWattage > psuCapacity) {
    return fail(
      null,
      'Proteksi OCP (PSU Overload)',
      'Daya PSU Tidak Mencukupi!',
      `Total beban rakitan mencapai ${totalWattage} W sedangkan PSU hanya berkapasitas ${psuCapacity} W. Buka Toko Modul untuk meng-upgrade PSU ke daya lebih tinggi.`,
    );
  }

  // Semua cek lolos! POST Sukses & BIOS menyala!
  const cpuInfo = getEffectivePartInfo(state, 'cpu');
  const gpuInfo = getEffectivePartInfo(state, 'gpu');
  const ssdInfo = getEffectivePartInfo(state, 'ssd_nvme');
  const psuSku = getPurchasedSku(state, 'psu');
  const idleTempC = getEffectiveIdleTempC(state);
  const ramModeLabel = getRamSummaryLabel(state);
  const isGoldOrBetterPsu = psuSku
    ? psuSku.psuEfficiencyTier === '80+ Gold' ||
      psuSku.psuEfficiencyTier === '80+ Platinum' ||
      psuSku.psuEfficiencyTier === '80+ Titanium'
    : undefined;

  const earnedAchievements = evaluateRunAchievements({
    elapsedSeconds: state.elapsedSeconds,
    mistakes: state.mistakes,
    postAttempts: nextPostAttempts,
    mode: state.mode,
    hintsUsed: state.hintsUsed,
    buildPreset: state.buildPreset,
    totalWattage,
    psuCapacityWatts: psuCapacity,
    isGoldOrBetterPsu,
    hasDualChannelRam: hasPart(state, 'ram_a2') && hasPart(state, 'ram_b2'),
    hasThermalPaste: hasPart(state, 'thermal_paste'),
  });
  const achievementBonus = calculateAchievementBonus(earnedAchievements);
  const accuracyBonus = state.mistakes === 0 ? 250 : Math.max(0, 150 - state.mistakes * 25);
  const finalScore = state.score + 300 + accuracyBonus + achievementBonus;

  return {
    ok: true,
    sound: 'post_ok',
    state: {
      ...state,
      screen: 'gameover',
      postAttempts: nextPostAttempts,
      score: finalScore,
      correctActions: state.correctActions + 1,
      fansSpinning: true,
      earnedAchievements,
      achievementBonus,
      postResult: {
        passed: true,
        faultLed: null,
        beepCode: '1 Beep Singkat (Normal)',
        headline: 'POST Berhasil! Sistem Masuk BIOS/UEFI',
        explanation: `${cpuInfo.model}, RAM ${ramModeLabel}, ${gpuInfo.model}, dan ${ssdInfo.model} terdeteksi normal dengan suhu kerja ${idleTempC}°C.`,
        idleTempC,
        ramModeLabel,
      },
      robotMood: 'celebrate',
      robotMessage: `Luar biasa! Satu bunyi beep singkat — POST lulus sempurna dengan ${earnedAchievements.length} lencana pencapaian (+${achievementBonus} poin bonus)!`,
    },
  };
}

export function requestRobotHint(state: AssemblyState): AssemblyState {
  const step = getCurrentStep(state);
  const penalty = MODE_DESCRIPTIONS[state.mode].hintPenalty;
  const nextScore = state.hintActive ? state.score : Math.max(0, state.score - penalty);
  const nextHints = state.hintActive ? state.hintsUsed : state.hintsUsed + 1;

  return {
    ...state,
    hintActive: true,
    score: nextScore,
    hintsUsed: nextHints,
    robotMood: 'guiding',
    robotMessage: `Petunjuk BIMO: ${step.requiredAction}`,
  };
}

export function getPhaseParts(phase: WorkbenchPhase) {
  return HARDWARE_PARTS.filter((part) => part.phase === phase);
}
