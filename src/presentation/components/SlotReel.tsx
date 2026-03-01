/**
 * 個別のリール描画を担う Pure Component。
 * SlotMachine から委譲される Props のみで描画が決定する。
 */
import React from "react";
import type { SymbolDef } from "../../domain/symbols";

type SlotReelProps = {
  itemHeight: number;
  reelWidth: number;
  cycles: number;
  targetIndex: number;
  fakeStop: {
    fakeIndex: number;
    shiftDelayMs: number;
    shiftDurationMs: number;
  } | null;
  initialIndex?: number;
  spinMs: number;
  easing: string;
  spinning: boolean;
  symbols: readonly SymbolDef[];
  highlightColor: string | null;
  targetTransitionMs?: number | null;
  spinToken: number;
  onSettled?: (token: number) => void;
};

type ReelPhase = "normal" | "fake" | "final";

export function SlotReel({
  itemHeight,
  reelWidth,
  cycles,
  targetIndex,
  fakeStop,
  initialIndex: initialIndexProp,
  spinMs,
  easing,
  spinning,
  symbols,
  highlightColor,
  targetTransitionMs,
  spinToken,
  onSettled,
}: SlotReelProps) {
  const symbolCount = symbols.length;
  const listLength = cycles * symbolCount + symbolCount;
  const trackSymbols = React.useMemo(
    () => Array.from({ length: listLength }, (_, index) => symbols[index % symbolCount]),
    [listLength, symbols, symbolCount],
  );

  const [initialIndex] = React.useState(() => {
    if (typeof initialIndexProp === "number") {
      return initialIndexProp % (symbolCount || 1);
    }
    return symbolCount > 0 ? Math.floor(Math.random() * symbolCount) : 0;
  });
  const [hasStarted, setHasStarted] = React.useState(false);
  const [displayTargetIndex, setDisplayTargetIndex] = React.useState(targetIndex);
  const [activeTransitionMs, setActiveTransitionMs] = React.useState(spinMs);
  const phaseRef = React.useRef<ReelPhase>("normal");
  const reportedTokenRef = React.useRef<number | null>(null);
  const shiftTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);

  React.useEffect(() => {
    if (shiftTimerRef.current !== null) {
      window.clearTimeout(shiftTimerRef.current);
      shiftTimerRef.current = null;
    }

    if (!spinning) {
      phaseRef.current = "normal";
      setDisplayTargetIndex(targetIndex);
      return;
    }

    setHasStarted(true);
    setActiveTransitionMs(targetTransitionMs ?? spinMs);

    // リーチ当選時の一部でのみ、中央リールを「フェイク停止 → 本停止」の 2 段階にする。
    if (!fakeStop || fakeStop.fakeIndex === targetIndex) {
      phaseRef.current = "normal";
      setDisplayTargetIndex(targetIndex);
      return;
    }

    phaseRef.current = "fake";
    setDisplayTargetIndex(fakeStop.fakeIndex);
    shiftTimerRef.current = window.setTimeout(() => {
      phaseRef.current = "final";
      setActiveTransitionMs(fakeStop.shiftDurationMs);
      setDisplayTargetIndex(targetIndex);
      shiftTimerRef.current = null;
    }, spinMs + fakeStop.shiftDelayMs);

    return () => {
      if (shiftTimerRef.current !== null) {
        window.clearTimeout(shiftTimerRef.current);
        shiftTimerRef.current = null;
      }
    };
  }, [fakeStop, spinMs, spinning, targetIndex, targetTransitionMs]);

  React.useEffect(() => {
    if (spinning) {
      reportedTokenRef.current = null;
    }
  }, [spinning, spinToken]);

  const finalOffset = Math.round(
    -(cycles * symbolCount * itemHeight + displayTargetIndex * itemHeight),
  );
  const initialOffset = -initialIndex * itemHeight;
  const restingOffset = hasStarted ? 0 : initialOffset;

  const trackStyle: React.CSSProperties = {
    transitionProperty: "transform",
    transitionDuration: spinning ? `${activeTransitionMs}ms` : "0ms",
    transitionTimingFunction: spinning ? easing : "linear",
    transform: `translate3d(0, ${spinning ? finalOffset : restingOffset}px, 0)`,
    willChange: spinning ? "transform" : undefined,
  };

  const handleTransitionEnd = React.useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (!spinning) return;
      if (event.propertyName !== "transform") return;
      // フェイク停止演出中は最終停止（phase: final）まで完了通知しない。
      if (phaseRef.current === "fake") return;
      if (reportedTokenRef.current === spinToken) return;
      reportedTokenRef.current = spinToken;
      onSettled?.(spinToken);
    },
    [onSettled, spinToken, spinning],
  );

  return (
    <div
      style={{
        width: reelWidth,
        height: itemHeight,
        overflow: "hidden",
        background: "rgba(255,255,255,0.92)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        position: "relative",
        boxShadow: highlightColor
          ? `0 20px 40px rgba(15,23,42,0.25), 0 0 0 4px ${highlightColor}`
          : "0 20px 40px rgba(15,23,42,0.18)",
        transition:
          "box-shadow 0.3s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        transform: spinning ? "scale(1.12)" : "scale(1)",
      }}
    >
      <div style={trackStyle} onTransitionEnd={handleTransitionEnd}>
        {trackSymbols.map((symbol, index) => (
          <div
            key={index}
            style={{
              height: itemHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: index % symbolCount === 0 ? "#f8fafc" : "#ffffff",
              boxSizing: "border-box",
              padding: Math.max(8, Math.floor(itemHeight * 0.08)),
            }}
          >
            <img
              src={symbol.src}
              alt={symbol.alt}
              style={{
                width: "80%",
                height: "80%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 3px rgba(15,23,42,0.10))",
                userSelect: "none",
                pointerEvents: "none",
                transform: spinning ? "scale(1.18)" : "scale(1)",
                transition:
                  "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), filter 0.35s ease",
              }}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
