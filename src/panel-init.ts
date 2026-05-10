import type { Connection } from 'home-assistant-js-websocket'
import { useHAStore } from './store/ha-store'

declare global {
  interface Window {
    hassConnection?: Promise<Connection>
  }
}

// Called from main.tsx to wire up the HA connection before rendering.
// In panel mode HA injects window.hassConnection; in standalone mode
// the store connects using env-var credentials.
export async function initConnection(): Promise<void> {
  if (window.hassConnection) {
    const conn = await window.hassConnection
    const store = useHAStore.getState()

    conn.addEventListener('ready', () => {
      useHAStore.setState({ isConnected: true, error: null })
    })
    conn.addEventListener('disconnected', () => {
      useHAStore.setState({ isConnected: false })
    })

    // Let the store take ownership of the injected connection
    // without going through the full connectHA flow.
    useHAStore.setState({ connection: conn, isConnected: true })
    store.subscribeEntitiesFromConn(conn)
    return
  }

  // Standalone: credentials come from .env.local — App.tsx calls useHA() which
  // triggers store.connect(). Nothing to do here.
}
