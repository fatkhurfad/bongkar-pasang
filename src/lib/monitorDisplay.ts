/* Logika murni status layar monitor 3D, periferal RGB (keyboard & mouse), dan profil OS Windows 11 / macOS */

export type MonitorOsId = 'windows' | 'macos';

export type MonitorScreenMode = 'off' | 'standby' | 'post' | 'error' | 'desktop';

export interface MonitorOsProfile {
  id: MonitorOsId;
  shortLabel: string;
  fullName: string;
  bootLoaderLabel: string;
  accentHex: string;
  screenGlowHex: number;
}

export const MONITOR_OS_PROFILES: Record<MonitorOsId, MonitorOsProfile> = {
  windows: {
    id: 'windows',
    shortLabel: 'Windows 11',
    fullName: 'Windows 11 Pro 24H2',
    bootLoaderLabel: 'UEFI Windows Boot Manager',
    accentHex: '#38bdf8',
    screenGlowHex: 0x2563eb,
  },
  macos: {
    id: 'macos',
    shortLabel: 'macOS',
    fullName: 'macOS Sequoia 15',
    bootLoaderLabel: 'OpenCore EFI Bootloader',
    accentHex: '#c084fc',
    screenGlowHex: 0x7c3aed,
  },
};

export interface MonitorDisplayInput {
  phase: 'bench' | 'case';
  psuSwitchOn: boolean;
  fansSpinning: boolean;
  postRunning: boolean;
  postPassed: boolean | null;
  faultLed: string | null;
  osId: MonitorOsId;
}

export interface MonitorDisplayState {
  mode: MonitorScreenMode;
  osId: MonitorOsId;
  isScreenLit: boolean;
  isPeripheralsLit: boolean;
  screenEmissiveIntensity: number;
  monitorLightIntensity: number;
  monitorGlowColorHex: number;
  deskGlowOpacity: number;
  statusLedHex: number;
  statusLabel: string;
}

/**
 * Menentukan status layar monitor 3D, warna cahaya pantulan layar, LED status,
 * dan nyala lampu periferal (keyboard & mouse RGB) berdasarkan kondisi PC.
 */
export function resolveMonitorDisplayState(input: MonitorDisplayInput): MonitorDisplayState {
  const osProfile = MONITOR_OS_PROFILES[input.osId];

  // Di tahap meja motherboard atau saat casing mati total
  if (input.phase !== 'case') {
    return {
      mode: 'off',
      osId: input.osId,
      isScreenLit: false,
      isPeripheralsLit: false,
      screenEmissiveIntensity: 0,
      monitorLightIntensity: 0,
      monitorGlowColorHex: 0x0f172a,
      deskGlowOpacity: 0,
      statusLedHex: 0x1e293b,
      statusLabel: 'Monitor Nonaktif (Tahap Meja Rakit)',
    };
  }

  // Sedang menjalankan uji POST terminal
  if (input.postRunning) {
    return {
      mode: 'post',
      osId: input.osId,
      isScreenLit: true,
      isPeripheralsLit: true,
      screenEmissiveIntensity: 1.18,
      monitorLightIntensity: 2.4,
      monitorGlowColorHex: 0x0ea5e9,
      deskGlowOpacity: 0.42,
      statusLedHex: 0x10b981,
      statusLabel: `POST Aktif · Menyiapkan ${osProfile.shortLabel}`,
    };
  }

  // POST gagal setelah dicoba nyalakan
  if (input.postPassed === false && input.psuSwitchOn) {
    return {
      mode: 'error',
      osId: input.osId,
      isScreenLit: true,
      isPeripheralsLit: false,
      screenEmissiveIntensity: 0.95,
      monitorLightIntensity: 1.4,
      monitorGlowColorHex: 0xef4444,
      deskGlowOpacity: 0.28,
      statusLedHex: 0xef4444,
      statusLabel: input.faultLed
        ? `Monitor: Sinyal Terhenti (POST LED ${input.faultLed})`
        : 'Monitor: Gangguan POST Terdeteksi',
    };
  }

  // PC menyala & lulus POST -> seluruh monitor + desktop Windows/macOS + keyboard & mouse RGB menyala penuh!
  if (input.fansSpinning && input.postPassed === true) {
    return {
      mode: 'desktop',
      osId: input.osId,
      isScreenLit: true,
      isPeripheralsLit: true,
      screenEmissiveIntensity: 1.38,
      monitorLightIntensity: 3.1,
      monitorGlowColorHex: osProfile.screenGlowHex,
      deskGlowOpacity: 0.54,
      statusLedHex: 0x10b981,
      statusLabel: `Monitor Menyala · ${osProfile.fullName}`,
    };
  }

  // Sakelar PSU sudah ON, menunggu tombol Power ditekan -> monitor standby halus
  if (input.psuSwitchOn) {
    return {
      mode: 'standby',
      osId: input.osId,
      isScreenLit: true,
      isPeripheralsLit: false,
      screenEmissiveIntensity: 0.28,
      monitorLightIntensity: 0.35,
      monitorGlowColorHex: 0x38bdf8,
      deskGlowOpacity: 0.08,
      statusLedHex: 0xf59e0b,
      statusLabel: 'Monitor Siaga (Menunggu Sinyal GPU)',
    };
  }

  return {
    mode: 'off',
    osId: input.osId,
    isScreenLit: false,
    isPeripheralsLit: false,
    screenEmissiveIntensity: 0,
    monitorLightIntensity: 0,
    monitorGlowColorHex: 0x0f172a,
    deskGlowOpacity: 0,
    statusLedHex: 0x1e293b,
    statusLabel: 'Monitor Mati (Nyalakan PSU & PC)',
  };
}
