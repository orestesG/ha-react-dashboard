// Pre-rendered view of the flat (Blender, scripts/render_floorplan.py): a base image for day or night
// plus one image per lamp with only what that lamp adds. Lit lamps are tinted and added on a 2D canvas,
// so the default view costs no WebGL at all.
import { useEffect, useRef } from 'react'
import day from './still/day.webp'
import night from './still/night.webp'
import { STILL } from './FloorplanScene'

const layerFiles = import.meta.glob<string>('./still/light-*.jpg', { eager: true, query: '?url', import: 'default' })
/** Device id → image of its light */
const LIGHT_LAYERS: Record<string, string> = Object.fromEntries(
  Object.entries(layerFiles).map(([path, url]) => [path.slice(path.lastIndexOf('light-') + 6, -4), url]),
)

const images = new Map<string, Promise<HTMLImageElement>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
    images.set(url, p)
  }
  return p
}

export interface StillLight { id: string; color: number }

interface Props {
  night: boolean
  /** Lamps that are on, with the colour of their light */
  lights: StillLight[]
}

export function StillView({ night: isNight, lights }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Redraw only when what is lit actually changes
  const signature = lights.filter((l) => LIGHT_LAYERS[l.id]).map((l) => `${l.id}:${l.color}`).join(',')

  useEffect(() => {
    let cancelled = false
    const lit = signature ? signature.split(',').map((s) => s.split(':')) : []
    void Promise.all([loadImage(isNight ? night : day), ...lit.map(([id]) => loadImage(LIGHT_LAYERS[id]))]).then(([base, ...layers]) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (cancelled || !ctx) return
      const { width, height } = STILL
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(base, 0, 0, width, height)
      if (layers.length) {
        const tint = document.createElement('canvas')
        tint.width = width
        tint.height = height
        const tctx = tint.getContext('2d')!
        // By day a lamp adds little to a room already full of sunlight
        ctx.globalAlpha = isNight ? 1 : 0.35
        layers.forEach((layer, i) => {
          tctx.globalCompositeOperation = 'copy'
          tctx.drawImage(layer, 0, 0, width, height)
          tctx.globalCompositeOperation = 'multiply'
          tctx.fillStyle = `#${Number(lit[i][1]).toString(16).padStart(6, '0')}`
          tctx.fillRect(0, 0, width, height)
          ctx.globalCompositeOperation = 'lighter'
          ctx.drawImage(tint, 0, 0)
        })
        // The layers are opaque black around the flat: cut them back to the silhouette of the base
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(base, 0, 0, width, height)
      }
      ctx.globalCompositeOperation = 'source-over'
    }).catch(() => { /* images are bundled; nothing to retry */ })
    return () => { cancelled = true }
  }, [isNight, signature])

  return <canvas ref={canvasRef} width={STILL.width} height={STILL.height} className="absolute inset-0 w-full h-full object-contain" />
}
