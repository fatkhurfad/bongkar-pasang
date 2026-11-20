/* Kalkulasi murni sistem pencahayaan dinamis meja kerja 3D dan pantulan cahaya RGB komponen saat PC menyala */

export type LightingCasePhase = 'bench' | 'case';
export type LightingStudioMode = 'studio' | 'dark_rgb';
export type LightingRgbTheme = 'blue' | 'cyan' | 'emerald' | 'amber' | 'off';

export interface DynamicLightingInput {
  phase: LightingCasePhase;
  studioLight: LightingStudioMode;
  rgbTheme: LightingRgbTheme;
  isPcPoweredOn: boolean;
  glassPanelClosed: boolean;
  /** Nilai transisi halus 0..1 dari kondisi mati ke menyala */
  powerBlend: number;
  /** Sudut fase radian untuk denyut cahaya RGB halus saat menyala */
  pulsePhase: number;
}

export interface DynamicLightingRigState {
  roomDimFactor: number;
  bgColorHex: number;
  keyLightIntensity: number;
  hemiLightIntensity: number;
  rimLightIntensity: number;
  softboxIntensity: number;
  toneMappingExposure: number;
  rgbEmissiveIntensity: number;
  interiorRgbLightIntensity: number;
  deskBounceLightIntensity: number;
  frontFanSpillLightIntensity: number;
  deskReflectionOpacity: number;
  frontReflectionOpacity: number;
  rgbActive: boolean;
}

export const RGB_THEME_COLORS: Record<LightingRgbTheme, number> = {
  blue: 0x3b82f6,
  cyan: 0x06b6d4,
  emerald: 0x10b981,
  amber: 0xf59e0b,
  off: 0x1e293b,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpHexColor(hexA: number, hexB: number, t: number): number {
  const ct = clamp01(t);
  const rA = (hexA >> 16) & 0xff;
  const gA = (hexA >> 8) & 0xff;
  const bA = hexA & 0xff;

  const rB = (hexB >> 16) & 0xff;
  const gB = (hexB >> 8) & 0xff;
  const bB = hexB & 0xff;

  const r = Math.round(lerp(rA, rB, ct));
  const g = Math.round(lerp(gA, gB, ct));
  const b = Math.round(lerp(bA, bB, ct));
  return (r << 16) | (g << 8) | b;
}

/**
 * Menghitung intensitas lampu studio, peredupan suasana ruangan, dan pantulan cahaya RGB
 * dari kipas, RAM, GPU, serta pendingin AIO ke permukaan meja 3D.
 */
export function computeDynamicLightingRig(input: DynamicLightingInput): DynamicLightingRigState {
  const inCase = input.phase === 'case';
  const isDarkPreset = input.studioLight === 'dark_rgb';
  const rgbEnabled = input.rgbTheme !== 'off';
  const power = inCase ? clamp01(input.powerBlend) : 0;

  // Peredupan ruangan: studio terang (0) -> sedikit redup saat PC menyala (~0.55) -> gelap penuh di Mode RGB (1.0)
  const baseDim = isDarkPreset ? 0.85 : 0;
  const powerDimBoost = isDarkPreset ? 0.15 : 0.56;
  const roomDimFactor = clamp01(baseDim + power * powerDimBoost);

  // Latar belakang & kabut ruang bengkel meredup mulus saat PC menyala
  const bgColorHex = lerpHexColor(0x0d1626, 0x050914, roomDimFactor);

  // Lampu utama & langit-langit sedikit meredup agar pendar RGB dari komponen tampak realistis
  const keyLightIntensity = Number(lerp(1.95, 0.96, roomDimFactor).toFixed(3));
  const hemiLightIntensity = Number(lerp(0.92, 0.42, roomDimFactor).toFixed(3));
  const rimLightIntensity = Number(lerp(0.8, 1.12, roomDimFactor).toFixed(3));
  const softboxIntensity = Number(lerp(2.4, 1.0, roomDimFactor).toFixed(3));
  const toneMappingExposure = Number(lerp(1.12, 1.04, roomDimFactor).toFixed(3));

  // Kekuatan pendar RGB: aktif penuh saat PC menyala (POST/beroperasi) atau pratinjau Mode RGB gelap
  const rgbPresence = !rgbEnabled
    ? 0
    : inCase
      ? Math.max(power, isDarkPreset ? 0.65 : 0)
      : isDarkPreset
        ? 0.45
        : 0;

  // Modulasi organik tipis (±8%) saat kipas dan LED sedang menyala
  const pulseFactor =
    rgbEnabled && input.isPcPoweredOn && inCase ? 1 + Math.sin(input.pulsePhase) * 0.08 : 1;

  const rgbEmissiveIntensity = !rgbEnabled
    ? 0
    : Number(
        (lerp(0.48, 1.62, Math.max(power, isDarkPreset ? 0.6 : 0)) * pulseFactor).toFixed(3),
      );

  // Kaca samping tempered gelap sedikit meredam bias sisi jendela namun menjaga semburan kipas depan
  const sideGlassAttenuation = input.glassPanelClosed ? 0.78 : 1.0;

  const interiorRgbLightIntensity =
    inCase && rgbPresence > 0
      ? Number((4.6 * rgbPresence * pulseFactor).toFixed(3))
      : 0;

  const deskBounceLightIntensity =
    inCase && rgbPresence > 0
      ? Number((4.2 * rgbPresence * sideGlassAttenuation * pulseFactor).toFixed(3))
      : 0;

  const frontFanSpillLightIntensity =
    inCase && rgbPresence > 0
      ? Number((3.4 * rgbPresence * pulseFactor).toFixed(3))
      : 0;

  // Opasitas bidang pantulan cahaya RGB prosedural di atas matras ESD & permukaan meja
  const deskReflectionOpacity =
    inCase && rgbPresence > 0
      ? Number(
          clamp01(0.66 * rgbPresence * sideGlassAttenuation * pulseFactor).toFixed(3),
        )
      : 0;

  const frontReflectionOpacity =
    inCase && rgbPresence > 0
      ? Number(clamp01(0.54 * rgbPresence * pulseFactor).toFixed(3))
      : 0;

  return {
    roomDimFactor: Number(roomDimFactor.toFixed(3)),
    bgColorHex,
    keyLightIntensity,
    hemiLightIntensity,
    rimLightIntensity,
    softboxIntensity,
    toneMappingExposure,
    rgbEmissiveIntensity,
    interiorRgbLightIntensity,
    deskBounceLightIntensity,
    frontFanSpillLightIntensity,
    deskReflectionOpacity,
    frontReflectionOpacity,
    rgbActive: inCase && rgbPresence > 0,
  };
}
