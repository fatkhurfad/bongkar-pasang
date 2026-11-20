/* Fungsi pemformatan angka, waktu, daya, dan skor secara konsisten */

export function formatWatts(watts: number): string {
  return `${Math.round(watts)} W`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatScore(score: number): string {
  return Math.max(0, Math.round(score)).toLocaleString('id-ID');
}

export function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `${clamped}%`;
}

export function formatAngle(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return `${normalized}°`;
}

export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp0';
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded).toLocaleString('id-ID');
  return rounded < 0 ? `-Rp${absFormatted}` : `Rp${absFormatted}`;
}

