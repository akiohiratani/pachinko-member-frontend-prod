/**
 * Presentation 層のコンテナコンポーネント。
 * Clean Architecture の Presenter として、UI 状態とユースケース・インフラ層の橋渡しを行う。
 */
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

// Gatekeeper として WebSocket エンドポイントを単一場所で宣言しておく。
const DEFAULT_WEBSOCKET_URL =
  "wss://0qfs0zhpg6.execute-api.ap-northeast-1.amazonaws.com/Akio1113?role=member";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const {
    isDesktop,
    containerMax,
    gap,
    reelWidth,
    itemHeight,
  } = useSlotLayout(slotManager.reelCount);
  // Responsive Layout Calculation: レイアウト Hook から受け取った値をもとに寸法を決定する。
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

  // ViewModel 的な状態群。React Hooks で UI の状態を集約する。
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
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const soundEffectsRef = useRef<SoundEffects | null>(null);
  const websocketRef = useRef<SlotWebSocketGateway | null>(null);
  const roundControllerRef = useRef<SlotRoundController | null>(null);

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("roomId") ?? "";
  }, []);

  const websocketUrl = useMemo(
    () => {
      const baseUrl = import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL;
      if (!roomId) {
        return baseUrl;
      }

      try {
        const url = new URL(baseUrl);
        url.searchParams.set("roomId", roomId);
        return url.toString();
      } catch {
        const separator = baseUrl.includes("?") ? "&" : "?";
        return `${baseUrl}${separator}roomId=${encodeURIComponent(roomId)}`;
      }
    },
    [roomId],
  );

  useEffect(() => {
    slotManager.preloadSymbols();
  }, [slotManager]);

  useEffect(() => {
    const effects = new SoundEffects(
      "/win.mp3",
      "/spinStart.mp3",
      "/winAlert.mp3",
      "/reachmusic.mp3",
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
    setConnectionError(null);
    if (!websocketRef.current) {
      websocketRef.current = new SlotWebSocketGateway(websocketUrl);
    }
    websocketRef.current.connect(handleRoundStart, {
      onOpen: () => setConnectionError(null),
      onError: () =>
        setConnectionError(
          "通信に失敗しました。接続状況を確認し、再接続してください。",
        ),
      onClose: () =>
        setConnectionError("通信が切断されました。再接続してください。"),
    });
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
        />
      </div>

      {highlightMode === "win" && (
        <>
          <div className="slot-machine-win-overlay" />
        </>
      )}
      {showWelcome && <WelcomeModal onTap={handleWelcomeTap} />}
      {connectionError && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label="接続エラー"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "18px",
          }}
        >
          <div
            style={{
              background: "#fff",
              color: "#0f172a",
              borderRadius: 18,
              padding: "20px 20px 16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              width: "min(92vw, 420px)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              接続エラー
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {connectionError}
            </div>
            <button
              type="button"
              onClick={connectWebSocket}
              style={{
                marginTop: 4,
                alignSelf: "flex-end",
                padding: "10px 16px",
                borderRadius: 12,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
              }}
            >
              再接続する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
