import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  callService as wsCallService,
  getStates,
  type Connection,
  type HassEntity,
  type Auth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from "home-assistant-js-websocket";

let connection: Connection | null = null;
let auth: Auth | null = null;

const _callListeners: Array<(entityId: string) => void> = [];

export function addServiceCallListener(fn: (entityId: string) => void): void {
  _callListeners.push(fn);
}

export async function connectHA(url: string, token: string): Promise<Connection> {
  if (connection) {
    return connection;
  }

  auth = createLongLivedTokenAuth(url, token);

  try {
    connection = await createConnection({ auth });
    return connection;
  } catch (err) {
    connection = null;
    if (err === ERR_CANNOT_CONNECT) {
      throw new Error("No se pudo conectar a Home Assistant. Verifica la URL.");
    }
    if (err === ERR_INVALID_AUTH) {
      throw new Error("Token inválido. Genera un nuevo long-lived token en HA.");
    }
    throw err;
  }
}

export function subscribeAllEntities(
  conn: Connection,
  callback: (entities: Record<string, HassEntity>) => void
): () => void {
  return subscribeEntities(conn, callback);
}

export async function callService(
  conn: Connection,
  domain: string,
  service: string,
  serviceData?: Record<string, unknown>,
  target?: { entity_id?: string | string[] }
): Promise<void> {
  await wsCallService(conn, domain, service, serviceData, target ?? undefined);
  if (target?.entity_id) {
    const ids = Array.isArray(target.entity_id) ? target.entity_id : [target.entity_id];
    ids.forEach((id) => _callListeners.forEach((fn) => fn(id)));
  }
}

export async function fetchAllStates(conn: Connection): Promise<HassEntity[]> {
  return getStates(conn);
}

export function disconnectHA(): void {
  if (connection) {
    connection.close();
    connection = null;
    auth = null;
  }
}

export type { Connection };
