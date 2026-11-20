/* Layar judul utama RakitPC Lab dengan pilihan mode simulasi, paket efisiensi komponen, dan pratinjau BIMO */

import { AlertTriangle, Award, Play } from 'lucide-react';
import {
  BUILD_PRESET_LIST,
  BUILD_PRESETS,
  MODE_DESCRIPTIONS,
  type BuildPresetId,
  type GameMode,
} from '../config';
import { ACHIEVEMENT_DEFS, type AchievementId } from '../lib/achievements';
import { formatScore } from '../lib/formatters';
import { BimoAvatar } from './RobotBimo';

interface TitleScreenProps {
  selectedMode: GameMode;
  selectedPreset: BuildPresetId;
  randomFaultEnabled: boolean;
  bestScore: number;
  unlockedAchievements: AchievementId[];
  onSelectMode: (mode: GameMode) => void;
  onSelectPreset: (preset: BuildPresetId) => void;
  onToggleRandomFault: (enabled: boolean) => void;
  onStart: () => void;
}

export function TitleScreen({
  selectedMode,
  selectedPreset,
  randomFaultEnabled,
  bestScore,
  unlockedAchievements,
  onSelectMode,
  onSelectPreset,
  onToggleRandomFault,
  onStart,
}: TitleScreenProps) {
  const activePreset = BUILD_PRESETS[selectedPreset];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between px-4 sm:px-8 py-6 sm:py-8">
      <div className="w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Zona Kiri: Emblem Judul SVG, Pilihan Mode, Paket Komponen, dan Aksi Mulai */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Custom inline SVG Title Lockup */}
          <div className="flex flex-col gap-2.5">
            <svg
              viewBox="0 0 320 68"
              className="w-full max-w-[280px] h-auto"
              role="img"
              aria-label="RakitPC Lab"
            >
              <rect x="2" y="10" width="48" height="48" rx="10" fill="#1d4ed8" />
              <rect x="12" y="20" width="28" height="28" rx="4" fill="#ffffff" />
              <rect x="18" y="26" width="16" height="16" rx="2" fill="#0f172a" />
              <polygon points="13,47 21,47 13,39" fill="#f59e0b" />
              <path
                d="M18 4 V10 M26 4 V10 M34 4 V10 M18 58 V64 M26 58 V64 M34 58 V64"
                stroke="#1d4ed8"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <text
                x="64"
                y="38"
                fontSize="30"
                fontWeight="700"
                fill="#0f172a"
                fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
                letterSpacing="-0.03em"
              >
                RakitPC Lab
              </text>
              <text
                x="65"
                y="56"
                fontSize="12"
                fontWeight="500"
                fill="#475569"
                fontFamily="'IBM Plex Mono', monospace"
              >
                SIMULASI PERAKITAN HARDWARE
              </text>
            </svg>

            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 leading-tight text-balance">
              Rakit komputer dari soket CPU hingga uji nyala BIOS.
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              Belajar urutan perakitan realistis, efisiensi daya komponen, dan diagnosis POST
              bersama robot pendamping BIMO.
            </p>
          </div>

          {/* Pilihan Mode Permainan */}
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Pilih mode simulasi">
            <span className="text-xs font-semibold text-neutral-900">Mode Simulasi</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['belajar', 'mandiri'] as GameMode[]).map((mode) => {
                const active = selectedMode === mode;
                const info = MODE_DESCRIPTIONS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectMode(mode)}
                    className={`min-h-14 text-left p-3 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      active
                        ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700'
                        : 'bg-white border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{info.label}</p>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-snug">{info.shortNote}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pilihan Kombinasi Paket Komponen (mempengaruhi efisiensi daya & lencana pencapaian) */}
          <div
            className="flex flex-col gap-1.5"
            role="radiogroup"
            aria-label="Pilih paket kombinasi komponen"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-900">Kombinasi Komponen (PSU 650 W)</span>
              <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
                {activePreset.cpuModel} + {activePreset.gpuShortLabel}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BUILD_PRESET_LIST.map((preset) => {
                const active = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectPreset(preset.id)}
                    className={`min-h-12 text-left px-2.5 py-2 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      active
                        ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700'
                        : 'bg-white border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <p className="text-xs font-semibold text-neutral-900 truncate">
                      {preset.shortLabel}
                    </p>
                    <p className="text-[11px] text-neutral-600 truncate mt-0.5">
                      {preset.cpuShortCode} · {preset.gpuShortLabel.split(' ').slice(0, 2).join(' ')}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-600 leading-snug">{activePreset.description}</p>
          </div>

          {/* Pengaturan Skenario Kerusakan Komponen Acak (ESD / DOA) */}
          <label className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:border-neutral-300">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-neutral-900 block">
                  Skenario Kerusakan Komponen Acak (ESD / DOA)
                </span>
                <span className="text-[11px] text-neutral-600 block">
                  Simulasi cacat acak &amp; status Part Rusak saat salah urutan perakitan.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={randomFaultEnabled}
              onChange={(e) => onToggleRandomFault(e.target.checked)}
              className="w-4 h-4 accent-blue-700 shrink-0"
            />
          </label>

          {/* Tombol Aksi Utama + Ringkasan Rekor & Lencana */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="min-h-12 px-7 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-base font-semibold transition-colors flex items-center justify-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              <span>Mulai Merakit</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-neutral-600 tabular-nums">
              {bestScore > 0 && (
                <span>
                  Terbaik: <strong className="text-neutral-900">{formatScore(bestScore)}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-neutral-900">{unlockedAchievements.length}</strong>/
                  {ACHIEVEMENT_DEFS.length} Lencana
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Zona Kanan: Centerpiece Ilustrasi Hardware Realistis & Robot BIMO */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="rounded-xl bg-slate-900 border border-slate-700 overflow-hidden aspect-[16/10] relative">
              <svg viewBox="0 0 640 400" className="w-full h-full block" aria-hidden="true">
                <defs>
                  <pattern id="title-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="640" height="400" fill="#0f172a" />
                <rect width="640" height="400" fill="url(#title-grid)" />

                <rect x="64" y="34" width="512" height="332" rx="10" fill="#182234" stroke="#475569" strokeWidth="2.5" />

                <g stroke="#1d4ed8" strokeWidth="1.5" opacity="0.45" fill="none">
                  <path d="M276 140 H392 M276 154 H392 M276 168 H392" />
                  <path d="M210 218 V264 H340" />
                  <path d="M430 278 H530 V160" />
                </g>

                <rect x="78" y="54" width="38" height="136" rx="4" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                <rect x="148" y="48" width="144" height="24" rx="4" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />

                <rect x="166" y="92" width="110" height="110" rx="8" fill="#0f172a" stroke="#60a5fa" strokeWidth="2" />
                <rect x="180" y="106" width="82" height="82" rx="5" fill="#14532d" />
                <rect x="190" y="116" width="62" height="62" rx="3" fill="#cbd5e1" />
                <polygon points="182,186 196,186 182,172" fill="#f59e0b" />
                <text x="221" y="146" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="monospace">
                  LGA1700
                </text>
                <text x="221" y="160" textAnchor="middle" fontSize="8" fill="#334155" fontFamily="monospace">
                  {activePreset.cpuShortCode}
                </text>

                {[396, 424, 452, 480].map((rx, idx) => (
                  <rect
                    key={rx}
                    x={rx}
                    y="78"
                    width="18"
                    height="136"
                    rx="2"
                    fill={idx === 1 || idx === 3 ? '#1d4ed8' : '#0f172a'}
                    stroke={idx === 1 || idx === 3 ? '#93c5fd' : '#475569'}
                    strokeWidth="1.5"
                  />
                ))}

                <rect x="166" y="226" width="194" height="32" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                <text x="263" y="246" textAnchor="middle" fontSize="10" fontWeight="600" fill="#e2e8f0" fontFamily="monospace">
                  GEN4 NVMe 1 TB · M.2 2280
                </text>

                <rect x="140" y="276" width="286" height="68" rx="6" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <g className="animate-spin-fan">
                  <circle cx="212" cy="310" r="22" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <line x1="196" y1="310" x2="228" y2="310" stroke="#94a3b8" strokeWidth="3" />
                  <line x1="212" y1="294" x2="212" y2="326" stroke="#94a3b8" strokeWidth="3" />
                </g>
                <g className="animate-spin-fan">
                  <circle cx="312" cy="310" r="22" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <line x1="296" y1="310" x2="328" y2="310" stroke="#94a3b8" strokeWidth="3" />
                  <line x1="312" y1="294" x2="312" y2="326" stroke="#94a3b8" strokeWidth="3" />
                </g>
                <text x="382" y="314" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#f8fafc" fontFamily="monospace">
                  {activePreset.gpuShortLabel.split(' ').slice(0, 2).join(' ')}
                </text>

                <rect x="454" y="268" width="94" height="72" rx="6" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                <text x="501" y="308" textAnchor="middle" fontSize="10" fontWeight="700" fill="#cbd5e1" fontFamily="monospace">
                  B760 ATX
                </text>
              </svg>
            </div>

            {/* Sapaan Robot Pendamping BIMO */}
            <div className="flex items-center gap-4 pt-1">
              <BimoAvatar mood="happy" size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">BIMO Siap Memandu</p>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mt-0.5">
                  &ldquo;Pilih kombinasi komponen paling efisien dan selesaikan perakitan di bawah
                  90 detik tanpa salah untuk meraih semua lencana pencapaian!&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Petunjuk kontrol ringkas di margin aman bawah */}
      <footer className="w-full max-w-6xl mx-auto pt-4 text-center text-xs text-neutral-500">
        Klik atau Seret Komponen · R Putar CPU · H Petunjuk BIMO · P Jeda · M Suara
      </footer>
    </main>
  );
}
