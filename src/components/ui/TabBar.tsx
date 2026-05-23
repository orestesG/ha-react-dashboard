import type { TabDef } from '../../store/layout-store'

interface TabBarProps {
  tabs:        TabDef[]
  activeTabId: string
  onSelect:    (id: string) => void
}

export function TabBar({ tabs, activeTabId, onSelect }: TabBarProps) {
  return (
    <div className="flex gap-0 mb-5 border-b border-border-main">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              relative px-5 py-2.5 text-sm font-medium transition-colors
              ${active
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
              }
            `}
          >
            {tab.label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-t-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
