/**
 * Onboarding で利用するモーダルコンポーネント。
 * Stateless な Props による制御で UI を描画する。
 */
type WelcomeModalProps = {
  onTap: () => void;
};

export function WelcomeModal({ onTap }: WelcomeModalProps) {
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
          width: "min(92vw, 460px)",
          borderRadius: 20,
          background:
            "linear-gradient(165deg, rgba(255,255,255,0.95), rgba(241,245,249,0.92))",
          color: "#0f172a",
          padding: "clamp(24px, 6vw, 40px) clamp(20px, 7vw, 36px)",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
          border: "1px solid rgba(148,163,184,0.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(12px, 3vw, 18px)",
        }}
      >
        <div
          style={{
            fontSize: "clamp(24px, 6vw, 32px)",
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          Welcome!!
        </div>
        <div
          style={{
            fontSize: "clamp(14px, 3.8vw, 16px)",
            opacity: 0.9,
            lineHeight: 1.7,
          }}
        >
          画面をタップして開始します。<br />
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(10px, 3.4vw, 14px) clamp(26px, 7vw, 36px)",
            borderRadius: 999,
            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "clamp(14px, 3.6vw, 16px)",
            userSelect: "none",
            boxShadow: "0 12px 28px rgba(37,99,235,0.35)",
            letterSpacing: "0.04em",
          }}
        >
          タップしてはじめる
        </div>
        <div
          style={{
            fontSize: "clamp(11px, 3.2vw, 12px)",
            color: "#64748b",
          }}
        >
          （タップで続行）
        </div>
      </div>
    </div>
  );
}
