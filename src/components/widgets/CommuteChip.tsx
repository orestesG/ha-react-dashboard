import { useEntity } from '../../hooks/useEntity'
import type { CommuteRoute } from './CommuteCard'

interface CommuteChipProps {
  routes:         CommuteRoute[]
  personEntityId: string
}

export function CommuteChip({ routes, personEntityId }: CommuteChipProps) {
  const { entity: person } = useEntity(personEntityId)

  const hour = new Date().getHours()

  // Pick active route by time window first, then first route as fallback
  const activeRoute =
    routes.find((r) => r.chipHours && hour >= r.chipHours.from && hour < r.chipHours.to)
    ?? routes[0]

  // Always call hooks unconditionally
  const { entity } = useEntity(activeRoute?.entityId ?? '')

  // Only hide when definitely away — undefined means we don't know yet, so keep showing
  if (person?.state === 'not_home') return null
  if (!activeRoute) return null

  const mins = parseInt(entity?.state ?? '', 10)
  const Icon = activeRoute.icon

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-sm">
      <Icon size={15} className="text-accent-blue shrink-0" />
      <span className="font-medium text-text-primary tabular-nums">
        {isNaN(mins) ? '—' : `${mins} min`}
      </span>
      <span className="text-text-secondary/60 text-xs truncate">{activeRoute.label}</span>
    </div>
  )
}
