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
