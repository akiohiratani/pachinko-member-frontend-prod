/**
 * Presentation 層のコンテナコンポーネント。
 * Clean Architecture の Presenter として、UI 状態とユースケース・インフラ層の橋渡しを行う。
 */
import { useEffect, useMemo, useState } from "react";
import { SlotMachineManager } from "../usecases/slotMachineManager";
import { ConnectionErrorDialog } from "./components/ConnectionErrorDialog";
import { SlotMachineSurface } from "./components/SlotMachineSurface";
import { WelcomeModal } from "./components/WelcomeModal";
import { useSlotLayout } from "./hooks/useSlotLayout";
import { useSlotGame } from "./hooks/useSlotGame";
import { useViewportMotionGuard } from "./hooks/useViewportMotionGuard";
import { useWebsocketUrl } from "./hooks/useWebsocketUrl";
import "./App.css";

const LIGHTNING_VIEWBOX_WIDTH = 1000;
const LIGHTNING_VIEWBOX_HEIGHT = 1000;
const LIGHTNING_SEGMENT_COUNT = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createLightningPath(seed: number, baseY: number): string {
  let state = seed;
  const nextRandom = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const points: string[] = [];
  for (let index = 0; index <= LIGHTNING_SEGMENT_COUNT; index += 1) {
    const progress = index / LIGHTNING_SEGMENT_COUNT;
    const x = Math.round(progress * LIGHTNING_VIEWBOX_WIDTH);
    const verticalJitter = (nextRandom() - 0.5) * 230;
    const y = clamp(baseY + verticalJitter, 80, LIGHTNING_VIEWBOX_HEIGHT - 80);
    points.push(`${x},${Math.round(y)}`);
  }

  return `M ${points.join(" L ")}`;
}

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
  const [lightningSeed, setLightningSeed] = useState(1);

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

  useEffect(() => {
    if (blackoutPhase !== "closed") return;
    setLightningSeed((value) => value + 1);
  }, [blackoutPhase]);

  const lightningPaths = useMemo(
    () => [
      createLightningPath(lightningSeed * 17 + 11, 320),
      createLightningPath(lightningSeed * 31 + 7, 700),
    ],
    [lightningSeed],
  );

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
          <svg
            className="slot-machine-blackout-overlay__lightning"
            viewBox={`0 0 ${LIGHTNING_VIEWBOX_WIDTH} ${LIGHTNING_VIEWBOX_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <path
              className="slot-machine-blackout-overlay__lightning-path slot-machine-blackout-overlay__lightning-path--main"
              d={lightningPaths[0]}
            />
            <path
              className="slot-machine-blackout-overlay__lightning-path slot-machine-blackout-overlay__lightning-path--sub"
              d={lightningPaths[1]}
            />
          </svg>
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
