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
import "./App.css";

const DEFAULT_WEBSOCKET_URL =
  "wss://12fk8ea9sb.execute-api.ap-northeast-1.amazonaws.com/Prod?role=member";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const {
    isDesktop,
    containerMax,
    gap,
    reelWidth,
    itemHeight,
  } = useSlotLayout(slotManager.reelCount);
  const machineMaxWidth = useMemo(
    () =>
      Math.min(
        slotManager.reelCount * reelWidth + (slotManager.reelCount - 1) * gap,
        containerMax,
      ),
    [slotManager.reelCount, reelWidth, gap, containerMax],
  );
  const surfaceMaxWidth = useMemo(
    () =>
      Math.min(Math.max(machineMaxWidth + 32, 320), isDesktop ? 960 : 720),
    [machineMaxWidth, isDesktop],
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
  const startTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  // リーチ開始と終了のタイマーを個別に保持し、点滅の発火タイミングを制御する。
  const reachStartTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  const websocketUrl = useMemo(
    () => import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL,
    [],
  );

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects("/win.mp3", "/spinStart.mp3", "/winAlert.mp3");
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
      if (reachStartTimerRef.current) {
        window.clearTimeout(reachStartTimerRef.current);
        reachStartTimerRef.current = null;
      }
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      websocketRef.current?.disconnect();
    };
  }, []);

  const handleRoundStart = useCallback(
    (payload: RoundStartPayload) => {
      const plan = slotManager.planRound(payload);
      setTargetIndexes(plan.targetIndexes);
      setSpinBaseMs(plan.baseSpinDurationMs);
      setReachExtraDelayMs(plan.reachExtraDelayMs);

      if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      if (reachStartTimerRef.current) {
        window.clearTimeout(reachStartTimerRef.current);
        reachStartTimerRef.current = null;
      }
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }

      const shouldBlinkReach =
        // 当たり・外れを問わず左右の図柄が一致したらリーチ演出を発火させ、結果を推測されないようにする。
        slotManager.reelCount >= 3 &&
        plan.targetIndexes.length >= 3 &&
        plan.targetIndexes[0] === plan.targetIndexes[2];
      // 右リールが停止するまでの時間を算出し、停止後に点滅を開始する。
      const rightReelStopMs = plan.baseSpinDurationMs + slotManager.reelDelayMs;

      startTimerRef.current = window.setTimeout(() => {
        setSpinning(false);
        // ラウンドの開始直前にハイライトをリセットし、演出を新しい結果へ同期させる。
        setHighlightMode("none");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setSpinning(true);
            if (shouldBlinkReach) {
              reachStartTimerRef.current = window.setTimeout(() => {
                setHighlightMode("reach");
                reachStartTimerRef.current = null;
                const remainingMs = plan.totalSpinMs - rightReelStopMs;
                if (remainingMs > 0) {
                  highlightTimerRef.current = window.setTimeout(() => {
                    setHighlightMode("none");
                    highlightTimerRef.current = null;
                  }, remainingMs);
                }
              }, Math.max(0, rightReelStopMs));
            }
          }),
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
        finishTimerRef.current = window.setTimeout(() => {
          // 全リール停止後に勝利判定を確認し、0.3 秒遅らせて確定音を鳴らす。
          if (!plan.isWin) return;
          const effects = soundEffectsRef.current;
          if (!effects) return;
          (async () => {
            try {
              await effects.playWinAlert();
              // 大当たり音の再生が完了したタイミングで虹色の演出を開始する。
              if (reachStartTimerRef.current) {
                // リーチ演出のタイマーが残っている場合は停止し、勝利演出に割り込まないようにする。
                window.clearTimeout(reachStartTimerRef.current);
                reachStartTimerRef.current = null;
              }
              if (highlightTimerRef.current) {
                // リーチ用のハイライト解除タイマーが勝利演出を打ち消さないよう事前に無効化する。
                window.clearTimeout(highlightTimerRef.current);
                highlightTimerRef.current = null;
              }
              setHighlightMode("win");
            } catch {
              /* 音声再生に失敗した場合は演出を開始しない。 */
            }
          })();
        }, totalMs);
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
        />
      </div>

      {highlightMode === "win" && <div className="slot-machine-win-overlay" />}
      {showWelcome && <WelcomeModal onTap={handleWelcomeTap} />}
    </div>
  );
}
