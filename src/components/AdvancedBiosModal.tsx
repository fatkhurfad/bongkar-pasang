/* Modal Advanced BIOS Settings (UEFI Setup Utility) yang dapat diakses saat POST terminal untuk mengatur profil XMP RAM, voltase CPU, dan kurva kecepatan kipas PWM manual */

import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Fan,
  Gauge,
  MemoryStick,
  RotateCcw,
  Save,
  Sliders,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { getEffectivePartInfo, type AssemblyState } from '../lib/assemblyEngine';
import {
  clampCpuVoltage,
  clampPwm,
  DEFAULT_BIOS_SETTINGS,
  evaluateCpuVoltageProfile,
  PRESET_FAN_CURVE_POINTS,
  resolveEffectiveXmpProfile,
  resolveFanCurvePoints,
  runBenchmarkSimulation,
  XMP_PROFILE_META,
  type BiosTuningSettings,
  type FanCurvePreset,
  type ManualFanCurvePoints,
  type XmpProfileId,
} from '../lib/benchmarkSim';
import { formatPercent, formatScore, formatWatts } from '../lib/formatters';

interface AdvancedBiosModalProps {
  state: AssemblyState;
  initialSettings: BiosTuningSettings;
  openedFromPost: boolean;
  onSaveAndApply: (nextSettings: BiosTuningSettings) => void;
  onCancel: () => void;
}

const VOLTAGE_PRESETS: { value: number; label: string }[] = [
  { value: 1.15, label: '1,15 V Efisien' },
  { value: 1.22, label: '1,22 V Auto' },
  { value: 1.32, label: '1,32 V OC' },
  { value: 1.4, label: '1,40 V Ekstrem' },
];

const CURVE_SLIDER_POINTS: { key: keyof ManualFanCurvePoints; tempC: number; label: string }[] = [
  { key: 'pwmAt40C', tempC: 40, label: '40°C' },
  { key: 'pwmAt60C', tempC: 60, label: '60°C' },
  { key: 'pwmAt75C', tempC: 75, label: '75°C' },
  { key: 'pwmAt90C', tempC: 90, label: '90°C' },
];

function FanCurveChart({ points }: { points: ManualFanCurvePoints }) {
  // Koordinat grafik SVG: X = 30..100°C, Y = 0..100% PWM
  const mapX = (temp: number) => 28 + ((temp - 30) / 70) * 244;
  const mapY = (pwm: number) => 104 - (pwm / 100) * 88;

  const coords: { temp: number; pwm: number; x: number; y: number }[] = [
    { temp: 40, pwm: points.pwmAt40C, x: mapX(40), y: mapY(points.pwmAt40C) },
    { temp: 60, pwm: points.pwmAt60C, x: mapX(60), y: mapY(points.pwmAt60C) },
    { temp: 75, pwm: points.pwmAt75C, x: mapX(75), y: mapY(points.pwmAt75C) },
    { temp: 90, pwm: points.pwmAt90C, x: mapX(90), y: mapY(points.pwmAt90C) },
  ];

  const polylineStr = [
    `${mapX(30)},${mapY(points.pwmAt40C)}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${mapX(100)},${mapY(points.pwmAt90C)}`,
  ].join(' ');

  return (
    <svg
      viewBox="0 0 290 116"
      className="w-full h-24 rounded-lg bg-slate-950 border border-slate-800 block"
      role="img"
      aria-label="Grafik kurva kecepatan kipas PWM terhadap suhu CPU"
    >
      {/* Grid horizontal PWM 25%, 50%, 75%, 100% */}
      {[25, 50, 75, 100].map((pct) => {
        const y = mapY(pct);
        return (
          <g key={pct}>
            <line x1="28" y1={y} x2="274" y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x="23" y={y + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="monospace">
              {pct}
            </text>
          </g>
        );
      })}

      {/* Grid vertikal suhu 40, 60, 75, 90°C */}
      {coords.map((c) => (
        <g key={c.temp}>
          <line x1={c.x} y1="14" x2={c.x} y2="100" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
          <text x={c.x} y="112" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">
            {c.temp}°C
          </text>
        </g>
      ))}

      {/* Garis kurva PWM */}
      <polyline
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylineStr}
      />

      {/* Titik kontrol PWM */}
      {coords.map((c) => (
        <g key={`pt-${c.temp}`}>
          <circle cx={c.x} cy={c.y} r="4.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
          <text
            x={c.x}
            y={Math.max(13, c.y - 8)}
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="#e2e8f0"
            fontFamily="monospace"
          >
            {c.pwm}%
          </text>
        </g>
      ))}
    </svg>
  );
}

