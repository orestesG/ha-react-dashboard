import { Fragment } from 'react'
import { useEntity } from '../../hooks/useEntity'
import { useNow } from '../../hooks/useNow'
import { useTripPlan } from '../../hooks/useTripPlan'
import { useHAStore } from '../../store/ha-store'
import { formatClock, formatDays, tripStatus } from '../../lib/commute'
import type { Leg, TripSchedule, TripStop, TripTone } from '../../lib/commute'
import { Car } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface CommuteRoute {
  entityId:   string
  label:      string
  icon:       LucideIcon
  chipHours?: { from: number; to: number }
}

/** Viaje con paradas: cada parada lleva el sensor Waze del tramo que llega a ella. */
export interface CommuteTrip extends TripSchedule {
  id:               string
  label:            string
  icon:             LucideIcon
  from?:            string   // nombre del origen, por defecto 'Casa'
  workdayEntityId?: string   // binary_sensor de la integración Workday: 'off' en feriados
  stops:            TripStop[]
}

interface CommuteCardProps {
  routes:         CommuteRoute[]
  trips?:         CommuteTrip[]
  personEntityId: string
}

const TONE_TEXT: Record<TripTone, string> = {
  ok:   'text-accent-green',
  soon: 'text-accent-orange',
  late: 'text-accent-red',
  none: 'text-text-secondary',
}

function durationClasses(mins: number): { text: string; bg: string } {
  if (mins < 15) return { text: 'text-accent-green',  bg: 'bg-accent-green'  }
  if (mins < 30) return { text: 'text-accent-yellow', bg: 'bg-accent-yellow' }
  if (mins < 45) return { text: 'text-accent-orange', bg: 'bg-accent-orange' }
  return               { text: 'text-accent-red',    bg: 'bg-accent-red'    }
}

function RowSkeleton() {
  return (
    <div className="py-2 animate-pulse">
      <div className="flex items-center gap-3 mb-1.5">
        <div className="w-4 h-4 rounded-lg bg-bg-tertiary shrink-0" />
        <div className="h-3 w-20 rounded-lg bg-bg-tertiary flex-1" />
        <div className="h-3 w-12 rounded-lg bg-bg-tertiary" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-bg-tertiary ml-7" />
    </div>
  )
}

function CommuteRow({ entityId, label, icon: Icon }: CommuteRoute) {
  const { entity } = useEntity(entityId)
  const entityCount = useHAStore((s) => s.entityCount)

  // Show skeleton only while HA hasn't loaded any entities yet.
  // Once entities are loaded, a missing entityId means it doesn't exist → show placeholder.
  const stillLoading = entity === undefined && entityCount === 0

  const mins = parseInt(entity?.state ?? '', 10)
  const km   = entity?.attributes?.distance as number | undefined

  if (stillLoading) return <RowSkeleton />

  if (!entity || isNaN(mins)) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Icon size={16} className="text-text-secondary shrink-0" />
        <span className="text-sm text-text-secondary flex-1">{label}</span>
        <span className="text-xs text-text-secondary tabular-nums">—</span>
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
          <span className="text-xs text-text-secondary tabular-nums w-12 text-right shrink-0">
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

function TimelineStop({ label, time, hint, late, origin = false }: {
  label:   string
  time:    Date | null
  hint?:   string
  late?:   number
  origin?: boolean
}) {
  return (
    <li className="flex items-center gap-3 h-6">
      <span className="w-2.5 flex justify-center shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${origin ? 'border-2 border-text-secondary' : 'bg-accent-blue'}`} />
      </span>
      <span className="text-sm text-text-primary truncate">{label}</span>
      {hint && <span className="text-xs text-text-secondary truncate">{hint}</span>}
      <span className="ml-auto flex items-center gap-1.5 shrink-0 tabular-nums">
        {!!late && <span className="text-xs font-medium text-accent-red">+{late} min</span>}
        <span className="text-sm text-text-primary">{time ? formatClock(time) : '—'}</span>
      </span>
    </li>
  )
}

function TimelineLeg({ leg, missing }: { leg: Leg; missing: boolean }) {
  const text = leg.mins !== null ? durationClasses(leg.mins).text : 'text-text-secondary'
  return (
    <li className="flex items-stretch gap-3">
      <span className="w-2.5 flex justify-center shrink-0">
        <span className="w-0.5 bg-border-main" />
      </span>
      <span className="py-1 text-xs tabular-nums">
        {leg.mins !== null ? (
          <>
            <span className={`font-medium ${text}`}>{Math.round(leg.mins)} min</span>
            {leg.km !== null && <span className="text-text-secondary"> · {leg.km.toFixed(1)} km</span>}
          </>
        ) : (
          <span className="text-text-secondary">{missing ? 'Sin sensor' : '—'}</span>
        )}
      </span>
    </li>
  )
}

function TripRow({ trip, now }: { trip: CommuteTrip; now: Date }) {
  const { legs, missing, plan, today, live, holiday } = useTripPlan(trip, now)
  const entityCount = useHAStore((s) => s.entityCount)

  if (entityCount === 0) return <RowSkeleton />

  const status = today
    ? tripStatus(plan, live)
    : { text: holiday ? 'Feriado' : formatDays(trip.days), tone: 'none' as const }
  const Icon = trip.icon

  return (
    <div className="py-3">
      <div className="flex items-center gap-3 mb-2">
        <Icon size={16} className={`${status.tone === 'none' ? 'text-accent-blue' : TONE_TEXT[status.tone]} shrink-0`} />
        <span className="text-sm text-text-primary flex-1 truncate">{trip.label}</span>
        <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[status.tone]}`}>{status.text}</span>
      </div>

      <ol className="ml-7">
        <TimelineStop label={trip.from ?? 'Casa'} time={plan.depart} origin />
        {trip.stops.map((stop, i) => {
          const hints = [
            stop.arriveBy && `llegar ${stop.arriveBy}`,
            stop.dwellMin && i < trip.stops.length - 1 && `parada ${stop.dwellMin} min`,
          ].filter(Boolean)
          return (
            <Fragment key={stop.entityId}>
              <TimelineLeg leg={legs[i]} missing={missing[i]} />
              <TimelineStop
                label={stop.label}
                time={plan.stops[i].arrive}
                hint={hints.join(' · ') || undefined}
                late={plan.stops[i].late}
              />
            </Fragment>
          )
        })}
      </ol>

      {trip.stops.length > 1 && plan.totalMins !== null && (
        <p className="ml-7 mt-1.5 text-xs text-text-secondary tabular-nums">
          Total {Math.round(plan.totalMins)} min
          {plan.totalKm !== null && ` · ${plan.totalKm.toFixed(1)} km`}
        </p>
      )}
    </div>
  )
}

export function CommuteCard({ routes, trips = [], personEntityId }: CommuteCardProps) {
  const { entity: person } = useEntity(personEntityId)
  const now = useNow()
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
        {trips.map((trip) => (
          <TripRow key={trip.id} trip={trip} now={now} />
        ))}
        {routes.map((route) => (
          <CommuteRow key={route.entityId} {...route} />
        ))}
      </div>
    </div>
  )
}
