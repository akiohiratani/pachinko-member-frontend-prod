import { useEffect, useState } from "react";

export function useSlotLayout(reelCount: number) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 375,
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isDesktop = viewportWidth >= 1024;
  const containerMax = Math.min(viewportWidth * 0.92, isDesktop ? 720 : 420);
  const gap = isDesktop ? 16 : 10;
  const framePadding = isDesktop ? 16 : 12;

  const rawReel = (containerMax - framePadding * 2 - gap * (reelCount - 1)) / reelCount;
  const minReel = isDesktop ? 88 : 72;
  const maxReel = isDesktop ? 152 : 120;
  const reelWidth = Math.max(minReel, Math.min(maxReel, Math.floor(rawReel)));
  const itemHeight = isDesktop ? Math.round(reelWidth * 1.05) : Math.round(reelWidth * 0.92);

  return {
    isDesktop,
    containerMax,
    gap,
    framePadding,
    reelWidth,
    itemHeight,
  };
}
