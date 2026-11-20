/* Modal jeda, ringkasan keberhasilan uji POST BIOS beserta laporan proyek klien & lencana pencapaian, dan kartu edukasi detail komponen */

import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Cpu,
  Gauge,
  Lock,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Timer,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { PARTS_BY_ID, type PartId } from '../config';
import {
  ACHIEVEMENT_DEFS,
  getPsuLoadPercent,
  type AchievementId,
} from '../lib/achievements';
import {
  getAccuracyPercent,
  getEffectiveIdleTempC,
  getEffectivePartInfo,
  getPsuCapacityWatts,
  getTotalWattage,
  type AssemblyState,
} from '../lib/assemblyEngine';
import {
  formatDuration,
  formatPercent,
  formatRupiah,
  formatScore,
  formatWatts,
} from '../lib/formatters';
import { CLIENT_ORDERS, evaluateBuildLoadout } from '../lib/hardwareShop';
import { PartThumbnail } from './PartThumbnail';
import { BimoAvatar } from './RobotBimo';

interface PauseModalProps {
  onResume: () => void;
  onOpenShop: () => void;
  onRestart: () => void;
  onBackToTitle: () => void;
}

export function PauseModal({
  onResume,
  onOpenShop,
  onRestart,
  onBackToTitle,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-50 bg-neutral-950/60 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.12)] flex flex-col gap-5">
        <div>
          <h2 id="pause-modal-title" className="text-xl font-semibold text-neutral-900">
            Simulasi Dijeda
          </h2>
          <p className="text-sm text-neutral-600 mt-1">
            Progres rakitan dan belanja modulmu tersimpan sementara. Lanjutkan kapan saja.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="min-h-11 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Lanjutkan Perakitan</span>
          </button>

          <button
            type="button"
            onClick={onOpenShop}
            className="min-h-11 px-4 py-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Buka Toko Modul</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="min-h-11 px-4 py-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Ulangi Proyek Ini</span>
          </button>

          <button
            type="button"
            onClick={onBackToTitle}
            className="min-h-11 px-4 py-2.5 rounded-xl text-neutral-700 hover:bg-neutral-100 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Kembali ke Layar Judul
          </button>
        </div>
      </div>
    </div>
  );
}

function AchievementIcon({ id, unlocked }: { id: AchievementId; unlocked: boolean }) {
  const cls = `w-4 h-4 shrink-0 ${unlocked ? 'text-blue-700' : 'text-neutral-400'}`;
  if (!unlocked) return <Lock className={cls} aria-hidden="true" />;
  switch (id) {
    case 'perakit_kilat':
      return <Timer className={cls} aria-hidden="true" />;
    case 'kombinasi_efisien':
      return <Gauge className={cls} aria-hidden="true" />;
    case 'teknisi_tanpa_cela':
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case 'post_sekali_jadi':
      return <Zap className={cls} aria-hidden="true" />;
    case 'mandiri_sejati':
      return <Award className={cls} aria-hidden="true" />;
  }
}

interface VictoryModalProps {
  state: AssemblyState;
  bestScore: number;
  onRestartWithShop: () => void;
  onBackToTitle: () => void;
}

