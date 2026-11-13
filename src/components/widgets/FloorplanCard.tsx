import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { HassEntity } from "home-assistant-js-websocket";
import {
  Activity, AirVent, Blinds, Bot, Box, Droplets, Heater, Home, Layers2, Lightbulb, Play, Pause,
  Plug, Projector, Speaker, Tag, Thermometer, WashingMachine, X,
  type LucideIcon,
} from "lucide-react";
import { useHAStore } from "../../store/ha-store";
import { useEntity } from "../../hooks/useEntity";
import { callService } from "../../lib/ha-client";
import { centroid, coverOpenFraction, isActive, isUnavailable, vacuumToPlan, type Device, type DeviceKind, type Pt } from "../../lib/floorplan";
import { VACUUM_DEVICE_ID, VACUUM_MAP_CAMERA_ENTITY, devices, rooms, vacuumTransform } from "../../floorplan.config";
import { FloorplanScene, STILL, WARM_WHITE, deviceHeight, projectStill, type SceneState, type ViewMode } from "./floorplan/FloorplanScene";
import { StillView, type StillLight } from "./floorplan/StillView";
import { LightTile } from "../controls/LightTile";
import { CoverTile } from "../controls/CoverTile";
import { ClimateCard } from "../controls/ClimateCard";
import { MediaPlayerCard } from "../controls/MediaPlayerCard";

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  light: Lightbulb, strip: Lightbulb, cover: Blinds, climate: AirVent, projector: Projector, speaker: Speaker,
  heater: Heater, washer: WashingMachine, plug: Plug, sensor: Thermometer, motion: Activity, leak: Droplets, vacuum: Bot,
};

// Full class names so Tailwind keeps them
const KIND_ACTIVE_CLASS: Record<DeviceKind, string> = {
  light: "bg-accent-yellow border-accent-yellow text-white", strip: "bg-accent-yellow border-accent-yellow text-white",
  cover: "bg-accent-blue border-accent-blue text-white", climate: "bg-accent-blue border-accent-blue text-white",
  projector: "bg-accent-purple border-accent-purple text-white", speaker: "bg-accent-purple border-accent-purple text-white",
  heater: "bg-accent-orange border-accent-orange text-white", washer: "bg-accent-blue border-accent-blue text-white",
  plug: "bg-accent-green border-accent-green text-white", sensor: "bg-accent-green border-accent-green text-white",
  motion: "bg-accent-green border-accent-green text-white", leak: "bg-accent-red border-accent-red text-white",
  vacuum: "bg-accent-blue border-accent-blue text-white",
};

const SCENE_ENTITY_IDS = [...new Set([...devices.map((d) => d.entityId), VACUUM_MAP_CAMERA_ENTITY])];

interface Position { x: number; y: number; a?: number }

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function buildSceneState(entities: Record<string, HassEntity | undefined>): { state: SceneState; robotPos: Pt | null } {
  const lit: SceneState["lit"] = {};
  const covers: SceneState["covers"] = {};
  const active: SceneState["active"] = {};
  const colors: SceneState["colors"] = {};
  for (const d of devices) {
    const entity = entities[d.entityId];
    const on = isActive(entity);
    active[d.id] = on;
    // Lights that report a colour tint their lamp and the room, like the real thing
    const rgb = on ? (entity?.attributes.rgb_color as [number, number, number] | undefined) : undefined;
    if (rgb) colors[d.id] = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    if (d.lightsRoom && on && (rgb || lit[d.room] === undefined)) lit[d.room] = colors[d.id] ?? WARM_WHITE;
    if (d.kind === "cover") covers[d.entityId] = coverOpenFraction(entity);
  }
  const map = entities[VACUUM_MAP_CAMERA_ENTITY]?.attributes as { vacuum_position?: Position; charger_position?: Position } | undefined;
  const robotPos = map?.vacuum_position ? vacuumToPlan(map.vacuum_position, vacuumTransform) : null;
  return {
    robotPos,
    state: {
      lit, covers, active, colors,
      robot: robotPos && { pos: robotPos, angle: map?.vacuum_position?.a ?? 0 },
      dock: map?.charger_position ? vacuumToPlan(map.charger_position, vacuumTransform) : null,
    },
  };
}

// ── Markers ───────────────────────────────────────────────────────────────────

function markerText(d: Device, entity: HassEntity | undefined): string | null {
  if (d.kind !== "sensor" || isUnavailable(entity)) return null;
  const n = Number(entity!.state);
  return Number.isFinite(n) ? `${n.toFixed(1)}°` : null;
}

interface MarkerProps {
  device: Device;
  selected: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
  register: (id: string, el: HTMLElement | null) => void;
}

