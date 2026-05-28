import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Bot, Play, Pause, Home, Maximize2, X, Settings2, Sparkles, Wind, Calendar, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import {
  VACUUM_CLEANING_MODE_ENTITY,
  VACUUM_SUCTION_LEVEL_ENTITY,
  VACUUM_WATER_VOLUME_ENTITY,
} from "../../dashboard.config";

const SCHEDULE_ENTITY = "schedule.limpieza_robot";
import { VacuumMap } from "../widgets/VacuumMap";

const MAP_ENTITY    = "camera.xiaomi_robot_vacuum_x20_map";
const PRESETS_LS_KEY = "vacuum-presets-v1";
const VIEW_LS_KEY    = "vacuum-view-v1";

const ZOOM_STEPS = [0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3] as const;
type RotDeg = 0 | 90 | 180 | 270;

interface VacuumCardProps {
  entityId: string;
  name?: string;
}

interface PresetConfig {
  mode: string;
  suction: string;
  water: string;
}

interface PresetsState {
  full: PresetConfig;
  sweep: PresetConfig;
}

const DEFAULT_PRESETS: PresetsState = {
  full:  { mode: "mopping_after_sweeping", suction: "standard", water: "" },
  sweep: { mode: "sweeping",               suction: "standard", water: "" },
};

