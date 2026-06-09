import { ShowerHead } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";

export function Bano() {
  return (
    <AreaCard collapseId="bano" name="Baño" icon={ShowerHead} iconColor="accent-blue">
      <SwitchTile entityId="switch.sonoff_10023775c6" name="Calefón" />
    </AreaCard>
  );
}
