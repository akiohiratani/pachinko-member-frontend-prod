import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLOT_MACHINE_CONFIG } from "../domain/slotMachine";
import { SYMBOLS } from "../domain/symbols";
import { SoundEffects } from "../infrastructure/audio/SoundEffects";
import { SlotWebSocketGateway } from "../infrastructure/slotWebSocketGateway";
import { SlotMachineManager } from "../usecases/slotMachineManager";
import type { RoundStartPayload } from "../usecases/slotMachineManager";
import { SlotRoundController } from "../usecases/slotRoundController";
import { SlotMachine } from "./components/SlotMachine";
import { WelcomeModal } from "./components/WelcomeModal";
import { useSlotLayout } from "./hooks/useSlotLayout";
import "./App.css";

const DEFAULT_WEBSOCKET_URL =
  "wss://12fk8ea9sb.execute-api.ap-northeast-1.amazonaws.com/Prod?role=member";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const {
    isDesktop,
    orientation,
    containerMax,
    gap,
    reelWidth,
    itemHeight,
  } = useSlotLayout(slotManager.reelCount);
  const machineMaxWidth = useMemo(
    () =>
      orientation === "horizontal"
        ? Math.min(
            slotManager.reelCount * reelWidth +
              (slotManager.reelCount - 1) * gap,
            containerMax,
          )
        : Math.min(reelWidth, containerMax),
    [
      orientation,
      slotManager.reelCount,
      reelWidth,
      gap,
      containerMax,
    ],
  );
  const surfaceMaxWidth = useMemo(
    () =>
      orientation === "horizontal"
        ? Math.min(
            Math.max(machineMaxWidth + 72, 360),
            isDesktop ? 1080 : 800,
          )
        : Math.min(Math.max(machineMaxWidth + 48, 320), 720),
    [machineMaxWidth, isDesktop, orientation],
  );
  const appClassName = useMemo(
    () => `app ${isDesktop ? "app--desktop" : "app--mobile"}`,
    [isDesktop],
  );

  const [spinning, setSpinning] = useState(false);
  const [targetIndexes, setTargetIndexes] = useState<number[]>(() =>
    Array(slotManager.reelCount).fill(0),
  );
  const [spinBaseMs, setSpinBaseMs] = useState<number>(SLOT_MACHINE_CONFIG.baseSpinMs);
  // リーチ時の追加演出時間を個別に管理し、SlotMachine へ伝播させる。
  const [reachExtraDelayMs, setReachExtraDelayMs] = useState<number>(0);
  // UI の演出種別を保持し、SlotMachine 側で点滅エフェクトを切り替える。
  const [highlightMode, setHighlightMode] = useState<"none" | "reach" | "win">("none");
  const [showWelcome, setShowWelcome] = useState(true);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const roundControllerRef = useRef<SlotRoundController | null>(null);

  const websocketUrl = useMemo(
    () => import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL,
    [],
  );

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects(
      "/win.mp3",
      "/spinStart.mp3",
      "/winAlert.mp3",
      "/reach.mp3",
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
    // リーチ演出が終了したら即座に効果音を止め、次の演出で先頭から再生できるようにする。
    soundEffectsRef.current?.stopReachPulse();
  }, [highlightMode]);

  useEffect(() => {
    roundControllerRef.current = new SlotRoundController(slotManager);
    return () => {
      roundControllerRef.current?.dispose();
      roundControllerRef.current = null;
      websocketRef.current?.disconnect();
    };
  }, [slotManager]);

  const handleRoundStart = useCallback(
    (payload: RoundStartPayload) => {
      if (!roundControllerRef.current) {
        roundControllerRef.current = new SlotRoundController(slotManager);
      }
      roundControllerRef.current.handleRoundStart(
        payload,
        {
          onPrepare: (roundPlan) => {
            // ラウンド準備と開始を同期させ、WebSocket メッセージ受信直後に演出へ移行する。
            setSpinBaseMs(roundPlan.baseSpinDurationMs);
            setReachExtraDelayMs(roundPlan.reachExtraDelayMs);
            setSpinning(false);
            // ラウンドの開始直前にハイライトをリセットし、演出を新しい結果へ同期させる。
            setHighlightMode("none");
          },
          onSpin: (indexes) => {
            setTargetIndexes(indexes);
            setSpinning(true);
          },
          onReachStart: () => {
            setHighlightMode("reach");
          },
          onReachEnd: () => {
            setHighlightMode("none");
          },
          onWin: () => {
            setHighlightMode("win");
          },
        },
        soundEffectsRef.current,
      );
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

  const handleReachBlink = useCallback(() => {
    // SlotMachine の点滅開始と同じタイミングでリーチ音を再生する。
    const effects = soundEffectsRef.current;
    if (!effects) return;
    void effects.playReachPulse();
  }, []);

  const handleWelcomeTap = useCallback(async () => {
    const ok = await enableSound();
    if (ok) {
      connectWebSocket();
      setShowWelcome(false);
    }
  }, [enableSound, connectWebSocket]);

  return (
    <div className={appClassName}>
      <div
        className="app__surface"
        style={{
          maxWidth: `${Math.round(surfaceMaxWidth)}px`,
        }}
      >
        <SlotMachine
          spinning={spinning}
          targetIndexes={targetIndexes}
          reelCount={slotManager.reelCount}
          baseSpinMs={spinBaseMs}
          reelDelayMs={slotManager.reelDelayMs}
          easing={slotManager.easing}
          reachExtraDelayMs={reachExtraDelayMs}
          reelWidth={reelWidth}
          itemHeight={itemHeight}
          gap={gap}
          containerMax={containerMax}
          symbols={SYMBOLS}
          highlightMode={highlightMode}
          onReachBlink={handleReachBlink}
          orientation={orientation}
        />
      </div>

      {highlightMode === "win" && <div className="slot-machine-win-overlay" />}
      {showWelcome && <WelcomeModal onTap={handleWelcomeTap} />}
    </div>
  );
}
