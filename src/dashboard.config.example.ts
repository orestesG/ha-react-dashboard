// Copy this file to dashboard.config.ts and replace with your entity IDs.
// dashboard.config.ts is gitignored — your values stay local.
import { Sunrise, Moon, Briefcase, ShoppingCart } from 'lucide-react'
import type { CommuteRoute } from './components/widgets/CommuteCard'

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
// chipHours: { from, to } — hour range (24h) when this route shows in the header chip
export const commuteRoutes: CommuteRoute[] = [
  {
    entityId:  'sensor.waze_home_to_work',
    label:     'Work',
    icon:      Briefcase,
    chipHours: { from: 6, to: 13 },
  },
  {
    entityId: 'sensor.waze_home_to_supermarket',
    label:    'Supermarket',
    icon:     ShoppingCart,
  },
]
