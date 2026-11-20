/* Komponen pembungkus kanvas 3D WebGL (Three.js) dengan dok kontrol kamera bawah yang dapat dilipat dan dukungan seret-lepas */

import { Camera, ChevronDown, ChevronUp, Rotate3d } from 'lucide-react';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PARTS_BY_ID, type PartId, type SlotId } from '../config';
import { hasPart, type AssemblyState } from '../lib/assemblyEngine';
import {
  createWorkbench3DController,
  type CameraPresetId,
  type Workbench3DCallbacks,
  type Workbench3DController,
} from '../lib/workbench3dScene';

interface Workbench3DProps {
  state: AssemblyState;
  onSlotInteract: (slotId: SlotId, droppedPartId?: PartId) => void;
  onToggleCpuLatch: () => void;
  onTogglePsuSwitch: () => void;
  onRunPost: () => void;
}

const CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: 'isometric', label: 'Isometrik' },
  { id: 'top', label: 'Depan / Atas' },
  { id: 'detail', label: 'Dekat' },
];

export function Workbench3D({
  state,
  onSlotInteract,
  onToggleCpuLatch,
  onTogglePsuSwitch,
  onRunPost,
}: Workbench3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Workbench3DController | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPresetId>('isometric');
  const [dockExpanded, setDockExpanded] = useState(true);
  const [dragHover, setDragHover] = useState(false);

  const callbacksRef = useRef<Workbench3DCallbacks>({
    onSlotInteract,
    onToggleCpuLatch,
    onTogglePsuSwitch,
    onRunPost,
    onHoverChange: setHoveredLabel,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSlotInteract,
      onToggleCpuLatch,
      onTogglePsuSwitch,
      onRunPost,
      onHoverChange: setHoveredLabel,
    };
  }, [onSlotInteract, onToggleCpuLatch, onTogglePsuSwitch, onRunPost]);

  // Inisialisasi WebGLRenderer & adegan 3D sekali saja agar kamera tidak pernah ter-reset saat state React berubah
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const ctrl = createWorkbench3DController(container, state, callbacksRef);
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan perubahan komponen & status kerusakan ke adegan 3D
  useEffect(() => {
    controllerRef.current?.syncState(state);
  }, [state]);

  const handleCameraPreset = (preset: CameraPresetId) => {
    setActivePreset(preset);
    controllerRef.current?.setCameraPreset(preset);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!dragHover) setDragHover(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragHover(false);
    const rawPart = event.dataTransfer.getData('text/plain') as PartId;
    const partId = rawPart && PARTS_BY_ID[rawPart] ? rawPart : state.selectedPart;
    if (partId) {
      controllerRef.current?.handleExternalDrop(event.clientX, event.clientY, partId);
    }
  };

  // Daftar tombol slot cepat aksesibel sesuai fase aktif (untuk keyboard & layar sentuh)
  const cpuInstalled = hasPart(state, 'cpu');
  const pasteApplied = hasPart(state, 'thermal_paste');
  const coolerInstalled = hasPart(state, 'cpu_cooler');
  const moboInstalled = hasPart(state, 'motherboard');
  const gpuInstalled = hasPart(state, 'gpu');

  const quickSlots: { label: string; ariaLabel: string; onClick: () => void }[] =
    state.phase === 'bench'
      ? [
          {
            label: !cpuInstalled ? 'Soket CPU' : !pasteApplied ? 'Permukaan CPU' : 'Dudukan Cooler',
            ariaLabel: !cpuInstalled
              ? 'Soket CPU LGA1700 — Pasang Prosesor'
              : !pasteApplied
                ? 'Permukaan Logam CPU (IHS) — Oleskan Pasta Termal'
                : 'Dudukan Pendingin CPU — Pasang Air Cooler',
            onClick: () =>
              onSlotInteract(
                !cpuInstalled ? 'socket_cpu' : !pasteApplied ? 'cpu_ihs' : 'cooler_mount',
              ),
          },
          {
            label: 'RAM A2',
            ariaLabel: 'Slot RAM A2 kosong, klik untuk pasang RAM',
            onClick: () => onSlotInteract('dimm_a2'),
          },
          {
            label: 'RAM B2',
            ariaLabel: 'Slot RAM B2 kosong, klik untuk pasang RAM',
            onClick: () => onSlotInteract('dimm_b2'),
          },
          {
            label: 'M.2 NVMe',
            ariaLabel: 'Slot M.2 NVMe kosong, klik untuk pasang SSD',
            onClick: () => onSlotInteract('m2_slot'),
          },
        ]
      : [
          ...(!hasPart(state, 'psu')
            ? [
                {
                  label: 'PSU',
                  ariaLabel: 'Ruang PSU bawah casing, klik untuk memasang PSU 650 W',
                  onClick: () => onSlotInteract('psu_bay'),
                },
              ]
            : []),
          ...(!moboInstalled
            ? [
                {
                  label: 'Standoff',
                  ariaLabel: 'Area 9 standoff casing kosong, klik untuk memasang Motherboard Terakit',
                  onClick: () => onSlotInteract('case_standoffs'),
                },
              ]
            : []),
          ...(moboInstalled && !gpuInstalled
            ? [
                {
                  label: 'PCIe x16',
                  ariaLabel: 'Slot PCIe 4.0 x16 kosong, klik untuk memasang Kartu Grafis GPU',
                  onClick: () => onSlotInteract('pcie_x16'),
                },
              ]
            : []),
          ...(moboInstalled && !hasPart(state, 'cable_24pin')
            ? [
                {
                  label: '24-Pin',
                  ariaLabel: 'Header ATX 24-Pin motherboard, klik untuk mencolokkan kabel 24-Pin',
                  onClick: () => onSlotInteract('header_24pin'),
                },
              ]
            : []),
          ...(moboInstalled && !hasPart(state, 'cable_8pin_cpu')
            ? [
                {
                  label: '8-Pin CPU',
                  ariaLabel: 'Header EPS 8-Pin CPU, klik untuk mencolokkan kabel 8-Pin CPU',
                  onClick: () => onSlotInteract('header_8pin_cpu'),
                },
              ]
            : []),
          ...(gpuInstalled && !hasPart(state, 'cable_8pin_gpu')
            ? [
                {
                  label: '8-Pin GPU',
                  ariaLabel: 'Port daya 8-Pin GPU, klik untuk mencolokkan kabel 8-Pin GPU',
                  onClick: () => onSlotInteract('gpu_power_8pin'),
                },
              ]
            : []),
          ...(hasPart(state, 'cable_24pin') &&
          hasPart(state, 'cable_8pin_cpu') &&
          hasPart(state, 'cable_8pin_gpu')
            ? [
                {
                  label: 'Power POST',
                  ariaLabel: 'Tombol Power Casing — tekan untuk menjalankan uji nyala POST',
                  onClick: onRunPost,
                },
              ]
            : []),
        ];

  return (
    <div
      data-testid="workbench-3d-stage"
      onDragOver={handleDragOver}
      onDragLeave={() => setDragHover(false)}
      onDrop={handleDrop}
      className={`relative w-full aspect-[680/480] rounded-xl overflow-hidden border bg-slate-900 select-none ${
        dragHover ? 'border-blue-400 ring-2 ring-blue-400/60' : 'border-slate-300'
      }`}
    >
      {/* Kontainer WebGL terisolasi tanpa elemen React anak di dalamnya */}
      <div
        ref={mountRef}
        data-testid="workbench-3d-canvas"
        aria-label="Kanvas 3D Interaktif Perakitan Komputer — seret untuk memutar sudut pandang"
        className="w-full h-full"
      />

      {/* Lencana info sudut kiri atas (bebas halangan tengah & tanpa backdrop-blur) */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-slate-950/90 border border-slate-700 px-2.5 py-1 text-[11px] font-mono text-slate-200">
        <Rotate3d className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
        <span>{hoveredLabel ?? 'Seret untuk putar 3D · Gulir untuk zoom · Klik slot'}</span>
      </div>

      {/* Dok Kontrol Bawah Terpadu yang dapat dilipat (zero viewport occlusion) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[96%] max-w-[620px] flex flex-col items-center gap-1 pointer-events-none">
        <button
          type="button"
          onClick={() => setDockExpanded((prev) => !prev)}
          aria-expanded={dockExpanded}
          className="pointer-events-auto px-2.5 py-0.5 rounded-t-lg bg-slate-950/95 border border-b-0 border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          {dockExpanded ? (
            <>
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
              <span>Sembunyikan Dok 3D</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3 h-3" aria-hidden="true" />
              <span>Tampilkan Dok 3D</span>
            </>
          )}
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto w-full rounded-xl bg-slate-950/95 border border-slate-700 px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_20px_rgba(0,0,0,0.35)]">
            {/* Preset Kamera 3D */}
            <div className="flex items-center gap-1" role="group" aria-label="Preset kamera 3D">
              <Camera className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0" aria-hidden="true" />
              {CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleCameraPreset(preset.id)}
                  aria-pressed={activePreset === preset.id}
                  className={`min-h-7 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                    activePreset === preset.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Akses cepat slot target aktif (mendukung klik 1-ketuk & keyboard) */}
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Slot target aktif">
              {quickSlots.map((slot) => (
                <button
                  key={slot.label}
                  type="button"
                  onClick={slot.onClick}
                  aria-label={slot.ariaLabel}
                  disabled={state.phase === 'bench' && coolerInstalled && slot.label === 'Dudukan Cooler'}
                  className="min-h-7 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-sky-500 text-[11px] font-mono text-slate-200 transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
