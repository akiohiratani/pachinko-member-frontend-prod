import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLOT_MACHINE_CONFIG } from "../domain/slotMachine";
import { SYMBOLS } from "../domain/symbols";
import { SoundEffects } from "../infrastructure/audio/SoundEffects";
import { SlotWebSocketGateway } from "../infrastructure/slotWebSocketGateway";
import { SlotMachineManager } from "../usecases/slotMachineManager";
import type { RoundStartPayload } from "../usecases/slotMachineManager";
import { SlotMachine } from "./components/SlotMachine";
import { WelcomeModal } from "./components/WelcomeModal";
import { useSlotLayout } from "./hooks/useSlotLayout";

const DEFAULT_WEBSOCKET_URL =
  "wss://12fk8ea9sb.execute-api.ap-northeast-1.amazonaws.com/Prod?role=member";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const layout = useSlotLayout(slotManager.reelCount);

  const [spinning, setSpinning] = useState(false);
  const [targetIndexes, setTargetIndexes] = useState<number[]>(() =>
    Array(slotManager.reelCount).fill(0),
  );
  const [spinBaseMs, setSpinBaseMs] = useState<number>(SLOT_MACHINE_CONFIG.baseSpinMs);
  const [showWelcome, setShowWelcome] = useState(true);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  const websocketUrl = useMemo(
    () => import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL,
    [],
  );

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects("/win.mp3", "/spinStart.mp3");
    soundEffectsRef.current = effects;
    return () => {
      effects.dispose();
      soundEffectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      websocketRef.current?.disconnect();
    };
  }, []);

  const handleRoundStart = useCallback(
    (payload: RoundStartPayload) => {
      const plan = slotManager.planRound(payload);
      setTargetIndexes(plan.targetIndexes);
      setSpinBaseMs(plan.baseSpinDurationMs);

      if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);

      startTimerRef.current = window.setTimeout(() => {
        setSpinning(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setSpinning(true)),
        );

        const effects = soundEffectsRef.current;
        if (effects) {
          (async () => {
            try {
              await effects.playStart(plan.startSound);
            } catch {
              if (plan.startSound === "win") {
                try {
                  await effects.playStart("spin");
                } catch {
                  /* noop */
                }
              }
            }
          })();
        }

        const totalMs = plan.totalSpinMs;
        finishTimerRef.current = window.setTimeout(() => undefined, totalMs + 80);
      }, plan.delayMs);
    },
    [slotManager],
  );

  const connectWebSocket = useCallback(() => {
    if (!websocketRef.current) {
      websocketRef.current = new SlotWebSocketGateway(websocketUrl);
    }
    websocketRef.current.connect(handleRoundStart);
  }, [websocketUrl, handleRoundStart]);

  const enableSound = useCallback(async () => {
    const effects = soundEffectsRef.current;
    if (!effects) return false;
    return effects.enable();
  }, []);

  const handleWelcomeTap = useCallback(async () => {
    const ok = await enableSound();
    if (ok) {
      connectWebSocket();
      setShowWelcome(false);
    }
  }, [enableSound, connectWebSocket]);

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f9",
        padding: layout.isDesktop ? "32px 24px" : "16px 12px",
      }}
    >
      <SlotMachine
        spinning={spinning}
        targetIndexes={targetIndexes}
        reelCount={slotManager.reelCount}
        baseSpinMs={spinBaseMs}
        reelDelayMs={slotManager.reelDelayMs}
        easing={slotManager.easing}
        reelWidth={layout.reelWidth}
        itemHeight={layout.itemHeight}
        framePadding={layout.framePadding}
        gap={layout.gap}
        containerMax={layout.containerMax}
        symbols={SYMBOLS}
      />

      {showWelcome && <WelcomeModal onTap={handleWelcomeTap} />}
    </div>
  );
}
