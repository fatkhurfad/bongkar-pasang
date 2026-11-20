/* Area utama meja perakitan interaktif 3D (Three.js) & skema 2D: Tahap 1 Meja Anti-Statis Motherboard dan Tahap 2 Interior Casing ATX */

import {
  AlertTriangle,
  Box,
  Check,
  Layers,
  Lock,
  LockOpen,
  Power,
  RefreshCw,
  RotateCw,
  Zap,
} from 'lucide-react';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { PARTS_BY_ID, type PartId, type SlotId } from '../config';
import {
  getActiveHintTarget,
  getDamagedPartList,
  getEffectivePartInfo,
  getPsuCapacityWatts,
  hasPart,
  type AssemblyState,
  type PostLedKey,
} from '../lib/assemblyEngine';
import { type MonitorOsId } from '../lib/monitorDisplay';
import { Workbench3D } from './Workbench3D';

export type WorkbenchViewMode = '3d' | '2d';

interface WorkbenchStageProps {
  state: AssemblyState;
  viewMode: WorkbenchViewMode;
  lastAudioCue: string | null;
  monitorOs: MonitorOsId;
  onChangeMonitorOs: (os: MonitorOsId) => void;
  isPostRunning: boolean;
  biosSummary: string;
  benchmarkScore: number;
  cpuLoadTempC: number;
  focusSetupSignal?: number;
  onToggleViewMode: (mode: WorkbenchViewMode) => void;
  onSlotInteract: (slotId: SlotId, droppedPartId?: PartId) => void;
  onToggleCpuLatch: () => void;
  onRotateCpu: () => void;
  onTogglePsuSwitch: () => void;
  onRunPost: () => void;
  onReplaceDamagedPart: (partId: PartId) => void;
}

