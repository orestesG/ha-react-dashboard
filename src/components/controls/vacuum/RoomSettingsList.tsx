import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useHAStore } from "../../../store/ha-store";
import { callService } from "../../../lib/ha-client";
import {
  HUMIDITY, PASSES, ROOM_MODE, SUCTION,
  optionLabel, parseTimes, roomEntity, timesOption,
  type HumidityKey, type Passes, type RoomField, type RoomModeKey, type SuctionKey, type VacuumRoom,
} from "../../../lib/vacuum";
import { ChipField, ChipGroup } from "./ChipGroup";
import { SwitchTrack } from "./SwitchTrack";

const FIELDS: RoomField[] = ["suction_level", "mop_pad_humidity", "cleaning_mode", "cleaning_times"];

const SUCTION_CHIPS  = SUCTION.map((o) => ({ value: o.key, label: o.label }));
const HUMIDITY_CHIPS = HUMIDITY.map((o) => ({ value: o.key, label: o.label }));
const MODE_CHIPS     = ROOM_MODE.map((o) => ({ value: o.key, label: o.label }));
const PASSES_CHIPS   = PASSES.map((n) => ({ value: n, label: `${n}×` }));

interface RoomSettingsListProps {
  slug: string;
  rooms: VacuumRoom[];
  /** `switch.<slug>_customized_cleaning` — per-room settings only apply while it is on */
  customizedEntityId: string;
}

export function RoomSettingsList({ slug, rooms, customizedEntityId }: RoomSettingsListProps) {
  const connection = useHAStore((s) => s.connection);
  const customized = useHAStore((s) => s.entities[customizedEntityId]?.state);
  const states = useHAStore(useShallow((s) =>
    rooms.flatMap((r) => FIELDS.map((f) => s.entities[roomEntity(slug, r.id, f)]?.state)),
  ));
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (entityId: string, fn: () => Promise<void>) => {
    setPending(entityId);
    setError(null);
    try { await fn(); }
    catch { setError("No se pudo guardar el ajuste en el robot."); }
    finally { setPending(null); }
  };

  const setOption = (entityId: string, option: string) => {
    if (!connection) return;
    void run(entityId, () => callService(connection, "select", "select_option", { option }, { entity_id: entityId }));
  };

  const toggleCustomized = () => {
    if (!connection) return;
    void run(customizedEntityId, () =>
      callService(connection, "switch", customized === "on" ? "turn_off" : "turn_on", undefined, { entity_id: customizedEntityId }));
  };

  const isOn = customized === "on";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggleCustomized}
        disabled={!customized || pending === customizedEntityId}
        className="w-full min-h-11 flex items-center gap-3 px-4 py-2 rounded-xl border border-border-main text-left disabled:opacity-40 focus-visible:outline-none focus-visible:border-accent-blue"
        aria-pressed={isOn}
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-text-primary">Config. por habitación</span>
          <span className="block text-xs text-text-secondary">
            {isOn ? "Activada: cada habitación usa sus ajustes" : "Desactivada: el robot usa los ajustes globales"}
          </span>
        </span>
        <SwitchTrack on={isOn} />
      </button>

      {error && (
        <p className="flex items-center gap-2 text-xs text-accent-red px-1">
          <AlertTriangle size={14} className="shrink-0" /> {error}
        </p>
      )}

      {rooms.map((room, i) => {
        const [suction, humidity, mode, times] = states.slice(i * FIELDS.length, (i + 1) * FIELDS.length);
        const passes = parseTimes(times) as Passes | undefined;
        const open = expanded === room.id;
        const known = mode !== undefined && mode !== "unavailable";
        const mops = mode !== "sweeping";
        const summary = known
          ? [
              optionLabel(ROOM_MODE, mode),
              optionLabel(SUCTION, suction),
              mops ? optionLabel(HUMIDITY, humidity) : null,
              passes ? `${passes}×` : null,
            ].filter(Boolean).join(" · ")
          : "Sin ajustes disponibles";
        const busy = (f: RoomField) => pending === roomEntity(slug, room.id, f);

        return (
          <div key={room.id} className="rounded-xl border border-border-main">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : room.id)}
              disabled={!known}
              aria-expanded={open}
              className="w-full min-h-11 flex items-center gap-3 px-4 py-2 rounded-xl text-left disabled:opacity-40 border border-transparent focus-visible:outline-none focus-visible:border-accent-blue"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-text-primary capitalize truncate">{room.name}</span>
                <span className="block text-xs text-text-secondary truncate">{summary}</span>
              </span>
              {known && (open
                ? <ChevronUp size={16} className="text-text-secondary shrink-0" />
                : <ChevronDown size={16} className="text-text-secondary shrink-0" />)}
            </button>

            {open && (
              <div className="px-4 pb-4 space-y-3">
                <ChipField label="Modo">
                  <ChipGroup<RoomModeKey>
                    options={MODE_CHIPS}
                    value={mode as RoomModeKey}
                    disabled={busy("cleaning_mode")}
                    onChange={(v) => v && setOption(roomEntity(slug, room.id, "cleaning_mode"), v)}
                  />
                </ChipField>
                <ChipField label="Succión">
                  <ChipGroup<SuctionKey>
                    options={SUCTION_CHIPS}
                    value={suction as SuctionKey}
                    disabled={busy("suction_level")}
                    onChange={(v) => v && setOption(roomEntity(slug, room.id, "suction_level"), v)}
                  />
                </ChipField>
                {mops && (
                  <ChipField label="Humedad de la mopa">
                    <ChipGroup<HumidityKey>
                      options={HUMIDITY_CHIPS}
                      value={humidity as HumidityKey}
                      disabled={busy("mop_pad_humidity")}
                      onChange={(v) => v && setOption(roomEntity(slug, room.id, "mop_pad_humidity"), v)}
                    />
                  </ChipField>
                )}
                <ChipField label="Pasadas">
                  <ChipGroup<Passes>
                    options={PASSES_CHIPS}
                    value={passes}
                    disabled={busy("cleaning_times")}
                    onChange={(v) => v && setOption(roomEntity(slug, room.id, "cleaning_times"), timesOption(v))}
                  />
                </ChipField>
              </div>
            )}
          </div>
        );
      })}

      {rooms.length === 0 && (
        <p className="py-5 text-center text-xs text-text-secondary">Sin habitaciones en el mapa actual.</p>
      )}
    </div>
  );
}
