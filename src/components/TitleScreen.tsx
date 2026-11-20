/* Layar judul utama RakitPC Lab dengan pilihan pesanan klien / rakit bebas, mode simulasi, dan akses langsung ke Toko Modul */

import { AlertTriangle, Award, Play, ShoppingBag, Wallet } from 'lucide-react';
import {
  MODE_DESCRIPTIONS,
  type GameMode,
} from '../config';
import { ACHIEVEMENT_DEFS, type AchievementId } from '../lib/achievements';
import { formatRupiah, formatScore } from '../lib/formatters';
import {
  CATALOG_BY_SKU,
  CLIENT_ORDERS,
  CLIENT_ORDER_LIST,
  type ClientOrderId,
  type WorkshopWallet,
} from '../lib/hardwareShop';
import { BimoAvatar } from './RobotBimo';

interface TitleScreenProps {
  selectedMode: GameMode;
  selectedOrderId: ClientOrderId;
  randomFaultEnabled: boolean;
  bestScore: number;
  unlockedAchievements: AchievementId[];
  workshopWallet: WorkshopWallet;
  onSelectMode: (mode: GameMode) => void;
  onSelectOrder: (orderId: ClientOrderId) => void;
  onToggleRandomFault: (enabled: boolean) => void;
  onStartWithShop: () => void;
  onStartQuickBuild: () => void;
}

export function TitleScreen({
  selectedMode,
  selectedOrderId,
  randomFaultEnabled,
  bestScore,
  unlockedAchievements,
  workshopWallet,
  onSelectMode,
  onSelectOrder,
  onToggleRandomFault,
  onStartWithShop,
  onStartQuickBuild,
}: TitleScreenProps) {
  const activeOrder = CLIENT_ORDERS[selectedOrderId];
  const recCpu = CATALOG_BY_SKU[activeOrder.recommendedLoadout.cpu];
  const recGpu = CATALOG_BY_SKU[activeOrder.recommendedLoadout.gpu];
  const recSsd = CATALOG_BY_SKU[activeOrder.recommendedLoadout.ssd_nvme];

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between px-4 sm:px-8 py-6 sm:py-8">
      <div className="w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Zona Kiri: Emblem Judul SVG, Pilihan Proyek/Pesanan Klien, Mode, dan Aksi Mulai */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Custom inline SVG Title Lockup */}
          <div className="flex flex-col gap-2">
            <svg
              viewBox="0 0 320 68"
              className="w-full max-w-[265px] h-auto"
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
                SIMULATOR BENGKEL &amp; RAKIT PC 3D
              </text>
            </svg>

            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 leading-tight text-balance">
              Pilih modul, atur anggaran, dan rakit PC secara realistis.
            </h1>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Belanja komponen sesuai kebutuhan klien atau rakit bebas di meja 3D tanpa tekanan
              waktu bersama robot pendamping BIMO.
            </p>
          </div>

          {/* Pilihan Pesanan Klien atau Rakit Bebas */}
          <div
            className="flex flex-col gap-1.5"
            role="radiogroup"
            aria-label="Pilih pesanan klien atau rakit bebas"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-900">Proyek Bengkel &amp; Anggaran</span>
              <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
                {activeOrder.isSandbox
                  ? `Dana ${formatRupiah(activeOrder.budget)}`
                  : `Jasa +${formatRupiah(activeOrder.serviceFee)}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CLIENT_ORDER_LIST.map((order) => {
                const active = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectOrder(order.id)}
                    className={`min-h-14 text-left px-3 py-2 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      active
                        ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700'
                        : 'bg-white border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <p className="text-xs font-semibold text-neutral-900 truncate">{order.title}</p>
                    <p className="text-[11px] font-mono text-neutral-600 tabular-nums mt-0.5 truncate">
                      {formatRupiah(order.budget)}
                      {order.isSandbox ? ' · Bebas' : ` · +${formatRupiah(order.serviceFee)}`}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-600 leading-snug">{activeOrder.brief}</p>
          </div>

          {/* Pilihan Mode Bantuan */}
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Pilih mode panduan">
            <span className="text-xs font-semibold text-neutral-900">Mode Panduan</span>
            <div className="grid grid-cols-2 gap-2">
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
                    className={`min-h-12 text-left p-2.5 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      active
                        ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700'
                        : 'bg-white border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <p className="text-xs font-semibold text-neutral-900">{info.label}</p>
                    <p className="text-[11px] text-neutral-600 mt-0.5 leading-snug">{info.shortNote}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pengaturan Skenario Kerusakan Komponen Acak (ESD / DOA) */}
          <label className="rounded-xl border border-neutral-200 bg-white px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:border-neutral-300">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-neutral-900 block">
                  Skenario Kerusakan Komponen Acak (ESD / DOA)
                </span>
                <span className="text-[11px] text-neutral-600 block">
                  Simulasi cacat pabrik acak &amp; status Part Rusak saat salah urutan.
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

          {/* Tombol Aksi Utama: Buka Toko & Rakit + Pintasan Paket Siap */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onStartWithShop}
              className="min-h-12 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm sm:text-base font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Buka Toko &amp; Rakit</span>
            </button>

            <button
              type="button"
              onClick={onStartQuickBuild}
              className="min-h-12 px-4 py-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Langsung Rakit</span>
            </button>
          </div>

          {/* Ringkasan Dompet Bengkel, Rekor, & Lencana */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 tabular-nums">
            {workshopWallet.completedOrders > 0 && (
              <span className="inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>
                  Kas Bengkel:{' '}
                  <strong className="text-neutral-900">
                    {formatRupiah(workshopWallet.totalEarnings)}
                  </strong>{' '}
                  ({workshopWallet.completedOrders} PC)
                </span>
              </span>
            )}
            {bestScore > 0 && (
              <span>
                Skor Terbaik: <strong className="text-neutral-900">{formatScore(bestScore)}</strong>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-neutral-900">{unlockedAchievements.length}</strong>/
                {ACHIEVEMENT_DEFS.length} Lencana
              </span>
            </span>
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
                  {recCpu?.shortCode ?? 'i5-14K'}
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
                  {(recSsd?.model ?? 'GEN4 NVMe 1 TB').toUpperCase()} · M.2
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
                  {recGpu?.shortCode ?? 'RTX 4070'}
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
                <p className="text-sm font-semibold text-neutral-900">BIMO Siap Mendampingi</p>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mt-0.5">
                  &ldquo;Tidak perlu buru-buru! Kita mulai dengan belanja CPU, pendingin, RAM, SSD,
                  PSU, dan GPU sesuai kebutuhan di Toko Modul, lalu rakit santai di meja 3D.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Petunjuk kontrol ringkas di margin aman bawah */}
      <footer className="w-full max-w-6xl mx-auto pt-4 text-center text-xs text-neutral-500">
        Belanja Modul di Toko · Klik atau Seret Komponen · R Putar CPU · H Petunjuk BIMO · P Jeda
      </footer>
    </main>
  );
}
