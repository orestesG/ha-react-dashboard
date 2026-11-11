import { useShallow } from 'zustand/react/shallow'
import { useEntity } from '../../hooks/useEntity'
import { useNow } from '../../hooks/useNow'
import { useTripPlan } from '../../hooks/useTripPlan'
import { useHAStore } from '../../store/ha-store'
import { inChipWindow, runsToday, tripStatus } from '../../lib/commute'
import type { TripTone } from '../../lib/commute'
import type { CommuteRoute, CommuteTrip } from './CommuteCard'

interface CommuteChipProps {
  routes:         CommuteRoute[]
  trips?:         CommuteTrip[]
  personEntityId: string
}

const TONE_ICON: Record<TripTone, string> = {
  ok:   'text-accent-blue',
  soon: 'text-accent-orange',
  late: 'text-accent-red',
  none: 'text-accent-blue',
}

function TripChip({ trip, now }: { trip: CommuteTrip; now: Date }) {
  const { plan, live } = useTripPlan(trip, now)
  const { text, tone } = tripStatus(plan, live)
  const Icon = trip.icon

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-sm">
      <Icon size={15} className={`${TONE_ICON[tone]} shrink-0`} />
      <span className={`font-medium tabular-nums ${tone === 'late' ? 'text-accent-red' : 'text-text-primary'}`}>
        {text}
      </span>
      <span className="text-text-secondary text-xs truncate">{trip.label}</span>
    </div>
  )
}

function RouteChip({ routes, now }: { routes: CommuteRoute[]; now: Date }) {
  const hour = now.getHours()

  // Pick active route by time window first, then first route as fallback
  const activeRoute =
    routes.find((r) => r.chipHours && hour >= r.chipHours.from && hour < r.chipHours.to)
    ?? routes[0]

  // Always call hooks unconditionally
  const { entity } = useEntity(activeRoute?.entityId ?? '')

  if (!activeRoute) return null

  const mins = parseInt(entity?.state ?? '', 10)
  const Icon = activeRoute.icon

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-sm">
      <Icon size={15} className="text-accent-blue shrink-0" />
      <span className="font-medium text-text-primary tabular-nums">
        {isNaN(mins) ? '—' : `${mins} min`}
      </span>
      <span className="text-text-secondary text-xs truncate">{activeRoute.label}</span>
    </div>
  )
}

export function CommuteChip({ routes, trips = [], personEntityId }: CommuteChipProps) {
  const { entity: person } = useEntity(personEntityId)
  const now = useNow()
  const workdays = useHAStore(useShallow((s) =>
    trips.map((t) => t.workdayEntityId ? s.entities[t.workdayEntityId]?.state : undefined),
  ))

  // A trip running today inside its window takes the chip over the single routes
  const activeTrip = trips.find((t, i) => runsToday(t, now, workdays[i]) && inChipWindow(t, now))

  // Only hide when definitely away — undefined means we don't know yet, so keep showing
  if (person?.state === 'not_home') return null

  return activeTrip
    ? <TripChip trip={activeTrip} now={now} />
    : <RouteChip routes={routes} now={now} />
}
