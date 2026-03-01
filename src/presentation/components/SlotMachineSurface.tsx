import { SYMBOLS } from "../../domain/symbols";
import type { SlotMachineManager } from "../../usecases/slotMachineManager";
import { SlotMachine } from "./SlotMachine";
import type { SlotLayout } from "../hooks/useSlotLayout";

const SPIN_SCALE_MULTIPLIER = 1.26;

type SlotMachineSurfaceProps = {
  layout: SlotLayout;
  slotManager: SlotMachineManager;
  spinning: boolean;
  targetIndexes: number[];
  spinBaseMs: number;
  reachExtraDelayMs: number;
  reachFakeoutEnabled: boolean;
  reachFakeoutIndex: number;
  reachFakeoutShiftMs: number;
  highlightMode: "none" | "reach" | "win";
  onReachBlink?: () => void;
  onSpinComplete?: () => void;
  animationsEnabled?: boolean;
};

export function SlotMachineSurface({
  layout,
  slotManager,
  spinning,
  targetIndexes,
  spinBaseMs,
  reachExtraDelayMs,
  reachFakeoutEnabled,
  reachFakeoutIndex,
  reachFakeoutShiftMs,
  highlightMode,
  onReachBlink,
  onSpinComplete,
  animationsEnabled = true,
}: SlotMachineSurfaceProps) {
  const { isDesktop, containerMax, gap, reelWidth, itemHeight } = layout;
  const outerWidth = slotManager.reelCount * reelWidth + (slotManager.reelCount - 1) * gap;
  const machineScale = Math.min(1, containerMax / (outerWidth * SPIN_SCALE_MULTIPLIER));
  const machineMaxWidth = Math.min(outerWidth, containerMax / machineScale);
  const visualWidth = Math.min(outerWidth * machineScale, containerMax);
  const surfaceMaxWidth = Math.min(
    Math.max(Math.round(visualWidth + 32), 320),
    isDesktop ? 960 : 720,
  );

  return (
    <div
      className="app__surface"
      style={{
        maxWidth: surfaceMaxWidth,
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
        reachFakeoutEnabled={reachFakeoutEnabled}
        reachFakeoutIndex={reachFakeoutIndex}
        reachFakeoutShiftMs={reachFakeoutShiftMs}
        reelWidth={reelWidth}
        itemHeight={itemHeight}
        gap={gap}
        containerMax={machineMaxWidth}
        symbols={SYMBOLS}
        highlightMode={highlightMode}
        onReachBlink={onReachBlink}
        onSpinComplete={onSpinComplete}
        machineScale={machineScale}
        animationsEnabled={animationsEnabled}
      />
    </div>
  );
}
