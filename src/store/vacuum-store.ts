import { create } from 'zustand'
import type { Connection } from 'home-assistant-js-websocket'
import { useHAStore } from './ha-store'
import { callService } from '../lib/ha-client'

const HA_STORAGE_KEY = 'mi-dashboard-vacuum-v1'

// Legacy localStorage keys — read once for migration, then cleared
const LS_KEY_PRESETS = 'vacuum-presets-v1'
const LS_KEY_VIEW    = 'vacuum-view-v1'

// HA entity IDs for the two schedule helpers
const HA_SCHEDULE_FULL  = 'schedule.limpieza_robot'
const HA_SCHEDULE_SWEEP = 'schedule.limpieza_robot_solo_aspirado'

// HA automations triggered by each schedule. A schedule must always hold at least
// one range (HA rejects an empty one), so when a preset has no slots we push an inert
// 00:00 placeholder AND disable its automation — otherwise the placeholder would fire
// an unwanted cleaning at midnight.
const HA_AUTO_FULL  = 'automation.limpieza_robot_schedule'
const HA_AUTO_SWEEP = 'automation.limpieza_robot_solo_aspirado'

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const

type HAConn = Connection & {
  sendMessagePromise: (msg: unknown) => Promise<unknown>
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

export const DEFAULT_ZOOM = 1

export interface ViewState {
  rotation: RotDeg
  // Zoom is stored per device (each tablet/browser keeps its own preferred zoom).
  zoomByDevice: Record<string, number>
}

const LS_DEVICE_ID = 'mi-dashboard-device-id'

/** Stable per-device id (persisted in localStorage, never synced to HA). */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(LS_DEVICE_ID)
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(LS_DEVICE_ID, id)
    }
    return id
  } catch {
    return 'default'
  }
}

/** Accept legacy `{ rotation, zoom }` and normalise to the per-device shape. */
function normalizeView(v: unknown): ViewState {
  const obj = (v ?? {}) as { rotation?: RotDeg; zoom?: number; zoomByDevice?: Record<string, number> }
  if (obj.zoomByDevice) return { rotation: obj.rotation ?? 0, zoomByDevice: { ...obj.zoomByDevice } }
  // Legacy global zoom → seed the current device with it
  return {
    rotation: obj.rotation ?? 0,
    zoomByDevice: typeof obj.zoom === 'number' ? { [getDeviceId()]: obj.zoom } : {},
  }
}

export interface ScheduleSlot {
  id:      string
  days:    number[]        // 0=Mon … 6=Sun
  time:    string          // "HH:MM"
  preset:  'full' | 'sweep'
  enabled: boolean
  // Advanced — undefined means inherit from the global preset
  suctionOverride?: string
  vacuumPasses?:    number
  mopPasses?:       number
}

const SLOTS_VERSION = 3  // bump when DEFAULT_SLOTS changes to force migration

interface Persisted {
  presets:      PresetsState
  view:         ViewState
  slots:        ScheduleSlot[]
  slotsVersion?: number
}

export const DEFAULT_PRESETS: PresetsState = {
  full:  { mode: 'mopping_after_sweeping', suction: 'standard', water: '' },
  sweep: { mode: 'sweeping',               suction: 'standard', water: '' },
}

export const DEFAULT_VIEW: ViewState = { rotation: 0, zoomByDevice: {} }

export const DEFAULT_SLOTS: ScheduleSlot[] = [
  { id: 'default-full-15', days: [0,1,2,3,4], time: '15:00', preset: 'full', enabled: true },
]

function getHAConn(): HAConn | null {
  return useHAStore.getState().connection as HAConn | null
}

function saveToHA(data: Persisted): void {
  const conn = getHAConn()
  if (!conn) return
  void conn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: { ...data, slotsVersion: SLOTS_VERSION } })
    .catch(() => { /* ignore — saves will retry on next change */ })
}

/** Convert an array of ScheduleSlots for one preset into the HA schedule day-map format */
function slotsToHADays(slots: ScheduleSlot[]): Record<string, { from: string; to: string }[]> {
  const result: Record<string, { from: string; to: string }[]> = {}
  DAY_KEYS.forEach(d => { result[d] = [] })

  slots.forEach(slot => {
    if (!slot.enabled) return
    const [hh, mm] = slot.time.split(':').map(Number)
    const nextMin  = mm + 1 >= 60 ? 0 : mm + 1
    const nextHour = mm + 1 >= 60 ? hh + 1 : hh
    if (nextHour >= 24) return  // skip midnight-overflow edge case
    const to = `${String(nextHour).padStart(2,'0')}:${String(nextMin).padStart(2,'0')}`
    slot.days.forEach(dayIdx => {
      result[DAY_KEYS[dayIdx]].push({ from: slot.time, to })
    })
  })

  // HA requires at least one day with a range; if all empty add a placeholder
  const hasAny = Object.values(result).some(r => r.length > 0)
  if (!hasAny) result['monday'] = [{ from: '00:00', to: '00:01' }]
  return result
}

// Cache entry IDs to avoid repeated lookups
let entryIdCache: Record<string, string> = {}

