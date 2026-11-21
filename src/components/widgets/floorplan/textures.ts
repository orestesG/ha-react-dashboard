// Procedural textures drawn on a canvas — no image assets, so the panel stays a single JS file.
import * as THREE from 'three'
// Baked PBR maps (scripts/gen_textures.py). Vite inlines them, so the panel stays a single main.js.
import woodColor from './tex/floor-wood-color.jpg'
import woodNormal from './tex/floor-wood-normal.jpg'
import woodRough from './tex/floor-wood-rough.jpg'
import tileColor from './tex/floor-tile-color.jpg'
import tileNormal from './tex/floor-tile-normal.jpg'
import tileRough from './tex/floor-tile-rough.jpg'
import darkColor from './tex/floor-dark-color.jpg'
import darkNormal from './tex/floor-dark-normal.jpg'
import darkRough from './tex/floor-dark-rough.jpg'
import deckColor from './tex/floor-deck-color.jpg'
import deckNormal from './tex/floor-deck-normal.jpg'
import deckRough from './tex/floor-deck-rough.jpg'
import fabricColor from './tex/surf-fabric-color.jpg'
import fabricNormal from './tex/surf-fabric-normal.jpg'
import plasterColor from './tex/surf-plaster-color.jpg'
import plasterNormal from './tex/surf-plaster-normal.jpg'
import stoneColor from './tex/surf-stone-color.jpg'
import stoneNormal from './tex/surf-stone-normal.jpg'
import woodGrainColor from './tex/surf-wood-color.jpg'
import woodGrainNormal from './tex/surf-wood-normal.jpg'

export type FloorKind = 'wood' | 'tile' | 'dark' | 'deck'
/** Detail textures: near-white, so they modulate the material colour instead of replacing it */
export type SurfaceKind = 'fabric' | 'wood' | 'plaster' | 'stone'

/** Deterministic PRNG so surfaces look the same on every load */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIZE = 512

