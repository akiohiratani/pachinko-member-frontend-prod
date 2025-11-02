import type { SymbolDef } from "../../domain/symbols";
import { SlotReel } from "./SlotReel";

type SlotMachineProps = {
  spinning: boolean;
  targetIndexes: number[];
  reelCount: number;
  baseSpinMs: number;
  reelDelayMs: number;
  easing: string;
  reachExtraDelayMs: number;
  reelWidth: number;
  itemHeight: number;
  framePadding: number;
  gap: number;
  containerMax: number;
  symbols: readonly SymbolDef[];
};

const cyclesPattern = [8, 9, 10];
// リールが停止する順番を「左 → 右 → 真ん中」となるように定義する。
const STOP_ORDER = [0, 2, 1];

export function SlotMachine({
  spinning,
  targetIndexes,
  reelCount,
  baseSpinMs,
  reelDelayMs,
  easing,
  reachExtraDelayMs,
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
        {Array.from({ length: reelCount }).map((_, reelIndex) => {
          // STOP_ORDER に存在するインデックスをもとに、個々のリールが何番目に停止するかを判断する。
          const orderPosition = STOP_ORDER.indexOf(reelIndex);
          // STOP_ORDER に含まれていない場合（将来リール数が変化したときのフォールバック）は従来通りの順番を採用する。
          const sequentialPosition = orderPosition >= 0 ? orderPosition : reelIndex;
          // 最終リールはリーチ演出分だけ停止を遅らせる。リーチでない場合は 0ms が加算される。
          const reachDelay =
            orderPosition === STOP_ORDER.length - 1 ? reachExtraDelayMs : 0;
          const spinMs = baseSpinMs + reelDelayMs * sequentialPosition + reachDelay;

          return (
            <SlotReel
              key={reelIndex}
              itemHeight={itemHeight}
              reelWidth={reelWidth}
              cycles={cyclesPattern[reelIndex % cyclesPattern.length]}
              targetIndex={targetIndexes[reelIndex] ?? 0}
              spinMs={spinMs}
              easing={easing}
              spinning={spinning}
              symbols={symbols}
            />
          );
        })}
      </div>
    </div>
  );
}
