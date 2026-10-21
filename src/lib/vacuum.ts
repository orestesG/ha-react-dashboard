// Pure helpers for the Dreame vacuum (Tasshack dreame_vacuum integration).
// No React / store imports so everything here is unit-testable.
//
// Model: the robot runs with "customized cleaning" ON, which means every room keeps its
// own suction / mop humidity / mode / passes in `select.<slug>_room_<id>_<field>`. While
// that switch is on, the *global* selects are `unavailable`, so the dashboard never
// touches them — it edits the per-room selects and, for one-off overrides, calls
// `dreame_vacuum.vacuum_clean_segment` where an empty list means "use each room's config".

// ── Option catalogs (keys = HA select options, value = integration enum int) ─────

export interface VacuumOption<K extends string> {
  key:   K
  label: string
  value: number
}

export type SuctionKey  = 'quiet' | 'standard' | 'strong' | 'turbo'
export type HumidityKey = 'slightly_dry' | 'moist' | 'wet'
export type RoomModeKey = 'sweeping' | 'mopping' | 'sweeping_and_mopping'
export type Passes      = 1 | 2 | 3

export const SUCTION: VacuumOption<SuctionKey>[] = [
  { key: 'quiet',    label: 'Silencioso', value: 0 },
  { key: 'standard', label: 'Estándar',   value: 1 },
  { key: 'strong',   label: 'Fuerte',     value: 2 },
  { key: 'turbo',    label: 'Turbo',      value: 3 },
]

export const HUMIDITY: VacuumOption<HumidityKey>[] = [
  { key: 'slightly_dry', label: 'Poco húmeda', value: 1 },
  { key: 'moist',        label: 'Húmeda',      value: 2 },
  { key: 'wet',          label: 'Mojada',      value: 3 },
]

export const ROOM_MODE: VacuumOption<RoomModeKey>[] = [
  { key: 'sweeping',             label: 'Aspirar',        value: 0 },
  { key: 'mopping',              label: 'Fregar',         value: 1 },
  { key: 'sweeping_and_mopping', label: 'Aspirar + mopa', value: 2 },
]

export const PASSES: Passes[] = [1, 2, 3]

export function optionLabel<K extends string>(options: VacuumOption<K>[], key: string | undefined): string {
  return options.find((o) => o.key === key)?.label ?? key ?? '—'
}

export function suctionValue(key: SuctionKey): number {
  return SUCTION.find((o) => o.key === key)!.value
}

/** Accepts select keys, display names ("Turbo") and fan-speed names ("silent"). */
export function toSuctionKey(v: unknown): SuctionKey | undefined {
  if (typeof v !== 'string') return undefined
  const k = v.trim().toLowerCase()
  if (k === 'silent') return 'quiet'
  return SUCTION.find((o) => o.key === k)?.key
}

export function toPasses(v: unknown): Passes | undefined {
  const n = typeof v === 'string' ? parseTimes(v) : v
  return n === 1 || n === 2 || n === 3 ? n : undefined
}

// ── Entity ids ───────────────────────────────────────────────────────────────

export type RoomField = 'suction_level' | 'mop_pad_humidity' | 'cleaning_mode' | 'cleaning_times' | 'name'

/** `vacuum.xiaomi_robot_vacuum_x20` → `xiaomi_robot_vacuum_x20` (prefix of every device entity). */
export function deviceSlug(vacuumEntityId: string): string {
  return vacuumEntityId.split('.')[1] ?? vacuumEntityId
}

export function roomEntity(slug: string, roomId: number, field: RoomField): string {
  return `select.${slug}_room_${roomId}_${field}`
}