/** Per-pixel brightness jitter over whatever is drawn: breaks up flat fills */
function addNoise(ctx: CanvasRenderingContext2D, size: number, rand: () => number, amount: number) {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

/** One plank with soft grain along its long side and a faint joint around it */
function drawPlank(ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, w: number, h: number) {
  const l = 41 + rand() * 7            // lightness varies a little per plank
  const hue = 23 + rand() * 5, sat = 38 + rand() * 8
  const along = w >= h
  const len = along ? w : h, across = along ? h : w
  // Slight shading across the plank instead of a flat fill
  const grad = along ? ctx.createLinearGradient(x, y, x, y + h) : ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${l + 2}%)`)
  grad.addColorStop(1, `hsl(${hue}, ${sat}%, ${l - 2}%)`)
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)
  ctx.lineWidth = 1
  for (let g = 0; g < 7; g++) {
    ctx.strokeStyle = `hsla(22, 40%, ${l - 6 - rand() * 8}%, ${0.1 + rand() * 0.15})`
    const o = 2 + rand() * (across - 4)
    const b1 = o + rand() * 4 - 2, b2 = o + rand() * 4 - 2
    ctx.beginPath()
    if (along) { ctx.moveTo(x, y + o); ctx.bezierCurveTo(x + len * 0.3, y + b1, x + len * 0.6, y + b2, x + len, y + o) }
    else { ctx.moveTo(x + o, y); ctx.bezierCurveTo(x + b1, y + len * 0.3, x + b2, y + len * 0.6, x + o, y + len) }
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(40, 22, 10, 0.28)'
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
}

/** Each plank is 1 × HERRINGBONE_RATIO cells and the pattern repeats every 2 × ratio cells */
const HERRINGBONE_RATIO = 4

/**
 * Herringbone (espiga) parquet, drawn axis-aligned so it tiles seamlessly; the texture is rotated 45° afterwards.
 * Cell (i, j) belongs to a horizontal plank when (i - j) mod 2n < n, otherwise to a vertical one.
 */
function drawWood(ctx: CanvasRenderingContext2D) {
  const n = HERRINGBONE_RATIO, cells = 2 * n
  const c = SIZE / cells
  for (let k = 0; k < cells; k++) {
    // Row k: the horizontal plank starts at column k. Column k: the vertical plank starts at row k + 1.
    const hx = k * c, vy = ((k + 1) % cells) * c
    // A plank that crosses the edge is drawn again on the opposite side, with the same seed, so the texture wraps
    for (const wrap of [0, -SIZE]) {
      if (wrap === 0 || hx + n * c > SIZE) drawPlank(ctx, mulberry32(k * 131 + 7), hx + wrap, k * c, n * c, c)
      if (wrap === 0 || vy + n * c > SIZE) drawPlank(ctx, mulberry32(k * 977 + 3), k * c, vy + wrap, c, n * c)
    }
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, rand: () => number, perSide: number, hue: number, sat: number, light: number, grout: string) {
  const s = SIZE / perSide
  ctx.fillStyle = grout
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < perSide; i++) {
    for (let j = 0; j < perSide; j++) {
      const l = light + rand() * 3
      // Lighter towards the middle of each tile, like a slightly cushioned edge
      const g = ctx.createRadialGradient(i * s + s / 2, j * s + s / 2, s * 0.1, i * s + s / 2, j * s + s / 2, s * 0.75)
      g.addColorStop(0, `hsl(${hue}, ${sat}%, ${l + 2}%)`)
      g.addColorStop(1, `hsl(${hue}, ${sat}%, ${l - 3}%)`)
      ctx.fillStyle = g
      ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3)
    }
  }
}

/** Metres covered by one repeat of each floor texture (wood: 8 cells of 10 cm → planks of 10 × 40 cm) */
const FLOOR_SPAN: Record<FloorKind, number> = { wood: 0.8, tile: 1.2, dark: 1.2, deck: 0.9 }

export function createFloorTexture(kind: FloorKind, anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const rand = mulberry32(kind.length * 7919)
  if (kind === 'wood') drawWood(ctx)
  else if (kind === 'tile') drawTiles(ctx, rand, 2, 40, 7, 76, '#b5b0a8')
  else if (kind === 'dark') drawTiles(ctx, rand, 2, 220, 5, 14, '#0b0b0d')
  else drawTiles(ctx, rand, 3, 18, 34, 48, '#6b5a50')
  addNoise(ctx, SIZE, rand, 10)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  // Floor UVs are in metres (ShapeGeometry uses the shape coordinates)
  texture.repeat.set(1 / FLOOR_SPAN[kind], 1 / FLOOR_SPAN[kind])
  // Herringbone zigzags run along the walls
  if (kind === 'wood') texture.rotation = Math.PI / 4
  texture.anisotropy = anisotropy
  return texture
}

export interface FloorMaps { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

const FLOOR_PBR: Record<FloorKind, [string, string, string]> = {
  wood: [woodColor, woodNormal, woodRough],
  tile: [tileColor, tileNormal, tileRough],
  dark: [darkColor, darkNormal, darkRough],
  deck: [deckColor, deckNormal, deckRough],
}

/** Metres covered by one repeat of each photo-scanned floor (the real size of the scan) */
const PBR_SPAN: Record<FloorKind, number> = { wood: 3.4, tile: 1.5, dark: 2.3, deck: 1.8 }

/** Photo-scanned colour / normal / roughness maps of a floor, loaded asynchronously (the herringbone already zigzags along the axes) */
export function loadFloorMaps(kind: FloorKind, anisotropy: number): Promise<FloorMaps> {
  const loader = new THREE.TextureLoader()
  const load = (url: string, srgb: boolean) => loader.loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / PBR_SPAN[kind], 1 / PBR_SPAN[kind])
    t.anisotropy = anisotropy
    return t
  })
  const [c, n, r] = FLOOR_PBR[kind]
  return Promise.all([load(c, true), load(n, false), load(r, false)])
    .then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }))
}

const DETAIL = 256

function drawFabric(ctx: CanvasRenderingContext2D, rand: () => number) {
  ctx.fillStyle = '#e4e4e4'
  ctx.fillRect(0, 0, DETAIL, DETAIL)
  // Weave: alternating darker/lighter threads in both directions
  for (let i = 0; i < DETAIL; i += 2) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + rand() * 0.1})`
    ctx.fillRect(i, 0, 1, DETAIL)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + rand() * 0.12})`
    ctx.fillRect(0, i, DETAIL, 1)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + rand() * 0.08})`
    ctx.fillRect(0, i + 1, DETAIL, 1)
  }
  addNoise(ctx, DETAIL, rand, 26)
}

