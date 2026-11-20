/* Overlay terminal BIOS POST autentik dengan teks log bergerak cepat, kursor berkedip, dan indikator LED diagnostik */

import { FastForward, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PostLedKey } from '../lib/assemblyEngine';
import {
  getPostLedStates,
  type LedVisualState,
  type PostLogLine,
} from '../lib/postSequence';

interface PostTerminalOverlayProps {
  lines: PostLogLine[];
  passed: boolean;
  onLineRevealed: (line: PostLogLine) => void;
  onComplete: () => void;
}

const LED_ORDER: PostLedKey[] = ['CPU', 'DRAM', 'VGA', 'BOOT'];

function getLedBadgeClass(state: LedVisualState): string {
  switch (state) {
    case 'ok':
      return 'border-emerald-500/70 bg-emerald-950 text-emerald-300';
    case 'fail':
      return 'border-red-500/80 bg-red-950 text-red-300';
    case 'checking':
      return 'border-amber-400/80 bg-amber-950 text-amber-200';
    default:
      return 'border-slate-700 bg-slate-900 text-slate-500';
  }
}

export function PostTerminalOverlay({
  lines,
  passed,
  onLineRevealed,
  onComplete,
}: PostTerminalOverlayProps) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setVisibleCount(1);
  }, [lines]);

  // Efek suara detik lembut untuk baris pertama saat terminal terbuka
  useEffect(() => {
    if (lines.length > 0 && visibleCount === 1) {
      onLineRevealed(lines[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Progres otomatis teks log BIOS satu per satu lalu lanjut ke hasil akhir
  useEffect(() => {
    if (visibleCount < lines.length) {
      const nextLine = lines[visibleCount];
      const timer = window.setTimeout(() => {
        setVisibleCount((prev) => prev + 1);
        onLineRevealed(nextLine);
      }, nextLine.delayMs);
      return () => window.clearTimeout(timer);
    }

    // Semua baris sudah tampil: beri jeda singkat agar pengguna sempat membaca hasil akhir
    const finishDelay = passed ? 420 : 1250;
    const doneTimer = window.setTimeout(() => {
      onComplete();
    }, finishDelay);
    return () => window.clearTimeout(doneTimer);
  }, [visibleCount, lines, passed, onLineRevealed, onComplete]);

  const shownLines = lines.slice(0, visibleCount);
  const leds = getPostLedStates(lines, visibleCount);
  const isFinished = visibleCount >= lines.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-terminal-title"
      data-testid="post-terminal-overlay"
      className="fixed inset-0 z-50 bg-neutral-950/75 flex items-center justify-center p-4"
    >
      {/* Bingkai monitor pengujian BIOS */}
      <div className="w-full max-w-2xl rounded-2xl border-2 border-slate-700 bg-slate-950 text-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_16px_40px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* Bilah atas monitor BIOS + EZ-Debug LED live */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <h2
              id="post-terminal-title"
              className="text-xs sm:text-sm font-mono font-semibold text-white"
            >
              UEFI BIOS POST — Power-On Self-Test
            </h2>
          </div>

          {/* 4 LED Diagnostik bertahap */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]" aria-label="Status LED diagnostik POST">
            {LED_ORDER.map((ledKey) => {
              const ledState = leds[ledKey];
              const stateWord =
                ledState === 'ok'
                  ? 'OK'
                  : ledState === 'fail'
                    ? 'ERR'
                    : ledState === 'checking'
                      ? '...'
                      : '-';
              return (
                <span
                  key={ledKey}
                  className={`px-2 py-0.5 rounded border font-semibold tabular-nums ${getLedBadgeClass(ledState)}`}
                >
                  {ledKey} {stateWord}
                </span>
              );
            })}
          </div>
        </div>

        {/* Layar log terminal BIOS */}
        <div className="p-4 sm:p-5 min-h-[260px] max-h-[60vh] overflow-y-auto font-mono text-xs sm:text-[13px] leading-relaxed space-y-1.5 bg-slate-950">
          {shownLines.map((line) => (
            <div
              key={line.id}
              className="animate-post-line flex items-baseline justify-between gap-3"
            >
              <div className="min-w-0 flex items-baseline gap-2">
                <span
                  className={`shrink-0 font-semibold ${
                    line.status === 'fail'
                      ? 'text-red-400'
                      : line.status === 'ok'
                        ? 'text-sky-400'
                        : 'text-slate-400'
                  }`}
                >
                  [{line.tag}]
                </span>
                <span
                  className={
                    line.status === 'fail'
                      ? 'text-red-200 font-semibold'
                      : line.status === 'info'
                        ? 'text-slate-300'
                        : 'text-slate-100'
                  }
                >
                  {line.text}
                </span>
              </div>

              {line.resultLabel && (
                <span
                  className={`shrink-0 font-bold tabular-nums ${
                    line.status === 'fail' ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  [{line.resultLabel}]
                </span>
              )}
            </div>
          ))}

          {/* Prompt kursor berkedip khas BIOS */}
          <div className="pt-2 flex items-center gap-1.5 text-slate-400">
            <span>{isFinished ? (passed ? 'BIOS>' : 'HALT>') : 'POST>'}</span>
            <span>
              {isFinished
                ? passed
                  ? 'POST selesai. Membuka ringkasan sistem...'
                  : 'Eksekusi dihentikan. Periksa komponen di casing.'
                : 'Memeriksa perangkat keras...'}
            </span>
            <span
              aria-hidden="true"
              className="inline-block w-2 h-4 bg-emerald-400 align-middle animate-blink-cursor"
            />
          </div>
        </div>

        {/* Bilah bawah terminal dengan tombol lewati / lanjut cepat */}
        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            Log {shownLines.length}/{lines.length} · {passed ? 'Urutan Boot Normal' : 'Diagnosis Gangguan'}
          </span>

          <button
            type="button"
            onClick={onComplete}
            className="min-h-9 px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{passed ? 'Lewati ke Ringkasan' : 'Periksa Casing'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
