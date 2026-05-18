import { useState, useEffect } from "react";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import {
  Cloud, Droplets, Wind, Sun, Moon, CloudSun,
  CloudRain, CloudSnow, CloudLightning, CloudFog,
  AlertTriangle,
} from "lucide-react";
import type { ComponentType } from "react";

interface WeatherWidgetProps {
  entityId?: string;
}

const CONDITION_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  "clear-night": Moon,
  cloudy: Cloud,
  exceptional: AlertTriangle,
  fog: CloudFog,
  hail: CloudRain,
  lightning: CloudLightning,
  "lightning-rainy": CloudLightning,
  partlycloudy: CloudSun,
  pouring: CloudRain,
  rainy: CloudRain,
  snowy: CloudSnow,
  "snowy-rainy": CloudSnow,
  sunny: Sun,
  windy: Wind,
  "windy-variant": Wind,
};

const CONDITION_LABEL: Record<string, string> = {
  "clear-night": "Despejado",
  cloudy: "Nublado",
  exceptional: "Condiciones excepcionales",
  fog: "Neblina",
  hail: "Granizo",
  lightning: "Tormenta eléctrica",
  "lightning-rainy": "Tormenta con lluvia",
  partlycloudy: "Parcialmente nublado",
  pouring: "Lluvia intensa",
  rainy: "Lluvioso",
  snowy: "Nevando",
  "snowy-rainy": "Aguanieve",
  sunny: "Soleado",
  windy: "Ventoso",
  "windy-variant": "Ventoso",
};

const DAY_NAMES = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

function ConditionIcon({ condition, size = 18 }: { condition: string; size?: number }) {
  const Icon = CONDITION_ICONS[condition] ?? Cloud;
  return <Icon size={size} className="text-accent-blue" />;
}

interface ForecastEntry {
  datetime: string;
  temperature: number;
  templow?: number;
  condition: string;
  precipitation?: number;
  precipitation_probability?: number;
}

// Compare using local calendar date (not UTC string) to handle timezone offsets
function isSameLocalDay(dt: string, ref: Date): boolean {
  const d = new Date(dt);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function formatHour(dt: string): string {
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Temperature range bar (weekly) ────────────────────────────────────────────

function TempRangeBar({
  low, high, globalMin, globalMax,
}: {
  low: number; high: number; globalMin: number; globalMax: number;
}) {
  const range = globalMax - globalMin || 1;
  const leftPct = ((low - globalMin) / range) * 100;
  const widthPct = Math.max(((high - low) / range) * 100, 4);
  return (
    <div className="relative flex-1 mx-2 h-2 rounded-full bg-bg-tertiary">
      <div
        className="absolute top-0 h-2 rounded-full"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          background: "linear-gradient(to right, #60a5fa, #fbbf24)",
        }}
      />
    </div>
  );
}

// ── Hourly curve chart ────────────────────────────────────────────────────────

const COL_W = 56;
const CHART_H = 80;
const CHART_PAD_TOP = 22;
const CHART_PAD_BOT = 8;

// Row heights — must match what the per-column divs actually render
const ROW_TIME_H = 16;
const GAP_TIME_ICON = 6;
const ROW_ICON_H = 20;
const GAP_ICON_CURVE = 6;
const SVG_TOP = ROW_TIME_H + GAP_TIME_ICON + ROW_ICON_H + GAP_ICON_CURVE;

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

// Open-Meteo maps WMO codes without considering time-of-day.
// Apply night correction so "sunny" doesn't show at 2am.
function nightAwareCondition(condition: string, dt: string): string {
  const h = new Date(dt).getHours();
  if ((h < 7 || h >= 20) && condition === "sunny") return "clear-night";
  return condition;
}

