import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ResponsiveGridLayout, getBreakpointFromWidth, useContainerWidth } from 'react-grid-layout'
import type { EventCallback, ResponsiveLayouts } from 'react-grid-layout'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useHA } from "./hooks/useHA";
import { useHAStore } from "./store/ha-store";
import { GRID_GAP, useLayoutStore } from "./store/layout-store";
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
import { LayoutGrid, RotateCcw, Check, GripHorizontal } from "lucide-react";
import { PERSON_ENTITY, VACUUM_ENTITY, batterySensors, scenes, commuteRoutes } from "./dashboard.config";

const HA_URL = import.meta.env.VITE_HA_URL || "";
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN || "";

interface AppProps {
  panelMode?: boolean;
}

const BREAKPOINTS = { lg: 1280, md: 768, sm: 0 };
const COLS = { lg: 4, md: 2, sm: 1 };

// Cards that stretch to fill their cell (the robot's map grows with it); the rest shrink to their content
const FILL_ITEMS = new Set(["vacuum"]);

type Fits = Record<string, number>;

/** Each fitting card's height is its content, capped by the stored height */
function fitToContent(layouts: ResponsiveLayouts, fits: Fits): ResponsiveLayouts {
  return Object.fromEntries(Object.entries(layouts).map(([bp, layout]) => [bp, layout?.map((item) =>
    fits[item.i] === undefined ? item : { ...item, h: Math.min(item.h, fits[item.i] + GRID_GAP) },
  )]));
}

interface Resized { bp: string; i: string; h: number }

/** RGL reports the fitted heights — persist the stored ones (the user's max), except for the card just resized */
function withStoredHeights(next: ResponsiveLayouts, stored: ResponsiveLayouts, resized: Resized | null): ResponsiveLayouts {
  return Object.fromEntries(Object.entries(next).map(([bp, layout]) => [bp, layout?.map((item) => {
    if (resized?.bp === bp && resized.i === item.i) return { ...item, h: resized.h };
    const h = stored[bp]?.find((s) => s.i === item.i)?.h;
    return h === undefined || FILL_ITEMS.has(item.i) ? item : { ...item, h };
  })]));
}

function findHeight(layouts: ResponsiveLayouts, bp: string, id: string): number | undefined {
  const own = layouts[bp]?.find((l) => l.i === id);
  if (own) return own.h;
  for (const layout of Object.values(layouts)) {
    const item = layout?.find((l) => l.i === id);
    if (item) return item.h;
  }
  return undefined;
}

interface GridItemProps {
  id: string;
  editMode: boolean;
  /** Stored height (gap included); fitting cards never grow past it */
  maxH?: number;
  /** Set for fitting cards: reports the content height */
  onFit?: (id: string, px: number) => void;
  children: React.ReactNode;
}

