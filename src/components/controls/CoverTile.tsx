import { useState, useRef, useCallback } from "react";
import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { FavoriteStar } from "../ui/FavoriteStar";
import { ChevronUp, ChevronDown, Square } from "lucide-react";

interface CoverTileProps {
  entityId: string;
  name: string;
}

function CoverButton({
  icon,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center w-11 h-11 rounded-xl
        bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80
        transition-all active:scale-95"
    >
      {icon}
    </button>
  );
}

export function CoverTile({ entityId, name }: CoverTileProps) {
  const { entity, loading } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const position = entity?.attributes?.current_position as number | null | undefined;

  // Draggable position bar state
  const [localPos, setLocalPos] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const displayPos = localPos ?? position ?? 0;

  const calcPos = useCallback((clientY: number): number => {
    if (!barRef.current) return displayPos;
    const r = barRef.current.getBoundingClientRect();
    const pct = (clientY - r.top) / r.height;
    return Math.round(Math.max(0, Math.min(100, 100 - pct * 100)));
  }, [displayPos]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setLocalPos(calcPos(e.clientY));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setLocalPos(calcPos(e.clientY));
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    const finalPos = calcPos(e.clientY);
    setLocalPos(null);
    if (connection) {
      await callService(connection, "cover", "set_cover_position", { position: finalPos }, { entity_id: entityId });
    }
  };

  const open = async () => {
    if (!connection) return;
    await callService(connection, "cover", "open_cover", undefined, { entity_id: entityId });
  };

  const close = async () => {
    if (!connection) return;
    await callService(connection, "cover", "close_cover", undefined, { entity_id: entityId });
  };

  const stop = async () => {
    if (!connection) return;
    await callService(connection, "cover", "stop_cover", undefined, { entity_id: entityId });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-bg-tertiary animate-pulse">
        <div className="w-6 h-6 rounded bg-gray-600" />
        <div className="h-4 w-20 rounded bg-gray-600" />
      </div>
    );
  }

  const stateLabel =
    state === "open" ? "Abierta" :
    state === "closed" ? "Cerrada" :
    state === "opening" ? "Abriendo..." :
    state === "closing" ? "Cerrando..." :
    state ?? "—";

  const positionLabel = position != null ? `${position}%` : "";

  return (
    <div className="bg-bg-tertiary rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">{name}</p>
          <p className="text-xs text-text-secondary">{stateLabel}{positionLabel ? ` · ${positionLabel}` : ""}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <FavoriteStar entityId={entityId} />
          {position != null && (
            <div
              ref={barRef}
              className="w-11 h-24 bg-bg-secondary rounded-lg relative overflow-hidden cursor-ns-resize touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => { setIsDragging(false); setLocalPos(null); }}
              title={`${displayPos}% — arrastrar para ajustar`}
            >
              {/* Closed fill (top) */}
              <div
                className={`absolute top-0 w-full bg-accent-blue/40 ${isDragging ? "" : "transition-all duration-300"}`}
                style={{ height: `${100 - displayPos}%` }}
              />
              {/* Boundary handle line */}
              <div
                className={`absolute w-full h-0.5 ${isDragging ? "bg-accent-blue" : "bg-accent-blue/60"} ${isDragging ? "" : "transition-all duration-300"}`}
                style={{ top: `${100 - displayPos}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <CoverButton icon={<ChevronUp size={18} />} onClick={open} label="Abrir" />
        <CoverButton icon={<Square size={14} />} onClick={stop} label="Detener" />
        <CoverButton icon={<ChevronDown size={18} />} onClick={close} label="Cerrar" />
      </div>
    </div>
  );
}
