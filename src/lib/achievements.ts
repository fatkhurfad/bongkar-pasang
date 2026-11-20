/* Sistem pencapaian (achievements): definisi lencana, evaluasi aturan waktu & efisiensi komponen, dan penyimpanan lokal */

import { BUILD_PRESETS, PSU_CAPACITY_WATTS, type BuildPresetId, type GameMode } from '../config';

export type AchievementId =
  | 'perakit_kilat'
  | 'kombinasi_efisien'
  | 'teknisi_tanpa_cela'
  | 'post_sekali_jadi'
  | 'mandiri_sejati';

export type AchievementCategory = 'waktu' | 'efisiensi' | 'akurasi' | 'tantangan';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  category: AchievementCategory;
  bonusScore: number;
  conditionLabel: string;
  earnedNote: string;
}

export interface AchievementEvalInput {
  elapsedSeconds: number;
  mistakes: number;
  postAttempts: number;
  mode: GameMode;
  hintsUsed: number;
  buildPreset: BuildPresetId;
  totalWattage: number;
  hasDualChannelRam: boolean;
  hasThermalPaste: boolean;
}

export const ACHIEVEMENTS_STORAGE_KEY = 'rakitpc_lab_achievements_v1';

export const SPEED_ACHIEVEMENT_LIMIT_SECONDS = 90;

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: 'perakit_kilat',
    title: 'Perakit Kilat',
    category: 'waktu',
    bonusScore: 200,
    conditionLabel: `Selesaikan perakitan dalam ≤ ${SPEED_ACHIEVEMENT_LIMIT_SECONDS} detik.`,
    earnedNote: 'Kecepatan perakitan di bawah 90 detik dengan alur kerja rapi.',
  },
  {
    id: 'kombinasi_efisien',
    title: 'Kombinasi Paling Efisien',
    category: 'efisiensi',
    bonusScore: 200,
    conditionLabel: 'Beban daya 50%–65% PSU 80+ Gold, RAM Dual-Channel, & pasta termal.',
    earnedNote: 'Rasio daya tepat di zona efisiensi puncak PSU 80+ Gold (58%) & RAM Dual-Channel.',
  },
  {
    id: 'teknisi_tanpa_cela',
    title: 'Teknisi Tanpa Cela',
    category: 'akurasi',
    bonusScore: 250,
    conditionLabel: 'Tuntaskan seluruh 10 langkah dengan 0 kesalahan.',
    earnedNote: 'Nol kesalahan pemasangan dari pembukaan soket hingga POST sukses.',
  },
  {
    id: 'post_sekali_jadi',
    title: 'POST Sekali Jadi',
    category: 'akurasi',
    bonusScore: 100,
    conditionLabel: 'Lulus uji nyala POST pada percobaan tombol Power pertama.',
    earnedNote: 'Semua kabel daya dan sakelar PSU tepat sebelum tombol Power ditekan.',
  },
  {
    id: 'mandiri_sejati',
    title: 'Mandiri Sejati',
    category: 'tantangan',
    bonusScore: 200,
    conditionLabel: 'Selesaikan di Mode Mandiri tanpa meminta petunjuk BIMO.',
    earnedNote: 'Berhasil merakit penuh tanpa sorotan otomatis maupun petunjuk tambahan.',
  },
];

export const ACHIEVEMENTS_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((item) => [item.id, item]),
) as Record<AchievementId, AchievementDef>;

export function getPsuLoadPercent(totalWattage: number): number {
  return Math.round((totalWattage / PSU_CAPACITY_WATTS) * 100);
}

export function isEfficientComponentCombination(
  buildPreset: BuildPresetId,
  totalWattage: number,
  hasDualChannelRam: boolean,
  hasThermalPaste: boolean,
): boolean {
  const loadPct = getPsuLoadPercent(totalWattage);
  const preset = BUILD_PRESETS[buildPreset];
  return (
    preset.isPeakEfficient &&
    loadPct >= 50 &&
    loadPct <= 65 &&
    hasDualChannelRam &&
    hasThermalPaste
  );
}

export function evaluateRunAchievements(input: AchievementEvalInput): AchievementId[] {
  const earned: AchievementId[] = [];

  if (input.elapsedSeconds <= SPEED_ACHIEVEMENT_LIMIT_SECONDS) {
    earned.push('perakit_kilat');
  }

  if (
    isEfficientComponentCombination(
      input.buildPreset,
      input.totalWattage,
      input.hasDualChannelRam,
      input.hasThermalPaste,
    )
  ) {
    earned.push('kombinasi_efisien');
  }

  if (input.mistakes === 0) {
    earned.push('teknisi_tanpa_cela');
  }

  if (input.postAttempts === 1) {
    earned.push('post_sekali_jadi');
  }

  if (input.mode === 'mandiri' && input.hintsUsed === 0) {
    earned.push('mandiri_sejati');
  }

  return earned;
}

export function calculateAchievementBonus(achievementIds: AchievementId[]): number {
  return achievementIds.reduce((sum, id) => sum + (ACHIEVEMENTS_BY_ID[id]?.bonusScore ?? 0), 0);
}

export function mergeUnlockedAchievements(
  existing: AchievementId[],
  newlyEarned: AchievementId[],
): AchievementId[] {
  const validSet = new Set<AchievementId>(existing.filter((id) => Boolean(ACHIEVEMENTS_BY_ID[id])));
  for (const id of newlyEarned) {
    if (ACHIEVEMENTS_BY_ID[id]) {
      validSet.add(id);
    }
  }
  return Array.from(validSet);
}

export function loadUnlockedAchievements(): AchievementId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is AchievementId => typeof id === 'string' && Boolean(ACHIEVEMENTS_BY_ID[id as AchievementId]),
    );
  } catch {
    return [];
  }
}

export function saveUnlockedAchievements(ids: AchievementId[]): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = mergeUnlockedAchievements([], ids);
    window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Abaikan jika penyimpanan lokal tidak tersedia
  }
}