function DeviceMarker({ device, selected, showLabel, onSelect, register }: MarkerProps) {
  const { entity, toggle } = useEntity(device.entityId);
  const Icon = KIND_ICON[device.kind];
  const active = isActive(entity);
  const unavailable = isUnavailable(entity);
  const text = markerText(device, entity);
  // Plain switches toggle in place; everything else opens its control
  const direct = device.entityId.startsWith("switch.") && !unavailable;

  return (
    <button
      ref={(el) => register(device.id, el)}
      type="button"
      title={device.name}
      aria-label={device.name}
      aria-pressed={direct ? active : undefined}
      onClick={() => (direct ? void toggle() : onSelect(device.id))}
      className={`absolute left-0 top-0 pointer-events-auto flex items-center gap-1 rounded-full border shadow-md text-xs font-medium whitespace-nowrap transition-colors active:scale-95
        ${text || showLabel ? "h-7 px-2" : "h-7 w-7 justify-center"}
        ${active ? KIND_ACTIVE_CLASS[device.kind] : "bg-bg-secondary border-border-main text-text-secondary hover:text-text-primary"}
        ${unavailable ? "opacity-50" : ""}
        ${selected ? "ring-2 ring-accent-blue" : ""}`}
      style={{ visibility: "hidden" }}
    >
      <Icon size={14} />
      {text}
      {showLabel && <span>{device.name}</span>}
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function EntityRow({ entityId }: { entityId: string }) {
  const { entity } = useEntity(entityId);
  const unit = entity?.attributes.unit_of_measurement as string | undefined;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-secondary truncate">{(entity?.attributes.friendly_name as string | undefined) ?? entityId}</span>
      <span className="text-text-primary font-medium whitespace-nowrap">{entity ? `${entity.state}${unit ? ` ${unit}` : ""}` : "—"}</span>
    </div>
  );
}

function VacuumQuick({ entityId }: { entityId: string }) {
  const { entity } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);
  const call = (service: string) => { if (connection) void callService(connection, "vacuum", service, undefined, { entity_id: entityId }); };
  const battery = entity?.attributes.battery as number | undefined;
  const btn = "flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-bg-tertiary text-text-primary text-sm active:scale-95 transition-transform";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">Estado</span>
        <span className="text-text-primary font-medium">{entity?.state ?? "—"}{battery !== undefined ? ` · ${battery}%` : ""}</span>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => call("start")}><Play size={14} />Iniciar</button>
        <button type="button" className={btn} onClick={() => call("pause")}><Pause size={14} />Pausar</button>
        <button type="button" className={btn} onClick={() => call("return_to_base")}><Home size={14} />Base</button>
      </div>
    </div>
  );
}

