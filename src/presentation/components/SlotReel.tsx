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

  React.useEffect(() => {
    if (spinning) {
      setHasStarted(true);
    }
  }, [spinning]);

  const finalOffset = Math.round(-(cycles * symbolCount * itemHeight + targetIndex * itemHeight));
  const initialOffset = -initialIndex * itemHeight;
  const restingOffset = hasStarted ? 0 : initialOffset;

  const frameRadius = Math.max(16, Math.round(reelWidth * 0.12));
  const framePadding = Math.max(10, Math.floor(itemHeight * 0.1));
  const symbolScale = reelWidth >= 160 ? 0.88 : 0.84;

  const trackStyle: React.CSSProperties = {
    transitionProperty: "transform",
    transitionDuration: spinning ? `${spinMs}ms` : "0ms",
    transitionTimingFunction: spinning ? easing : "linear",
    transform: `translate3d(0, ${spinning ? finalOffset : restingOffset}px, 0)`,
    willChange: spinning ? "transform" : undefined,
  };

  return (
    <div
      style={{
        width: reelWidth,
        height: itemHeight,
        overflow: "hidden",
        background: "#ffffff",
        borderRadius: frameRadius,
        outline: "1px solid #e5e7eb",
        position: "relative",
        boxShadow: highlightColor
          ? `0 24px 60px rgba(15,23,42,0.28), 0 0 0 5px ${highlightColor}`
          : "0 24px 60px rgba(15,23,42,0.2)",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div style={trackStyle}>
        {trackSymbols.map((symbol, index) => (
          <div
            key={index}
            style={{
              height: itemHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: index % symbolCount === 0 ? "#fafafa" : "#ffffff",
              boxSizing: "border-box",
              borderBottom: "1px solid rgba(226, 232, 240, 0.72)",
              padding: framePadding,
            }}
          >
            <img
              src={symbol.src}
              alt={symbol.alt}
              style={{
                width: `${Math.round(symbolScale * 100)}%`,
                height: `${Math.round(symbolScale * 100)}%`,
                objectFit: "contain",
                filter: "drop-shadow(0 4px 6px rgba(15,23,42,0.12))",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.06), transparent 24%, transparent 76%, rgba(15,23,42,0.06))",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(to bottom, rgba(2,6,23,0.08), rgba(2,6,23,0.08))",
          backgroundRepeat: "no-repeat",
          backgroundPosition: `0 ${Math.floor(itemHeight / 2)}px`,
          backgroundSize: "100% 1px",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
