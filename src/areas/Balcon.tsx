import { Trees } from "lucide-react";
import { AreaCard } from "../components/widgets/AreaCard";
import { SwitchTile } from "../components/controls/SwitchTile";

export function Balcon() {
  return (
    <AreaCard collapseId="balcon" name="Balcón" icon={Trees} iconColor="accent-green">
      <SwitchTile entityId="switch.sonoff_1002807cb6_1" name="Luz" />
    </AreaCard>
  );
}
