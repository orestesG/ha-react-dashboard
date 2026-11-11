import { describe, expect, it } from 'vitest'
import {
  arrivalOffsets,
  formatClock,
  formatDays,
  inChipWindow,
  inDepartureWindow,
  legFromState,
  mondayIndex,
  planTrip,
  routeInChip,
  runsToday,
  tripBar,
  tripStatus,
  type Leg,
  type TripStop,
} from './commute'

// 2026-11-10 es martes
const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m)

const SCHOOL_RUN: TripStop[] = [
  { entityId: 'sensor.casa_colegio',    label: 'Colegio', arriveBy: '09:00', dwellMin: 5 },
  { entityId: 'sensor.colegio_trabajo', label: 'Trabajo' },
]
const FREE_RUN: TripStop[] = SCHOOL_RUN.map((s) => ({ ...s, arriveBy: undefined }))
const LEGS: Leg[] = [{ mins: 10, km: 3.5 }, { mins: 15, km: 4.5 }]

describe('legFromState', () => {
  it('parses Waze minutes and distance', () => {
    expect(legFromState('14.05', 6.009)).toEqual({ mins: 14.05, km: 6.009 })
  })

  it('returns nulls for unavailable sensors', () => {
    expect(legFromState('unavailable', undefined)).toEqual({ mins: null, km: null })
    expect(legFromState(undefined, '3')).toEqual({ mins: null, km: null })
  })
})

describe('arrivalOffsets', () => {
  it('adds legs plus the dwell at previous stops', () => {
    expect(arrivalOffsets(SCHOOL_RUN, LEGS)).toEqual([10, 30])
  })

  it('stops at the first leg without data', () => {
    expect(arrivalOffsets(SCHOOL_RUN, [{ mins: null, km: null }, LEGS[1]])).toEqual([null, null])
    expect(arrivalOffsets(SCHOOL_RUN, [LEGS[0], { mins: null, km: null }])).toEqual([10, null])
  })
})

describe('runsToday / inChipWindow', () => {
  const weekdays = { days: [0, 1, 2, 3, 4], chipHours: { from: 6, to: 10 } }

  it('uses monday-based day indexes', () => {
    expect(mondayIndex(at(8))).toBe(1)
    expect(mondayIndex(new Date(2026, 10, 15))).toBe(6) // domingo
  })

  it('skips days outside the list and holidays from the workday sensor', () => {
    expect(runsToday(weekdays, at(8))).toBe(true)
    expect(runsToday(weekdays, new Date(2026, 10, 14, 8))).toBe(false) // sábado
    expect(runsToday(weekdays, at(8), 'off')).toBe(false)
    expect(runsToday(weekdays, at(8), 'unavailable')).toBe(true)
  })

  it('limits the chip to its hour window', () => {
    expect(inChipWindow(weekdays, at(9, 59))).toBe(true)
    expect(inChipWindow(weekdays, at(10))).toBe(false)
    expect(inChipWindow({}, at(23))).toBe(true)
  })

  it('shows single routes only inside their window, on their days', () => {
    const work = { ...weekdays, chipHours: { from: 6, to: 13 } }
    expect(routeInChip(work, at(12, 59))).toBe(true)
    expect(routeInChip(work, at(13))).toBe(false)
    expect(routeInChip(work, at(5, 59))).toBe(false)
    expect(routeInChip(work, new Date(2026, 10, 14, 8))).toBe(false) // sábado
    expect(routeInChip(work, at(8), 'off')).toBe(false)
    expect(routeInChip({}, at(8))).toBe(false) // sin franja: solo en Detalle
  })
})

describe('inDepartureWindow', () => {
  const shown = (now: Date, trip: { stops: TripStop[]; leadMin?: number } = { stops: SCHOOL_RUN }, legs = LEGS) =>
    inDepartureWindow(trip, planTrip(trip.stops, legs, now, true), now)

  it('shows the trip from an hour before the departure until the fixed time', () => {
    // sale 8:50 para estar 9:00 en el colegio
    expect(shown(at(7, 49))).toBe(false)
    expect(shown(at(7, 50))).toBe(true)
    expect(shown(at(8, 57))).toBe(true) // tarde pero todavía en casa
    expect(shown(at(9))).toBe(false)
  })

  it('takes a custom lead and follows the traffic', () => {
    expect(shown(at(8, 19), { stops: SCHOOL_RUN, leadMin: 30 })).toBe(false)
    expect(shown(at(8, 20), { stops: SCHOOL_RUN, leadMin: 30 })).toBe(true)
    // con 25 min hasta el colegio sale 8:35: la ventana abre 7:35
    expect(shown(at(7, 40), undefined, [{ mins: 25, km: 9 }, LEGS[1]])).toBe(true)
  })

  it('leaves it to chipHours without a fixed time or leg data', () => {
    expect(shown(at(23), { stops: FREE_RUN })).toBe(true)
    expect(shown(at(6), undefined, [{ mins: null, km: null }, LEGS[1]])).toBe(true)
  })
})

