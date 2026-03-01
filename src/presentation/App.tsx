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
    reachFakeoutEnabled,
    reachFakeoutIndex,
    reachFakeoutShiftMs,
    highlightMode,
    showWelcome,
    connectionError,
    onReachBlink,
    onSpinComplete,
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
        reachFakeoutEnabled={reachFakeoutEnabled}
        reachFakeoutIndex={reachFakeoutIndex}
        reachFakeoutShiftMs={reachFakeoutShiftMs}
        highlightMode={highlightMode}
        onReachBlink={onReachBlink}
        onSpinComplete={onSpinComplete}
        animationsEnabled={animationsEnabled}
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
