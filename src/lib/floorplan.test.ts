import { describe, expect, it } from 'vitest'
import type { HassEntity } from 'home-assistant-js-websocket'
import { centroid, coverOpenFraction, isActive, pointAlong, splitWall, vacuumToPlan, wallHit, type Wall } from './floorplan'
import { coves, devices, furniture, rooms, walls } from '../floorplan.config'

const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes }) as unknown as HassEntity

describe('splitWall', () => {
  const wall: Wall = { from: [0, 0], to: [4, 0] }

  it('returns one solid piece when there are no openings', () => {
    expect(splitWall(wall)).toEqual([{ start: 0, end: 4, kind: 'solid' }])
  })

  it('cuts openings out in order and keeps the cover', () => {
    const pieces = splitWall({
      ...wall,
      openings: [
        { at: 3, width: 0.5, kind: 'door' },
        { at: 1, width: 1, kind: 'window', cover: 'cover.x' },
      ],
    })
    expect(pieces).toEqual([
      { start: 0, end: 1, kind: 'solid' },
      { start: 1, end: 2, kind: 'window', cover: 'cover.x' },
      { start: 2, end: 3, kind: 'solid' },
      { start: 3, end: 3.5, kind: 'door' },
      { start: 3.5, end: 4, kind: 'solid' },
    ])
  })

  it('clamps an opening that runs past the end of the wall', () => {
    expect(splitWall({ ...wall, openings: [{ at: 3.5, width: 2, kind: 'door' }] })).toEqual([
      { start: 0, end: 3.5, kind: 'solid' },
      { start: 3.5, end: 4, kind: 'door' },
    ])
  })
})

describe('geometry', () => {
  it('pointAlong walks the wall', () => {
    expect(pointAlong({ from: [0, 0], to: [0, 2] }, 0.5)).toEqual([0, 0.5])
  })

  it('wallHit finds where a segment crosses a wall', () => {
    const wall: Wall = { from: [0, 0], to: [4, 0] }
    expect(wallHit(wall, [1.5, -1], [1.5, 1])).toBeCloseTo(1.5)
    expect(wallHit(wall, [1.5, 0.2], [1.5, 1])).toBeNull()    // stops short of the wall
    expect(wallHit(wall, [5, -1], [5, 1])).toBeNull()          // past the wall's end
    expect(wallHit(wall, [0, 1], [4, 1])).toBeNull()           // parallel
  })

  it('centroid averages the corners', () => {
    expect(centroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([1, 1])
  })
})

describe('vacuumToPlan', () => {
  it('swaps the axes, moves the origin and applies each scale', () => {
    // The robot's x runs along the flat (plan y), its y across it (plan x)
    const t = { originX: -1000, originY: -500, scaleAlong: 0.5, scaleAcross: 2 }
    expect(vacuumToPlan({ x: -1000, y: -500 }, t)).toEqual([0, 0])
    expect(vacuumToPlan({ x: 1000, y: 500 }, t)).toEqual([2, 1])
  })
})

describe('entity state', () => {
  it('isActive', () => {
    expect(isActive(entity('switch.a', 'on'))).toBe(true)
    expect(isActive(entity('switch.a', 'off'))).toBe(false)
    expect(isActive(entity('climate.a', 'cool'))).toBe(true)
    expect(isActive(entity('cover.a', 'open'))).toBe(false)
    expect(isActive(entity('vacuum.a', 'docked'))).toBe(false)
    expect(isActive(entity('vacuum.a', 'cleaning'))).toBe(true)
    expect(isActive(undefined)).toBe(false)
  })

  it('coverOpenFraction', () => {
    expect(coverOpenFraction(entity('cover.a', 'open', { current_position: 45 }))).toBe(0.45)
    expect(coverOpenFraction(entity('cover.a', 'closed'))).toBe(0)
    expect(coverOpenFraction(entity('cover.a', 'open'))).toBe(1)
    expect(coverOpenFraction(entity('cover.a', 'unavailable'))).toBeNull()
  })
})

describe('floorplan config', () => {
  it('places every device in a known room with a unique id', () => {
    const roomIds = new Set(rooms.map((r) => r.id))
    expect(devices.every((d) => roomIds.has(d.room))).toBe(true)
    expect(new Set(devices.map((d) => d.id)).size).toBe(devices.length)
  })

  it('puts every piece of furniture inside a room', () => {
    const inRoom = ([x, y]: [number, number]) => rooms.some((r) => {
      const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1])
      return x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys)
    })
    expect(furniture.filter((f) => !inRoom(f.pos))).toEqual([])
  })

  it('keeps every cove inside the room of its device', () => {
    for (const c of coves) {
      const room = rooms.find((r) => r.id === devices.find((d) => d.id === c.deviceId)?.room)
      expect(room).toBeDefined()
      const xs = room!.points.map((p) => p[0]), ys = room!.points.map((p) => p[1])
      for (const [x, y] of [c.from, c.to]) {
        expect(x).toBeGreaterThanOrEqual(Math.min(...xs))
        expect(x).toBeLessThanOrEqual(Math.max(...xs))
        expect(y).toBeGreaterThanOrEqual(Math.min(...ys))
        expect(y).toBeLessThanOrEqual(Math.max(...ys))
      }
      // Room for the two bulbs of each side
      expect(c.bulbGap).toBeLessThan(Math.min(Math.abs(c.to[0] - c.from[0]), Math.abs(c.to[1] - c.from[1])) - 2 * c.width)
    }
  })

  it('keeps openings inside their wall', () => {
    for (const w of walls) {
      const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1])
      for (const o of w.openings ?? []) expect(o.at + o.width).toBeLessThanOrEqual(len)
    }
  })
})
