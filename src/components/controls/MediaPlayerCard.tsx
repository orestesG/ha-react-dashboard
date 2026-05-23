import { useEntity } from "../../hooks/useEntity";
import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { FavoriteStar } from "../ui/FavoriteStar";
import { Play, Pause, SkipBack, SkipForward, Tv, Power } from "lucide-react";

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
  const isOff = state === "off" || state === "unavailable";

  const togglePower = async () => {
    if (!connection) return;
    await callService(
      connection,
      "media_player",
      isOff ? "turn_on" : "turn_off",
      undefined,
      { entity_id: entityId }
    );
  };

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
      <div className="rounded-2xl p-4 bg-bg-tertiary animate-pulse space-y-3">
        <div className="h-5 w-24 rounded-lg bg-bg-secondary" />
        <div className="h-4 w-40 rounded-lg bg-bg-secondary" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-4 transition-colors ${isOff ? "bg-bg-secondary" : "bg-bg-tertiary"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Tv size={18} className={isOff ? "text-text-secondary" : "text-accent-blue"} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">{name}</p>
          {!isOff && mediaTitle && (
            <p className="text-xs text-text-secondary truncate">
              {mediaTitle}{mediaArtist ? ` · ${mediaArtist}` : ""}
            </p>
          )}
        </div>

        {/* State badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
          isOff
            ? "bg-bg-tertiary border-border-main text-text-secondary"
            : isPlaying
            ? "bg-accent-green/15 border-accent-green/30 text-accent-green"
            : "bg-accent-yellow/15 border-accent-yellow/30 text-accent-yellow"
        }`}>
          {isOff ? "Off" : isPlaying ? "Playing" : "Paused"}
        </span>

        <FavoriteStar entityId={entityId} />

        {/* Power toggle */}
        <button
          onClick={togglePower}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isOff
              ? "bg-accent-green/15 text-accent-green hover:bg-accent-green/25"
              : "bg-accent-red/15 text-accent-red hover:bg-accent-red/25"
          }`}
        >
          <Power size={15} />
        </button>
      </div>

      {/* Media controls — only when active */}
      {!isOff && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevTrack}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-text-primary/10 hover:bg-text-primary/20 text-text-primary flex items-center justify-center transition-all active:scale-95"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={nextTrack}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <SkipForward size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
