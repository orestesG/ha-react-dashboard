// Shell of the "Plano 3D" panel: the floor plan card filling the screen
import { useHA } from "./hooks/useHA";
import { FloorplanCard } from "./components/widgets/FloorplanCard";

const HA_URL = import.meta.env.VITE_HA_URL || "";
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN || "";

export default function PlanoApp({ panelMode = false }: { panelMode?: boolean }) {
  // In dev it connects with .env.local; inside HA, panel-element injects HA's connection
  const { error } = useHA(panelMode ? undefined : HA_URL, panelMode ? undefined : HA_TOKEN);

  return (
    <div className="h-screen bg-bg-primary p-4 md:p-6 flex flex-col gap-3">
      {error && !panelMode && <p className="text-sm text-accent-red">{error}</p>}
      <div className="flex-1 min-h-0">
        <FloorplanCard />
      </div>
    </div>
  );
}
