import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import type { ResponsiveLayouts } from 'react-grid-layout'
import { useEffect } from 'react'
import { useHA } from "./hooks/useHA";
import { useHAStore } from "./store/ha-store";
import { useLayoutStore } from "./store/layout-store";
import { useFavoritesStore } from "./store/favorites-store";
import { useVacuumStore } from "./store/vacuum-store";
import { Living } from "./areas/Living";
import { Cocina } from "./areas/Cocina";
import { Oficina } from "./areas/Oficina";
import { CuartoPrincipal } from "./areas/CuartoPrincipal";
import { Bano } from "./areas/Bano";
import { EntradaPasillo } from "./areas/EntradaPasillo";
import { Balcon } from "./areas/Balcon";
import { WeatherWidget } from "./components/widgets/WeatherWidget";
import { EnergyChart } from "./components/widgets/EnergyChart";
import { BatteryWidget } from "./components/widgets/BatteryWidget";
import { SceneButtons } from "./components/widgets/SceneButtons";
import { VacuumCard } from "./components/controls/VacuumCard";
import { FavoritesCard } from "./components/widgets/FavoritesCard";
import { WeatherChip } from "./components/widgets/WeatherChip";
import { EnergyChip } from "./components/widgets/EnergyChip";
import { CommuteCard } from "./components/widgets/CommuteCard";
import { CommuteChip } from "./components/widgets/CommuteChip";
import { ExchangeRateCard } from "./components/widgets/ExchangeRateCard";
import { TabBar } from "./components/ui/TabBar";
import { GridSkeleton } from "./components/ui/GridSkeleton";
import { LayoutGrid, RotateCcw, Check } from "lucide-react";
import { PERSON_ENTITY, VACUUM_ENTITY, batterySensors, scenes, commuteRoutes } from "./dashboard.config";

const HA_URL = import.meta.env.VITE_HA_URL || "";
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN || "";

interface AppProps {
  panelMode?: boolean;
}

