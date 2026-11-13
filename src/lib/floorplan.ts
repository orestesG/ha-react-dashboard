// Pure floorplan helpers (no three.js, no React) — tested in floorplan.test.ts
import type { HassEntity } from 'home-assistant-js-websocket'

/** Plan coordinates in metres: [x across the flat, y along its long axis] */
export type Pt = [number, number]

export interface Opening {
  /** Distance from the wall's `from` end to where the opening starts (m) */
  at: number
  width: number
  kind: 'door' | 'window'
  /** Height of a window's sill (m); defaults to the plan's sill height */
  sill?: number
  /** Cover entity drawn as a blind in a window */
  cover?: string
  /** Cover entity drawn as a fabric curtain on the inside of a window */
  curtain?: string
}

export interface Wall {
  from: Pt
  to: Pt
  /** Thickness (m) */
  t?: number
  /** Height (m); defaults to the plan's wall height */
  h?: number
  openings?: Opening[]
}

export interface WallPiece {
  /** Distances along the wall from `from` (m) */
  start: number
  end: number
  kind: 'solid' | 'door' | 'window'
  sill?: number
  cover?: string
  curtain?: string
}

export function wallLength(wall: Wall): number {
  return Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])
}

/** Point at distance `d` from the wall's `from` end (may overshoot either end) */
export function pointAlong(wall: Wall, d: number): Pt {
  const len = wallLength(wall) || 1
  const k = d / len
  return [wall.from[0] + (wall.to[0] - wall.from[0]) * k, wall.from[1] + (wall.to[1] - wall.from[1]) * k]
}

/** Cuts a wall into solid stretches and its door/window openings, in order */
export function splitWall(wall: Wall): WallPiece[] {
  const len = wallLength(wall)
  const openings = [...(wall.openings ?? [])].sort((a, b) => a.at - b.at)
  const pieces: WallPiece[] = []
  let cursor = 0
  for (const o of openings) {
    const start = Math.max(cursor, Math.min(o.at, len))
    const end = Math.min(len, o.at + o.width)
    if (end <= start) continue
    if (start > cursor) pieces.push({ start: cursor, end: start, kind: 'solid' })
    pieces.push({ start, end, kind: o.kind, ...(o.sill !== undefined && { sill: o.sill }), ...(o.cover && { cover: o.cover }), ...(o.curtain && { curtain: o.curtain }) })
    cursor = end
  }
  if (cursor < len) pieces.push({ start: cursor, end: len, kind: 'solid' })
  return pieces
}

/** Where the segment p→q crosses a wall's centre line: distance along the wall from `from`, or null */
export function wallHit(wall: Wall, p: Pt, q: Pt): number | null {
  const rx = wall.to[0] - wall.from[0], ry = wall.to[1] - wall.from[1]
  const sx = q[0] - p[0], sy = q[1] - p[1]
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9) return null   // parallel
  const dx = p[0] - wall.from[0], dy = p[1] - wall.from[1]
  const t = (dx * sy - dy * sx) / den      // along the wall, 0..1
  const u = (dx * ry - dy * rx) / den      // along p→q, 0..1
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return t * Math.hypot(rx, ry)
}

export function centroid(points: Pt[]): Pt {
  const n = points.length || 1
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n]
}

// ── Shapes of floorplan.config.ts ─────────────────────────────────────────────

export interface Room {
  id: string
  name: string
  /** Floor texture: herringbone parquet, tile, dark tile or outdoor deck */
  floor: 'wood' | 'tile' | 'dark' | 'deck'
  points: Pt[]
}

/** Shape the device is drawn with in the scene */
export type DeviceKind =
  | 'light' | 'strip' | 'cover' | 'climate' | 'projector' | 'speaker'
  | 'heater' | 'washer' | 'plug' | 'sensor' | 'motion' | 'leak' | 'vacuum'

export interface Device {
  id: string
  entityId: string
  name: string
  kind: DeviceKind
  room: string
  pos: Pt
  /** Height of the object (m). Defaults by `kind` */
  h?: number
  /** Counts as the light of its room (lights the floor when on) */
  lightsRoom?: boolean
  /** Second entity to show (e.g. humidity next to the temperature) */
  secondaryEntityId?: string
  /** input_boolean of an air conditioner's console light (see ClimateCard) */
  consoleEntityId?: string
}

/** Where the front of a piece of furniture looks, in plan axes */
export type Facing = 'x+' | 'x-' | 'y+' | 'y-'

export interface Furniture {
  kind: 'bed' | 'nightstand' | 'table' | 'chair' | 'desk' | 'officeChair' | 'sofa' | 'counter' | 'worktop' | 'rug' | 'coffeeTable'
  /** Centre of the piece */
  pos: Pt
  /** Front: foot of the bed, user's side of the desk, seat of chairs and sofa, doors of the counter */
  facing: Facing
  /** [width, depth] when it is not the default size */
  size?: [number, number]
}

/** Lowered perimeter ceiling with recessed bulbs, drawn as a ring at the height where the walls are cut */
export interface Cove {
  /** Device (from `devices`) that turns its bulbs on; replaces the object of that device */
  deviceId: string
  /** Opposite corners of the outer rectangle */
  from: Pt
  to: Pt
  /** Width of the lowered ceiling */
  width: number
  /** Two bulbs per side, centred on the side and this far apart */
  bulbGap: number
}

/** Robot map frame (mm) → plan frame (m). The robot's x runs along the flat, its y across it. */
export interface VacuumTransform {
  /** Robot coordinates (mm) of the plan origin */
  originX: number
  originY: number
  /** Corrections of the robot's scale against the building plan */
  scaleAlong: number
  scaleAcross: number
}

export function vacuumToPlan(p: { x: number; y: number }, t: VacuumTransform): Pt {
  return [((p.y - t.originY) / 1000) * t.scaleAcross, ((p.x - t.originX) / 1000) * t.scaleAlong]
}

const OFF_STATES = new Set(['off', 'unavailable', 'unknown', 'idle', 'standby', 'closed', 'docked', 'stop', 'none', 'paused'])

export function isUnavailable(entity: HassEntity | undefined): boolean {
  return !entity || entity.state === 'unavailable' || entity.state === 'unknown'
}

/** Whether a device should be drawn as "doing something" (lit, running, detecting…) */
export function isActive(entity: HassEntity | undefined): boolean {
  if (!entity) return false
  // A cover being open is its resting state, not an activity
  if (entity.entity_id.startsWith('cover.')) return false
  return !OFF_STATES.has(entity.state)
}

/** 0 = closed, 1 = fully open; null when the cover is unknown */
export function coverOpenFraction(entity: HassEntity | undefined): number | null {
  if (isUnavailable(entity)) return null
  const pos = entity!.attributes.current_position as number | undefined
  if (typeof pos === 'number') return Math.max(0, Math.min(1, pos / 100))
  return entity!.state === 'closed' ? 0 : 1
}