export function WorkbenchStage({
  state,
  viewMode,
  lastAudioCue,
  monitorOs,
  onChangeMonitorOs,
  isPostRunning,
  biosSummary,
  benchmarkScore,
  cpuLoadTempC,
  focusSetupSignal = 0,
  onToggleViewMode,
  onSlotInteract,
  onToggleCpuLatch,
  onRotateCpu,
  onTogglePsuSwitch,
  onRunPost,
  onReplaceDamagedPart,
}: WorkbenchStageProps) {
  const [dragOverSlot, setDragOverSlot] = useState<SlotId | null>(null);
  const hint = getActiveHintTarget(state);
  const damagedList = getDamagedPartList(state);
  const cpuInfo = getEffectivePartInfo(state, 'cpu');
  const gpuInfo = getEffectivePartInfo(state, 'gpu');
  const ssdInfo = getEffectivePartInfo(state, 'ssd_nvme');
  const psuInfo = getEffectivePartInfo(state, 'psu');
  const psuCapacity = getPsuCapacityWatts(state);

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, slotId: SlotId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slotId) {
      setDragOverSlot(slotId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, slotId: SlotId) => {
    event.preventDefault();
    setDragOverSlot(null);
    const rawPart = event.dataTransfer.getData('text/plain') as PartId;
    if (rawPart && PARTS_BY_ID[rawPart]) {
      onSlotInteract(slotId, rawPart);
    } else {
      onSlotInteract(slotId);
    }
  };

  const getSlotClass = (slotId: SlotId, isOccupied: boolean) => {
    const isHinted = hint.slot === slotId;
    const isDragOver = dragOverSlot === slotId;
    const isError = state.lastErrorSlot === slotId;
    const isJustInstalled = state.lastInstalledSlot === slotId;

    return [
      'absolute rounded-lg transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
      isError ? 'animate-shake-slot ring-2 ring-red-500 bg-red-500/20' : '',
      isJustInstalled ? 'animate-snap-in' : '',
      isDragOver
        ? 'ring-2 ring-blue-400 bg-blue-500/25 scale-[1.02]'
        : isHinted && !isOccupied
          ? 'ring-2 ring-blue-400 bg-blue-500/15 hover:bg-blue-500/25'
          : !isOccupied
            ? 'hover:ring-2 hover:ring-sky-300/80 hover:bg-sky-400/10'
            : 'hover:ring-1 hover:ring-slate-400/50',
    ].join(' ');
  };

  const cpuInstalled = hasPart(state, 'cpu');
  const pasteApplied = hasPart(state, 'thermal_paste');
  const coolerInstalled = hasPart(state, 'cpu_cooler');
  const ramA2Installed = hasPart(state, 'ram_a2');
  const ramB2Installed = hasPart(state, 'ram_b2');
  const ssdInstalled = hasPart(state, 'ssd_nvme');

  const psuInstalled = hasPart(state, 'psu');
  const moboInstalled = hasPart(state, 'motherboard');
  const gpuInstalled = hasPart(state, 'gpu');
  const cable24Installed = hasPart(state, 'cable_24pin');
  const cable8CpuInstalled = hasPart(state, 'cable_8pin_cpu');
  const cable8GpuInstalled = hasPart(state, 'cable_8pin_gpu');

  // Slot aktif di atas area CPU berubah sesuai urutan fisik (soket -> pasta -> pendingin)
  const activeCpuZoneSlot: SlotId = !cpuInstalled
    ? 'socket_cpu'
    : !pasteApplied
      ? 'cpu_ihs'
      : 'cooler_mount';

  const activeCpuZoneLabel = !cpuInstalled
    ? 'Soket CPU LGA1700 — Pasang Prosesor'
    : !pasteApplied
      ? 'Permukaan Logam CPU (IHS) — Oleskan Pasta Termal'
      : !coolerInstalled
        ? 'Dudukan Pendingin CPU — Pasang Air Cooler'
        : 'Pendingin CPU Terpasang';

  const postLeds: PostLedKey[] = ['CPU', 'DRAM', 'VGA', 'BOOT'];

  return (
    <section
      aria-label={
        state.phase === 'bench'
          ? 'Meja Anti-Statis Motherboard ATX'
          : 'Interior Casing Mid-Tower ATX'
      }
      className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3"
    >
      {/* Header tahap meja perakitan */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            {state.phase === 'bench'
              ? 'Meja Anti-Statis — Motherboard B760 ATX'
              : 'Interior Casing Mid-Tower ATX'}
          </h2>
          <p className="text-xs text-neutral-600">
            {state.selectedPart
              ? `Komponen aktif: ${PARTS_BY_ID[state.selectedPart].name} — klik slot target untuk memasang.`
              : state.phase === 'bench'
                ? 'Pasang CPU, pasta termal, pendingin, RAM Dual-Channel, dan SSD NVMe.'
                : 'Pasang PSU, motherboard terakit, GPU, kabel daya, lalu uji nyala POST.'}
          </p>
        </div>

        {/* Pengalih tampilan 3D / 2D & tombol bantu cepat kontekstual */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Pilih tampilan meja rakit"
            className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-0.5"
          >
            <button
              type="button"
              onClick={() => onToggleViewMode('3d')}
              aria-pressed={viewMode === '3d'}
              className={`min-h-9 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                viewMode === '3d'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Box className="w-3.5 h-3.5" aria-hidden="true" />
              <span>3D</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('2d')}
              aria-pressed={viewMode === '2d'}
              className={`min-h-9 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                viewMode === '2d'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>2D</span>
            </button>
          </div>

          {state.phase === 'bench' && !coolerInstalled && (
            <>
              {!cpuInstalled && state.selectedPart === 'cpu' && (
                <button
                  type="button"
                  onClick={onRotateCpu}
                  className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                    hint.control === 'rotate_cpu'
                      ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Putar CPU ({state.cpuRotation}°)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleCpuLatch}
                className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  hint.control === 'cpu_latch'
                    ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                    : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                {state.cpuLatchOpen ? (
                  <>
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Kunci Tuas Soket</span>
                  </>
                ) : (
                  <>
                    <LockOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Buka Tuas Soket</span>
                  </>
                )}
              </button>
            </>
          )}

          {state.phase === 'case' && (
            <>
              <button
                type="button"
                disabled={!psuInstalled}
                onClick={onTogglePsuSwitch}
                className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-45 disabled:cursor-not-allowed ${
                  hint.control === 'psu_switch'
                    ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200'
                    : state.psuSwitchOn
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sakelar PSU: {state.psuSwitchOn ? 'ON (I)' : 'OFF (O)'}</span>
              </button>

              <button
                type="button"
                onClick={onRunPost}
                className={`min-h-10 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  hint.control === 'power_button'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Uji Nyala (POST)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Area kanvas interaktif: 3D WebGL Three.js (default) atau Skema 2D SVG */}
      {viewMode === '3d' ? (
        <Workbench3D
          state={state}
          monitorOs={monitorOs}
          onChangeMonitorOs={onChangeMonitorOs}
          isPostRunning={isPostRunning}
          biosSummary={biosSummary}
          benchmarkScore={benchmarkScore}
          cpuLoadTempC={cpuLoadTempC}
          focusSetupSignal={focusSetupSignal}
          onSlotInteract={onSlotInteract}
          onToggleCpuLatch={onToggleCpuLatch}
          onTogglePsuSwitch={onTogglePsuSwitch}
          onRunPost={onRunPost}
        />
      ) : (
        <div
          data-testid="workbench-canvas"
          className="relative w-full aspect-[680/480] rounded-xl overflow-hidden border border-slate-300 bg-slate-900 select-none"
        >
          {state.phase === 'bench' ? (
          <>
            {/* FASE 1: MEJA ANTI-STATIS & MOTHERBOARD B760 ATX */}
            <svg viewBox="0 0 680 480" className="w-full h-full block" aria-hidden="true">
              {/* Alas meja anti-statis ESD abu gelap bergrid halus */}
              <rect width="680" height="480" fill="#1e293b" />
              <defs>
                <pattern id="esd-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#334155" strokeWidth="0.7" />
                </pattern>
              </defs>
              <rect width="680" height="480" fill="url(#esd-grid)" />
              <text x="20" y="24" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                ESD MAT · ANTI-STATIC WORKBENCH · ATX B760
              </text>

              {/* Papan PCB Motherboard ATX */}
              <rect
                x="76"
                y="36"
                width="528"
                height="412"
                rx="10"
                fill="#0f172a"
                stroke="#475569"
                strokeWidth="2.5"
              />

              {/* Jalur tembaga halus PCB */}
              <g stroke="#1e3a5f" strokeWidth="1.2" fill="none" opacity="0.85">
                <path d="M292 145 H380 M292 155 H380 M292 165 H380 M292 175 H380" />
                <path d="M225 225 V278 H265" />
                <path d="M240 225 V268 H290" />
                <path d="M460 320 H530 V240" />
                <path d="M160 340 H280" />
              </g>

              {/* Lubang baut standoff motherboard */}
              {[
                [92, 52],
                [340, 52],
                [588, 52],
                [92, 240],
                [340, 240],
                [588, 240],
                [92, 432],
                [340, 432],
                [588, 432],
              ].map(([cx, cy], idx) => (
                <g key={idx}>
                  <circle cx={cx} cy={cy} r="6" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
                  <circle cx={cx} cy={cy} r="2.8" fill="#0f172a" />
                </g>
              ))}

              {/* Penutup Rear I/O aluminium kiri atas */}
              <rect x="86" y="64" width="44" height="150" rx="4" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
              <text
                x="108"
                y="142"
                textAnchor="middle"
                fontSize="9"
                fill="#cbd5e1"
                fontFamily="monospace"
                transform="rotate(-90 108 142)"
              >
                REAR I/O SHIELD
              </text>

              {/* Heatsink VRM atas dan kiri CPU */}
              <rect x="160" y="54" width="166" height="28" rx="4" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="170" y1="64" x2="316" y2="64" stroke="#1e293b" strokeWidth="2" />
              <line x1="170" y1="72" x2="316" y2="72" stroke="#1e293b" strokeWidth="2" />

              <rect x="140" y="96" width="28" height="122" rx="4" fill="#475569" stroke="#94a3b8" strokeWidth="1.2" />
              <line x1="150" y1="104" x2="150" y2="210" stroke="#1e293b" strokeWidth="2" />
              <line x1="158" y1="104" x2="158" y2="210" stroke="#1e293b" strokeWidth="2" />

              {/* Header EPS 8-Pin CPU (tampilan referensi) */}
              <rect x="108" y="42" width="34" height="16" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" />
              <text x="125" y="53" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">
                CPU_8P
              </text>

              {/* SOKET CPU LGA1700 */}
              <rect
                x="192"
                y="102"
                width="124"
                height="124"
                rx="6"
                fill="#1e293b"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              {/* Area pin LGA1700 di dalam soket */}
              <rect x="206" y="116" width="96" height="96" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.2" />
              {/* Pola titik pin emas LGA */}
              {!cpuInstalled && (
                <g fill="#ca8a04" opacity="0.7">
                  {Array.from({ length: 6 }).map((_, r) =>
                    Array.from({ length: 6 }).map((__, c) => (
                      <circle key={`${r}-${c}`} cx={219 + c * 14} cy={129 + r * 14} r="1.7" />
                    )),
                  )}
                </g>
              )}

              {/* Tanda segitiga emas Pin 1 pada soket (pojok kiri bawah) */}
              <polygon points="200,218 214,218 200,204" fill="#f59e0b" />
              <text x="254" y="96" textAnchor="middle" fontSize="9" fontWeight="600" fill="#cbd5e1" fontFamily="monospace">
                LGA1700 SOCKET
              </text>

              {/* CPU TERPASANG */}
              {cpuInstalled && (
                <g>
                  <rect x="208" y="118" width="92" height="92" rx="4" fill="#14532d" stroke="#0f172a" strokeWidth="1.5" />
                  <rect x="218" y="128" width="72" height="72" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
                  <text x="254" y="162" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b" fontFamily="monospace">
                    {cpuInfo.shortCode}
                  </text>
                  <text x="254" y="175" textAnchor="middle" fontSize="8" fill="#475569" fontFamily="monospace">
                    LGA1700
                  </text>
                  <polygon points="210,208 222,208 210,196" fill="#f59e0b" />
                </g>
              )}

              {/* Tutup penahan logam (ILM) soket terbuka / tertutup */}
              {state.cpuLatchOpen ? (
                <g>
                  {/* Bingkai atas terangkat ke belakang */}
                  <rect
                    x="198"
                    y="72"
                    width="112"
                    height="24"
                    rx="3"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                  {/* Tuas logam terangkat ke atas */}
                  <path d="M322 212 L344 128" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="344" cy="128" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
                </g>
              ) : (
                <g>
                  {/* Bingkai pengunci menutup pinggiran soket */}
                  <rect x="198" y="108" width="112" height="112" rx="4" fill="none" stroke="#94a3b8" strokeWidth="4" />
                  {/* Tuas logam terkunci rapi di sisi kanan */}
                  <path d="M322 114 L322 218 L314 218" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
                </g>
              )}

              {/* PASTA TERMAL TEROLES */}
              {pasteApplied && !coolerInstalled && (
                <g>
                  <circle cx="254" cy="164" r="11" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
                  <circle cx="251" cy="161" r="3.5" fill="#94a3b8" />
                </g>
              )}

              {/* PENDINGIN CPU TERPASANG */}
              {coolerInstalled && (
                <g>
                  <rect x="184" y="94" width="140" height="140" rx="10" fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" />
                  {/* 4 ujung heatpipe tembaga */}
                  <circle cx="200" cy="108" r="4" fill="#d97706" />
                  <circle cx="308" cy="108" r="4" fill="#d97706" />
                  <circle cx="200" cy="220" r="4" fill="#d97706" />
                  <circle cx="308" cy="220" r="4" fill="#d97706" />
                  {/* Ring kipas 120mm */}
                  <circle cx="254" cy="164" r="48" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                  <path d="M254 164 L254 120 A44 44 0 0 1 292 142 Z" fill="#475569" />
                  <path d="M254 164 L296 176 A44 44 0 0 1 262 208 Z" fill="#475569" />
                  <path d="M254 164 L224 196 A44 44 0 0 1 214 150 Z" fill="#475569" />
                  <circle cx="254" cy="164" r="14" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                  <text x="254" y="167" textAnchor="middle" fontSize="7" fill="#e2e8f0" fontFamily="monospace">
                    PWM
                  </text>
                </g>
              )}

              {/* 4 SLOT RAM DDR5 (A1, A2*, B1, B2*) */}
              <g>
                <text x="454" y="76" textAnchor="middle" fontSize="9" fontWeight="600" fill="#cbd5e1" fontFamily="monospace">
                  DDR5 DIMM SLOTS (DUAL-CH: A2 & B2)
                </text>
                {[
                  { label: 'A1', x: 392, primary: false, installed: false },
                  { label: 'A2*', x: 426, primary: true, installed: ramA2Installed },
                  { label: 'B1', x: 460, primary: false, installed: false },
                  { label: 'B2*', x: 494, primary: true, installed: ramB2Installed },
                ].map((slot) => (
                  <g key={slot.label}>
                    {/* Klip pengunci atas & bawah */}
                    <rect x={slot.x + 2} y="84" width="18" height="8" rx="1.5" fill="#94a3b8" />
                    <rect x={slot.x + 2} y="236" width="18" height="8" rx="1.5" fill="#94a3b8" />
                    {/* Rel slot DIMM */}
                    <rect
                      x={slot.x}
                      y="92"
                      width="22"
                      height="144"
                      rx="2"
                      fill={slot.installed ? '#1d4ed8' : slot.primary ? '#1e293b' : '#0f172a'}
                      stroke={slot.installed ? '#93c5fd' : slot.primary ? '#60a5fa' : '#475569'}
                      strokeWidth={slot.primary ? '1.8' : '1.2'}
                    />
                    {slot.installed ? (
                      <>
                        <rect x={slot.x + 4} y="98" width="14" height="132" rx="1" fill="#0f172a" />
                        <rect x={slot.x + 8} y="108" width="6" height="112" rx="1" fill="#2563eb" />
                      </>
                    ) : (
                      <>
                        <line x1={slot.x + 11} y1="98" x2={slot.x + 11} y2="168" stroke="#020617" strokeWidth="3" />
                        <line x1={slot.x + 11} y1="178" x2={slot.x + 11} y2="230" stroke="#020617" strokeWidth="3" />
                      </>
                    )}
                    <text
                      x={slot.x + 11}
                      y="258"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={slot.primary ? '700' : '500'}
                      fill={slot.primary ? '#93c5fd' : '#64748b'}
                      fontFamily="monospace"
                    >
                      {slot.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Header ATX 24-Pin sisi kanan */}
              <rect x="548" y="122" width="24" height="96" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <text
                x="560"
                y="174"
                textAnchor="middle"
                fontSize="8"
                fill="#94a3b8"
                fontFamily="monospace"
                transform="rotate(-90 560 174)"
              >
                ATX_24P
              </text>

              {/* SLOT M.2 NVMe GEN4 */}
              <g>
                <text x="274" y="274" textAnchor="middle" fontSize="9" fontWeight="600" fill="#cbd5e1" fontFamily="monospace">
                  M.2_1 NVMe PCIe 4.0 x4
                </text>
                <rect
                  x="166"
                  y="282"
                  width="216"
                  height="38"
                  rx="4"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth="1.5"
                />
                {/* Konektor M-Key kiri */}
                <rect x="166" y="286" width="16" height="30" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
                {/* Standoff baut kanan */}
                <circle cx="370" cy="301" r="5" fill="#d97706" />

                {ssdInstalled && (
                  <g>
                    <rect x="178" y="286" width="192" height="30" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                    <rect x="194" y="291" width="38" height="20" rx="1.5" fill="#334155" />
                    <rect x="242" y="291" width="66" height="20" rx="1.5" fill="#1d4ed8" />
                    <text x="275" y="304" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff" fontFamily="monospace">
                      {ssdInfo.shortCode}
                    </text>
                    <circle cx="370" cy="301" r="4" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1" />
                  </g>
                )}
              </g>

              {/* Slot PCIe 4.0 x16 (referensi visual) */}
              <rect x="166" y="346" width="236" height="18" rx="2" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="176" y1="355" x2="392" y2="355" stroke="#0f172a" strokeWidth="4" />
              <text x="284" y="378" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                PCIe 4.0 x16 (GPU dipasang di Tahap 2 Casing)
              </text>

              {/* Heatsink Chipset B760 */}
              <rect x="454" y="330" width="112" height="84" rx="6" fill="#334155" stroke="#64748b" strokeWidth="1.8" />
              <text x="510" y="376" textAnchor="middle" fontSize="11" fontWeight="700" fill="#cbd5e1" fontFamily="monospace">
                B760 CHIPSET
              </text>

              {/* Baterai CMOS */}
              <circle cx="426" cy="390" r="14" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
              <text x="426" y="393" textAnchor="middle" fontSize="6" fontWeight="700" fill="#1e293b" fontFamily="monospace">
                CR2032
              </text>
            </svg>

            {/* Tombol Slot Aksesibel Tahap 1 (Meja Motherboard) */}
            {/* 1. Area Tuas Soket LGA */}
            {!coolerInstalled && (
              <button
                type="button"
                onClick={onToggleCpuLatch}
                aria-label={
                  state.cpuLatchOpen
                    ? 'Tuas soket CPU LGA1700 sedang terbuka, klik untuk mengunci'
                    : 'Tuas soket CPU LGA1700 sedang terkunci, klik untuk membuka'
                }
                style={{ left: '46.5%', top: '20%', width: '6.5%', height: '27%' }}
                className={`absolute rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                  hint.control === 'cpu_latch'
                    ? 'ring-2 ring-blue-400 bg-blue-500/20 hover:bg-blue-500/30'
                    : 'hover:ring-2 hover:ring-sky-300/80'
                }`}
              />
            )}

            {/* 2. Area Soket CPU / Pasta Termal / Pendingin CPU */}
            <button
              type="button"
              onClick={() => onSlotInteract(activeCpuZoneSlot)}
              onDragOver={(e) => handleDragOver(e, activeCpuZoneSlot)}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, activeCpuZoneSlot)}
              aria-label={activeCpuZoneLabel}
              style={{ left: '27.5%', top: '20.5%', width: '19%', height: '27%' }}
              className={getSlotClass(activeCpuZoneSlot, coolerInstalled)}
            >
              {hint.slot === activeCpuZoneSlot && !coolerInstalled && (
                <span className="sr-only">Target langkah saat ini</span>
              )}
            </button>

            {/* 3. Slot RAM A2 */}
            <button
              type="button"
              onClick={() => onSlotInteract('dimm_a2')}
              onDragOver={(e) => handleDragOver(e, 'dimm_a2')}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, 'dimm_a2')}
              aria-label={
                ramA2Installed ? 'Slot RAM A2 sudah terisi DDR5 16 GB' : 'Slot RAM A2 kosong, klik untuk pasang RAM'
              }
              style={{ left: '62.2%', top: '18%', width: '4.4%', height: '33%' }}
              className={getSlotClass('dimm_a2', ramA2Installed)}
            />

            {/* 4. Slot RAM B2 */}
            <button
              type="button"
              onClick={() => onSlotInteract('dimm_b2')}
              onDragOver={(e) => handleDragOver(e, 'dimm_b2')}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, 'dimm_b2')}
              aria-label={
                ramB2Installed ? 'Slot RAM B2 sudah terisi DDR5 16 GB' : 'Slot RAM B2 kosong, klik untuk pasang RAM'
              }
              style={{ left: '72.2%', top: '18%', width: '4.4%', height: '33%' }}
              className={getSlotClass('dimm_b2', ramB2Installed)}
            />

            {/* 5. Slot M.2 NVMe */}
            <button
              type="button"
              onClick={() => onSlotInteract('m2_slot')}
              onDragOver={(e) => handleDragOver(e, 'm2_slot')}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, 'm2_slot')}
              aria-label={
                ssdInstalled ? 'Slot M.2 NVMe sudah terisi SSD 1 TB' : 'Slot M.2 NVMe kosong, klik untuk pasang SSD'
              }
              style={{ left: '24%', top: '58%', width: '32.5%', height: '9%' }}
              className={getSlotClass('m2_slot', ssdInstalled)}
            />
          </>
        ) : (
          <>
            {/* FASE 2: INTERIOR CASING MID-TOWER ATX */}
            <svg viewBox="0 0 680 480" className="w-full h-full block" aria-hidden="true">
              {/* Latar ruang bengkel */}
              <rect width="680" height="480" fill="#1e293b" />

              {/* Rangka luar casing baja ATX */}
              <rect x="46" y="24" width="588" height="432" rx="14" fill="#0f172a" stroke="#64748b" strokeWidth="4" />
              {/* Panel dalam casing */}
              <rect x="64" y="42" width="552" height="396" rx="8" fill="#182234" stroke="#334155" strokeWidth="1.5" />

              {/* Kipas pembuangan belakang casing */}
              <rect x="74" y="64" width="22" height="84" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
              {/* Ventilasi depan kanan */}
              <rect x="576" y="72" width="26" height="250" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
              {[110, 195, 280].map((cy) => (
                <g key={cy} className={state.fansSpinning ? 'animate-spin-fan' : ''}>
                  <circle cx="589" cy={cy} r="9" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
                  <line x1="589" y1={cy - 7} x2="589" y2={cy + 7} stroke="#94a3b8" strokeWidth="1.5" />
                </g>
              ))}

              {/* Sekat bawah PSU Shroud */}
              <rect x="64" y="346" width="552" height="92" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.8" />
              <text x="392" y="395" fontSize="10" fill="#64748b" fontFamily="monospace">
                CABLE MANAGEMENT SHROUD
              </text>

              {/* KOMPARTEMEN PSU (kiri bawah) */}
              <rect
                x="82"
                y="358"
                width="206"
                height="68"
                rx="6"
                fill="#1e293b"
                stroke={psuInstalled ? '#94a3b8' : '#475569'}
                strokeWidth="1.8"
                strokeDasharray={psuInstalled ? undefined : '5 4'}
              />
              {!psuInstalled ? (
                <text x="185" y="396" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                  SLOT PSU ATX ({psuCapacity} W)
                </text>
              ) : (
                <g>
                  <rect x="86" y="362" width="198" height="60" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                  <rect x="102" y="374" width="68" height="24" rx="3" fill="#f59e0b" />
                  <text x="136" y="390" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a" fontFamily="monospace">
                    {psuInfo.shortCode}
                  </text>
                  <text x="102" y="412" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                    PSU TERPASANG
                  </text>
                  {/* Sakelar I/O di bodi PSU */}
                  <rect
                    x="224"
                    y="374"
                    width="48"
                    height="36"
                    rx="4"
                    fill={state.psuSwitchOn ? '#065f46' : '#334155'}
                    stroke={state.psuSwitchOn ? '#34d399' : '#94a3b8'}
                    strokeWidth="1.5"
                  />
                  <text x="248" y="396" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" fontFamily="monospace">
                    {state.psuSwitchOn ? 'ON (I)' : 'OFF (O)'}
                  </text>
                </g>
              )}

              {/* AREA STANDOFF MOTHERBOARD ATX */}
              <rect
                x="114"
                y="56"
                width="344"
                height="276"
                rx="8"
                fill="#111827"
                stroke={moboInstalled ? '#64748b' : '#475569'}
                strokeWidth="2"
                strokeDasharray={moboInstalled ? undefined : '6 4'}
              />

              {!moboInstalled ? (
                <>
                  {/* 9 titik standoff kuningan */}
                  {[134, 286, 438].map((sx) =>
                    [76, 194, 312].map((sy) => (
                      <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r="4.5" fill="#d97706" stroke="#fef3c7" strokeWidth="1" />
                    )),
                  )}
                  <text x="286" y="198" textAnchor="middle" fontSize="11" fill="#94a3b8" fontFamily="monospace">
                    PASANG MOTHERBOARD TERAKIT (9 STANDOFF)
                  </text>
                </>
              ) : (
                <g>
                  {/* Motherboard terpasang lengkap dengan CPU Cooler, RAM, NVMe */}
                  <rect x="118" y="60" width="336" height="268" rx="6" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                  {/* Rear I/O */}
                  <rect x="124" y="76" width="24" height="92" rx="2" fill="#475569" />
                  {/* Header EPS 8-Pin CPU pojok kiri atas */}
                  <rect
                    x="154"
                    y="66"
                    width="34"
                    height="18"
                    rx="2"
                    fill={cable8CpuInstalled ? '#065f46' : '#1e293b'}
                    stroke={cable8CpuInstalled ? '#34d399' : '#94a3b8'}
                    strokeWidth="1.5"
                  />
                  <text x="171" y="78" textAnchor="middle" fontSize="7" fontWeight="700" fill="#e2e8f0" fontFamily="monospace">
                    CPU 8P
                  </text>

                  {/* Pendingin CPU dengan kipas berputar saat POST sukses */}
                  <rect x="190" y="96" width="84" height="84" rx="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                  <g className={state.fansSpinning ? 'animate-spin-fan' : ''}>
                    <circle cx="232" cy="138" r="28" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M232 138 L232 112 A26 26 0 0 1 255 126 Z" fill="#64748b" />
                    <path d="M232 138 L256 146 A26 26 0 0 1 236 164 Z" fill="#64748b" />
                    <path d="M232 138 L212 156 A26 26 0 0 1 208 128 Z" fill="#64748b" />
                    <circle cx="232" cy="138" r="7" fill="#334155" />
                  </g>

                  {/* RAM Dual-Channel A2 & B2 terpasang */}
                  <rect x="304" y="90" width="12" height="94" rx="1.5" fill="#2563eb" stroke="#93c5fd" strokeWidth="1" />
                  <rect x="330" y="90" width="12" height="94" rx="1.5" fill="#2563eb" stroke="#93c5fd" strokeWidth="1" />

                  {/* SSD NVMe terpasang */}
                  <rect x="176" y="196" width="114" height="18" rx="2" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="1" />
                  <text x="233" y="208" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffffff" fontFamily="monospace">
                    NVMe 1 TB
                  </text>

                  {/* Header ATX 24-Pin sisi kanan motherboard */}
                  <rect
                    x="418"
                    y="112"
                    width="24"
                    height="78"
                    rx="3"
                    fill={cable24Installed ? '#1e3a8a' : '#1e293b'}
                    stroke={cable24Installed ? '#60a5fa' : '#94a3b8'}
                    strokeWidth="1.5"
                  />
                  <text
                    x="430"
                    y="154"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="700"
                    fill="#e2e8f0"
                    fontFamily="monospace"
                    transform="rotate(-90 430 154)"
                  >
                    ATX 24P
                  </text>

                  {/* Slot PCIe 4.0 x16 untuk GPU */}
                  <rect x="150" y="230" width="166" height="16" rx="2" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
                  {!gpuInstalled && (
                    <text x="233" y="260" textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                      SLOT PCIe 4.0 x16 (GPU)
                    </text>
                  )}

                  {/* EZ-Debug POST LED Strip di kanan atas motherboard (bebas dari jalur kabel) */}
                  <g>
                    <rect x="376" y="66" width="68" height="36" rx="4" fill="#020617" stroke="#475569" strokeWidth="1.2" />
                    <text x="410" y="78" textAnchor="middle" fontSize="6.5" fill="#94a3b8" fontFamily="monospace">
                      POST LED
                    </text>
                    {postLeds.map((led, idx) => {
                      const cx = 387 + idx * 15;
                      const isFault = state.postResult && !state.postResult.passed && state.postResult.faultLed === led;
                      const isPass = state.postResult?.passed;
                      const fill = isFault ? '#ef4444' : isPass ? '#10b981' : '#334155';
                      return (
                        <g key={led}>
                          <circle cx={cx} cy="89" r="3.5" fill={fill} />
                          <text x={cx} y="99" textAnchor="middle" fontSize="5" fill="#cbd5e1" fontFamily="monospace">
                            {led.slice(0, 3)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </g>
              )}

              {/* KARTU GRAFIS (GPU) TERPASANG DI SLOT PCIe x16 */}
              {gpuInstalled && (
                <g>
                  <rect x="122" y="226" width="248" height="62" rx="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
                  <text x="154" y="242" fontSize="8" fontWeight="700" fill="#e2e8f0" fontFamily="monospace">
                    {gpuInfo.model}
                  </text>
                  {/* Dua kipas GPU berputar saat POST sukses */}
                  {[186, 266].map((gx) => (
                    <g key={gx} className={state.fansSpinning ? 'animate-spin-fan' : ''}>
                      <circle cx={gx} cy="260" r="19" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
                      <line x1={gx - 14} y1="260" x2={gx + 14} y2="260" stroke="#94a3b8" strokeWidth="3" />
                      <line x1={gx} y1="246" x2={gx} y2="274" stroke="#94a3b8" strokeWidth="3" />
                      <circle cx={gx} cy="260" r="5" fill="#334155" />
                    </g>
                  ))}
                  {/* Port daya 8-Pin PCIe di ujung kanan GPU */}
                  <rect
                    x="332"
                    y="240"
                    width="30"
                    height="24"
                    rx="3"
                    fill={cable8GpuInstalled ? '#92400e' : '#0f172a'}
                    stroke={cable8GpuInstalled ? '#fbbf24' : '#f59e0b'}
                    strokeWidth="1.5"
                  />
                  <text x="347" y="255" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#fef3c7" fontFamily="monospace">
                    GPU 8P
                  </text>
                </g>
              )}

              {/* JALUR KABEL DAYA ANYAMAN SETELAH TERCOLOK */}
              {cable24Installed && (
                <path
                  d="M442 150 C504 150, 502 332, 288 378"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
              )}
              {cable8CpuInstalled && (
                <path
                  d="M171 66 C171 38, 534 38, 534 226 C534 342, 384 374, 288 374"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              )}
              {cable8GpuInstalled && (
                <path
                  d="M362 252 C432 252, 434 366, 288 392"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />
              )}

              {/* Tombol Power Panel Depan Casing (kanan atas casing) */}
              <g>
                <rect
                  x="556"
                  y="34"
                  width="54"
                  height="26"
                  rx="6"
                  fill={state.fansSpinning ? '#065f46' : '#1e293b'}
                  stroke={state.fansSpinning ? '#34d399' : '#60a5fa'}
                  strokeWidth="1.8"
                />
                <text x="583" y="51" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff" fontFamily="monospace">
                  POWER
                </text>
              </g>
            </svg>

            {/* Tombol Slot Aksesibel Tahap 2 (Interior Casing ATX) */}
            {/* 1. Slot PSU */}
            <button
              type="button"
              onClick={() => (psuInstalled ? onTogglePsuSwitch() : onSlotInteract('psu_bay'))}
              onDragOver={(e) => handleDragOver(e, 'psu_bay')}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, 'psu_bay')}
              aria-label={
                psuInstalled
                  ? `PSU 650 W terpasang, sakelar ${state.psuSwitchOn ? 'ON' : 'OFF'}, klik untuk mengubah sakelar`
                  : 'Ruang PSU bawah casing kosong, klik untuk memasang PSU 650 W'
              }
              style={{ left: '12%', top: '74%', width: '30.5%', height: '15%' }}
              className={getSlotClass('psu_bay', psuInstalled)}
            />

            {/* 2. Slot Motherboard ke 9 Standoff (tampil saat motherboard belum terpasang) */}
            {!moboInstalled && (
              <button
                type="button"
                onClick={() => onSlotInteract('case_standoffs')}
                onDragOver={(e) => handleDragOver(e, 'case_standoffs')}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleDrop(e, 'case_standoffs')}
                aria-label="Area 9 standoff casing kosong, klik untuk memasang Motherboard Terakit"
                style={{ left: '16.5%', top: '11.5%', width: '51%', height: '58%' }}
                className={getSlotClass('case_standoffs', false)}
              />
            )}

            {/* 3. Slot GPU PCIe x16 (muncul setelah motherboard terpasang) */}
            {moboInstalled && !gpuInstalled && (
              <button
                type="button"
                onClick={() => onSlotInteract('pcie_x16')}
                onDragOver={(e) => handleDragOver(e, 'pcie_x16')}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleDrop(e, 'pcie_x16')}
                aria-label="Slot PCIe 4.0 x16 kosong, klik untuk memasang Kartu Grafis GPU"
                style={{ left: '20%', top: '46%', width: '32%', height: '13%' }}
                className={getSlotClass('pcie_x16', false)}
              />
            )}

            {/* 4. Header Kabel 24-Pin ATX */}
            {moboInstalled && (
              <button
                type="button"
                onClick={() => onSlotInteract('header_24pin')}
                onDragOver={(e) => handleDragOver(e, 'header_24pin')}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleDrop(e, 'header_24pin')}
                aria-label={
                  cable24Installed
                    ? 'Kabel ATX 24-Pin sudah terpasang'
                    : 'Header ATX 24-Pin motherboard kosong, klik untuk mencolokkan kabel 24-Pin'
                }
                style={{ left: '60.5%', top: '22.5%', width: '5.5%', height: '18%' }}
                className={getSlotClass('header_24pin', cable24Installed)}
              />
            )}

            {/* 5. Header Kabel EPS 8-Pin CPU */}
            {moboInstalled && (
              <button
                type="button"
                onClick={() => onSlotInteract('header_8pin_cpu')}
                onDragOver={(e) => handleDragOver(e, 'header_8pin_cpu')}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleDrop(e, 'header_8pin_cpu')}
                aria-label={
                  cable8CpuInstalled
                    ? 'Kabel EPS 8-Pin CPU sudah terpasang'
                    : 'Header EPS 8-Pin CPU kosong, klik untuk mencolokkan kabel 8-Pin CPU'
                }
                style={{ left: '21.8%', top: '12.5%', width: '6.8%', height: '6%' }}
                className={getSlotClass('header_8pin_cpu', cable8CpuInstalled)}
              />
            )}

            {/* 6. Port Daya PCIe 8-Pin GPU */}
            {gpuInstalled && (
              <button
                type="button"
                onClick={() => onSlotInteract('gpu_power_8pin')}
                onDragOver={(e) => handleDragOver(e, 'gpu_power_8pin')}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={(e) => handleDrop(e, 'gpu_power_8pin')}
                aria-label={
                  cable8GpuInstalled
                    ? 'Kabel PCIe 8-Pin GPU sudah terpasang'
                    : 'Port daya 8-Pin GPU kosong, klik untuk mencolokkan kabel 8-Pin GPU'
                }
                style={{ left: '48%', top: '49%', width: '6.5%', height: '7%' }}
                className={getSlotClass('gpu_power_8pin', cable8GpuInstalled)}
              />
            )}

            {/* 7. Tombol Power Casing di kanan atas */}
            <button
              type="button"
              onClick={onRunPost}
              aria-label="Tombol Power Casing — tekan untuk menjalankan uji nyala POST"
              style={{ left: '81.5%', top: '6.5%', width: '8.5%', height: '6.5%' }}
              className={`absolute rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                hint.control === 'power_button' ? 'ring-2 ring-emerald-400 bg-emerald-400/20' : ''
              }`}
            />
          </>
        )}
        </div>
      )}

      {/* Strip Peringatan Part Rusak (dengan tombol ganti RMA cepat) */}
      {damagedList.length > 0 && (
        <div
          role="alert"
          data-testid="damaged-part-banner"
          className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs text-red-950"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <span className="font-semibold">
                Status Part Rusak: {PARTS_BY_ID[damagedList[0].partId].shortName}
              </span>
              <span className="text-red-800"> ({damagedList[0].label})</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onReplaceDamagedPart(damagedList[0].partId)}
            className="min-h-9 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ganti Part (RMA)</span>
          </button>
        </div>
      )}

      {/* Strip Diagnostik POST / Status Komponen di bawah kanvas */}
      {state.postResult && !state.postResult.passed ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-900"
        >
          <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-semibold">
              {state.postResult.headline} ({state.postResult.beepCode})
            </span>
            <span className="text-red-800"> — {state.postResult.explanation}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Check className={`w-3.5 h-3.5 ${cpuInstalled ? 'text-emerald-700' : 'text-neutral-300'}`} aria-hidden="true" />
              CPU
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className={`w-3.5 h-3.5 ${coolerInstalled ? 'text-emerald-700' : 'text-neutral-300'}`} aria-hidden="true" />
              Pendingin
            </span>
            <span className="inline-flex items-center gap-1">
              <Check
                className={`w-3.5 h-3.5 ${ramA2Installed && ramB2Installed ? 'text-emerald-700' : 'text-neutral-300'}`}
                aria-hidden="true"
              />
              RAM Dual-Ch
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className={`w-3.5 h-3.5 ${ssdInstalled ? 'text-emerald-700' : 'text-neutral-300'}`} aria-hidden="true" />
              NVMe
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className={`w-3.5 h-3.5 ${gpuInstalled ? 'text-emerald-700' : 'text-neutral-300'}`} aria-hidden="true" />
              GPU
            </span>
            <span className="inline-flex items-center gap-1">
              <Check
                className={`w-3.5 h-3.5 ${cable24Installed && cable8CpuInstalled && cable8GpuInstalled ? 'text-emerald-700' : 'text-neutral-300'}`}
                aria-hidden="true"
              />
              Kabel Daya
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            {lastAudioCue && (
              <span className="text-[11px] text-blue-700 font-medium truncate max-w-[260px]">
                Audio: {lastAudioCue}
              </span>
            )}
            <span className="font-mono text-[11px] text-neutral-500 shrink-0">
              {state.phase === 'bench' ? 'Tahap 1/2' : 'Tahap 2/2'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
