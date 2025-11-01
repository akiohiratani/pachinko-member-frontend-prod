// App.tsx — メンバー画面（スロットのみ / スマホ・PC両対応 / 白ベース・モダン）
// 変更点：図柄を数値(1〜5) → 添付画像4種に変更

import React, { useEffect, useMemo, useRef, useState } from "react";

// 図柄（public/symbols/ 配下に 1.png〜4.png を配置してください）
type SymbolDef = { src: string; alt: string };
const SYMBOLS: readonly SymbolDef[] = [
  { src: "/symbols/1.png", alt: "Amazon ギフト" },
  { src: "/symbols/2.png", alt: "ストロングゼロ ダブルレモン" },
  { src: "/symbols/3.png", alt: "LINE（人物イメージ）" },
  { src: "/symbols/4.png", alt: "ハーゲンダッツ バニラ" },
] as const;

const REELS = 3 as const;

/** アニメーション基準 */
const BASE_SPIN_MS = 2400;
const REEL_DELAY_MS = 300;
const EASING = "cubic-bezier(0.17,0.67,0.23,1.03)";

type WsPayload = {
  startAt?: string; // ISO
  [k: string]: unknown;
};

function App() {
  const [spinning, setSpinning] = useState(false);
  const [targetIndexes, setTargetIndexes] = useState<number[]>(Array(REELS).fill(0));
  const [spinBaseMs, setSpinBaseMs] = useState(BASE_SPIN_MS);
  const [showWelcome, setShowWelcome] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const hasConnectedRef = useRef(false);

  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinStartAudioRef = useRef<HTMLAudioElement | null>(null);

  // レスポンシブ（スマホ/PC両対応）
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 375);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isDesktop = vw >= 1024;

  // コンテナ最大幅: スマホは~420px、PCは~720px を上限にしつつ 92vw で抑制
  const containerMax = Math.min(vw * 0.92, isDesktop ? 720 : 420);
  const gap = isDesktop ? 16 : 10;
  const framePadding = isDesktop ? 16 : 12;

  // リール幅
  const rawReel = (containerMax - framePadding * 2 - gap * (REELS - 1)) / REELS;
  const minReel = isDesktop ? 88 : 72;
  const maxReel = isDesktop ? 152 : 120;
  const reelWidthPx = Math.max(minReel, Math.min(maxReel, Math.floor(rawReel)));

  // 画像は正方形に近い表示を想定
  const itemHeight = isDesktop ? Math.round(reelWidthPx * 1.05) : Math.round(reelWidthPx * 0.92);

  const WEBSOCKET_URL = useMemo(
    () =>
      import.meta.env.VITE_WEBSOCKET_URL ??
      "wss://12fk8ea9sb.execute-api.ap-northeast-1.amazonaws.com/Prod?role=member",
    [],
  );

  // 画像プリロード
  useEffect(() => {
    SYMBOLS.forEach((s) => {
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  useEffect(() => {
    winAudioRef.current = new Audio("/win.mp3");
    winAudioRef.current.preload = "auto";
    spinStartAudioRef.current = new Audio("/spinStart.mp3");
    spinStartAudioRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    return () => {
      if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, []);

  /** WebSocket 接続（1回だけ） */
  const connectWebSocket = () => {
    if (hasConnectedRef.current) return;
    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;
    hasConnectedRef.current = true;

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const action = data.action ?? data.routeKey ?? data.type;
        if (action === "roundStart") {
          const payload: WsPayload = data.payload ?? data.body ?? data;
          handleStart(payload);
        }
      } catch {
        /* ログ非表示（UI簡素のため） */
      }
    };
  };

  const startTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);

  /** 受信開始（startAtで同時化） */
  const handleStart = (payload: WsPayload) => {
    const decideWin = randomFloat() < 0.2; // 20%

    let targets: number[];
    if (decideWin) {
      const sym = randInt(0, SYMBOLS.length - 1);
      targets = [sym, sym, sym];
    } else {
      const base = randInt(0, SYMBOLS.length - 1);
      const diffReel = randInt(0, REELS - 1);
      let diff = base;
      while (diff === base) diff = randInt(0, SYMBOLS.length - 1);
      targets = [base, base, base];
      targets[diffReel] = diff;
    }
    setTargetIndexes(targets);

    // 最終停止が5〜10秒の範囲になるよう調整
    const desiredTotalMs = randInt(5000, 10000);
    const baseMsForThisRound = Math.max(0, desiredTotalMs - REEL_DELAY_MS * (REELS - 1));
    setSpinBaseMs(baseMsForThisRound);

    const startAtISO = typeof payload.startAt === "string" ? payload.startAt : undefined;
    const delay = startAtISO ? Math.max(0, new Date(startAtISO).getTime() - Date.now()) : 0;

    if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);

    startTimerRef.current = window.setTimeout(async () => {
      setSpinning(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setSpinning(true)));

      // 開始時サウンド（当たり時は一部でwin、以外はspinStart）
      let playedWinAtStart = false;
      if (decideWin && winAudioRef.current && randomFloat() < 0.6) {
        try {
          winAudioRef.current.currentTime = 0;
          await winAudioRef.current.play();
          playedWinAtStart = true;
        } catch {
          //
        }
      }
      if (!playedWinAtStart && spinStartAudioRef.current) {
        try {
          spinStartAudioRef.current.currentTime = 0;
          await spinStartAudioRef.current.play();
        } catch {
          //
        }
      }

      const totalMs = baseMsForThisRound + REEL_DELAY_MS * (REELS - 1);
      finishTimerRef.current = window.setTimeout(() => {
        /* 終了音なし（外れ音は要件で削除） */
      }, totalMs + 80);
    }, delay);
  };

  /** 音を有効化（ユーザー操作に紐づける） */
  const enableSound = async () => {
    try {
      if (winAudioRef.current) {
        await winAudioRef.current.play();
        winAudioRef.current.pause();
        winAudioRef.current.currentTime = 0;
      }
      if (spinStartAudioRef.current) {
        await spinStartAudioRef.current.play();
        spinStartAudioRef.current.pause();
        spinStartAudioRef.current.currentTime = 0;
      }
      return true;
    } catch {
      return false;
    }
  };

  /** モーダルタップ：音有効 → WS接続 → モーダル閉 */
  const handleWelcomeTap = async () => {
    const ok = await enableSound();
    if (ok) {
      connectWebSocket();
      setShowWelcome(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f9",
        padding: isDesktop ? "32px 24px" : "16px 12px",
      }}
    >
      <SlotMachine
        spinning={spinning}
        targetIndexes={targetIndexes}
        reelCount={REELS}
        baseSpinMs={spinBaseMs}
        reelDelayMs={REEL_DELAY_MS}
        easing={EASING}
        reelWidth={reelWidthPx}
        itemHeight={itemHeight}
        framePadding={framePadding}
        gap={gap}
        containerMax={containerMax}
        isDesktop={isDesktop}
      />

      {showWelcome && <WelcomeModal onTap={handleWelcomeTap} />}
    </div>
  );
}