function drawGrain(ctx: CanvasRenderingContext2D, rand: () => number) {
  ctx.fillStyle = '#e8e8e8'
  ctx.fillRect(0, 0, DETAIL, DETAIL)
  // Long wavy fibres along x; each starts and ends at the same height so the texture tiles
  for (let g = 0; g < 70; g++) {
    const y = rand() * DETAIL
    ctx.strokeStyle = `rgba(${rand() > 0.3 ? '60, 35, 15' : '255, 255, 255'}, ${0.05 + rand() * 0.16})`
    ctx.lineWidth = 0.6 + rand() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(DETAIL * 0.33, y + rand() * 10 - 5, DETAIL * 0.66, y + rand() * 10 - 5, DETAIL, y)
    ctx.stroke()
  }
  addNoise(ctx, DETAIL, rand, 10)
}

function drawPlaster(ctx: CanvasRenderingContext2D, rand: () => number) {
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, DETAIL, DETAIL)
  // Soft blotches of the trowel (wrapped around the edges) plus a fine grain
  for (let n = 0; n < 60; n++) {
    const x = rand() * DETAIL, y = rand() * DETAIL, r = 12 + rand() * 30
    const tone = rand() > 0.5 ? '255, 255, 255' : '0, 0, 0'
    for (const dx of [-DETAIL, 0, DETAIL]) for (const dy of [-DETAIL, 0, DETAIL]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
      g.addColorStop(0, `rgba(${tone}, 0.03)`)
      g.addColorStop(1, `rgba(${tone}, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
    }
  }
  addNoise(ctx, DETAIL, rand, 12)
}

function drawStone(ctx: CanvasRenderingContext2D, rand: () => number) {
  ctx.fillStyle = '#dcdcdc'
  ctx.fillRect(0, 0, DETAIL, DETAIL)
  for (let n = 0; n < 900; n++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '255, 255, 255' : '0, 0, 0'}, ${0.08 + rand() * 0.25})`
    ctx.beginPath()
    ctx.arc(rand() * DETAIL, rand() * DETAIL, 0.5 + rand() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  addNoise(ctx, DETAIL, rand, 14)
}

const SURFACE_DRAW: Record<SurfaceKind, (ctx: CanvasRenderingContext2D, rand: () => number) => void> = {
  fabric: drawFabric, wood: drawGrain, plaster: drawPlaster, stone: drawStone,
}

const SURFACE_PBR: Record<SurfaceKind, [string, string]> = {
  fabric: [fabricColor, fabricNormal],
  wood: [woodGrainColor, woodGrainNormal],
  plaster: [plasterColor, plasterNormal],
  stone: [stoneColor, stoneNormal],
}
/** Size of the baked detail maps (scripts/bake_textures.py) */
const BAKED = 512

const imageCache = new Map<string, Promise<HTMLImageElement>>()
const pendingSurfaces: Promise<unknown>[] = []

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
    imageCache.set(url, p)
  }
  return p
}

/** Resolves once every baked detail map requested so far has replaced its placeholder (the scene should then redraw) */
export function surfacesLoaded(): Promise<void> {
  return Promise.all(pendingSurfaces).then(() => undefined, () => undefined)
}

/**
 * Detail texture for furniture and walls; `perMetre` repeats per metre of surface (UVs must be in metres).
 * It starts as the drawn version and the baked map is painted over the same canvas as soon as it loads,
 * so materials never need to know about the swap.
 */
export function createSurfaceTexture(kind: SurfaceKind, perMetre: number, anisotropy = 1): THREE.CanvasTexture {
  const small = document.createElement('canvas')
  small.width = small.height = DETAIL
  const sctx = small.getContext('2d', { willReadFrequently: true })!
  SURFACE_DRAW[kind](sctx, mulberry32(kind.length * 104729 + kind.charCodeAt(0)))
  // Same size as the baked map: a texture cannot change size once it is on the GPU
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = BAKED
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(small, 0, 0, BAKED, BAKED)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(perMetre, perMetre)
  texture.anisotropy = anisotropy
  pendingSurfaces.push(loadImage(SURFACE_PBR[kind][0]).then((img) => {
    ctx.drawImage(img, 0, 0, BAKED, BAKED)
    texture.needsUpdate = true
  }).catch(() => { /* keep the drawn version */ }))
  return texture
}

/** Normal map matching createSurfaceTexture: flat until the baked map loads */
export function createSurfaceNormal(kind: SurfaceKind, perMetre: number, anisotropy = 1): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = BAKED
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(128, 128, 255)'
  ctx.fillRect(0, 0, BAKED, BAKED)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(perMetre, perMetre)
  texture.anisotropy = anisotropy
  pendingSurfaces.push(loadImage(SURFACE_PBR[kind][1]).then((img) => {
    ctx.drawImage(img, 0, 0, BAKED, BAKED)
    texture.needsUpdate = true
  }).catch(() => { /* stays flat */ }))
  return texture
}