async function getEntryId(haConn: HAConn, entityId: string): Promise<string | null> {
  if (entryIdCache[entityId]) return entryIdCache[entityId]
  try {
    const entries = await haConn.sendMessagePromise({ type: 'config_entries/list', domain: 'schedule' }) as { entry_id: string; title: string; entity_id?: string }[]
    for (const e of entries) {
      // Mirror HA's slugify: lowercase, collapse any run of non-alphanumerics to a
      // single underscore, trim leading/trailing underscores. This matters for titles
      // with separators like "Limpieza Robot — Solo Aspirado" → limpieza_robot_solo_aspirado.
      const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      entryIdCache[`schedule.${slug}`] = e.entry_id
    }
  } catch {
    return null
  }
  return entryIdCache[entityId] ?? null
}

async function updateScheduleHelper(haConn: HAConn, entityId: string, slots: ScheduleSlot[], preset: 'full' | 'sweep'): Promise<void> {
  const filtered = slots.filter(s => s.preset === preset)
  const dayMap   = slotsToHADays(filtered)
  const entryId  = await getEntryId(haConn, entityId)
  if (!entryId) return

  const flowResult = await haConn.sendMessagePromise({
    type:    'config_entries/options_flow/init',
    handler: entryId,
  }) as { flow_id: string }

  await haConn.sendMessagePromise({
    type:    `config_entries/options_flow/${flowResult.flow_id}`,
    data:    dayMap,
  })
}

interface VacuumState {
  presets:  PresetsState
  view:     ViewState
  slots:    ScheduleSlot[]
  haLoaded: boolean
  setPresets:              (p: PresetsState) => void
  setRotation:             (r: RotDeg) => void
  setZoom:                 (z: number) => void
  setSlots:                (s: ScheduleSlot[]) => void
  syncScheduleHelpersToHA: (conn: Connection) => Promise<void>
  syncFromHA:              (conn: Connection) => Promise<void>
}

export const useVacuumStore = create<VacuumState>((set, get) => ({
  presets:  DEFAULT_PRESETS,
  view:     DEFAULT_VIEW,
  slots:    DEFAULT_SLOTS,
  haLoaded: false,

  setPresets: (presets) => {
    set({ presets })
    saveToHA({ presets, view: get().view, slots: get().slots })
  },

  setRotation: (rotation) => {
    const view = { ...get().view, rotation }
    set({ view })
    saveToHA({ presets: get().presets, view, slots: get().slots })
  },

  setZoom: (zoom) => {
    const dev  = getDeviceId()
    const view = { ...get().view, zoomByDevice: { ...get().view.zoomByDevice, [dev]: zoom } }
    set({ view })
    saveToHA({ presets: get().presets, view, slots: get().slots })
  },

  setSlots: (slots) => {
    set({ slots })
    saveToHA({ presets: get().presets, view: get().view, slots })
  },

  syncScheduleHelpersToHA: async (conn) => {
    const haConn = conn as HAConn
    const { slots } = get()
    const hasFull  = slots.some(s => s.enabled && s.preset === 'full')
    const hasSweep = slots.some(s => s.enabled && s.preset === 'sweep')
    const toggleAuto = (entityId: string, on: boolean) =>
      callService(conn, 'automation', on ? 'turn_on' : 'turn_off', undefined, { entity_id: entityId })
    // Fire all updates concurrently, swallow errors (HA might be busy)
    await Promise.allSettled([
      updateScheduleHelper(haConn, HA_SCHEDULE_FULL,  slots, 'full'),
      updateScheduleHelper(haConn, HA_SCHEDULE_SWEEP, slots, 'sweep'),
      toggleAuto(HA_AUTO_FULL,  hasFull),
      toggleAuto(HA_AUTO_SWEEP, hasSweep),
    ])
  },

  syncFromHA: async (conn) => {
    const haConn = conn as HAConn
    try {
      const result  = await haConn.sendMessagePromise({ type: 'frontend/get_user_data', key: HA_STORAGE_KEY })
      const haData  = (result as { value: Persisted | null }).value

      if (haData?.presets) {
        // If slots were saved with an older version, reset to current defaults
        const slots = (haData.slotsVersion ?? 0) >= SLOTS_VERSION
          ? (haData.slots ?? DEFAULT_SLOTS)
          : DEFAULT_SLOTS
        set({
          presets: haData.presets,
          view:    normalizeView(haData.view),
          slots,
        })
      } else {
        // First run: migrate localStorage if present, then clear it
        const toSave: Persisted = { presets: get().presets, view: get().view, slots: get().slots }
        try {
          const rawPresets = localStorage.getItem(LS_KEY_PRESETS)
          const rawView    = localStorage.getItem(LS_KEY_VIEW)
          if (rawPresets) toSave.presets = { ...DEFAULT_PRESETS, ...JSON.parse(rawPresets) }
          if (rawView)    toSave.view    = normalizeView(JSON.parse(rawView))
          if (rawPresets || rawView) set({ presets: toSave.presets, view: toSave.view })
        } catch { /* ignore */ }

        await haConn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: toSave })
        try { localStorage.removeItem(LS_KEY_PRESETS); localStorage.removeItem(LS_KEY_VIEW) } catch { /* ignore */ }
      }
    } catch {
      // HA unreachable — defaults stay, no data lost
    }
    set({ haLoaded: true })
  },
}))