/** All `select.<slug>_room_<id>_cleaning_mode` ids present in HA, sorted by room id. */
export function findRoomModeEntities(slug: string, entityIds: Iterable<string>): string[] {
  const re = new RegExp(`^select\\.${slug}_room_(\\d+)_cleaning_mode$`)
  return [...entityIds]
    .map((id) => ({ id, m: re.exec(id) }))
    .filter((x): x is { id: string; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => x.id)
}

/** "2x" → 2 (format of the `room_<id>_cleaning_times` select). */
export function parseTimes(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

export function timesOption(n: Passes): string {
  return `${n}x`
}

// ── Rooms ────────────────────────────────────────────────────────────────────

export interface VacuumRoom {
  id:   number
  name: string
}

/** Rooms of the currently selected map, from the vacuum entity's `rooms` attribute. */
export function getRooms(attrs: Record<string, unknown> | undefined): VacuumRoom[] {
  const rooms = attrs?.rooms as Record<string, { id: number; name?: string }[]> | undefined
  const map   = attrs?.selected_map as string | undefined
  if (!rooms || !map || !Array.isArray(rooms[map])) return []
  return rooms[map].map((r) => ({ id: r.id, name: r.name || `Habitación ${r.id}` }))
}

/** Sort room ids following the robot's `cleaning_sequence`; unknown ids keep their order at the end. */
export function orderBySequence(ids: number[], sequence: number[] | undefined): number[] {
  if (!sequence?.length) return [...ids]
  const pos = (id: number) => {
    const i = sequence.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => pos(a.id) - pos(b.id) || a.i - b.i)
    .map((x) => x.id)
}

/** Every room of the current map, in cleaning order. */
export function allSegments(attrs: Record<string, unknown> | undefined): number[] {
  const seq = attrs?.cleaning_sequence as number[] | undefined
  const ids = getRooms(attrs).map((r) => r.id)
  return orderBySequence(ids.length ? ids : seq ?? [], seq)
}

// ── Run options (shared by manual runs and schedule slots) ───────────────────

export interface RunOptions {
  /** Temporarily switch every room to "sweeping" (restored when the robot docks). */
  sweepOnly: boolean
  /** undefined = each room's own suction */
  suction?: SuctionKey
  /** undefined = each room's own passes */
  passes?: Passes
}

export const DEFAULT_RUN_OPTIONS: RunOptions = { sweepOnly: false }

export function hasOverrides(o: RunOptions): boolean {
  return o.sweepOnly || o.suction !== undefined || o.passes !== undefined
}

/** Variables for `script.mi_dashboard_limpieza_robot` (-1 / 0 = per room). */
export interface ScriptVariables {
  segments:   number[]
  sweep_only: boolean
  suction:    number
  passes:     number
}

export function toScriptVariables(o: RunOptions, segments: number[] = []): ScriptVariables {
  return {
    segments,
    sweep_only: o.sweepOnly,
    suction:    o.suction ? suctionValue(o.suction) : -1,
    passes:     o.passes ?? 0,
  }
}

/** Data for `dreame_vacuum.vacuum_clean_segment`. Empty lists = use each room's customized settings. */
export function buildCleanSegmentData(segments: number[], o: Pick<RunOptions, 'suction' | 'passes'>) {
  return {
    segments,
    repeats:       o.passes ?? [],
    suction_level: o.suction ? suctionValue(o.suction) : [],
    water_volume:  [] as number[],
  }
}

// ── Schedule slots → HA schedule helper ──────────────────────────────────────

export interface ScheduleSlot extends RunOptions {
  id:      string
  days:    number[]   // 0=Mon … 6=Sun
  time:    string     // "HH:MM"
  enabled: boolean
}

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type DayKey = typeof DAY_KEYS[number]

export interface ScheduleBlockData {
  [key: string]: string | number | boolean
  slot_id:    string
  sweep_only: boolean
  suction:    number
  passes:     number
}

export interface ScheduleBlock {
  from: string
  to:   string
  data: ScheduleBlockData
}

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
}

/** "15:00" → "15:01:00"; "23:59" → "24:00:00" (HA accepts 24:00 as end of day). */
function oneMinuteAfter(time: string): string {
  const [hh, mm] = time.split(':').map(Number)
  const total = hh * 60 + mm + 1
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/**
 * Enabled slots → `schedule/update` day map. Each slot becomes a 1-minute block whose
 * `data` is exposed by HA as state attributes while the block is active, which is how
 * the automation learns the slot's overrides.
 */
export function slotsToScheduleDays(slots: ScheduleSlot[]): Record<DayKey, ScheduleBlock[]> {
  const out = Object.fromEntries(DAY_KEYS.map((d) => [d, [] as ScheduleBlock[]])) as Record<DayKey, ScheduleBlock[]>
  for (const slot of slots) {
    if (!slot.enabled || !isValidTime(slot.time)) continue
    const vars = toScriptVariables(slot)
    const block: ScheduleBlock = {
      from: `${slot.time}:00`,
      to:   oneMinuteAfter(slot.time),
      data: { slot_id: slot.id, sweep_only: vars.sweep_only, suction: vars.suction, passes: vars.passes },
    }
    for (const d of new Set(slot.days)) {
      if (DAY_KEYS[d]) out[DAY_KEYS[d]].push({ ...block, data: { ...block.data } })
    }
  }
  for (const d of DAY_KEYS) out[d].sort((a, b) => a.from.localeCompare(b.from))
  return out
}

/** Ids of enabled slots that share a day and time with another enabled slot (HA rejects overlaps). */
export function findSlotConflicts(slots: ScheduleSlot[]): string[] {
  const seen = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const s of slots) {
    if (!s.enabled) continue
    for (const d of s.days) {
      const k = `${d}@${s.time}`
      const other = seen.get(k)
      if (other && other !== s.id) { conflicts.add(other); conflicts.add(s.id) }
      else seen.set(k, s.id)
    }
  }
  return [...conflicts]
}

/**
 * Normalise a persisted slot from any version:
 * v3 `{ preset: 'full'|'sweep', suctionOverride, vacuumPasses, mopPasses }` → v4 RunOptions.
 * `mopPasses` is dropped (the robot has a single passes count per room).
 */
export function normalizeSlot(raw: unknown): ScheduleSlot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.time !== 'string' || !Array.isArray(r.days)) return null
  const days = r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
  const slot: ScheduleSlot = {
    id:        r.id,
    days:      days.length ? days : [0],
    time:      r.time,
    enabled:   r.enabled !== false,
    sweepOnly: typeof r.sweepOnly === 'boolean' ? r.sweepOnly : r.preset === 'sweep',
  }
  const suction = toSuctionKey(r.suction ?? r.suctionOverride)
  const passes  = toPasses(r.passes ?? r.vacuumPasses)
  if (suction) slot.suction = suction
  if (passes)  slot.passes  = passes
  return slot
}

