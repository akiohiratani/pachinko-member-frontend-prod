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
  initialIndex?: number;
  spinMs: number;
  easing: string;
  spinning: boolean;
  symbols: readonly SymbolDef[];
  fakeStopEnabled?: boolean;
  fakeStopIndex?: number;
  highlightColor: string | null;
  spinToken: number;
  onSettled?: (token: number) => void;
};

export function SlotReel({
  itemHeight,
  reelWidth,
  cycles,
  targetIndex,
  initialIndex: initialIndexProp,
  spinMs,
  easing,
  spinning,
  symbols,
  fakeStopEnabled = false,
  fakeStopIndex,
  highlightColor,
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
  const [phase, setPhase] = React.useState<"idle" | "primary" | "fakeHold" | "final">("idle");
  const reportedTokenRef = React.useRef<number | null>(null);
  const fakeHoldTimerRef = React.useRef<number | null>(null);

  const normalizedTargetIndex = ((targetIndex % (symbolCount || 1)) + (symbolCount || 1)) % (symbolCount || 1);
  const resolvedFakeStopIndex =
    typeof fakeStopIndex === "number"
      ? ((fakeStopIndex % (symbolCount || 1)) + (symbolCount || 1)) % (symbolCount || 1)
      : ((normalizedTargetIndex + (symbolCount || 1) - 1) % (symbolCount || 1));
  const shouldUseFakeStop = fakeStopEnabled && symbolCount > 1;

  React.useEffect(() => {
    if (spinning) {
      setHasStarted(true);
      setPhase("primary");
    } else {
      setPhase("idle");
    }
  }, [spinning]);

  React.useEffect(() => {
    if (spinning) {
      reportedTokenRef.current = null;
    }
  }, [spinning, spinToken]);

  React.useEffect(() => {
    return () => {
      if (fakeHoldTimerRef.current !== null) {
        window.clearTimeout(fakeHoldTimerRef.current);
      }
    };
  }, []);

  const primaryStopIndex = shouldUseFakeStop ? resolvedFakeStopIndex : normalizedTargetIndex;
  const primaryOffset = Math.round(
    -(cycles * symbolCount * itemHeight + primaryStopIndex * itemHeight),
  );
  const finalOffset = Math.round(
    -(cycles * symbolCount * itemHeight + normalizedTargetIndex * itemHeight),
  );
  const initialOffset = -initialIndex * itemHeight;
  const restingOffset = hasStarted ? 0 : initialOffset;

  const currentOffset = spinning
    ? phase === "final"
      ? finalOffset
      : primaryOffset
    : restingOffset;

  const currentDurationMs = spinning
    ? phase === "final"
      ? 180
      : spinMs
    : 0;

  const currentEasing = spinning
    ? phase === "final"
      ? "cubic-bezier(0.22, 1, 0.36, 1)"
      : easing
    : "linear";

  const trackStyle: React.CSSProperties = {
    transitionProperty: "transform",
    transitionDuration: `${currentDurationMs}ms`,
    transitionTimingFunction: currentEasing,
    transform: `translate3d(0, ${currentOffset}px, 0)`,
    willChange: spinning ? "transform" : undefined,
  };

  const handleTransitionEnd = React.useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (!spinning) return;
      if (event.propertyName !== "transform") return;
      if (phase === "primary" && shouldUseFakeStop) {
        setPhase("fakeHold");
        const holdMs = 100 + Math.floor(Math.random() * 301);
        if (fakeHoldTimerRef.current !== null) {
          window.clearTimeout(fakeHoldTimerRef.current);
        }
        fakeHoldTimerRef.current = window.setTimeout(() => {
          setPhase("final");
        }, holdMs);
        return;
      }
      if (phase !== "final" && shouldUseFakeStop) {
        return;
      }
      if (reportedTokenRef.current === spinToken) return;
      reportedTokenRef.current = spinToken;
      onSettled?.(spinToken);
    },
    [onSettled, phase, shouldUseFakeStop, spinToken, spinning],
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
