import { Armchair } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";
import { LightTile } from "../components/controls/LightTile";
import { CoverTile } from "../components/controls/CoverTile";
import { ClimateCard } from "../components/controls/ClimateCard";
import { useEntity } from "../hooks/useEntity";
import { Activity } from "lucide-react";

function MotionSensor({ entityId }: { entityId: string }) {
  const { entity } = useEntity(entityId);
  const isActive = entity?.state === "on";
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${isActive ? "bg-accent-green/20 text-accent-green" : "bg-bg-tertiary text-gray-500"}`}>
      <Activity size={16} />
      <span>Movimiento</span>
      <span className="ml-auto">{isActive ? "Detectado" : "—"}</span>
    </div>
  );
}

export function Oficina() {
  return (
    <AreaCard
      collapseId="oficina"
      name="Oficina"
      icon={Armchair}
      iconColor="accent-purple"
      tempEntityId="sensor.broadlink_mini_2_temperature"
      humidityEntityId="sensor.broadlink_mini_2_humidity"
    >
      <SwitchTile entityId="switch.sonoff_10024ae654_1" name="Luz" />
      <LightTile entityId="light.philips_strip5_9631_light" name="LED Monitor" />
      <CoverTile entityId="cover.sonoff_10023e3f9e" name="Persiana" />
      <ClimateCard entityId="climate.aire_cuarto_chico" name="Aire" consoleEntityId="input_boolean.toggle_air_console_light" />
      <SwitchTile entityId="switch.sonoff_10023c5cd0" name="Suko" />
      <MotionSensor entityId="binary_sensor.sensor_movimiento_occupancy" />
    </AreaCard>
  );
}
