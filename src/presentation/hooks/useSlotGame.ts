import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultRandom } from "../../domain/random";
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
  winSymbolShiftSequence: number;
  winSymbolShiftMs: number;
};

type SlotGameHandlers = {
  onReachBlink(): void;
  onSpinComplete(): void;
  onWinSymbolShiftComplete(): void;
  onWelcomeTap(): void;
  onReconnect(): void;
};

type SlotGameHook = SlotGameState & SlotGameHandlers;

const WIN_SYMBOL_SHIFT_PROBABILITY = 0.25;
const WIN_SYMBOL_SHIFT_MS = 180;

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
  const [winSymbolShiftSequence, setWinSymbolShiftSequence] = useState(0);
  const [winSymbolShiftMs, setWinSymbolShiftMs] = useState(0);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const roundControllerRef = useRef<SlotRoundController | null>(null);
  const suppressCloseErrorRef = useRef(false);
  const spinCompletionResolverRef = useRef<(() => void) | null>(null);
  const blackoutTimersRef = useRef<number[]>([]);
  const plannedBlackoutDurationRef = useRef<number | null>(null);
  const pendingWinAfterShiftRef = useRef(false);
  const expectedShiftedIndexesRef = useRef<number[] | null>(null);
  const latestTargetIndexesRef = useRef<number[]>(targetIndexes);

  useEffect(() => {
    latestTargetIndexesRef.current = targetIndexes;
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
      plannedBlackoutDurationRef.current = null;
      pendingWinAfterShiftRef.current = false;
      expectedShiftedIndexesRef.current = null;
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
            setSpinBaseMs(roundPlan.baseSpinDurationMs);
            setReachExtraDelayMs(roundPlan.reachExtraDelayMs);
            plannedBlackoutDurationRef.current = roundPlan.fakeReachBlackout?.durationMs ?? null;
            clearBlackoutTimers();
            setBlackoutPhase("off");
            setSpinning(false);
            setHighlightMode("none");
            setWinSymbolShiftMs(0);
            pendingWinAfterShiftRef.current = false;
            expectedShiftedIndexesRef.current = null;
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
            const latestIndexes = latestTargetIndexesRef.current;
            const hasWinningPattern =
              latestIndexes.length > 0 &&
              latestIndexes.every((index) => index === latestIndexes[0]);
            const shouldShiftSymbols =
              hasWinningPattern &&
              SYMBOLS.length > 1 &&
              defaultRandom.float() < WIN_SYMBOL_SHIFT_PROBABILITY;

            if (shouldShiftSymbols) {
              const shiftedIndexes = latestIndexes.map(
                (index) => (index + 1) % SYMBOLS.length,
              );
              pendingWinAfterShiftRef.current = true;
              expectedShiftedIndexesRef.current = shiftedIndexes;
              setWinSymbolShiftMs(WIN_SYMBOL_SHIFT_MS);
              setWinSymbolShiftSequence((value) => value + 1);
              setTargetIndexes(shiftedIndexes);
              return;
            }

            setHighlightMode("win");
            disconnectSilently();
          },
          waitForSpinComplete: awaitSpinCompletion,
        },
        soundEffectsRef.current,
      );
    },
    [clearBlackoutTimers, disconnectSilently, awaitSpinCompletion, scheduleBlackout],
  );


  const onWinSymbolShiftComplete = useCallback(() => {
    if (!pendingWinAfterShiftRef.current) return;

    const expectedIndexes = expectedShiftedIndexesRef.current;
    if (!expectedIndexes) return;

    const latestIndexes = latestTargetIndexesRef.current;
    if (
      latestIndexes.length !== expectedIndexes.length ||
      latestIndexes.some((index, position) => index !== expectedIndexes[position])
    ) {
      return;
    }

    pendingWinAfterShiftRef.current = false;
    expectedShiftedIndexesRef.current = null;
    setWinSymbolShiftMs(0);
    setHighlightMode("win");
    disconnectSilently();
  }, [disconnectSilently]);

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
      winSymbolShiftSequence,
      winSymbolShiftMs,
      onReachBlink,
      onSpinComplete: notifySpinComplete,
      onWinSymbolShiftComplete,
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
      winSymbolShiftSequence,
      winSymbolShiftMs,
      onReachBlink,
      notifySpinComplete,
      onWinSymbolShiftComplete,
      onWelcomeTap,
      connectWebSocket,
    ],
  );
}