function HourlySection({ entries }: { entries: ForecastEntry[] }) {
  if (entries.length === 0) return null;

  const temps = entries.map((e) => e.temperature);
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const tRange = maxT - minT || 1;
  const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOT;
  const toY = (t: number) => CHART_PAD_TOP + (1 - (t - minT) / tRange) * innerH;
  const totalW = entries.length * COL_W;
  const pts = entries.map((e, i) => ({ x: i * COL_W + COL_W / 2, y: toY(e.temperature) }));

  return (
    // Per-column layout: each entry is ONE column div containing time + icon +
    // spacer (where the SVG will sit) + precip. The SVG is absolutely overlaid
    // at exactly SVG_TOP px from the top, matching the spacer position in every column.
    <div style={{ position: "relative", width: totalW }}>
      <div style={{ display: "flex" }}>
        {entries.map((e) => {
          const prob = e.precipitation_probability;
          const mm = e.precipitation;
          const precipLabel =
            prob !== undefined ? `${prob}%`
            : mm !== undefined && mm > 0 ? `${mm}mm`
            : null;

          return (
            <div key={e.datetime} style={{ width: COL_W, flexShrink: 0 }}>
              {/* Time — fixed height keeps rows consistent */}
              <div
                style={{ height: ROW_TIME_H, lineHeight: `${ROW_TIME_H}px` }}
                className="text-center text-[11px] text-text-secondary overflow-hidden"
              >
                {formatHour(e.datetime)}
              </div>

              {/* Gap */}
              <div style={{ height: GAP_TIME_ICON }} />

              {/* Icon — fixed height */}
              <div
                style={{ height: ROW_ICON_H }}
                className="flex justify-center items-center"
              >
                <ConditionIcon condition={nightAwareCondition(e.condition, e.datetime)} size={16} />
              </div>

              {/* Spacer: reserves space for SVG (curve + gap above + gap below) */}
              <div style={{ height: GAP_ICON_CURVE + CHART_H + 4 }} />

              {/* Precipitation */}
              <div className="flex items-center justify-center gap-0.5 text-[11px] text-text-secondary">
                {precipLabel !== null ? (
                  <>
                    <Droplets size={10} className="text-accent-blue shrink-0" />
                    {precipLabel}
                  </>
                ) : (
                  <span className="opacity-25">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG curve — absolutely positioned at exactly SVG_TOP, perfectly
          aligned with COL_W columns above/below */}
      {entries.length >= 2 && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={totalW}
          height={CHART_H}
          style={{ position: "absolute", top: SVG_TOP, left: 0, display: "block" }}
        >
          <path
            d={smoothPath(pts)}
            stroke="#60a5fa"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" fill="#60a5fa" />
              <text
                x={p.x}
                y={p.y - 7}
                textAnchor="middle"
                fill="white"
                fillOpacity="0.9"
                fontSize="11"
                fontWeight="500"
              >
                {Math.round(temps[i])}°
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── Data hooks ────────────────────────────────────────────────────────────────

function useWeatherForecast(
  entityId: string,
  type: "daily" | "hourly",
  refreshKey: number
): ForecastEntry[] {
  const connection = useHAStore((s) => s.connection);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;

    async function doFetch() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (connection as any).sendMessagePromise({
          type: "call_service",
          domain: "weather",
          service: "get_forecasts",
          service_data: { type },
          target: { entity_id: entityId },
          return_response: true,
        });
        const entries: ForecastEntry[] = result?.response?.[entityId]?.forecast ?? [];
        if (!cancelled && entries.length > 0) setForecast(entries);
      } catch (err) {
        console.error(`[WeatherWidget] get_forecasts (${type}) failed:`, err);
      }
    }

    doFetch();
    return () => { cancelled = true; };
  }, [connection, entityId, type, refreshKey]);

  return forecast;
}

function useDailyRefresh(hour: number): number {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    const timeout = setTimeout(() => setKey((k) => k + 1), next.getTime() - now.getTime());
    const interval = setInterval(() => setKey((k) => k + 1), 24 * 60 * 60 * 1000);

    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [hour]);

  return key;
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function WeatherWidget({ entityId = "weather.forecast_home" }: WeatherWidgetProps) {
  const { entity, loading } = useEntity(entityId);
  const refreshKey = useDailyRefresh(7);
  const dailyForecast = useWeatherForecast(entityId, "daily", refreshKey);
  const hourlyForecast = useWeatherForecast(entityId, "hourly", refreshKey);

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-28 rounded bg-gray-600" />
        <div className="h-8 w-20 rounded bg-gray-600" />
        <div className="h-28 rounded bg-gray-600" />
      </div>
    );
  }

  const state = entity?.state;
  const temp = entity?.attributes?.temperature as number | undefined;
  const humidity = entity?.attributes?.humidity as number | undefined;
  const windSpeed = entity?.attributes?.wind_speed as number | undefined;
  const condition = entity?.attributes?.condition as string | undefined;
  const attribution = entity?.attributes?.attribution as string | undefined;
  const friendlyName = entity?.attributes?.friendly_name as string | undefined;
  // Some integrations expose location_name or city
  const locationName = (entity?.attributes?.location_name ?? entity?.attributes?.city ?? entity?.attributes?.location) as string | undefined;

  // Readable label: prefer explicit location, then friendly name, then format entity ID
  const entitySlug = entityId.split(".").pop()?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? entityId;
  const sourceLabel = locationName ?? friendlyName ?? entitySlug;

  const attrForecast = (entity?.attributes?.forecast ?? []) as ForecastEntry[];
  const resolvedDaily = dailyForecast.length > 0 ? dailyForecast : attrForecast;

  const now = new Date();

  // Today's high/low from daily forecast
  const todayDaily = resolvedDaily.find((e) => isSameLocalDay(e.datetime, now));

  // Next 12 hourly entries from now — no same-day restriction so we always
  // have enough points for the curve even when close to midnight
  const hourlyToday = hourlyForecast
    .filter((e) => new Date(e.datetime) > now)
    .slice(0, 12);

  // Weekly: future days only
  const weekEntries = resolvedDaily.filter((e) => !isSameLocalDay(e.datetime, now));

  const globalMin = weekEntries.length > 0
    ? Math.min(...weekEntries.map((e) => e.templow ?? e.temperature))
    : 0;
  const globalMax = weekEntries.length > 0
    ? Math.max(...weekEntries.map((e) => e.temperature))
    : 1;

  const condLabel = CONDITION_LABEL[condition ?? ""] ?? condition ?? "";
  const highLabel = todayDaily?.temperature !== undefined ? `Máx. ${Math.round(todayDaily.temperature)}°` : "";
  const lowLabel = todayDaily?.templow !== undefined ? `Mín. ${Math.round(todayDaily.templow)}°` : "";
  const summary = [condLabel, [highLabel, lowLabel].filter(Boolean).join(" / ")].filter(Boolean).join(". ");

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud size={22} className="text-accent-blue" />
          <h3 className="text-text-primary font-semibold">Clima</h3>
        </div>
        <span className="text-sm text-text-secondary capitalize flex items-center gap-1.5">
          {condition && <ConditionIcon condition={condition} size={16} />}
          {condition ?? state}
        </span>
      </div>

      {/* Current conditions */}
      <div className="flex items-end gap-4 mb-5 pb-5 border-b border-border-main">
        <div className="flex items-center gap-3">
          {condition && <ConditionIcon condition={condition} size={36} />}
          <p className="text-4xl font-semibold text-text-primary">{temp ?? "--"}°</p>
        </div>
        <div className="flex gap-3 text-sm text-text-secondary ml-auto">
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

      {/* Today + Weekly side by side */}
      <div className="flex gap-0 items-start">
        {/* Left: today hourly */}
        <div className="flex-1 min-w-0 pr-4 border-r border-border-main">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-2">
            Próximas horas
            <span className="normal-case font-normal opacity-50 text-[10px]">
              {hourlyToday.length > 0 ? `${hourlyToday.length} entradas` : "sin datos"}
            </span>
          </h4>
          {summary && (
            <p className="text-[11px] text-text-secondary mb-3 leading-snug">{summary}</p>
          )}
          {hourlyToday.length > 0 ? (
            <div className="overflow-x-auto">
              <HourlySection entries={hourlyToday} />
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              {condition && <ConditionIcon condition={condition} size={28} />}
              <span className="text-2xl font-semibold text-text-primary">{temp ?? "--"}°</span>
            </div>
          )}
        </div>

        {/* Right: weekly */}
        <div className="pl-4 shrink-0">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Semana
          </h4>
          {weekEntries.length > 0 ? (
            <div className="space-y-2">
              {weekEntries.map((entry) => {
                const low = entry.templow ?? entry.temperature;
                const high = entry.temperature;
                return (
                  <div key={entry.datetime} className="flex items-center gap-2 text-sm">
                    <span className="w-8 font-medium text-text-secondary text-xs">
                      {DAY_NAMES[new Date(entry.datetime).getDay()]}
                    </span>
                    <ConditionIcon condition={entry.condition} size={15} />
                    <span className="text-text-secondary tabular-nums w-7 text-right text-xs">
                      {Math.round(low)}°
                    </span>
                    <TempRangeBar low={low} high={high} globalMin={globalMin} globalMax={globalMax} />
                    <span className="text-text-primary font-medium tabular-nums w-7 text-xs">
                      {Math.round(high)}°
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">No disponible</p>
          )}
        </div>
      </div>

      {/* Source / location info */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-text-secondary opacity-60">
        {attribution && <span>{attribution}</span>}
        {attribution && <span>·</span>}
        <span>{sourceLabel}</span>
      </div>
    </div>
  );
}