function GridItem({ id, editMode, maxH, onFit, children }: GridItemProps) {
  const fitRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el || !onFit) return;
    const ro = new ResizeObserver(() => onFit(id, Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, onFit]);

  return (
    // The bottom padding is the vertical gap between cards (the grid's own vertical margin is 0)
    <div className="relative h-full" style={{ paddingBottom: GRID_GAP }}>
      {editMode && (
        <div className="absolute inset-x-0 top-0 z-10 rounded-2xl bg-accent-blue/5 border-2 border-dashed border-accent-blue/30" style={{ bottom: GRID_GAP }}>
          {/* Solo este strip inicia el drag — el resto de la card queda libre para scroll */}
          <div className="drag-handle absolute top-0 left-0 right-0 h-10 flex items-center justify-center rounded-t-2xl cursor-grab active:cursor-grabbing select-none">
            <GripHorizontal size={16} className="text-accent-blue/60" />
          </div>
        </div>
      )}
      {onFit ? (
        // Auto height: cards that scroll inside (overflow-hidden root) shrink to maxH; the rest scroll here
        <div
          ref={fitRef}
          className="grid-fit flex flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-text-secondary)_transparent]"
          style={{ maxHeight: maxH === undefined ? undefined : maxH - GRID_GAP }}
        >
          {children}
        </div>
      ) : (
        <div className="h-full overflow-hidden">
          {children}
        </div>
      )}
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
  const stored = activeTab.layouts;
  const breakpoint = getBreakpointFromWidth(BREAKPOINTS, width);

  const [fits, setFits] = useState<Fits>({});
  const onFit = useCallback((id: string, px: number) => setFits((f) => (f[id] === px ? f : { ...f, [id]: px })), []);
  const gridLayouts = useMemo(() => fitToContent(stored, fits), [stored, fits]);
  // No grid transitions until every card has been measured — avoids an animated "settle" on load / tab switch
  const fitted = items.every((id) => FILL_ITEMS.has(id) || fits[id] !== undefined);

  const resizedRef = useRef<Resized | null>(null);
  const clearResized = useCallback<EventCallback>(() => { resizedRef.current = null; }, []);
  const onResizeStop = useCallback<EventCallback>((_layout, _old, item) => {
    resizedRef.current = item && { bp: breakpoint, i: item.i, h: item.h };
  }, [breakpoint]);
  const onLayoutChange = useCallback((_layout: unknown, allLayouts: ResponsiveLayouts) => {
    const resized = resizedRef.current;
    resizedRef.current = null;
    // Outside edit mode the only changes are content heights — nothing to persist
    if (editMode) setLayouts(withStoredHeights(allLayouts, stored, resized));
  }, [editMode, stored, setLayouts]);

  const fitProps = (id: string) => (FILL_ITEMS.has(id) ? {} : { onFit, maxH: findHeight(stored, breakpoint, id) });

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
              className="flex items-center gap-1.5 text-sm px-3 py-3 rounded-xl bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary transition-colors active:scale-95"
            >
              <RotateCcw size={14} />
              Restablecer
            </button>
          )}
          <button
            onClick={toggleEditMode}
            className={`flex items-center gap-1.5 text-sm px-3 py-3 rounded-xl border transition-colors active:scale-95 ${
              editMode
                ? "bg-accent-blue text-white border-accent-blue"
                : "bg-bg-secondary border-border-main text-text-secondary hover:text-text-primary"
            }`}
          >
            {editMode ? <Check size={14} /> : <LayoutGrid size={14} />}
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
                <span className="w-1.5 h-1.5 rounded-full bg-text-secondary" />
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

      <div ref={containerRef} className={`${editMode ? "layout-edit-mode" : ""} ${fitted ? "" : "grid-fitting"}`}>
        {haLoading ? <GridSkeleton /> : (
          <ResponsiveGridLayout
            width={width}
            layouts={gridLayouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={1}
            margin={[GRID_GAP, 0]}
            containerPadding={[0, 0]}
            dragConfig={{ enabled: editMode, handle: '.drag-handle' }}
            resizeConfig={{ enabled: editMode, handles: ['se'] as const }}
            onDragStart={clearResized}
            onResizeStart={clearResized}
            onResizeStop={onResizeStop}
            onLayoutChange={onLayoutChange}
          >
            {items.includes('favorites')      && <div key="favorites"><GridItem id="favorites" editMode={false} {...fitProps("favorites")}><FavoritesCard /></GridItem></div>}
            {items.includes('living')         && <div key="living"><GridItem id="living" editMode={editMode} {...fitProps("living")}><Living /></GridItem></div>}
            {items.includes('cocina')         && <div key="cocina"><GridItem id="cocina" editMode={editMode} {...fitProps("cocina")}><Cocina /></GridItem></div>}
            {items.includes('oficina')        && <div key="oficina"><GridItem id="oficina" editMode={editMode} {...fitProps("oficina")}><Oficina /></GridItem></div>}
            {items.includes('cuarto')         && <div key="cuarto"><GridItem id="cuarto" editMode={editMode} {...fitProps("cuarto")}><CuartoPrincipal /></GridItem></div>}
            {items.includes('bano')           && <div key="bano"><GridItem id="bano" editMode={editMode} {...fitProps("bano")}><Bano /></GridItem></div>}
            {items.includes('pasillo')        && <div key="pasillo"><GridItem id="pasillo" editMode={editMode} {...fitProps("pasillo")}><EntradaPasillo /></GridItem></div>}
            {items.includes('balcon')         && <div key="balcon"><GridItem id="balcon" editMode={editMode} {...fitProps("balcon")}><Balcon /></GridItem></div>}
            {items.includes('vacuum')         && <div key="vacuum"><GridItem id="vacuum" editMode={editMode} {...fitProps("vacuum")}><VacuumCard entityId={VACUUM_ENTITY} name="Robot" /></GridItem></div>}
            {items.includes('weather')        && <div key="weather"><GridItem id="weather" editMode={editMode} {...fitProps("weather")}><WeatherWidget /></GridItem></div>}
            {items.includes('energy')         && <div key="energy"><GridItem id="energy" editMode={editMode} {...fitProps("energy")}><EnergyChart /></GridItem></div>}
            {items.includes('battery')        && <div key="battery"><GridItem id="battery" editMode={editMode} {...fitProps("battery")}><BatteryWidget sensors={batterySensors} /></GridItem></div>}
            {items.includes('commute')        && <div key="commute"><GridItem id="commute" editMode={editMode} {...fitProps("commute")}><CommuteCard routes={commuteRoutes} personEntityId={PERSON_ENTITY} /></GridItem></div>}
            {items.includes('exchange-rates') && <div key="exchange-rates"><GridItem id="exchange-rates" editMode={editMode} {...fitProps("exchange-rates")}><ExchangeRateCard /></GridItem></div>}
          </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}

export default App;
