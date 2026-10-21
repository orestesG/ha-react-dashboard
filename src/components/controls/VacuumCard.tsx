import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, BatteryMedium, Bot, Calendar, Clock, Droplets, Home, Map as MapIcon, MapPin,
  Maximize2, Pause, Play, RotateCcw, RotateCw, Settings2, Trash2, Wind, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import {
  useVacuumStore, getDeviceId, DEFAULT_ZOOM, ensureHAAutomation,
  HA_AUTOMATION_ENTITY, HA_SCHEDULE_ENTITY, HA_SCRIPT_ENTITY,
  type RotDeg, type SyncResult,
} from "../../store/vacuum-store";
import { callService } from "../../lib/ha-client";
import {
  DEFAULT_RUN_OPTIONS,
  allSegments, buildCleanSegmentData, deviceSlug, getRooms, hasOverrides, orderBySequence, statusLabel, toScriptVariables,
  type RunOptions,
} from "../../lib/vacuum";
import { VACUUM_ENTITY } from "../../dashboard.config";
import { MetricChip } from "../ui/MetricChip";
import { VacuumMap } from "../widgets/VacuumMap";
import { VacuumScheduleModal } from "./VacuumScheduleModal";
import { RoomSettingsList } from "./vacuum/RoomSettingsList";
import { RunOptionsModal } from "./vacuum/RunOptionsModal";
import { ConsumablesPanel } from "./vacuum/ConsumablesPanel";

const ZOOM_STEPS = [0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3] as const;

type Tab = "map" | "rooms" | "care";
const TABS: { id: Tab; label: string }[] = [
  { id: "map",   label: "Mapa" },
  { id: "rooms", label: "Habitaciones" },
  { id: "care",  label: "Consumibles" },
];

const RUNNING_STATES = ["cleaning", "returning"];

interface VacuumCardProps {
  entityId: string;
  name?: string;
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/^\[Dashboard\]\s*/, "");
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

// Design system: focus is a border swap to accent-blue; no shadows; 44px touch targets
const focusRing = "border border-transparent focus-visible:outline-none focus-visible:border-accent-blue";
const mapBtn = "w-11 h-11 flex items-center justify-center rounded-xl bg-bg-secondary border border-border-main text-text-primary transition focus-visible:outline-none focus-visible:border-accent-blue enabled:active:scale-95 disabled:opacity-40";
const secondaryBtn = `bg-bg-tertiary text-text-primary ${focusRing}`;
// Chrome draws a white classic scrollbar on dark surfaces unless told otherwise
const scrollY = "overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-text-secondary)_transparent]";
const primaryBtn = "bg-accent-blue text-white border border-transparent hover:bg-accent-blue/90 focus-visible:outline-none focus-visible:border-white";

