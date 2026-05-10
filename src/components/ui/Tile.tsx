import type { ReactNode } from "react";

interface TileProps {
  icon: ReactNode;
  name: string;
  state?: string;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  className?: string;
}

export function Tile({
  icon,
  name,
  state,
  active = false,
  onClick,
  color = "accent-blue",
  className = "",
}: TileProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    "accent-blue": { bg: "bg-accent-blue/20", text: "text-accent-blue" },
    "accent-green": { bg: "bg-accent-green/20", text: "text-accent-green" },
    "accent-yellow": { bg: "bg-accent-yellow/20", text: "text-accent-yellow" },
    "accent-orange": { bg: "bg-accent-orange/20", text: "text-accent-orange" },
    "accent-red": { bg: "bg-accent-red/20", text: "text-accent-red" },
    "accent-purple": { bg: "bg-accent-purple/20", text: "text-accent-purple" },
  };

  const activeColors = colorMap[color] || colorMap["accent-blue"];

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 rounded-xl px-4 py-3 w-full transition-all duration-150
        ${active
          ? `${activeColors.bg} ${activeColors.text}`
          : "bg-bg-tertiary text-gray-400 hover:bg-bg-tertiary/80"}
        ${className}
      `}
    >
      <span className="shrink-0">{icon}</span>
      <div className="text-left min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {state !== undefined && (
          <p className={`text-xs ${active ? "opacity-80" : "text-gray-500"}`}>
            {state}
          </p>
        )}
      </div>
    </button>
  );
}
