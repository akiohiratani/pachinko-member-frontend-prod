/**
 * Presentation 層のコンテナコンポーネント。
 * Clean Architecture の Presenter として、UI 状態とユースケース・インフラ層の橋渡しを行う。
 */
import { useMemo } from "react";
import { SYMBOLS } from "../domain/symbols";
import { SlotMachineManager } from "../usecases/slotMachineManager";
import { ConnectionErrorDialog } from "./components/ConnectionErrorDialog";
import { SlotMachine } from "./components/SlotMachine";
import { WelcomeModal } from "./components/WelcomeModal";
import { useSlotLayout } from "./hooks/useSlotLayout";
import { useSlotGame } from "./hooks/useSlotGame";
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

  const machineMaxWidth = useMemo(
    () =>
      Math.min(
        slotManager.reelCount * reelWidth + (slotManager.reelCount - 1) * gap,
        containerMax,
      ),
    [slotManager.reelCount, reelWidth, gap, containerMax],
  );
  const surfaceMaxWidth = useMemo(
    () => Math.min(Math.max(machineMaxWidth + 32, 320), isDesktop ? 960 : 720),
    [machineMaxWidth, isDesktop],
  );
  const appClassName = useMemo(
    () => `app ${isDesktop ? "app--desktop" : "app--mobile"}`,
    [isDesktop],
  );

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

  const {
    spinning,
    targetIndexes,
    spinBaseMs,
    reachExtraDelayMs,
    highlightMode,
    showWelcome,
    connectionError,
    onReachBlink,
    onWelcomeTap,
    onReconnect,
  } = useSlotGame(slotManager, websocketUrl);

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
          onReachBlink={onReachBlink}
        />
      </div>

      {highlightMode === "win" && (
        <>
          <div className="slot-machine-win-overlay" />
        </>
      )}
      {showWelcome && <WelcomeModal onTap={onWelcomeTap} />}
      {connectionError && (
        <ConnectionErrorDialog
          message={connectionError}
          onReconnect={onReconnect}
        />
      )}
    </div>
  );
}