export function VictoryModal({
  state,
  bestScore,
  onRestartWithShop,
  onBackToTitle,
}: VictoryModalProps) {
  const accuracy = getAccuracyPercent(state);
  const totalWatts = getTotalWattage(state);
  const psuCapacity = getPsuCapacityWatts(state);
  const loadPercent = getPsuLoadPercent(totalWatts, psuCapacity);
  const order = CLIENT_ORDERS[state.orderId];
  const buildEval = evaluateBuildLoadout(state.purchasedModules, state.orderId);
  const cpuInfo = getEffectivePartInfo(state, 'cpu');
  const gpuInfo = getEffectivePartInfo(state, 'gpu');
  const ssdInfo = getEffectivePartInfo(state, 'ssd_nvme');
  const psuInfo = getEffectivePartInfo(state, 'psu');
  const coolerInfo = getEffectivePartInfo(state, 'cpu_cooler');
  const earnedSet = new Set(state.earnedAchievements);
  const earnedFee = !order.isSandbox && buildEval.allOrderRequirementsMet ? order.serviceFee : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-modal-title"
      className="fixed inset-0 z-50 bg-neutral-950/65 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.16)] flex flex-col gap-5 my-auto">
        {/* Header sukses bersama BIMO */}
        <div className="flex items-center gap-4">
          <BimoAvatar mood="celebrate" size="md" />
          <div>
            <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>POST Lulus · 1 Beep Singkat</span>
            </div>
            <h2 id="victory-modal-title" className="text-2xl font-semibold text-neutral-900 mt-0.5">
              Komputer Berhasil Dirakit!
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Proyek: {order.title} ({order.clientName})
            </p>
          </div>
        </div>

        {/* Metrik capaian utama */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-600">Total Biaya Modul</p>
            <p className="text-lg font-semibold text-neutral-900 tabular-nums mt-0.5">
              {formatRupiah(buildEval.totalSpent)}
            </p>
            <p className="text-[11px] text-neutral-500 tabular-nums">
              Sisa: {formatRupiah(state.balance)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-600">Skor Performa</p>
            <p className="text-2xl font-semibold text-blue-700 tabular-nums mt-0.5">
              {buildEval.benchmarkScore}/100
            </p>
            <p className="text-[11px] text-neutral-500 tabular-nums">
              Akurasi {formatPercent(accuracy)} ({state.mistakes} salah
              {state.repairedPartsCount > 0 ? ` · ${state.repairedPartsCount} RMA` : ''})
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-600">Beban Daya</p>
            <p className="text-2xl font-semibold text-neutral-900 tabular-nums mt-0.5">
              {formatWatts(totalWatts)}
            </p>
            <p className="text-[11px] text-neutral-500 tabular-nums">
              {formatPercent(loadPercent)} dari {formatWatts(psuCapacity)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
            <p className="text-xs text-neutral-600">Skor Simulasi</p>
            <p className="text-2xl font-semibold text-emerald-800 tabular-nums mt-0.5">
              {formatScore(state.score)}
            </p>
            <p className="text-[11px] text-neutral-500 tabular-nums">
              Terbaik: {formatScore(Math.max(bestScore, state.score))} · {formatDuration(state.elapsedSeconds)}
            </p>
          </div>
        </div>

        {/* Status Pembayaran Jasa Pesanan Klien */}
        {!order.isSandbox && (
          <div
            className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
              buildEval.allOrderRequirementsMet
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {buildEval.allOrderRequirementsMet ? (
                <Wallet className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {buildEval.allOrderRequirementsMet
                    ? 'Semua Spesifikasi Klien Terpenuhi!'
                    : 'PC Menyala, Namun Sebagian Spesifikasi Klien Belum Terpenuhi'}
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {buildEval.allOrderRequirementsMet
                    ? `${order.clientName} sangat puas dengan pilihan modul dan kerapian rakitanmu.`
                    : 'Coba periksa kembali target RAM, SSD, skor performa, atau kapasitas PSU di Toko Modul pada proyek berikutnya.'}
                </p>
              </div>
            </div>
            <span className="text-sm font-mono font-bold tabular-nums shrink-0">
              {earnedFee > 0 ? `+${formatRupiah(earnedFee)}` : 'Rp0'}
            </span>
          </div>
        )}

        {/* Bagian Pencapaian & Lencana (Achievements) */}
        <section
          aria-label="Lencana Pencapaian Diraih"
          className="border-t border-neutral-200 pt-4 flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">
              Pencapaian &amp; Lencana ({state.earnedAchievements.length}/{ACHIEVEMENT_DEFS.length})
            </h3>
            <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
              Bonus Pencapaian: +{formatScore(state.achievementBonus)} poin
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACHIEVEMENT_DEFS.map((ach) => {
              const earned = earnedSet.has(ach.id);
              return (
                <div
                  key={ach.id}
                  data-achievement-id={ach.id}
                  data-earned={earned ? 'true' : 'false'}
                  className={`rounded-xl border p-3 flex items-start gap-2.5 ${
                    earned
                      ? 'bg-blue-50/70 border-blue-200 text-neutral-900'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-500'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      earned ? 'bg-white border border-blue-200' : 'bg-neutral-100'
                    }`}
                  >
                    <AchievementIcon id={ach.id} unlocked={earned} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold truncate">{ach.title}</p>
                      <span
                        className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${
                          earned ? 'text-emerald-800' : 'text-neutral-400'
                        }`}
                      >
                        +{ach.bonusScore}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug mt-0.5 text-neutral-600">
                      {earned ? ach.earnedNote : ach.conditionLabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Simulasi layar monitor BIOS / UEFI */}
        <div className="rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2 border border-slate-700">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2 text-slate-300">
            <span className="font-semibold text-white">RakitPC UEFI BIOS Utility — POST Summary</span>
            <span className="text-emerald-400">STATUS: OK</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 tabular-nums">
            <p>CPU: {cpuInfo.model} (LGA1700)</p>
            <p>Pendingin: {coolerInfo.model} ({state.postResult?.idleTempC ?? getEffectiveIdleTempC(state)}°C)</p>
            <p>Memori: {state.postResult?.ramModeLabel ?? '32 GB DDR5-5600 (Dual-Channel)'}</p>
            <p>GPU: {gpuInfo.model}</p>
            <p>Penyimpanan: {ssdInfo.model}</p>
            <p>PSU: {psuInfo.model} ({formatPercent(loadPercent)})</p>
          </div>
        </div>

        {/* Tombol aksi utama */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onRestartWithShop}
            className="flex-1 min-h-11 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Belanja &amp; Rakit Lagi</span>
          </button>
          <button
            type="button"
            onClick={onBackToTitle}
            className="min-h-11 px-5 py-2.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Pilih Proyek Lain
          </button>
        </div>
      </div>
    </div>
  );
}

interface HardwareInfoModalProps {
  partId: PartId;
  state: AssemblyState;
  onClose: () => void;
}

export function HardwareInfoModal({ partId, state, onClose }: HardwareInfoModalProps) {
  const part = PARTS_BY_ID[partId];
  const effective = getEffectivePartInfo(state, partId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hw-info-title"
      className="fixed inset-0 z-50 bg-neutral-950/55 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.14)] flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
              <PartThumbnail partId={part.id} className="w-12 h-12" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-600">{part.category}</p>
              <h2 id="hw-info-title" className="text-lg font-semibold text-neutral-900">
                {part.name}
              </h2>
              <p className="text-xs font-mono text-neutral-600 tabular-nums">
                {effective.model} · {effective.specLine}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup informasi hardware"
            className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 border-t border-neutral-200 pt-4">
          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Fungsi Utama</h3>
              <p className="text-sm text-neutral-700 leading-relaxed mt-0.5">{part.eduFunction}</p>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-amber-950">Tips Keamanan Teknisi</h3>
              <p className="text-sm text-amber-900 leading-relaxed mt-0.5">{part.eduSafetyTip}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
