// Pure pan/zoom math for an image drawn "object-contain" inside a box — tested in pan-zoom.test.ts

/** A point on screen = s · (point at zoom 1) + (x, y) */
export interface View { s: number; x: number; y: number }

export interface Rect { x: number; y: number; w: number; h: number }

export const IDENTITY: View = { s: 1, x: 0, y: 0 }

/** Where an image of `iw`×`ih` lands when drawn "contain" (centred, letterboxed) in a `bw`×`bh` box */
export function containRect(bw: number, bh: number, iw: number, ih: number): Rect {
  const k = Math.min(bw / iw, bh / ih)
  return { x: (bw - iw * k) / 2, y: (bh - ih * k) / 2, w: iw * k, h: ih * k }
}

/**
 * The view after a gesture that started at `from` (screen) with view `start`: the content point that was
 * under `from` ends up under `to`, scaled by `factor` (zoom limited to [1, maxZoom]).
 * Wheel: from = to = cursor. Pinch: from/to = midpoint of the fingers. Drag: factor 1.
 */
export function moveView(start: View, from: { x: number; y: number }, to: { x: number; y: number }, factor: number, maxZoom: number): View {
  const s = Math.min(maxZoom, Math.max(1, start.s * factor))
  const r = s / start.s
  return { s, x: to.x - (from.x - start.x) * r, y: to.y - (from.y - start.y) * r }
}

/**
 * Keeps the image filling the box on each axis where it's bigger than the box, and centred where it isn't,
 * so panning never shows more empty space than the zoom-1 letterbox. `image` is its rect at zoom 1.
 */
export function clampView(v: View, image: Rect, bw: number, bh: number): View {
  const axis = (t: number, start: number, len: number, box: number) =>
    v.s * len <= box
      ? (box - v.s * len) / 2 - v.s * start
      : Math.min(-v.s * start, Math.max(box - v.s * (start + len), t))
  return { s: v.s, x: axis(v.x, image.x, image.w, bw), y: axis(v.y, image.y, image.h, bh) }
}