export function AdvancedBiosModal({
  state,
  initialSettings,
  openedFromPost,
  onSaveAndApply,
  onCancel,
}: AdvancedBiosModalProps) {
  const [draft, setDraft] = useState<BiosTuningSettings>(() => ({
    xmpEnabled: resolveEffectiveXmpProfile(initialSettings) !== 'jedec',
    xmpProfile: resolveEffectiveXmpProfile(initialSettings),
    cpuVoltageV: clampCpuVoltage(initialSettings.cpuVoltageV ?? 1.22),
    fanCurve: initialSettings.fanCurve,
    manualFanCurve: resolveFanCurvePoints(initialSettings),
  }));

  const xmpProfile = resolveEffectiveXmpProfile(draft);
  const cpuVoltageV = clampCpuVoltage(draft.cpuVoltageV ?? 1.22);
  const curvePoints = resolveFanCurvePoints(draft);
  const voltageInfo = evaluateCpuVoltageProfile(cpuVoltageV);
  const preview = runBenchmarkSimulation(state.purchasedModules, state.orderId, draft);
  const cpuInfo = getEffectivePartInfo(state, 'cpu');
  const coolerInfo = getEffectivePartInfo(state, 'cpu_cooler');

  const handleSelectXmp = (profile: XmpProfileId) => {
    setDraft((prev) => ({
      ...prev,
      xmpProfile: profile,
      xmpEnabled: profile !== 'jedec',
    }));
  };

  const handleVoltageChange = (nextV: number) => {
    setDraft((prev) => ({
      ...prev,
      cpuVoltageV: clampCpuVoltage(nextV),
    }));
  };

  const handleSelectFanPreset = (preset: FanCurvePreset) => {
    setDraft((prev) => ({
      ...prev,
      fanCurve: preset,
      manualFanCurve:
        preset === 'manual'
          ? resolveFanCurvePoints(prev)
          : { ...PRESET_FAN_CURVE_POINTS[preset] },
    }));
  };

  const handleCurvePointChange = (key: keyof ManualFanCurvePoints, value: number) => {
    setDraft((prev) => {
      const current = resolveFanCurvePoints(prev);
      return {
        ...prev,
        fanCurve: 'manual',
        manualFanCurve: {
          ...current,
          [key]: clampPwm(value),
        },
      };
    });
  };

  const handleResetDefaults = () => {
    setDraft({
      ...DEFAULT_BIOS_SETTINGS,
      manualFanCurve: { ...PRESET_FAN_CURVE_POINTS.seimbang },
    });
  };

  const voltageBadgeClass =
    voltageInfo.status === 'overvolt_danger' || voltageInfo.status === 'undervolt_unstable'
      ? 'bg-red-950 border-red-700 text-red-200'
      : voltageInfo.status === 'overclock'
        ? 'bg-amber-950 border-amber-700 text-amber-200'
        : voltageInfo.status === 'undervolt_optimal'
          ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
          : 'bg-slate-800 border-slate-700 text-slate-200';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-bios-title"
      data-testid="advanced-bios-modal"
      className="fixed inset-0 z-[60] bg-neutral-950/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-slate-700 bg-slate-950 text-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_16px_42px_rgba(0,0,0,0.55)] flex flex-col my-auto">
        {/* Header UEFI BIOS Utility */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-sky-400">
              <Sliders className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>RAKITPC UEFI SETUP UTILITY (VER 2.6)</span>
            </div>
            <h2
              id="advanced-bios-title"
              className="text-lg font-semibold text-white mt-0.5"
            >
              Advanced BIOS Settings
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-9 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Bawaan</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Tutup Advanced BIOS Settings"
              className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Isi 2 Kolom: Kontrol Manual BIOS (Kiri) + Pratinjau Dampak Benchmark & Termal (Kanan) */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Kolom Kiri: XMP RAM, Voltase CPU, & Kurva Kipas PWM Manual */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* 1. Profil XMP / EXPO RAM */}
            <section
              aria-label="Profil XMP RAM"
              className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <MemoryStick className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>1. PROFIL XMP / EXPO MEMORI RAM</span>
                </h3>
                <span className="text-xs font-mono font-bold text-sky-300 tabular-nums">
                  DDR5-{preview.ramEffectiveMhz} MHz
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Pilih profil XMP RAM">
                {(['jedec', 'xmp1', 'xmp2_oc'] as XmpProfileId[]).map((profileId) => {
                  const selected = xmpProfile === profileId;
                  return (
                    <button
                      key={profileId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleSelectXmp(profileId)}
                      className={`text-left rounded-lg border p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                        selected
                          ? 'bg-blue-950/80 border-sky-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <p className="text-xs font-semibold">{XMP_PROFILE_META[profileId].shortLabel}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {XMP_PROFILE_META[profileId].description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Voltase CPU (Vcore Manual) */}
            <section
              aria-label="Voltase CPU Manual"
              className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col gap-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>2. VOLTASE CPU (VCORE MANUAL)</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${voltageBadgeClass}`}>
                    {voltageInfo.label}
                  </span>
                  <span className="text-sm font-mono font-bold text-white tabular-nums">
                    {cpuVoltageV.toFixed(2).replace('.', ',')} V
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex flex-col gap-1.5">
                  <span className="sr-only">Atur voltase CPU Vcore</span>
                  <input
                    type="range"
                    min={1.05}
                    max={1.45}
                    step={0.01}
                    value={cpuVoltageV}
                    onChange={(e) => handleVoltageChange(Number(e.target.value))}
                    aria-label="Voltase CPU Vcore"
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>1,05 V (Undervolt)</span>
                    <span>1,22 V (Auto)</span>
                    <span>1,32 V (OC)</span>
                    <span>1,45 V (Maks)</span>
                  </div>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {VOLTAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleVoltageChange(preset.value)}
                      className={`min-h-8 px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                        Math.abs(cpuVoltageV - preset.value) < 0.005
                          ? 'bg-blue-700 border-sky-400 text-white font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-300 leading-snug">{voltageInfo.note}</p>
              </div>
            </section>

            {/* 3. Kurva Kecepatan Kipas PWM Manual */}
            <section
              aria-label="Kurva Kecepatan Kipas Manual"
              className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex flex-col gap-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <Fan className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>3. KURVA KECEPATAN KIPAS PWM</span>
                </h3>
                <div className="flex items-center gap-1" role="group" aria-label="Preset kurva kipas">
                  {(['senyap', 'seimbang', 'performa', 'manual'] as FanCurvePreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectFanPreset(preset)}
                      aria-pressed={draft.fanCurve === preset}
                      className={`min-h-7 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        draft.fanCurve === preset
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset === 'senyap'
                        ? 'Senyap'
                        : preset === 'seimbang'
                          ? 'Seimbang'
                          : preset === 'performa'
                            ? 'Performa'
                            : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>

              <FanCurveChart points={curvePoints} />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
                {CURVE_SLIDER_POINTS.map((pt) => (
                  <label
                    key={pt.key}
                    className="rounded-lg bg-slate-950 border border-slate-800 p-2 flex flex-col gap-1"
                  >
                    <div className="flex items-baseline justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{pt.label}</span>
                      <span className="font-bold text-sky-300">{curvePoints[pt.key]}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={curvePoints[pt.key]}
                      onChange={(e) => handleCurvePointChange(pt.key, Number(e.target.value))}
                      aria-label={`Kecepatan kipas PWM pada suhu ${pt.label}`}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Kolom Kanan: Pratinjau Langsung Dampak Benchmark & Stabilitas Termal */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-sky-400" aria-hidden="true" />
                  <span>ESTIMASI DAMPAK BENCHMARK</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">{cpuInfo.shortCode}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 tabular-nums">
                <div className="rounded-lg bg-blue-950/60 border border-blue-800/80 p-3">
                  <p className="text-[11px] text-sky-300">Skor Benchmark</p>
                  <p className="text-2xl font-mono font-bold text-white mt-0.5 whitespace-nowrap">
                    <span>{preview.overallScore}</span>
                    <span className="text-xs font-normal text-sky-300">/100</span>
                  </p>
                </div>

                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400">CPU Multi-Core</p>
                  <p className="text-xl font-mono font-bold text-white mt-0.5">
                    {formatScore(preview.cpuMultiScore)}
                  </p>
                  <p className="text-[10px] text-slate-400">pts</p>
                </div>

                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-sky-400" aria-hidden="true" />
                    <span>Suhu CPU Beban</span>
                  </p>
                  <p
                    className={`text-lg font-mono font-bold mt-0.5 ${
                      preview.cpuLoadTempC >= 92
                        ? 'text-red-400'
                        : preview.cpuLoadTempC >= 80
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                    }`}
                  >
                    {preview.cpuLoadTempC}°C
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{coolerInfo.model}</p>
                </div>

                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />
                    <span>Daya &amp; Kipas</span>
                  </p>
                  <p className="text-sm font-mono font-bold text-white mt-0.5">
                    {formatWatts(preview.peakPowerWatts)} · {preview.fanRpmLoad} RPM
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatPercent(preview.psuLoadPercent)} PSU · {preview.noiseDbLoad} dBA
                  </p>
                </div>
              </div>

              {/* Estimasi FPS singkat */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-xs tabular-nums">
                <p className="text-[11px] font-mono text-slate-400">ESTIMASI FPS DENGAN PROFIL INI</p>
                {preview.workloads.map((w) => (
                  <div key={w.id} className="flex items-center justify-between">
                    <span className="text-slate-300">
                      {w.name} <span className="text-slate-500">({w.resolution})</span>
                    </span>
                    <span className="font-mono font-bold text-sky-300">{w.fps} FPS</span>
                  </div>
                ))}
              </div>

              {/* Status stabilitas & peringatan termal */}
              <div
                className={`rounded-lg border p-3 text-xs leading-relaxed flex items-start gap-2 ${
                  preview.isThermalThrottling || preview.voltageStatus === 'undervolt_unstable'
                    ? 'bg-red-950/70 border-red-800 text-red-200'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                }`}
              >
                {preview.isThermalThrottling || preview.voltageStatus === 'undervolt_unstable' ? (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>{preview.thermalNote}</span>
              </div>
            </div>

            {/* Tombol Simpan & Lanjut */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onSaveAndApply(draft)}
                data-testid="save-advanced-bios-btn"
                className="min-h-11 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{openedFromPost ? 'Simpan & Lanjut Boot' : 'Simpan & Terapkan BIOS'}</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="min-h-10 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                {openedFromPost ? 'Batal & Kembali ke POST' : 'Batal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
