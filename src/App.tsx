/* Komponen akar RakitPC Lab yang mengelola state permainan, HUD simulasi, manajemen suara multi-kanal, dan pintasan keyboard */

import { Pause, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  ASSEMBLY_STEPS,
  PSU_CAPACITY_WATTS,
  STORAGE_KEY,
  type BuildPresetId,
  type GameMode,
  type PartId,
  type SlotId,
} from './config';
import {
  loadUnlockedAchievements,
  mergeUnlockedAchievements,
  saveUnlockedAchievements,
  type AchievementId,
} from './lib/achievements';
import { AudioPanelModal } from './components/AudioPanel';
import { ComponentTray } from './components/ComponentTray';
import { HardwareInfoModal, PauseModal, VictoryModal } from './components/GameModals';
import { PostTerminalOverlay } from './components/PostTerminalOverlay';
import { RobotBimoPanel } from './components/RobotBimo';
import { TitleScreen } from './components/TitleScreen';
import { WorkbenchStage, type WorkbenchViewMode } from './components/WorkbenchStage';
import {
  createInitialState,
  getCompletedStepCount,
  getProgressPercent,
  getTotalWattage,
  installPartOnSlot,
  replaceDamagedPart,
  requestRobotHint,
  rotateCpuOrientation,
  runPostCheck,
  selectPart,
  toggleCpuLatch,
  togglePsuSwitch,
  type ActionOutcome,
  type AssemblyState,
} from './lib/assemblyEngine';
import { buildPostLogSequence, type PostLogLine } from './lib/postSequence';
import { formatDuration, formatScore, formatWatts } from './lib/formatters';
import {
  playSoundFx,
  setAmbientFanRunning,
  updateSoundSettings,
} from './lib/soundFx';
import {
  getSoundAcousticCue,
  loadSoundSettings,
  saveSoundSettings,
  type SoundEvent,
  type SoundSettings,
} from './lib/soundSettings';

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { bestScore?: unknown };
    return typeof parsed.bestScore === 'number' && Number.isFinite(parsed.bestScore)
      ? Math.max(0, Math.round(parsed.bestScore))
      : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore: Math.round(score) }));
  } catch {
    // Abaikan jika penyimpanan lokal tidak tersedia
  }
}

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

