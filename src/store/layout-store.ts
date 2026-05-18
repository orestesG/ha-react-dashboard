import { create } from 'zustand'
import type { ResponsiveLayouts, LayoutItem } from 'react-grid-layout'

const LS_KEY = 'ha-dashboard-layout-v3'

const DEFAULT_LG: LayoutItem[] = [
  { i: 'living',  x: 0, y: 0,  w: 1, h: 5 },
  { i: 'cocina',  x: 1, y: 0,  w: 1, h: 4 },
  { i: 'oficina', x: 2, y: 0,  w: 1, h: 6 },
  { i: 'cuarto',  x: 3, y: 0,  w: 1, h: 5 },
  { i: 'bano',    x: 0, y: 5,  w: 1, h: 2 },
  { i: 'pasillo', x: 1, y: 4,  w: 1, h: 3 },
  { i: 'balcon',  x: 2, y: 6,  w: 1, h: 2 },
  { i: 'vacuum',  x: 3, y: 5,  w: 1, h: 3 },
  { i: 'weather', x: 0, y: 8,  w: 4, h: 3 },
  { i: 'energy',  x: 0, y: 11, w: 2, h: 5 },
  { i: 'battery', x: 2, y: 11, w: 2, h: 5 },
]

const DEFAULT_MD: LayoutItem[] = [
  { i: 'living',  x: 0, y: 0,  w: 1, h: 5 },
  { i: 'cocina',  x: 1, y: 0,  w: 1, h: 4 },
  { i: 'oficina', x: 0, y: 5,  w: 1, h: 6 },
  { i: 'cuarto',  x: 1, y: 4,  w: 1, h: 5 },
  { i: 'bano',    x: 0, y: 11, w: 1, h: 2 },
  { i: 'pasillo', x: 1, y: 9,  w: 1, h: 3 },
  { i: 'balcon',  x: 0, y: 13, w: 1, h: 2 },
  { i: 'vacuum',  x: 1, y: 12, w: 1, h: 3 },
  { i: 'weather', x: 0, y: 15, w: 2, h: 3 },
  { i: 'energy',  x: 0, y: 18, w: 1, h: 5 },
  { i: 'battery', x: 1, y: 18, w: 1, h: 5 },
]

const DEFAULT_SM: LayoutItem[] = DEFAULT_LG.map((item, idx) => ({
  ...item,
  x: 0,
  y: idx * 4,
  w: 1,
}))

export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: DEFAULT_LG,
  md: DEFAULT_MD,
  sm: DEFAULT_SM,
}

function loadLayouts(): ResponsiveLayouts {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as ResponsiveLayouts
  } catch {
    // ignore
  }
  return DEFAULT_LAYOUTS
}

interface LayoutState {
  layouts: ResponsiveLayouts
  editMode: boolean
  setLayouts: (l: ResponsiveLayouts) => void
  toggleEditMode: () => void
  resetLayouts: () => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layouts: loadLayouts(),
  editMode: false,

  setLayouts: (layouts) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(layouts))
    } catch {
      // ignore storage errors
    }
    set({ layouts })
  },

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

  resetLayouts: () => {
    localStorage.removeItem(LS_KEY)
    set({ layouts: DEFAULT_LAYOUTS })
  },
}))
