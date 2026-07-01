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

const SERVICE_TIMEOUT_MS = 10_000;

export async function callService(
  conn: Connection,
  domain: string,
  service: string,
  serviceData?: Record<string, unknown>,
  target?: { entity_id?: string | string[] }
): Promise<void> {
  const action = `${domain}.${service}`;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout:${action}`)), SERVICE_TIMEOUT_MS)
  );

  try {
    await Promise.race([
      wsCallService(conn, domain, service, serviceData, target ?? undefined),
      timeout,
    ]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.startsWith("timeout:");
    const msg = isTimeout
      ? `[Dashboard] Sin respuesta de HA — acción: ${action}, entidad: ${String(target?.entity_id ?? "–")}, timestamp: ${new Date().toISOString()}`
      : `[Dashboard] Error en ${action}: ${String(err)}`;
    console.warn(msg);
    wsCallService(conn, "system_log", "write", {
      message: msg,
      level: "warning",
      logger: "mi_dashboard",
    }).catch(() => undefined);
    throw err;
  }

  if (target?.entity_id) {
    const ids = Array.isArray(target.entity_id) ? target.entity_id : [target.entity_id];
    ids.forEach((id) => _callListeners.forEach((fn) => fn(id)));
  }
}

export async function fetchAllStates(conn: Connection): Promise<HassEntity[]> {
  return getStates(conn);
}

export async function callRestAPI(
  conn: Connection,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  // Use module-level auth (dev mode) or fall back to the connection's own auth (panel mode)
  const activeAuth = auth ?? (conn as Connection & { options?: { auth?: Auth } }).options?.auth;
  if (!activeAuth) throw new Error('[Dashboard] callRestAPI: no auth available');
  const hassUrl = (activeAuth as typeof activeAuth & { data?: { hassUrl?: string } }).data?.hassUrl ?? '';
  const token = activeAuth.accessToken;
  const resp = await fetch(`${hassUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`[Dashboard] REST ${resp.status} ${method} ${path}`);
  return resp.json();
}

export function disconnectHA(): void {
  if (connection) {
    connection.close();
    connection = null;
    auth = null;
  }
}

export type { Connection };
