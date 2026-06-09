import type { ReactNode } from "react";
import { createElement } from "react";
import { useEntity } from "../../hooks/useEntity";
import { MetricChip } from "../ui/MetricChip";
import { Thermometer, Droplets, ChevronDown, ChevronUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCollapseStore } from "../../store/collapse-store";

interface AreaCardProps {
  name: string;
  icon: LucideIcon;
  iconColor: string;
  tempEntityId?: string;
  humidityEntityId?: string;
  collapseId?: string;
  children: ReactNode;
}

const iconColorMap: Record<string, string> = {
  "accent-green": "text-accent-green",
  "accent-orange": "text-accent-orange",
  "accent-purple": "text-accent-purple",
  "accent-blue": "text-accent-blue",
  "accent-yellow": "text-accent-yellow",
  "accent-red": "text-accent-red",
};

export function AreaCard({
  name,
  icon,
  iconColor,
  tempEntityId,
  humidityEntityId,
  collapseId,
  children,
}: AreaCardProps) {
  const tempEntityResult = useEntity(tempEntityId ?? "");
  const humEntityResult = useEntity(humidityEntityId ?? "");
  const toggle = useCollapseStore((s) => s.toggle);
  const isCollapsed = useCollapseStore((s) => s.isCollapsed);
  const collapsed = collapseId ? isCollapsed(collapseId) : false;

  const tempValue = tempEntityId ? tempEntityResult.entity?.state : undefined;
  const humValue = humidityEntityId ? humEntityResult.entity?.state : undefined;

  return (
    <div className="h-full flex flex-col bg-bg-secondary rounded-2xl border border-border-main overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className={iconColorMap[iconColor] ?? "text-accent-blue"}>
            {createElement(icon, { size: 20 })}
          </span>
          <h3 className="text-text-primary font-semibold text-base">{name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {tempValue && (
            <MetricChip
              icon={<Thermometer size={12} />}
              value={tempValue}
              unit="°"
              color="blue"
            />
          )}
          {humValue && (
            <MetricChip
              icon={<Droplets size={12} />}
              value={humValue}
              unit="%"
              color="blue"
            />
          )}
          {collapseId && (
            <button
              onClick={() => toggle(collapseId)}
              className="p-1 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="px-5 pb-4 space-y-2 flex-1 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}
