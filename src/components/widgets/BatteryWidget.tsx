import { useEntity } from "../../hooks/useEntity";
import { Battery, BatteryWarning, BatteryMedium, BatteryFull } from "lucide-react";

interface BatteryItem {
  entityId: string;
  name: string;
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
      <span className="text-sm text-gray-300 flex-1">{name}</span>
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

export function BatteryWidget({ sensors }: BatteryWidgetProps) {
  return (
    <div className="bg-bg-secondary rounded-2xl p-5 border border-bg-tertiary">
      <div className="flex items-center gap-2 mb-3">
        <Battery size={18} className="text-accent-green" />
        <h3 className="text-white font-semibold">Baterías</h3>
      </div>
      <div className="space-y-1">
        {sensors.map((s) => (
          <BatteryRow key={s.entityId} entityId={s.entityId} name={s.name} />
        ))}
      </div>
    </div>
  );
}