/**
 * Rescales the UVs of a box (plain or rounded) from 0..1 per face to metres,
 * so a repeating texture keeps the same scale on boxes of any size.
 */
export function boxUVsInMetres(geo: THREE.BufferGeometry, w: number, h: number, d: number) {
  const uv = geo.attributes.uv
  const perSide = uv.count / 6
  // Box sides in order: +x, -x, +y, -y, +z, -z
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = dims[Math.min(5, Math.floor(i / perSide))]
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  }
  uv.needsUpdate = true
}

/** Soft radial falloff used as the halo of a lit lamp (tinted by the sprite material) */
export function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.25, 'rgba(255, 255, 255, 0.45)')
  g.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Scallop a downlight throws on the wall next to it: hot at the top centre, fanning out and fading towards the floor */
export function createWallWashTexture(): THREE.CanvasTexture {
  const w = 128, h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // A circle stretched downwards from the top edge
  ctx.translate(w / 2, 0)
  ctx.scale(1, (h * 0.95) / (w / 2))
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  g.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)')
  g.addColorStop(0.7, 'rgba(255, 255, 255, 0.14)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(-w / 2, 0, w, w / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Blurred silhouette of the flat, used as a fake contact shadow on the ground.
 * `polygons` are in plan metres (x across, y along); the texture covers their bounds plus `margin`.
 */
export function createContactShadowTexture(polygons: [number, number][][], margin: number): THREE.CanvasTexture {
  const pts = polygons.flat()
  const minX = Math.min(...pts.map((p) => p[0])) - margin, maxX = Math.max(...pts.map((p) => p[0])) + margin
  const minY = Math.min(...pts.map((p) => p[1])) - margin, maxY = Math.max(...pts.map((p) => p[1])) + margin
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = Math.round((SIZE * (maxX - minX)) / (maxY - minY))
  const ctx = canvas.getContext('2d')!
  // Draw the shapes off-canvas and keep only their blurred shadow (works without ctx.filter)
  const off = canvas.width * 2
  ctx.shadowColor = '#000'
  ctx.shadowBlur = SIZE * 0.05
  ctx.shadowOffsetX = off
  ctx.fillStyle = '#000'
  for (const poly of polygons) {
    ctx.beginPath()
    poly.forEach(([x, y], i) => {
      // The long axis runs along the canvas width; canvas rows grow towards smaller x (texture v is flipped)
      const cx = ((y - minY) / (maxY - minY)) * canvas.width - off
      const cy = (1 - (x - minX) / (maxX - minX)) * canvas.height
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy)
    })
    ctx.closePath()
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
