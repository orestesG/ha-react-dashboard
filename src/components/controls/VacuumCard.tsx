import { useState } from "react";
import { createPortal } from "react-dom";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Bot, Play, Pause, Home, Maximize2, X } from "lucide-react";
import {
  VACUUM_CLEANING_MODE_ENTITY,
  VACUUM_SUCTION_LEVEL_ENTITY,
  VACUUM_WATER_VOLUME_ENTITY,
} from "../../dashboard.config";
import { VacuumMap } from "../widgets/VacuumMap";

const MAP_ENTITY = "camera.xiaomi_robot_vacuum_x20_map";

interface Room { id: number; name: string }

interface VacuumCardProps {
  entityId: string;
  name?: string;
}

function SegmentButtons({
  options,
  current,
  onSelect,
}: {
  options: string[];
  current: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = opt === current;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
              active
                ? "bg-accent-blue/20 text-accent-blue"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
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
  const connection = useHAStore((s) => s.connection);

  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [roomSuction, setRoomSuction] = useState<string | null>(null);
  const [roomRepeats, setRoomRepeats] = useState(1);

  const state = entity?.state;
  const battery = entity?.attributes?.battery as number | undefined;
  const status = entity?.attributes?.status as string | undefined;
  const selectedMap = entity?.attributes?.selected_map as string | undefined;
  const roomsMap = entity?.attributes?.rooms as Record<string, Room[]> | undefined;
  const rooms: Room[] = (selectedMap && roomsMap?.[selectedMap]) ?? [];

  const modeOptions = (modeEnt?.attributes?.options as string[] | undefined) ?? [];
  const currentMode = modeEnt?.state ?? "";
  const suctionOptions = (suctionEnt?.attributes?.options as string[] | undefined) ?? [];
  const currentSuction = suctionEnt?.state ?? "";
  const waterOptions = (waterEnt?.attributes?.options as string[] | undefined) ?? [];
  const currentWater = waterEnt?.state ?? "";

  const isMoppingMode = currentMode.toLowerCase().includes("mop") || currentMode.toLowerCase().includes("combin");
  const isCleaning = state === "cleaning";
  const isDocked = state === "docked";

  const start = () => connection && callService(connection, "vacuum", "start", undefined, { entity_id: entityId });
  const pause = () => connection && callService(connection, "vacuum", "pause", undefined, { entity_id: entityId });
  const dock = () => connection && callService(connection, "vacuum", "return_to_base", undefined, { entity_id: entityId });
  const setSelect = (selectEntityId: string, option: string) =>
    connection && callService(connection, "select", "select_option", { option }, { entity_id: selectEntityId });

  const launchRoomClean = () => {
    if (!connection || selectedRoom == null) return;
    const data: Record<string, unknown> = { segments: selectedRoom, repeats: roomRepeats };
    if (roomSuction) data.suction_level = roomSuction;
    callService(connection, "dreame_vacuum", "vacuum_clean_segment", data, { entity_id: entityId });
    setSelectedRoom(null);
    setRoomSuction(null);
    setRoomRepeats(1);
  };

  const openRoom = (id: number) => {
    setSelectedRoom(selectedRoom === id ? null : id);
    setRoomSuction(currentSuction || null);
    setRoomRepeats(1);
  };

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

  const selectedRoomObj = rooms.find((r) => r.id === selectedRoom);

  return (
    <>
      <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main h-full flex flex-col gap-3 overflow-y-auto">
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

        <div className="relative rounded-xl overflow-hidden bg-bg-tertiary">
          <VacuumMap
            cameraEntityId={MAP_ENTITY}
            selectedRoomId={selectedRoom}
            onRoomClick={openRoom}
            className="max-h-48"
            showLabels={false}
          />
          <button
            onClick={() => setMapOpen(true)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Ampliar mapa"
          >
            <Maximize2 size={14} />
          </button>
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

        {modeOptions.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Modo</p>
            <SegmentButtons
              options={modeOptions}
              current={currentMode}
              onSelect={(v) => setSelect(VACUUM_CLEANING_MODE_ENTITY, v)}
            />
          </div>
        )}

        {suctionOptions.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Succión</p>
            <SegmentButtons
              options={suctionOptions}
              current={currentSuction}
              onSelect={(v) => setSelect(VACUUM_SUCTION_LEVEL_ENTITY, v)}
            />
          </div>
        )}

        {isMoppingMode && waterOptions.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1.5 uppercase tracking-wider">Agua</p>
            <SegmentButtons
              options={waterOptions}
              current={currentWater}
              onSelect={(v) => setSelect(VACUUM_WATER_VOLUME_ENTITY, v)}
            />
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-2 uppercase tracking-wider">Habitaciones</p>
            <div className="flex flex-wrap gap-1.5">
              {rooms.map((room) => {
                const active = selectedRoom === room.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => openRoom(room.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                      active
                        ? "bg-accent-blue/20 text-accent-blue"
                        : "bg-bg-tertiary text-text-secondary hover:bg-accent-blue/10 hover:text-accent-blue"
                    }`}
                  >
                    {room.name}
                  </button>
                );
              })}
            </div>

            {selectedRoomObj && (
              <div className="mt-3 p-3 rounded-xl bg-bg-tertiary space-y-2.5">
                <p className="text-xs text-text-primary font-medium capitalize">{selectedRoomObj.name}</p>

                {suctionOptions.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Succión</p>
                    <SegmentButtons
                      options={suctionOptions}
                      current={roomSuction ?? ""}
                      onSelect={(v) => setRoomSuction(v)}
                    />
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-text-secondary mb-1 uppercase tracking-wider">Pasadas</p>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((n) => {
                      const active = roomRepeats === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setRoomRepeats(n)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? "bg-accent-blue/20 text-accent-blue"
                              : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={launchRoomClean}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-green/20 text-accent-green text-sm font-medium hover:bg-accent-green/30 transition-all"
                >
                  <Play size={14} /> Limpiar habitación
                </button>
              </div>
            )}
          </div>
        )}
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
              selectedRoomId={selectedRoom}
              onRoomClick={openRoom}
              showLabels={true}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
