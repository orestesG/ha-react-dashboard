// Imperative three.js scene for the flat. React (FloorplanCard) owns it and feeds it state;
// it renders on demand (no animation loop) and reports each frame so HTML markers can follow.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  SILL_HEIGHT, WALL_HEIGHT, WALL_THICKNESS, coves, devices, furniture, rooms, walls,
} from '../../../floorplan.config'
import { centroid, pointAlong, splitWall, wallHit, wallLength, type Device, type DeviceKind, type Facing, type Pt } from '../../../lib/floorplan'
import { boxUVsInMetres, createContactShadowTexture, createFloorTexture, createGlowTexture, createSurfaceNormal, createSurfaceTexture, loadFloorMaps, surfacesLoaded, createWallWashTexture, type FloorKind } from './textures'
import { createFurnitureBuilder } from './furniture'

export interface SceneState {
  /** Room id → colour (hex) of the light that is on there; absent = dark */
  lit: Record<string, number>
  /** Cover entity id → open fraction (0 closed, 1 open); null = unknown */
  covers: Record<string, number | null>
  /** Device id → active */
  active: Record<string, boolean>
  /** Device id → colour (hex) of a light that reports one */
  colors: Record<string, number>
  /** Robot and dock in plan coordinates; null when the map has no position */
  robot: { pos: Pt; angle: number } | null
  dock: Pt | null
}

export type ViewMode = 'iso' | 'top'

interface Palette {
  wall: number; wallTop: number; blind: number; glass: number; device: number
  /** Ambient and sun strength: by day the sun models the flat, at night only the lamps do */
  hemi: number; sun: number; sunColor: number; roomLight: number; shadow: number
  /** Opacity of the halo around a lit lamp, and tone-mapping exposure */
  glow: number; exposure: number
  /** Strength of each cove bulb */
  coveLight: number
  /** Strength of the soft studio environment that gives materials their sheen */
  env: number
}

const LIGHT: Palette = { wall: 0xdfe1e3, wallTop: 0x64748b, blind: 0x94a3b8, glass: 0x7dd3fc, device: 0xd6d3d1, hemi: 0.55, sun: 2.3, sunColor: 0xfff1d6, roomLight: 14, shadow: 0.35, glow: 0.45, exposure: 1.1, env: 0.45, coveLight: 1.2 }
// Night: a faint moonlight so the flat reads, and warm pools from whatever lamp is on
const DARK: Palette  = { wall: 0xcbced2, wallTop: 0x334155, blind: 0x334155, glass: 0x38bdf8, device: 0x9ca3af, hemi: 0.12, sun: 0.4, sunColor: 0x8fa8ff, roomLight: 30, shadow: 0.7, glow: 0.9, exposure: 1.05, env: 0.07, coveLight: 3 }

export const WARM_WHITE = 0xffd699

// Emissive colour of an active device
const ACTIVE_COLOR: Record<DeviceKind, number> = {
  light: 0xfbbf24, strip: 0xfbbf24, cover: 0x3b82f6, climate: 0x38bdf8, projector: 0xa855f7, speaker: 0xa855f7,
  heater: 0xf97316, washer: 0x3b82f6, plug: 0x10b981, sensor: 0x10b981, motion: 0x10b981, leak: 0xef4444, vacuum: 0x3b82f6,
}

// Plan bounds (balcony included) → the model is centred on the origin
const ALL_POINTS = rooms.flatMap((r) => r.points)
const CX = (Math.min(...ALL_POINTS.map((p) => p[0])) + Math.max(...ALL_POINTS.map((p) => p[0]))) / 2
const CY = (Math.min(...ALL_POINTS.map((p) => p[1])) + Math.max(...ALL_POINTS.map((p) => p[1]))) / 2
const HALF_LONG  = (Math.max(...ALL_POINTS.map((p) => p[1])) - Math.min(...ALL_POINTS.map((p) => p[1]))) / 2
const HALF_SHORT = (Math.max(...ALL_POINTS.map((p) => p[0])) - Math.min(...ALL_POINTS.map((p) => p[0]))) / 2

/** Plan (x across, y along) → world: the long axis runs left-right, the wing points away from the camera */
function toWorld(p: Pt, h = 0): THREE.Vector3 {
  return new THREE.Vector3(p[1] - CY, h, -(p[0] - CX))
}

/** Fixed frame of the pre-rendered view: scripts/render_floorplan.py renders exactly this camera */
export const STILL = { width: 1600, height: 1000, fov: 32, elevation: 52 }

