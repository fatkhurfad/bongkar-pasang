/* Komponen pembungkus kanvas 3D WebGL (Three.js) realistis dengan dok kontrol bawah terpadu untuk kamera, kaca tempered, aliran udara 3D, mode terurai, warna casing, dan lampu RGB */

import {
  Camera,
  ChevronDown,
  ChevronUp,
  Layers,
  Monitor,
  Palette,
  Rotate3d,
  Shield,
  Sun,
  Wind,
} from 'lucide-react';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { PARTS_BY_ID, type PartId, type SlotId } from '../config';
import { hasPart, type AssemblyState } from '../lib/assemblyEngine';
import { MONITOR_OS_PROFILES, type MonitorOsId } from '../lib/monitorDisplay';
import {
  createWorkbench3DController,
  DEFAULT_SCENE_VISUAL_OPTIONS,
  type CameraPresetId,
  type CaseFinishId,
  type RgbThemeId,
  type SceneVisualOptions,
  type Workbench3DCallbacks,
  type Workbench3DController,
} from '../lib/workbench3dScene';

interface Workbench3DProps {
  state: AssemblyState;
  monitorOs: MonitorOsId;
  onChangeMonitorOs: (os: MonitorOsId) => void;
  isPostRunning: boolean;
  biosSummary: string;
  benchmarkScore: number;
  cpuLoadTempC: number;
  focusSetupSignal?: number;
  onSlotInteract: (slotId: SlotId, droppedPartId?: PartId) => void;
  onToggleCpuLatch: () => void;
  onTogglePsuSwitch: () => void;
  onRunPost: () => void;
}

const BENCH_CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: 'isometric', label: 'Isometrik' },
  { id: 'top', label: 'Atas' },
  { id: 'detail', label: 'Dekat' },
  { id: 'side', label: 'Samping' },
];

const CASE_CAMERA_PRESETS: { id: CameraPresetId; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'isometric', label: 'Casing' },
  { id: 'detail', label: 'Dekat' },
];

const CASE_FINISH_OPTIONS: { id: CaseFinishId; label: string; dotClass: string }[] = [
  { id: 'carbon', label: 'Karbon', dotClass: 'bg-slate-800 border-slate-500' },
  { id: 'white', label: 'Putih', dotClass: 'bg-slate-100 border-slate-400' },
  { id: 'titanium', label: 'Titanium', dotClass: 'bg-slate-500 border-slate-300' },
];

