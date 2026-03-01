import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLOT_MACHINE_CONFIG } from "../../domain/slotMachine";
import { SYMBOLS } from "../../domain/symbols";
import { SoundEffects } from "../../infrastructure/audio/SoundEffects";
import { SlotWebSocketGateway } from "../../infrastructure/slotWebSocketGateway";
import { SlotMachineManager, type RoundStartPayload } from "../../usecases/slotMachineManager";
import { SlotRoundController } from "../../usecases/slotRoundController";

type HighlightMode = "none" | "reach" | "win";
type BlackoutPhase = "off" | "closing" | "closed" | "opening";

type SlotGameState = {
  spinning: boolean;
  symbolShiftActive: boolean;
  targetIndexes: number[];
  spinBaseMs: number;
  reachExtraDelayMs: number;
  blackoutPhase: BlackoutPhase;
  highlightMode: HighlightMode;
  showWelcome: boolean;
  connectionError: string | null;
};

type SlotGameHandlers = {
  onReachBlink(): void;
  onSpinComplete(): void;
  onWelcomeTap(): void;
  onReconnect(): void;
};

type SlotGameHook = SlotGameState & SlotGameHandlers;

const WIN_SYMBOL_SHIFT_PROBABILITY = 0.25;
const WIN_SYMBOL_SHIFT_DURATION_MS = 1000;

function nextRandomFloat(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 2 ** 32;
  }
  return Math.random();
}

