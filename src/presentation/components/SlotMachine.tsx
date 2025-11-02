import type { SymbolDef } from "../../domain/symbols";
import { SlotReel } from "./SlotReel";

type SlotMachineProps = {
  spinning: boolean;
  targetIndexes: number[];
  reelCount: number;
  baseSpinMs: number;
  reelDelayMs: number;
  easing: string;
  reelWidth: number;
  itemHeight: number;
  framePadding: number;
  gap: number;
  containerMax: number;
  symbols: readonly SymbolDef[];
};

const cyclesPattern = [8, 9, 10];

export function SlotMachine({
  spinning,
  targetIndexes,
  reelCount,
  baseSpinMs,
  reelDelayMs,
  easing,
  reelWidth,
  itemHeight,
  framePadding,
  gap,
  containerMax,
  symbols,
}: SlotMachineProps) {
  const outerWidth = reelCount * reelWidth + (reelCount - 1) * gap + framePadding * 2;

  return (
    <div
      style={{
        width: Math.min(outerWidth, containerMax),
        padding: framePadding,
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        background: "#ffffff",
        boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
        transform: "translateZ(0)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${reelCount}, ${reelWidth}px)`,
          gap,
        }}
      >
        {Array.from({ length: reelCount }).map((_, reelIndex) => (
          <SlotReel
            key={reelIndex}
            itemHeight={itemHeight}
            reelWidth={reelWidth}
            cycles={cyclesPattern[reelIndex % cyclesPattern.length]}
            targetIndex={targetIndexes[reelIndex] ?? 0}
            spinMs={baseSpinMs + reelDelayMs * reelIndex}
            easing={easing}
            spinning={spinning}
            symbols={symbols}
          />
        ))}
      </div>
    </div>
  );
}
