import { useEffect, useState } from "react";
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
  framePadding: number;
  gap: number;
  containerMax: number;
  symbols: readonly SymbolDef[];
  highlightMode: "none" | "reach" | "win";
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
  highlightMode,
}: SlotMachineProps) {
  const outerWidth = reelCount * reelWidth + (reelCount - 1) * gap + framePadding * 2;
  // リーチ演出中は色をランダムに切り替えて枠の点滅色を決定する。
  const [reachBlinkColor, setReachBlinkColor] = useState<string | null>(null);

  useEffect(() => {
    if (!spinning || highlightMode !== "reach") {
      setReachBlinkColor(null);
      return;
    }
    const colors = [
      "rgba(59,130,246,0.55)",
      "rgba(239,68,68,0.55)",
      "rgba(34,197,94,0.55)",
    ];
    const pickColor = () => {
      const index = Math.floor(Math.random() * colors.length);
      setReachBlinkColor(colors[index]);
    };
    pickColor();
    const timer = window.setInterval(pickColor, 420);
    return () => window.clearInterval(timer);
  }, [spinning, highlightMode]);

  const frameClassNames = ["slot-machine-frame"];
  if (spinning && highlightMode === "reach") {
    // リーチ中のみ擬似要素に点滅アニメーションを適用する。
    frameClassNames.push("slot-machine-frame--reach");
  }

  const frameStyle: CSSProperties & { "--blink-color"?: string } = {
    width: Math.min(outerWidth, containerMax),
    padding: framePadding,
    borderRadius: 20,
    transform: "translateZ(0)",
    position: "relative",
  };

  if (reachBlinkColor) {
    frameStyle["--blink-color"] = reachBlinkColor;
  }

  return (
    <div className={frameClassNames.join(" ")} style={frameStyle}>
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
