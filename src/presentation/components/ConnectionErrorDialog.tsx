import type { ReactNode } from "react";

type ConnectionErrorDialogProps = {
  message: string;
  onReconnect: () => void;
};

export function ConnectionErrorDialog({
  message,
  onReconnect,
}: ConnectionErrorDialogProps): ReactNode {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="接続エラー"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "18px",
      }}
    >
      <div
        style={{
          background: "#fff",
          color: "#0f172a",
          borderRadius: 18,
          padding: "20px 20px 16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          width: "min(92vw, 420px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          接続エラー
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {message}
        </div>
        <button
          type="button"
          onClick={onReconnect}
          style={{
            marginTop: 4,
            alignSelf: "flex-end",
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
          }}
        >
          再接続する
        </button>
      </div>
    </div>
  );
}
