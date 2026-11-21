import { describe, expect, it } from "vitest";
import { colorEffectsOf, effectRgb, nearestColorEffect } from "./effect-light";

// Effect list of light.led_oficina (LED Infrared, generic 44-key remote)
const LED_44 = [
  "auto", "fade3", "fade7", "flash", "jump3", "jump7", "diy1", "diy2", "diy3", "diy4", "diy5", "diy6",
  "red", "green", "blue", "white", "tomato", "light_green", "deep_blue", "floral_white", "orange",
  "turquoise", "purple", "lavender_blush", "yellowish", "cyan", "magenta", "ghost_white", "yellow",
  "aqua", "pink", "light_cyan",
];

describe("colorEffectsOf", () => {
  it("keeps only the color keys", () => {
    expect(colorEffectsOf(LED_44)).toHaveLength(20);
    expect(colorEffectsOf(LED_44)).not.toContain("fade7");
  });
  it("finds none on lights whose effects are not colors", () => {
    expect(colorEffectsOf(["0", "1", "2"])).toEqual([]);
    expect(colorEffectsOf(undefined)).toEqual([]);
  });
});

describe("nearestColorEffect", () => {
  const colors = colorEffectsOf(LED_44);
  it.each([
    [[255, 255, 255], "white"],       // Blanco
    [[255, 180, 100], "floral_white"], // Cálido
    [[255, 0, 0], "red"],
    [[0, 255, 0], "green"],
    [[255, 255, 0], "yellow"],
    [[255, 50, 150], "pink"],          // Rosa
    [[150, 0, 255], "purple"],         // Morado
    [[255, 120, 0], "orange"],
    [[0, 255, 255], "cyan"],
  ] as const)("maps LightTile preset %j to %s", (rgb, effect) => {
    expect(nearestColorEffect([...rgb], colors)).toBe(effect);
  });
  it("only picks among the available effects", () => {
    expect(nearestColorEffect([0, 100, 255], ["red", "blue"])).toBe("blue");
    expect(nearestColorEffect([0, 100, 255], [])).toBeUndefined();
  });
  it("gives the swatch color of a color effect only", () => {
    expect(effectRgb("magenta")).toEqual([255, 0, 255]);
    expect(effectRgb("fade7")).toBeUndefined();
  });
});
