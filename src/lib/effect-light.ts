// IR lights (LED Infrared integration) have no rgb color mode: the remote's
// color keys are exposed as named effects ("red", "deep_blue"…). LightTile
// sends its color presets/picker to the nearest of those effects.

type Rgb = [number, number, number];

// Approximate color the strip shows for each color key of the generic IR remotes.
const EFFECT_COLORS: Record<string, Rgb> = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  white: [255, 255, 255],
  tomato: [255, 69, 0],
  light_green: [64, 255, 128],
  deep_blue: [0, 80, 255],
  floral_white: [255, 216, 168],
  orange: [255, 128, 0],
  turquoise: [0, 224, 192],
  purple: [128, 0, 255],
  lavender_blush: [255, 200, 220],
  yellowish: [255, 192, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  ghost_white: [200, 220, 255],
  yellow: [255, 255, 0],
  aqua: [0, 160, 255],
  pink: [255, 96, 176],
  light_cyan: [180, 240, 255],
};

/** Effects of the list that are known colors. */
export function colorEffectsOf(effectList: string[] | undefined): string[] {
  return (effectList ?? []).filter((e) => e in EFFECT_COLORS);
}

export function effectRgb(effect: string | null | undefined): Rgb | undefined {
  return effect ? EFFECT_COLORS[effect] : undefined;
}

/** Closest color effect (euclidean RGB) among `available`. */
export function nearestColorEffect(rgb: Rgb, available: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const effect of available) {
    const c = EFFECT_COLORS[effect];
    if (!c) continue;
    const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = effect;
    }
  }
  return best;
}
