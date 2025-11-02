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
  // リーチ時の追加演出時間を個別に管理し、SlotMachine へ伝播させる。
  const [reachExtraDelayMs, setReachExtraDelayMs] = useState<number>(0);
  const [showWelcome, setShowWelcome] = useState(true);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  // ラウンド開始を遅延実行するタイマー。サーバーから指定された startAt まで待機する。
  const startTimerRef = useRef<number | null>(null);
  // スピン完了時刻の管理に利用するタイマー。リール停止とサウンド発火の整合性を保つ。
  const finishTimerRef = useRef<number | null>(null);
  // 勝利確定音を 1 秒遅延で鳴らすための専用タイマー。
  const winSoundTimerRef = useRef<number | null>(null);

  const websocketUrl = useMemo(
    () => import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL,
    [],
  );

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects("/spinStart.mp3", "/winAlert.mp3");
    soundEffectsRef.current = effects;
    return () => {
      effects.dispose();
      soundEffectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (startTimerRef.current) {
        // 次のラウンドが通知された場合に備え、前回の遅延開始処理を確実に破棄する。
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (finishTimerRef.current) {
        // スピン完了タイマーも同様に初期化して、演出時間の重複を防ぐ。
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      if (winSoundTimerRef.current) {
        // 勝利音の遅延実行もキャンセルし、勝利していないラウンドで誤発火しないようにする。
        window.clearTimeout(winSoundTimerRef.current);
        winSoundTimerRef.current = null;
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

      if (startTimerRef.current) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (finishTimerRef.current) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      if (winSoundTimerRef.current) {
        window.clearTimeout(winSoundTimerRef.current);
        winSoundTimerRef.current = null;
      }

      startTimerRef.current = window.setTimeout(() => {
        setSpinning(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setSpinning(true)),
        );

        const effects = soundEffectsRef.current;
        // 各リールのアニメーションを開始するタイミングで開始音を鳴らす。
        effects?.playSpinStart();

        const totalMs = plan.totalSpinMs;
        // totalMs 後にリールが揃う想定なので、その時刻を finishTimer で記録しておく。
        finishTimerRef.current = window.setTimeout(() => undefined, totalMs + 80);

        if (plan.isWin && effects) {
          // 勝利が確定した場合のみ、リール停止から 1 秒後に勝利音を鳴らす。
          // totalMs が停止完了時刻を示すため、+1000ms で仕様どおり 1 秒遅延を実現する。
          winSoundTimerRef.current = window.setTimeout(() => {
            winSoundTimerRef.current = null;
            effects.playWinAlert();
          }, totalMs + 1000);
        }
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
        reachExtraDelayMs={reachExtraDelayMs}
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
