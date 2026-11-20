/* Komponen robot pendamping BIMO dengan ekspresi interaktif, panduan langkah, dan daftar progres */

import { BookOpen, Check, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { ASSEMBLY_STEPS, MODE_DESCRIPTIONS, type PartId, type RobotMood } from '../config';
import type { AssemblyState } from '../lib/assemblyEngine';
import { getCompletedStepCount, getCurrentStep } from '../lib/assemblyEngine';

interface BimoAvatarProps {
  mood: RobotMood;
  size?: 'sm' | 'md' | 'lg';
}

export function BimoAvatar({ mood, size = 'md' }: BimoAvatarProps) {
  const sizeClass = size === 'lg' ? 'w-28 h-28' : size === 'sm' ? 'w-14 h-14' : 'w-20 h-20';

  const eyeColor =
    mood === 'warning'
      ? '#f59e0b'
      : mood === 'happy' || mood === 'celebrate'
        ? '#34d399'
        : '#38bdf8';

  const antennaColor =
    mood === 'warning' ? '#d97706' : mood === 'celebrate' ? '#059669' : '#2563eb';

  return (
    <svg viewBox="0 0 96 96" className={`${sizeClass} shrink-0 animate-bimo-float`} aria-hidden="true">
      {/* Antena sensor atas */}
      <line x1="48" y1="18" x2="48" y2="8" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="7" r="4.5" fill={antennaColor} stroke="#0f172a" strokeWidth="1.5" />

      {/* Penutup telinga mekanis */}
      <rect x="10" y="34" width="8" height="20" rx="4" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
      <rect x="78" y="34" width="8" height="20" rx="4" fill="#64748b" stroke="#0f172a" strokeWidth="2" />

      {/* Kepala robot matte titanium */}
      <rect x="17" y="18" width="62" height="50" rx="16" fill="#f1f5f9" stroke="#1e293b" strokeWidth="2.5" />
      <path d="M27 22 H69" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

      {/* Layar visor gelap */}
      <rect x="24" y="27" width="48" height="30" rx="9" fill="#0f172a" />

      {/* Ekspresi mata pada visor */}
      {mood === 'happy' || mood === 'celebrate' ? (
        <>
          <path d="M33 42 Q38 35 43 42" fill="none" stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M53 42 Q58 35 63 42" fill="none" stroke={eyeColor} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M42 49 Q48 54 54 49" fill="none" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : mood === 'warning' ? (
        <>
          <line x1="33" y1="36" x2="42" y2="41" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          <line x1="63" y1="36" x2="54" y2="41" stroke={eyeColor} strokeWidth="3" strokeLinecap="round" />
          <circle cx="38" cy="43" r="3" fill={eyeColor} />
          <circle cx="58" cy="43" r="3" fill={eyeColor} />
          <line x1="43" y1="51" x2="53" y2="51" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : mood === 'thinking' ? (
        <>
          <circle cx="38" cy="40" r="3.8" fill={eyeColor} />
          <rect x="53" y="38.5" width="9" height="3" rx="1.5" fill={eyeColor} />
          <path d="M43 50 Q48 48 53 50" fill="none" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy="40" r="4.2" fill={eyeColor} />
          <circle cx="58" cy="40" r="4.2" fill={eyeColor} />
          <circle cx="39.5" cy="38.5" r="1.4" fill="#ffffff" />
          <circle cx="59.5" cy="38.5" r="1.4" fill="#ffffff" />
          <path d="M43 49 Q48 52 53 49" fill="none" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}

      {/* Leher dan bahu robot */}
      <rect x="41" y="68" width="14" height="6" rx="2" fill="#475569" />
      <path d="M26 88 C26 76, 35 73, 48 73 C61 73, 70 76, 70 88 Z" fill="#1d4ed8" stroke="#0f172a" strokeWidth="2.5" />
      <rect x="40" y="79" width="16" height="5" rx="2.5" fill="#93c5fd" />
    </svg>
  );
}

interface RobotBimoPanelProps {
  state: AssemblyState;
  onRequestHint: () => void;
  onInspectPart: (partId: PartId) => void;
}

export function RobotBimoPanel({ state, onRequestHint, onInspectPart }: RobotBimoPanelProps) {
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const currentStep = getCurrentStep(state);
  const completedCount = getCompletedStepCount(state);
  const hintPenalty = MODE_DESCRIPTIONS[state.mode].hintPenalty;

  const inspectTarget: PartId =
    state.inspectedPart ?? state.selectedPart ?? currentStep.targetPartHint ?? 'cpu';

  const moodLabel: Record<RobotMood, string> = {
    idle: 'Siaga',
    guiding: 'Memandu',
    happy: 'Tepat',
    warning: 'Peringatan',
    thinking: 'Mengecek',
    celebrate: 'Berhasil',
  };

  const moodTextColor =
    state.robotMood === 'warning'
      ? 'text-amber-800'
      : state.robotMood === 'happy' || state.robotMood === 'celebrate'
        ? 'text-emerald-800'
        : 'text-blue-700';

  return (
    <aside
      aria-label="Panduan Robot Pendamping BIMO"
      className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-4"
    >
      {/* Header BIMO */}
      <div className="flex items-center gap-3">
        <BimoAvatar mood={state.robotMood} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-neutral-900 whitespace-nowrap truncate">
            BIMO Pendamping
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5 tabular-nums">
            Langkah {Math.min(completedCount + 1, ASSEMBLY_STEPS.length)}/{ASSEMBLY_STEPS.length} ·{' '}
            <span className={`font-semibold ${moodTextColor}`}>{moodLabel[state.robotMood]}</span>
          </p>
          <p className="text-xs text-neutral-500 truncate mt-0.5">{currentStep.shortTitle}</p>
        </div>
      </div>

      {/* Pesan aktif BIMO */}
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl p-3.5 text-sm leading-relaxed border ${
          state.robotMood === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : state.robotMood === 'happy' || state.robotMood === 'celebrate'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-neutral-50 border-neutral-200 text-neutral-800'
        }`}
      >
        <p>{state.robotMessage}</p>
      </div>

      {/* Mengapa langkah ini penting */}
      <div className="border-t border-neutral-200 pt-3">
        <p className="text-xs font-semibold text-neutral-900">Mengapa langkah ini penting?</p>
        <p className="text-xs text-neutral-600 leading-relaxed mt-1">{currentStep.whyItMatters}</p>
      </div>

      {/* Aksi cepat BIMO */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRequestHint}
          className="min-h-11 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {state.hintActive
              ? 'Sorotan Aktif'
              : hintPenalty > 0
                ? `Petunjuk (-${hintPenalty})`
                : 'Sorot Target'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onInspectPart(inspectTarget)}
          className="min-h-11 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-800 text-xs font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Info Hardware</span>
        </button>
      </div>

      {/* Daftar 10 langkah perakitan */}
      <div className="border-t border-neutral-200 pt-3">
        <button
          type="button"
          onClick={() => setStepsExpanded((prev) => !prev)}
          aria-expanded={stepsExpanded}
          className="w-full min-h-10 flex items-center justify-between text-xs font-semibold text-neutral-900 hover:text-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 rounded-lg"
        >
          <span className="tabular-nums">
            Daftar Langkah ({completedCount}/{ASSEMBLY_STEPS.length})
          </span>
          {stepsExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500" aria-hidden="true" />
          )}
        </button>

        {stepsExpanded && (
          <ol className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {ASSEMBLY_STEPS.map((step, index) => {
              const done = index < completedCount;
              const isCurrent = index === completedCount && !state.postResult?.passed;
              return (
                <li
                  key={step.id}
                  className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg ${
                    isCurrent
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : done
                        ? 'text-neutral-500'
                        : 'text-neutral-700'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold tabular-nums ${
                      done
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCurrent
                          ? 'bg-blue-700 text-white'
                          : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" aria-hidden="true" /> : step.stepNumber}
                  </span>
                  <span className="leading-snug">{step.title}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
