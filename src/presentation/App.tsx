/**
 * Presentation 層のコンテナコンポーネント。
 * Clean Architecture の Presenter として、UI 状態とユースケース・インフラ層の橋渡しを行う。
 */
import { useMemo } from "react";
import { SlotMachineManager } from "../usecases/slotMachineManager";
import { ConnectionErrorDialog } from "./components/ConnectionErrorDialog";
import { SlotMachineSurface } from "./components/SlotMachineSurface";
import { WelcomeModal } from "./components/WelcomeModal";
import { useSlotLayout } from "./hooks/useSlotLayout";
import { useSlotGame } from "./hooks/useSlotGame";
import "./App.css";

// Gatekeeper として WebSocket エンドポイントを単一場所で宣言しておく。
const DEFAULT_WEBSOCKET_URL =
  "wss://0qfs0zhpg6.execute-api.ap-northeast-1.amazonaws.com/Akio1113?role=member";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const layout = useSlotLayout(slotManager.reelCount);
  const appClassName = useMemo(
    () => `app ${layout.isDesktop ? "app--desktop" : "app--mobile"}`,
    [layout.isDesktop],
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
      <SlotMachineSurface
        layout={layout}
        slotManager={slotManager}
        spinning={spinning}
        targetIndexes={targetIndexes}
        spinBaseMs={spinBaseMs}
        reachExtraDelayMs={reachExtraDelayMs}
        highlightMode={highlightMode}
        onReachBlink={onReachBlink}
      />

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
