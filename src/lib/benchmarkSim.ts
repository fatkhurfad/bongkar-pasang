/* Mesin simulasi benchmark, estimasi FPS gim, profil UEFI BIOS (XMP & kurva kipas), serta analisis suhu/thermal throttling */

import {
  CATALOG_BY_SKU,
  evaluateBuildLoadout,
  type BuyableSlotId,
  type ClientOrderId,
} from './hardwareShop';

export type FanCurvePreset = 'senyap' | 'seimbang' | 'performa';

export interface BiosTuningSettings {
  xmpEnabled: boolean;
  fanCurve: FanCurvePreset;
}

export interface WorkloadFpsEstimate {
  id: string;
  name: string;
  resolution: string;
  fps: number;
  rating: 'Lancar Maksimal' | 'Sangat Lancar' | 'Cukup Lancar' | 'Berat';
}

export interface BenchmarkReport {
  overallScore: number; // 0-100
  cpuMultiScore: number; // Skala Cinebench-style pts
  gpuRenderScore: number; // Skala 3DMark-style pts
  storageReadMb: number;
  ramEffectiveMhz: number;
  cpuIdleTempC: number;
  cpuLoadTempC: number;
  gpuLoadTempC: number;
  isThermalThrottling: boolean;
  thermalNote: string;
  peakPowerWatts: number;
  psuCapacityWatts: number;
  psuLoadPercent: number;
  fanRpmLoad: number;
  noiseDbLoad: number;
  workloads: WorkloadFpsEstimate[];
}

export const FAN_CURVE_LABELS: Record<
  FanCurvePreset,
  { label: string; tempDeltaC: number; rpmOffset: number; noiseDeltaDb: number; note: string }
> = {
  senyap: {
    label: 'Senyap (Silent)',
    tempDeltaC: 4,
    rpmOffset: -320,
    noiseDeltaDb: -5,
    note: 'Putaran kipas rendah agar hening, suhu beban penuh naik tipis.',
  },
  seimbang: {
    label: 'Seimbang (Standard)',
    tempDeltaC: 0,
    rpmOffset: 0,
    noiseDeltaDb: 0,
    note: 'Keseimbangan ideal antara suhu stabil dan tingkat kebisingan.',
  },
  performa: {
    label: 'Performa (Turbo)',
    tempDeltaC: -5,
    rpmOffset: 480,
    noiseDeltaDb: 6,
    note: 'Aliran udara maksimal untuk menurunkan suhu beban berat.',
  },
};

