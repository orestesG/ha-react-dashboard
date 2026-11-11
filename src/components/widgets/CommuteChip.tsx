import { useShallow } from 'zustand/react/shallow'
import { useEntity } from '../../hooks/useEntity'
import { useNow } from '../../hooks/useNow'
import { useTripPlan } from '../../hooks/useTripPlan'
import { useHAStore } from '../../store/ha-store'
import { formatClock, inChipWindow, inDepartureWindow, routeInChip, runsToday, tripBar, tripStatus } from '../../lib/commute'
import type { TripBar } from '../../lib/commute'
import type { CommuteRoute, CommuteTrip } from './CommuteCard'

interface CommuteChipProps {
  routes:         CommuteRoute[]
  trips?:         CommuteTrip[]
  personEntityId: string
}

/** Timeline de ahora a la llegada: hueco = falta para salir, azul = manejo, gris = parada, marca = hora fija. */
function TripTimeline({ bar, late }: { bar: TripBar | null; late: boolean }) {
  const drive = late ? 'bg-accent-red' : 'bg-accent-blue'
  const firstMoving = bar?.segments.findIndex((s) => s.kind !== 'wait') ?? -1
  const last = (bar?.segments.length ?? 0) - 1

  return (
    <div className="relative h-1.5 rounded-full bg-bg-secondary">
      <div className="flex h-full">
        {bar?.segments.map((s, i) => (
          <span
            key={i}
            style={{ width: `${s.pct}%` }}
            className={s.kind === 'wait' ? '' : [
              s.kind === 'leg' ? drive : 'bg-text-secondary',
              i === firstMoving ? 'rounded-l-full' : 'border-l-2 border-bg-secondary',
              i === last && 'rounded-r-full',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
      {bar?.marks.map((m) => (
        <span
          key={m}
          style={{ left: `${m}%` }}
          className="absolute -top-[3px] -ml-px w-0.5 h-3 rounded-full bg-text-primary"
        />
      ))}
    </div>
  )
}

function TripChip({ trip, now }: { trip: CommuteTrip; now: Date }) {
  const { legs, plan, live } = useTripPlan(trip, now)
  // Fuera del horario de salida el viaje sigue ocupando su franja, pero sin chip
  if (!inDepartureWindow(trip, plan, now)) return null

  const { text, tone } = tripStatus(plan, live)
  const late = tone === 'late'
  const arrive = plan.stops[plan.stops.length - 1]?.arrive
  const Icon = trip.icon

  return (
    <div
      title={trip.label}
      className="flex items-center gap-2.5 w-full md:w-[280px] min-h-[44px] px-3.5 py-1.5 rounded-xl bg-bg-tertiary"
    >
      <Icon size={16} className={`${late ? 'text-accent-red' : 'text-accent-blue'} shrink-0`} />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-sm leading-4">
          {tone === 'soon' && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse shrink-0" />}
          <span className={`font-medium tabular-nums ${late ? 'text-accent-red' : 'text-text-primary'}`}>{text}</span>
          {arrive && (
            <span className="ml-auto text-xs text-text-secondary tabular-nums">llegás {formatClock(arrive)}</span>
          )}
        </div>
        <TripTimeline bar={tripBar(trip.stops, legs, plan, now)} late={late} />
      </div>
    </div>
  )
}

function RouteChip({ route }: { route: CommuteRoute }) {
  const { entity } = useEntity(route.entityId)
  const mins = parseInt(entity?.state ?? '', 10)
  const Icon = route.icon

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-sm">
      <Icon size={15} className="text-accent-blue shrink-0" />
      <span className="font-medium text-text-primary tabular-nums">
        {isNaN(mins) ? '—' : `${mins} min`}
      </span>
      <span className="text-text-secondary text-xs truncate">{route.label}</span>
    </div>
  )
}

/** Solo con la persona en casa y en horario de salida; si no, no ocupa lugar en el header. */
export function CommuteChip({ routes, trips = [], personEntityId }: CommuteChipProps) {
  const { entity: person } = useEntity(personEntityId)
  const now = useNow()
  const workdays = useHAStore(useShallow((s) =>
    [...trips, ...routes].map((t) => t.workdayEntityId ? s.entities[t.workdayEntityId]?.state : undefined),
  ))

  // Un viaje que corre hoy ocupa el chip durante su franja; las rutas, solo dentro de la suya
  const trip  = trips.find((t, i) => runsToday(t, now, workdays[i]) && inChipWindow(t, now))
  const route = routes.find((r, i) => routeInChip(r, now, workdays[trips.length + i]))

  // Only hide when definitely away — undefined means we don't know yet, so keep showing
  if (person?.state === 'not_home') return null
  if (trip) return <TripChip trip={trip} now={now} />
  return route ? <RouteChip route={route} /> : null
}
