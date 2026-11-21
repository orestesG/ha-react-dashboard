"""Renders the fixed view of the Plano 3D with Blender (Cycles).

    blender --background --factory-startup --python scripts/render_floorplan.py -- <floorplan.glb> <outdir> [pass,pass…]

The GLB comes from the dev dashboard (`await __floorplanScene.exportGLB()`): the same model the browser
draws, with its camera (`StillCamera`) and named lamps. One image per pass:

    day.webp / night.webp   the flat lit by the sun / by a faint moonlight, on a transparent background
    light-<device>.jpg      only what that lamp adds, on black: the dashboard tints it and adds it on top

Passes can be limited with the last argument (e.g. `day,living-luz`).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT = ARGS[0], ARGS[1]
ONLY = set(ARGS[2].split(',')) if len(ARGS) > 2 else None
os.makedirs(OUT, exist_ok=True)

WIDTH, HEIGHT = 1600, 1000
SAMPLES_BASE, SAMPLES_LIGHT = 192, 128
# Lamp powers (W, Blender units), tuned against the exposure below
ROOM_LAMP, STRIP_LAMP, COVE_BULB = 110, 28, 30
EXPOSURE = 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scene = bpy.context.scene
scene.camera = next(o for o in scene.objects if o.type == 'CAMERA')

r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y, r.resolution_percentage = WIDTH, HEIGHT, 100
c = scene.cycles
c.use_denoising = True
c.max_bounces = 6
c.sample_clamp_indirect = 8
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
    except Exception:
        continue
    if any(d.type == kind for d in prefs.devices):
        for d in prefs.devices:
            d.use = d.type == kind
        c.device = 'GPU'
        break
try:
    scene.view_settings.view_transform = 'AgX'
except TypeError:
    scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = EXPOSURE
try:
    scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError:
    pass

world = bpy.data.worlds.new('world')
world.use_nodes = True
scene.world = world
background = world.node_tree.nodes['Background']


# ── Materials ─────────────────────────────────────────────────────────────────
def glass(mat):
    """Window panes: almost clear, with a faint reflection, and they let the light through."""
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    mix = nt.nodes.new('ShaderNodeMixShader')
    clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    gloss = nt.nodes.new('ShaderNodeBsdfGlossy')
    gloss.inputs['Roughness'].default_value = 0.03
    clear.inputs['Color'].default_value = (0.93, 0.97, 1, 1)
    mix.inputs['Fac'].default_value = 0.07
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(gloss.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])


for mat in bpy.data.materials:
    if mat.name.split('.')[0] == 'glass':
        glass(mat)


def principled(obj):
    for slot in obj.material_slots:
        if slot.material and slot.material.node_tree:
            for node in slot.material.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    return node
    return None


def set_glow(objs, strength):
    for obj in objs:
        node = principled(obj)
        if node:
            node.inputs['Emission Color'].default_value = (1, 1, 1, 1)
            node.inputs['Emission Strength'].default_value = strength


# ── Ground: only catches the shadow of the building ───────────────────────────
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.02))
ground = bpy.context.active_object
ground.is_shadow_catcher = True

# ── Sun (day) and moon (night) share a direction: the one the browser scene uses ──
sun_data = bpy.data.lights.new('sun', 'SUN')
sun = bpy.data.objects.new('sun', sun_data)
scene.collection.objects.link(sun)
# three.js (-7, 11, 6) → Blender (x, -z, y)
sun.rotation_euler = Vector((-7, -6, 11)).to_track_quat('Z', 'Y').to_euler()


# ── Lamps ─────────────────────────────────────────────────────────────────────
def add_light(name, kind, location, power, **props):
    data = bpy.data.lights.new(name, kind)
    data.energy = power
    for key, value in props.items():
        setattr(data, key, value)
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    scene.collection.objects.link(obj)
    return obj


lamps = {}   # device id → {'lights': [...], 'meshes': [...]}
for obj in list(scene.objects):
    if obj.type != 'MESH' or ':' not in obj.name:
        continue
    kind, device = obj.name.split(':')[:2]
    device = device.split('.')[0]
    if kind not in ('lamp', 'bulb'):
        continue
    entry = lamps.setdefault(device, {'lights': [], 'meshes': []})
    entry['meshes'].append(obj)
    x, y, z = obj.matrix_world.translation
    if kind == 'bulb':
        # Recessed downlight: a cone that also grazes the wall beside it
        entry['lights'].append(add_light(obj.name + '.light', 'SPOT', (x, y, z - 0.04), COVE_BULB,
                                         spot_size=math.radians(115), spot_blend=0.7, shadow_soft_size=0.04))
    elif obj.dimensions.z > 0.08:
        # Pendant lamp. The walls are cut at half height, so the source hangs below the cut to stay in its room
        entry['lights'].append(add_light(obj.name + '.light', 'POINT', (x, y, 1.05), ROOM_LAMP, shadow_soft_size=0.12))
    else:
        entry['lights'].append(add_light(obj.name + '.light', 'POINT', (x, y, min(z, 1.0) - 0.06), STRIP_LAMP, shadow_soft_size=0.08))

all_lights = [light for entry in lamps.values() for light in entry['lights']]


def render(name, fmt, samples, transparent):
    c.samples = samples
    r.film_transparent = transparent
    settings = r.image_settings
    if hasattr(settings, 'media_type'):
        settings.media_type = 'IMAGE'
    settings.file_format = fmt
    settings.color_mode = 'RGBA' if transparent else 'RGB'
    settings.quality = 86 if fmt == 'WEBP' else 84
    r.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('rendered', name, flush=True)


def base(name, sky, sky_strength, sun_strength, sun_color, sun_angle):
    if ONLY and name not in ONLY:
        return
    background.inputs['Color'].default_value = (*sky, 1)
    background.inputs['Strength'].default_value = sky_strength
    sun_data.energy = sun_strength
    sun_data.color = sun_color
    sun_data.angle = math.radians(sun_angle)
    sun.hide_render = False
    ground.hide_render = False
    for light in all_lights:
        light.hide_render = True
    for entry in lamps.values():
        set_glow(entry['meshes'], 0)
    render(name, 'WEBP', SAMPLES_BASE, True)


base('day', (0.78, 0.87, 1.0), 0.9, 3.2, (1.0, 0.93, 0.82), 3)
base('night', (0.10, 0.16, 0.40), 0.35, 0.3, (0.55, 0.66, 1.0), 6)

# ── One pass per lamp: black world, nothing else lit ──────────────────────────
background.inputs['Strength'].default_value = 0
sun.hide_render = True
ground.hide_render = True
for device, entry in sorted(lamps.items()):
    if ONLY and device not in ONLY:
        continue
    for light in all_lights:
        light.hide_render = light not in entry['lights']
    for other in lamps.values():
        set_glow(other['meshes'], 0)
    set_glow(entry['meshes'], 6)
    render('light-' + device, 'JPEG', SAMPLES_LIGHT, False)

print('ok', sorted(os.listdir(OUT)))