function DeviceControl({ device }: { device: Device }) {
  const domain = device.entityId.split(".")[0];
  switch (domain) {
    case "light":        return <LightTile entityId={device.entityId} name={device.name} />;
    case "cover":        return <CoverTile entityId={device.entityId} name={device.name} />;
    case "climate":      return <ClimateCard entityId={device.entityId} name={device.name} consoleEntityId={device.consoleEntityId} />;
    case "media_player": return <MediaPlayerCard entityId={device.entityId} name={device.name} />;
    case "vacuum":       return <VacuumQuick entityId={device.entityId} />;
    default:
      return (
        <div className="flex flex-col gap-2">
          <EntityRow entityId={device.entityId} />
          {device.secondaryEntityId && <EntityRow entityId={device.secondaryEntityId} />}
        </div>
      );
  }
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function FloorplanCard() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FloorplanScene | null>(null);
  const markerEls = useRef(new Map<string, HTMLElement>());
  const roomEls = useRef(new Map<string, HTMLElement>());
  const robotPosRef = useRef<Pt | null>(null);

  // The pre-rendered still is the default; the live 3D scene only exists while its button is on
  const [live, setLive] = useState(() => new URLSearchParams(window.location.search).has("plano3d"));
  const [view, setView] = useState<ViewMode>("iso");
  const [showLabels, setShowLabels] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webgl] = useState(hasWebGL);
  const dark = useIsDark();
  // Day or night follows the real sun; without that entity, the theme decides
  const sunState = useHAStore((s) => s.entities["sun.sun"]?.state);
  const night = sunState ? sunState === "below_horizon" : dark;

  const entities = useHAStore(useShallow((s) => Object.fromEntries(SCENE_ENTITY_IDS.map((id) => [id, s.entities[id]]))));
  const { state: sceneState, robotPos } = useMemo(() => buildSceneState(entities), [entities]);

  // Runs after every rendered frame: keeps the HTML markers glued to their 3D spot (no React state per frame)
  const placeMarkers = useCallback(() => {
    const scene = sceneRef.current;
    const host = hostRef.current;
    if (!host || (live && !scene)) return;
    // The still is drawn "contain" inside the host
    const k = Math.min(host.clientWidth / STILL.width, host.clientHeight / STILL.height);
    const ox = (host.clientWidth - STILL.width * k) / 2, oy = (host.clientHeight - STILL.height * k) / 2;
    const project = (pos: Pt, h: number) => {
      if (scene) return scene.project(pos, h);
      const { u, v } = projectStill(pos, h);
      return { x: ox + u * STILL.width * k, y: oy + v * STILL.height * k };
    };
    const place = (el: HTMLElement | undefined, pos: Pt, h: number) => {
      if (!el) return;
      const p = project(pos, h);
      el.style.visibility = p ? "visible" : "hidden";
      if (p) el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    };
    for (const d of devices) {
      const pos = d.id === VACUUM_DEVICE_ID ? robotPosRef.current ?? d.pos : d.pos;
      place(markerEls.current.get(d.id), pos, deviceHeight(d) + 0.35);
    }
    for (const r of rooms) place(roomEls.current.get(r.id), centroid(r.points), 0);
  }, [live]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!live || !webgl) {
      // Still view: the markers only move when the card is resized
      const ro = new ResizeObserver(placeMarkers);
      ro.observe(host);
      return () => ro.disconnect();
    }
    const scene = new FloorplanScene(host, night, placeMarkers);
    sceneRef.current = scene;
    // Dev: `await __floorplanScene.exportGLB()` feeds scripts/render_floorplan.py
    if (import.meta.env.DEV) (window as unknown as { __floorplanScene?: FloorplanScene }).__floorplanScene = scene;
    return () => { scene.dispose(); sceneRef.current = null; };
    // `night` is only the initial palette: the effect below keeps it up to date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeMarkers, webgl, live]);

  // These also run again when the live scene is created (`live`)
  useEffect(() => { sceneRef.current?.setDark(night); }, [night, live]);
  useEffect(() => {
    robotPosRef.current = robotPos;
    if (sceneRef.current) sceneRef.current.setState(sceneState);
    else placeMarkers();
  }, [sceneState, robotPos, live, placeMarkers]);
  useEffect(() => { sceneRef.current?.setView(view); }, [view, live]);

  const stillLights = useMemo<StillLight[]>(
    () => devices.filter((d) => sceneState.active[d.id]).map((d) => ({ id: d.id, color: sceneState.colors[d.id] ?? WARM_WHITE })),
    [sceneState],
  );
  // Marker sizes change with labels — re-place them
  useEffect(() => { placeMarkers(); }, [showLabels, placeMarkers]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) markerEls.current.set(id, el); else markerEls.current.delete(id);
  }, []);
  const onSelect = useCallback((id: string) => setSelectedId((cur) => (cur === id ? null : id)), []);

  const selected = devices.find((d) => d.id === selectedId);
  const toolBtn = (on: boolean) =>
    `flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors active:scale-95 ${
      on ? "bg-accent-blue text-white border-accent-blue" : "bg-bg-tertiary border-border-main text-text-secondary hover:text-text-primary"
    }`;

  return (
    <div className="h-full flex flex-col bg-bg-secondary rounded-2xl border border-border-main overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-main">
        <div className="flex items-center gap-2 text-text-primary font-medium text-sm">
          <Box size={16} className="text-accent-blue" />
          Plano 3D
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={toolBtn(showLabels)} onClick={() => setShowLabels((v) => !v)} aria-pressed={showLabels}>
            <Tag size={14} />Nombres
          </button>
          {live && (
            <button type="button" className={toolBtn(view === "top")} onClick={() => setView((v) => (v === "top" ? "iso" : "top"))} aria-pressed={view === "top"}>
              <Layers2 size={14} />Planta
            </button>
          )}
          <button type="button" className={toolBtn(live)} onClick={() => setLive((v) => !v)} aria-pressed={live} title="Vista 3D interactiva">
            <Box size={14} />3D
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 min-h-0 bg-bg-tertiary"
        // Night backdrop: the lit rooms stand out against a deep blue instead of flat grey
        style={night ? { background: "radial-gradient(circle at 50% 45%, #1e293b 0%, #0b1120 75%)" } : undefined}
      >
        <div ref={hostRef} className="absolute inset-0" />
        {!live && <StillView night={night} lights={stillLights} />}

        {live && !webgl ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm">
            Este navegador no soporta WebGL
          </div>
        ) : (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {rooms.map((r) => (
              <span
                key={r.id}
                ref={(el) => { if (el) roomEls.current.set(r.id, el); else roomEls.current.delete(r.id); }}
                className="absolute left-0 top-0 px-1.5 py-0.5 rounded-md bg-bg-secondary border border-border-main text-[11px] font-semibold uppercase tracking-wide text-text-secondary select-none"
                style={{ visibility: "hidden" }}
              >
                {r.name}
              </span>
            ))}
            {devices.map((d) => (
              <DeviceMarker key={d.id} device={d} selected={d.id === selectedId} showLabel={showLabels} onSelect={onSelect} register={register} />
            ))}
          </div>
        )}

        {selected && (
          // Centred over the plan; tapping outside closes it
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedId(null)}>
          <div className="w-full max-w-sm max-h-full overflow-y-auto rounded-2xl bg-bg-secondary border border-border-main shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-medium truncate">{selected.name}</p>
                <p className="text-text-secondary text-xs truncate">{rooms.find((r) => r.id === selected.room)?.name}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setSelectedId(null)} className="p-2 rounded-xl text-text-secondary hover:text-text-primary bg-bg-tertiary">
                <X size={14} />
              </button>
            </div>
            <DeviceControl device={selected} />
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
