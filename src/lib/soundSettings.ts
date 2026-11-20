/* Konfigurasi profil suara per komponen, kalkulasi gain mixer, dan penyimpanan pengaturan audio lokal */

import type { PartId } from '../config';

export type SoundEvent =
  | 'select'
  | 'rotate'
  | 'latch_open'
  | 'latch_close'
  | 'psu_switch_on'
  | 'psu_switch_off'
  | 'install_cpu'
  | 'install_thermal_paste'
  | 'install_cpu_cooler'
  | 'install_ram'
  | 'install_ssd_nvme'
  | 'install_psu'
  | 'install_motherboard'
  | 'install_gpu'
  | 'install_cable_24pin'
  | 'install_cable_8pin_cpu'
  | 'install_cable_8pin_gpu'
  | 'error'
  | 'part_damaged'
  | 'part_repaired'
  | 'shop_buy'
  | 'shop_sell'
  | 'post_tick'
  | 'post_ok'
  | 'post_fail';

export interface SoundSettings {
  masterVolume: number; // 0 - 100
  sfxVolume: number; // 0 - 100
  ambientVolume: number; // 0 - 100
  muted: boolean;
}

export interface ComponentSoundProfile {
  event: SoundEvent;
  label: string;
  acousticNote: string;
}

export const AUDIO_STORAGE_KEY = 'rakitpc_lab_audio_v1';

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 80,
  sfxVolume: 90,
  ambientVolume: 65,
  muted: false,
};

export const PART_SOUND_EVENT_MAP: Record<PartId, SoundEvent> = {
  cpu: 'install_cpu',
  thermal_paste: 'install_thermal_paste',
  cpu_cooler: 'install_cpu_cooler',
  ram_a2: 'install_ram',
  ram_b2: 'install_ram',
  ssd_nvme: 'install_ssd_nvme',
  psu: 'install_psu',
  motherboard: 'install_motherboard',
  gpu: 'install_gpu',
  cable_24pin: 'install_cable_24pin',
  cable_8pin_cpu: 'install_cable_8pin_cpu',
  cable_8pin_gpu: 'install_cable_8pin_gpu',
};

export const COMPONENT_SOUND_PROFILES: ComponentSoundProfile[] = [
  {
    event: 'install_cpu',
    label: 'Prosesor (CPU)',
    acousticNote: 'Ketukan logam halus presisi di soket pin emas',
  },
  {
    event: 'install_thermal_paste',
    label: 'Pasta Termal',
    acousticNote: 'Tekanan lembut pasta kental dari suntikan',
  },
  {
    event: 'install_cpu_cooler',
    label: 'Pendingin CPU (Heatsink)',
    acousticNote: 'Desis kontak termal diikuti kunci baut logam',
  },
  {
    event: 'install_ram',
    label: 'RAM DDR5',
    acousticNote: 'Klik halus ganda saat pengait DIMM mengunci',
  },
  {
    event: 'install_ssd_nvme',
    label: 'SSD NVMe M.2',
    acousticNote: 'Gesekan halus slot M.2 dan kencangan baut mikro',
  },
  {
    event: 'install_psu',
    label: 'Power Supply (PSU)',
    acousticNote: 'Hentakan rendah mantap pada sasis baja bawah',
  },
  {
    event: 'install_motherboard',
    label: 'Motherboard ATX',
    acousticNote: 'Dudukan papan sirkuit pada 9 standoff kuningan',
  },
  {
    event: 'install_gpu',
    label: 'Kartu Grafis (GPU)',
    acousticNote: 'Dorongan kokoh diikuti klik kuat kait PCIe x16',
  },
  {
    event: 'install_cable_24pin',
    label: 'Kabel ATX 24-Pin',
    acousticNote: 'Colokan padat konektor lebar & pengait samping',
  },
  {
    event: 'install_cable_8pin_cpu',
    label: 'Kabel 8-Pin CPU / GPU',
    acousticNote: 'Klik ringkas klip nilon konektor daya 8-pin',
  },
];

const SOUND_DESCRIPTION_BY_EVENT: Partial<Record<SoundEvent, string>> = {
  latch_open: 'Tuas soket LGA1700 terbuka',
  latch_close: 'Tuas soket LGA1700 terkunci rapat',
  psu_switch_on: 'Sakelar daya PSU klik ke posisi ON',
  psu_switch_off: 'Sakelar daya PSU klik ke posisi OFF',
  install_cpu: 'Ketukan halus presisi CPU pada soket LGA1700',
  install_thermal_paste: 'Tekanan lembut pasta termal di permukaan IHS',
  install_cpu_cooler: 'Desis kontak termal heatsink & kunci baut braket',
  install_ram: 'Klik halus ganda klip pengunci slot RAM',
  install_ssd_nvme: 'Gesekan slot M.2 & klik baut penahan NVMe',
  install_psu: 'Hentakan mantap PSU pada kompartemen bawah',
  install_motherboard: 'Dudukan motherboard di atas 9 standoff kuningan',
  install_gpu: 'Klik kokoh kartu grafis pada kait PCIe x16',
  install_cable_24pin: 'Colokan rapat kabel daya utama 24-Pin ATX',
  install_cable_8pin_cpu: 'Klik klip konektor daya EPS 8-Pin CPU',
  install_cable_8pin_gpu: 'Klik klip konektor daya PCIe 8-Pin GPU',
  part_damaged: 'Peringatan kerusakan komponen (bunyi retak / percikan ESD)',
  part_repaired: 'Penggantian unit komponen baru (RMA) selesai',
  shop_buy: 'Pembelian modul perangkat keras baru dari Toko Komponen',
  shop_sell: 'Pengembalian modul ke Toko Komponen (refund saldo)',
  post_ok: '1 Beep POST normal & kipas mulai berputar halus',
  post_fail: 'Pola beep peringatan diagnostik POST',
};

export function getPartSoundEvent(partId: PartId): SoundEvent {
  return PART_SOUND_EVENT_MAP[partId];
}

export function getSoundAcousticCue(event: SoundEvent): string | null {
  return SOUND_DESCRIPTION_BY_EVENT[event] ?? null;
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeEffectiveGain(
  masterVolume: number,
  channelVolume: number,
  muted: boolean,
): number {
  if (muted) return 0;
  const master = clampVolume(masterVolume) / 100;
  const channel = clampVolume(channelVolume) / 100;
  return Number((master * channel).toFixed(4));
}

export function normalizeSoundSettings(raw: Partial<SoundSettings> | null | undefined): SoundSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SOUND_SETTINGS };
  return {
    masterVolume:
      typeof raw.masterVolume === 'number'
        ? clampVolume(raw.masterVolume)
        : DEFAULT_SOUND_SETTINGS.masterVolume,
    sfxVolume:
      typeof raw.sfxVolume === 'number'
        ? clampVolume(raw.sfxVolume)
        : DEFAULT_SOUND_SETTINGS.sfxVolume,
    ambientVolume:
      typeof raw.ambientVolume === 'number'
        ? clampVolume(raw.ambientVolume)
        : DEFAULT_SOUND_SETTINGS.ambientVolume,
    muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULT_SOUND_SETTINGS.muted,
  };
}

export function loadSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    return normalizeSoundSettings(JSON.parse(raw) as Partial<SoundSettings>);
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalizeSoundSettings(settings)));
  } catch {
    // Abaikan jika penyimpanan lokal tidak tersedia
  }
}
