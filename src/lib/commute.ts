// Lógica pura de viajes con paradas (casa → parada → … → destino).
// Cada tramo es un sensor Waze Travel Time; el plan se arma hacia atrás desde la
// primera parada con hora fija (`arriveBy`) y hacia adelante sumando tramos y esperas.

export interface TripStop {
  entityId:  string   // sensor Waze del tramo que llega a esta parada (desde la anterior)
  label:     string
  arriveBy?: string   // 'HH:MM' — hora a la que hay que estar en esta parada
  dwellMin?: number   // minutos detenido acá antes de seguir (dejar a alguien, estacionar…)
}

export interface TripSchedule {
  days?:            number[]                     // 0=Lun … 6=Dom; sin definir = todos
  chipHours?:       { from: number; to: number } // franja (24h) en que puede ocupar el chip del header
  workdayEntityId?: string                       // binary_sensor de la integración Workday: 'off' en feriados
  leadMin?:         number                       // con hora fija: el chip aparece estos minutos antes de la salida
}

export const DEFAULT_LEAD_MIN = 60

export interface Leg {
  mins: number | null
  km:   number | null
}

export interface StopEta {
  arrive: Date | null
  late:   number        // minutos tarde respecto de arriveBy (0 = a tiempo o sin hora fija)
}

