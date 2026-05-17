import { CookingPot } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";
import { useEntity } from "../hooks/useEntity";
import { AlertTriangle, Battery, Droplets } from "lucide-react";

function LeakSensor({ entityId, batteryEntityId, name }: { entityId: string; batteryEntityId?: string; name: string }) {
  const { entity } = useEntity(entityId);
  const batteryResult = useEntity(batteryEntityId ?? "");
  const isLeaking = entity?.state === "on";
  const battery = batteryEntityId ? batteryResult.entity?.state : undefined;

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isLeaking ? "bg-accent-red/20" : "bg-bg-tertiary"}`}>
      <Droplets size={16} className={isLeaking ? "text-accent-red" : "text-text-secondary"} />
      <span className="text-sm text-text-primary flex-1">{name}</span>
      {isLeaking && <AlertTriangle size={16} className="text-accent-red animate-pulse" />}
      {battery !== undefined && (
        <span className="text-xs text-text-secondary flex items-center gap-1">
          <Battery size={12} /> {battery}%
        </span>
      )}
    </div>
  );
}

export function Cocina() {
  return (
    <AreaCard
      name="Cocina"
      icon={CookingPot}
      iconColor="accent-orange"
      tempEntityId="sensor.sonoff_snzb_02d_temperature"
      humidityEntityId="sensor.sonoff_snzb_02d_humidity"
    >
      <SwitchTile entityId="switch.sonoff_10027c9f9d_1" name="Luz" />
      <LeakSensor
        entityId="binary_sensor.detector_fuga_agua"
        batteryEntityId="sensor.detector_fuga_agua_battery"
        name="Detector Agua 1"
      />
      <LeakSensor
        entityId="binary_sensor.cocina_dtector_fuga_agua"
        batteryEntityId="sensor.cocina_dtector_fuga_agua_battery"
        name="Detector Agua 2"
      />
    </AreaCard>
  );
}
