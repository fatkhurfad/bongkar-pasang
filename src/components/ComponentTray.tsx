/* Panel baki komponen perangkat keras yang dapat dipilih, diputar, diganti saat rusak (RMA), atau diseret ke meja rakit */

import { AlertTriangle, CheckCircle2, Info, RefreshCw, RotateCw } from 'lucide-react';
import type { DragEvent } from 'react';
import { BUILD_PRESETS, type PartId } from '../config';
import {
  getActiveHintTarget,
  getPhaseParts,
  hasPart,
  type AssemblyState,
} from '../lib/assemblyEngine';
import { formatAngle } from '../lib/formatters';
import { PartThumbnail } from './PartThumbnail';

interface ComponentTrayProps {
  state: AssemblyState;
  onSelectPart: (partId: PartId) => void;
  onRotateCpu: () => void;
  onInspectPart: (partId: PartId) => void;
  onReplaceDamagedPart: (partId: PartId) => void;
}

export function ComponentTray({
  state,
  onSelectPart,
  onRotateCpu,
  onInspectPart,
  onReplaceDamagedPart,
}: ComponentTrayProps) {
  const parts = getPhaseParts(state.phase);
  const hint = getActiveHintTarget(state);
  const preset = BUILD_PRESETS[state.buildPreset];

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, partId: PartId) => {
    event.dataTransfer.setData('text/plain', partId);
    event.dataTransfer.effectAllowed = 'move';
    onSelectPart(partId);
  };

  return (
    <section
      aria-label="Baki Komponen Perangkat Keras"
      className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Baki Komponen</h2>
        <span className="text-xs font-medium text-neutral-600">
          {state.phase === 'bench' ? 'Tahap 1: Meja Rakit' : 'Tahap 2: Casing ATX'}
        </span>
      </div>

      {/* Kontrol khusus orientasi segitiga emas CPU saat CPU dipilih dan belum terpasang */}
      {state.phase === 'bench' && !hasPart(state, 'cpu') && state.selectedPart === 'cpu' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-950">Orientasi Segitiga Emas CPU</span>
            <span className="text-xs font-mono font-semibold tabular-nums text-blue-800">
              {formatAngle(state.cpuRotation)} {state.cpuRotation === 0 ? 'Sejajar' : 'Miring'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRotateCpu}
            className="min-h-11 w-full px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <RotateCw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Putar CPU 90° (R)</span>
          </button>
        </div>
      )}

      {/* Daftar komponen pada fase aktif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {parts.map((part) => {
          const installed = hasPart(state, part.id);
          const damagedInfo = state.damagedParts[part.id];
          const isDamaged = Boolean(damagedInfo);
          const selected = state.selectedPart === part.id;
          const isHinted = hint.part === part.id && !installed && !isDamaged;
          const modelLabel =
            part.id === 'cpu'
              ? preset.cpuModel
              : part.id === 'gpu'
                ? preset.gpuModel
                : part.model;
          const specLabel =
            part.id === 'cpu'
              ? preset.cpuSpecLine
              : part.id === 'gpu'
                ? preset.gpuSpecLine
                : part.specLine;

          return (
            <div key={part.id} className="flex flex-col gap-1.5 min-w-0">
              <div className="relative flex items-stretch gap-1.5 min-w-0">
                <button
                  type="button"
                  draggable={!installed && !isDamaged}
                  onDragStart={(e) => handleDragStart(e, part.id)}
                  onClick={() => onSelectPart(part.id)}
                  aria-pressed={selected}
                  aria-label={`${part.name}, ${specLabel}, ${
                    isDamaged
                      ? 'Part Rusak, perlu diganti'
                      : installed
                        ? 'sudah terpasang'
                        : selected
                          ? 'sedang dipilih'
                          : 'pilih komponen'
                  }`}
                  className={`flex-1 min-w-0 overflow-hidden min-h-16 text-left rounded-xl border p-2.5 flex items-center gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                    isDamaged
                      ? 'bg-red-50 border-red-400 text-red-950'
                      : installed
                        ? 'bg-neutral-50 border-neutral-200 text-neutral-500'
                        : selected
                          ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700 text-neutral-900'
                          : isHinted
                            ? 'bg-blue-50/60 border-blue-500 text-neutral-900 hover:bg-blue-50'
                            : 'bg-white border-neutral-200 text-neutral-900 hover:border-neutral-400 hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                      isDamaged ? 'bg-red-100' : 'bg-neutral-100'
                    }`}
                  >
                    <PartThumbnail
                      partId={part.id}
                      rotation={part.id === 'cpu' && !installed ? state.cpuRotation : 0}
                      className="w-10 h-10"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-sm font-semibold truncate">{part.shortName}</span>
                      {isDamaged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Part Rusak</span>
                        </span>
                      ) : installed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                      ) : null}
                    </div>
                    <p
                      className={`text-xs truncate mt-0.5 ${
                        isDamaged ? 'text-red-800 font-medium' : 'text-neutral-600'
                      }`}
                    >
                      {isDamaged ? damagedInfo?.label : modelLabel}
                    </p>
                    <p
                      className={`text-[11px] font-mono truncate mt-0.5 tabular-nums ${
                        isDamaged ? 'text-red-700' : 'text-neutral-500'
                      }`}
                    >
                      {isDamaged ? 'Perlu Penggantian (RMA)' : installed ? 'Terpasang' : specLabel}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onInspectPart(part.id)}
                  aria-label={`Lihat info edukasi ${part.name}`}
                  className="w-10 shrink-0 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <Info className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {isDamaged && (
                <button
                  type="button"
                  onClick={() => onReplaceDamagedPart(part.id)}
                  data-testid={`replace-part-${part.id}`}
                  className="min-h-10 w-full px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Ganti Part (RMA)</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-600 leading-snug pt-1 border-t border-neutral-200">
        Klik komponen lalu klik slot target 3D, atau seret langsung ke papan rakit.
      </p>
    </section>
  );
}

