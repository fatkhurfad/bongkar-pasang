/* Modal UEFI BIOS Tuning (XMP & Kurva Kipas PWM) serta Laboratorium Uji Benchmark & Stress Test Suhu Real-Time */

import {
  Activity,
  AlertTriangle,
  Cpu,
  Fan,
  Gauge,
  HardDrive,
  MonitorPlay,
  Play,
  Sliders,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getEffectivePartInfo,
  type AssemblyState,
} from '../lib/assemblyEngine';
import {
  FAN_CURVE_LABELS,
  PRESET_FAN_CURVE_POINTS,
  resolveEffectiveXmpProfile,
  runBenchmarkSimulation,
  XMP_PROFILE_META,
  type BiosTuningSettings,
  type FanCurvePreset,
} from '../lib/benchmarkSim';
import { formatPercent, formatScore, formatWatts } from '../lib/formatters';

interface BenchmarkLabModalProps {
  state: AssemblyState;
  bios: BiosTuningSettings;
  onChangeBios: (next: BiosTuningSettings) => void;
  onOpenAdvancedBios: () => void;
  onClose: () => void;
}

export function BenchmarkLabModal({
  state,
  bios,
  onChangeBios,
  onOpenAdvancedBios,
  onClose,
}: BenchmarkLabModalProps) {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(100);

  const report = runBenchmarkSimulation(state.purchasedModules, state.orderId, bios);
  const activeXmp = resolveEffectiveXmpProfile(bios);
  const cpuInfo = getEffectivePartInfo(state, 'cpu');
  const gpuInfo = getEffectivePartInfo(state, 'gpu');
  const coolerInfo = getEffectivePartInfo(state, 'cpu_cooler');

  useEffect(() => {
    if (!testing) return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setTesting(false);
          return 100;
        }
        return Math.min(100, prev + 8);
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [testing]);

  const handleStartStressTest = () => {
    setProgress(0);
    setTesting(true);
  };

  // Interpolasi suhu & RPM selama stress test berlangsung
  const ratio = progress / 100;
  const liveCpuTemp = Math.round(
    report.cpuIdleTempC + (report.cpuLoadTempC - report.cpuIdleTempC) * ratio,
  );
  const liveGpuTemp = Math.round(38 + (report.gpuLoadTempC - 38) * ratio);
  const liveRpm = Math.round(850 + (report.fanRpmLoad - 850) * ratio);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="benchmark-lab-title"
      data-testid="benchmark-lab-modal"
      className="fixed inset-0 z-50 bg-neutral-950/70 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.22)] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <Activity className="w-4 h-4" aria-hidden="true" />
              <span>Laboratorium UEFI BIOS &amp; Stress Test</span>
            </div>
            <h2 id="benchmark-lab-title" className="text-xl font-semibold text-neutral-900 mt-0.5">
              Uji Performa, Suhu Beban Penuh &amp; Estimasi FPS
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Laboratorium Benchmark"
            className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Konten 2 Kolom */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Kolom Kiri: Pengaturan UEFI BIOS (XMP, Vcore, Kurva Kipas) + Sensor Termal */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-xl bg-slate-900 text-slate-100 p-4 border border-slate-700 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2 gap-2">
                <span className="text-xs font-mono font-semibold text-white">
                  UEFI BIOS TUNING
                </span>
                <span className="text-[11px] font-mono text-sky-400 tabular-nums">
                  DDR5-{report.ramEffectiveMhz} ({report.cpuVoltageV.toFixed(2).replace('.', ',')} V)
                </span>
              </div>

              {/* Ringkasan profil aktif dari Advanced BIOS */}
              <div
                data-testid="benchmark-bios-summary"
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[11px] font-mono text-slate-200 tabular-nums"
              >
                {report.biosSummaryLabel}
              </div>

              {/* Toggle Cepat XMP / EXPO */}
              <label className="flex items-start justify-between gap-3 rounded-lg bg-slate-800/80 border border-slate-700 p-3 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">
                    Profil Memori: {XMP_PROFILE_META[activeXmp].shortLabel}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Menjalankan RAM di kecepatan puncak (bukan bawaan 4800 MHz).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={activeXmp !== 'jedec'}
                  onChange={(e) =>
                    onChangeBios({
                      ...bios,
                      xmpEnabled: e.target.checked,
                      xmpProfile: e.target.checked ? 'xmp1' : 'jedec',
                    })
                  }
                  className="mt-1 h-4 w-4 accent-blue-500 cursor-pointer"
                />
              </label>

              {/* Pemilih Cepat Kurva Kipas PWM */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Fan className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                    <span>Kurva Kipas PWM</span>
                  </p>
                  {bios.fanCurve === 'manual' && (
                    <span className="text-[10px] font-mono text-sky-300">Kurva Manual Aktif</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['senyap', 'seimbang', 'performa'] as FanCurvePreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        onChangeBios({
                          ...bios,
                          fanCurve: preset,
                          manualFanCurve:
                            preset === 'manual'
                              ? bios.manualFanCurve
                              : { ...PRESET_FAN_CURVE_POINTS[preset] },
                        })
                      }
                      aria-pressed={bios.fanCurve === preset}
                      className={`min-h-9 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        bios.fanCurve === preset
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {preset === 'senyap'
                        ? 'Senyap'
                        : preset === 'seimbang'
                          ? 'Seimbang'
                          : 'Performa'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {FAN_CURVE_LABELS[bios.fanCurve].note}
                </p>
              </div>

              {/* Tombol masuk ke Advanced BIOS Settings untuk Vcore & Kurva Kipas 4 Titik */}
              <button
                type="button"
                onClick={onOpenAdvancedBios}
                data-testid="open-advanced-bios-from-lab"
                className="min-h-10 w-full px-3 py-2 rounded-lg border border-sky-500/70 bg-blue-950 hover:bg-blue-900 text-sky-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>Advanced BIOS Settings</span>
              </button>
            </div>

            {/* Telemetri Suhu, Kipas, dan Daya Live */}
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-blue-700" aria-hidden="true" />
                  <span>Sensor Termal &amp; Daya</span>
                </h3>
                <button
                  type="button"
                  onClick={handleStartStressTest}
                  disabled={testing}
                  className="min-h-8 px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-neutral-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3" aria-hidden="true" />
                  <span>{testing ? `Menguji ${progress}%…` : 'Jalankan Stress Test'}</span>
                </button>
              </div>

              {/* Progress bar stress test */}
              <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full bg-blue-700 transition-transform duration-150 origin-left"
                  style={{ transform: `scaleX(${ratio})` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                <div className="rounded-lg bg-white border border-neutral-200 p-2.5">
                  <p className="text-[11px] text-neutral-500">Suhu CPU (Beban)</p>
                  <p
                    className={`text-lg font-mono font-bold mt-0.5 ${
                      liveCpuTemp >= 92
                        ? 'text-red-700'
                        : liveCpuTemp >= 80
                          ? 'text-amber-700'
                          : 'text-emerald-800'
                    }`}
                  >
                    {liveCpuTemp}°C
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">{coolerInfo.model}</p>
                </div>

                <div className="rounded-lg bg-white border border-neutral-200 p-2.5">
                  <p className="text-[11px] text-neutral-500">Suhu GPU (Beban)</p>
                  <p className="text-lg font-mono font-bold text-neutral-900 mt-0.5">
                    {liveGpuTemp}°C
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">{gpuInfo.model}</p>
                </div>

                <div className="rounded-lg bg-white border border-neutral-200 p-2.5">
                  <p className="text-[11px] text-neutral-500">Kipas &amp; Kebisingan</p>
                  <p className="text-sm font-mono font-bold text-neutral-900 mt-0.5">
                    {liveRpm} RPM
                  </p>
                  <p className="text-[10px] text-neutral-500">{report.noiseDbLoad} dBA</p>
                </div>

                <div className="rounded-lg bg-white border border-neutral-200 p-2.5">
                  <p className="text-[11px] text-neutral-500">Beban Listrik Puncak</p>
                  <p className="text-sm font-mono font-bold text-neutral-900 mt-0.5">
                    {formatWatts(report.peakPowerWatts)}
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    {formatPercent(report.psuLoadPercent)} dari {formatWatts(report.psuCapacityWatts)}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-lg border px-3 py-2 text-xs leading-relaxed flex items-start gap-2 ${
                  report.isThermalThrottling
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {report.isThermalThrottling ? (
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <Zap className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>{report.thermalNote}</span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Skor Benchmark & Estimasi FPS Gim */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* 4 Skor Utama */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                <p className="text-[11px] text-blue-900 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Skor Total</span>
                </p>
                <p className="text-xl font-mono font-bold text-blue-800 mt-1 whitespace-nowrap">
                  <span>{report.overallScore}</span>
                  <span className="text-xs font-medium text-blue-700/80">/100</span>
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-[11px] text-neutral-600 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>CPU Multi</span>
                </p>
                <p className="text-lg font-mono font-bold text-neutral-900 mt-1">
                  {formatScore(report.cpuMultiScore)}
                </p>
                <p className="text-[10px] text-neutral-500 truncate">{cpuInfo.shortCode}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-[11px] text-neutral-600 flex items-center gap-1">
                  <MonitorPlay className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>GPU 3D</span>
                </p>
                <p className="text-lg font-mono font-bold text-neutral-900 mt-1">
                  {formatScore(report.gpuRenderScore)}
                </p>
                <p className="text-[10px] text-neutral-500 truncate">{gpuInfo.shortCode}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-[11px] text-neutral-600 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Baca NVMe</span>
                </p>
                <p className="text-lg font-mono font-bold text-neutral-900 mt-1">
                  {formatScore(report.storageReadMb)}
                </p>
                <p className="text-[10px] text-neutral-500">MB/detik</p>
              </div>
            </div>

            {/* Estimasi FPS Beban Kerja Nyata */}
            <div className="rounded-xl bg-white border border-neutral-200 p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                Estimasi Performa Gim &amp; Render Nyata
              </h3>
              <div className="space-y-3">
                {report.workloads.map((w) => {
                  const barPct = Math.min(100, Math.round((w.fps / 260) * 100));
                  return (
                    <div key={w.id} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-neutral-900">{w.name}</span>
                          <span className="text-neutral-500 ml-1.5">({w.resolution})</span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-[11px] text-neutral-600">{w.rating}</span>
                          <span className="font-mono font-bold text-blue-700">{w.fps} FPS</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-transform duration-200 origin-left ${
                            w.fps >= 120
                              ? 'bg-emerald-600'
                              : w.fps >= 60
                                ? 'bg-blue-600'
                                : 'bg-amber-600'
                          }`}
                          style={{ transform: `scaleX(${Math.max(0.08, barPct / 100)})` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Kembali ke Ringkasan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