export interface TripPlan {
  depart:     Date | null    // salida planificada (o "ahora" si ya se pasó la hora y el viaje está en curso)
  leaveIn:    number | null  // minutos hasta la salida planificada; negativo = ya debías salir
  stops:      StopEta[]
  totalMins:  number | null  // manejo + esperas
  totalKm:    number | null
  anchored:   boolean        // hay alguna parada con hora fija
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Estado del sensor Waze → minutos (null si no es un número). */
export function legFromState(state: string | undefined, distance: unknown): Leg {
  const mins = parseFloat(state ?? '')
  return {
    mins: Number.isFinite(mins) ? mins : null,
    km:   typeof distance === 'number' && Number.isFinite(distance) ? distance : null,
  }
}

/** Día de la semana con 0=Lun, igual que los horarios del robot. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function atTime(day: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const d = new Date(day)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

const addMin   = (d: Date, mins: number) => new Date(d.getTime() + mins * 60_000)
const floorMin = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000)

/**
 * Minutos desde la salida hasta llegar a cada parada (tramos + esperas previas).
 * Se corta en null a partir del primer tramo sin dato.
 */
export function arrivalOffsets(stops: TripStop[], legs: Leg[]): (number | null)[] {
  const out: (number | null)[] = []
  let acc: number | null = 0
  for (let i = 0; i < stops.length; i++) {
    const mins = legs[i]?.mins ?? null
    if (acc !== null && i > 0) acc += stops[i - 1].dwellMin ?? 0
    acc = acc === null || mins === null ? null : acc + mins
    out.push(acc)
  }
  return out
}

/**
 * ¿El viaje corre hoy? `workday` es el estado del binary_sensor de días laborables
 * (feriados): 'off' lo descarta; sin dato se usa solo `days`.
 */
export function runsToday(schedule: TripSchedule, now: Date, workday?: string): boolean {
  if (schedule.days && !schedule.days.includes(mondayIndex(now))) return false
  return workday !== 'off'
}

export function inChipWindow(schedule: TripSchedule, now: Date): boolean {
  const { chipHours } = schedule
  if (!chipHours) return true
  const h = now.getHours()
  return h >= chipHours.from && h < chipHours.to
}

/** Las rutas sueltas van al chip solo dentro de su franja; sin `chipHours` quedan solo en Detalle. */
export function routeInChip(route: TripSchedule, now: Date, workday?: string): boolean {
  return !!route.chipHours && runsToday(route, now, workday) && inChipWindow(route, now)
}

/**
 * Arma el plan del viaje con el tráfico actual.
 * - Con paradas de hora fija: sale a la hora más temprana que cumple todas.
 * - Sin hora fija: sale ahora.
 * - `live` (viaje en curso/franja activa): si la salida ya pasó, recalcula saliendo ahora
 *   y marca cuánto tarde se llega a cada parada con hora fija.
 */
export function planTrip(stops: TripStop[], legs: Leg[], now: Date, live: boolean): TripPlan {
  const offsets = arrivalOffsets(stops, legs)

  let scheduled: Date | null = null
  let anchored = false
  let missing = false
  for (let i = 0; i < stops.length; i++) {
    const target = stops[i].arriveBy ? atTime(now, stops[i].arriveBy!) : null
    if (!target) continue
    anchored = true
    const off = offsets[i]
    if (off === null) { missing = true; continue }
    // Redondeado hacia abajo: mejor salir unos segundos antes que llegar tarde
    const leave = floorMin(addMin(target, -off))
    if (!scheduled || leave < scheduled) scheduled = leave
  }
  // Sin el dato de un tramo que llega a una parada fija no se puede saber cuándo salir
  if (missing) scheduled = null

  const leaveIn = scheduled ? Math.round((scheduled.getTime() - now.getTime()) / 60_000) : null
  const depart  = !anchored ? now
    : scheduled && live && scheduled < now ? now
    : scheduled

  const etas: StopEta[] = stops.map((stop, i) => {
    const off = offsets[i]
    const arrive = depart && off !== null ? addMin(depart, off) : null
    const target = stop.arriveBy ? atTime(now, stop.arriveBy) : null
    const late = arrive && target ? Math.max(0, Math.round((arrive.getTime() - target.getTime()) / 60_000)) : 0
    return { arrive, late }
  })

  const lastOff = offsets[offsets.length - 1] ?? null
  const kms     = stops.map((_, i) => legs[i]?.km ?? null)
  const totalKm = kms.length && kms.every((k): k is number => k !== null)
    ? kms.reduce((a, k) => a + k, 0)
    : null

  return { depart, leaveIn, stops: etas, totalMins: lastOff, totalKm, anchored }
}

/**
 * Horario razonable de salida de un viaje con hora fija: desde `leadMin` antes de la
 * salida calculada (que se mueve con el tráfico) hasta la última `arriveBy`. Con la salida
 * ya pasada `depart` es ahora, así que sigue visible hasta esa hora.
 * Sin hora fija o sin el dato de algún tramo no hay ventana: manda solo `chipHours`.
 */
export function inDepartureWindow(
  trip: { stops: TripStop[]; leadMin?: number },
  plan: TripPlan,
  now: Date,
): boolean {
  const deadlines = trip.stops.flatMap((stop) => {
    const target = stop.arriveBy ? atTime(now, stop.arriveBy) : null
    return target ? [target.getTime()] : []
  })
  if (!plan.depart || !deadlines.length) return true
  const from = addMin(plan.depart, -(trip.leadMin ?? DEFAULT_LEAD_MIN))
  return now >= from && now.getTime() < Math.max(...deadlines)
}

export type TripTone = 'ok' | 'soon' | 'late' | 'none'

/**
 * Texto corto del viaje para el chip y la cabecera de la tarjeta.
 * Fuera de la franja activa (`live` = false) solo informa la hora de salida.
 */
export function tripStatus(plan: TripPlan, live: boolean): { text: string; tone: TripTone } {
  if (!plan.anchored) {
    return plan.totalMins === null
      ? { text: '—', tone: 'none' }
      : { text: `${Math.round(plan.totalMins)} min`, tone: 'ok' }
  }
  if (plan.leaveIn === null || !plan.depart) return { text: '—', tone: 'none' }
  if (!live) return { text: `Salir ${formatClock(plan.depart)}`, tone: 'none' }

  const late = Math.max(0, ...plan.stops.map((s) => s.late))
  if (late > 0)           return { text: `${late} min tarde`, tone: 'late' }
  if (plan.leaveIn <= 0)  return { text: 'Hora de salir', tone: 'soon' }
  if (plan.leaveIn <= 60) return { text: `Salir en ${plan.leaveIn} min`, tone: plan.leaveIn <= 10 ? 'soon' : 'ok' }
  return { text: `Salir ${formatClock(plan.depart)}`, tone: 'ok' }
}

export interface BarSegment {
  kind: 'wait' | 'leg' | 'dwell'
  pct:  number
}

export interface TripBar {
  segments: BarSegment[]   // suman 100
  marks:    number[]       // horas fijas (arriveBy) en % de la barra
}

/**
 * Barra del chip: va de ahora a la llegada final. 'wait' es lo que falta para salir
 * (se achica solo con el tiempo); 'leg' y 'dwell' son manejo y paradas.
 */
export function tripBar(stops: TripStop[], legs: Leg[], plan: TripPlan, now: Date): TripBar | null {
  const end = plan.stops[plan.stops.length - 1]?.arrive
  if (!plan.depart || !end) return null
  const span = end.getTime() - now.getTime()
  if (span <= 0) return null
  const pct = (ms: number) => (ms / span) * 100

  const segments: BarSegment[] = []
  const wait = plan.depart.getTime() - now.getTime()
  if (wait > 0) segments.push({ kind: 'wait', pct: pct(wait) })
  stops.forEach((stop, i) => {
    segments.push({ kind: 'leg', pct: pct((legs[i]?.mins ?? 0) * 60_000) })
    if (i < stops.length - 1 && stop.dwellMin) segments.push({ kind: 'dwell', pct: pct(stop.dwellMin * 60_000) })
  })

  const marks = stops.flatMap((stop) => {
    const target = stop.arriveBy ? atTime(now, stop.arriveBy) : null
    if (!target) return []
    const p = pct(target.getTime() - now.getTime())
    return p >= 0 && p <= 100 ? [p] : []
  })

  return { segments, marks }
}

/** Hora local H:MM, redondeada al minuto más cercano. */
export function formatClock(d: Date): string {
  const r = new Date(Math.round(d.getTime() / 60_000) * 60_000)
  return `${r.getHours()}:${String(r.getMinutes()).padStart(2, '0')}`
}

/** [0,1,2,3,4] → 'Lun–Vie'; días sueltos → 'Lun, Mié'. */
export function formatDays(days?: number[]): string {
  if (!days || days.length === 7) return 'Todos los días'
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const contiguous = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (contiguous) return `${DAY_LABELS[sorted[0]]}–${DAY_LABELS[sorted[sorted.length - 1]]}`
  return sorted.map((d) => DAY_LABELS[d]).join(', ')
}
