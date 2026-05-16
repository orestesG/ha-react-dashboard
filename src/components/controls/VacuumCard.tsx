import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Bot, Play, Pause, Home } from "lucide-react";

interface VacuumCardProps {
  entityId: string;
  name?: string;
}

export function VacuumCard({ entityId, name = "Robot" }: VacuumCardProps) {
  const { entity, loading } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const battery = entity?.attributes?.battery_level as number | null | undefined;
  const status = entity?.attributes?.status as string | null | undefined;

  const start = async () => {
    if (!connection) return;
    await callService(connection, "vacuum", "start", undefined, { entity_id: entityId });
  };

  const pause = async () => {
    if (!connection) return;
    await callService(connection, "vacuum", "pause", undefined, { entity_id: entityId });
  };

  const returnToBase = async () => {
    if (!connection) return;
    await callService(connection, "vacuum", "return_to_base", undefined, { entity_id: entityId });
  };

  const isCleaning = state === "cleaning";
  const isDocked = state === "docked";

  const batteryColor = battery != null
    ? battery < 20 ? "text-accent-red" : battery < 50 ? "text-accent-yellow" : "text-accent-green"
    : "text-gray-500";

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded bg-gray-600" />
        <div className="h-4 w-32 rounded bg-gray-600" />
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot size={22} className={isDocked ? "text-text-secondary" : "text-accent-blue"} />
          <span className="text-text-primary font-medium">{name}</span>
        </div>
        {battery != null && (
          <span className={`text-sm font-medium ${batteryColor}`}>
            {battery}%
          </span>
        )}
      </div>

      <p className="text-sm text-text-secondary mb-4">
        {status ?? (isDocked ? "En base" : isCleaning ? "Limpiando..." : state)}
      </p>

      <div className="flex gap-2">
        {isCleaning ? (
          <button onClick={pause}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-yellow/20 text-accent-yellow text-sm font-medium hover:bg-accent-yellow/30 transition-all">
            <Pause size={16} /> Pausar
          </button>
        ) : (
          <button onClick={start}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-green/20 text-accent-green text-sm font-medium hover:bg-accent-green/30 transition-all">
            <Play size={16} /> Iniciar
          </button>
        )}
        <button onClick={returnToBase}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium hover:text-text-primary transition-all">
          <Home size={16} /> Base
        </button>
      </div>
    </div>
  );
}