export function VacuumCard({ entityId, name = "Robot" }: VacuumCardProps) {
  const slug = deviceSlug(entityId);
  const mapEntity = `camera.${slug}_map`;
  // The schedule/script are provisioned for the configured robot only
  const isScheduledRobot = entityId === VACUUM_ENTITY;

  const { entity, loading } = useEntity(entityId);
  const { entity: scheduleEnt } = useEntity(HA_SCHEDULE_ENTITY);
  const connection     = useHAStore((s) => s.connection);
  const automationOn   = useHAStore((s) => s.entities[HA_AUTOMATION_ENTITY]?.state === "on");
  const scriptRunning  = useHAStore((s) => s.entities[HA_SCRIPT_ENTITY]?.state === "on");
  const scriptExists   = useHAStore((s) => !!s.entities[HA_SCRIPT_ENTITY]);

  const { view, slots, haSync, setRotation, setZoom, setSlots, syncScheduleHelpersToHA } = useVacuumStore();
  const mapRotation = view.rotation;
  // Zoom is per-device so each tablet keeps its own preferred level
  const mapZoom = view.zoomByDevice[getDeviceId()] ?? DEFAULT_ZOOM;

  const [tab, setTab]                   = useState<Tab>("map");
  const [mapOpen, setMapOpen]           = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [optsOpen, setOptsOpen]         = useState(false);
  const [selected, setSelected]         = useState<number[]>([]);
  const [runOpts, setRunOpts]           = useState<RunOptions>(DEFAULT_RUN_OPTIONS);
  const [starting, setStarting]         = useState(false);
  const [runError, setRunError]         = useState<string | null>(null);
  const [mapPan, setMapPan]             = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const attrs = entity?.attributes as Record<string, unknown> | undefined;
  const sequence = attrs?.cleaning_sequence as number[] | undefined;
  const rooms = useMemo(() => {
    const list = getRooms(attrs);
    return orderBySequence(list.map((r) => r.id), sequence).map((id) => list.find((r) => r.id === id)!);
  }, [attrs, sequence]);

  const rotateCW  = () => { setRotation(((mapRotation + 90) % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const rotateCCW = () => { setRotation(((mapRotation - 90 + 360) % 360) as RotDeg); setMapPan({ x: 0, y: 0 }); };
  const zoomIn    = () => { const i = ZOOM_STEPS.indexOf(mapZoom as typeof ZOOM_STEPS[number]); if (i < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[i + 1]); };
  const zoomOut   = () => { const i = ZOOM_STEPS.indexOf(mapZoom as typeof ZOOM_STEPS[number]); if (i > 0) setZoom(ZOOM_STEPS[i - 1]); };
  const toggleRoom = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const state     = entity?.state;
  const battery   = attrs?.battery as number | undefined;
  const isRunning = RUNNING_STATES.includes(state ?? "");
  const isPaused  = state === "paused";
  const isError   = state === "error";

  const enabledSlots = slots.filter((s) => s.enabled).length;
  const nextEvent    = enabledSlots > 0 ? (scheduleEnt?.attributes?.next_event as string | undefined) : undefined;
  const nextEventLabel = (() => {
    if (!nextEvent || isNaN(Date.parse(nextEvent))) return null;
    try {
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Buenos_Aires",
        weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(nextEvent));
    } catch { return null; }
  })();

  const statusText = isError
    ? (attrs?.error as string | undefined) ?? "Error"
    : statusLabel((attrs?.status as string | undefined) ?? state);
  const scheduleText = !isScheduledRobot ? null
    : !automationOn ? "Programación pausada"
    : nextEventLabel ? `Próx. ${nextEventLabel}` : null;

  // ── Stats row ──────────────────────────────────────────────────────────────
  const currentRoom = rooms.find((r) => r.id === attrs?.current_segment);
  const cleaningTime = attrs?.cleaning_time as number | undefined;
  const cleanedArea  = attrs?.cleaned_area as number | undefined;
  const dryingLeft   = attrs?.drying_left as number | undefined;
  const emptying     = typeof attrs?.auto_empty_status === "string" && attrs.auto_empty_status.toLowerCase() !== "idle";

  // Yellow/orange are identity-only in the design system — mid battery stays the informational blue
  const batteryColor = battery == null ? "blue" : battery < 20 ? "red" : battery < 50 ? "blue" : "green";

  // ── Actions ────────────────────────────────────────────────────────────────
  const callVacuum = (service: string) =>
    connection && callService(connection, "vacuum", service, undefined, { entity_id: entityId }).catch((err) => setRunError(errorText(err)));

  const startCleaning = async () => {
    if (!connection) return;
    setRunError(null);
    setStarting(true);
    try {
      const segments = orderBySequence(selected, sequence);
      if (runOpts.sweepOnly) {
        // Room modes must be restored after docking even if no dashboard is open → run it in HA
        if (!scriptExists) await ensureHAAutomation(connection);
        await callService(connection, "script", "turn_on", { variables: toScriptVariables(runOpts, segments) }, { entity_id: HA_SCRIPT_ENTITY });
      } else if (segments.length === 0 && !hasOverrides(runOpts)) {
        await callService(connection, "vacuum", "start", undefined, { entity_id: entityId });
      } else {
        const segs = segments.length > 0 ? segments : allSegments(attrs);
        await callService(connection, "dreame_vacuum", "vacuum_clean_segment", buildCleanSegmentData(segs, runOpts), { entity_id: entityId });
      }
      setSelected([]);
      setOptsOpen(false);
    } catch (err) {
      setRunError(`No se pudo iniciar: ${errorText(err)}`);
    } finally {
      setStarting(false);
    }
  };

  const saveSlots = async (newSlots: typeof slots): Promise<SyncResult> => {
    setSlots(newSlots);
    if (!connection) return { ok: false, errors: ["Sin conexión con Home Assistant"] };
    return syncScheduleHelpersToHA(connection);
  };

  const setAutomationEnabled = async (on: boolean): Promise<SyncResult> => {
    if (!connection) return { ok: false, errors: ["Sin conexión con Home Assistant"] };
    // Never resume a stale setup: push schedule + script + automation first
    if (on) {
      const res = await syncScheduleHelpersToHA(connection);
      if (!res.ok) return res;
    }
    try {
      await callService(connection, "automation", on ? "turn_on" : "turn_off", undefined, { entity_id: HA_AUTOMATION_ENTITY });
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: [errorText(err)] };
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-secondary border border-border-main h-full animate-pulse space-y-3">
        <div className="h-5 w-24 rounded-lg bg-bg-tertiary" />
        <div className="h-32 w-full rounded-xl bg-bg-tertiary" />
      </div>
    );
  }

  const customRun = runOpts.sweepOnly || hasOverrides(runOpts);
  const startLabel = starting ? "Iniciando…"
    : selected.length > 0 ? `Limpiar ${selected.length} hab.`
    : "Limpiar todo";
  const notice = runError
    ?? (haSync.status === "error" ? `Sincronización con HA: ${haSync.message ?? "falló"}` : null);

  const renderMap = (labels: boolean) => (
    <VacuumMap
      cameraEntityId={mapEntity}
      selectedRoomIds={selected}
      onRoomClick={toggleRoom}
      rotationDeg={mapRotation}
      zoom={mapZoom}
      pan={mapPan}
      onPanChange={setMapPan}
      showLabels={labels}
      className="w-full h-full"
    />
  );

  return (
    <>
      <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main h-full flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bot size={20} className={`shrink-0 ${isError ? "text-accent-red" : isRunning ? "text-accent-green" : "text-text-secondary"}`} />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-semibold text-text-primary truncate">{name}</p>
              <p className={`text-xs truncate ${isError ? "text-accent-red" : "text-text-secondary"}`}>
                {statusText}{scheduleText ? ` · ${scheduleText}` : ""}
              </p>
            </div>
          </div>
          {battery != null && <MetricChip icon={<BatteryMedium size={12} />} value={battery} unit="%" color={batteryColor} />}
        </div>

        {/* Stats */}
        <div className="flex gap-2 overflow-hidden">
          {attrs?.washing === true && <MetricChip icon={<Droplets size={12} />} value="Lavando mopa" />}
          {attrs?.drying === true && <MetricChip icon={<Wind size={12} />} value="Secando" unit={dryingLeft ? `${dryingLeft} min` : undefined} />}
          {emptying && <MetricChip icon={<Trash2 size={12} />} value="Vaciando" />}
          {isRunning && currentRoom && <MetricChip icon={<MapPin size={12} />} value={currentRoom.name} />}
          {cleaningTime != null && <MetricChip icon={<Clock size={12} />} value={cleaningTime} unit="min" />}
          {cleanedArea != null && <MetricChip icon={<MapIcon size={12} />} value={cleanedArea} unit="m²" />}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-bg-tertiary" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-0 h-11 px-2 rounded-xl text-xs font-medium truncate transition-colors ${focusRing} ${
                tab === t.id ? "bg-accent-blue/20 text-accent-blue" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        {/* Shrinks with the grid item (min-h-0); 120px basis when the card has no fixed height (FullControlModal) */}
        <div className="relative flex-[1_1_120px] min-h-0 rounded-xl overflow-hidden">
          {tab === "map" && (
            <div className="absolute inset-0 bg-bg-tertiary">
              {renderMap(false)}
              {selected.length > 0 && (
                <div className="absolute top-2 left-2 flex items-center pl-3 rounded-xl bg-bg-secondary border border-border-main text-text-primary text-xs font-medium">
                  {selected.length} {selected.length === 1 ? "seleccionada" : "seleccionadas"}
                  <button onClick={() => setSelected([])} className={`w-11 h-11 -my-px flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary ${focusRing}`} aria-label="Quitar selección">
                    <X size={16} />
                  </button>
                </div>
              )}
              {/* Rotate/zoom live in the expanded map — at this size they would cover the map */}
              <button onClick={() => setMapOpen(true)} className={`absolute bottom-2 right-2 ${mapBtn}`} aria-label="Ampliar mapa" aria-haspopup="dialog">
                <Maximize2 size={16} />
              </button>
            </div>
          )}
          {tab === "rooms" && (
            <div className={`absolute inset-0 ${scrollY}`}>
              <RoomSettingsList slug={slug} rooms={rooms} customizedEntityId={`switch.${slug}_customized_cleaning`} />
            </div>
          )}
          {tab === "care" && (
            <div className={`absolute inset-0 pr-1 ${scrollY}`}>
              <ConsumablesPanel slug={slug} attributes={attrs} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isRunning ? (
            <button onClick={() => callVacuum("pause")}
              className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 h-11 rounded-xl text-sm font-medium active:scale-95 transition ${secondaryBtn}`}>
              <Pause size={16} className="shrink-0" /> Pausar
            </button>
          ) : isPaused ? (
            <button onClick={() => callVacuum("start")}
              className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 h-11 rounded-xl text-sm font-medium active:scale-95 transition ${primaryBtn}`}>
              <Play size={16} className="shrink-0" /> Reanudar
            </button>
          ) : (
            <button onClick={() => void startCleaning()} disabled={starting || !connection}
              className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 h-11 rounded-xl text-sm font-medium enabled:active:scale-95 transition disabled:opacity-40 ${primaryBtn}`}>
              <Play size={16} className="shrink-0" /> <span className="truncate">{startLabel}</span>
            </button>
          )}
          <button onClick={() => callVacuum("return_to_base")}
            className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl active:scale-95 transition ${secondaryBtn}`}
            aria-label="Volver a la base">
            <Home size={16} />
          </button>
          <button onClick={() => setOptsOpen(true)}
            className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-xl active:scale-95 transition ${
              customRun ? `bg-accent-blue/20 text-accent-blue ${focusRing}` : secondaryBtn
            }`}
            aria-label={customRun ? "Ajustes de esta limpieza (personalizados)" : "Ajustes de esta limpieza"}
            aria-haspopup="dialog">
            <Settings2 size={16} />
          </button>
          {isScheduledRobot && (
            <button onClick={() => setScheduleOpen(true)}
              className={`relative w-11 h-11 shrink-0 flex items-center justify-center rounded-xl active:scale-95 transition ${secondaryBtn}`}
              aria-label={automationOn ? `Horarios de limpieza (${enabledSlots} activados)` : "Horarios de limpieza (programación pausada)"}
              aria-haspopup="dialog">
              <Calendar size={16} />
              {/* Count only while the automation runs — the header already says "Programación pausada" */}
              {automationOn && enabledSlots > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-accent-blue text-white text-xs font-medium leading-none">
                  {enabledSlots}
                </span>
              )}
            </button>
          )}
        </div>

        {notice && (
          <p className="flex items-center gap-2 text-xs text-accent-red min-w-0" title={notice}>
            <AlertTriangle size={14} className="shrink-0" />
            <span className="truncate">{notice}</span>
          </p>
        )}
      </div>

      {scheduleOpen && createPortal(
        <VacuumScheduleModal
          slots={slots}
          automationOn={automationOn}
          onToggleAutomation={setAutomationEnabled}
          onClose={() => setScheduleOpen(false)}
          onSave={saveSlots}
        />,
        document.body
      )}

      {optsOpen && createPortal(
        <RunOptionsModal
          value={runOpts}
          onChange={setRunOpts}
          sweepDisabled={!isScheduledRobot || scriptRunning}
          sweepNote={scriptRunning ? 'Hay una limpieza programada en curso; "Solo aspirado" vuelve a estar disponible cuando termine.' : undefined}
          onClose={() => setOptsOpen(false)}
        />,
        document.body
      )}

      {mapOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setMapOpen(false)}>
          <div className="max-w-3xl w-full bg-bg-secondary border border-border-main rounded-2xl p-5 space-y-4" role="dialog" aria-modal="true" aria-label="Mapa" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 -my-2 -mr-2">
              <h2 className="text-base font-semibold text-text-primary">Mapa</h2>
              <button
                onClick={() => setMapOpen(false)}
                className={`w-11 h-11 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ${focusRing}`}
                aria-label="Cerrar mapa"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative h-[65vh] rounded-xl overflow-hidden bg-bg-tertiary">
              {renderMap(true)}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                <div className="flex gap-2 pointer-events-auto">
                  <button onClick={rotateCCW} className={mapBtn} aria-label="Rotar izquierda"><RotateCcw size={16} /></button>
                  <button onClick={rotateCW} className={mapBtn} aria-label="Rotar derecha"><RotateCw size={16} /></button>
                </div>
                <div className="flex gap-2 pointer-events-auto">
                  <button onClick={zoomOut} disabled={mapZoom <= ZOOM_STEPS[0]} className={mapBtn} aria-label="Alejar"><ZoomOut size={16} /></button>
                  <button onClick={zoomIn} disabled={mapZoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} className={mapBtn} aria-label="Acercar"><ZoomIn size={16} /></button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                {selected.length > 0
                  ? `${selected.length} ${selected.length === 1 ? "habitación seleccionada" : "habitaciones seleccionadas"}`
                  : "Tocá habitaciones para seleccionarlas"}
              </p>
              <button onClick={() => setMapOpen(false)} className={`h-11 px-4 rounded-xl text-sm font-medium active:scale-95 transition ${primaryBtn}`}>
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