// ── HA config generated by the dashboard ─────────────────────────────────────

export interface ScriptConfigParams {
  vacuumEntity:     string
  roomModeEntities: string[]
  backupSceneId:    string
}

/**
 * `script.mi_dashboard_limpieza_robot`: single place where a run (scheduled or manual
 * sweep-only) is executed, so mode restore happens in HA even if no dashboard is open.
 */
export function buildScriptConfig({ vacuumEntity: v, roomModeEntities, backupSceneId }: ScriptConfigParams) {
  const canSweepOnly = roomModeEntities.length > 0
  const sweepOnlyCond = [{ condition: 'template', value_template: '{{ v_sweep_only }}' }]
  return {
    alias:       'Mi Dashboard — Limpieza robot',
    description: 'Generado por Mi Dashboard (se sobrescribe al guardar horarios). Sin overrides lanza vacuum.start con la config por habitación; con overrides usa vacuum_clean_segment (listas vacías = config de cada habitación).',
    icon:        'mdi:robot-vacuum',
    mode:        'single',
    fields: {
      segments:   { description: 'IDs de habitación en orden; vacío = toda la casa', example: '[4, 2]', selector: { object: {} } },
      sweep_only: { description: 'Solo aspirar (pone las habitaciones en "sweeping" y las restaura al volver a la base)', selector: { boolean: {} } },
      suction:    { description: '0-3; -1 = según cada habitación', selector: { number: { min: -1, max: 3 } } },
      passes:     { description: '1-3; 0 = según cada habitación', selector: { number: { min: 0, max: 3 } } },
    },
    sequence: [
      {
        variables: {
          v_segments:   '{{ segments | default([], true) | list }}',
          v_sweep_only: `{{ ${canSweepOnly ? 'sweep_only | default(false) | bool' : 'false'} }}`,
          v_suction:    '{{ suction | default(-1) | int(-1) }}',
          v_passes:     '{{ passes | default(0) | int(0) }}',
          v_all_rooms:
            `{% set seq = state_attr('${v}', 'cleaning_sequence') or [] %}` +
            `{% if seq | count == 0 %}{% set seq = ((state_attr('${v}', 'rooms') or {}).get(state_attr('${v}', 'selected_map'), [])) | map(attribute='id') | list %}{% endif %}` +
            '{{ seq }}',
        },
      },
      ...(canSweepOnly ? [{
        if:   sweepOnlyCond,
        then: [
          { action: 'scene.create', data: { scene_id: backupSceneId, snapshot_entities: roomModeEntities } },
          { action: 'select.select_option', target: { entity_id: roomModeEntities }, data: { option: 'sweeping' } },
          { delay: '00:00:02' },
        ],
      }] : []),
      {
        choose: [{
          conditions: [{ condition: 'template', value_template: '{{ v_segments | count == 0 and v_suction < 0 and v_passes <= 0 }}' }],
          sequence:   [{ action: 'vacuum.start', target: { entity_id: v } }],
        }],
        default: [{
          action: 'dreame_vacuum.vacuum_clean_segment',
          target: { entity_id: v },
          data: {
            segments:      '{{ v_segments if v_segments | count > 0 else v_all_rooms }}',
            repeats:       '{{ v_passes if v_passes > 0 else [] }}',
            suction_level: '{{ v_suction if v_suction >= 0 else [] }}',
            water_volume:  [],
          },
        }],
      },
      ...(canSweepOnly ? [{
        if:   sweepOnlyCond,
        then: [
          {
            wait_for_trigger:    [{ trigger: 'state', entity_id: v, to: 'docked', for: { minutes: 1 } }],
            timeout:             '04:00:00',
            continue_on_timeout: true,
          },
          { action: 'scene.turn_on', target: { entity_id: `scene.${backupSceneId}` } },
        ],
      }] : []),
    ],
  }
}