describe('planTrip', () => {
  it('plans backwards from the fixed stop and forwards through the dwell', () => {
    const plan = planTrip(SCHOOL_RUN, LEGS, at(8, 20), true)
    expect(plan.anchored).toBe(true)
    expect(plan.leaveIn).toBe(30)
    expect(formatClock(plan.depart!)).toBe('8:50')
    expect(plan.stops.map((s) => formatClock(s.arrive!))).toEqual(['9:00', '9:20'])
    expect(plan.stops.map((s) => s.late)).toEqual([0, 0])
    expect(plan.totalMins).toBe(30)
    expect(plan.totalKm).toBe(8)
  })

  it('replans from now and reports how late when the departure already passed', () => {
    const plan = planTrip(SCHOOL_RUN, LEGS, at(8, 54), true)
    expect(plan.leaveIn).toBe(-4)
    expect(formatClock(plan.depart!)).toBe('8:54')
    expect(plan.stops[0]).toEqual({ arrive: at(9, 4), late: 4 })
  })

  it('keeps the scheduled times when the trip is not live', () => {
    const plan = planTrip(SCHOOL_RUN, LEGS, at(15), false)
    expect(formatClock(plan.depart!)).toBe('8:50')
    expect(plan.stops[0].late).toBe(0)
  })

  it('leaves the earliest time that satisfies every fixed stop', () => {
    const stops: TripStop[] = [
      { ...SCHOOL_RUN[0] },
      { ...SCHOOL_RUN[1], arriveBy: '09:10' },
    ]
    const plan = planTrip(stops, LEGS, at(7), false)
    expect(formatClock(plan.depart!)).toBe('8:40')
    expect(plan.stops.map((s) => formatClock(s.arrive!))).toEqual(['8:50', '9:10'])
  })

  it('departs now when no stop has a fixed time', () => {
    const plan = planTrip(FREE_RUN, LEGS, at(12), true)
    expect(plan.anchored).toBe(false)
    expect(plan.leaveIn).toBeNull()
    expect(plan.stops.map((s) => formatClock(s.arrive!))).toEqual(['12:10', '12:30'])
  })

  it('rounds the departure down so fractional Waze minutes never make you late', () => {
    const plan = planTrip(SCHOOL_RUN, [{ mins: 9.6, km: 3.6 }, LEGS[1]], at(8), true)
    expect(formatClock(plan.depart!)).toBe('8:50')
    expect(formatClock(plan.stops[0].arrive!)).toBe('9:00')
    expect(plan.stops[0].late).toBe(0)
  })

  it('cannot schedule a departure while a leg to a fixed stop has no data', () => {
    const plan = planTrip(SCHOOL_RUN, [{ mins: null, km: null }, LEGS[1]], at(8), true)
    expect(plan.depart).toBeNull()
    expect(plan.leaveIn).toBeNull()
    expect(plan.totalMins).toBeNull()
    expect(plan.totalKm).toBeNull()
  })
})

describe('tripStatus', () => {
  const status = (now: Date, live = true, legs = LEGS) => tripStatus(planTrip(SCHOOL_RUN, legs, now, live), live)

  it('counts down to the departure inside the active window', () => {
    expect(status(at(7, 30))).toEqual({ text: 'Salir 8:50', tone: 'ok' })
    expect(status(at(8, 20))).toEqual({ text: 'Salir en 30 min', tone: 'ok' })
    expect(status(at(8, 45))).toEqual({ text: 'Salir en 5 min', tone: 'soon' })
    expect(status(at(8, 50))).toEqual({ text: 'Hora de salir', tone: 'soon' })
    expect(status(at(8, 57))).toEqual({ text: '7 min tarde', tone: 'late' })
  })

  it('only informs the departure time outside the window', () => {
    expect(status(at(15), false)).toEqual({ text: 'Salir 8:50', tone: 'none' })
  })

  it('shows the total for trips without a fixed time and a dash without data', () => {
    expect(tripStatus(planTrip(FREE_RUN, LEGS, at(12), true), true)).toEqual({ text: '30 min', tone: 'ok' })
    expect(status(at(8), true, [{ mins: null, km: null }, LEGS[1]])).toEqual({ text: '—', tone: 'none' })
  })
})

describe('tripBar', () => {
  const bar = (stops: TripStop[], legs: Leg[], now: Date) => tripBar(stops, legs, planTrip(stops, legs, now, true), now)
  const rounded = (b: ReturnType<typeof tripBar>) => b && {
    segments: b.segments.map((s) => `${s.kind}:${s.pct.toFixed(1)}`),
    marks:    b.marks.map((m) => m.toFixed(1)),
  }

  it('spans from now to the final arrival, waiting first', () => {
    // 8:20 → sale 8:50, llega 9:20: 30 espera + 10 + 5 parada + 15 sobre 60 min
    expect(rounded(bar(SCHOOL_RUN, LEGS, at(8, 20)))).toEqual({
      segments: ['wait:50.0', 'leg:16.7', 'dwell:8.3', 'leg:25.0'],
      marks:    ['66.7'],
    })
  })

  it('drops the wait once it is time to go and puts the deadline inside the first leg when late', () => {
    expect(rounded(bar(SCHOOL_RUN, LEGS, at(8, 54)))).toEqual({
      segments: ['leg:33.3', 'dwell:16.7', 'leg:50.0'],
      marks:    ['20.0'],
    })
  })

  it('has no wait or marks without fixed times', () => {
    expect(rounded(bar(FREE_RUN, LEGS, at(12)))).toEqual({
      segments: ['leg:33.3', 'dwell:16.7', 'leg:50.0'],
      marks:    [],
    })
  })

  it('returns null while a leg has no data', () => {
    expect(bar(SCHOOL_RUN, [LEGS[0], { mins: null, km: null }], at(8))).toBeNull()
  })
})

describe('formatDays', () => {
  it('collapses ranges and lists loose days', () => {
    expect(formatDays([0, 1, 2, 3, 4])).toBe('Lun–Vie')
    expect(formatDays([4, 0, 2])).toBe('Lun, Mié, Vie')
    expect(formatDays(undefined)).toBe('Todos los días')
  })
})
