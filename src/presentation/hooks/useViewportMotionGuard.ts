import { useEffect, useState } from "react";

/**
 * 画面のリサイズや向き変更時に発生する不意のアニメーションを抑止するためのフック。
 * 一定時間だけ SlotMachine のアニメーションを無効化し、レイアウト変化による動作を防ぐ。
 */
export function useViewportMotionGuard(timeoutMs = 600): boolean {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof window.setTimeout> | null = null;

    const handleViewportChange = () => {
      setAnimationsEnabled(false);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setAnimationsEnabled(true);
        timer = null;
      }, timeoutMs);
    };

    window.addEventListener("resize", handleViewportChange, { passive: true });
    window.addEventListener("orientationchange", handleViewportChange, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [timeoutMs]);

  return animationsEnabled;
}
