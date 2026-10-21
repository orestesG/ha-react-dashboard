import { create } from 'zustand'
import type { ResponsiveLayouts, LayoutItem } from 'react-grid-layout'
import type { Connection } from 'home-assistant-js-websocket'
import { useHAStore } from './ha-store'

const LS_KEY_TABS    = 'ha-dashboard-tabs-v1'   // read-once for migration only
const HA_STORAGE_KEY = 'mi-dashboard-tabs-v2'   // y/h in px
// Row-based layouts (rowHeight 100 + 16 margin). Read-only: an older panel build keeps using it untouched.
const LEGACY_HA_STORAGE_KEY = 'mi-dashboard-tabs-v1'

// ── Grid units ────────────────────────────────────────────────────────────────
// 1 grid row = 1px, so a card can fit its content exactly. The grid's vertical margin is 0:
// each item reserves GRID_GAP at its bottom instead. A stored `h` is the card's max height
// (gap included) — cards shrink to their content below it.

export const GRID_GAP = 16
const LEGACY_ROW_PX = 116

function rowsToPx(item: LayoutItem): LayoutItem {
  return {
    ...item,
    y: item.y * LEGACY_ROW_PX,
    h: item.h * LEGACY_ROW_PX,
    ...(item.minH !== undefined && { minH: item.minH * LEGACY_ROW_PX }),
    ...(item.maxH !== undefined && { maxH: item.maxH * LEGACY_ROW_PX }),
  }
}

function tabsRowsToPx(tabs: TabDef[]): TabDef[] {
  return tabs.map((t) => ({
    ...t,
    layouts: Object.fromEntries(
      Object.entries(t.layouts).map(([bp, layout]) => [bp, layout?.map(rowsToPx)]),
    ),
  }))
}

// ── Main tab default layouts (in legacy rows, converted below) ────────────────

const DEFAULT_MAIN_LG: LayoutItem[] = [
  { i: 'favorites', x: 0, y: 0,  w: 1, h: 5, minW: 1, minH: 3 },
  { i: 'living',    x: 1, y: 0,  w: 1, h: 5 },
  { i: 'cocina',    x: 2, y: 0,  w: 1, h: 4 },
  { i: 'oficina',   x: 3, y: 0,  w: 1, h: 6 },
  { i: 'vacuum',    x: 0, y: 5,  w: 1, h: 3 },
  { i: 'cuarto',    x: 1, y: 5,  w: 1, h: 5 },
  { i: 'bano',      x: 2, y: 4,  w: 1, h: 2 },
  { i: 'balcon',    x: 2, y: 6,  w: 1, h: 2 },
  { i: 'pasillo',   x: 3, y: 6,  w: 1, h: 3 },
]

const DEFAULT_MAIN_MD: LayoutItem[] = [
  { i: 'favorites', x: 0, y: 0,  w: 1, h: 5, minW: 1, minH: 3 },
  { i: 'living',    x: 1, y: 0,  w: 1, h: 5 },
  { i: 'cocina',    x: 0, y: 5,  w: 1, h: 4 },
  { i: 'oficina',   x: 1, y: 5,  w: 1, h: 6 },
  { i: 'cuarto',    x: 0, y: 9,  w: 1, h: 5 },
  { i: 'bano',      x: 1, y: 11, w: 1, h: 2 },
  { i: 'pasillo',   x: 1, y: 13, w: 1, h: 3 },
  { i: 'vacuum',    x: 0, y: 14, w: 1, h: 3 },
  { i: 'balcon',    x: 0, y: 17, w: 1, h: 2 },
]

const DEFAULT_MAIN_SM: LayoutItem[] = DEFAULT_MAIN_LG.map((item, idx) => ({
  ...item, x: 0, y: idx * 4, w: 1,
}))

// ── Ara Dash default layout ───────────────────────────────────────────────────

const DEFAULT_ARA_LG: LayoutItem[] = [
  { i: 'exchange-rates', x: 0, y: 0, w: 2, h: 4 },
]

const DEFAULT_ARA_SM: LayoutItem[] = DEFAULT_ARA_LG.map((item, idx) => ({
  ...item, x: 0, y: idx * 4, w: 1,
}))

// ── Detalle Dash default layout (data-heavy cards, loaded on demand) ───────────

const DEFAULT_DETALLE_LG: LayoutItem[] = [
  { i: 'weather', x: 0, y: 0, w: 4, h: 3 },
  { i: 'energy',  x: 0, y: 3, w: 2, h: 6 },
  { i: 'battery', x: 2, y: 3, w: 2, h: 6 },
  { i: 'commute', x: 0, y: 9, w: 2, h: 4 },
]

const DEFAULT_DETALLE_MD: LayoutItem[] = [
  { i: 'weather', x: 0, y: 0, w: 2, h: 3 },
  { i: 'energy',  x: 0, y: 3, w: 1, h: 6 },
  { i: 'battery', x: 1, y: 3, w: 1, h: 6 },
  { i: 'commute', x: 0, y: 9, w: 2, h: 4 },
]

const DEFAULT_DETALLE_SM: LayoutItem[] = DEFAULT_DETALLE_LG.map((item, idx) => ({
  ...item, x: 0, y: idx * 4, w: 1,
}))

// ── Tab definitions ───────────────────────────────────────────────────────────

export interface TabDef {
  id:      string
  label:   string
  itemIds: string[]
  layouts: ResponsiveLayouts
}

const MAIN_ITEM_IDS = [
  'favorites','living','cocina','oficina','cuarto','bano',
  'pasillo','balcon','vacuum',
]