function getInitialRandomFaultSetting(): boolean {
  if (typeof window === 'undefined') return true;
  return new URLSearchParams(window.location.search).get('faults') !== '0';
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState<GameMode>('belajar');
  const [selectedPreset, setSelectedPreset] = useState<BuildPresetId>('efisien');
  const [randomFaultEnabled, setRandomFaultEnabled] = useState<boolean>(() =>
    getInitialRandomFaultSetting(),
  );
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>('3d');
  const [state, setState] = useState<AssemblyState>(() =>
    createInitialState(
      'belajar',
      shouldAutostart() ? 'playing' : 'title',
      'efisien',
      getInitialRandomFaultSetting(),
    ),
  );
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const [lastAudioCue, setLastAudioCue] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState<number>(() => loadBestScore());
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementId[]>(() =>
    loadUnlockedAchievements(),
  );
  const [infoPartId, setInfoPartId] = useState<PartId | null>(null);
  const [postRun, setPostRun] = useState<{
    lines: PostLogLine[];
    pendingOutcome: ActionOutcome;
    finalSoundPlayed: boolean;
  } | null>(null);

  const triggerSound = useCallback(
    (event: SoundEvent | null) => {
      if (!event) return;
      playSoundFx(event, soundSettings);
      const cue = getSoundAcousticCue(event);
      if (cue) {
        setLastAudioCue(cue);
      }
    },
    [soundSettings],
  );

  // Sinkronkan perubahan pengaturan audio ke mesin Web Audio & localStorage
  useEffect(() => {
    saveSoundSettings(soundSettings);
    updateSoundSettings(soundSettings);
  }, [soundSettings]);

  // Kendalikan dengung halus kipas casing saat POST menyala dan hentikan saat jeda/judul
  useEffect(() => {
    const shouldHum =
      state.fansSpinning &&
      (state.screen === 'playing' || state.screen === 'gameover') &&
      !soundSettings.muted;
    setAmbientFanRunning(shouldHum, soundSettings);
  }, [state.fansSpinning, state.screen, soundSettings]);

  // Sinkronkan status permainan ke atribut body untuk konsistensi state & pengujian
  useEffect(() => {
    document.body.dataset.state = state.screen;
  }, [state.screen]);

  // Penghitung waktu rakit aktif hanya saat bermain dan modal tidak terbuka
  useEffect(() => {
    if (state.screen !== 'playing' || infoPartId !== null || audioPanelOpen || postRun !== null) {
      return;
    }
    const timer = window.setInterval(() => {
      setState((prev) =>
        prev.screen === 'playing' ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : prev,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.screen, infoPartId, audioPanelOpen, postRun]);

  // Simpan skor terbaik dan gabungkan lencana pencapaian saat POST lulus
  useEffect(() => {
    if (state.screen !== 'gameover') return;
    if (state.score > bestScore) {
      setBestScore(state.score);
      saveBestScore(state.score);
    }
    if (state.earnedAchievements.length > 0) {
      setUnlockedAchievements((prev) => {
        const merged = mergeUnlockedAchievements(prev, state.earnedAchievements);
        saveUnlockedAchievements(merged);
        return merged;
      });
    }
  }, [state.screen, state.score, state.earnedAchievements, bestScore]);

  const startNewGame = useCallback(
    (
      modeOverride?: GameMode,
      presetOverride?: BuildPresetId,
      faultOverride?: boolean,
    ) => {
      const activeMode = modeOverride ?? selectedMode;
      const activePreset = presetOverride ?? selectedPreset;
      const activeFaults = faultOverride ?? randomFaultEnabled;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setInfoPartId(null);
      setAudioPanelOpen(false);
      setPostRun(null);
      setLastAudioCue(null);
      setState(createInitialState(activeMode, 'playing', activePreset, activeFaults));
      playSoundFx('select', soundSettings);
    },
    [selectedMode, selectedPreset, randomFaultEnabled, soundSettings],
  );

  const handleTogglePause = useCallback(() => {
    if (postRun !== null) return;
    setInfoPartId(null);
    setAudioPanelOpen(false);
    setState((prev) => {
      if (prev.screen === 'playing') return { ...prev, screen: 'paused' };
      if (prev.screen === 'paused') return { ...prev, screen: 'playing' };
      return prev;
    });
  }, [postRun]);

  const handleBackToTitle = useCallback(() => {
    setInfoPartId(null);
    setAudioPanelOpen(false);
    setPostRun(null);
    setLastAudioCue(null);
    setState(createInitialState(selectedMode, 'title', selectedPreset, randomFaultEnabled));
  }, [selectedMode, selectedPreset, randomFaultEnabled]);

  const handleSelectPart = useCallback(
    (partId: PartId) => {
      setState((prev) => {
        const next = selectPart(prev, prev.selectedPart === partId ? null : partId);
        if (next.selectedPart === partId) {
          playSoundFx('select', soundSettings);
        }
        return next;
      });
    },
    [soundSettings],
  );

  const handleRotateCpu = useCallback(() => {
    setState((prev) => {
      const outcome = rotateCpuOrientation(prev);
      triggerSound(outcome.sound);
      return outcome.state;
    });
  }, [triggerSound]);

  const handleToggleCpuLatch = useCallback(() => {
    setState((prev) => {
      const outcome = toggleCpuLatch(prev);
      triggerSound(outcome.sound);
      return outcome.state;
    });
  }, [triggerSound]);

  const handleSlotInteract = useCallback(
    (slotId: SlotId, droppedPartId?: PartId) => {
      setState((prev) => {
        const partToUse = droppedPartId ?? prev.selectedPart;
        if (!partToUse) {
          playSoundFx('error', soundSettings);
          return {
            ...prev,
            robotMood: 'guiding',
            robotMessage:
              'Pilih dulu komponen dari Baki Komponen di kiri (atau seret langsung) sebelum mengklik slot target.',
          };
        }
        const outcome = installPartOnSlot(prev, partToUse, slotId);
        triggerSound(outcome.sound);
        return outcome.state;
      });
    },
    [soundSettings, triggerSound],
  );

  const handleTogglePsuSwitch = useCallback(() => {
    setState((prev) => {
      const outcome = togglePsuSwitch(prev);
      triggerSound(outcome.sound);
      return outcome.state;
    });
  }, [triggerSound]);

  const handleReplaceDamagedPart = useCallback(
    (partId: PartId) => {
      setState((prev) => {
        const outcome = replaceDamagedPart(prev, partId);
        triggerSound(outcome.sound);
        return outcome.state;
      });
    },
    [triggerSound],
  );

  const handleRunPost = useCallback(() => {
    if (postRun !== null) return;
    const outcome = runPostCheck(state);
    if (!outcome.state.postResult) {
      triggerSound(outcome.sound);
      setState(outcome.state);
      return;
    }
    const lines = buildPostLogSequence(state, outcome.state.postResult);
    if (outcome.ok) {
      setState((prev) => ({ ...prev, fansSpinning: true }));
    }
    setPostRun({
      lines,
      pendingOutcome: outcome,
      finalSoundPlayed: false,
    });
  }, [postRun, state, triggerSound]);

  const handlePostLineRevealed = useCallback(
    (line: PostLogLine) => {
      if (line.status === 'fail') {
        triggerSound('post_fail');
        setPostRun((prev) => (prev ? { ...prev, finalSoundPlayed: true } : null));
      } else if (line.id === 'post_beep') {
        triggerSound('post_ok');
        setPostRun((prev) => (prev ? { ...prev, finalSoundPlayed: true } : null));
      } else {
        playSoundFx('post_tick', soundSettings);
      }
    },
    [soundSettings, triggerSound],
  );

  const handlePostComplete = useCallback(() => {
    setPostRun((current) => {
      if (!current) return null;
      if (!current.finalSoundPlayed) {
        triggerSound(current.pendingOutcome.sound);
      }
      setState(current.pendingOutcome.state);
      return null;
    });
  }, [triggerSound]);

  const handleRequestHint = useCallback(() => {
    setState((prev) => requestRobotHint(prev));
  }, []);

  const handleToggleMute = useCallback(() => {
    setSoundSettings((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const handlePreviewSound = useCallback(
    (event: SoundEvent) => {
      triggerSound(event);
    },
    [triggerSound],
  );

  // Pintasan keyboard global
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      const isInteractive =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isInteractive) return;

      if (state.screen === 'title') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          startNewGame();
        }
        return;
      }

      if (audioPanelOpen && event.key === 'Escape') {
        event.preventDefault();
        setAudioPanelOpen(false);
        return;
      }

      if (infoPartId !== null && event.key === 'Escape') {
        event.preventDefault();
        setInfoPartId(null);
        return;
      }

      if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
        if (state.screen === 'playing' || state.screen === 'paused') {
          event.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (state.screen !== 'playing' || infoPartId !== null || audioPanelOpen) return;

      const lower = event.key.toLowerCase();
      if (lower === 'r' && state.phase === 'bench') {
        event.preventDefault();
        handleRotateCpu();
      } else if (lower === 'h') {
        event.preventDefault();
        handleRequestHint();
      } else if (lower === 'm') {
        event.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    state.screen,
    state.phase,
    infoPartId,
    audioPanelOpen,
    startNewGame,
    handleTogglePause,
    handleRotateCpu,
    handleRequestHint,
    handleToggleMute,
  ]);

  if (state.screen === 'title') {
    return (
      <TitleScreen
        selectedMode={selectedMode}
        selectedPreset={selectedPreset}
        randomFaultEnabled={randomFaultEnabled}
        bestScore={bestScore}
        unlockedAchievements={unlockedAchievements}
        onSelectMode={setSelectedMode}
        onSelectPreset={setSelectedPreset}
        onToggleRandomFault={setRandomFaultEnabled}
        onStart={() => startNewGame(selectedMode, selectedPreset, randomFaultEnabled)}
      />
    );
  }

  const completedSteps = getCompletedStepCount(state);
  const progressPercent = getProgressPercent(state);
  const totalWatts = getTotalWattage(state);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* HUD Simulasi Ringkas (1 baris, tanpa bilah navigasi situs web) */}
      <div
        role="region"
        aria-label="Panel Status Simulasi"
        className="bg-white border-b border-neutral-200 px-4 py-2.5"
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Nama permainan & progres langkah */}
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-base font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0">
              RakitPC Lab
            </span>
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-24 sm:w-32 h-2 rounded-full bg-neutral-200 overflow-hidden shrink-0"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progres perakitan"
              >
                <div
                  className="h-full bg-blue-700 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
              </div>
              <span className="text-xs font-semibold text-neutral-700 tabular-nums whitespace-nowrap">
                {completedSteps}/{ASSEMBLY_STEPS.length} Langkah
              </span>
            </div>
          </div>

          {/* Metrik live: Daya, Waktu, Skor */}
          <div className="flex items-center gap-4 sm:gap-6 text-xs tabular-nums">
            <div>
              <span className="text-neutral-500">Daya </span>
              <span className="font-mono font-semibold text-neutral-900">
                {formatWatts(totalWatts)} / {formatWatts(PSU_CAPACITY_WATTS)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Waktu </span>
              <span className="font-mono font-semibold text-neutral-900">
                {formatDuration(state.elapsedSeconds)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Skor </span>
              <span className="font-mono font-semibold text-blue-700">
                {formatScore(state.score)}
              </span>
            </div>
          </div>

          {/* Kontrol utilitas: Suara, Mixer Audio, Jeda, Ulang */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleMute();
              }}
              aria-label={soundSettings.muted ? 'Aktifkan suara efek' : 'Bisukan suara efek'}
              className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {soundSettings.muted ? (
                <VolumeX className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setAudioPanelOpen(true);
              }}
              aria-label="Pengaturan manajemen suara"
              className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleTogglePause();
              }}
              aria-label="Jeda simulasi"
              className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Pause className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                startNewGame();
              }}
              aria-label="Ulangi perakitan dari awal"
              className="w-10 h-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Area Kerja Utama 3-Zona: Baki Komponen | Meja Perakitan | Robot BIMO */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-3 order-2 lg:order-1">
          <ComponentTray
            state={state}
            onSelectPart={handleSelectPart}
            onRotateCpu={handleRotateCpu}
            onInspectPart={setInfoPartId}
            onReplaceDamagedPart={handleReplaceDamagedPart}
          />
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2">
          <WorkbenchStage
            state={state}
            viewMode={viewMode}
            lastAudioCue={lastAudioCue}
            onToggleViewMode={setViewMode}
            onSlotInteract={handleSlotInteract}
            onToggleCpuLatch={handleToggleCpuLatch}
            onRotateCpu={handleRotateCpu}
            onTogglePsuSwitch={handleTogglePsuSwitch}
            onRunPost={handleRunPost}
            onReplaceDamagedPart={handleReplaceDamagedPart}
          />
        </div>

        <div className="lg:col-span-3 order-3">
          <RobotBimoPanel
            state={state}
            onRequestHint={handleRequestHint}
            onInspectPart={setInfoPartId}
          />
        </div>
      </main>

      {/* Overlay Terminal BIOS POST saat uji nyala berlangsung */}
      {postRun !== null && (
        <PostTerminalOverlay
          lines={postRun.lines}
          passed={postRun.pendingOutcome.ok}
          onLineRevealed={handlePostLineRevealed}
          onComplete={handlePostComplete}
        />
      )}

      {/* Modal Manajemen Suara */}
      {audioPanelOpen && (
        <AudioPanelModal
          settings={soundSettings}
          onChangeSettings={setSoundSettings}
          onPreviewSound={handlePreviewSound}
          onClose={() => setAudioPanelOpen(false)}
        />
      )}

      {/* Modal Jeda */}
      {state.screen === 'paused' && (
        <PauseModal
          onResume={handleTogglePause}
          onRestart={() => startNewGame()}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* Modal Kemenangan / Ringkasan BIOS POST */}
      {state.screen === 'gameover' && (
        <VictoryModal
          state={state}
          bestScore={bestScore}
          onRestart={() => startNewGame()}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* Modal Info Edukasi Hardware */}
      {infoPartId !== null && (
        <HardwareInfoModal partId={infoPartId} onClose={() => setInfoPartId(null)} />
      )}
    </div>
  );
}
