/* Mesin simulasi benchmark, estimasi FPS gim, profil UEFI BIOS lanjutan (XMP, Voltase CPU, & Kurva Kipas PWM Manual), serta analisis suhu/thermal throttling */

import {
  CATALOG_BY_SKU,
  evaluateBuildLoadout,
  type BuyableSlotId,
  type ClientOrderId,
} from './hardwareShop';

export type FanCurvePreset = 'senyap' | 'seimbang' | 'performa' | 'manual';
export type XmpProfileId = 'jedec' | 'xmp1' | 'xmp2_oc';
export type CpuVoltageStatus =
  | 'undervolt_unstable'
  | 'undervolt_optimal'
  | 'nominal'
  | 'overclock'
  | 'overvolt_danger';

export interface ManualFanCurvePoints {
  pwmAt40C: number;
  pwmAt60C: number;
  pwmAt75C: number;
  pwmAt90C: number;
}

export interface BiosTuningSettings {
  xmpEnabled: boolean;
  xmpProfile?: XmpProfileId;
  cpuVoltageV?: number;
  fanCurve: FanCurvePreset;
  manualFanCurve?: ManualFanCurvePoints;
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
  xmpProfile: XmpProfileId;
  cpuVoltageV: number;
  voltageStatus: CpuVoltageStatus;
  fanDutyLoadPercent: number;
  biosSummaryLabel: string;
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

export const PRESET_FAN_CURVE_POINTS: Record<Exclude<FanCurvePreset, 'manual'>, ManualFanCurvePoints> = {
  senyap: { pwmAt40C: 25, pwmAt60C: 38, pwmAt75C: 52, pwmAt90C: 68 },
  seimbang: { pwmAt40C: 35, pwmAt60C: 55, pwmAt75C: 72, pwmAt90C: 88 },
  performa: { pwmAt40C: 50, pwmAt60C: 75, pwmAt75C: 92, pwmAt90C: 100 },
};

export const DEFAULT_BIOS_SETTINGS: BiosTuningSettings = {
  xmpEnabled: true,
  xmpProfile: 'xmp1',
  cpuVoltageV: 1.22,
  fanCurve: 'seimbang',
  manualFanCurve: { ...PRESET_FAN_CURVE_POINTS.seimbang },
};

export const XMP_PROFILE_META: Record<
  XmpProfileId,
  { label: string; shortLabel: string; description: string }
> = {
  jedec: {
    label: 'JEDEC Bawaan (4800 MHz)',
    shortLabel: 'JEDEC 4800',
    description: 'Kecepatan standar pabrik paling aman tanpa overclock memori.',
  },
  xmp1: {
    label: 'XMP Profile 1 (Kecepatan Penuh)',
    shortLabel: 'XMP 1',
    description: 'Mengaktifkan spesifikasi penuh modul DDR5 (5600/6400 MHz).',
  },
  xmp2_oc: {
    label: 'XMP Profile 2 (OC +400 MHz)',
    shortLabel: 'XMP 2 OC',
    description: 'Overclock bandwidth memori ekstra untuk dorongan skor CPU & FPS.',
  },
};

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
  manual: {
    label: 'Kustom Manual (PWM)',
    tempDeltaC: 0,
    rpmOffset: 0,
    noiseDeltaDb: 0,
    note: 'Mengikuti titik kurva PWM manual (40°C, 60°C, 75°C, 90°C) yang kamu atur di BIOS.',
  },
};

export function clampPwm(value: number): number {
  return Math.max(20, Math.min(100, Math.round(value)));
}

export function clampCpuVoltage(value: number): number {
  return Number(Math.max(1.05, Math.min(1.45, value)).toFixed(2));
}

export function resolveEffectiveXmpProfile(bios: BiosTuningSettings): XmpProfileId {
  if (bios.xmpProfile) return bios.xmpProfile;
  return bios.xmpEnabled ? 'xmp1' : 'jedec';
}

export function resolveFanCurvePoints(bios: BiosTuningSettings): ManualFanCurvePoints {
  if (bios.fanCurve === 'manual' && bios.manualFanCurve) {
    return {
      pwmAt40C: clampPwm(bios.manualFanCurve.pwmAt40C),
      pwmAt60C: clampPwm(bios.manualFanCurve.pwmAt60C),
      pwmAt75C: clampPwm(bios.manualFanCurve.pwmAt75C),
      pwmAt90C: clampPwm(bios.manualFanCurve.pwmAt90C),
    };
  }
  const presetKey: Exclude<FanCurvePreset, 'manual'> =
    bios.fanCurve === 'manual' ? 'seimbang' : bios.fanCurve;
  return PRESET_FAN_CURVE_POINTS[presetKey];
}

