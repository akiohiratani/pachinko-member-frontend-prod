import { useMemo } from "react";
import { getRuntimeConfig } from "../../runtimeConfig";

export function useWebsocketUrl(roomId: string): string {
  return useMemo(() => {
    const baseUrl =
      getRuntimeConfig()?.websocketUrl ?? import.meta.env.VITE_WEBSOCKET_URL ?? "";

    if (!baseUrl) {
      return "";
    }
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