/** Camera position that frames the whole flat, looking at the origin from `elevation` degrees above the floor */
function framingPosition(aspect: number, fov: number, elevationDeg: number): THREE.Vector3 {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const elevation = THREE.MathUtils.degToRad(elevationDeg)
  // Seen from the elevation angle the depth of the model is foreshortened
  const halfDepth = HALF_SHORT * Math.sin(elevation) + WALL_HEIGHT * Math.cos(elevation)
  const dist = Math.max((HALF_LONG + 0.5) / (tanV * aspect), (halfDepth + 0.5) / tanV) + HALF_SHORT * Math.cos(elevation)
  return new THREE.Vector3(0, dist * Math.sin(elevation), dist * Math.cos(elevation))
}

function createStillCamera(): THREE.PerspectiveCamera {
  const aspect = STILL.width / STILL.height
  const camera = new THREE.PerspectiveCamera(STILL.fov, aspect, 0.1, 200)
  camera.position.copy(framingPosition(aspect, STILL.fov, STILL.elevation))
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return camera
}

let stillCamera: THREE.PerspectiveCamera | null = null

/** Where a plan point falls in the pre-rendered image, as fractions of its width and height */
export function projectStill(pos: Pt, h: number): { u: number; v: number } {
  stillCamera ??= createStillCamera()
  const p = toWorld(pos, h).project(stillCamera)
  return { u: (p.x + 1) / 2, v: (1 - p.y) / 2 }
}

/** Whether a plan point falls inside a room (rooms are close to rectangles, so their bounds are enough) */
function insideAnyRoom(p: Pt): boolean {
  return rooms.some((r) => {
    const xs = r.points.map((q) => q[0]), ys = r.points.map((q) => q[1])
    return p[0] > Math.min(...xs) && p[0] < Math.max(...xs) && p[1] > Math.min(...ys) && p[1] < Math.max(...ys)
  })
}

/** Default height of a device's object above the floor */
export function deviceHeight(d: Device): number {
  if (d.h !== undefined) return d.h
  switch (d.kind) {
    case 'light':   return WALL_HEIGHT + 0.25
    case 'strip':   return WALL_HEIGHT
    case 'climate': return WALL_HEIGHT - 0.15
    case 'cover':   return WALL_HEIGHT
    case 'sensor':
    case 'motion':  return 0.9
    case 'projector':
    case 'speaker': return 0.55
    default:        return 0
  }
}

function deviceGeometry(kind: DeviceKind): THREE.BufferGeometry | null {
  switch (kind) {
    case 'light':     return new THREE.CylinderGeometry(0.2, 0.2, 0.11, 32)   // drum shade of a pendant lamp
    case 'strip':     return new THREE.BoxGeometry(0.9, 0.04, 0.06)
    case 'climate':   return new THREE.BoxGeometry(0.85, 0.28, 0.2)
    case 'projector': return new THREE.BoxGeometry(0.55, 0.14, 0.32)
    case 'speaker':   return new THREE.CylinderGeometry(0.07, 0.07, 0.1, 20)
    case 'heater':    return new THREE.CylinderGeometry(0.2, 0.2, 0.75, 24)
    case 'washer':    return new THREE.BoxGeometry(0.6, 0.66, 0.6)   // fits under the worktop
    case 'plug':      return new THREE.BoxGeometry(0.12, 0.12, 0.12)
    case 'sensor':
    case 'motion':    return new THREE.BoxGeometry(0.08, 0.08, 0.08)
    case 'leak':      return new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16)
    case 'vacuum':    return new THREE.CylinderGeometry(0.175, 0.175, 0.1, 28)
    case 'cover':     return null   // drawn as the blind of its window
  }
}

/** Objects that stand on the floor are placed by their base, the rest by their centre */
const ON_FLOOR = new Set<DeviceKind>(['heater', 'washer', 'plug', 'leak', 'vacuum'])

interface Blind { mesh: THREE.Mesh; cover: string; openH: number; top: number }
interface Curtain { panels: THREE.Mesh[]; cover: string }

// Rotation that turns a piece's front (+z in its own frame) towards a plan direction
const FACING_ANGLE: Record<Facing, number> = { 'x-': 0, 'y+': Math.PI / 2, 'x+': Math.PI, 'y-': -Math.PI / 2 }

const WINDOW_BAR = 0.035   // section of the aluminium profiles

