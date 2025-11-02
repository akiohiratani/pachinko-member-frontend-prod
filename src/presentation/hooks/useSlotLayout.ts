import { useEffect, useState } from "react";

type SlotOrientation = "horizontal" | "vertical";

type Viewport = {
  width: number;
  height: number;
};

export function useSlotLayout(reelCount: number) {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 375,
    height: typeof window !== "undefined" ? window.innerHeight : 667,
  }));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { width: viewportWidth, height: viewportHeight } = viewport;
  const isDesktop = viewportWidth >= 1024;
  const orientation: SlotOrientation = isDesktop ? "horizontal" : "vertical";

  let containerMax: number;
  let gap: number;
  let reelWidth: number;
  let itemHeight: number;

  if (orientation === "horizontal") {
    containerMax = Math.min(
      viewportWidth * (isDesktop ? 0.9 : 0.96),
      isDesktop ? 900 : 540,
    );
    gap = isDesktop ? 20 : 14;

    const rawReel = (containerMax - gap * (reelCount - 1)) / reelCount;
    const minReel = isDesktop ? 104 : 84;
    const maxReel = isDesktop ? 192 : 148;
    reelWidth = Math.max(minReel, Math.min(maxReel, Math.floor(rawReel)));
    itemHeight = isDesktop
      ? Math.round(reelWidth * 1.15)
      : Math.round(reelWidth * 1.02);
  } else {
    containerMax = Math.min(viewportWidth * 0.94, 520);
    gap = Math.max(12, Math.min(24, Math.round(viewportWidth * 0.05)));

    const minReel = 156;
    const maxReel = Math.min(360, Math.round(viewportWidth * 0.92));
    const targetWidth = Math.max(
      minReel,
      Math.min(maxReel, Math.floor(containerMax)),
    );
    const availableHeight = Math.max(
      Math.min(viewportHeight * 0.82, 960),
      540,
    );
    const baseHeight = Math.round(targetWidth * 1.12);
    const stackHeight = baseHeight * reelCount + gap * (reelCount - 1);
    const scale = stackHeight > availableHeight
      ? Math.max(0.72, availableHeight / stackHeight)
      : 1;

    reelWidth = Math.max(minReel, Math.floor(targetWidth * scale));
    const provisionalHeight = Math.round(reelWidth * 1.08);
    const projectedStackHeight =
      provisionalHeight * reelCount + gap * (reelCount - 1);
    if (projectedStackHeight > availableHeight) {
      const heightScale = Math.max(
        0.68,
        availableHeight / projectedStackHeight,
      );
      itemHeight = Math.max(
        Math.round(provisionalHeight * heightScale),
        Math.round(reelWidth * 0.9),
      );
    } else {
      itemHeight = provisionalHeight;
    }
  }

  return {
    isDesktop,
    orientation,
    containerMax,
    gap,
    reelWidth,
    itemHeight,
  };
}
