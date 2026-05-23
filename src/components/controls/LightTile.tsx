import { useState, useRef, useCallback, useEffect } from "react";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Tile } from "../ui/Tile";
import { FavoriteStar } from "../ui/FavoriteStar";
import { Lightbulb, Sun, Moon, Palette } from "lucide-react";

interface LightTileProps {
  entityId: string;
  name: string;
}

const PRESET_COLORS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Blanco", rgb: [255, 255, 255] },
  { name: "Cálido", rgb: [255, 180, 100] },
  { name: "Rojo", rgb: [255, 0, 0] },
  { name: "Verde", rgb: [0, 255, 0] },
  { name: "Azul", rgb: [0, 100, 255] },
  { name: "Amarillo", rgb: [255, 255, 0] },
  { name: "Rosa", rgb: [255, 50, 150] },
  { name: "Morado", rgb: [150, 0, 255] },
  { name: "Naranja", rgb: [255, 120, 0] },
  { name: "Cian", rgb: [0, 255, 255] },
];

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

export function LightTile({ entityId, name }: LightTileProps) {
  const { isOn, toggle, attributes, loading } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);

  const brightness = attributes?.brightness as number | null | undefined;
  const rgbColor = attributes?.rgb_color as [number, number, number] | null | undefined;
  const supportedModes = attributes?.supported_color_modes as string[] | undefined;

  const supportsColor = supportedModes?.some((m) => ["hs", "rgb", "rgbw", "rgbww"].includes(m)) ?? false;

  const [localBrightness, setLocalBrightness] = useState<number>(brightness ?? 255);
  const [showColors, setShowColors] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce the "off" state: HA devices (especially Zigbee/Philips) briefly
  // report state=off + brightness=null as an intermediate transition state after
  // every turn_on call. Without this, the controls panel unmounts/remounts on
  // every brightness or color change.
  const [controlsVisible, setControlsVisible] = useState(isOn);
  const offDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOn) {
      if (offDebounceRef.current) {
        clearTimeout(offDebounceRef.current);
        offDebounceRef.current = null;
      }
      setControlsVisible(true);
    } else {
      offDebounceRef.current = setTimeout(() => {
        offDebounceRef.current = null;
        setControlsVisible(false);
      }, 400);
    }
    return () => {
      if (offDebounceRef.current) clearTimeout(offDebounceRef.current);
    };
  }, [isOn]);

  useEffect(() => {
    // HA sends brightness=null as intermediate state during transitions — ignore it.
    if (brightness != null) {
      setLocalBrightness(brightness);
    }
  }, [brightness]);

  const sendBrightness = useCallback(
    (value: number) => {
      if (!connection) return;
      callService(connection, "light", "turn_on", { brightness: value }, { entity_id: entityId });
    },
    [connection, entityId]
  );

  const handleBrightnessChange = useCallback(
    (value: number) => {
      setLocalBrightness(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        sendBrightness(value);
      }, 250);
    },
    [sendBrightness]
  );

  const setColor = useCallback(
    async (rgb: [number, number, number]) => {
      if (!connection) return;
      await callService(connection, "light", "turn_on", { rgb_color: rgb }, { entity_id: entityId });
    },
    [connection, entityId]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-bg-tertiary animate-pulse">
        <div className="w-6 h-6 rounded bg-gray-600" />
        <div className="h-4 w-20 rounded bg-gray-600" />
      </div>
    );
  }

  const brightnessPct = Math.round(((localBrightness ?? 255) / 255) * 100);
  const currentRgb = rgbColor ?? [255, 255, 255];

  const handleTileClick = () => {
    // Cancel any pending brightness debounce and the off-debounce so the UI
    // reacts immediately when the user deliberately toggles the light.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (offDebounceRef.current) clearTimeout(offDebounceRef.current);
    offDebounceRef.current = null;
    setControlsVisible(!isOn); // show/hide immediately on intentional click
    toggle();
  };

  return (
    <>
      <div className="relative">
        <Tile
          icon={<Lightbulb size={20} />}
          name={name}
          state={isOn ? `${brightnessPct}%` : "Apagado"}
          active={isOn}
          color={isOn ? "accent-yellow" : "accent-blue"}
          onClick={handleTileClick}
        />
        <FavoriteStar entityId={entityId} className="absolute top-2 right-2 z-10" />
      </div>
      {controlsVisible && (
        <div className="bg-bg-tertiary rounded-b-xl px-4 py-3 -mt-1 space-y-3">
          <div className="flex items-center gap-2">
            <Moon size={14} className="text-text-secondary shrink-0" />
            <input
              type="range"
              min={1}
              max={255}
              value={localBrightness}
              onChange={(e) => handleBrightnessChange(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-gray-700
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-yellow"
            />
            <Sun size={14} className="text-text-secondary shrink-0" />
            <span className="text-xs text-text-secondary w-8 text-right tabular-nums">{brightnessPct}%</span>
          </div>

          {supportsColor && (
            <div>
              <button
                onClick={() => setShowColors(!showColors)}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <Palette size={14} />
                {showColors ? "Ocultar colores" : "Cambiar color"}
                <span
                  className="inline-block w-3 h-3 rounded-full border border-white/20 ml-1"
                  style={{ backgroundColor: rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2]) }}
                />
              </button>
              {showColors && (
                <div className="mt-2">
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {PRESET_COLORS.map((c) => {
                      const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                      const isActive =
                        rgbColor != null &&
                        Math.abs(rgbColor[0] - c.rgb[0]) < 15 &&
                        Math.abs(rgbColor[1] - c.rgb[1]) < 15 &&
                        Math.abs(rgbColor[2] - c.rgb[2]) < 15;
                      return (
                        <button
                          key={c.name}
                          onClick={() => setColor(c.rgb)}
                          title={c.name}
                          className={`w-full aspect-square rounded-lg border-2 transition-all active:scale-90 ${
                            isActive ? "border-white scale-110" : "border-transparent hover:border-white/50"
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2])}
                      onChange={(e) => {
                        const rgb = hexToRgb(e.target.value);
                        if (rgb) setColor(rgb);
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
                    />
                    <span className="text-xs text-text-secondary">Personalizado</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