export class FloorplanScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200)
  private controls: OrbitControls
  private resizeObserver: ResizeObserver
  private frame = 0
  private fitted = false
  private view: ViewMode = 'iso'
  private palette: Palette

  private hemi = new THREE.HemisphereLight(0xffffff, 0x9ca3af, 1)
  private sun = new THREE.DirectionalLight(0xffffff, 1)
  private roomLights = new Map<string, THREE.PointLight>()
  private wallMat = new THREE.MeshStandardMaterial({ roughness: 0.9 })
  // The cut face of the walls is darker, like a section drawing
  private wallTopMat = new THREE.MeshStandardMaterial({ roughness: 1 })
  private groundMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  private blindMat = new THREE.MeshStandardMaterial({ roughness: 0.7 })
  private glassMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.25, roughness: 0.1 })
  // Window frames, door casings and skirting boards are all white
  private frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  private curtainMat = new THREE.MeshStandardMaterial({ color: 0xe9dfcd, roughness: 1, side: THREE.DoubleSide })
  private blinds: Blind[] = []
  private curtains: Curtain[] = []
  private coveLights = new Map<string, THREE.PointLight[]>()
  private coveBulbs = new Map<string, THREE.Mesh[]>()
  private coveSlabs: THREE.Mesh[] = []
  private ground: THREE.Mesh
  private floorMaps: Promise<unknown>[] = []
  // Light scallops the cove bulbs throw on the wall beside them, per device
  private washTexture = createWallWashTexture()
  private washes = new Map<string, { mat: THREE.MeshBasicMaterial; meshes: THREE.Mesh[] }>()
  // Halo sprites of lamps and bulbs, one material per device (it takes the light's colour)
  private glowTexture = createGlowTexture()
  private glows = new Map<string, THREE.SpriteMaterial>()
  private glowOwner = new Map<THREE.Sprite, string>()
  private cordMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 })
  private deviceMeshes = new Map<string, { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; kind: DeviceKind }>()
  private robot: THREE.Mesh | null = null
  private dock: THREE.Mesh
  private state: SceneState | null = null

  private envTarget: THREE.WebGLRenderTarget
  private container: HTMLElement
  private onFrame: () => void

  constructor(container: HTMLElement, dark: boolean, onFrame: () => void) {
    this.container = container
    this.onFrame = onFrame
    this.palette = dark ? DARK : LIGHT

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.domElement.style.display = 'block'

    // Image-based ambient light: soft reflections instead of a flat fill
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    pmrem.dispose()
    this.scene.environment = this.envTarget.texture

    const anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const plaster = createSurfaceTexture('plaster', 0.5, anisotropy)
    this.wallMat.map = plaster
    this.wallMat.normalMap = createSurfaceNormal('plaster', 0.5, anisotropy)
    this.wallMat.normalScale.set(0.6, 0.6)
    const cloth = createSurfaceTexture('fabric', 5, anisotropy)
    this.curtainMat.map = cloth
    this.curtainMat.normalMap = createSurfaceNormal('fabric', 5, anisotropy)
    this.curtainMat.normalScale.set(0.8, 0.8)
    container.appendChild(this.renderer.domElement)

    this.sun.position.set(-7, 11, 6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    const sc = this.sun.shadow.camera
    sc.left = sc.bottom = -9
    sc.right = sc.top = 9
    sc.near = 1
    sc.far = 40
    this.scene.add(this.hemi, this.sun)

    // Soft drawn shadow under the building. A real shadow catcher would also pick up every
    // room lamp's shadow and smear odd shapes around the flat at night.
    const margin = 1.5
    this.groundMat.map = createContactShadowTexture(rooms.map((r) => r.points), margin)
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry((HALF_LONG + margin) * 2, (HALF_SHORT + margin) * 2), this.groundMat)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.set(0.3, -0.03, -0.25)   // pushed away from the sun
    this.scene.add(this.ground)

    this.buildFloors()
    this.buildWalls()
    this.buildFurniture()
    this.buildDevices()
    this.buildCoves()
    this.dock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.2), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.6 }))
    this.dock.visible = false
    this.dock.castShadow = true
    this.scene.add(this.dock)
    this.applyPalette()
    // Baked detail maps land after the first frame
    surfacesLoaded().then(() => { if (!this.disposed) this.requestRender() })

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = false
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08
    this.controls.minDistance = 3
    this.controls.maxDistance = 45
    this.controls.addEventListener('change', this.requestRender)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  private buildFloors() {
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    const mats = new Map<FloorKind, THREE.MeshStandardMaterial>()
    for (const room of rooms) {
      let mat = mats.get(room.floor)
      if (!mat) {
        const map = createFloorTexture(room.floor, anisotropy)
        // The same drawing as relief: joints sink a little and catch the light
        mat = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.5, roughness: room.floor === 'wood' ? 0.55 : 0.4 })
        mats.set(room.floor, mat)
        // Baked PBR maps replace the drawn fallback once they arrive
        const floorMat = mat
        this.floorMaps.push(loadFloorMaps(room.floor, anisotropy).then((maps) => {
          if (this.disposed) { Object.values(maps).forEach((t) => t.dispose()); return }
          floorMat.map?.dispose()
          floorMat.map = maps.map
          floorMat.bumpMap = null
          floorMat.normalMap = maps.normalMap
          floorMat.normalScale.set(1, 1)
          floorMat.roughnessMap = maps.roughnessMap
          floorMat.roughness = 1
          floorMat.needsUpdate = true
          this.requestRender()
        }).catch(() => { /* keep the drawn fallback */ }))
      }
      const shape = new THREE.Shape(room.points.map((p) => new THREE.Vector2(p[1] - CY, p[0] - CX)))
      const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat)
      floor.rotation.x = -Math.PI / 2   // (u, v, 0) → (u, 0, -v), matching toWorld
      floor.receiveShadow = true
      this.scene.add(floor)

      // Ceiling lamp of the room: above the cut walls, so they throw its shadow into the next room
      const light = new THREE.PointLight(WARM_WHITE, 0, 9, 2)
      light.position.copy(toWorld(centroid(room.points), 2))
      light.shadow.mapSize.set(512, 512)
      light.shadow.bias = -0.002
      light.shadow.camera.near = 0.2
      light.shadow.camera.far = 9
      this.scene.add(light)
      this.roomLights.set(room.id, light)
    }
  }

  private addBox(a: Pt, b: Pt, thickness: number, y0: number, y1: number, mat: THREE.Material, shadows = true): THREE.Mesh {
    const wa = toWorld(a), wb = toWorld(b)
    // Box faces: +x, -x, +y (top), -y, +z, -z
    const mats = mat === this.wallMat ? [mat, mat, this.wallTopMat, mat, mat, mat] : mat
    const geo = new THREE.BoxGeometry(wa.distanceTo(wb), y1 - y0, thickness)
    boxUVsInMetres(geo, wa.distanceTo(wb), y1 - y0, thickness)
    const mesh = new THREE.Mesh(geo, mats)
    mesh.castShadow = shadows
    mesh.receiveShadow = shadows
    mesh.position.set((wa.x + wb.x) / 2, (y0 + y1) / 2, (wa.z + wb.z) / 2)
    mesh.rotation.y = Math.atan2(-(wb.z - wa.z), wb.x - wa.x)
    this.scene.add(mesh)
    return mesh
  }

  private buildWalls() {
    for (const wall of walls) {
      const t = wall.t ?? WALL_THICKNESS
      const h = wall.h ?? WALL_HEIGHT
      const len = wallLength(wall)
      for (const piece of splitWall(wall)) {
        const a = pointAlong(wall, piece.start), b = pointAlong(wall, piece.end)
        if (piece.kind === 'door') {
          this.addCasing(a, b, t, h)
          continue
        }
        this.addSkirting(a, b, t)
        if (piece.kind === 'solid') {
          // Overshoot the wall's own ends by half a thickness so corners close
          const start = piece.start === 0 ? -t / 2 : piece.start
          const end = piece.end === len ? len + t / 2 : piece.end
          this.addBox(pointAlong(wall, start), pointAlong(wall, end), t, 0, h, this.wallMat)
          continue
        }
        const sill = piece.sill ?? SILL_HEIGHT
        this.addBox(a, b, t, 0, sill, this.wallMat)
        this.addWindow(a, b, t, sill, h)
        const f = this.openingFrame(a, b)
        if (piece.cover) {
          // Roller shutter on the outside face
          const mesh = this.addBox(f.at(0, t * 0.42), f.at(f.len, t * 0.42), 0.03, sill, h, this.blindMat)
          this.blinds.push({ mesh, cover: piece.cover, openH: h - sill, top: h })
        }
        if (piece.curtain) this.addCurtain(a, b, t, h, piece.curtain)
      }
    }
  }

  /** Door casing: a jamb at each side of the opening, a little proud of the wall */
  private addCasing(a: Pt, b: Pt, t: number, h: number) {
    const f = this.openingFrame(a, b)
    const w = 0.05
    this.addBox(f.at(0), f.at(w), t + 0.03, 0, h, this.frameMat)
    this.addBox(f.at(f.len - w), f.at(f.len), t + 0.03, 0, h, this.frameMat)
  }

  /** Skirting board on each face of a wall stretch that looks into a room (not on the outside of the building) */
  private addSkirting(a: Pt, b: Pt, t: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n: Pt = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const depth = 0.015
    for (const side of [-1, 1]) {
      const probe = t / 2 + 0.12
      if (!insideAnyRoom([mid[0] + n[0] * probe * side, mid[1] + n[1] * probe * side])) continue
      const off = (t / 2 + depth / 2) * side
      this.addBox([a[0] + n[0] * off, a[1] + n[1] * off], [b[0] + n[0] * off, b[1] + n[1] * off], depth, 0, 0.08, this.frameMat)
    }
  }

  /** Walks an opening: `at(d, out)` is the point `d` metres from `a`, pushed `out` metres towards the outside of the flat */
  private openingFrame(a: Pt, b: Pt) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    let n: Pt = [-dir[1], dir[0]]
    // Outside = away from the centre of the flat
    if (((a[0] + b[0]) / 2 - CX) * n[0] + ((a[1] + b[1]) / 2 - CY) * n[1] < 0) n = [-n[0], -n[1]]
    return { len, at: (d: number, out = 0): Pt => [a[0] + dir[0] * d + n[0] * out, a[1] + dir[1] * d + n[1] * out] }
  }

  /** Sliding window: a fixed frame and two leaves on parallel tracks that overlap in the middle */
  private addWindow(a: Pt, b: Pt, t: number, sill: number, h: number) {
    const f = this.openingFrame(a, b)
    const bar = WINDOW_BAR, depth = t * 0.7, y0 = sill, y1 = h
    this.addBox(f.at(0), f.at(f.len), depth, y0, y0 + bar, this.frameMat)
    this.addBox(f.at(0), f.at(f.len), depth, y1 - bar, y1, this.frameMat)
    this.addBox(f.at(0), f.at(bar), depth, y0, y1, this.frameMat)
    this.addBox(f.at(f.len - bar), f.at(f.len), depth, y0, y1, this.frameMat)

    const leaves: [number, number, number][] = [[bar, f.len / 2 + bar, 0.02], [f.len / 2 - bar, f.len - bar, -0.02]]
    for (const [start, end, out] of leaves) {
      const p = (d: number) => f.at(d, out)
      this.addBox(p(start), p(end), 0.008, y0 + bar, y1 - bar, this.glassMat, false)
      this.addBox(p(start), p(start + bar), 0.03, y0 + bar, y1 - bar, this.frameMat)
      this.addBox(p(end - bar), p(end), 0.03, y0 + bar, y1 - bar, this.frameMat)
      this.addBox(p(start), p(end), 0.03, y0 + bar, y0 + bar * 2, this.frameMat)
      this.addBox(p(start), p(end), 0.03, y1 - bar * 2, y1 - bar, this.frameMat)
    }
  }

  /** Fabric curtain inside the room: two pleated panels that gather towards the ends of the rod */
  private addCurtain(a: Pt, b: Pt, t: number, h: number, cover: string) {
    const f = this.openingFrame(a, b)
    const inside = -(t / 2 + 0.09), over = 0.18
    const ends = [f.at(-over, inside), f.at(f.len + over, inside)]
    const half = (f.len + over * 2) / 2
    const drop = h - 0.06
    this.addBox(ends[0], ends[1], 0.025, h - 0.02, h + 0.005, this.frameMat)

    const panels = ends.map((end, i) => {
      const geo = new THREE.PlaneGeometry(half, drop, 40, 1)
      geo.translate(half / 2, drop / 2 + 0.03, 0)   // hangs from its outer edge
      const pos = geo.attributes.position
      for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin((pos.getX(v) / half) * Math.PI * 11) * 0.035)
      geo.computeVertexNormals()
      const uv = geo.attributes.uv
      for (let v = 0; v < uv.count; v++) uv.setXY(v, uv.getX(v) * half, uv.getY(v) * drop)
      const mesh = new THREE.Mesh(geo, this.curtainMat)
      const from = toWorld(end), to = toWorld(ends[1 - i])
      mesh.position.copy(from)
      mesh.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
      return mesh
    })
    this.curtains.push({ panels, cover })
  }

  private buildFurniture() {
    const build = createFurnitureBuilder(this.renderer.capabilities.getMaxAnisotropy())
    for (const f of furniture) {
      const group = build(f)
      group.position.copy(toWorld(f.pos))
      group.rotation.y = FACING_ANGLE[f.facing]
      this.scene.add(group)
    }
  }

  private buildDevices() {
    for (const d of devices) {
      // Drawn by buildCoves instead
      if (coves.some((c) => c.deviceId === d.id)) continue
      const geo = deviceGeometry(d.kind)
      if (!geo) continue
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0x000000 })
      const mesh = new THREE.Mesh(geo, mat)
      geo.computeBoundingBox()
      const half = ON_FLOOR.has(d.kind) ? (geo.boundingBox!.max.y - geo.boundingBox!.min.y) / 2 : 0
      mesh.position.copy(toWorld(d.pos, deviceHeight(d) + half))
      mesh.castShadow = d.kind !== 'light' && d.kind !== 'strip'
      this.scene.add(mesh)
      if (d.kind === 'light') {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6), this.cordMat)
        cord.position.y = 0.28
        mesh.add(cord)
      }
      if (d.kind === 'light' || d.kind === 'strip') this.addGlow(d.id, mesh.position, d.kind === 'light' ? 1.3 : 0.9)
      this.deviceMeshes.set(d.id, { mesh, mat, kind: d.kind })
      if (d.kind === 'vacuum') this.robot = mesh
    }
  }

  /** Additive halo that stands in for bloom; shown while the device is active */
  private addGlow(id: string, at: THREE.Vector3, size: number) {
    let mat = this.glows.get(id)
    if (!mat) {
      mat = new THREE.SpriteMaterial({ map: this.glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      this.glows.set(id, mat)
    }
    const sprite = new THREE.Sprite(mat)
    sprite.position.copy(at)
    sprite.scale.setScalar(size)
    sprite.visible = false
    this.glowOwner.set(sprite, id)
    this.scene.add(sprite)
  }

  /** Dropped perimeter ceiling: a see-through ring at the cut of the walls with two recessed bulbs per side */
  private buildCoves() {
    const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false })
    const y0 = WALL_HEIGHT + 0.02, y1 = y0 + 0.06
    for (const cove of coves) {
      const device = devices.find((d) => d.id === cove.deviceId)
      if (!device) continue
      const x0 = Math.min(cove.from[0], cove.to[0]), x1 = Math.max(cove.from[0], cove.to[0])
      const ya = Math.min(cove.from[1], cove.to[1]), yb = Math.max(cove.from[1], cove.to[1])
      const w = cove.width, g = cove.bulbGap / 2
      const mx = (x0 + x1) / 2, my = (ya + yb) / 2
      // Two full-length sides and two that fit between them. No shadows: the sun would darken the whole room.
      const sides: [Pt, Pt][] = [
        [[x0, ya + w / 2], [x1, ya + w / 2]], [[x0, yb - w / 2], [x1, yb - w / 2]],
        [[x0 + w / 2, ya + w], [x0 + w / 2, yb - w]], [[x1 - w / 2, ya + w], [x1 - w / 2, yb - w]],
      ]
      for (const [a, b] of sides) this.coveSlabs.push(this.addBox(a, b, w, y0, y1, slabMat, false))

      // Each bulb with the direction of the wall its side of the ring runs along
      const bulbs: [Pt, Pt][] = [
        [[mx - g, ya + w / 2], [0, -1]], [[mx + g, ya + w / 2], [0, -1]], [[mx - g, yb - w / 2], [0, 1]], [[mx + g, yb - w / 2], [0, 1]],
        [[x0 + w / 2, my - g], [-1, 0]], [[x0 + w / 2, my + g], [-1, 0]], [[x1 - w / 2, my - g], [1, 0]], [[x1 - w / 2, my + g], [1, 0]],
      ]
      const washMat = new THREE.MeshBasicMaterial({ map: this.washTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      const washMeshes: THREE.Mesh[] = []
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0x000000 })
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20)
      const lights: THREE.PointLight[] = []
      const bulbMeshes: THREE.Mesh[] = []
      for (const [p, out] of bulbs) {
        const wash = this.buildWallWash(p, out, w / 2 + 0.3, washMat)
        if (wash) washMeshes.push(wash)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.copy(toWorld(p, y0))
        this.scene.add(mesh)
        bulbMeshes.push(mesh)
        this.addGlow(device.id, mesh.position, 0.45)
        // Pool of light under each bulb; no shadow maps (eight of them would be too heavy)
        const light = new THREE.PointLight(WARM_WHITE, 1, 3.2, 1.6)
        // Hung low and towards the room, so it pools on the floor and leaves the wall to the scallop
        light.position.copy(toWorld([p[0] - out[0] * 0.25, p[1] - out[1] * 0.25], y0 - 0.35))
        light.visible = false
        this.scene.add(light)
        lights.push(light)
      }
      this.deviceMeshes.set(device.id, { mesh: bulbMeshes[0], mat, kind: device.kind })
      this.coveBulbs.set(device.id, bulbMeshes)
      this.coveLights.set(device.id, lights)
      this.washes.set(device.id, { mat: washMat, meshes: washMeshes })
    }
  }

  /** Scallop on the solid wall found within `reach` of a bulb in direction `out`; null when there is none (open side, door, window) */
  private buildWallWash(bulb: Pt, out: Pt, reach: number, mat: THREE.Material): THREE.Mesh | null {
    const far: Pt = [bulb[0] + out[0] * reach, bulb[1] + out[1] * reach]
    for (const wall of walls) {
      const d = wallHit(wall, bulb, far)
      if (d === null) continue
      if (splitWall(wall).find((piece) => d >= piece.start && d <= piece.end)?.kind !== 'solid') return null
      const t = wall.t ?? WALL_THICKNESS, h = wall.h ?? WALL_HEIGHT
      const hit = pointAlong(wall, d)
      const width = 1.1
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h - 0.04), mat)
      // Just off the face of the wall that looks at the bulb
      const off = t / 2 + 0.006
      mesh.position.copy(toWorld([hit[0] - out[0] * off, hit[1] - out[1] * off], (h + 0.04) / 2))
      // The plane's normal (+z) points back into the room: plan (-out) → world (-out.y, 0, out.x)
      mesh.rotation.y = Math.atan2(-out[1], out[0])
      mesh.visible = false
      this.scene.add(mesh)
      return mesh
    }
    return null
  }

  // ── State ───────────────────────────────────────────────────────────────────

  setDark(dark: boolean) {
    this.palette = dark ? DARK : LIGHT
    this.applyPalette()
  }

  setState(state: SceneState) {
    this.state = state
    this.applyState()
  }

  private applyPalette() {
    const p = this.palette
    this.hemi.intensity = p.hemi
    this.sun.intensity = p.sun
    this.sun.color.setHex(p.sunColor)
    this.groundMat.opacity = p.shadow
    this.scene.environmentIntensity = p.env
    this.renderer.toneMappingExposure = p.exposure
    this.wallMat.color.setHex(p.wall)
    this.wallTopMat.color.setHex(p.wallTop)
    this.blindMat.color.setHex(p.blind)
    this.glassMat.color.setHex(p.glass)
    this.applyState()
  }

  private applyState() {
    const p = this.palette
    const s = this.state
    for (const [id, light] of this.roomLights) {
      const color = s?.lit[id]
      light.intensity = color === undefined ? 0 : p.roomLight
      // Only lit lamps pay for a shadow map
      light.castShadow = color !== undefined
      if (color !== undefined) light.color.setHex(color)
    }
    for (const blind of this.blinds) {
      const open = s?.covers[blind.cover]
      // Unknown position: draw it half way so the window is still recognisable
      const closed = Math.max(0.06, 1 - (open ?? 0.5))
      blind.mesh.scale.y = closed
      blind.mesh.position.y = blind.top - (blind.openH * closed) / 2
    }
    for (const curtain of this.curtains) {
      // Gathered fabric never disappears completely
      const drawn = Math.max(0.16, 1 - (s?.covers[curtain.cover] ?? 0.5))
      for (const panel of curtain.panels) panel.scale.x = drawn
    }
    for (const [id, { mat, kind }] of this.deviceMeshes) {
      const active = !!s?.active[id]
      const color = s?.colors[id] ?? ACTIVE_COLOR[kind]
      mat.color.setHex(active ? color : p.device)
      mat.emissive.setHex(active ? color : 0x000000)
      mat.emissiveIntensity = active ? 1.4 : 0
    }
    for (const [id, mat] of this.glows) {
      mat.opacity = p.glow
      mat.color.setHex(s?.colors[id] ?? WARM_WHITE)
    }
    for (const [sprite, id] of this.glowOwner) sprite.visible = !!s?.active[id]
    for (const [id, { mat, meshes }] of this.washes) {
      mat.opacity = p.glow
      mat.color.setHex(s?.colors[id] ?? WARM_WHITE)
      for (const mesh of meshes) mesh.visible = !!s?.active[id]
    }
    for (const [id, lights] of this.coveLights) {
      const on = !!s?.active[id]
      for (const light of lights) {
        light.visible = on
        light.intensity = p.coveLight
        light.color.setHex(s?.colors[id] ?? WARM_WHITE)
      }
    }
    if (this.robot && s?.robot) {
      const w = toWorld(s.robot.pos, 0.05)
      this.robot.position.set(w.x, w.y, w.z)
    }
    this.dock.visible = !!s?.dock
    if (s?.dock) this.dock.position.copy(toWorld(s.dock, 0.225))
    this.requestRender()
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  setView(view: ViewMode) {
    this.view = view
    this.fit()
  }

  /** Frames the whole flat for the current view and container aspect */
  private fit() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.controls.target.set(0, 0, 0)
    this.camera.position.copy(framingPosition(w / h, this.camera.fov, this.view === 'top' ? 89.5 : STILL.elevation))
    this.controls.update()
    this.fitted = true
    this.requestRender()
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (!this.fitted) this.fit()
    this.requestRender()
  }

  /** Screen position (px, relative to the container) of a plan point; null when behind the camera */
  project(pos: Pt, h: number): { x: number; y: number } | null {
    const v = toWorld(pos, h).project(this.camera)
    if (v.z > 1) return null
    return { x: ((v.x + 1) / 2) * this.container.clientWidth, y: ((1 - v.y) / 2) * this.container.clientHeight }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  private requestRender = () => {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.renderer.render(this.scene, this.camera)
      this.onFrame()
    })
  }

  /**
   * Dev tool: the model as a GLB for scripts/render_floorplan.py. Lights, halos, robot and the cove slab are left out,
   * blinds and curtains are open, and lamps are named (`lamp:<device>`, `bulb:<device>:<n>`) so Blender can light them.
   */
  async exportGLB(): Promise<ArrayBuffer> {
    if (!import.meta.env.DEV) throw new Error('dev only')
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
    await Promise.all([surfacesLoaded(), ...this.floorMaps])

    const previous = { state: this.state, palette: this.palette }
    this.palette = LIGHT
    const covers = Object.fromEntries([...this.blinds, ...this.curtains].map((c) => [c.cover, 1]))
    this.setState({ lit: {}, covers, active: {}, colors: {}, robot: null, dock: null })
    this.applyPalette()

    const hide: THREE.Object3D[] = [
      this.hemi, this.sun, this.ground, this.dock, ...this.roomLights.values(), ...[...this.coveLights.values()].flat(),
      ...this.glowOwner.keys(), ...[...this.washes.values()].flatMap((w) => w.meshes), ...this.coveSlabs,
    ]
    if (this.robot) hide.push(this.robot)
    const wasVisible = hide.map((o) => o.visible)
    for (const o of hide) o.visible = false

    for (const [id, { mesh, kind }] of this.deviceMeshes) mesh.name = `${kind === 'light' || kind === 'strip' ? 'lamp' : 'device'}:${id}`
    for (const [id, bulbs] of this.coveBulbs) bulbs.forEach((b, i) => { b.name = `bulb:${id}:${i}` })
    this.wallMat.name = 'wall'
    this.wallTopMat.name = 'wallTop'
    this.glassMat.name = 'glass'
    this.blindMat.name = 'blind'
    this.frameMat.name = 'frame'
    this.curtainMat.name = 'curtain'

    const camera = createStillCamera()
    camera.name = 'StillCamera'
    this.scene.add(camera)
    try {
      return await new GLTFExporter().parseAsync(this.scene, { binary: true, onlyVisible: true }) as ArrayBuffer
    } finally {
      this.scene.remove(camera)
      hide.forEach((o, i) => { o.visible = wasVisible[i] })
      this.palette = previous.palette
      this.applyPalette()
      if (previous.state) this.setState(previous.state)
    }
  }

  private disposed = false

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener('change', this.requestRender)
    this.controls.dispose()
    this.glowTexture.dispose()
    this.washTexture.dispose()
    this.envTarget.dispose()
    for (const mat of this.glows.values()) mat.dispose()
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.geometry.dispose()
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        const sm = m as THREE.MeshStandardMaterial
        sm.map?.dispose()
        sm.normalMap?.dispose()
        sm.roughnessMap?.dispose()
        m.dispose()
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
