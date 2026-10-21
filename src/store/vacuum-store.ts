import { create } from 'zustand'
import type { Connection } from 'home-assistant-js-websocket'
import { useHAStore } from './ha-store'
import { callService, callRestAPI } from '../lib/ha-client'
import { VACUUM_ENTITY } from '../dashboard.config'
import {
  DAY_KEYS,
  buildAutomationConfig,
  buildScriptConfig,
  deviceSlug,
  findRoomModeEntities,
  normalizeSlot,
  sameConfig,
  slotsToScheduleDays,
  type ScheduleSlot,
} from '../lib/vacuum'

export type { ScheduleSlot } from '../lib/vacuum'

const HA_STORAGE_KEY = 'mi-dashboard-vacuum-v1'

// Schedule helper whose active block (and its `data`) triggers a cleaning
const HA_SCHEDULE_ID     = 'limpieza_robot'
export const HA_SCHEDULE_ENTITY = `schedule.${HA_SCHEDULE_ID}`

// Automation that forwards the active block to the script (internal id of this HA instance)
const HA_AUTOMATION_ID           = '1780003771514'
export const HA_AUTOMATION_ENTITY = 'automation.limpieza_robot_schedule'

// Script that actually runs a cleaning; provisioned by the dashboard
const HA_SCRIPT_OBJECT_ID    = 'mi_dashboard_limpieza_robot'
export const HA_SCRIPT_ENTITY = `script.${HA_SCRIPT_OBJECT_ID}`
const HA_BACKUP_SCENE_ID     = 'mi_dashboard_robot_modos_backup'

// Legacy "solo aspirado" schedule + automation — sweep-only is now a per-slot option,
// so these are kept empty / off (not deleted: the user can remove them from HA).
const HA_LEGACY_SCHEDULE_ID     = 'limpieza_robot_solo_aspirado'
const HA_LEGACY_AUTOMATION      = 'automation.limpieza_robot_solo_aspirado'

type HAConn = Connection & {
  sendMessagePromise: (msg: unknown) => Promise<unknown>
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

// v4: slots carry RunOptions (sweepOnly/suction/passes) instead of a global preset.
// Older versions are migrated slot by slot by normalizeSlot — never reset to defaults.
const SLOTS_VERSION = 4

interface Persisted {
  view:          ViewState
  slots:         ScheduleSlot[]
  slotsVersion?: number
}

export const DEFAULT_VIEW: ViewState = { rotation: 0, zoomByDevice: {} }

export const DEFAULT_SLOTS: ScheduleSlot[] = [
  { id: 'default-15', days: [0, 1, 2, 3, 4], time: '15:00', enabled: true, sweepOnly: false },
]

export interface SyncResult {
  ok:     boolean
  errors: string[]
}

export interface HASyncState {
  status:   'idle' | 'syncing' | 'ok' | 'error'
  message?: string
}

function getHAConn(): HAConn | null {
  return useHAStore.getState().connection as HAConn | null
}

function saveToHA(data: Persisted): void {
  const conn = getHAConn()
  if (!conn) return
  void conn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: { ...data, slotsVersion: SLOTS_VERSION } })
    .catch(() => { /* ignore — saves will retry on next change */ })
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/^\[Dashboard\]\s*/, '')
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

interface HASchedule {
  id:    string
  name:  string
  icon?: string
  [day: string]: unknown
}

/** Replace a schedule helper's blocks, keeping its name/icon (`schedule/update` requires name). */
async function writeSchedule(conn: HAConn, scheduleId: string, days: Record<string, unknown[]>): Promise<void> {
  const list = await conn.sendMessagePromise({ type: 'schedule/list' }) as HASchedule[]
  const current = list.find((s) => s.id === scheduleId)
  if (!current) throw new Error(`no existe schedule.${scheduleId} en HA`)
  await conn.sendMessagePromise({
    type:        'schedule/update',
    schedule_id: scheduleId,
    name:        current.name,
    ...(current.icon ? { icon: current.icon } : {}),
    ...days,
  })
}

async function clearLegacySchedule(conn: HAConn): Promise<void> {
  const list = await conn.sendMessagePromise({ type: 'schedule/list' }) as HASchedule[]
  const legacy = list.find((s) => s.id === HA_LEGACY_SCHEDULE_ID)
  if (!legacy) return
  const hasBlocks = DAY_KEYS.some((d) => Array.isArray(legacy[d]) && (legacy[d] as unknown[]).length > 0)
  if (!hasBlocks) return
  await writeSchedule(conn, HA_LEGACY_SCHEDULE_ID, Object.fromEntries(DAY_KEYS.map((d) => [d, []])))
}

async function getConfig(conn: Connection, path: string): Promise<unknown> {
  try {
    return await callRestAPI(conn, 'GET', path)
  } catch {
    return null // 404 → not created yet
  }
}

/** Write a config through the REST config API only when it differs (each write reloads the domain). */
async function upsertConfig(conn: Connection, path: string, desired: object): Promise<void> {
  const current = await getConfig(conn, path)
  if (current && sameConfig(current, desired)) return
  await callRestAPI(conn, 'POST', path, desired)
}