export interface AutomationConfigParams {
  id:             string
  scheduleEntity: string
  vacuumEntity:   string
  scriptEntity:   string
}

/** Static automation: forwards the active schedule block's `data` to the script. */
export function buildAutomationConfig({ id, scheduleEntity, vacuumEntity, scriptEntity }: AutomationConfigParams) {
  const attr = (k: string, d: string) => `{{ trigger.to_state.attributes.${k} | default(${d}) }}`
  return {
    id,
    alias:       'Limpieza Robot — Schedule',
    description: 'Generada por Mi Dashboard (se sobrescribe al guardar horarios). Ejecuta el horario activo con sus overrides.',
    mode:        'single',
    triggers:    [{ trigger: 'state', entity_id: scheduleEntity, to: 'on' }],
    conditions:  [{ condition: 'not', conditions: [{ condition: 'state', entity_id: vacuumEntity, state: ['cleaning', 'returning'] }] }],
    actions: [{
      action: 'script.turn_on',
      target: { entity_id: scriptEntity },
      data:   { variables: { sweep_only: attr('sweep_only', 'false'), suction: attr('suction', '-1'), passes: attr('passes', '0') } },
    }],
  }
}

/** Deep equality that ignores object key order (HA re-orders keys when it stores configs). */
export function sameConfig(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameConfig(x, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => sameConfig((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

// ── Display ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  idle:               'Inactivo',
  standby:            'En espera',
  sleeping:           'En reposo',
  paused:             'En pausa',
  cleaning:           'Limpiando',
  segment_cleaning:   'Limpiando habitaciones',
  room_cleaning:      'Limpiando habitaciones',
  zone_cleaning:      'Limpiando zona',
  spot_cleaning:      'Limpieza puntual',
  returning:          'Volviendo a la base',
  returning_to_wash:  'Volviendo a lavar la mopa',
  docked:             'En base',
  charging:           'Cargando',
  charging_completed: 'Carga completa',
  washing:            'Lavando mopa',
  washing_paused:     'Lavado en pausa',
  drying:             'Secando mopa',
  fast_mapping:       'Mapeando',
  remote_control:     'Control remoto',
  self_repair:        'Autoreparación',
  error:              'Error',
}

export function statusLabel(status: string | undefined): string {
  if (!status) return '—'
  const key = status.trim().toLowerCase().replace(/\s+/g, '_')
  if (STATUS_LABELS[key]) return STATUS_LABELS[key]
  const text = status.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const CONSUMABLES = [
  { key: 'main_brush', label: 'Cepillo principal' },
  { key: 'side_brush', label: 'Cepillo lateral' },
  { key: 'filter',     label: 'Filtro' },
  { key: 'mop_pad',    label: 'Mopa' },
] as const

export type ConsumableKey = typeof CONSUMABLES[number]['key']
