import type { RoundStartPayload } from "../usecases/slotMachineManager";

type MessageHandler = (payload: RoundStartPayload) => void;

type RawMessage = {
  action?: string;
  routeKey?: string;
  type?: string;
  payload?: unknown;
  body?: unknown;
  [key: string]: unknown;
};

export class SlotWebSocketGateway {
  private socket: WebSocket | null = null;
  private hasConnected = false;
  private messageHandler: MessageHandler | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(handler: MessageHandler) {
    this.messageHandler = handler;
    if (this.hasConnected) {
      return;
    }

    const ws = new WebSocket(this.url);
    this.socket = ws;
    this.hasConnected = true;

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
