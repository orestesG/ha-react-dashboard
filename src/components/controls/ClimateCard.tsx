import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { FavoriteStar } from "../ui/FavoriteStar";
import { SegmentDisplayIcon } from "../ui/SegmentDisplayIcon";
import { Thermometer, Plus, Minus, Fan } from "lucide-react";

interface ClimateCardProps {
  entityId: string;
  name: string;
  /** script.* de HA que invierte la luz del display (la lógica vive en HA, así también la usa el asistente de voz) */
  displayScriptId?: string;
  /** input_boolean.* que recuerda si el display está apagado */
  displayOffEntityId?: string;
}

const MODES: { value: string; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "auto", label: "Auto" },
  { value: "heat", label: "Heat" },
  { value: "cool", label: "Cool" },
  { value: "dry", label: "Dry" },
  { value: "fan_only", label: "Fan" },
];

const FAN_LABELS: Record<string, string> = {
  auto: "Auto",
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

// Cuanto más rápida la velocidad, más rápido gira el aspa (auto queda quieta)
const FAN_SPIN: Record<string, string> = {
  low: "animate-spin [animation-duration:3s]",
  medium: "animate-spin [animation-duration:1.5s]",
  high: "animate-spin [animation-duration:0.6s]",
};

export function ClimateCard({ entityId, name, displayScriptId, displayOffEntityId }: ClimateCardProps) {
  const { entity, loading } = useEntity(entityId);
  const displayOffResult = useEntity(displayOffEntityId ?? "");
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const currentTemp = entity?.attributes?.current_temperature as number | null | undefined;
  const targetTemp = entity?.attributes?.temperature as number | null | undefined;
  const hvacModes = entity?.attributes?.hvac_modes as string[] | null | undefined;
  const tempStep = (entity?.attributes?.target_temp_step as number | undefined) ?? 1;
  const minTemp  = (entity?.attributes?.min_temp as number | undefined) ?? 16;
  const maxTemp  = (entity?.attributes?.max_temp as number | undefined) ?? 30;

  const displayOn = displayOffResult.entity?.state !== "on";

  const isOff = state === "off";

  const fanModes = entity?.attributes?.fan_modes as string[] | null | undefined;
  const fanMode = entity?.attributes?.fan_mode as string | null | undefined;
  // En modo seco el aire fuerza ventilador automático: elegir velocidad no tiene efecto
  const showFan = !isOff && state !== "dry" && (fanModes?.length ?? 0) > 1;

  const setMode = async (mode: string) => {
    if (!connection) return;
    await callService(connection, "climate", "set_hvac_mode", { hvac_mode: mode }, { entity_id: entityId });
  };

  const setFan = async (mode: string) => {
    if (!connection) return;
    await callService(connection, "climate", "set_fan_mode", { fan_mode: mode }, { entity_id: entityId });
  };

  // Cada toque pasa a la siguiente velocidad de la lista (auto → baja → media → alta → auto)
  const cycleFan = () => {
    if (!fanModes?.length) return;
    const i = fanMode ? fanModes.indexOf(fanMode) : -1;
    void setFan(fanModes[(i + 1) % fanModes.length]);
  };

  const setTemp = async (temp: number) => {
    if (!connection) return;
    await callService(connection, "climate", "set_temperature", { temperature: temp }, { entity_id: entityId });
  };

  const toggleDisplay = async () => {
    if (!connection || !displayScriptId) return;
    await callService(connection, "script", "turn_on", undefined, { entity_id: displayScriptId });
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded-lg bg-bg-secondary" />
        <div className="h-10 w-20 rounded-xl bg-bg-secondary" />
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer size={18} className={isOff ? "text-text-secondary" : "text-accent-orange"} />
          <span className="text-sm font-medium text-text-primary">{name}</span>
        </div>
        <div className="flex items-center gap-1">
          <FavoriteStar entityId={entityId} />
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${isOff ? "bg-bg-secondary text-text-secondary" : "bg-accent-orange/20 text-accent-orange"}`}>
            {isOff ? "Off" : state?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <p className="text-3xl font-semibold text-text-primary">
            {currentTemp?.toFixed(1) ?? "—"}°
          </p>
          <p className="text-xs text-text-secondary">Actual</p>
        </div>
        {targetTemp != null && (
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTemp(Math.max(minTemp, targetTemp - tempStep))}
                disabled={targetTemp <= minTemp}
                className="w-11 h-11 rounded-xl bg-bg-secondary text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span className="text-xl font-medium text-text-primary w-14 text-center">
                {Number.isInteger(targetTemp) ? `${targetTemp}°` : `${targetTemp.toFixed(1)}°`}
              </span>
              <button
                onClick={() => setTemp(Math.min(maxTemp, targetTemp + tempStep))}
                disabled={targetTemp >= maxTemp}
                className="w-11 h-11 rounded-xl bg-bg-secondary text-text-secondary hover:text-text-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="text-xs text-text-secondary">Objetivo</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(hvacModes ?? MODES.map(m => m.value)).filter(m => MODES.some(mm => mm.value === m)).map((mode) => {
          const m = MODES.find(mm => mm.value === mode);
          const isActive = state === mode;
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] flex items-center active:scale-95 ${
                isActive
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "bg-bg-secondary text-text-secondary hover:text-text-primary"
              }`}
            >
              {m?.label ?? mode}
            </button>
          );
        })}
        {(showFan || displayScriptId) && (
          <div className="ml-auto flex items-center gap-1.5">
            {showFan && (
              <button
                onClick={cycleFan}
                title={`Ventilador: ${FAN_LABELS[fanMode ?? ""] ?? fanMode ?? "—"} (tocá para cambiar)`}
                aria-label={`Ventilador ${FAN_LABELS[fanMode ?? ""] ?? fanMode ?? ""}`}
                className="min-h-[44px] w-11 rounded-xl flex items-center justify-center transition-all active:scale-95 bg-accent-orange/20 text-accent-orange"
              >
                <Fan size={20} className={`motion-reduce:animate-none ${FAN_SPIN[fanMode ?? ""] ?? ""}`} />
              </button>
            )}
            {displayScriptId && (
              <button
                onClick={toggleDisplay}
                title={displayOn ? "Luz del display encendida" : "Luz del display apagada"}
                className={`min-h-[44px] w-11 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  displayOn
                    ? "bg-accent-yellow/20 text-accent-yellow"
                    : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                }`}
              >
                <SegmentDisplayIcon size={16} />
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