export function evaluateCpuVoltageProfile(voltageV: number): {
  status: CpuVoltageStatus;
  perfMultiplier: number;
  tempDeltaC: number;
  wattDelta: number;
  label: string;
  note: string;
} {
  const v = clampCpuVoltage(voltageV);
  const deltaV = v - 1.22;

  if (v < 1.1) {
    return {
      status: 'undervolt_unstable',
      perfMultiplier: 0.86,
      tempDeltaC: -7,
      wattDelta: -22,
      label: 'Undervolt Tidak Stabil',
      note: 'Voltase di bawah 1,10 V menyebabkan clock stretching dan penurunan skor CPU.',
    };
  }
  if (v < 1.2) {
    return {
      status: 'undervolt_optimal',
      perfMultiplier: 1.03,
      tempDeltaC: Math.round(deltaV * 55),
      wattDelta: Math.round(deltaV * 160),
      label: 'Undervolt Efisien',
      note: 'Tegangan efisien menurunkan suhu dan daya sekaligus menjaga boost stabil.',
    };
  }
  if (v <= 1.25) {
    return {
      status: 'nominal',
      perfMultiplier: 1.0,
      tempDeltaC: 0,
      wattDelta: 0,
      label: 'Standar Pabrik (Auto)',
      note: 'Tegangan aman bawaan pabrikan untuk stabilitas harian.',
    };
  }
  if (v <= 1.36) {
    return {
      status: 'overclock',
      perfMultiplier: Number((1 + (v - 1.25) * 0.72).toFixed(3)),
      tempDeltaC: Math.round((v - 1.22) * 85),
      wattDelta: Math.round((v - 1.22) * 280),
      label: 'Overclock Aktif',
      note: 'Meningkatkan skor CPU Multi-Core, butuh pendingin kuat dan kipas kencang.',
    };
  }
  return {
    status: 'overvolt_danger',
    perfMultiplier: 1.05,
    tempDeltaC: Math.round((v - 1.22) * 115),
    wattDelta: Math.round((v - 1.22) * 380),
    label: 'Overvolt Tinggi (Panas)',
    note: 'Tegangan di atas 1,36 V memicu lonjakan panas drastis dan risiko thermal throttling.',
  };
}

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

  // 1. Evaluasi profil XMP / EXPO RAM
  const xmpProfile = resolveEffectiveXmpProfile(bios);
  const baseRamMhz = Math.min(ramA2?.ramSpeedMhz ?? 4800, ramB2?.ramSpeedMhz ?? 4800);
  const ramEffectiveMhz =
    xmpProfile === 'jedec'
      ? 4800
      : xmpProfile === 'xmp2_oc'
        ? Math.min(7200, Math.max(baseRamMhz, 5200) + 400)
        : baseRamMhz;

  const xmpMultiplier =
    xmpProfile === 'xmp2_oc'
      ? 1.1
      : xmpProfile === 'xmp1' && baseRamMhz > 4800
        ? 1.06
        : 1.0;
  const gpuXmpMultiplier =
    xmpProfile === 'xmp2_oc' ? 1.05 : xmpProfile === 'xmp1' ? 1.03 : 1.0;
  const overallXmpMultiplier =
    xmpProfile === 'xmp2_oc'
      ? 1.05
      : xmpProfile === 'xmp1' && baseRamMhz > 4800
        ? 1.03
        : 1.0;
  const imcHeatDelta = xmpProfile === 'xmp2_oc' ? 2 : 0;

  const dualChannelBonus = evalResult.isDualChannelReady ? 1.08 : 0.92;

  // 2. Evaluasi Voltase CPU (Vcore)
  const cpuVoltageV = clampCpuVoltage(bios.cpuVoltageV ?? 1.22);
  const voltageEval = evaluateCpuVoltageProfile(cpuVoltageV);

  // 3. Evaluasi Kurva Kipas PWM (Preset atau Manual 4 titik)
  const curvePoints = resolveFanCurvePoints(bios);
  const fanDutyLoadPercent = Math.round(curvePoints.pwmAt75C * 0.45 + curvePoints.pwmAt90C * 0.55);

  let fanTempDeltaC: number;
  let fanRpmOffset: number;
  let fanNoiseDeltaDb: number;

  if (bios.fanCurve === 'manual') {
    // Baseline seimbang memiliki duty beban penuh ~81%
    const dutyDiff = fanDutyLoadPercent - 81;
    fanTempDeltaC = Math.round(-dutyDiff * 0.22); // 100% -> -4..-5C, 30% -> +11C
    fanRpmOffset = Math.round(dutyDiff * 17);
    fanNoiseDeltaDb = Math.round(dutyDiff * 0.2);
  } else {
    const fanCfg = FAN_CURVE_LABELS[bios.fanCurve];
    fanTempDeltaC = fanCfg.tempDeltaC;
    fanRpmOffset = fanCfg.rpmOffset;
    fanNoiseDeltaDb = fanCfg.noiseDeltaDb;
  }

  // Kalkulasi termal realistis berdasarkan TDP CPU, pasta termal, tipe cooler, voltase, XMP OC, dan kurva kipas
  const cpuTdp = cpu?.wattage ?? 125;
  const coolerDissipationOffset = cooler?.tempOffsetC ?? 0; // +5 (stock), 0 (tower120), -5 (dual240), -9 (aio240)
  const pasteOffset = paste?.tempOffsetC ?? 0;

  const idleDutyDiff = curvePoints.pwmAt40C - 35;
  const cpuIdleTempC = Math.max(
    24,
    Math.round(
      evalResult.estimatedIdleTempC +
        Math.round(fanTempDeltaC * 0.35) +
        Math.round(voltageEval.tempDeltaC * 0.25) -
        Math.round(idleDutyDiff * 0.08),
    ),
  );

  // Beban penuh 100%: CPU TDP tinggi dengan cooler kecil / overvolt / kipas rendah akan panas dan throttle!
  const rawCpuLoadTemp =
    46 +
    cpuTdp * 0.23 +
    coolerDissipationOffset * 2.4 +
    pasteOffset * 2.2 +
    fanTempDeltaC +
    voltageEval.tempDeltaC +
    imcHeatDelta;
  const cpuLoadTempC = Math.min(100, Math.max(46, Math.round(rawCpuLoadTemp)));
  const isThermalThrottling = cpuLoadTempC >= 92;

  const gpuTdp = gpu?.wattage ?? 200;
  const gpuLoadTempC = Math.min(
    88,
    Math.max(52, Math.round(52 + gpuTdp * 0.085 + fanTempDeltaC * 0.7)),
  );

  const throttlePenalty = isThermalThrottling ? 0.87 : 1.0;

  const cpuPerf = cpu?.performanceScore ?? 70;
  const gpuPerf = gpu?.performanceScore ?? 75;

  const cpuMultiScore = Math.round(
    (cpuPerf * 290 + cpuTdp * 12) *
      xmpMultiplier *
      dualChannelBonus *
      voltageEval.perfMultiplier *
      throttlePenalty,
  );
  const gpuRenderScore = Math.round((gpuPerf * 245 + gpuTdp * 14) * gpuXmpMultiplier);

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
    Math.max(
      10,
      Math.round(
        evalResult.benchmarkScore *
          overallXmpMultiplier *
          (1 + (voltageEval.perfMultiplier - 1) * 0.45) *
          throttlePenalty,
      ),
    ),
  );

  const peakPowerWatts = Math.max(80, evalResult.estimatedWattage + voltageEval.wattDelta);
  const psuCapacityWatts = evalResult.psuCapacityWatts;
  const psuLoadPercent = Math.round((peakPowerWatts / Math.max(psuCapacityWatts, 1)) * 100);

  const baseRpm = 1150 + Math.round((cpuLoadTempC - 45) * 18);
  const fanRpmLoad = Math.max(750, Math.min(2500, baseRpm + fanRpmOffset));
  const noiseDbLoad = Math.max(
    23,
    Math.min(50, Math.round(28 + (fanRpmLoad - 900) * 0.011 + fanNoiseDeltaDb)),
  );

  const classifyFps = (fps: number): WorkloadFpsEstimate['rating'] => {
    if (fps >= 140) return 'Lancar Maksimal';
    if (fps >= 75) return 'Sangat Lancar';
    if (fps >= 45) return 'Cukup Lancar';
    return 'Berat';
  };

  const esportsFps = Math.round(
    (cpuPerf * 2.4 + gpuPerf * 1.35) *
      xmpMultiplier *
      dualChannelBonus *
      (1 + (voltageEval.perfMultiplier - 1) * 0.65) *
      throttlePenalty,
  );
  const aaa1440Fps = Math.round(
    (gpuPerf * 1.18 + cpuPerf * 0.25) *
      (1 + (voltageEval.perfMultiplier - 1) * 0.25) *
      throttlePenalty -
      18,
  );
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

  const thermalNote =
    voltageEval.status === 'undervolt_unstable'
      ? `Instabilitas Vcore (${cpuVoltageV.toFixed(2).replace('.', ',')} V)! Tegangan terlalu rendah sehingga CPU mengalami clock stretching. Naikkan minimal ke 1,12 V.`
      : isThermalThrottling
        ? `Peringatan Thermal Throttling (${cpuLoadTempC}°C)! Pendingin ${cooler?.model ?? 'saat ini'} kewalahan menahan TDP ${cpuTdp} W pada ${cpuVoltageV.toFixed(2).replace('.', ',')} V. Turunkan voltase atau naikkan kurva kipas PWM.`
        : cpuLoadTempC <= 72
          ? `Pendinginan sangat prima (${cpuLoadTempC}°C beban penuh). Ruang suhu masih lega dan stabil.`
          : `Suhu beban penuh terkendali di ${cpuLoadTempC}°C tanpa throttling.`;

  const fanLabelShort =
    bios.fanCurve === 'manual'
      ? `Kipas Manual ${fanDutyLoadPercent}%`
      : `Kipas ${bios.fanCurve.charAt(0).toUpperCase()}${bios.fanCurve.slice(1)}`;
  const biosSummaryLabel = `${XMP_PROFILE_META[xmpProfile].shortLabel} · ${cpuVoltageV.toFixed(2).replace('.', ',')} V · ${fanLabelShort}`;

  return {
    overallScore,
    cpuMultiScore,
    gpuRenderScore,
    storageReadMb,
    ramEffectiveMhz,
    xmpProfile,
    cpuVoltageV,
    voltageStatus: voltageEval.status,
    fanDutyLoadPercent,
    biosSummaryLabel,
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