function GridItem({ editMode, children }: { editMode: boolean; children: React.ReactNode }) {
  return (
    <div className="relative h-full">
      {editMode && (
        <div className="absolute inset-0 z-10 rounded-2xl cursor-grab active:cursor-grabbing bg-accent-blue/5 border-2 border-dashed border-accent-blue/30" />
      )}
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function App({ panelMode = false }: AppProps) {
  const { isConnected, error, entityCount } = useHA(
    panelMode ? undefined : HA_URL,
    panelMode ? undefined : HA_TOKEN,
  );
  const connect = useHAStore((s) => s.connect);
  const connection = useHAStore((s) => s.connection);
  const { tabs, activeTabId, setActiveTab, editMode, setLayouts, toggleEditMode, resetLayouts, syncFromHA, haLoaded: layoutLoaded } = useLayoutStore();
  const syncFavoritesFromHA = useFavoritesStore((s) => s.syncFromHA);
  const favoritesLoaded = useFavoritesStore((s) => s.haLoaded);
  const syncVacuumFromHA = useVacuumStore((s) => s.syncFromHA);
  const vacuumLoaded = useVacuumStore((s) => s.haLoaded);
  const haLoading = isConnected && (!layoutLoaded || !favoritesLoaded || !vacuumLoaded);

  useEffect(() => {
    if (connection) {
      void syncFromHA(connection);
      void syncFavoritesFromHA(connection);
      void syncVacuumFromHA(connection);
    }
  }, [connection]); // eslint-disable-line react-hooks/exhaustive-deps
  const { width, containerRef } = useContainerWidth({ measureBeforeMount: true });

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const items = activeTab.itemIds;

  if (!panelMode && (!HA_URL || !HA_TOKEN)) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="bg-bg-secondary rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-text-primary text-2xl font-semibold mb-4">
            Configuración requerida
          </h1>
          <p className="text-text-secondary mb-4">
            Crea un archivo <code className="text-accent-blue">.env.local</code> con:
          </p>
          <pre className="bg-bg-tertiary text-text-primary rounded-xl p-4 text-left text-sm">
            VITE_HA_URL=http://homeassistant.local:8123{"\n"}
            VITE_HA_TOKEN=tu_token_aqui
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 md:px-6 pb-4 md:pb-6">
      <div className="sticky top-0 z-30 bg-bg-primary -mx-4 md:-mx-6 px-4 md:px-6">
      <header className="pt-4 md:pt-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-text-primary text-xl md:text-2xl font-semibold">
            Dashboard
          </h1>
          {isConnected && (
            <p className="text-text-secondary text-sm">{entityCount} entidades</p>
          )}
        </div>
        <div className="flex items-center flex-wrap justify-end gap-3">
          <WeatherChip />
          <EnergyChip />
          <CommuteChip routes={commuteRoutes} personEntityId={PERSON_ENTITY} />
          <SceneButtons scenes={scenes} />

          {editMode && (
            <button
              onClick={resetLayouts}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary transition-colors"
            >
              <RotateCcw size={13} />
              Restablecer
            </button>
          )}
          <button
            onClick={toggleEditMode}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors ${
              editMode
                ? "bg-accent-blue text-white border-accent-blue"
                : "bg-bg-secondary border-border-main text-text-secondary hover:text-text-primary"
            }`}
          >
            {editMode ? <Check size={13} /> : <LayoutGrid size={13} />}
            {editMode ? "Listo" : "Editar"}
          </button>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-accent-green">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                Online
              </span>
            ) : error ? (
              <span className="text-xs text-accent-red flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                Error
              </span>
            ) : (
              <span className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Conectando...
              </span>
            )}
          </div>
        </div>
      </header>

      {error && !panelMode && (
        <div className="mb-3 bg-accent-red/10 border border-accent-red/20 rounded-2xl p-4 text-sm text-accent-red">
          {error}
          <button
            onClick={() => connect(HA_URL, HA_TOKEN)}
            className="ml-3 underline hover:text-text-primary"
          >
            Reintentar
          </button>
        </div>
      )}

      <TabBar tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTab} />
      </div>

      <div ref={containerRef} className={editMode ? "layout-edit-mode" : ""}>
        {haLoading ? <GridSkeleton /> : (
          <ResponsiveGridLayout
            width={width}
            layouts={activeTab.layouts}
            breakpoints={{ lg: 1280, md: 768, sm: 0 }}
            cols={{ lg: 4, md: 2, sm: 1 }}
            rowHeight={100}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            dragConfig={{ enabled: editMode }}
            resizeConfig={{ enabled: editMode, handles: ['se'] as const }}
            onLayoutChange={(_layout: unknown, allLayouts: ResponsiveLayouts) => setLayouts(allLayouts)}
          >
            {items.includes('favorites')      && <div key="favorites"><GridItem editMode={false}><FavoritesCard /></GridItem></div>}
            {items.includes('living')         && <div key="living"><GridItem editMode={editMode}><Living /></GridItem></div>}
            {items.includes('cocina')         && <div key="cocina"><GridItem editMode={editMode}><Cocina /></GridItem></div>}
            {items.includes('oficina')        && <div key="oficina"><GridItem editMode={editMode}><Oficina /></GridItem></div>}
            {items.includes('cuarto')         && <div key="cuarto"><GridItem editMode={editMode}><CuartoPrincipal /></GridItem></div>}
            {items.includes('bano')           && <div key="bano"><GridItem editMode={editMode}><Bano /></GridItem></div>}
            {items.includes('pasillo')        && <div key="pasillo"><GridItem editMode={editMode}><EntradaPasillo /></GridItem></div>}
            {items.includes('balcon')         && <div key="balcon"><GridItem editMode={editMode}><Balcon /></GridItem></div>}
            {items.includes('vacuum')         && <div key="vacuum"><GridItem editMode={editMode}><VacuumCard entityId={VACUUM_ENTITY} name="Robot" /></GridItem></div>}
            {items.includes('weather')        && <div key="weather"><GridItem editMode={editMode}><WeatherWidget /></GridItem></div>}
            {items.includes('energy')         && <div key="energy"><GridItem editMode={editMode}><EnergyChart /></GridItem></div>}
            {items.includes('battery')        && <div key="battery"><GridItem editMode={editMode}><BatteryWidget sensors={batterySensors} /></GridItem></div>}
            {items.includes('commute')        && <div key="commute"><GridItem editMode={editMode}><CommuteCard routes={commuteRoutes} personEntityId={PERSON_ENTITY} /></GridItem></div>}
            {items.includes('exchange-rates') && <div key="exchange-rates"><GridItem editMode={editMode}><ExchangeRateCard /></GridItem></div>}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}

export default App;
