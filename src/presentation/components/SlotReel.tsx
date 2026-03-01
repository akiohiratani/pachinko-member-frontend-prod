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
  highlightColor: string | null;
  symbolMorphToken: number;
  symbolMorphFromIndex: number | null;
  symbolMorphToIndex: number | null;
  symbolMorphDurationMs: number;
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
  highlightColor,
  symbolMorphToken,
  symbolMorphFromIndex,
  symbolMorphToIndex,
  symbolMorphDurationMs,
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
  const reportedTokenRef = React.useRef<number | null>(null);

  const [symbolMorphActive, setSymbolMorphActive] = React.useState(false);
  const symbolMorphClearTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (symbolMorphClearTimerRef.current !== null) {
      window.clearTimeout(symbolMorphClearTimerRef.current);
      symbolMorphClearTimerRef.current = null;
    }

    const canMorph =
      symbolMorphFromIndex !== null &&
      symbolMorphToIndex !== null &&
      symbolMorphDurationMs > 0;

    if (!canMorph) {
      setSymbolMorphActive(false);
      return;
    }

    setSymbolMorphActive(true);
    symbolMorphClearTimerRef.current = window.setTimeout(() => {
      symbolMorphClearTimerRef.current = null;
      setSymbolMorphActive(false);
    }, symbolMorphDurationMs);

    return () => {
      if (symbolMorphClearTimerRef.current !== null) {
        window.clearTimeout(symbolMorphClearTimerRef.current);
        symbolMorphClearTimerRef.current = null;
      }
    };
  }, [symbolMorphDurationMs, symbolMorphFromIndex, symbolMorphToIndex, symbolMorphToken]);

  React.useEffect(() => {
    if (!spinning) {
      setDisplayTargetIndex(targetIndex);
      return;
    }

    setHasStarted(true);
    setDisplayTargetIndex(targetIndex);
  }, [spinMs, spinning, targetIndex]);

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
    transitionDuration: spinning ? `${spinMs}ms` : "0ms",
    transitionTimingFunction: spinning ? easing : "linear",
    transform: `translate3d(0, ${spinning ? finalOffset : restingOffset}px, 0)`,
    willChange: spinning ? "transform" : undefined,
  };

  const handleTransitionEnd = React.useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (!spinning) return;
      if (event.propertyName !== "transform") return;
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
      {symbolMorphActive && symbolMorphFromIndex !== null && symbolMorphToIndex !== null && (
        <div
          className="slot-reel-symbol-morph"
          style={{
            animationDuration: `${symbolMorphDurationMs}ms`,
          }}
          aria-hidden="true"
        >
          <img
            className="slot-reel-symbol-morph__from"
            src={symbols[symbolMorphFromIndex]?.src}
            alt=""
            draggable={false}
          />
          <img
            className="slot-reel-symbol-morph__to"
            src={symbols[symbolMorphToIndex]?.src}
            alt=""
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
