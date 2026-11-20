/* Antarmuka Toko Komponen (Hardware Shop) untuk membeli, menukar, atau mengembalikan modul PC dengan cek anggaran, daya PSU, dan target klien */

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Cpu,
  ListChecks,
  PackageCheck,
  ShoppingBag,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  BUYABLE_SLOTS,
  BUYABLE_SLOT_LABELS,
  CATALOG_BY_SKU,
  CLIENT_ORDERS,
  SHOP_CATALOG,
  SHOP_CATEGORY_LABELS,
  evaluateBuildLoadout,
  type BuyableSlotId,
  type CatalogModuleSpec,
  type ShopCategory,
} from '../lib/hardwareShop';
import {
  getPsuCapacityWatts,
  hasPart,
  type AssemblyState,
} from '../lib/assemblyEngine';
import { formatPercent, formatRupiah, formatWatts } from '../lib/formatters';
import { PartThumbnail } from './PartThumbnail';

interface HardwareShopProps {
  state: AssemblyState;
  activeCategory: ShopCategory;
  onSelectCategory: (category: ShopCategory) => void;
  onBuyModule: (skuId: string, preferredSlot?: BuyableSlotId) => void;
  onBuyDualRamKit: (skuId: string) => void;
  onSellModule: (slotId: BuyableSlotId) => void;
  onAutoFillRecommended: () => void;
  onCloseShop: () => void;
}

const CATEGORIES: ShopCategory[] = [
  'all',
  'cpu',
  'cooling',
  'ram',
  'ssd_nvme',
  'gpu',
  'psu',
  'motherboard',
];