export function useSlotGame(
  slotManager: SlotMachineManager,
  websocketUrl: string,
): SlotGameHook {
  const [spinning, setSpinning] = useState(false);
  const [symbolShiftActive, setSymbolShiftActive] = useState(false);
  const [targetIndexes, setTargetIndexes] = useState<number[]>(() =>
    Array(slotManager.reelCount).fill(0),
  );
  const [spinBaseMs, setSpinBaseMs] = useState<number>(SLOT_MACHINE_CONFIG.baseSpinMs);
  const [reachExtraDelayMs, setReachExtraDelayMs] = useState<number>(0);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("none");
  const [blackoutPhase, setBlackoutPhase] = useState<BlackoutPhase>("off");
  const [showWelcome, setShowWelcome] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const roundControllerRef = useRef<SlotRoundController | null>(null);
  const suppressCloseErrorRef = useRef(false);
  const spinCompletionResolverRef = useRef<(() => void) | null>(null);
  const blackoutTimersRef = useRef<number[]>([]);
  const plannedBlackoutDurationRef = useRef<number | null>(null);
  const winEffectTimerRef = useRef<number | null>(null);

  const clearWinEffectTimer = useCallback(() => {
    if (winEffectTimerRef.current !== null) {
      window.clearTimeout(winEffectTimerRef.current);
      winEffectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects(
      "/sounds/win.mp3",
      "/sounds/spinStart.mp3",
      "/sounds/winAlert.mp3",
      "/sounds/reachmusic.mp3",
    );
    soundEffectsRef.current = effects;
    return () => {
      effects.dispose();
      soundEffectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (highlightMode === "reach") {
      return;
    }
    soundEffectsRef.current?.stopReachPulse();
  }, [highlightMode]);

  useEffect(() => {
    roundControllerRef.current = new SlotRoundController(slotManager);
    return () => {
      blackoutTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      blackoutTimersRef.current = [];
      plannedBlackoutDurationRef.current = null;
      clearWinEffectTimer();
      roundControllerRef.current?.dispose();
      roundControllerRef.current = null;
      websocketRef.current?.disconnect();
    };
  }, [clearWinEffectTimer, slotManager]);


  const clearBlackoutTimers = useCallback(() => {
    blackoutTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    blackoutTimersRef.current = [];
  }, []);

  const scheduleBlackout = useCallback((durationMs: number) => {
    clearBlackoutTimers();

    const startDelayMs = 360;
    const puchunMs = 150;
    const holdMs = Math.max(0, durationMs - puchunMs * 2);

    blackoutTimersRef.current.push(
      window.setTimeout(() => {
        setBlackoutPhase("closing");
        blackoutTimersRef.current.push(
          window.setTimeout(() => {
            setBlackoutPhase("closed");
          }, puchunMs),
        );
        blackoutTimersRef.current.push(
          window.setTimeout(() => {
            setBlackoutPhase("opening");
          }, puchunMs + holdMs),
        );
        blackoutTimersRef.current.push(
          window.setTimeout(() => {
            setBlackoutPhase("off");
          }, puchunMs + holdMs + puchunMs),
        );
      }, startDelayMs),
    );
  }, [clearBlackoutTimers]);

  const disconnectSilently = useCallback(() => {
    suppressCloseErrorRef.current = true;
    websocketRef.current?.disconnect();
  }, []);

  const awaitSpinCompletion = useCallback(() => {
    return new Promise<void>((resolve) => {
      spinCompletionResolverRef.current = () => {
        spinCompletionResolverRef.current = null;
        resolve();
      };
    });
  }, []);

  const notifySpinComplete = useCallback(() => {
    setSpinning(false);
    spinCompletionResolverRef.current?.();
    spinCompletionResolverRef.current = null;
  }, []);

  const handleRoundStart = useCallback(
    (payload: RoundStartPayload) => {
      const controller = roundControllerRef.current;
      if (!controller) return;

      controller.handleRoundStart(
        payload,
        {
          onPrepare: (roundPlan) => {
            setSpinBaseMs(roundPlan.baseSpinDurationMs);
            setReachExtraDelayMs(roundPlan.reachExtraDelayMs);
            plannedBlackoutDurationRef.current = roundPlan.fakeReachBlackout?.durationMs ?? null;
            clearBlackoutTimers();
            clearWinEffectTimer();
            setBlackoutPhase("off");
            setSpinning(false);
            setSymbolShiftActive(false);
            setHighlightMode("none");
          },
          onSpin: (indexes) => {
            setTargetIndexes(indexes);
            setSpinning(true);
          },
          onReachStart: () => {
            setHighlightMode("reach");
            if (plannedBlackoutDurationRef.current) {
              scheduleBlackout(plannedBlackoutDurationRef.current);
            }
          },
          onReachEnd: () => {
            setHighlightMode("none");
          },
          onWin: () => {
            clearWinEffectTimer();
            setSpinning(false);

            const shouldShiftSymbols =
              nextRandomFloat() < WIN_SYMBOL_SHIFT_PROBABILITY;
            if (!shouldShiftSymbols) {
              setHighlightMode("win");
              disconnectSilently();
              return;
            }

            setTargetIndexes((prevIndexes) => {
              const currentIndex = prevIndexes[0] ?? 0;
              const maxIndex = Math.max(0, SYMBOLS.length - 1);
              let nextIndex = currentIndex;
              while (nextIndex === currentIndex) {
                nextIndex = Math.floor(nextRandomFloat() * (maxIndex + 1));
              }
              return Array(slotManager.reelCount).fill(nextIndex);
            });
            setSymbolShiftActive(true);

            winEffectTimerRef.current = window.setTimeout(() => {
              setSymbolShiftActive(false);
              setHighlightMode("win");
              disconnectSilently();
              winEffectTimerRef.current = null;
            }, WIN_SYMBOL_SHIFT_DURATION_MS);
          },
          waitForSpinComplete: awaitSpinCompletion,
        },
        soundEffectsRef.current,
      );
    },
    [
      clearBlackoutTimers,
      clearWinEffectTimer,
      disconnectSilently,
      awaitSpinCompletion,
      scheduleBlackout,
      slotManager.reelCount,
    ],
  );

  const connectWebSocket = useCallback(() => {
    setConnectionError(null);
    suppressCloseErrorRef.current = false;
    if (!websocketRef.current) {
      websocketRef.current = new SlotWebSocketGateway(websocketUrl);
    }
    websocketRef.current.connect(handleRoundStart, {
      onOpen: () => setConnectionError(null),
      onError: () =>
        setConnectionError(
          "通信に失敗しました。接続状況を確認し、再接続してください。",
        ),
      onClose: () => {
        if (suppressCloseErrorRef.current) {
          suppressCloseErrorRef.current = false;
          return;
        }
        setConnectionError("通信が切断されました。再接続してください。");
      },
    });
  }, [websocketUrl, handleRoundStart]);

  const enableSound = useCallback(async () => {
    const effects = soundEffectsRef.current;
    if (!effects) return false;
    return effects.enable();
  }, []);

  const onReachBlink = useCallback(() => {
    const effects = soundEffectsRef.current;
    if (!effects) return;
    void effects.playReachPulse();
  }, []);

  const onWelcomeTap = useCallback(async () => {
    const ok = await enableSound();
    if (ok) {
      connectWebSocket();
      setShowWelcome(false);
    }
  }, [enableSound, connectWebSocket]);

  return useMemo(
    () => ({
      spinning,
      symbolShiftActive,
      targetIndexes,
      spinBaseMs,
      reachExtraDelayMs,
      blackoutPhase,
      highlightMode,
      showWelcome,
      connectionError,
      onReachBlink,
      onSpinComplete: notifySpinComplete,
      onWelcomeTap,
      onReconnect: connectWebSocket,
    }),
    [
      spinning,
      symbolShiftActive,
      targetIndexes,
      spinBaseMs,
      reachExtraDelayMs,
      blackoutPhase,
      highlightMode,
      showWelcome,
      connectionError,
      onReachBlink,
      notifySpinComplete,
      onWelcomeTap,
      connectWebSocket,
    ],
  );
}
