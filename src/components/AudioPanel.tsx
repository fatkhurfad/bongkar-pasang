/* Panel manajemen suara untuk mengatur volume multi-kanal dan menguji variasi efek suara tiap komponen */

import { Play, Volume2, VolumeX, X } from 'lucide-react';
import {
  COMPONENT_SOUND_PROFILES,
  type SoundEvent,
  type SoundSettings,
} from '../lib/soundSettings';
import { formatPercent } from '../lib/formatters';

interface AudioPanelModalProps {
  settings: SoundSettings;
  onChangeSettings: (next: SoundSettings) => void;
  onPreviewSound: (event: SoundEvent) => void;
  onClose: () => void;
}

export function AudioPanelModal({
  settings,
  onChangeSettings,
  onPreviewSound,
  onClose,
}: AudioPanelModalProps) {
  const updateField = <K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-panel-title"
      className="fixed inset-0 z-50 bg-neutral-950/55 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.14)] flex flex-col gap-5 my-auto">
        {/* Header panel suara */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="audio-panel-title" className="text-lg font-semibold text-neutral-900">
              Manajemen Suara Simulasi
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Atur volume per kanal dan dengarkan variasi bunyi mekanis setiap komponen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan suara"
            className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Kontrol volume multi-kanal */}
        <div className="space-y-4 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-neutral-900">Status Audio</span>
            <button
              type="button"
              onClick={() => updateField('muted', !settings.muted)}
              aria-pressed={settings.muted}
              className={`min-h-10 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                settings.muted
                  ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {settings.muted ? (
                <>
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                  <span>Suara Dibisukan</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  <span>Audio Aktif</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {/* Slider Volume Utama */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-master-vol" className="font-semibold text-neutral-800">
                  Volume Utama
                </label>
                <span className="font-mono font-semibold text-neutral-700 tabular-nums">
                  {formatPercent(settings.masterVolume)}
                </span>
              </div>
              <input
                id="slider-master-vol"
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.masterVolume}
                disabled={settings.muted}
                onChange={(e) => updateField('masterVolume', Number(e.target.value))}
                className="w-full accent-blue-700 h-2 bg-neutral-200 rounded-lg cursor-pointer disabled:opacity-45"
              />
            </div>

            {/* Slider Efek Pemasangan */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-sfx-vol" className="font-semibold text-neutral-800">
                  Efek Pemasangan &amp; Mekanis
                </label>
                <span className="font-mono font-semibold text-neutral-700 tabular-nums">
                  {formatPercent(settings.sfxVolume)}
                </span>
              </div>
              <input
                id="slider-sfx-vol"
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.sfxVolume}
                disabled={settings.muted}
                onChange={(e) => updateField('sfxVolume', Number(e.target.value))}
                className="w-full accent-blue-700 h-2 bg-neutral-200 rounded-lg cursor-pointer disabled:opacity-45"
              />
            </div>

            {/* Slider Dengung Kipas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-ambient-vol" className="font-semibold text-neutral-800">
                  Dengung Kipas Casing (Saat POST)
                </label>
                <span className="font-mono font-semibold text-neutral-700 tabular-nums">
                  {formatPercent(settings.ambientVolume)}
                </span>
              </div>
              <input
                id="slider-ambient-vol"
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.ambientVolume}
                disabled={settings.muted}
                onChange={(e) => updateField('ambientVolume', Number(e.target.value))}
                className="w-full accent-blue-700 h-2 bg-neutral-200 rounded-lg cursor-pointer disabled:opacity-45"
              />
            </div>
          </div>
        </div>

        {/* Uji variasi profil suara setiap komponen */}
        <div className="border-t border-neutral-200 pt-4 space-y-2.5">
          <p className="text-sm font-semibold text-neutral-900">Uji Variasi Suara Komponen</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {COMPONENT_SOUND_PROFILES.map((profile) => (
              <button
                key={profile.event}
                type="button"
                disabled={settings.muted}
                onClick={() => onPreviewSound(profile.event)}
                aria-label={`Uji suara ${profile.label}: ${profile.acousticNote}`}
                className="min-h-12 text-left rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-blue-50 hover:border-blue-300 px-3 py-2 flex items-center justify-between gap-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 truncate">{profile.label}</p>
                  <p className="text-[11px] text-neutral-600 leading-snug mt-0.5">
                    {profile.acousticNote}
                  </p>
                </div>
                <Play className="w-3.5 h-3.5 text-blue-700 shrink-0 fill-current" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
