import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Thermometer, Plus, Minus } from "lucide-react";

interface ClimateCardProps {
  entityId: string;
  name: string;
}

const MODES: { value: string; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "auto", label: "Auto" },
  { value: "heat", label: "Heat" },
  { value: "cool", label: "Cool" },
  { value: "dry", label: "Dry" },
  { value: "fan_only", label: "Fan" },
];

export function ClimateCard({ entityId, name }: ClimateCardProps) {
  const { entity, loading } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const currentTemp = entity?.attributes?.current_temperature as number | null | undefined;
  const targetTemp = entity?.attributes?.temperature as number | null | undefined;
  const hvacModes = entity?.attributes?.hvac_modes as string[] | null | undefined;

  const isOff = state === "off";

  const setMode = async (mode: string) => {
    if (!connection) return;
    await callService(connection, "climate", "set_hvac_mode", { hvac_mode: mode }, { entity_id: entityId });
  };

  const setTemp = async (temp: number) => {
    if (!connection) return;
    await callService(connection, "climate", "set_temperature", { temperature: temp }, { entity_id: entityId });
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded bg-gray-600" />
        <div className="h-10 w-20 rounded bg-gray-600" />
      </div>
    );
  }

  return (
    <div className="bg-bg-tertiary rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Thermometer size={18} className={isOff ? "text-gray-500" : "text-accent-orange"} />
          <span className="text-sm font-medium text-white">{name}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOff ? "bg-gray-700 text-gray-400" : "bg-accent-orange/20 text-accent-orange"}`}>
          {isOff ? "Off" : state?.toUpperCase()}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <p className="text-3xl font-semibold text-white">
            {currentTemp?.toFixed(1) ?? "—"}°
          </p>
          <p className="text-xs text-gray-500">Actual</p>
        </div>
        {targetTemp != null && (
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTemp(targetTemp - 0.5)}
                className="w-7 h-7 rounded-lg bg-bg-secondary text-gray-400 hover:text-white flex items-center justify-center"
              >
                <Minus size={14} />
              </button>
              <span className="text-xl font-medium text-white w-14 text-center">{targetTemp.toFixed(1)}°</span>
              <button
                onClick={() => setTemp(targetTemp + 0.5)}
                className="w-7 h-7 rounded-lg bg-bg-secondary text-gray-400 hover:text-white flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-500">Objetivo</p>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(hvacModes ?? MODES.map(m => m.value)).filter(m => MODES.some(mm => mm.value === m)).map((mode) => {
          const m = MODES.find(mm => mm.value === mode);
          const isActive = state === mode;
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "bg-bg-secondary text-gray-500 hover:text-gray-300"
              }`}
            >
              {m?.label ?? mode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
