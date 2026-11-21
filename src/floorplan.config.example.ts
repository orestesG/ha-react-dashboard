// Copy this file to floorplan.config.ts and replace it with your own flat and entity IDs.
// floorplan.config.ts is gitignored — your measurements and IDs stay local.
//
// Everything is in metres. Axes: x across the flat, y along it.
// The pre-rendered images in components/widgets/floorplan/still/ belong to one specific flat:
// after changing the geometry, render them again (see CLAUDE.md, "Plano 3D").
import type { Cove, Device, Furniture, Room, VacuumTransform, Wall } from './lib/floorplan'

export const WALL_HEIGHT = 1.25      // walls are "cut" so the inside is visible
export const WALL_THICKNESS = 0.14
export const SILL_HEIGHT = 0.45      // height of the window sills

export const rooms: Room[] = [
  { id: 'living',  name: 'Living',  floor: 'wood', points: [[0, 0], [4, 0], [4, 5], [0, 5]] },
  { id: 'bedroom', name: 'Bedroom', floor: 'wood', points: [[4, 0], [7, 0], [7, 3], [4, 3]] },
  { id: 'kitchen', name: 'Kitchen', floor: 'tile', points: [[4, 3], [7, 3], [7, 5], [4, 5]] },
]

export const walls: Wall[] = [
  // Perimeter
  { from: [0, 0], to: [7, 0], openings: [
    { at: 1.0, width: 1.8, kind: 'window', cover: 'cover.living_blind', curtain: 'cover.living_curtain' },
    { at: 4.8, width: 1.4, kind: 'window', cover: 'cover.bedroom_blind' },
  ] },
  { from: [7, 0], to: [7, 5] },
  { from: [7, 5], to: [0, 5], openings: [{ at: 5.5, width: 0.9, kind: 'door' }] },   // entrance
  { from: [0, 5], to: [0, 0] },

  // Partitions
  { from: [4, 0], to: [4, 5], openings: [
    { at: 1.8, width: 0.8, kind: 'door' },    // living → bedroom
    { at: 3.6, width: 0.9, kind: 'door' },    // living → kitchen
  ] },
  { from: [4, 3], to: [7, 3] },
]

// ── Devices ───────────────────────────────────────────────────────────────────

export const devices: Device[] = [
  // Living
  { id: 'living-light',   entityId: 'light.living_room',   name: 'Main light', kind: 'light', room: 'living', pos: [2, 2.5], lightsRoom: true },
  { id: 'living-cove',    entityId: 'switch.living_cove',  name: 'Cove',       kind: 'strip', room: 'living', pos: [2, 1.2] },   // lit by its own bulbs (see `coves`)
  { id: 'living-blind',   entityId: 'cover.living_blind',  name: 'Blind',      kind: 'cover', room: 'living', pos: [1.9, 0] },
  { id: 'living-climate', entityId: 'climate.living_room', name: 'Air',        kind: 'climate', room: 'living', pos: [0.3, 2.5] },
  { id: 'living-temp',    entityId: 'sensor.living_room_temperature', secondaryEntityId: 'sensor.living_room_humidity', name: 'Temp / humidity', kind: 'sensor', room: 'living', pos: [3.6, 4.6] },
  { id: 'robot',          entityId: 'vacuum.robot',        name: 'Robot',      kind: 'vacuum', room: 'living', pos: [0.5, 4.5] },

  // Bedroom
  { id: 'bedroom-light', entityId: 'light.bedroom',       name: 'Bedroom light', kind: 'light', room: 'bedroom', pos: [5.5, 1.5], lightsRoom: true },
  { id: 'bedroom-blind', entityId: 'cover.bedroom_blind', name: 'Blind',         kind: 'cover', room: 'bedroom', pos: [5.5, 0] },

  // Kitchen
  { id: 'kitchen-light', entityId: 'switch.kitchen_light',       name: 'Kitchen light', kind: 'light', room: 'kitchen', pos: [5.5, 4], lightsRoom: true },
  { id: 'kitchen-leak',  entityId: 'binary_sensor.kitchen_leak', name: 'Leak sensor',   kind: 'leak',  room: 'kitchen', pos: [6.5, 3.6] },
]

// ── Furniture (decorative) ────────────────────────────────────────────────────

export const furniture: Furniture[] = [
  { kind: 'sofa',        pos: [2, 3.6], facing: 'y-' },
  { kind: 'rug',         pos: [2, 2.4], facing: 'y-', size: [2.2, 1.5] },
  { kind: 'coffeeTable', pos: [2, 2.4], facing: 'y-', size: [0.7, 0.7] },

  { kind: 'bed',        pos: [5.5, 1.9], facing: 'y-' },
  { kind: 'nightstand', pos: [4.45, 2.7], facing: 'y-' },

  { kind: 'counter', pos: [5.5, 3.35], facing: 'y+', size: [2.6, 0.6] },
]

// ── Coves ─────────────────────────────────────────────────────────────────────

export const coves: Cove[] = [
  { deviceId: 'living-cove', from: [0.1, 0.1], to: [3.9, 4.9], width: 0.45, bulbGap: 1.0 },
]

// ── Robot ─────────────────────────────────────────────────────────────────────

export const VACUUM_DEVICE_ID = 'robot'
export const VACUUM_MAP_CAMERA_ENTITY = 'camera.robot_map'

/** Robot map frame (mm) → plan. `originX`/`originY` are the robot coordinates of the plan's origin */
export const vacuumTransform: VacuumTransform = {
  originX: 0,
  originY: 0,
  scaleAlong: 1,
  scaleAcross: 1,
}
