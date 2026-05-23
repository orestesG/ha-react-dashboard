import { useEntity } from "../../hooks/useEntity";
import { Tile } from "../ui/Tile";
import { FavoriteStar } from "../ui/FavoriteStar";
import { Power } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SwitchTileProps {
  entityId: string;
  name: string;
  icon?: LucideIcon;
}

export function SwitchTile({ entityId, name, icon: Icon = Power }: SwitchTileProps) {
  const { isOn, toggle, loading } = useEntity(entityId);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-bg-tertiary animate-pulse">
        <div className="w-6 h-6 rounded bg-gray-600" />
        <div className="h-4 w-20 rounded bg-gray-600" />
      </div>
    );
  }

  return (
    <div className="relative">
      <Tile
        icon={<Icon size={20} />}
        name={name}
        state={isOn ? "Encendido" : "Apagado"}
        active={isOn}
        color={isOn ? "accent-green" : "accent-blue"}
        onClick={toggle}
      />
      <FavoriteStar entityId={entityId} className="absolute top-2 right-2 z-10" />
    </div>
  );
}
