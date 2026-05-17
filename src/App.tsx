import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import type { Layouts } from 'react-grid-layout'
import { useHA } from "./hooks/useHA";
import { useHAStore } from "./store/ha-store";
import { useLayoutStore } from "./store/layout-store";
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
import { Sunrise, Moon, LayoutGrid, RotateCcw, Check } from "lucide-react";

const HA_URL = import.meta.env.VITE_HA_URL || "";
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN || "";

const batterySensors = [
  { entityId: "sensor.detector_fuga_agua_battery", name: "Detector Agua 1", area: "Cocina" },
  { entityId: "sensor.cocina_dtector_fuga_agua_battery", name: "Detector Agua 2", area: "Cocina" },
  { entityId: "sensor.living_room_sensor_battery", name: "Temp-Humedad", area: "Living" },
  { entityId: "sensor.curtain_3_c564_battery", name: "Cortina SwitchBot", area: "Cuarto" },
  { entityId: "sensor.vibration_sensor_battery", name: "Vibración", area: "Oficina" },
  { entityId: "sensor.sensor_movimiento_battery", name: "Movimiento", area: "Oficina" },
  { entityId: "sensor.sonoff_snzb_02d_battery", name: "Temp-Humedad", area: "Cocina" },
  { entityId: "sensor.ewelink_snzb_03p_battery", name: "Movimiento", area: "Pasillo" },
  { entityId: "sensor.xiaomi_c102gl_43cb_battery_level", name: "Robot Aspirador", area: "General" },
];

const scenes = [
  { entityId: "scene.buen_dia", label: "Buen día", icon: Sunrise },
  { entityId: "scene.modo_sueno", label: "Modo sueño", icon: Moon },
];

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
  const { layouts, editMode, setLayouts, toggleEditMode, resetLayouts } = useLayoutStore();
  const { width, containerRef } = useContainerWidth({ measureBeforeMount: true });

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
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-text-primary text-xl md:text-2xl font-semibold">
            Dashboard
          </h1>
          {isConnected && (
            <p className="text-text-secondary text-sm">{entityCount} entidades</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SceneButtons scenes={scenes} />

          {/* Edit layout controls */}
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
        <div className="mb-4 bg-accent-red/10 border border-accent-red/20 rounded-2xl p-4 text-sm text-accent-red">
          {error}
          <button
            onClick={() => connect(HA_URL, HA_TOKEN)}
            className="ml-3 underline hover:text-text-primary"
          >
            Reintentar
          </button>
        </div>
      )}

      <div ref={containerRef} className={editMode ? "layout-edit-mode" : ""}>
        <ResponsiveGridLayout
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1280, md: 768, sm: 0 }}
          cols={{ lg: 4, md: 2, sm: 1 }}
          rowHeight={100}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          isDraggable={editMode}
          isResizable={editMode}
          onLayoutChange={(_layout: unknown, allLayouts: Layouts) => setLayouts(allLayouts)}
          resizeHandles={['se']}
          useCSSTransforms
        >
          <div key="living"><GridItem editMode={editMode}><Living /></GridItem></div>
          <div key="cocina"><GridItem editMode={editMode}><Cocina /></GridItem></div>
          <div key="oficina"><GridItem editMode={editMode}><Oficina /></GridItem></div>
          <div key="cuarto"><GridItem editMode={editMode}><CuartoPrincipal /></GridItem></div>
          <div key="bano"><GridItem editMode={editMode}><Bano /></GridItem></div>
          <div key="pasillo"><GridItem editMode={editMode}><EntradaPasillo /></GridItem></div>
          <div key="balcon"><GridItem editMode={editMode}><Balcon /></GridItem></div>
          <div key="vacuum"><GridItem editMode={editMode}><VacuumCard entityId="vacuum.xiaomi_c102gl_43cb_robot_cleaner" name="Robot" /></GridItem></div>
          <div key="weather"><GridItem editMode={editMode}><WeatherWidget /></GridItem></div>
          <div key="energy"><GridItem editMode={editMode}><EnergyChart /></GridItem></div>
          <div key="battery"><GridItem editMode={editMode}><BatteryWidget sensors={batterySensors} /></GridItem></div>
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

export default App;
