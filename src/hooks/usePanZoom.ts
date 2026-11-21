// Pinch, drag, wheel and double-tap zoom over an image drawn "contain" inside an element (the still view of
// the floor plan). The view lives in a ref and goes out through `onChange`, without React state per frame;
// the only state is whether it is zoomed, for a reset button.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { IDENTITY, clampView, containRect, moveView, type View } from '../lib/pan-zoom'

interface Options {
  enabled: boolean
  /** Intrinsic size of the image */
  width: number
  height: number
  maxZoom: number
  /** Apply the view (it's also called after every resize) */
  onChange: (view: View) => void
}

type Point = { x: number; y: number }

/** How far a finger can move and still be a tap (px) */
const TAP_SLOP = 6
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_ZOOM = 2.5
const ANIMATION_MS = 200

export function usePanZoom(ref: RefObject<HTMLElement | null>, viewRef: RefObject<View>, { enabled, width, height, maxZoom, onChange }: Options) {
  const [zoomed, setZoomed] = useState(false)
  const onChangeRef = useRef(onChange)
  const animateRef = useRef<(to: View) => void>(() => {})
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    viewRef.current = IDENTITY
    let frame = 0

    const clamp = (v: View) => clampView(v, containRect(el.clientWidth, el.clientHeight, width, height), el.clientWidth, el.clientHeight)
    const apply = (v: View) => {
      viewRef.current = clamp(v)
      setZoomed(viewRef.current.s > 1.01)
      onChangeRef.current(viewRef.current)
    }
    const animate = (to: View) => {
      cancelAnimationFrame(frame)
      const from = viewRef.current, target = clamp(to), t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ANIMATION_MS), e = 1 - (1 - k) ** 3
        apply({ s: from.s + (target.s - from.s) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e })
        if (k < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }
    animateRef.current = animate

    const local = (e: { clientX: number; clientY: number }): Point => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    // Fingers (or the mouse) on the element. Each time one lands or lifts the gesture restarts from the
    // current view, so adding or removing a finger never makes the plan jump.
    const pointers = new Map<number, Point>()
    let gesture: { view: View; from: Point; spread: number } | null = null
    let dragging = false
    let downAt: Point = { x: 0, y: 0 }
    let lastTap: (Point & { t: number }) | null = null

    const centre = (): Point => {
      const ps = [...pointers.values()]
      return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length }
    }
    const spread = () => {
      const [a, b] = pointers.values()
      return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    const restart = () => { gesture = pointers.size ? { view: viewRef.current, from: centre(), spread: spread() } : null }
    // From here on it's a pan or a pinch: the pointers stay ours outside the element, and the marker the
    // gesture started on gets no click
    const startDrag = () => {
      dragging = true
      for (const id of pointers.keys()) {
        try { el.setPointerCapture(id) } catch { /* the pointer is already gone */ }
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      cancelAnimationFrame(frame)
      pointers.set(e.pointerId, local(e))
      if (pointers.size === 1) { dragging = false; downAt = local(e) } else startDrag()
      restart()
    }
    const onMove = (e: PointerEvent) => {
      if (!gesture || !pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (!dragging) {
        if (Math.hypot(p.x - downAt.x, p.y - downAt.y) < TAP_SLOP) return
        startDrag()
      }
      apply(moveView(gesture.view, gesture.from, centre(), gesture.spread ? spread() / gesture.spread : 1, maxZoom))
    }
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      // Double tap on the plan (not on a marker): zoom in there, or back out if already zoomed
      if (e.type === 'pointerup' && !pointers.size && !dragging && !(e.target as Element).closest('button')) {
        const p = local(e), now = performance.now()
        if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
          lastTap = null
          animate(viewRef.current.s > 1.01 ? IDENTITY : moveView(viewRef.current, p, p, DOUBLE_TAP_ZOOM, maxZoom))
        } else {
          lastTap = { ...p, t: now }
        }
      }
      restart()
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cancelAnimationFrame(frame)
      const p = local(e)
      // Pixels from a mouse wheel (~100 a notch), small ones with ctrl from a trackpad pinch, lines in Firefox
      const speed = e.deltaMode === 1 ? 0.06 : e.ctrlKey ? 0.01 : 0.002
      apply(moveView(viewRef.current, p, p, Math.exp(-e.deltaY * speed), maxZoom))
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    // Also the first placement: it fires as soon as the element is observed
    const ro = new ResizeObserver(() => apply(viewRef.current))
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      animateRef.current = () => {}
      setZoomed(false)
    }
  }, [ref, viewRef, enabled, width, height, maxZoom])

  const reset = useCallback(() => animateRef.current(IDENTITY), [])
  return { zoomed, reset }
}
