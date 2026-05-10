import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
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
      className="flex items-center justify-center w-10 h-10 rounded-lg
        bg-bg-tertiary text-gray-400 hover:text-white hover:bg-bg-tertiary/80
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-xs text-gray-500">{stateLabel}{positionLabel ? ` · ${positionLabel}` : ""}</p>
        </div>
        {position != null && (
          <div className="w-8 h-16 bg-bg-secondary rounded-lg relative overflow-hidden">
            <div
              className="absolute bottom-0 w-full bg-accent-blue/40 transition-all duration-300"
              style={{ height: `${position}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <CoverButton icon={<ChevronUp size={18} />} onClick={open} label="Abrir" />
        <CoverButton icon={<Square size={14} />} onClick={stop} label="Detener" />
        <CoverButton icon={<ChevronDown size={18} />} onClick={close} label="Cerrar" />
      </div>
    </div>
  );
}
