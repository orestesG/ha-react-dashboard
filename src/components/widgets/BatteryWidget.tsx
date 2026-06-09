import { useEntity } from "../../hooks/useEntity";
import { useCollapseStore } from "../../store/collapse-store";
import { Battery, ChevronDown, ChevronUp, BatteryWarning, BatteryMedium, BatteryFull } from "lucide-react";

interface BatteryItem {
  entityId: string;
  name: string;
  area?: string;
}

interface BatteryWidgetProps {
  sensors: BatteryItem[];
}

function BatteryIcon({ level }: { level: number }) {
  if (level < 20) return <BatteryWarning size={16} className="text-accent-red" />;
  if (level < 50) return <Battery size={16} className="text-accent-yellow" />;
  if (level < 80) return <BatteryMedium size={16} className="text-accent-green" />;
  return <BatteryFull size={16} className="text-accent-green" />;
}

function BatteryRow({ entityId, name }: BatteryItem) {
  const { entity } = useEntity(entityId);
  const level = parseFloat(entity?.state ?? "NaN");
  const valid = !isNaN(level);

  if (!valid) return null;

  const color = level < 20 ? "text-accent-red" : level < 50 ? "text-accent-yellow" : "text-accent-green";

  return (
    <div className="flex items-center gap-3 py-1.5">
      <BatteryIcon level={level} />
      <span className="text-sm text-text-primary flex-1">{name}</span>
      <span className={`text-sm font-medium ${color}`}>{level}%</span>
      <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${level < 20 ? "bg-accent-red" : level < 50 ? "bg-accent-yellow" : "bg-accent-green"}`}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  );
}

function AreaGroup({ area, items }: { area: string; items: BatteryItem[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide mt-3 mb-0.5 first:mt-0">
        {area}
      </p>
      {items.map((s) => (
        <BatteryRow key={s.entityId} {...s} />
      ))}
    </div>
  );
}

export function BatteryWidget({ sensors }: BatteryWidgetProps) {
  const hasAreas = sensors.some((s) => s.area);

  const groups: { area: string; items: BatteryItem[] }[] = [];
  if (hasAreas) {
    const seen = new Map<string, BatteryItem[]>();
    for (const s of sensors) {
      const key = s.area ?? "";
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(s);
    }
    seen.forEach((items, area) => groups.push({ area, items }));
  }

  const toggleBattery = useCollapseStore((s) => s.toggle);
  const batteryCollapsed = useCollapseStore((s) => s.isCollapsed('battery'));

  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-border-main">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Battery size={18} className="text-accent-green" />
          <h3 className="text-text-primary font-semibold">Baterías</h3>
        </div>
        <button onClick={() => toggleBattery('battery')} className="p-1 rounded-lg text-text-secondary hover:text-text-primary transition-colors">
          {batteryCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {!batteryCollapsed && (
        <div>
          {hasAreas
            ? groups.map((g) => <AreaGroup key={g.area} area={g.area} items={g.items} />)
            : sensors.map((s) => <BatteryRow key={s.entityId} {...s} />)}
        </div>
      )}
    </div>
  );
}
