import { useCallback } from "react";
import { useHAStore } from "../store/ha-store";
import { callService } from "../lib/ha-client";
import type { HassEntity } from "home-assistant-js-websocket";

export function useEntity(entityId: string) {
  const entity = useHAStore((s) => s.entities[entityId]) as HassEntity | undefined;
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const attributes = entity?.attributes;
  const isOn = state === "on";

  const turnOn = useCallback(async () => {
    if (!connection || !entityId) return;
    const domain = entityId.split(".")[0];
    await callService(connection, domain, "turn_on", undefined, { entity_id: entityId });
  }, [connection, entityId]);

  const turnOff = useCallback(async () => {
    if (!connection || !entityId) return;
    const domain = entityId.split(".")[0];
    await callService(connection, domain, "turn_off", undefined, { entity_id: entityId });
  }, [connection, entityId]);

  const toggle = useCallback(async () => {
    if (!connection || !entityId) return;
    const domain = entityId.split(".")[0];
    await callService(connection, domain, "toggle", undefined, { entity_id: entityId });
  }, [connection, entityId]);

  return {
    entity,
    state,
    attributes,
    isOn,
    turnOn,
    turnOff,
    toggle,
    exists: entity !== undefined,
    loading: entity === undefined,
  };
}
