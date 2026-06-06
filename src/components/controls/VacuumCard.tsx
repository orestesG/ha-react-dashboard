import { useState } from "react";
import { createPortal } from "react-dom";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { useVacuumStore, getDeviceId, DEFAULT_ZOOM } from "../../store/vacuum-store";
import type { PresetConfig, RotDeg } from "../../store/vacuum-store";
import { VacuumScheduleModal } from "./VacuumScheduleModal";
import { callService } from "../../lib/ha-client";
import { Bot, Play, Pause, Home, Maximize2, X, Settings2, Sparkles, Wind, Calendar, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import {
  VACUUM_CLEANING_MODE_ENTITY,
  VACUUM_SUCTION_LEVEL_ENTITY,
  VACUUM_WATER_VOLUME_ENTITY,
} from "../../dashboard.config";
import { VacuumMap } from "../widgets/VacuumMap";

const SCHEDULE_ENTITY       = "schedule.limpieza_robot";
const SCHEDULE_ENTITY_SWEEP = "schedule.limpieza_robot_solo_aspirado";
const MAP_ENTITY            = "camera.xiaomi_robot_vacuum_x20_map";

const ZOOM_STEPS = [0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3] as const;

interface VacuumCardProps {
  entityId: string;
  name?: string;
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === current;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`h-9 px-3 rounded-lg text-xs font-medium capitalize transition-all active:scale-95 ${
              active
                ? "bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/30"
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
  const { entity: scheduleSweepEnt } = useEntity(SCHEDULE_ENTITY_SWEEP);
  const connection = useHAStore((s) => s.connection);

  const [mapOpen, setMapOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [expandedPreset, setExpandedPreset] = useState<"full" | "sweep" | null>(null);
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Presets + view + slots persisted in HA storage via vacuum-store
  const { presets, view, slots, setPresets, setRotation, setZoom, setSlots, syncScheduleHelpersToHA } = useVacuumStore();
  const mapRotation = view.rotation;
  // Zoom is per-device so each tablet keeps its own preferred level
  const mapZoom     = view.zoomByDevice[getDeviceId()] ?? DEFAULT_ZOOM;

  const rotateCW  = () => { setRotation(((mapRotation + 90)  % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const rotateCCW = () => { setRotation(((mapRotation - 90 + 360) % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const zoomIn    = () => { const i = ZOOM_STEPS.indexOf(mapZoom as typeof ZOOM_STEPS[number]); if (i < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[i + 1]); };
  const zoomOut   = () => { const i = ZOOM_STEPS.indexOf(mapZoom as typeof ZOOM_STEPS[number]); if (i > 0) setZoom(ZOOM_STEPS[i - 1]); };

  const state = entity?.state;
  const battery = entity?.attributes?.battery as number | undefined;
  const status = entity?.attributes?.status as string | undefined;

  const modeOptions = (modeEnt?.attributes?.options as string[] | undefined) ?? [];
  const suctionOptions = (suctionEnt?.attributes?.options as string[] | undefined) ?? [];
  const waterOptions = (waterEnt?.attributes?.options as string[] | undefined) ?? [];

  // The soonest cleaning can come from either schedule helper (full or sweep).
  // A helper with no matching enabled slots only holds an inert placeholder block
  // (HA requires at least one range), so its next_event must be ignored.
  const hasFullSlots  = slots.some((s) => s.enabled && s.preset === "full");
  const hasSweepSlots = slots.some((s) => s.enabled && s.preset === "sweep");
  const nextEvent = (() => {
    const candidates = [
      hasFullSlots  ? scheduleEnt?.attributes?.next_event       : undefined,
      hasSweepSlots ? scheduleSweepEnt?.attributes?.next_event  : undefined,
    ].filter((v): v is string => typeof v === "string" && !isNaN(Date.parse(v)));
    if (candidates.length === 0) return undefined;
    return candidates.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  })();
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
    setPresets({ ...presets, [key]: { ...presets[key], ...patch } });
  };

  const launchRoomClean = async (segmentId: number, options: { suction?: string; repeats: number }) => {
    if (!connection) return;
    const data: Record<string, unknown> = { segments: [segmentId], repeats: options.repeats };
    if (options.suction) data.suction_level = options.suction;
    try {
      await callService(connection, "dreame_vacuum", "vacuum_clean_segment", data, { entity_id: entityId });
    } catch (err) {
      console.warn("[VacuumCard] vacuum_clean_segment falló:", err);
    }
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
            className="flex-1 flex items-center gap-2 px-4 h-11 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium hover:bg-accent-blue/10 hover:text-accent-blue active:scale-95 transition-all"
          >
            {icon}
            <span className="text-left">{label}</span>
          </button>
          <button
            onClick={() => setExpandedPreset(expanded ? null : presetKey)}
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-95 ${
              expanded ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            }`}
            aria-label="Configurar preset"
          >
            <Settings2 size={16} />
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
          {/* Map controls overlay — touch-friendly 40px targets */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <div className="flex gap-1.5 pointer-events-auto">
              <button onClick={rotateCCW} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/55 text-white active:bg-black/80 transition-colors" aria-label="Rotar izquierda"><RotateCcw size={16} /></button>
              <button onClick={rotateCW}  className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/55 text-white active:bg-black/80 transition-colors" aria-label="Rotar derecha"><RotateCw  size={16} /></button>
            </div>
            <div className="flex gap-1.5 pointer-events-auto">
              <button onClick={zoomOut} disabled={mapZoom <= ZOOM_STEPS[0]} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/55 text-white disabled:opacity-30 active:bg-black/80 transition-colors" aria-label="Alejar"><ZoomOut size={16} /></button>
              <span className="px-2 h-10 flex items-center rounded-xl bg-black/55 text-white text-xs font-semibold">{mapZoom === 1 ? "1×" : `${mapZoom}×`}</span>
              <button onClick={zoomIn}  disabled={mapZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/55 text-white disabled:opacity-30 active:bg-black/80 transition-colors" aria-label="Acercar"><ZoomIn  size={16} /></button>
              <button onClick={() => setMapOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/55 text-white active:bg-black/80 transition-colors" aria-label="Ampliar mapa"><Maximize2 size={16} /></button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isCleaning ? (
            <button onClick={pause}
              className="flex-1 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-accent-yellow/20 text-accent-yellow text-sm font-medium active:scale-95 transition-all">
              <Pause size={16} /> Pausar
            </button>
          ) : (
            <button onClick={start}
              className="flex-1 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-accent-green/20 text-accent-green text-sm font-medium active:scale-95 transition-all">
              <Play size={16} /> Iniciar
            </button>
          )}
          <button onClick={dock}
            className="flex-1 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium active:scale-95 transition-all">
            <Home size={16} /> Base
          </button>
        </div>

        <div className="space-y-2 pt-3 border-t border-border-main">
          <PresetRow presetKey="full"  icon={<Sparkles size={15} className="text-accent-blue" />} label="Aspirado + Mopa" />
          <PresetRow presetKey="sweep" icon={<Wind size={15} className="text-accent-blue" />}     label="Solo aspirado" />

          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-4 h-11 rounded-xl bg-bg-tertiary">
              <Calendar size={16} className="text-accent-blue shrink-0" />
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-medium text-text-primary">Programada</p>
                <p className="text-[11px] text-text-secondary truncate">
                  {slots.filter(s => s.enabled).length} horario{slots.filter(s => s.enabled).length !== 1 ? "s" : ""}
                  {nextEventLabel ? ` · próx: ${nextEventLabel}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => setScheduleOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-bg-tertiary text-text-secondary hover:text-text-primary active:scale-95 transition-all shrink-0"
              aria-label="Editar horarios"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {scheduleOpen && createPortal(
        <VacuumScheduleModal
          slots={slots}
          suctionOptions={suctionOptions}
          onClose={() => setScheduleOpen(false)}
          onSave={async (newSlots) => {
            setSlots(newSlots);
            if (connection) await syncScheduleHelpersToHA(connection);
            setScheduleOpen(false);
          }}
        />,
        document.body
      )}

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