const RGB_THEME_OPTIONS: { id: RgbThemeId; label: string; dotClass: string }[] = [
  { id: 'blue', label: 'Biru', dotClass: 'bg-blue-500' },
  { id: 'cyan', label: 'Cyan', dotClass: 'bg-cyan-400' },
  { id: 'emerald', label: 'Hijau', dotClass: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber', dotClass: 'bg-amber-400' },
  { id: 'off', label: 'Mati', dotClass: 'bg-slate-700' },
];

export function Workbench3D({
  state,
  monitorOs,
  onChangeMonitorOs,
  isPostRunning,
  biosSummary,
  benchmarkScore,
  cpuLoadTempC,
  focusSetupSignal = 0,
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
  const [showStyleTools, setShowStyleTools] = useState(false);
  const [dragHover, setDragHover] = useState(false);
  const [visualOptions, setVisualOptions] = useState<SceneVisualOptions>({
    ...DEFAULT_SCENE_VISUAL_OPTIONS,
    monitorOs,
  });

  const callbacksRef = useRef<Workbench3DCallbacks>({
    onSlotInteract,
    onToggleCpuLatch,
    onTogglePsuSwitch,
    onRunPost,
    onHoverChange: setHoveredLabel,
    onMonitorScreenClick: () => setActivePreset('monitor'),
  });

  useEffect(() => {
    callbacksRef.current = {
      onSlotInteract,
      onToggleCpuLatch,
      onTogglePsuSwitch,
      onRunPost,
      onHoverChange: setHoveredLabel,
      onMonitorScreenClick: () => setActivePreset('monitor'),
    };
  }, [onSlotInteract, onToggleCpuLatch, onTogglePsuSwitch, onRunPost]);

  // Inisialisasi WebGLRenderer & adegan 3D sekali saja agar kamera tidak pernah ter-reset saat state React berubah
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const ctrl = createWorkbench3DController(container, state, callbacksRef, {
      ...visualOptions,
      monitorOs,
    });
    controllerRef.current = ctrl;
    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan perubahan komponen, status POST, & telemetri BIOS ke adegan 3D + layar monitor
  useEffect(() => {
    controllerRef.current?.syncState(state, {
      postRunning: isPostRunning,
      biosSummary,
      benchmarkScore,
      cpuLoadTempC,
    });
    if (state.phase === 'case' && state.fansSpinning && state.postResult?.passed) {
      setActivePreset((prev) => (prev === 'isometric' ? 'setup' : prev));
    }
  }, [state, isPostRunning, biosSummary, benchmarkScore, cpuLoadTempC]);

  // Sinkronkan opsi kustomisasi 3D + pilihan OS Monitor (Windows / macOS)
  useEffect(() => {
    controllerRef.current?.setVisualOptions({
      ...visualOptions,
      monitorOs,
    });
  }, [visualOptions, monitorOs]);

  // Saat pengguna klik "Lihat PC 3D Menyala", arahkan kamera ke sudut Setup penuh (Monitor + Periferal + PC)
  useEffect(() => {
    if (focusSetupSignal > 0 && state.phase === 'case') {
      setActivePreset('setup');
      controllerRef.current?.setCameraPreset('setup');
    }
  }, [focusSetupSignal, state.phase]);

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

  const cpuInstalled = hasPart(state, 'cpu');
  const pasteApplied = hasPart(state, 'thermal_paste');
  const coolerInstalled = hasPart(state, 'cpu_cooler');
  const moboInstalled = hasPart(state, 'motherboard');
  const gpuInstalled = hasPart(state, 'gpu');

  const cameraPresets = state.phase === 'case' ? CASE_CAMERA_PRESETS : BENCH_CAMERA_PRESETS;
  const activeOsProfile = MONITOR_OS_PROFILES[monitorOs];

  const quickSlots: { label: string; ariaLabel: string; onClick: () => void }[] =
    state.phase === 'bench'
      ? [
          {
            label: !cpuInstalled ? 'Soket CPU' : !pasteApplied ? 'Permukaan CPU' : 'Dudukan Cooler',
            ariaLabel: !cpuInstalled
              ? 'Soket CPU LGA1700 — Pasang Prosesor'
              : !pasteApplied
                ? 'Permukaan Logam CPU (IHS) — Oleskan Pasta Termal'
                : 'Dudukan Pendingin CPU — Pasang Pendingin',
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
                  ariaLabel: 'Ruang PSU bawah casing, klik untuk memasang PSU',
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
          hasPart(state, 'cable_8pin_gpu') &&
          !state.postResult?.passed
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
      data-powered-on={state.fansSpinning && state.phase === 'case' ? 'true' : 'false'}
      data-monitor-os={monitorOs}
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
        <span>
          {hoveredLabel ??
            (state.fansSpinning && state.phase === 'case'
              ? `Semua Menyala · ${activeOsProfile.shortLabel} + RGB Aktif`
              : 'Seret putar 3D · Gulir zoom · Klik slot')}
        </span>
      </div>

      {/* Dok Kontrol Bawah Terpadu yang dapat dilipat (zero viewport occlusion) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[96%] max-w-[660px] flex flex-col items-center gap-1 pointer-events-none">
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
          <div className="pointer-events-auto w-full rounded-xl bg-slate-950/95 border border-slate-700 px-2.5 py-2 flex flex-col gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_20px_rgba(0,0,0,0.35)]">
            {/* Baris 1: Kamera, Pengalih OS Monitor (Windows / macOS), Slot Cepat, dan Studio 3D */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1" role="group" aria-label="Preset kamera 3D">
                <Camera className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0" aria-hidden="true" />
                {cameraPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`camera-preset-${preset.id}`}
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

              {state.phase === 'case' && (
                <div
                  className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-700 p-0.5"
                  role="group"
                  aria-label="Pilih Sistem Operasi Monitor"
                >
                  <Monitor className="w-3 h-3 text-slate-400 ml-1 mr-0.5 shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    data-testid="os-switch-windows"
                    aria-pressed={monitorOs === 'windows'}
                    onClick={() => onChangeMonitorOs('windows')}
                    className={`min-h-6 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                      monitorOs === 'windows'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Windows 11
                  </button>
                  <button
                    type="button"
                    data-testid="os-switch-macos"
                    aria-pressed={monitorOs === 'macos'}
                    onClick={() => onChangeMonitorOs('macos')}
                    className={`min-h-6 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                      monitorOs === 'macos'
                        ? 'bg-violet-700 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    macOS
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1">
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

                <button
                  type="button"
                  onClick={() => setShowStyleTools((prev) => !prev)}
                  aria-expanded={showStyleTools}
                  data-testid="toggle-3d-studio-tools"
                  className={`min-h-7 px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                    showStyleTools
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Palette className="w-3 h-3" aria-hidden="true" />
                  <span>Studio 3D</span>
                </button>
              </div>
            </div>

            {/* Baris 2 (Opsional): Mode Terurai, Kaca Tempered, Aliran Udara, Tema Casing, Lampu & RGB */}
            {showStyleTools && (
              <div className="border-t border-slate-800 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                {/* Slider Tampilan Terurai (Exploded View) */}
                <label className="flex items-center gap-1.5 min-w-[140px]">
                  <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">Terurai</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(visualOptions.explodedAmount * 100)}
                    onChange={(e) =>
                      setVisualOptions((prev) => ({
                        ...prev,
                        explodedAmount: Number(e.target.value) / 100,
                      }))
                    }
                    aria-label="Jarak tampilan terurai komponen 3D"
                    className="w-20 accent-blue-500 cursor-pointer"
                  />
                </label>

                {/* Tombol Kaca Tempered, Airflow 3D, dan Pencahayaan Studio */}
                <div className="flex flex-wrap items-center gap-1">
                  {state.phase === 'case' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setVisualOptions((prev) => ({
                            ...prev,
                            glassPanelClosed: !prev.glassPanelClosed,
                          }))
                        }
                        aria-pressed={visualOptions.glassPanelClosed}
                        className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                          visualOptions.glassPanelClosed
                            ? 'bg-blue-700 border-blue-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Shield className="w-3 h-3" aria-hidden="true" />
                        <span>{visualOptions.glassPanelClosed ? 'Kaca: Tutup' : 'Kaca: Buka'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setVisualOptions((prev) => ({
                            ...prev,
                            showAirflow: !prev.showAirflow,
                          }))
                        }
                        aria-pressed={visualOptions.showAirflow}
                        className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                          visualOptions.showAirflow
                            ? 'bg-sky-700 border-sky-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Wind className="w-3 h-3" aria-hidden="true" />
                        <span>Aliran Udara</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setVisualOptions((prev) => ({
                        ...prev,
                        studioLight: prev.studioLight === 'studio' ? 'dark_rgb' : 'studio',
                      }))
                    }
                    className={`px-2 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${
                      visualOptions.studioLight === 'dark_rgb'
                        ? 'bg-indigo-700 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Sun className="w-3 h-3" aria-hidden="true" />
                    <span>{visualOptions.studioLight === 'studio' ? 'Lampu Terang' : 'Mode RGB'}</span>
                  </button>
                </div>

                {/* Pilihan Warna Casing & RGB */}
                <div className="flex flex-wrap items-center gap-2">
                  {state.phase === 'case' && (
                    <div className="flex items-center gap-1" role="group" aria-label="Warna casing">
                      <span className="text-slate-400">Casing:</span>
                      {CASE_FINISH_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          title={`Casing ${opt.label}`}
                          aria-label={`Warna casing ${opt.label}`}
                          aria-pressed={visualOptions.caseFinish === opt.id}
                          onClick={() =>
                            setVisualOptions((prev) => ({ ...prev, caseFinish: opt.id }))
                          }
                          className={`w-5 h-5 rounded-full border ${opt.dotClass} ${
                            visualOptions.caseFinish === opt.id ? 'ring-2 ring-sky-400' : ''
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1" role="group" aria-label="Warna lampu RGB">
                    <span className="text-slate-400">RGB:</span>
                    {RGB_THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        title={`RGB ${opt.label}`}
                        aria-label={`Lampu RGB ${opt.label}`}
                        aria-pressed={visualOptions.rgbTheme === opt.id}
                        onClick={() => setVisualOptions((prev) => ({ ...prev, rgbTheme: opt.id }))}
                        className={`w-4 h-4 rounded-full border border-white/25 ${opt.dotClass} ${
                          visualOptions.rgbTheme === opt.id ? 'ring-2 ring-white' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
