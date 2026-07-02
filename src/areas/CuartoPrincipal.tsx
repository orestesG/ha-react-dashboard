import { Bed } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";
import { LightTile } from "../components/controls/LightTile";
import { CoverTile } from "../components/controls/CoverTile";
import { ClimateCard } from "../components/controls/ClimateCard";

export function CuartoPrincipal() {
  return (
    <AreaCard
      collapseId="cuarto"
      name="Cuarto Principal"
      icon={Bed}
      iconColor="accent-blue"
      tempEntityId="sensor.broadlink_mini_temperature"
      humidityEntityId="sensor.broadlink_mini_humidity"
    >
      <SwitchTile entityId="switch.sonoff_10024ae259_1" name="Luz" />
      <LightTile entityId="light.gbk_h613d_323f" name="LED Cielo" />
      <CoverTile entityId="cover.sonoff_10023e3f19" name="Persiana" />
      <ClimateCard entityId="climate.aire_cuarto_principal_2" name="Aire" consoleEntityId="input_boolean.toggle_air_console_light" />
    </AreaCard>
  );
}