const DETALLE_ITEM_IDS = ['weather','energy','battery','commute']

const DEFAULT_TABS: TabDef[] = tabsRowsToPx([
  {
    id:      'main',
    label:   'Dashboard',
    itemIds: MAIN_ITEM_IDS,
    layouts: { lg: DEFAULT_MAIN_LG, md: DEFAULT_MAIN_MD, sm: DEFAULT_MAIN_SM },
  },
  {
    id:      'ara-dash',
    label:   'Ara Dash',
    itemIds: ['exchange-rates'],
    layouts: { lg: DEFAULT_ARA_LG, md: DEFAULT_ARA_LG, sm: DEFAULT_ARA_SM },
  },
  {
    id:      'detalle',
    label:   'Detalle',
    itemIds: DETALLE_ITEM_IDS,
    layouts: { lg: DEFAULT_DETALLE_LG, md: DEFAULT_DETALLE_MD, sm: DEFAULT_DETALLE_SM },
  },
])

// ── Persisted shape ───────────────────────────────────────────────────────────

// Bump when DEFAULT_TABS structure changes to force a reset of stored layouts.
const TABS_VERSION = 3

interface Persisted {
  tabs:        TabDef[]
  activeTabId: string
  version?:    number
}

// ── HA storage helpers ────────────────────────────────────────────────────────

type HAConn = Connection & {
  sendMessagePromise: (msg: unknown) => Promise<{ value: unknown }>
}

function getHAConn(): HAConn | null {
  return useHAStore.getState().connection as HAConn | null
}

async function getUserData(conn: HAConn, key: string): Promise<Persisted | null> {
  const result = await conn.sendMessagePromise({ type: 'frontend/get_user_data', key })
  return (result as { value: Persisted | null }).value
}

function isCurrent(data: Persisted | null): data is Persisted {
  return !!data && Array.isArray(data.tabs) && data.tabs.length > 0 && (data.version ?? 0) >= TABS_VERSION
}

function saveToHA(data: Persisted): void {
  const conn = getHAConn()
  if (!conn) return
  void conn.sendMessagePromise({ type: 'frontend/set_user_data', key: HA_STORAGE_KEY, value: { ...data, version: TABS_VERSION } })
    .catch(() => { /* ignore — saves will retry on next change */ })
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface LayoutState {
  tabs:        TabDef[]
  activeTabId: string
  editMode:    boolean
  haLoaded:    boolean
  setLayouts:    (l: ResponsiveLayouts) => void
  setActiveTab:  (id: string) => void
  toggleEditMode: () => void
  resetLayouts:  () => void
  syncFromHA:    (conn: Connection) => Promise<void>
}

export const useLayoutStore = create<LayoutState>((set) => ({
  tabs:        DEFAULT_TABS,
  activeTabId: 'main',
  editMode:    false,
  haLoaded:    false,

  setLayouts: (layouts) => {
    set((s) => {
      const tabs = s.tabs.map((t) =>
        t.id === s.activeTabId ? { ...t, layouts } : t
      )
      saveToHA({ tabs, activeTabId: s.activeTabId })
      return { tabs }
    })
  },

  setActiveTab: (id) => {
    set((s) => {
      saveToHA({ tabs: s.tabs, activeTabId: id })
      return { activeTabId: id }
    })
  },

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  resetLayouts: () => {
    set((s) => {
      const defaultTab = DEFAULT_TABS.find((t) => t.id === s.activeTabId)
      if (!defaultTab) return s
      const tabs = s.tabs.map((t) =>
        t.id === s.activeTabId ? { ...t, layouts: defaultTab.layouts } : t
      )
      saveToHA({ tabs, activeTabId: s.activeTabId })
      return { tabs }
    })
  },

  syncFromHA: async (conn) => {
    const haConn = conn as HAConn
    try {
      const haData = await getUserData(haConn, HA_STORAGE_KEY)

      if (isCurrent(haData)) {
        // HA has up-to-date data — apply it (cross-device sync).
        // Always start on the first tab so heavy cards on other tabs load on demand.
        set({ tabs: haData.tabs, activeTabId: 'main' })
      } else {
        // No px layout yet: convert the row-based one (HA, or localStorage on a first run)
        let tabs = DEFAULT_TABS
        const legacy = await getUserData(haConn, LEGACY_HA_STORAGE_KEY)
        if (isCurrent(legacy)) {
          tabs = tabsRowsToPx(legacy.tabs)
        } else if (!legacy && !haData) {
          try {
            const lsRaw = localStorage.getItem(LS_KEY_TABS)
            if (lsRaw) {
              const lsData = JSON.parse(lsRaw) as Persisted
              if (Array.isArray(lsData.tabs) && lsData.tabs.length > 0) tabs = tabsRowsToPx(lsData.tabs)
            }
          } catch { /* ignore */ }
        }
        // else: stored layout predates the current tab structure — reset to defaults

        set({ tabs, activeTabId: 'main' })
        await haConn.sendMessagePromise({
          type:  'frontend/set_user_data',
          key:   HA_STORAGE_KEY,
          value: { tabs, activeTabId: 'main', version: TABS_VERSION },
        })
        try { localStorage.removeItem(LS_KEY_TABS) } catch { /* ignore */ }
      }
    } catch {
      // HA unreachable — defaults stay, no data lost
    }
    set({ haLoaded: true })
  },
}))

// Keep for any external references
export const DEFAULT_LAYOUTS = DEFAULT_TABS[0].layouts
