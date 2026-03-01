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
import { useViewportMotionGuard } from "./hooks/useViewportMotionGuard";
import { useWebsocketUrl } from "./hooks/useWebsocketUrl";
import "./App.css";

export default function App() {
  const slotManager = useMemo(() => new SlotMachineManager(), []);
  const layout = useSlotLayout(slotManager.reelCount);
  const animationsEnabled = useViewportMotionGuard();
  const appClassName = useMemo(
    () => `app ${layout.isDesktop ? "app--desktop" : "app--mobile"}`,
    [layout.isDesktop],
  );

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("roomId") ?? "";
  }, []);

  const websocketUrl = useWebsocketUrl(roomId);

  const {
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
    onSpinComplete,
    onWinSymbolShiftComplete,
    onWelcomeTap,
    onReconnect,
  } = useSlotGame(slotManager, websocketUrl);

  const safeSpinning = animationsEnabled ? spinning : false;

  return (
    <div className={appClassName}>
      <SlotMachineSurface
        layout={layout}
        slotManager={slotManager}
        spinning={safeSpinning}
        targetIndexes={targetIndexes}
        spinBaseMs={spinBaseMs}
        reachExtraDelayMs={reachExtraDelayMs}
        highlightMode={highlightMode}
        winSymbolShiftSequence={winSymbolShiftSequence}
        winSymbolShiftMs={winSymbolShiftMs}
        onReachBlink={onReachBlink}
        onSpinComplete={onSpinComplete}
        onWinSymbolShiftComplete={onWinSymbolShiftComplete}
        animationsEnabled={animationsEnabled}
      />

      {blackoutPhase !== "off" && (
        <div
          className={`slot-machine-blackout-overlay slot-machine-blackout-overlay--${blackoutPhase}`}
          aria-hidden="true"
        >
          <div className="slot-machine-blackout-overlay__lightning" />
        </div>
      )}

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
