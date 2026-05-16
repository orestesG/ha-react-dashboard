import { useCallback } from "react";
import { useHAStore } from "../store/ha-store";
import { callService } from "../lib/ha-client";

export function useService() {
  const connection = useHAStore((s) => s.connection);

  const call = useCallback(
    async (
      domain: string,
      service: string,
      data?: Record<string, unknown>,
      entityId?: string | string[]
    ) => {
      if (!connection) throw new Error("No hay conexión con HA");
      const target = entityId ? { entity_id: entityId } : undefined;
      await callService(connection, domain, service, data, target);
    },
    [connection]
  );

  const toggleSwitch = useCallback(
    (entityId: string) => call("switch", "toggle", undefined, entityId),
    [call]
  );

  const toggleLight = useCallback(
    (entityId: string) => call("light", "toggle", undefined, entityId),
    [call]
  );

  const setCoverPosition = useCallback(
    (entityId: string, position: number) =>
      call("cover", "set_cover_position", { position }, entityId),
    [call]
  );

  const openCover = useCallback(
    (entityId: string) => call("cover", "open_cover", undefined, entityId),
    [call]
  );

  const closeCover = useCallback(
    (entityId: string) => call("cover", "close_cover", undefined, entityId),
    [call]
  );

  const stopCover = useCallback(
    (entityId: string) => call("cover", "stop_cover", undefined, entityId),
    [call]
  );

  const setClimate = useCallback(
    (entityId: string, hvacMode: string) =>
      call("climate", "set_hvac_mode", { hvac_mode: hvacMode }, entityId),
    [call]
  );

  const setTemperature = useCallback(
    (entityId: string, temperature: number) =>
      call("climate", "set_temperature", { temperature }, entityId),
    [call]
  );

  const mediaPlayPause = useCallback(
    (entityId: string) => call("media_player", "media_play_pause", undefined, entityId),
    [call]
  );

  const vacuumStart = useCallback(
    (entityId: string) => call("vacuum", "start", undefined, entityId),
    [call]
  );

  const vacuumReturnToBase = useCallback(
    (entityId: string) => call("vacuum", "return_to_base", undefined, entityId),
    [call]
  );

  return {
    call,
    toggleSwitch,
    toggleLight,
    setCoverPosition,
    openCover,
    closeCover,
    stopCover,
    setClimate,
    setTemperature,
    mediaPlayPause,
    vacuumStart,
    vacuumReturnToBase,
  };
}