/** Welcome モーダル */
function WelcomeModal({ onTap }: { onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      role="button"
      aria-label="Welcome モーダル"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "min(92vw, 520px)",
          borderRadius: 16,
          background: "#ffffff",
          color: "#0f172a",
          padding: "28px 20px",
          textAlign: "center",
          boxShadow: "0 18px 48px rgba(15,23,42,0.12)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Welcome!!</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 18 }}>
          画面をタップして開始します。<br />
          音声を有効化し、サーバーに接続します。
        </div>
        <div
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: 999,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            userSelect: "none",
            boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
          }}
        >
          タップしてはじめる
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>（タップで続行）</div>
      </div>
    </div>
  );
}

function SlotMachine(props: {
  spinning: boolean;
  targetIndexes: number[];
  reelCount: number;
  baseSpinMs: number;
  reelDelayMs: number;
  easing: string;
  reelWidth: number;
  itemHeight: number;
  framePadding: number;
  gap: number;
  containerMax: number;
  isDesktop: boolean;
}) {
  const {
    spinning,
    targetIndexes,
    reelCount,
    baseSpinMs,
    reelDelayMs,
    easing,
    reelWidth,
    itemHeight,
    framePadding,
    gap,
    containerMax,
  } = props;

  const cycles = [8, 9, 10];
  const outerWidth = reelCount * reelWidth + (reelCount - 1) * gap + framePadding * 2;

  return (
    <div
      style={{
        width: Math.min(outerWidth, containerMax),
        padding: framePadding,
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        background: "#ffffff",
        boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
        transform: "translateZ(0)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${reelCount}, ${reelWidth}px)`,
          gap,
        }}
      >
        {Array.from({ length: reelCount }).map((_, r) => (
          <SlotReel
            key={r}
            itemHeight={itemHeight}
            reelWidth={reelWidth}
            cycles={cycles[r % cycles.length]}
            targetIndex={targetIndexes[r] ?? 0}
            spinMs={baseSpinMs + reelDelayMs * r}
            easing={easing}
            spinning={spinning}
          />
        ))}
      </div>
    </div>
  );
}

function SlotReel(props: {
  itemHeight: number;
  reelWidth: number;
  cycles: number;
  targetIndex: number;
  spinMs: number;
  easing: string;
  spinning: boolean;
}) {
  const { itemHeight, reelWidth, cycles, targetIndex, spinMs, easing, spinning } = props;

  const listLen = cycles * SYMBOLS.length + SYMBOLS.length;
  const symbols = React.useMemo(
    () => Array.from({ length: listLen }, (_, i) => SYMBOLS[i % SYMBOLS.length]),
    [listLen],
  );

  // ピクセル丸めでブレを抑制
  const finalOffset = Math.round(
    -(cycles * SYMBOLS.length * itemHeight + targetIndex * itemHeight),
  );

  const trackStyle: React.CSSProperties = {
    transition: `transform ${spinMs}ms ${easing}`,
    transform: spinning ? `translate3d(0, ${finalOffset}px, 0)` : `translate3d(0, 0, 0)`,
    willChange: "transform",
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
        {symbols.map((sym, i) => (
          <div
            key={i}
            style={{
              height: itemHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: i % SYMBOLS.length === 0 ? "#fafafa" : "#ffffff",
              boxSizing: "border-box",
              borderBottom: "1px solid #f0f2f5",
              padding: Math.max(8, Math.floor(itemHeight * 0.08)),
            }}
          >
            <img
              src={sym.src}
              alt={sym.alt}
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

      {/* 上下フェード（視覚効果のみ） */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.06), transparent 24%, transparent 76%, rgba(15,23,42,0.06))",
          pointerEvents: "none",
        }}
      />
      {/* 中央基準ライン（うっすら） */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to bottom, rgba(2,6,23,0.08), rgba(2,6,23,0.08))",
          backgroundRepeat: "no-repeat",
          backgroundPosition: `0 ${Math.floor(itemHeight / 2)}px`,
          backgroundSize: `100% 1px`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/* ========= ユーティリティ ========= */

function randomFloat() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 2 ** 32;
  }
  return Math.random();
}

function randInt(minIncl: number, maxIncl: number) {
  const r = randomFloat();
  return Math.floor(r * (maxIncl - minIncl + 1)) + minIncl;
}

export default App;