/**
 * Provision the static script + automation that run scheduled (and manual sweep-only)
 * cleanings. Idempotent. Refuses to write while room entities aren't loaded, so a cold
 * start can never overwrite the script with one lacking the sweep-only branch.
 */
export async function ensureHAAutomation(conn: Connection): Promise<void> {
  const entities = useHAStore.getState().entities
  if (!entities[VACUUM_ENTITY]) throw new Error('el robot todavía no está cargado')
  const roomModeEntities = findRoomModeEntities(deviceSlug(VACUUM_ENTITY), Object.keys(entities))
  if (roomModeEntities.length === 0) throw new Error('no se encontraron los selects por habitación del robot')

  await upsertConfig(conn, `/api/config/script/config/${HA_SCRIPT_OBJECT_ID}`, buildScriptConfig({
    vacuumEntity: VACUUM_ENTITY,
    roomModeEntities,
    backupSceneId: HA_BACKUP_SCENE_ID,
  }))
  await upsertConfig(conn, `/api/config/automation/config/${HA_AUTOMATION_ID}`, buildAutomationConfig({
    id:             HA_AUTOMATION_ID,
    scheduleEntity: HA_SCHEDULE_ENTITY,
    vacuumEntity:   VACUUM_ENTITY,
    scriptEntity:   HA_SCRIPT_ENTITY,
  }))
}

interface VacuumState {
  view:     ViewState
  slots:    ScheduleSlot[]
  haLoaded: boolean
  haSync:   HASyncState
  setRotation:             (r: RotDeg) => void
  setZoom:                 (z: number) => void
  setSlots:                (s: ScheduleSlot[]) => void
  /** Push slots to the schedule helper and (re)provision script + automation. Never turns the automation on. */
  syncScheduleHelpersToHA: (conn: Connection) => Promise<SyncResult>
  syncFromHA:              (conn: Connection) => Promise<void>
}

export const useVacuumStore = create<VacuumState>((set, get) => ({
  view:     DEFAULT_VIEW,
  slots:    DEFAULT_SLOTS,
  haLoaded: false,
  haSync:   { status: 'idle' },

  setRotation: (rotation) => {
    const view = { ...get().view, rotation }
    set({ view })
    saveToHA({ view, slots: get().slots })
  },

  setZoom: (zoom) => {
    const dev  = getDeviceId()
    const view = { ...get().view, zoomByDevice: { ...get().view.zoomByDevice, [dev]: zoom } }
    set({ view })
    saveToHA({ view, slots: get().slots })
  },

  setSlots: (slots) => {
    set({ slots })
    saveToHA({ view: get().view, slots })
  },

  syncScheduleHelpersToHA: async (conn) => {
    const haConn = conn as HAConn
    const { slots } = get()
    set({ haSync: { status: 'syncing' } })

    // Sequential on purpose: the automation must not reload while its schedule is being rewritten
    const errors: string[] = []
    const step = async (label: string, fn: () => Promise<unknown>) => {
      try { await fn() } catch (err) { errors.push(`${label}: ${errorMessage(err)}`) }
    }
    await step('Horarios',              () => writeSchedule(haConn, HA_SCHEDULE_ID, slotsToScheduleDays(slots)))
    await step('Horario legacy',        () => clearLegacySchedule(haConn))
    await step('Script/automatización', () => ensureHAAutomation(conn))
    await step('Automatización legacy', async () => {
      if (useHAStore.getState().entities[HA_LEGACY_AUTOMATION]?.state === 'on') {
        await callService(conn, 'automation', 'turn_off', undefined, { entity_id: HA_LEGACY_AUTOMATION })
      }
    })

    const ok = errors.length === 0
    set({ haSync: ok ? { status: 'ok' } : { status: 'error', message: errors.join(' · ') } })
    return { ok, errors }
  },

  syncFromHA: async (conn) => {
    const haConn = conn as HAConn
    try {
      const result = await haConn.sendMessagePromise({ type: 'frontend/get_user_data', key: HA_STORAGE_KEY })
      const haData = (result as { value: Partial<Persisted> | null }).value

      if (haData) {
        const slots = Array.isArray(haData.slots)
          ? haData.slots.map(normalizeSlot).filter((s): s is ScheduleSlot => s !== null)
          : DEFAULT_SLOTS
        set({ view: normalizeView(haData.view), slots })
        // Rewrite once in the v4 shape (drops the old global presets)
        if ((haData.slotsVersion ?? 0) < SLOTS_VERSION) saveToHA({ view: get().view, slots })
      } else {
        await haConn.sendMessagePromise({
          type: 'frontend/set_user_data', key: HA_STORAGE_KEY,
          value: { view: get().view, slots: get().slots, slotsVersion: SLOTS_VERSION },
        })
      }
    } catch {
      // HA unreachable — defaults stay, no data lost
    }
    set({ haLoaded: true })
  },
}))
