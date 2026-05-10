import { useEffect } from "react";
import { useHAStore } from "../store/ha-store";

export function useHA(url?: string, token?: string) {
  const {
    connection,
    entities,
    isConnected,
    error,
    entityCount,
    connect,
    disconnect,
  } = useHAStore();

  useEffect(() => {
    if (url && token) {
      connect(url, token).catch(() => {});
    }
    return () => {
      disconnect();
    };
  }, [url, token, connect, disconnect]);

  return { connection, entities, isConnected, error, entityCount };
}
