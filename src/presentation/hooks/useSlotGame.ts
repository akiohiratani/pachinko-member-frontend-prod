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
  targetIndexes: number[];
  spinBaseMs: number;
  reachExtraDelayMs: number;
  blackoutPhase: BlackoutPhase;
  highlightMode: HighlightMode;
  showWelcome: boolean;
  connectionError: string | null;
  symbolMorphToken: number;
  symbolMorphFromIndex: number | null;
  symbolMorphToIndex: number | null;
  symbolMorphDurationMs: number;
};

type SlotGameHandlers = {
  onReachBlink(): void;
  onSpinComplete(): void;
  onWelcomeTap(): void;
  onReconnect(): void;
};

type SlotGameHook = SlotGameState & SlotGameHandlers;

export function useSlotGame(
  slotManager: SlotMachineManager,
  websocketUrl: string,
): SlotGameHook {
  const [spinning, setSpinning] = useState(false);
  const [targetIndexes, setTargetIndexes] = useState<number[]>(() =>
    Array(slotManager.reelCount).fill(0),
  );
  const [spinBaseMs, setSpinBaseMs] = useState<number>(SLOT_MACHINE_CONFIG.baseSpinMs);
  const [reachExtraDelayMs, setReachExtraDelayMs] = useState<number>(0);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("none");
  const [blackoutPhase, setBlackoutPhase] = useState<BlackoutPhase>("off");
  const [showWelcome, setShowWelcome] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reelCount = slotManager.reelCount;
  const [symbolMorphToken, setSymbolMorphToken] = useState(0);
  const [symbolMorphFromIndex, setSymbolMorphFromIndex] = useState<number | null>(null);
  const [symbolMorphToIndex, setSymbolMorphToIndex] = useState<number | null>(null);
  const [symbolMorphDurationMs, setSymbolMorphDurationMs] = useState(0);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const roundControllerRef = useRef<SlotRoundController | null>(null);
  const suppressCloseErrorRef = useRef(false);
  const spinCompletionResolverRef = useRef<(() => void) | null>(null);
  const blackoutTimersRef = useRef<number[]>([]);
  const plannedBlackoutDurationRef = useRef<number | null>(null);
  const targetIndexesRef = useRef<number[]>(targetIndexes);
  const symbolMorphTimerRef = useRef<number | null>(null);

  useEffect(() => {
    targetIndexesRef.current = targetIndexes;
  }, [targetIndexes]);

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
      if (symbolMorphTimerRef.current !== null) {
        window.clearTimeout(symbolMorphTimerRef.current);
        symbolMorphTimerRef.current = null;
      }
      plannedBlackoutDurationRef.current = null;
      roundControllerRef.current?.dispose();
      roundControllerRef.current = null;
      websocketRef.current?.disconnect();
    };
  }, [slotManager]);


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
            if (symbolMorphTimerRef.current !== null) {
              window.clearTimeout(symbolMorphTimerRef.current);
              symbolMorphTimerRef.current = null;
            }
            setSpinBaseMs(roundPlan.baseSpinDurationMs);
            setReachExtraDelayMs(roundPlan.reachExtraDelayMs);
            plannedBlackoutDurationRef.current = roundPlan.fakeReachBlackout?.durationMs ?? null;
            clearBlackoutTimers();
            setBlackoutPhase("off");
            setSpinning(false);
            setHighlightMode("none");
            setSymbolMorphFromIndex(null);
            setSymbolMorphToIndex(null);
            setSymbolMorphDurationMs(0);
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
            const currentIndexes = targetIndexesRef.current;
            const firstIndex = currentIndexes[0] ?? null;
            const canMorph =
              firstIndex !== null &&
              currentIndexes.length >= 3 &&
              currentIndexes.every((index) => index === firstIndex) &&
              SYMBOLS.length > 1;

            if (!canMorph || Math.random() >= 0.25) {
              setHighlightMode("win");
              disconnectSilently();
              return;
            }

            const morphDurationMs = 1500;
            const alternativeOffset = Math.floor(Math.random() * (SYMBOLS.length - 1)) + 1;
            const changedIndex = (firstIndex + alternativeOffset) % SYMBOLS.length;

            setSymbolMorphFromIndex(firstIndex);
            setSymbolMorphToIndex(changedIndex);
            setSymbolMorphDurationMs(morphDurationMs);
            setSymbolMorphToken((token) => token + 1);

            symbolMorphTimerRef.current = window.setTimeout(() => {
              symbolMorphTimerRef.current = null;
              setTargetIndexes(Array(reelCount).fill(changedIndex));
              setSymbolMorphFromIndex(null);
              setSymbolMorphToIndex(null);
              setSymbolMorphDurationMs(0);
              setHighlightMode("win");
              disconnectSilently();
            }, morphDurationMs);
          },
          waitForSpinComplete: awaitSpinCompletion,
        },
        soundEffectsRef.current,
      );
    },
    [clearBlackoutTimers, disconnectSilently, awaitSpinCompletion, reelCount, scheduleBlackout],
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
      targetIndexes,
      spinBaseMs,
      reachExtraDelayMs,
      blackoutPhase,
      highlightMode,
      showWelcome,
      connectionError,
      symbolMorphToken,
      symbolMorphFromIndex,
      symbolMorphToIndex,
      symbolMorphDurationMs,
      onReachBlink,
      onSpinComplete: notifySpinComplete,
      onWelcomeTap,
      onReconnect: connectWebSocket,
    }),
    [
      spinning,
      targetIndexes,
      spinBaseMs,
      reachExtraDelayMs,
      blackoutPhase,
      highlightMode,
      showWelcome,
      connectionError,
      symbolMorphToken,
      symbolMorphFromIndex,
      symbolMorphToIndex,
      symbolMorphDurationMs,
      onReachBlink,
      notifySpinComplete,
      onWelcomeTap,
      connectWebSocket,
    ],
  );
}
