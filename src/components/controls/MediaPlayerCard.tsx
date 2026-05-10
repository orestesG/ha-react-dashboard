import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Play, Pause, SkipBack, SkipForward, Tv } from "lucide-react";

interface MediaPlayerCardProps {
  entityId: string;
  name: string;
}

export function MediaPlayerCard({ entityId, name }: MediaPlayerCardProps) {
  const { entity, loading } = useEntity(entityId);
  const connection = useHAStore((s) => s.connection);

  const state = entity?.state;
  const mediaTitle = entity?.attributes?.media_title as string | undefined;
  const mediaArtist = entity?.attributes?.media_artist as string | undefined;
  const isPlaying = state === "playing";
  const isOff = state === "off" || state === "idle";

  const togglePlay = async () => {
    if (!connection) return;
    await callService(connection, "media_player", "media_play_pause", undefined, { entity_id: entityId });
  };

  const nextTrack = async () => {
    if (!connection) return;
    await callService(connection, "media_player", "media_next_track", undefined, { entity_id: entityId });
  };

  const prevTrack = async () => {
    if (!connection) return;
    await callService(connection, "media_player", "media_previous_track", undefined, { entity_id: entityId });
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded bg-gray-600" />
        <div className="h-4 w-40 rounded bg-gray-600" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 ${isOff ? "bg-bg-tertiary/50" : "bg-bg-tertiary"}`}>
      <div className="flex items-center gap-3 mb-3">
        <Tv size={20} className={isOff ? "text-gray-600" : "text-accent-blue"} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          {mediaTitle && (
            <p className="text-xs text-gray-400 truncate">
              {mediaTitle}{mediaArtist ? ` · ${mediaArtist}` : ""}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isOff ? "bg-gray-700 text-gray-500" :
          isPlaying ? "bg-accent-green/20 text-accent-green" :
          "bg-accent-yellow/20 text-accent-yellow"
        }`}>
          {isOff ? "Off" : isPlaying ? "Playing" : "Paused"}
        </span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={prevTrack} className="text-gray-400 hover:text-white transition-colors">
          <SkipBack size={20} />
        </button>
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95"
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button onClick={nextTrack} className="text-gray-400 hover:text-white transition-colors">
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}
