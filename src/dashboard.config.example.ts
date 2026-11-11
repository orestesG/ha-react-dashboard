// Copy this file to dashboard.config.ts and replace with your entity IDs.
// dashboard.config.ts is gitignored — your values stay local.
import { Sunrise, Moon, Briefcase, ShoppingCart, School } from 'lucide-react'
import type { CommuteRoute, CommuteTrip } from './components/widgets/CommuteCard'

// ── Presence ──────────────────────────────────────────────────────────────────
// person entity used for commute chip visibility (hides when not_home)
export const PERSON_ENTITY = 'person.your_name'

// ── Vacuum ────────────────────────────────────────────────────────────────────
export const VACUUM_ENTITY = 'vacuum.your_robot_cleaner'

// ── Battery sensors ───────────────────────────────────────────────────────────
// Add one entry per battery-powered sensor you want to monitor
export const batterySensors = [
  { entityId: 'sensor.your_sensor_battery', name: 'Sensor Name', area: 'Room' },
]

// ── Scenes ────────────────────────────────────────────────────────────────────
export const scenes = [
  { entityId: 'scene.good_morning', label: 'Good morning', icon: Sunrise },
  { entityId: 'scene.sleep_mode',   label: 'Sleep mode',   icon: Moon    },
]

// ── Commute routes ────────────────────────────────────────────────────────────
// entityId: Waze Travel Time sensor
// chipHours: { from, to } — hour range (24h) when this route shows in the header chip;
//            without it the route only shows in the Detalle card
// days / workdayEntityId: optional, same as trips below (no "Work" chip on weekends or holidays)
export const commuteRoutes: CommuteRoute[] = [
  {
    entityId:        'sensor.waze_home_to_work',
    label:           'Work',
    icon:            Briefcase,
    chipHours:       { from: 6, to: 13 },
    days:            [0, 1, 2, 3, 4],
    workdayEntityId: 'binary_sensor.workday_sensor',
  },
  {
    entityId: 'sensor.waze_home_to_supermarket',
    label:    'Supermarket',
    icon:     ShoppingCart,
  },
]

// ── Commute trips (multi-stop) ────────────────────────────────────────────────
// Each stop's entityId is the Waze sensor for the leg that ARRIVES at it
// (home → stop 1, stop 1 → stop 2, …).
// arriveBy: 'HH:MM' — the departure is planned backwards from it with live traffic
// dwellMin: minutes stopped there before going on
// days: 0=Mon … 6=Sun · workdayEntityId: Workday integration sensor ('off' on holidays)
// chipHours: while active, the trip owns the header chip (routes don't show)
// leadMin: with a fixed time, the chip only appears from leadMin minutes (default 60) before
//          the computed departure until the arriveBy time
export const commuteTrips: CommuteTrip[] = [
  {
    id:              'school-work',
    label:           'School → Work',
    icon:            School,
    days:            [0, 1, 2, 3, 4],
    chipHours:       { from: 6, to: 10 },
    workdayEntityId: 'binary_sensor.workday_sensor',
    stops: [
      { entityId: 'sensor.waze_home_to_school', label: 'School', arriveBy: '09:00', dwellMin: 5 },
      { entityId: 'sensor.waze_school_to_work', label: 'Work' },
    ],
  },
]
