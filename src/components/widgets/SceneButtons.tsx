import { useHAStore } from "../../store/ha-store";
import { callService } from "../../lib/ha-client";
import { Sunrise } from "lucide-react";

interface SceneButtonsProps {
  scenes: { entityId: string; label: string; icon: typeof Sunrise }[];
}

export function SceneButtons({ scenes }: SceneButtonsProps) {
  const connection = useHAStore((s) => s.connection);

  const activateScene = async (entityId: string) => {
    if (!connection) return;
    await callService(connection, "scene", "turn_on", undefined, { entity_id: entityId });
  };

  return (
    <div className="flex gap-2">
      {scenes.map((scene) => (
        <button
          key={scene.entityId}
          onClick={() => activateScene(scene.entityId)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-tertiary text-text-primary
            text-sm font-medium hover:bg-bg-tertiary/80 transition-all active:scale-95"
        >
          <scene.icon size={18} />
          {scene.label}
        </button>
      ))}
    </div>
  );
}
