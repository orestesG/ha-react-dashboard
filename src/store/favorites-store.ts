import { create } from 'zustand'
import { addServiceCallListener } from '../lib/ha-client'
import { useHAStore } from './ha-store'
import type { Connection } from 'home-assistant-js-websocket'

const HA_STORAGE_KEY = 'mi-dashboard-favorites-v1'

// Legacy localStorage keys — read once for migration, then cleared
const LS_FAVS  = 'ha-dashboard-favorites-v1'
const LS_CALLS = 'ha-dashboard-call-counts-v1'

const TRACKED_DOMAINS = ['light', 'switch', 'cover', 'climate', 'media_player', 'vacuum']

type HAConn = Connection & {
  sendMessagePromise: (msg: unknown) => Promise<{ value: unknown }>
}

interface Persisted {
  favorites:  string[]
  callCounts: Record<string, number>
}

function getHAConn(): HAConn | null {
  return useHAStore.getState().connection as HAConn | null
}

function saveToHA(data: Persisted): void {
  const conn = getHAConn()
  if (!conn) return
  void conn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: data })
    .catch(() => { /* ignore */ })
}

interface FavoritesState {
  favorites:  string[]
  callCounts: Record<string, number>
  haLoaded:   boolean
  toggleFavorite: (entityId: string) => void
  isFavorite:     (entityId: string) => boolean
  recordCall:     (entityId: string) => void
  getSuggested:   (limit?: number) => string[]
  syncFromHA:     (conn: Connection) => Promise<void>
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites:  [],
  callCounts: {},
  haLoaded:   false,

  toggleFavorite: (entityId) => {
    set((s) => {
      const isFav = s.favorites.includes(entityId)
      const favorites = isFav
        ? s.favorites.filter((id) => id !== entityId)
        : [...s.favorites, entityId]
      saveToHA({ favorites, callCounts: s.callCounts })
      return { favorites }
    })
  },

  isFavorite: (entityId) => get().favorites.includes(entityId),

  recordCall: (entityId) => {
    if (!TRACKED_DOMAINS.includes(entityId.split('.')[0])) return
    set((s) => {
      const callCounts = { ...s.callCounts, [entityId]: (s.callCounts[entityId] ?? 0) + 1 }
      saveToHA({ favorites: s.favorites, callCounts })
      return { callCounts }
    })
  },

  getSuggested: (limit = 5) => {
    const { favorites, callCounts } = get()
    return Object.entries(callCounts)
      .filter(([id]) => !favorites.includes(id) && TRACKED_DOMAINS.includes(id.split('.')[0]))
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id)
  },

  syncFromHA: async (conn) => {
    const haConn = conn as HAConn
    try {
      const result = await haConn.sendMessagePromise({
        type: 'frontend/get_user_data',
        key:  HA_STORAGE_KEY,
      })
      const haData = (result as { value: Persisted | null }).value

      if (haData && Array.isArray(haData.favorites)) {
        set({ favorites: haData.favorites, callCounts: haData.callCounts ?? {} })
      } else {
        // First run: migrate localStorage if present, then clear it
        const toSave: Persisted = {
          favorites:  get().favorites,
          callCounts: get().callCounts,
        }
        try {
          const rawFavs  = localStorage.getItem(LS_FAVS)
          const rawCalls = localStorage.getItem(LS_CALLS)
          if (rawFavs)  toSave.favorites  = JSON.parse(rawFavs)
          if (rawCalls) toSave.callCounts = JSON.parse(rawCalls)
          if (rawFavs || rawCalls) {
            set({ favorites: toSave.favorites, callCounts: toSave.callCounts })
          }
        } catch { /* ignore */ }

        await haConn.sendMessagePromise({
          type:  'frontend/set_user_data',
          key:   HA_STORAGE_KEY,
          value: toSave,
        })
        try {
          localStorage.removeItem(LS_FAVS)
          localStorage.removeItem(LS_CALLS)
        } catch { /* ignore */ }
      }
    } catch {
      // HA unreachable — defaults stay
    }
    set({ haLoaded: true })
  },
}))

// Wire up global service-call tracking so CompactControl + controls feed the counter
addServiceCallListener((entityId) => {
  useFavoritesStore.getState().recordCall(entityId)
})
