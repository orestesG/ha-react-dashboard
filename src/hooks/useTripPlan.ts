import { useShallow } from 'zustand/react/shallow'
import { useHAStore } from '../store/ha-store'
import { inChipWindow, legFromState, mondayIndex, planTrip, runsToday } from '../lib/commute'
import type { CommuteTrip } from '../components/widgets/CommuteCard'

/** Tramos del viaje desde los sensores Waze + plan de salida/llegadas con el tráfico actual. */
export function useTripPlan(trip: CommuteTrip, now: Date) {
  const workday = useHAStore((s) => trip.workdayEntityId ? s.entities[trip.workdayEntityId]?.state : undefined)
  const legEntities = useHAStore(useShallow((s) => trip.stops.map((stop) => s.entities[stop.entityId])))

  const legs  = legEntities.map((e) => legFromState(e?.state, e?.attributes?.distance))
  const today = runsToday(trip, now, workday)
  const live  = today && inChipWindow(trip, now)

  return {
    legs,
    missing: legEntities.map((e) => e === undefined),
    plan:    planTrip(trip.stops, legs, now, live),
    today,
    live,
    // Día del viaje pero el sensor Workday lo marca libre
    holiday: workday === 'off' && (!trip.days || trip.days.includes(mondayIndex(now))),
  }
}
