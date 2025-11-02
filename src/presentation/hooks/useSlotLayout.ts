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
  const containerMax = Math.min(
    viewportWidth * (isDesktop ? 0.9 : 0.96),
    isDesktop ? 900 : 540,
  );
  const gap = isDesktop ? 20 : 14;

  const rawReel = (containerMax - gap * (reelCount - 1)) / reelCount;
  const minReel = isDesktop ? 104 : 84;
  const maxReel = isDesktop ? 192 : 148;
  const reelWidth = Math.max(minReel, Math.min(maxReel, Math.floor(rawReel)));
  const itemHeight = isDesktop
    ? Math.round(reelWidth * 1.15)
    : Math.round(reelWidth * 1.02);

  return {
    isDesktop,
    containerMax,
    gap,
    reelWidth,
    itemHeight,
  };
}
