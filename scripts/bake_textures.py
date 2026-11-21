"""Builds the Plano 3D textures with Blender.

    blender --background --factory-startup --python scripts/bake_textures.py -- <outdir> [<cachedir>]

Floors, plaster, cloth and wood come from photo-scanned PBR sets of Poly Haven (polyhaven.com, CC0),
downloaded at 1k into <cachedir> the first time. Floors keep their colour; the detail maps are turned
into near-white greyscale so they modulate the colour of each material. The stone of the worktops is
procedural (bake_textures.osl), baked with Cycles.
"""
import json
import os
import sys
import urllib.request

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(HERE, 'out')
CACHE = ARGS[1] if len(ARGS) > 1 else os.path.join(OUT, '_src')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

# output name → Poly Haven asset and brightness gain. The real size of each one is in PBR_SPAN / perMetre (textures.ts)
FLOORS = {
    'floor-wood': ('herringbone_parquet', 1.0),   # 3.4 m per repeat
    'floor-tile': ('marble_01', 1.0),             # 1.5 m
    'floor-dark': ('granite_tile', 0.5),          # 2.3 m; darkened to a black tile
    'floor-deck': ('wood_floor_deck', 1.0),       # 1.8 m
}
# asset, mean brightness of the detail map, contrast kept
SURFACES = {
    'surf-plaster': ('white_stucco', 0.93, 0.8),    # 2 m
    'surf-fabric': ('rough_linen', 0.86, 0.7),      # 0.27 m
    'surf-wood': ('oak_veneer_01', 0.88, 0.8),      # 1.83 m
}
MAPS = {'color': 'Diffuse', 'normal': 'nor_gl', 'rough': 'Rough'}
AGENT = {'User-Agent': 'texture-fetch'}


def fetch(asset, kind):
    """Path of a 1k map of a Poly Haven asset, downloading it if it is not cached."""
    path = os.path.join(CACHE, f'{asset}-{kind}.jpg')
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://api.polyhaven.com/files/{asset}', headers=AGENT)
        files = json.load(urllib.request.urlopen(req, timeout=60))
        url = files[MAPS[kind]]['1k']['jpg']['url']
        with urllib.request.urlopen(urllib.request.Request(url, headers=AGENT), timeout=120) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path


def load(path):
    """Image file as (h, w, 3) stored values in 0..1, top row first."""
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    px = np.empty(w * h * img.channels, dtype=np.float32)
    img.pixels.foreach_get(px)
    channels = img.channels
    bpy.data.images.remove(img)
    px = px.reshape(h, w, channels)[::-1].astype(np.float64)
    return np.repeat(px, 3, axis=2) if channels == 1 else px[..., :3]


def half(a):
    """Halves the size by averaging 2 × 2 blocks."""
    h, w = a.shape[:2]
    return a.reshape(h // 2, 2, w // 2, 2, -1).mean(axis=(1, 3))


def save(name, rgb, quality):
    """Writes (h, w, 3) values in 0..1 as they are (no colour management)."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new('out', w, h, alpha=False, is_data=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(rgb[::-1], 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = 'JPEG'
    img.save(filepath=os.path.join(OUT, name + '.jpg'), quality=quality)
    bpy.data.images.remove(img)


def renormalize(n):
    """Unit-length normals again after averaging."""
    v = n * 2 - 1
    v /= np.linalg.norm(v, axis=2, keepdims=True) + 1e-9
    return v * 0.5 + 0.5


# ── Floors: colour at 1k, normal and roughness at 512 ─────────────────────────
for name, (asset, gain) in FLOORS.items():
    save(name + '-color', load(fetch(asset, 'color')) * gain, 80)
    save(name + '-normal', renormalize(half(load(fetch(asset, 'normal')))), 82)
    save(name + '-rough', half(load(fetch(asset, 'rough'))), 80)
    print('floor', name, flush=True)

# ── Detail maps (512): near-white greyscale + normal ──────────────────────────
for name, (asset, mean, contrast) in SURFACES.items():
    rgb = half(load(fetch(asset, 'color')))
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    grey = mean + (lum / lum.mean() - 1) * contrast * mean
    save(name + '-color', np.repeat(grey[..., None], 3, axis=2), 85)
    save(name + '-normal', renormalize(half(load(fetch(asset, 'normal')))), 85)
    print('surface', name, flush=True)

# ── Stone: procedural, baked with Cycles + OSL ────────────────────────────────
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.shading_system = True
scene.cycles.samples = 16  # antialiasing of the bake
scene.cycles.use_denoising = False
scene.render.bake.margin = 0

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)
bpy.ops.mesh.primitive_plane_add(size=2)
plane = bpy.context.active_object

mat = bpy.data.materials.new('bake')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
coord = nt.nodes.new('ShaderNodeTexCoord')
script = nt.nodes.new('ShaderNodeScript')
script.mode = 'EXTERNAL'
script.filepath = os.path.join(HERE, 'bake_textures.osl')
if 'Col' not in script.outputs:
    raise SystemExit('OSL shader did not compile')
emit = nt.nodes.new('ShaderNodeEmission')
out = nt.nodes.new('ShaderNodeOutputMaterial')
target = nt.nodes.new('ShaderNodeTexImage')
nt.links.new(coord.outputs['UV'], script.inputs['UV'])
nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
plane.data.materials.append(mat)
nt.nodes.active = target


def bake(socket, size):
    """Bakes one output of the shader as plain emission: (size, size, 3), top row first."""
    img = bpy.data.images.new('target', size, size, alpha=False, float_buffer=True, is_data=True)
    target.image = img
    for link in list(emit.inputs['Color'].links):
        nt.links.remove(link)
    nt.links.new(script.outputs[socket], emit.inputs['Color'])
    bpy.ops.object.bake(type='EMIT')
    px = np.empty(size * size * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(size, size, 4)[::-1, :, :3].astype(np.float64)


def normal_from_height(h, strength):
    """Wrap-around differences, so the normal map tiles like the height."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln, ny / ln, nz / ln], -1) * 0.5 + 0.5


save('surf-stone-color', bake('Col', 512), 88)
save('surf-stone-normal', normal_from_height(bake('Height', 512)[..., 0], 1.6), 88)
print('ok', sorted(f for f in os.listdir(OUT) if f.endswith('.jpg')))
