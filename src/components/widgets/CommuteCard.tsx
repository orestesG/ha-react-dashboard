import { useEntity } from '../../hooks/useEntity'
import { useHAStore } from '../../store/ha-store'
import { Car } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CommuteRoute {
  entityId:   string
  label:      string
  icon:       LucideIcon
  chipHours?: { from: number; to: number }
}

interface CommuteCardProps {
  routes:         CommuteRoute[]
  personEntityId: string
}

function durationClasses(mins: number): { text: string; bg: string } {
  if (mins < 15) return { text: 'text-accent-green',  bg: 'bg-accent-green'  }
  if (mins < 30) return { text: 'text-accent-yellow', bg: 'bg-accent-yellow' }
  if (mins < 45) return { text: 'text-accent-orange', bg: 'bg-accent-orange' }
  return               { text: 'text-accent-red',    bg: 'bg-accent-red'    }
}

function CommuteRow({ entityId, label, icon: Icon }: CommuteRoute) {
  const { entity } = useEntity(entityId)
  const entityCount = useHAStore((s) => s.entityCount)

  // Show skeleton only while HA hasn't loaded any entities yet.
  // Once entities are loaded, a missing entityId means it doesn't exist → show placeholder.
  const stillLoading = entity === undefined && entityCount === 0

  const mins = parseInt(entity?.state ?? '', 10)
  const km   = entity?.attributes?.distance as number | undefined

  if (stillLoading) {
    return (
      <div className="py-2 animate-pulse">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-4 h-4 rounded bg-gray-500/30 shrink-0" />
          <div className="h-3 w-20 rounded bg-gray-500/30 flex-1" />
          <div className="h-3 w-12 rounded bg-gray-500/30" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-500/20 ml-7" />
      </div>
    )
  }

  if (!entity || isNaN(mins)) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Icon size={16} className="text-text-secondary/40 shrink-0" />
        <span className="text-sm text-text-secondary flex-1">{label}</span>
        <span className="text-xs text-text-secondary/40 tabular-nums">—</span>
      </div>
    )
  }

  const { text, bg } = durationClasses(mins)
  const barPct = Math.min(Math.round((mins / 60) * 100), 100)

  return (
    <div className="py-2">
      <div className="flex items-center gap-3 mb-1.5">
        <Icon size={16} className={`${text} shrink-0`} />
        <span className="text-sm text-text-primary flex-1 truncate">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${text}`}>{mins} min</span>
        {km !== undefined && (
          <span className="text-xs text-text-secondary/55 tabular-nums w-12 text-right shrink-0">
            {km.toFixed(1)} km
          </span>
        )}
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden ml-7">
        <div
          className={`h-full rounded-full ${bg} transition-all duration-500`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  )
}

export function CommuteCard({ routes, personEntityId }: CommuteCardProps) {
  const { entity: person } = useEntity(personEntityId)
  const isHome = person?.state === 'home'
  const isAway = person?.state === 'not_home'

  return (
    <div className="h-full bg-bg-secondary rounded-2xl border border-border-main p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div className="flex items-center gap-2">
          <Car size={18} className="text-accent-blue" />
          <h3 className="text-text-primary font-semibold">Commute</h3>
        </div>
        {person && (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${isHome ? 'text-accent-green' : 'text-text-secondary'}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isHome ? 'bg-accent-green animate-pulse' : 'bg-gray-500'}`} />
            {isHome ? 'En casa' : isAway ? 'Fuera' : person.state}
          </span>
        )}
      </div>

      <div className={`divide-y divide-border-main flex-1 ${isAway ? 'opacity-50' : ''}`}>
        {routes.map((route) => (
          <CommuteRow key={route.entityId} {...route} />
        ))}
      </div>
    </div>
  )
}
