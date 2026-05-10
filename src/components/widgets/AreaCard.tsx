import type { ReactNode } from "react";
import { useEntity } from "../../hooks/useEntity";
import { MetricChip } from "../ui/MetricChip";
import { Thermometer, Droplets } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createElement } from "react";

interface AreaCardProps {
  name: string;
  icon: LucideIcon;
  iconColor: string;
  tempEntityId?: string;
  humidityEntityId?: string;
  children: ReactNode;
}

export function AreaCard({
  name,
  icon,
  iconColor,
  tempEntityId,
  humidityEntityId,
  children,
}: AreaCardProps) {
  const tempEntityResult = useEntity(tempEntityId ?? "");
  const humEntityResult = useEntity(humidityEntityId ?? "");

  const tempValue = tempEntityId ? tempEntityResult.entity?.state : undefined;
  const humValue = humidityEntityId ? humEntityResult.entity?.state : undefined;

  return (
    <div className="bg-bg-secondary rounded-2xl border border-bg-tertiary overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className={`text-${iconColor}-500`}>
            {createElement(icon, { size: 20 })}
          </span>
          <h3 className="text-white font-semibold text-base">{name}</h3>
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
        </div>
      </div>
      <div className="px-5 pb-4 space-y-2">
        {children}
      </div>
    </div>
  );
}
