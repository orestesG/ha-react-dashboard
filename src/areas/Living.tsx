import { Sofa } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";
import { LightTile } from "../components/controls/LightTile";
import { CoverTile } from "../components/controls/CoverTile";
import { MediaPlayerCard } from "../components/controls/MediaPlayerCard";
import { ClimateCard } from "../components/controls/ClimateCard";

export function Living() {
  return (
    <AreaCard
      name="Living"
      icon={Sofa}
      iconColor="accent-green"
      tempEntityId="sensor.living_room_sensor_temperature"
      humidityEntityId="sensor.living_room_sensor_humidity"
    >
      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
        <SwitchTile entityId="switch.sonoff_1002807067_1" name="Luz Principal" />
        <SwitchTile entityId="switch.sonoff_10020c54d4_1" name="Cenefa" />
      </div>
      <LightTile entityId="light.sonoff_1002307762" name="Espejo LED" />
      <CoverTile entityId="cover.sonoff_10023e4c70" name="Persiana" />
      <CoverTile entityId="cover.curtain_3_c564" name="Cortina" />
      <MediaPlayerCard entityId="media_player.the_premiere" name="TV" />
      <ClimateCard entityId="climate.el_seco" name="El Seco" />
    </AreaCard>
  );
}
