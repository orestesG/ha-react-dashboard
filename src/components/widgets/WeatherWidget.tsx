import { useEntity } from "../../hooks/useEntity";
import { Cloud, Droplets, Wind } from "lucide-react";

interface WeatherWidgetProps {
  entityId?: string;
}

export function WeatherWidget({ entityId = "weather.forecast_home" }: WeatherWidgetProps) {
  const { entity, loading } = useEntity(entityId);

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary animate-pulse space-y-3">
        <div className="h-6 w-32 rounded bg-gray-600" />
        <div className="h-8 w-20 rounded bg-gray-600" />
      </div>
    );
  }

  const state = entity?.state;
  const temp = entity?.attributes?.temperature as number | undefined;
  const humidity = entity?.attributes?.humidity as number | undefined;
  const windSpeed = entity?.attributes?.wind_speed as number | undefined;
  const condition = entity?.attributes?.condition as string | undefined;

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cloud size={22} className="text-accent-blue" />
          <h3 className="text-white font-semibold">Clima</h3>
        </div>
        <span className="text-sm text-gray-400 capitalize">{condition ?? state}</span>
      </div>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-4xl font-semibold text-white">{temp ?? "—"}°</p>
        </div>
        <div className="flex gap-3 text-sm text-gray-400 ml-auto">
          {humidity !== undefined && (
            <span className="flex items-center gap-1">
              <Droplets size={14} /> {humidity}%
            </span>
          )}
          {windSpeed !== undefined && (
            <span className="flex items-center gap-1">
              <Wind size={14} /> {windSpeed} km/h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
