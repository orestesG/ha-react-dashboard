import { create } from "zustand";
import type { Connection, HassEntity } from "home-assistant-js-websocket";
import { connectHA, subscribeAllEntities, disconnectHA, fetchAllStates } from "../lib/ha-client";

interface HAState {
  connection: Connection | null;
  entities: Record<string, HassEntity>;
  isConnected: boolean;
  error: string | null;
  entityCount: number;

  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  subscribeEntitiesFromConn: (conn: Connection) => void;
  getEntity: (entityId: string) => HassEntity | undefined;
}

export const useHAStore = create<HAState>((set, get) => ({
  connection: null,
  entities: {},
  isConnected: false,
  error: null,
  entityCount: 0,

  connect: async (url: string, token: string) => {
    set({ error: null });
    try {
      const conn = await connectHA(url, token);
      const entities = await fetchAllStates(conn);
      const entityMap: Record<string, HassEntity> = {};
      entities.forEach((e) => { entityMap[e.entity_id] = e; });

      subscribeAllEntities(conn, (updated) => {
        set({ entities: updated, entityCount: Object.keys(updated).length });
      });

      conn.addEventListener("ready", () => {
        set({ isConnected: true, error: null });
      });
      conn.addEventListener("disconnected", () => {
        set({ isConnected: false });
      });

      set({
        connection: conn,
        entities: entityMap,
        isConnected: true,
        entityCount: Object.keys(entityMap).length,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de conexión";
      set({ error: message, isConnected: false });
      throw err;
    }
  },

  disconnect: () => {
    disconnectHA();
    set({ connection: null, entities: {}, isConnected: false, entityCount: 0 });
  },

  subscribeEntitiesFromConn: (conn: Connection) => {
    subscribeAllEntities(conn, (updated) => {
      set({ entities: updated, entityCount: Object.keys(updated).length });
    });
  },

  getEntity: (entityId: string) => {
    return get().entities[entityId];
  },
}));
