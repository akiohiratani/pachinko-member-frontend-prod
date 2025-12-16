import { useMemo } from "react";

const DEFAULT_WEBSOCKET_URL =
  "wss://0qfs0zhpg6.execute-api.ap-northeast-1.amazonaws.com/Akio1113?role=member";

export function useWebsocketUrl(roomId: string): string {
  return useMemo(() => {
    const baseUrl = import.meta.env.VITE_WEBSOCKET_URL ?? DEFAULT_WEBSOCKET_URL;
    if (!roomId) {
      return baseUrl;
    }

    try {
      const url = new URL(baseUrl);
      url.searchParams.set("roomId", roomId);
      return url.toString();
    } catch {
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}roomId=${encodeURIComponent(roomId)}`;
    }
  }, [roomId]);
}
