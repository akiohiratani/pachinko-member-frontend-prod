import type { RoundStartPayload } from "../usecases/slotMachineManager";

type MessageHandler = (payload: RoundStartPayload) => void;

type ConnectionCallbacks = {
  onOpen?: () => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
};

type RawMessage = {
  action?: string;
  routeKey?: string;
  type?: string;
  payload?: unknown;
  body?: unknown;
  [key: string]: unknown;
};

/**
 * スロット演出用の WebSocket 接続を抽象化するゲートウェイクラス。
 * アプリ全体からは Pub/Sub（Observer）パターンの Publisher として利用されます。
 * roundStart メッセージだけを抽出してコールバックへ引き渡します。
 */
export class SlotWebSocketGateway {
  private socket: WebSocket | null = null;
  private hasConnected = false;
  private messageHandler: MessageHandler | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(handler: MessageHandler, callbacks?: ConnectionCallbacks) {
    this.messageHandler = handler;
    if (this.hasConnected) {
      return;
    }

    const ws = new WebSocket(this.url);
    this.socket = ws;
    this.hasConnected = true;

    ws.addEventListener("open", () => {
      callbacks?.onOpen?.();
    });

    ws.addEventListener("error", (event) => {
      this.hasConnected = false;
      callbacks?.onError?.(event);
      ws.close();
    });

    ws.addEventListener("close", (event) => {
      this.hasConnected = false;
      this.socket = null;
      callbacks?.onClose?.(event);
    });

    ws.addEventListener("message", (event) => {
      if (!this.messageHandler) return;
      try {
        const data: RawMessage = JSON.parse(event.data);
        const action = data.action ?? data.routeKey ?? data.type;
        if (action === "roundStart") {
          const payload = (data.payload ?? data.body ?? data) as RoundStartPayload;
          this.messageHandler(payload);
        }
      } catch {
        // Intentionally swallow parse errors to keep UI silent
      }
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.hasConnected = false;
  }
}
