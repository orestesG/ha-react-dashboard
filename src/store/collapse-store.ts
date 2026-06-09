import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CollapseStore {
  collapsed: string[]
  toggle: (id: string) => void
  isCollapsed: (id: string) => boolean
}

export const useCollapseStore = create<CollapseStore>()(
  persist(
    (set, get) => ({
      collapsed: [],
      toggle: (id) =>
        set((s) => ({
          collapsed: s.collapsed.includes(id)
            ? s.collapsed.filter((x) => x !== id)
            : [...s.collapsed, id],
        })),
      isCollapsed: (id) => get().collapsed.includes(id),
    }),
    { name: 'ha-dashboard-collapsed' }
  )
)