export function HardwareShopModal({
  state,
  activeCategory,
  onSelectCategory,
  onBuyModule,
  onBuyDualRamKit,
  onSellModule,
  onAutoFillRecommended,
  onCloseShop,
}: HardwareShopProps) {
  const order = CLIENT_ORDERS[state.orderId];
  const evaluation = evaluateBuildLoadout(state.purchasedModules, state.orderId);
  const filteredCatalog =
    activeCategory === 'all'
      ? SHOP_CATALOG
      : SHOP_CATALOG.filter((item) => item.shopCategory === activeCategory);

  const installedPsuCapacity = getPsuCapacityWatts(state);

  const renderSkuAction = (sku: CatalogModuleSpec) => {
    if (sku.slotFamily === 'ram_a2') {
      const a2Matches = state.purchasedModules.ram_a2 === sku.skuId;
      const b2Matches = state.purchasedModules.ram_b2 === sku.skuId;
      const bothInstalled = hasPart(state, 'ram_a2') && hasPart(state, 'ram_b2');
      const anyInstalled = hasPart(state, 'ram_a2') || hasPart(state, 'ram_b2');

      if (bothInstalled) {
        return (
          <span className="text-xs font-medium text-neutral-500 whitespace-nowrap">
            {a2Matches && b2Matches ? 'Terpasang (2×)' : 'Slot RAM Terpasang'}
          </span>
        );
      }

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onBuyModule(sku.skuId)}
            aria-label={`Beli 1 keping ${sku.model}`}
            className="min-h-9 px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Beli 1 Keping
          </button>
          {!anyInstalled && (
            <button
              type="button"
              onClick={() => onBuyDualRamKit(sku.skuId)}
              aria-label={`Beli 2 keping Dual-Channel ${sku.model}`}
              className={`min-h-9 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                a2Matches && b2Matches
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              }`}
            >
              {a2Matches && b2Matches ? 'Dimiliki (2×)' : 'Beli 2× Dual-Ch'}
            </button>
          )}
        </div>
      );
    }

    const slot = sku.slotFamily;
    const currentSkuId = state.purchasedModules[slot];
    const isOwnedThis = currentSkuId === sku.skuId;
    const isSlotInstalled = hasPart(state, slot);
    const canUpgradeOverloadedPsu =
      slot === 'psu' &&
      isSlotInstalled &&
      (sku.psuCapacityWatts ?? 0) > installedPsuCapacity;

    if (isSlotInstalled && !canUpgradeOverloadedPsu) {
      return (
        <span className="text-xs font-medium text-neutral-500 whitespace-nowrap">
          {isOwnedThis ? 'Terpasang' : 'Slot Sudah Terpasang'}
        </span>
      );
    }

    if (isOwnedThis) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Dimiliki</span>
          </span>
          <button
            type="button"
            onClick={() => onSellModule(slot)}
            aria-label={`Kembalikan ${sku.model}`}
            className="min-h-9 px-2.5 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Kembalikan
          </button>
        </div>
      );
    }

    const previousPrice = currentSkuId ? (CATALOG_BY_SKU[currentSkuId]?.price ?? 0) : 0;
    const netCost = sku.price - previousPrice;
    const canAfford = state.balance >= netCost;

    let label = 'Beli Modul';
    if (canUpgradeOverloadedPsu) {
      label = `Upgrade (+${formatRupiah(Math.max(0, netCost))})`;
    } else if (currentSkuId) {
      label =
        netCost > 0
          ? `Tukar (+${formatRupiah(netCost)})`
          : netCost < 0
            ? `Tukar (Hemat ${formatRupiah(Math.abs(netCost))})`
            : 'Tukar Modul';
    }

    return (
      <button
        type="button"
        onClick={() => onBuyModule(sku.skuId)}
        aria-label={`${label} ${sku.model}`}
        className={`min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
          canAfford
            ? 'bg-blue-700 hover:bg-blue-800 text-white'
            : 'bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hardware-shop-title"
      className="fixed inset-0 z-40 bg-neutral-950/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl w-full max-w-[1360px] max-h-[94vh] flex flex-col overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.16)]">
        {/* Header Toko Komponen & Metrik Anggaran/Daya */}
        <div className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Toko Modul Hardware</span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span className="text-neutral-600 font-normal">{order.clientName}</span>
            </div>
            <h2
              id="hardware-shop-title"
              className="text-lg sm:text-xl font-semibold text-neutral-900 mt-0.5 truncate"
            >
              {order.title}
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">{order.brief}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <div className="text-right tabular-nums">
              <p className="text-[11px] text-neutral-500">Sisa Anggaran</p>
              <p className="text-base font-bold text-neutral-900">{formatRupiah(state.balance)}</p>
            </div>

            <div className="text-right tabular-nums">
              <p className="text-[11px] text-neutral-500">Estimasi Daya</p>
              <p
                className={`text-sm font-mono font-semibold ${
                  evaluation.isPsuOverloaded ? 'text-red-700' : 'text-neutral-900'
                }`}
              >
                {formatWatts(evaluation.estimatedWattage)} / {formatWatts(evaluation.psuCapacityWatts)}
              </p>
            </div>

            <div className="text-right tabular-nums">
              <p className="text-[11px] text-neutral-500">Performa</p>
              <p className="text-sm font-mono font-semibold text-blue-700">
                {evaluation.benchmarkScore}/100
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCloseShop}
                data-testid="shop-go-workbench"
                className="min-h-11 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Ke Meja Rakit ({evaluation.ownedCount}/{evaluation.totalRequiredCount})
                </span>
              </button>

              <button
                type="button"
                onClick={onCloseShop}
                aria-label="Tutup Toko Modul"
                className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Konten 2 Kolom: Katalog Modul (Kiri) & Ringkasan Rakitan + Target Klien (Kanan) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Kolom Kiri: Filter Kategori & Kartu Modul */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Bar Filter Kategori */}
            <div
              role="tablist"
              aria-label="Filter kategori perangkat keras"
              className="flex flex-wrap items-center gap-1.5 bg-white border border-neutral-200 rounded-xl p-1.5"
            >
              {CATEGORIES.map((category) => {
                const active = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectCategory(category)}
                    className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                      active
                        ? 'bg-blue-700 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {SHOP_CATEGORY_LABELS[category]}
                  </button>
                );
              })}
            </div>

            {/* Peringatan PSU Overload langsung di Katalog */}
            {evaluation.isPsuOverloaded && (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-red-950"
              >
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs leading-relaxed">
                  <strong>Peringatan Daya PSU:</strong> Total kebutuhan daya rakitan ({formatWatts(evaluation.estimatedWattage)}) melebihi kapasitas PSU ({formatWatts(evaluation.psuCapacityWatts)}). Pilih PSU 650 W atau 850 W agar tidak memicu proteksi OCP saat uji POST.
                </p>
              </div>
            )}

            {/* Grid Katalog Modul */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCatalog.map((sku) => {
                const isSelectedSingle =
                  sku.slotFamily !== 'ram_a2' &&
                  state.purchasedModules[sku.slotFamily] === sku.skuId;
                const isSelectedRam =
                  sku.slotFamily === 'ram_a2' &&
                  (state.purchasedModules.ram_a2 === sku.skuId ||
                    state.purchasedModules.ram_b2 === sku.skuId);
                const highlighted = isSelectedSingle || isSelectedRam;

                return (
                  <article
                    key={sku.skuId}
                    data-sku-id={sku.skuId}
                    className={`bg-white rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      highlighted ? 'border-blue-700 bg-blue-50/35' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                        <PartThumbnail partId={sku.slotFamily} className="w-10 h-10" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold text-neutral-900 truncate">
                            {sku.model}
                          </h3>
                          <span className="text-xs font-mono font-bold text-neutral-900 tabular-nums shrink-0">
                            {formatRupiah(sku.price)}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-neutral-600 mt-0.5 tabular-nums">
                          {sku.specLine}
                        </p>
                        <p className="text-xs text-neutral-600 mt-1.5 leading-snug">{sku.note}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-neutral-200">
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {sku.psuCapacityWatts
                          ? `Kapasitas ${sku.psuCapacityWatts} W · ${sku.psuEfficiencyTier}`
                          : `Kelas ${sku.tier === 'pro' ? 'Pro' : sku.tier === 'menengah' ? 'Menengah' : 'Hemat'} · Skor +${sku.performanceScore}`}
                      </span>
                      {renderSkuAction(sku)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Ringkasan Rakitan, Target Pesanan Klien, & Status BIMO */}
          <aside className="lg:col-span-4 bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-4">
            {/* Status Transaksi & BIMO */}
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                state.robotMood === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : state.robotMood === 'happy'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700'
              }`}
            >
              <strong className="font-semibold">BIMO:</strong> {state.robotMessage}
            </div>

            {/* Target Pesanan Klien */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {order.isSandbox ? 'Mode Rakit Bebas' : 'Target Pesanan Klien'}
                </h3>
                {!order.isSandbox && (
                  <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
                    Jasa +{formatRupiah(order.serviceFee)}
                  </span>
                )}
              </div>

              {order.isSandbox ? (
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Tidak ada target wajib. Kamu bebas meracik komponen apa pun dalam anggaran {formatRupiah(order.budget)} dan langsung merakitnya di meja 3D.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {evaluation.orderChecks.map((check) => (
                    <li
                      key={check.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {check.met ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        ) : (
                          <Circle className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />
                        )}
                        <span className={check.met ? 'text-neutral-900' : 'text-neutral-600'}>
                          {check.label}
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums shrink-0 ${
                          check.met ? 'text-emerald-800 font-semibold' : 'text-neutral-500'
                        }`}
                      >
                        {check.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Ringkasan Daya & Anggaran */}
            <div className="border-t border-neutral-200 pt-3 grid grid-cols-2 gap-3 text-xs tabular-nums">
              <div>
                <p className="text-neutral-500">Total Belanja</p>
                <p className="font-mono font-semibold text-neutral-900 mt-0.5">
                  {formatRupiah(evaluation.totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-neutral-500">Beban PSU</p>
                <p
                  className={`font-mono font-semibold mt-0.5 ${
                    evaluation.isPsuOverloaded
                      ? 'text-red-700'
                      : evaluation.psuLoadPercent >= 50 && evaluation.psuLoadPercent <= 65
                        ? 'text-emerald-800'
                        : 'text-neutral-900'
                  }`}
                >
                  {formatPercent(evaluation.psuLoadPercent)} ({formatWatts(evaluation.estimatedWattage)})
                </p>
              </div>
            </div>

            {/* Daftar 9 Slot Modul Rakitan */}
            <div className="border-t border-neutral-200 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Inventaris Rakitan ({evaluation.ownedCount}/{evaluation.totalRequiredCount})
                </h3>
                {evaluation.missingSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={onAutoFillRecommended}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 rounded"
                  >
                    <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Lengkapi Rekomendasi</span>
                  </button>
                )}
              </div>

              <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-xl overflow-hidden">
                {BUYABLE_SLOTS.map((slot) => {
                  const skuId = state.purchasedModules[slot];
                  const sku = skuId ? CATALOG_BY_SKU[skuId] : null;
                  const installed = hasPart(state, slot);
                  return (
                    <li
                      key={slot}
                      className="px-3 py-2 bg-white flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-neutral-500">{BUYABLE_SLOT_LABELS[slot]}</p>
                        <p
                          className={`font-medium truncate ${
                            sku ? 'text-neutral-900' : 'text-amber-800'
                          }`}
                        >
                          {sku ? sku.model : 'Belum dibeli'}
                        </p>
                      </div>

                      {sku ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                            {formatRupiah(sku.price)}
                          </span>
                          {installed ? (
                            <PackageCheck
                              className="w-4 h-4 text-emerald-700"
                              aria-label="Sudah terpasang"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSellModule(slot)}
                              aria-label={`Jual kembali ${sku.model}`}
                              className="w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-red-700 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-neutral-400 shrink-0">
                          Kosong
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p className="text-[11px] text-neutral-500 leading-snug flex items-start gap-1.5">
                <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" aria-hidden="true" />
                <span>
                  Set kabel daya modular (24-Pin ATX, 8-Pin CPU, dan 8-Pin GPU) otomatis disertakan saat PSU dibeli.
                </span>
              </p>
            </div>

            {/* Aksi Bawah Panel Ringkasan */}
            <div className="flex flex-col gap-2 pt-1">
              {evaluation.missingSlots.length > 0 && (
                <button
                  type="button"
                  onClick={onAutoFillRecommended}
                  data-testid="shop-autofill"
                  className="min-h-11 w-full px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <Cpu className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Beli Paket Rekomendasi ({evaluation.missingSlots.length} modul tersisa)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onCloseShop}
                className="min-h-11 w-full px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {evaluation.missingSlots.length === 0
                    ? 'Mulai Merakit di Meja 3D'
                    : 'Lanjut ke Meja Rakit (Bisa Belanja Lagi Nanti)'}
                </span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
