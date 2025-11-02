import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { SymbolDef } from "../../domain/symbols";
import { SlotReel } from "./SlotReel";
import "./SlotMachine.css";

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
  gap: number;
  containerMax: number;
  symbols: readonly SymbolDef[];
  highlightMode: "none" | "reach" | "win";
  onReachBlink?: () => void;
  orientation: "horizontal" | "vertical";
};

const cyclesPattern = [8, 9, 10];
// リールが停止する順番を「端 → 反対の端 → 中央」となるように定義する。
const STOP_ORDER = [0, 2, 1];

function createInitialIndexes(reelCount: number, symbols: readonly SymbolDef[]) {
  const symbolCount = symbols.length;
  if (reelCount <= 0) return [];
  if (symbolCount <= 0) return Array(reelCount).fill(0);

  const indexes = Array.from({ length: reelCount }, () =>
    Math.floor(Math.random() * symbolCount),
  );

  if (reelCount === 1 || symbolCount === 1) {
    return indexes;
  }

  const first = indexes[0];
  const allSame = indexes.every((value) => value === first);
  if (!allSame) {
    return indexes;
  }

  const replaceAt = Math.floor(Math.random() * reelCount);
  const alternativeOffset = Math.floor(Math.random() * (symbolCount - 1)) + 1;
  indexes[replaceAt] = (first + alternativeOffset) % symbolCount;
  return indexes;
}

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
  gap,
  containerMax,
  symbols,
  highlightMode,
  onReachBlink,
  orientation,
}: SlotMachineProps) {
  const outerWidth =
    orientation === "horizontal"
      ? reelCount * reelWidth + (reelCount - 1) * gap
      : reelWidth;
  const machineMaxWidth = Math.min(outerWidth, containerMax);
  // リーチ演出中は色をランダムに切り替えて枠の点滅色を決定する。
  const [reachBlinkColor, setReachBlinkColor] = useState<string | null>(null);
  const initialIndexes = useMemo(
    () => createInitialIndexes(reelCount, symbols),
    [reelCount, symbols],
  );

  useEffect(() => {
    if (!spinning || highlightMode !== "reach") {
      setReachBlinkColor(null);
      return;
    }
    const colors = [
      "rgba(59,130,246,0.45)",
      "rgba(239,68,68,0.45)",
      "rgba(34,197,94,0.45)",
    ];
    let visible = false;
    const toggleColor = () => {
      visible = !visible;
      if (!visible) {
        setReachBlinkColor(null);
        return;
      }
      const index = Math.floor(Math.random() * colors.length);
      setReachBlinkColor(colors[index]);
      // 点滅が始まった瞬間にコールバックを呼び出し、リーチ音の再生タイミングを合わせる。
      onReachBlink?.();
    };
    toggleColor();
    const timer = window.setInterval(toggleColor, 360);
    return () => window.clearInterval(timer);
  }, [spinning, highlightMode, onReachBlink]);

  const machineStyle: CSSProperties = {
    width: "100%",
    maxWidth: machineMaxWidth,
    margin: "0 auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "max-width 0.3s ease",
  };

  const layoutStyle: CSSProperties =
    orientation === "horizontal"
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(${reelCount}, ${reelWidth}px)`,
          gap,
        }
      : {
          display: "grid",
          gridTemplateRows: `repeat(${reelCount}, ${itemHeight}px)`,
          gap,
          width: reelWidth,
          justifyItems: "stretch",
        };

  return (
    <div className="slot-machine" style={machineStyle}>
      <div style={layoutStyle}>
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
              initialIndex={initialIndexes[reelIndex] ?? 0}
              spinMs={spinMs}
              easing={easing}
              spinning={spinning}
              symbols={symbols}
              highlightColor={
                spinning && highlightMode === "reach" ? reachBlinkColor : null
              }
            />
          );
        })}
      </div>
    </div>
  );
}
