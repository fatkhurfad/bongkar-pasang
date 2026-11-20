/* Komponen akar RakitPC Lab yang mengelola proyek bengkel, Toko Modul, meja perakitan 3D/2D, audio multi-kanal, dan pintasan keyboard */

import {
  Pause,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ASSEMBLY_STEPS,
  STORAGE_KEY,
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
import { BenchmarkLabModal } from './components/BenchmarkLabModal';
import { ComponentTray } from './components/ComponentTray';
import { HardwareInfoModal, PauseModal, VictoryModal } from './components/GameModals';
import { HardwareShopModal } from './components/HardwareShop';
import { PostTerminalOverlay } from './components/PostTerminalOverlay';
import { RobotBimoPanel } from './components/RobotBimo';
import { TitleScreen } from './components/TitleScreen';
import { WorkbenchStage, type WorkbenchViewMode } from './components/WorkbenchStage';
import {
  autoFillRecommendedBuild,
  buyCatalogModule,
  buyDualChannelRamKit,
  createWorkshopState,
  getCompletedStepCount,
  getEffectivePartInfo,
  getProgressPercent,
  getPsuCapacityWatts,
  getRamSummaryLabel,
  getTotalWattage,
  installPartOnSlot,
  replaceDamagedPart,
  requestRobotHint,
  rotateCpuOrientation,
  runPostCheck,
  selectPart,
  sellCatalogModule,
  toggleCpuLatch,
  togglePsuSwitch,
  type ActionOutcome,
  type AssemblyState,
} from './lib/assemblyEngine';
import {
  CLIENT_ORDERS,
  evaluateBuildLoadout,
  getShopCategoryForPart,
  loadSavedBuilds,
  loadWorkshopWallet,
  saveCompletedBuild,
  saveWorkshopWallet,
  type BuyableSlotId,
  type ClientOrderId,
  type SavedBuildRecord,
  type ShopCategory,
  type WorkshopWallet,
} from './lib/hardwareShop';
import { buildPostLogSequence, type PostLogLine } from './lib/postSequence';
import { formatRupiah, formatScore, formatWatts } from './lib/formatters';
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
  const [selectedOrderId, setSelectedOrderId] = useState<ClientOrderId>('gaming_efisien');
  const [randomFaultEnabled, setRandomFaultEnabled] = useState<boolean>(() =>
    getInitialRandomFaultSetting(),
  );
  const [viewMode, setViewMode] = useState<WorkbenchViewMode>('3d');
  const [state, setState] = useState<AssemblyState>(() =>
    createWorkshopState('gaming_efisien', 'belajar', {
      screen: shouldAutostart() ? 'playing' : 'title',
      randomFaultEnabled: getInitialRandomFaultSetting(),
      startWithEmptyCart: !shouldAutostart(),
    }),
  );
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [shopCategory, setShopCategory] = useState<ShopCategory>('all');
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const [lastAudioCue, setLastAudioCue] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState<number>(() => loadBestScore());
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementId[]>(() =>
    loadUnlockedAchievements(),
  );
  const [workshopWallet, setWorkshopWallet] = useState<WorkshopWallet>(() => loadWorkshopWallet());
  const [savedBuilds, setSavedBuilds] = useState<SavedBuildRecord[]>(() => loadSavedBuilds());
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [infoPartId, setInfoPartId] = useState<PartId | null>(null);
  const [postRun, setPostRun] = useState<{
    lines: PostLogLine[];
    pendingOutcome: ActionOutcome;
    finalSoundPlayed: boolean;
  } | null>(null);

  const rewardCreditedRef = useRef(false);

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

  // Penghitung waktu rakit dijeda saat belanja di Toko Modul atau saat modal terbuka agar terasa santai
  useEffect(() => {
    if (
      state.screen !== 'playing' ||
      shopOpen ||
      infoPartId !== null ||
      audioPanelOpen ||
      postRun !== null
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setState((prev) =>
        prev.screen === 'playing' ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : prev,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.screen, shopOpen, infoPartId, audioPanelOpen, postRun]);

  // Simpan skor terbaik, gabungkan lencana pencapaian, dan catat pembayaran jasa bengkel saat POST lulus
  useEffect(() => {
    if (state.screen !== 'gameover') {
      rewardCreditedRef.current = false;
      return;
    }
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
    if (!rewardCreditedRef.current) {
      rewardCreditedRef.current = true;
      const order = CLIENT_ORDERS[state.orderId];
      const evaluation = evaluateBuildLoadout(state.purchasedModules, state.orderId);
      const payout = !order.isSandbox && evaluation.allOrderRequirementsMet ? order.serviceFee : 0;
      setWorkshopWallet((prev) => {
        const next: WorkshopWallet = {
          totalEarnings: prev.totalEarnings + payout,
          completedOrders: prev.completedOrders + 1,
        };
        saveWorkshopWallet(next);
        return next;
      });
      const cpuInfo = getEffectivePartInfo(state, 'cpu');
      const gpuInfo = getEffectivePartInfo(state, 'gpu');
      const coolerInfo = getEffectivePartInfo(state, 'cpu_cooler');
      const ssdInfo = getEffectivePartInfo(state, 'ssd_nvme');
      const nextGallery = saveCompletedBuild({
        id: `build_${Date.now()}`,
        completedAtIso: new Date().toISOString(),
        orderId: state.orderId,
        orderTitle: order.title,
        clientName: order.clientName,
        totalSpent: evaluation.totalSpent,
        serviceFeeEarned: payout,
        benchmarkScore: evaluation.benchmarkScore,
        totalWatts: evaluation.estimatedWattage,
        psuCapacityWatts: evaluation.psuCapacityWatts,
        cpuModel: cpuInfo.model,
        gpuModel: gpuInfo.model,
        coolerModel: coolerInfo.model,
        ramLabel: getRamSummaryLabel(state),
        ssdModel: ssdInfo.model,
      });
      setSavedBuilds(nextGallery);
    }
  }, [
    state.screen,
    state.score,
    state.earnedAchievements,
    state.orderId,
    state.purchasedModules,
    bestScore,
  ]);

  const startWorkshopSession = useCallback(
    (options: {
      openShopFirst: boolean;
      modeOverride?: GameMode;
      orderOverride?: ClientOrderId;
      faultOverride?: boolean;
    }) => {
      const activeMode = options.modeOverride ?? selectedMode;
      const activeOrder = options.orderOverride ?? selectedOrderId;
      const activeFaults = options.faultOverride ?? randomFaultEnabled;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      rewardCreditedRef.current = false;
      setInfoPartId(null);
      setAudioPanelOpen(false);
      setBenchmarkOpen(false);
      setPostRun(null);
      setLastAudioCue(null);
      setShopCategory('all');
      setShopOpen(options.openShopFirst);
      setState(
        createWorkshopState(activeOrder, activeMode, {
          screen: 'playing',
          randomFaultEnabled: activeFaults,
          startWithEmptyCart: options.openShopFirst,
        }),
      );
      playSoundFx('select', soundSettings);
    },
    [selectedMode, selectedOrderId, randomFaultEnabled, soundSettings],
  );

  const handleTogglePause = useCallback(() => {
    if (postRun !== null) return;
    setInfoPartId(null);
    setAudioPanelOpen(false);
    setShopOpen(false);
    setState((prev) => {
      if (prev.screen === 'playing') return { ...prev, screen: 'paused' };
      if (prev.screen === 'paused') return { ...prev, screen: 'playing' };
      return prev;
    });
  }, [postRun]);

  const handleBackToTitle = useCallback(() => {
    setInfoPartId(null);
    setAudioPanelOpen(false);
    setShopOpen(false);
    setBenchmarkOpen(false);
    setPostRun(null);
    setLastAudioCue(null);
    setState(
      createWorkshopState(selectedOrderId, selectedMode, {
        screen: 'title',
        randomFaultEnabled,
        startWithEmptyCart: true,
      }),
    );
  }, [selectedOrderId, selectedMode, randomFaultEnabled]);

  const handleOpenShopForPart = useCallback((partId: PartId) => {
    setShopCategory(getShopCategoryForPart(partId));
    setShopOpen(true);
  }, []);

  const handleBuyModule = useCallback(
    (skuId: string, preferredSlot?: BuyableSlotId) => {
      setState((prev) => {
        const outcome = buyCatalogModule(prev, skuId, preferredSlot);
        triggerSound(outcome.sound);
        return outcome.state;
      });
    },
    [triggerSound],
  );

  const handleBuyDualRamKit = useCallback(
    (skuId: string) => {
      setState((prev) => {
        const outcome = buyDualChannelRamKit(prev, skuId);
        triggerSound(outcome.sound);
        return outcome.state;
      });
    },
    [triggerSound],
  );

  const handleSellModule = useCallback(
    (slotId: BuyableSlotId) => {
      setState((prev) => {
        const outcome = sellCatalogModule(prev, slotId);
        triggerSound(outcome.sound);
        return outcome.state;
      });
    },
    [triggerSound],
  );

  const handleAutoFillRecommended = useCallback(() => {
    setState((prev) => {
      const outcome = autoFillRecommendedBuild(prev);
      triggerSound(outcome.sound);
      return outcome.state;
    });
  }, [triggerSound]);

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
              'Pilih dulu komponen yang sudah dibeli dari Baki Komponen di kiri (atau seret langsung) sebelum mengklik slot target.',
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
          startWorkshopSession({ openShopFirst: true });
        }
        return;
      }

      if (shopOpen && event.key === 'Escape') {
        event.preventDefault();
        setShopOpen(false);
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

      if (state.screen !== 'playing' || shopOpen || infoPartId !== null || audioPanelOpen) return;

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
      } else if (lower === 'b') {
        event.preventDefault();
        setShopOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    state.screen,
    state.phase,
    shopOpen,
    infoPartId,
    audioPanelOpen,
    startWorkshopSession,
    handleTogglePause,
    handleRotateCpu,
    handleRequestHint,
    handleToggleMute,
  ]);

  if (state.screen === 'title') {
    return (
      <TitleScreen
        selectedMode={selectedMode}
        selectedOrderId={selectedOrderId}
        randomFaultEnabled={randomFaultEnabled}
        bestScore={bestScore}
        unlockedAchievements={unlockedAchievements}
        workshopWallet={workshopWallet}
        savedBuilds={savedBuilds}
        onSelectMode={setSelectedMode}
        onSelectOrder={setSelectedOrderId}
        onToggleRandomFault={setRandomFaultEnabled}
        onStartWithShop={() => startWorkshopSession({ openShopFirst: true })}
        onStartQuickBuild={() => startWorkshopSession({ openShopFirst: false })}
      />
    );
  }

  const completedSteps = getCompletedStepCount(state);
  const progressPercent = getProgressPercent(state);
  const totalWatts = getTotalWattage(state);
  const psuCapacity = getPsuCapacityWatts(state);
  const buildEval = evaluateBuildLoadout(state.purchasedModules, state.orderId);
  const activeOrder = CLIENT_ORDERS[state.orderId];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* HUD Simulasi Ringkas (1 baris, fokus pada proyek, anggaran, daya, dan akses cepat Toko Modul) */}
      <div
        role="region"
        aria-label="Panel Status Simulasi"
        className="bg-white border-b border-neutral-200 px-4 py-2.5"
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Nama permainan, proyek aktif, & progres langkah */}
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="text-base font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0">
              RakitPC Lab
            </span>
            <span className="hidden xl:inline text-xs text-neutral-500 truncate max-w-[180px]">
              {activeOrder.title}
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-20 sm:w-28 h-2 rounded-full bg-neutral-200 overflow-hidden shrink-0"
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

          {/* Metrik live bengkel: Sisa Anggaran, Daya, Skor */}
          <div className="flex items-center gap-4 sm:gap-5 text-xs tabular-nums">
            <div>
              <span className="text-neutral-500">Saldo </span>
              <span className="font-mono font-semibold text-emerald-800">
                {formatRupiah(state.balance)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Daya </span>
              <span
                className={`font-mono font-semibold ${
                  totalWatts > psuCapacity ? 'text-red-700' : 'text-neutral-900'
                }`}
              >
                {formatWatts(totalWatts)} / {formatWatts(psuCapacity)}
              </span>
            </div>
            <div className="hidden sm:block">
              <span className="text-neutral-500">Skor </span>
              <span className="font-mono font-semibold text-blue-700">
                {formatScore(state.score)}
              </span>
            </div>
          </div>

          {/* Kontrol utilitas: Toko Modul, Suara, Mixer Audio, Jeda, Ulang */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setShopCategory('all');
                setShopOpen(true);
              }}
              data-testid="hud-open-shop"
              className={`min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                buildEval.missingSlots.length > 0
                  ? 'bg-blue-700 hover:bg-blue-800 text-white'
                  : 'border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Toko Modul ({buildEval.ownedCount}/{buildEval.totalRequiredCount})
              </span>
            </button>

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
                startWorkshopSession({ openShopFirst: true });
              }}
              aria-label="Ulangi proyek dari awal"
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
            onOpenShopForPart={handleOpenShopForPart}
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

      {/* Modal Toko Modul Hardware (Belanja / Tukar / Cek Daya & Target Klien) */}
      {shopOpen && state.screen === 'playing' && (
        <HardwareShopModal
          state={state}
          activeCategory={shopCategory}
          onSelectCategory={setShopCategory}
          onBuyModule={handleBuyModule}
          onBuyDualRamKit={handleBuyDualRamKit}
          onSellModule={handleSellModule}
          onAutoFillRecommended={handleAutoFillRecommended}
          onCloseShop={() => setShopOpen(false)}
        />
      )}

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
          onOpenShop={() => {
            setState((prev) => ({ ...prev, screen: 'playing' }));
            setShopOpen(true);
          }}
          onRestart={() => startWorkshopSession({ openShopFirst: true })}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* Modal Kemenangan / Ringkasan BIOS POST & Pembayaran Jasa Bengkel */}
      {state.screen === 'gameover' && !benchmarkOpen && (
        <VictoryModal
          state={state}
          bestScore={bestScore}
          onOpenBenchmarkLab={() => setBenchmarkOpen(true)}
          onRestartWithShop={() => startWorkshopSession({ openShopFirst: true })}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {/* Modal Laboratorium Uji Benchmark, FPS & UEFI BIOS Tuning */}
      {state.screen === 'gameover' && benchmarkOpen && (
        <BenchmarkLabModal state={state} onClose={() => setBenchmarkOpen(false)} />
      )}

      {/* Modal Info Edukasi Hardware */}
      {infoPartId !== null && (
        <HardwareInfoModal
          partId={infoPartId}
          state={state}
          onClose={() => setInfoPartId(null)}
        />
      )}
    </div>
  );
}
