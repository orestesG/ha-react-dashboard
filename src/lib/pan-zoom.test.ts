import { describe, expect, it } from 'vitest'
import { IDENTITY, clampView, containRect, moveView } from './pan-zoom'

// A 1600×1000 image in a phone-shaped box: 320 wide, letterboxed top and bottom
const BOX = { w: 320, h: 600 }
const image = containRect(BOX.w, BOX.h, 1600, 1000)
const at = (x: number, y: number) => ({ x, y })

describe('containRect', () => {
  it('centres the image and letterboxes the short side', () => {
    expect(image).toEqual({ x: 0, y: 200, w: 320, h: 200 })
    expect(containRect(1000, 400, 1600, 1000)).toEqual({ x: 180, y: 0, w: 640, h: 400 })
  })
})

describe('moveView', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const v = moveView(IDENTITY, at(100, 300), at(100, 300), 2, 4)
    expect(v).toEqual({ s: 2, x: -100, y: -300 })
    // The content point that was at (100, 300) is still there
    expect(v.s * 100 + v.x).toBe(100)
    expect(v.s * 300 + v.y).toBe(300)
  })

  it('pans and zooms together (pinch whose fingers also move)', () => {
    const v = moveView({ s: 2, x: -100, y: -300 }, at(100, 300), at(150, 320), 1.5, 4)
    // Content under (100, 300) at the start was (100, 300) at zoom 1: now at (150, 320)
    expect(v.s).toBe(3)
    expect(v.s * 100 + v.x).toBeCloseTo(150)
    expect(v.s * 300 + v.y).toBeCloseTo(320)
  })

  it('limits the zoom to [1, maxZoom]', () => {
    expect(moveView(IDENTITY, at(0, 0), at(0, 0), 10, 4).s).toBe(4)
    expect(moveView({ s: 2, x: -50, y: -50 }, at(0, 0), at(0, 0), 0.1, 4)).toEqual({ s: 1, x: -25, y: -25 })
  })

  it('a drag at factor 1 only translates', () => {
    expect(moveView({ s: 2, x: -100, y: -300 }, at(10, 10), at(40, 0), 1, 4)).toEqual({ s: 2, x: -70, y: -310 })
  })
})

describe('clampView', () => {
  it('leaves zoom 1 as drawn', () => {
    expect(clampView({ s: 1, x: 30, y: -40 }, image, BOX.w, BOX.h)).toEqual(IDENTITY)
  })

  it('keeps the image covering the box on the axis where it overflows', () => {
    // At ×2 the image is 640 wide: x can go from -320 (right edge) to 0 (left edge)
    expect(clampView({ s: 2, x: 50, y: -300 }, image, BOX.w, BOX.h).x).toBeCloseTo(0)
    expect(clampView({ s: 2, x: -999, y: -300 }, image, BOX.w, BOX.h).x).toBe(-320)
    expect(clampView({ s: 2, x: -150, y: -300 }, image, BOX.w, BOX.h).x).toBe(-150)
  })

  it('centres the image on the axis where it still fits', () => {
    // At ×2 the image is 400 tall in a 600 box: 100 above and below, wherever the pinch was
    const v = clampView({ s: 2, x: -100, y: -50 }, image, BOX.w, BOX.h)
    expect(v.s * image.y + v.y).toBe(100)
  })

  it('once taller than the box, the image covers it top to bottom', () => {
    // ×4: 800 tall; its top (4·200 + y) must stay ≤ 0 and its bottom ≥ 600
    const top = clampView({ s: 4, x: -600, y: 0 }, image, BOX.w, BOX.h)
    expect(4 * image.y + top.y).toBe(0)
    const bottom = clampView({ s: 4, x: -600, y: -5000 }, image, BOX.w, BOX.h)
    expect(4 * (image.y + image.h) + bottom.y).toBe(600)
  })
})