function loadPresets(): PresetsState {
  try {
    const raw = localStorage.getItem(PRESETS_LS_KEY);
    if (raw) return { ...DEFAULT_PRESETS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PRESETS;
}

function pickClosest(want: string, options: string[]): string {
  if (!want || options.length === 0) return options[0] ?? "";
  const lower = want.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const partial = options.find((o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase()));
  return partial ?? options[0];
}

function Chips({ options, current, onSelect }: { options: string[]; current: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = opt === current;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${
              active
                ? "bg-accent-blue/20 text-accent-blue"
                : "bg-bg-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function VacuumCard({ entityId, name = "Robot" }: VacuumCardProps) {
  const { entity, loading } = useEntity(entityId);
  const { entity: modeEnt } = useEntity(VACUUM_CLEANING_MODE_ENTITY);
  const { entity: suctionEnt } = useEntity(VACUUM_SUCTION_LEVEL_ENTITY);
  const { entity: waterEnt } = useEntity(VACUUM_WATER_VOLUME_ENTITY);
  const { entity: scheduleEnt } = useEntity(SCHEDULE_ENTITY);
  const connection = useHAStore((s) => s.connection);

  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [expandedPreset, setExpandedPreset] = useState<"full" | "sweep" | null>(null);
  const [presets, setPresets] = useState<PresetsState>(loadPresets);

  // View preferences — persisted
  const [mapRotation, setMapRotation] = useState<RotDeg>(() => {
    try { return (JSON.parse(localStorage.getItem(VIEW_LS_KEY) ?? "{}").rotation ?? 0) as RotDeg; } catch { return 0; }
  });
  const [mapZoom, setMapZoom] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(VIEW_LS_KEY) ?? "{}").zoom ?? 1; } catch { return 1; }
  });
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try { localStorage.setItem(PRESETS_LS_KEY, JSON.stringify(presets)); } catch { /* ignore */ }
  }, [presets]);

  useEffect(() => {
    try { localStorage.setItem(VIEW_LS_KEY, JSON.stringify({ rotation: mapRotation, zoom: mapZoom })); } catch { /* ignore */ }
  }, [mapRotation, mapZoom]);

  const rotateCW  = () => { setMapRotation(r => ((r + 90)  % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const rotateCCW = () => { setMapRotation(r => ((r - 90 + 360) % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const zoomIn    = () => setMapZoom(z => { const i = ZOOM_STEPS.indexOf(z as typeof ZOOM_STEPS[number]); return i < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[i + 1] : z; });
  const zoomOut   = () => setMapZoom(z => { const i = ZOOM_STEPS.indexOf(z as typeof ZOOM_STEPS[number]); return i > 0 ? ZOOM_STEPS[i - 1] : z; });

  const state = entity?.state;
  const battery = entity?.attributes?.battery as number | undefined;
  const status = entity?.attributes?.status as string | undefined;

  const modeOptions = (modeEnt?.attributes?.options as string[] | undefined) ?? [];
  const suctionOptions = (suctionEnt?.attributes?.options as string[] | undefined) ?? [];
  const waterOptions = (waterEnt?.attributes?.options as string[] | undefined) ?? [];

  const nextEvent = scheduleEnt?.attributes?.next_event as string | undefined;
  const nextEventLabel = (() => {
    if (!nextEvent) return null;
    try {
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Buenos_Aires",
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(nextEvent));
    } catch { return null; }
  })();

  const isCleaning = state === "cleaning";
  const isDocked = state === "docked";

  const start = () => connection && callService(connection, "vacuum", "start", undefined, { entity_id: entityId });
  const pause = () => connection && callService(connection, "vacuum", "pause", undefined, { entity_id: entityId });
  const dock = () => connection && callService(connection, "vacuum", "return_to_base", undefined, { entity_id: entityId });
  const setSelect = (selectEntityId: string, option: string) =>
    callService(connection!, "select", "select_option", { option }, { entity_id: selectEntityId });

  const runPreset = async (preset: PresetConfig) => {
    if (!connection) return;
    const mode = pickClosest(preset.mode, modeOptions);
    const suction = pickClosest(preset.suction, suctionOptions);
    const water = preset.water ? pickClosest(preset.water, waterOptions) : "";
    try {
      if (mode) await setSelect(VACUUM_CLEANING_MODE_ENTITY, mode);
      if (suction) await setSelect(VACUUM_SUCTION_LEVEL_ENTITY, suction);
      if (water) await setSelect(VACUUM_WATER_VOLUME_ENTITY, water);
      await callService(connection, "vacuum", "start", undefined, { entity_id: entityId });
    } catch (err) {
      console.error("Vacuum preset failed", err);
    }
  };

  const updatePreset = (key: "full" | "sweep", patch: Partial<PresetConfig>) => {
    setPresets((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const launchRoomClean = (segmentId: number, options: { suction?: string; repeats: number }) => {
    if (!connection) return;
    const data: Record<string, unknown> = { segments: segmentId, repeats: options.repeats };
    if (options.suction) data.suction_level = options.suction;
    callService(connection, "dreame_vacuum", "vacuum_clean_segment", data, { entity_id: entityId });
    setSelectedRoom(null);
  };

  const toggleRoom = (id: number) => setSelectedRoom(selectedRoom === id ? null : id);

  const batteryColor =
    battery == null ? "text-text-secondary"
    : battery < 20 ? "text-accent-red"
    : battery < 50 ? "text-accent-yellow"
    : "text-accent-green";

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded bg-gray-600" />
        <div className="h-32 w-full rounded bg-gray-600" />
      </div>
    );
  }

  const renderPresetSettings = (key: "full" | "sweep") => {
    const cfg = presets[key];
    const wantsWater = key === "full";
    return (
      <div className="mt-2 p-2.5 rounded-lg bg-bg-tertiary space-y-2">
        {modeOptions.length > 0 && (
          <div>
            <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Modo</p>
            <Chips
              options={modeOptions}
              current={pickClosest(cfg.mode, modeOptions)}
              onSelect={(v) => updatePreset(key, { mode: v })}
            />
          </div>
        )}
        {suctionOptions.length > 0 && (
          <div>
            <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Succión</p>
            <Chips
              options={suctionOptions}
              current={pickClosest(cfg.suction, suctionOptions)}
              onSelect={(v) => updatePreset(key, { suction: v })}
            />
          </div>
        )}
        {wantsWater && waterOptions.length > 0 && (
          <div>
            <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Agua</p>
            <Chips
              options={waterOptions}
              current={pickClosest(cfg.water, waterOptions)}
              onSelect={(v) => updatePreset(key, { water: v })}
            />
          </div>
        )}
      </div>
    );
  };

  const PresetRow = ({
    presetKey,
    icon,
    label,
  }: {
    presetKey: "full" | "sweep";
    icon: React.ReactNode;
    label: string;
  }) => {
    const expanded = expandedPreset === presetKey;
    return (
      <div>
        <div className="flex gap-1.5">
          <button
            onClick={() => runPreset(presets[presetKey])}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-accent-blue/10 hover:text-accent-blue transition-all"
          >
            {icon}
            <span className="text-left">{label}</span>
          </button>
          <button
            onClick={() => setExpandedPreset(expanded ? null : presetKey)}
            className={`px-2.5 rounded-xl transition-all ${
              expanded ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
            aria-label="Configurar preset"
          >
            <Settings2 size={14} />
          </button>
        </div>
        {expanded && renderPresetSettings(presetKey)}
      </div>
    );
  };

  return (
    <>
      <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main h-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={20} className={isDocked ? "text-text-secondary" : "text-accent-blue"} />
            <span className="text-text-primary font-medium">{name}</span>
          </div>
          {battery != null && (
            <span className={`text-sm font-medium ${batteryColor}`}>{battery}%</span>
          )}
        </div>

        <p className="text-xs text-text-secondary -mt-1">
          {status ?? (isDocked ? "En base" : isCleaning ? "Limpiando..." : state)}
        </p>

        <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-bg-tertiary">
          <VacuumMap
            cameraEntityId={MAP_ENTITY}
            suctionEntityId={VACUUM_SUCTION_LEVEL_ENTITY}
            selectedRoomId={selectedRoom}
            onRoomClick={toggleRoom}
            onRoomClean={launchRoomClean}
            rotationDeg={mapRotation}
            zoom={mapZoom}
            pan={mapPan}
            onPanChange={setMapPan}
            showPopup
            showLabels={false}
          />
          {/* Map controls overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            {/* Rotate */}
            <div className="flex gap-1 pointer-events-auto">
              <button onClick={rotateCCW} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors" aria-label="Rotar izquierda"><RotateCcw size={13} /></button>
              <button onClick={rotateCW}  className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors" aria-label="Rotar derecha"><RotateCw  size={13} /></button>
            </div>
            {/* Zoom + expand */}
            <div className="flex gap-1 pointer-events-auto">
              <button onClick={zoomOut} disabled={mapZoom <= ZOOM_STEPS[0]} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition-colors" aria-label="Alejar"><ZoomOut size={13} /></button>
              <span className="px-2 py-1 rounded-lg bg-black/50 text-white text-[10px] font-medium self-center">{mapZoom === 1 ? "1×" : `${mapZoom}×`}</span>
              <button onClick={zoomIn}  disabled={mapZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 transition-colors" aria-label="Acercar"><ZoomIn  size={13} /></button>
              <button onClick={() => setMapOpen(true)} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors" aria-label="Ampliar mapa"><Maximize2 size={13} /></button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isCleaning ? (
            <button onClick={pause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-yellow/20 text-accent-yellow text-sm font-medium hover:bg-accent-yellow/30 transition-all">
              <Pause size={14} /> Pausar
            </button>
          ) : (
            <button onClick={start}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-green/20 text-accent-green text-sm font-medium hover:bg-accent-green/30 transition-all">
              <Play size={14} /> Iniciar
            </button>
          )}
          <button onClick={dock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium hover:text-text-primary transition-all">
            <Home size={14} /> Base
          </button>
        </div>

        <div className="space-y-2 pt-1 border-t border-border-main">
          <p className="text-[10px] text-text-secondary uppercase tracking-wider pt-2">Limpieza rápida</p>
          <PresetRow presetKey="full"  icon={<Sparkles size={14} className="text-accent-blue" />} label="Aspirado + Mopa" />
          <PresetRow presetKey="sweep" icon={<Wind size={14} className="text-accent-blue" />}     label="Solo aspirado" />

          <div className="flex gap-1.5 items-center px-3 py-2 rounded-xl bg-bg-tertiary text-text-secondary text-sm">
            <Calendar size={14} className="text-accent-blue shrink-0" />
            <span className="text-left flex-1 text-text-primary font-medium">Programada</span>
            {nextEventLabel ? (
              <span className="text-xs text-text-secondary">{nextEventLabel}</span>
            ) : (
              <span className="text-xs text-text-secondary">Sin programar</span>
            )}
          </div>
        </div>
      </div>

      {mapOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setMapOpen(false)}
        >
          <div className="relative max-w-3xl w-full bg-bg-secondary rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMapOpen(false)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-bg-secondary text-text-primary border border-border-main hover:bg-bg-tertiary transition-colors z-10"
              aria-label="Cerrar mapa"
            >
              <X size={16} />
            </button>
            <VacuumMap
              cameraEntityId={MAP_ENTITY}
              suctionEntityId={VACUUM_SUCTION_LEVEL_ENTITY}
              selectedRoomId={selectedRoom}
              onRoomClick={toggleRoom}
              onRoomClean={launchRoomClean}
              rotationDeg={mapRotation}
              zoom={mapZoom}
              pan={mapPan}
              onPanChange={setMapPan}
              showPopup
              showLabels={true}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