export function runBenchmarkSimulation(
  purchasedModules: Partial<Record<BuyableSlotId, string>>,
  orderId: ClientOrderId,
  bios: BiosTuningSettings,
): BenchmarkReport {
  const evalResult = evaluateBuildLoadout(purchasedModules, orderId);
  const cpu = purchasedModules.cpu ? CATALOG_BY_SKU[purchasedModules.cpu] : undefined;
  const paste = purchasedModules.thermal_paste
    ? CATALOG_BY_SKU[purchasedModules.thermal_paste]
    : undefined;
  const cooler = purchasedModules.cpu_cooler
    ? CATALOG_BY_SKU[purchasedModules.cpu_cooler]
    : undefined;
  const ramA2 = purchasedModules.ram_a2 ? CATALOG_BY_SKU[purchasedModules.ram_a2] : undefined;
  const ramB2 = purchasedModules.ram_b2 ? CATALOG_BY_SKU[purchasedModules.ram_b2] : undefined;
  const ssd = purchasedModules.ssd_nvme ? CATALOG_BY_SKU[purchasedModules.ssd_nvme] : undefined;
  const gpu = purchasedModules.gpu ? CATALOG_BY_SKU[purchasedModules.gpu] : undefined;

  const baseRamMhz = Math.min(ramA2?.ramSpeedMhz ?? 4800, ramB2?.ramSpeedMhz ?? 4800);
  const ramEffectiveMhz = bios.xmpEnabled ? baseRamMhz : 4800;
  const xmpMultiplier = bios.xmpEnabled && baseRamMhz > 4800 ? 1.06 : 1.0;
  const dualChannelBonus = evalResult.isDualChannelReady ? 1.08 : 0.92;

  const fanCfg = FAN_CURVE_LABELS[bios.fanCurve];

  // Kalkulasi termal realistis berdasarkan TDP CPU, pasta termal, tipe cooler, dan kurva kipas
  const cpuTdp = cpu?.wattage ?? 125;
  const coolerDissipationOffset = cooler?.tempOffsetC ?? 0; // +5 (stock), 0 (tower120), -5 (dual240), -9 (aio240)
  const pasteOffset = paste?.tempOffsetC ?? 0;

  const cpuIdleTempC = Math.max(
    24,
    Math.round(evalResult.estimatedIdleTempC + Math.round(fanCfg.tempDeltaC * 0.4)),
  );

  // Beban penuh 100%: CPU TDP tinggi dengan cooler kecil akan panas dan throttle!
  const rawCpuLoadTemp =
    46 + cpuTdp * 0.23 + coolerDissipationOffset * 2.4 + pasteOffset * 2.2 + fanCfg.tempDeltaC;
  const cpuLoadTempC = Math.min(100, Math.max(48, Math.round(rawCpuLoadTemp)));
  const isThermalThrottling = cpuLoadTempC >= 92;

  const gpuTdp = gpu?.wattage ?? 200;
  const gpuLoadTempC = Math.min(
    86,
    Math.max(54, Math.round(52 + gpuTdp * 0.085 + fanCfg.tempDeltaC * 0.7)),
  );

  const throttlePenalty = isThermalThrottling ? 0.87 : 1.0;

  const cpuPerf = cpu?.performanceScore ?? 70;
  const gpuPerf = gpu?.performanceScore ?? 75;

  const cpuMultiScore = Math.round(
    (cpuPerf * 290 + (cpuTdp * 12)) * xmpMultiplier * dualChannelBonus * throttlePenalty,
  );
  const gpuRenderScore = Math.round(
    (gpuPerf * 245 + (gpuTdp * 14)) * (bios.xmpEnabled ? 1.03 : 1.0),
  );

  const storageReadMb =
    (ssd?.ssdGb ?? 1000) >= 4000
      ? 7350
      : (ssd?.ssdGb ?? 1000) >= 2000
        ? 7100
        : (ssd?.ssdGb ?? 1000) >= 1000
          ? 5200
          : 3500;

  const overallScore = Math.min(
    100,
    Math.round(
      evalResult.benchmarkScore * (bios.xmpEnabled && baseRamMhz > 4800 ? 1.03 : 1.0) * throttlePenalty,
    ),
  );

  const peakPowerWatts = evalResult.estimatedWattage;
  const psuCapacityWatts = evalResult.psuCapacityWatts;
  const psuLoadPercent = evalResult.psuLoadPercent;

  const baseRpm = 1150 + Math.round((cpuLoadTempC - 45) * 18);
  const fanRpmLoad = Math.max(800, Math.min(2400, baseRpm + fanCfg.rpmOffset));
  const noiseDbLoad = Math.max(24, Math.min(49, Math.round(28 + (fanRpmLoad - 900) * 0.011 + fanCfg.noiseDeltaDb)));

  const classifyFps = (fps: number): WorkloadFpsEstimate['rating'] => {
    if (fps >= 140) return 'Lancar Maksimal';
    if (fps >= 75) return 'Sangat Lancar';
    if (fps >= 45) return 'Cukup Lancar';
    return 'Berat';
  };

  const esportsFps = Math.round(
    (cpuPerf * 2.4 + gpuPerf * 1.35) * xmpMultiplier * dualChannelBonus * throttlePenalty,
  );
  const aaa1440Fps = Math.round((gpuPerf * 1.18 + cpuPerf * 0.25) * throttlePenalty - 18);
  const raytrace4kFps = Math.round((gpuPerf * 0.85 + cpuPerf * 0.14) * throttlePenalty - 26);

  const workloads: WorkloadFpsEstimate[] = [
    {
      id: 'esports_1080',
      name: 'Esports Kompetitif',
      resolution: '1080p High',
      fps: Math.max(60, esportsFps),
      rating: classifyFps(Math.max(60, esportsFps)),
    },
    {
      id: 'aaa_1440',
      name: 'Gim AAA Modern',
      resolution: '1440p Ultra',
      fps: Math.max(32, aaa1440Fps),
      rating: classifyFps(Math.max(32, aaa1440Fps)),
    },
    {
      id: 'render_4k',
      name: 'Simulasi 3D & 4K',
      resolution: '4K Ray Tracing',
      fps: Math.max(18, raytrace4kFps),
      rating: classifyFps(Math.max(18, raytrace4kFps)),
    },
  ];

  const thermalNote = isThermalThrottling
    ? `Peringatan Thermal Throttling (${cpuLoadTempC}°C)! Pendingin ${cooler?.model ?? 'saat ini'} kewalahan menahan TDP ${cpuTdp} W. Naikkan kurva kipas ke Performa atau tingkatkan ke Dual-Tower / Liquid AIO 240 mm.`
    : cpuLoadTempC <= 72
      ? `Pendinginan sangat prima (${cpuLoadTempC}°C beban penuh). Ruang suhu masih lega dan senyap.`
      : `Suhu beban penuh terkendali di ${cpuLoadTempC}°C tanpa throttling.`;

  return {
    overallScore,
    cpuMultiScore,
    gpuRenderScore,
    storageReadMb,
    ramEffectiveMhz,
    cpuIdleTempC,
    cpuLoadTempC,
    gpuLoadTempC,
    isThermalThrottling,
    thermalNote,
    peakPowerWatts,
    psuCapacityWatts,
    psuLoadPercent,
    fanRpmLoad,
    noiseDbLoad,
    workloads,
  };
}
