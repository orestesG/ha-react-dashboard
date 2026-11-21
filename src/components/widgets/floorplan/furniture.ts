// Decorative furniture built from (rounded) boxes. Each piece is a group in its own frame:
// width along x, depth along z, y up, standing on y = 0 with its front towards +z.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Furniture } from '../../../lib/floorplan'
import { boxUVsInMetres, createSurfaceNormal, createSurfaceTexture, type SurfaceKind } from './textures'

type Mat = THREE.MeshStandardMaterial

// Height of the kitchen worktops (top face)
const COUNTER_H = 0.72

// Edge radius per kind of surface: upholstery is plump, joinery only loses its sharp arris
const SOFT = 0.06, CRISP = 0.008

export function createFurnitureBuilder(anisotropy: number): (f: Furniture) => THREE.Group {
  const textures = {
    fabric: createSurfaceTexture('fabric', 4, anisotropy),
    wood: createSurfaceTexture('wood', 0.8, anisotropy),
    stone: createSurfaceTexture('stone', 3, anisotropy),
  } satisfies Partial<Record<SurfaceKind, THREE.Texture>>
  const normals = {
    fabric: createSurfaceNormal('fabric', 4, anisotropy),
    wood: createSurfaceNormal('wood', 0.8, anisotropy),
    stone: createSurfaceNormal('stone', 3, anisotropy),
  } satisfies Partial<Record<SurfaceKind, THREE.Texture>>
  // Normal-map strength per unit of the `bump` argument below
  const NORMAL_GAIN = { fabric: 0.5, wood: 1, stone: 2.5 }

  /** `surface` adds a detail map (it multiplies the colour) plus its normal map as relief */
  const mat = (color: number, roughness: number, surface?: keyof typeof textures, bump = 1): Mat => {
    const m = new THREE.MeshStandardMaterial({ color, roughness })
    if (surface) {
      m.map = textures[surface]
      m.normalMap = normals[surface]
      const k = bump * NORMAL_GAIN[surface]
      m.normalScale.set(k, k)
    }
    return m
  }
  const wood = mat(0xa9744a, 0.55, 'wood', 0.6)
  const darkWood = mat(0x5e4330, 0.55, 'wood', 0.6)
  const white = mat(0xf6f4ef, 0.95, 'fabric', 1.2)
  const lacquer = mat(0xf3f1ec, 0.45)
  const linen = mat(0x9db0c4, 1, 'fabric', 1.6)
  const fabric = mat(0x7b8290, 1, 'fabric', 1.6)
  const sofaFabric = mat(0xd9cebd, 1, 'fabric', 1.8)
  const cushion = mat(0xe9e1d3, 1, 'fabric', 1.8)
  const accent = mat(0xc06f47, 1, 'fabric', 1.8)
  const rug = mat(0xc9bda9, 1, 'fabric', 2.5)
  const rugBorder = mat(0x9c9080, 1, 'fabric', 2.5)
  const dark = mat(0x27272a, 0.5)
  const walnut = mat(0x8a5a3c, 0.5, 'wood', 0.6)
  const carbon = mat(0x1a1a1e, 0.55, 'fabric', 0.8)
  const glow = (color: number): Mat => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.4 })
  const rgbA = glow(0xe11dff), rgbB = glow(0x22d3ee)
  const screenCurved = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.15, side: THREE.DoubleSide })
  const shell = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, side: THREE.DoubleSide })
  const stone = mat(0x52525b, 0.25, 'stone', 0.2)
  const SOFT_MATS = new Set<Mat>([white, linen, fabric, sofaFabric, cushion, accent])

  /** Box of size w×h×d centred on (x, z) with its base at height y; edges rounded according to the material */
  const box = (g: THREE.Group, m: Mat, w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
    const radius = Math.min(SOFT_MATS.has(m) ? SOFT : CRISP, Math.min(w, h, d) * 0.45)
    const geo = new RoundedBoxGeometry(w, h, d, SOFT_MATS.has(m) ? 3 : 1, radius)
    boxUVsInMetres(geo, w, h, d)
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(x, y + h / 2, z)
    g.add(mesh)
  }

  /** Square bar of section s between two points of the piece's frame */
  const beam = (g: THREE.Object3D, m: Mat, from: [number, number, number], to: [number, number, number], s: number) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
    const len = a.distanceTo(b)
    const geo = new RoundedBoxGeometry(s, len, s, 1, CRISP)
    boxUVsInMetres(geo, s, len, s)
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize())
    g.add(mesh)
  }

  const legs = (g: THREE.Group, m: Mat, w: number, d: number, h: number, s = 0.05) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, m, s, h, s, sx * (w / 2 - s), 0, sz * (d / 2 - s))
  }

  const builders: Record<Furniture['kind'], (g: THREE.Group, w: number, d: number) => void> = {
    // Head at the back (-z), foot at the front
    bed: (g, w, d) => {
      box(g, darkWood, w, 0.28, d)
      box(g, white, w - 0.06, 0.2, d - 0.06, 0, 0.27)
      box(g, darkWood, w, 0.95, 0.08, 0, 0, -d / 2 - 0.04)
      box(g, linen, w - 0.02, 0.22, d * 0.62, 0, 0.275, d * 0.19 - 0.02)
      for (const sx of [-1, 1]) box(g, white, w * 0.36, 0.13, 0.4, sx * w * 0.23, 0.45, -d / 2 + 0.28)
    },
    nightstand: (g, w, d) => {
      box(g, wood, w, 0.46, d)
      box(g, darkWood, w + 0.03, 0.03, d + 0.03, 0, 0.46)
      box(g, darkWood, w * 0.4, 0.02, 0.02, 0, 0.3, d / 2 + 0.01)
    },
    // Dining table: white top on a central pedestal of two crossed wooden frames
    table: (g, w, d) => {
      box(g, lacquer, w, 0.035, d, 0, 0.749)
      const s = 0.06
      for (const angle of [Math.PI / 4, -Math.PI / 4]) {
        const frame = new THREE.Group()
        frame.rotation.y = angle
        beam(frame, walnut, [-0.33, s / 2, 0], [0.33, s / 2, 0], s)
        beam(frame, walnut, [-0.2, 0.72, 0], [0.2, 0.72, 0], s)
        for (const sx of [-1, 1]) beam(frame, walnut, [sx * 0.3, s / 2, 0], [sx * 0.17, 0.72, 0], s)
        g.add(frame)
      }
    },
    // Dining chair: upholstered seat and tall back on a wooden frame
    chair: (g, w, d) => {
      legs(g, walnut, w - 0.03, d - 0.03, 0.4, 0.04)
      box(g, walnut, w - 0.04, 0.05, d - 0.06, 0, 0.36)
      box(g, cushion, w, 0.09, d, 0, 0.4, 0.01)
      box(g, cushion, w, 0.47, 0.09, 0, 0.41, -d / 2 + 0.045)
    },
    // The user sits at the front (+z); the monitor stands at the back
    desk: (g, w, d) => {
      // Gaming desk: carbon-look top with a light strip along each side, on steel side frames
      box(g, carbon, w, 0.035, d, 0, 0.715)
      for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.14)
        box(g, dark, 0.07, 0.04, d - 0.08, x)
        box(g, dark, 0.07, 0.68, 0.1, x, 0.04, -0.06)
        box(g, sx < 0 ? rgbA : rgbB, 0.02, 0.03, d - 0.04, sx * (w / 2 + 0.004), 0.718)
      }
      box(g, dark, w - 0.28, 0.06, 0.03, 0, 0.58, -0.06)
      // 49" curved monitor (32:9, 1000R): a slice of a cylinder whose axis is on the user's side
      const R = 1, arc = 1.2 / R, mh = 0.37, z0 = -d / 2 + 0.24, y0 = 0.75 + 0.13
      const slice = (radius: number, height: number, m: THREE.Material) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32, 1, true, Math.PI - arc / 2, arc), m)
        mesh.position.set(0, y0 + mh / 2, z0 + R)
        g.add(mesh)
      }
      slice(R, mh, screenCurved)
      slice(R + 0.03, mh + 0.02, shell)
      box(g, dark, 0.07, y0 - 0.75 + 0.1, 0.04, 0, 0.75, z0 - 0.06)
      box(g, dark, 0.5, 0.015, 0.2, 0, 0.75, z0 - 0.02)
    },
    officeChair: (g, w, d) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), dark)
      base.position.y = 0.04
      g.add(base)
      box(g, dark, 0.05, 0.38, 0.05, 0, 0.06)
      box(g, fabric, w, 0.1, d, 0, 0.43)
      box(g, fabric, w * 0.9, 0.5, 0.08, 0, 0.56, -d / 2 + 0.04)
    },
    sofa: (g, w, d) => {
      box(g, sofaFabric, w, 0.28, d)
      box(g, sofaFabric, w, 0.75, 0.22, 0, 0, -d / 2 + 0.11)
      box(g, accent, 0.36, 0.32, 0.12, -w / 2 + 0.44, 0.42, -d / 2 + 0.28)
      for (const sx of [-1, 1]) {
        box(g, sofaFabric, 0.2, 0.56, d, sx * (w / 2 - 0.1))
        box(g, cushion, (w - 0.4) / 2, 0.18, d - 0.24, sx * (w - 0.4) / 4, 0.25, 0.1)
      }
    },
    // Kitchen run: cabinets with a stone top
    counter: (g, w, d) => {
      box(g, lacquer, w, COUNTER_H - 0.04, d - 0.03, 0, 0, -0.015)
      box(g, stone, w, 0.04, d, 0, COUNTER_H - 0.04)
    },
    rug: (g, w, d) => {
      box(g, rugBorder, w, 0.012, d)
      box(g, rug, w - 0.16, 0.004, d - 0.16, 0, 0.012)
    },
    // Round low table
    coffeeTable: (g, w) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.04, 32), wood)
      top.position.y = 0.36
      g.add(top)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        box(g, darkWood, 0.04, 0.34, 0.04, Math.cos(a) * w * 0.32, 0, Math.sin(a) * w * 0.32)
      }
    },
    // Stone top only, for an appliance standing underneath
    worktop: (g, w, d) => box(g, stone, w, 0.04, d, 0, COUNTER_H - 0.04),
  }

  const DEFAULT_SIZE: Record<Furniture['kind'], [number, number]> = {
    bed: [1.6, 2], nightstand: [0.45, 0.4], table: [1.155, 0.895], chair: [0.52, 0.48],
    desk: [1.53, 0.77], officeChair: [0.48, 0.46], sofa: [2, 0.9], counter: [2, 0.6],
    worktop: [0.6, 0.6], rug: [2, 1.4], coffeeTable: [0.8, 0.8],
  }

  return (f) => {
    const g = new THREE.Group()
    const [w, d] = f.size ?? DEFAULT_SIZE[f.kind]
    builders[f.kind](g, w, d)
    g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
    return g
  }
}
