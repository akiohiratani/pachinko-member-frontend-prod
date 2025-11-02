import React from "react";
import type { SymbolDef } from "../../domain/symbols";

type SlotReelProps = {
  itemHeight: number;
  reelWidth: number;
  cycles: number;
  targetIndex: number;
  spinMs: number;
  easing: string;
  spinning: boolean;
  symbols: readonly SymbolDef[];
};

export function SlotReel({
  itemHeight,
  reelWidth,
  cycles,
  targetIndex,
  spinMs,
  easing,
  spinning,
  symbols,
}: SlotReelProps) {
  const symbolCount = symbols.length;
  const listLength = cycles * symbolCount + symbolCount;
  const trackSymbols = React.useMemo(
    () => Array.from({ length: listLength }, (_, index) => symbols[index % symbolCount]),
    [listLength, symbols, symbolCount],
  );

  const [initialIndex] = React.useState(() =>
    symbolCount > 0 ? Math.floor(Math.random() * symbolCount) : 0,
  );
  const [hasStarted, setHasStarted] = React.useState(false);

  React.useEffect(() => {
    if (spinning) {
      setHasStarted(true);
    }
  }, [spinning]);

  const finalOffset = Math.round(-(cycles * symbolCount * itemHeight + targetIndex * itemHeight));
  const initialOffset = -initialIndex * itemHeight;
  const restingOffset = hasStarted ? 0 : initialOffset;

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
        borderRadius: 12,
        outline: "1px solid #e5e7eb",
        position: "relative",
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
              borderBottom: "1px solid #f0f2f5",
              padding: Math.max(8, Math.floor(itemHeight * 0.08)),
            }}
          >
            <img
              src={symbol.src}
              alt={symbol.alt}
              style={{
                width: "78%",
                height: "78%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 3px rgba(15,23,42,0.10))",
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
