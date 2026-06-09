import { DoorOpen } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";

export function EntradaPasillo() {
  return (
    <AreaCard collapseId="pasillo" name="Entrada & Pasillo" icon={DoorOpen} iconColor="accent-yellow">
      <SwitchTile entityId="switch.sonoff_10024b38be_1" name="Luz Entrada" />
      <SwitchTile entityId="switch.sonoff_10024b3909_1" name="Luz Pasillo" />
    </AreaCard>
  );
}
