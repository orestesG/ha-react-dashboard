import { create } from 'zustand'
import type { Connection } from 'home-assistant-js-websocket'
import { useHAStore } from './ha-store'

const HA_STORAGE_KEY = 'mi-dashboard-vacuum-v1'

// Legacy localStorage keys — read once for migration, then cleared
const LS_KEY_PRESETS = 'vacuum-presets-v1'
const LS_KEY_VIEW    = 'vacuum-view-v1'

type HAConn = Connection & {
  sendMessagePromise: (msg: unknown) => Promise<{ value: unknown }>
}

export interface PresetConfig {
  mode:    string
  suction: string
  water:   string
}

export interface PresetsState {
  full:  PresetConfig
  sweep: PresetConfig
}

export type RotDeg = 0 | 90 | 180 | 270

export interface ViewState {
  rotation: RotDeg
  zoom:     number
}

interface Persisted {
  presets: PresetsState
  view:    ViewState
}

export const DEFAULT_PRESETS: PresetsState = {
  full:  { mode: 'mopping_after_sweeping', suction: 'standard', water: '' },
  sweep: { mode: 'sweeping',               suction: 'standard', water: '' },
}

export const DEFAULT_VIEW: ViewState = { rotation: 0, zoom: 1 }

function getHAConn(): HAConn | null {
  return useHAStore.getState().connection as HAConn | null
}

function saveToHA(data: Persisted): void {
  const conn = getHAConn()
  if (!conn) return
  void conn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: data })
    .catch(() => { /* ignore — saves will retry on next change */ })
}

interface VacuumState {
  presets:   PresetsState
  view:      ViewState
  haLoaded:  boolean
  setPresets:   (p: PresetsState) => void
  setView:      (v: ViewState) => void
  syncFromHA:   (conn: Connection) => Promise<void>
}

export const useVacuumStore = create<VacuumState>((set, get) => ({
  presets:  DEFAULT_PRESETS,
  view:     DEFAULT_VIEW,
  haLoaded: false,

  setPresets: (presets) => {
    set({ presets })
    saveToHA({ presets, view: get().view })
  },

  setView: (view) => {
    set({ view })
    saveToHA({ presets: get().presets, view })
  },

  syncFromHA: async (conn) => {
    const haConn = conn as HAConn
    try {
      const result = await haConn.sendMessagePromise({
        type: 'frontend/get_user_data',
        key:  HA_STORAGE_KEY,
      })
      const haData = (result as { value: Persisted | null }).value

      if (haData?.presets) {
        set({ presets: haData.presets, view: haData.view ?? DEFAULT_VIEW })
      } else {
        // First run: migrate localStorage if present, then clear it
        const toSave: Persisted = { presets: get().presets, view: get().view }
        try {
          const rawPresets = localStorage.getItem(LS_KEY_PRESETS)
          const rawView    = localStorage.getItem(LS_KEY_VIEW)
          if (rawPresets) toSave.presets = { ...DEFAULT_PRESETS, ...JSON.parse(rawPresets) }
          if (rawView)    toSave.view    = { ...DEFAULT_VIEW,    ...JSON.parse(rawView)    }
          if (rawPresets || rawView) set({ presets: toSave.presets, view: toSave.view })
        } catch { /* ignore */ }

        await haConn.sendMessagePromise({
          type:  'frontend/set_user_data',
          key:   HA_STORAGE_KEY,
          value: toSave,
        })
        try {
          localStorage.removeItem(LS_KEY_PRESETS)
          localStorage.removeItem(LS_KEY_VIEW)
        } catch { /* ignore */ }
      }
    } catch {
      // HA unreachable — defaults stay, no data lost
    }
    set({ haLoaded: true })
  },
}))
