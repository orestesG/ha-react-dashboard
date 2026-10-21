# Mi Dashboard — Constitución del Proyecto

Dashboard personalizado para Home Assistant, construido en React + TypeScript. Funciona en dos modos: como app web independiente (dev/preview) y como custom panel embebido dentro de HA (`ha-panel-custom`).

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript |
| Estilos | Tailwind CSS 3 (CSS variables para theming) |
| Estado | Zustand 5 |
| Grid | react-grid-layout 2 (`ResponsiveGridLayout`) |
| Charts | Recharts 3 |
| Iconos | lucide-react |
| HA WebSocket | home-assistant-js-websocket 9 |
| Build | Vite 8 + vite-plugin-css-injected-by-js |

---

## Modos de ejecución

### Dev web (`npm run dev`)
- Entry: `src/main.tsx`
- Lee `VITE_HA_URL` y `VITE_HA_TOKEN` de `.env.local`
- Dark mode: sigue `prefers-color-scheme` del sistema
- El error de conexión se muestra inline con botón "Reintentar"

### Panel HA (`npm run build:panel`)
- Entry: `src/panel-main.ts` → `src/panel-element.ts` → `App.tsx`
- Emite un único `dist/main.js` (no code-splitting)
- `VITE_BUILD_PANEL=true` activa en `vite.config.ts`:
  - `cssInjectedByJs`: bundlea el CSS en el JS; guarda el string en `window.__dashCss`
  - `define`: shimea `process` y `process.env.NODE_ENV` (ausentes en browser)
- `panel-element.ts` (`MiDashboardPanel extends HTMLElement`):
  - En `connectedCallback`: inyecta un `<style>` con `window.__dashCss` directamente en el shadow root de `ha-panel-custom` (los estilos en `document.head` no atraviesan el shadow DOM)
  - Recibe el objeto `hass` de HA vía setter; llama `useHAStore.getState().injectConnection()` una sola vez
  - Dark mode: aplica/quita la clase `.dark` en `document.documentElement` según `hass.themes.darkMode`

**Por qué el CSS requiere inyección manual en el shadow root:**
`ha-panel-custom` es un LitElement con shadow DOM. `document.head` no cruza esa barrera. La solución almacena el CSS compilado en `window.__dashCss` y lo reinyecta en `this.getRootNode()` (el shadow root padre) al conectar el elemento.

---

## Estructura de archivos

```
src/
├── main.tsx                    # Entry dev — dark mode por OS, renderiza <App>
├── panel-main.ts               # Entry panel — importa index.css + registra custom element
├── panel-element.ts            # Custom element MiDashboardPanel — shadow DOM injection
├── App.tsx                     # Shell — header, ResponsiveGridLayout, conexión
├── index.css                   # Tailwind + CSS variables light/dark + resize handles
│
├── lib/
│   ├── ha-client.ts            # Conexión WS, subscribeEntities, callService, fetchAllStates, callRestAPI
│   ├── ha-types.ts             # Interfaces tipadas: LightEntity, CoverEntity, ClimateEntity…
│   └── vacuum.ts               # Lógica pura del robot Dreame: opciones, slots→schedule, config de script/automatización (tests en vacuum.test.ts)
│
├── store/
│   ├── ha-store.ts             # Zustand: connection, entities, isConnected, error, entityCount
│   ├── layout-store.ts         # Zustand: layouts (RGL), editMode, localStorage (LS_KEY v3)
│   └── vacuum-store.ts         # Zustand: horarios del robot + vista del mapa; sincroniza schedule/script/automatización en HA
│
├── hooks/
│   ├── useHA.ts                # Conecta/desconecta al montar; retorna estado del store
│   ├── useEntity.ts            # Lee entidad del store; expone state, attributes, isOn, toggle…
│   └── useService.ts           # Wrappers tipados de callService por dominio
│
├── areas/                      # Un componente por habitación; usan <AreaCard> + controles
│   ├── Living.tsx
│   ├── Cocina.tsx              # Incluye <LeakSensor> inline
│   ├── Oficina.tsx
│   ├── CuartoPrincipal.tsx
│   ├── Bano.tsx
│   ├── EntradaPasillo.tsx
│   └── Balcon.tsx
│
├── components/
│   ├── ui/
│   │   ├── Card.tsx            # Contenedor genérico con header opcional
│   │   ├── Tile.tsx            # Botón de control (icon + nombre + estado + color activo)
│   │   ├── Button.tsx          # Botón utilitario
│   │   └── MetricChip.tsx      # Chip inline de temp/humedad en cabecera de AreaCard
│   │
│   ├── controls/
│   │   ├── SwitchTile.tsx      # Switch on/off usando <Tile>
│   │   ├── LightTile.tsx       # Luz: toggle + slider brightness + colores RGB (10 presets + color picker)
│   │   ├── CoverTile.tsx       # Persiana/cortina: abrir/detener/cerrar + barra de posición
│   │   ├── ClimateCard.tsx     # Clima: temp actual, temp objetivo (+/-0.5°), modos HVAC
│   │   ├── MediaPlayerCard.tsx # Reproductor: play/pause/prev/next/power
│   │   ├── VacuumCard.tsx      # Robot: estado/stats, tabs Mapa·Habitaciones·Consumibles, limpieza multi-habitación con overrides
│   │   ├── VacuumScheduleModal.tsx # Horarios (días, hora, solo aspirado, succión/pasadas) + pausar/reanudar la automatización
│   │   └── vacuum/             # ChipGroup, SwitchTrack, RoomSettingsList (selects room_N_*), ConsumablesPanel, RunOptionsModal
│   │
│   └── widgets/
│       ├── AreaCard.tsx        # Wrapper de habitación: icono, temp/hum, scroll vertical
│       ├── WeatherWidget.tsx   # Clima: actual + hourly SVG curve + weekly range bars
│       ├── EnergyChart.tsx     # UTE: consumo punta/llano/valle + gasto/deuda + historial Recharts
│       ├── BatteryWidget.tsx   # Nivel de batería de sensores Zigbee/BLE agrupados por área
│       └── SceneButtons.tsx    # Botones de escenas HA (Buen día, Modo sueño…)
```

---

## Theming

CSS variables definidas en `src/index.css`, consumidas en `tailwind.config.js`:

| Variable | Light | Dark |
|---|---|---|
| `--color-bg-primary` | `#f8fafc` | `#0a0a0a` |
| `--color-bg-secondary` | `#ffffff` | `#171717` |
| `--color-bg-tertiary` | `#f1f5f9` | `#262626` |
| `--color-text-primary` | `#0f172a` | `#ffffff` |
| `--color-text-secondary` | `#475569` | `#9ca3af` |
| `--color-border` | `#e2e8f0` | `#262626` |

Las variables CSS **sí** se heredan a través del shadow DOM (a diferencia de los selectores de clase), por lo que el dark mode funciona en el panel aunque `.dark` esté en `<html>` fuera del shadow root.

Colores de acento fijos en Tailwind: `accent-blue`, `accent-green`, `accent-yellow`, `accent-orange`, `accent-red`, `accent-purple`.

---

## Grid layout (react-grid-layout v2)

- **Breakpoints**: `{ lg: 1280, md: 768, sm: 0 }` — cols: `{ lg: 4, md: 2, sm: 1 }`
- **rowHeight**: 1 px | **margin**: `[16, 0]` — `y`/`h` están en px; cada item reserva `GRID_GAP` (16 px) abajo como separación vertical
- **Alto según contenido**: `GridItem` (App.tsx) mide la card con un `ResizeObserver` y la achica a su contenido; el `h` guardado es el **máximo** (lo que no entra scrollea). Excepción: `FILL_ITEMS` (`vacuum`, el mapa crece con la card) usa siempre el `h` guardado
  - Al redimensionar en edit mode, el alto soltado pasa a ser el máximo de ese breakpoint (estirar más allá del contenido vuelve al contenido)
  - Fuera de edit mode no se persiste nada: los cambios de alto por contenido no escriben en HA
- Layout persistido en HA (`frontend/set_user_data`) bajo `mi-dashboard-tabs-v2` (px). Si no existe, se migra desde `mi-dashboard-tabs-v1` (filas de 100 + 16 px → ×116), que queda intacto para builds viejos del panel
- **Edit mode**: botón "Editar / Listo" en el header activa `editMode` en `layout-store`
  - En edit mode se muestra overlay azul punteado sobre cada card (bloquea clics a los controles)
  - El handle de resize (esquina SE) aparece mediante `.layout-edit-mode .react-resizable-handle { opacity: 1 }`
  - Botón "Restablecer" revierte al layout por defecto y borra localStorage

**IDs de grid y componentes por defecto** (en `layout-store.ts` se escriben en filas legacy y se convierten a px):

| id | Componente | lg x,y,w,h (filas) |
|---|---|---|
| `living` | `<Living>` | 0,0,1,5 |
| `cocina` | `<Cocina>` | 1,0,1,4 |
| `oficina` | `<Oficina>` | 2,0,1,6 |
| `cuarto` | `<CuartoPrincipal>` | 3,0,1,5 |
| `bano` | `<Bano>` | 0,5,1,2 |
| `pasillo` | `<EntradaPasillo>` | 1,4,1,3 |
| `balcon` | `<Balcon>` | 2,6,1,2 |
| `vacuum` | `<VacuumCard>` | 3,5,1,3 |
| `weather` | `<WeatherWidget>` | 0,8,4,3 |
| `energy` | `<EnergyChart>` | 0,11,2,5 |
| `battery` | `<BatteryWidget>` | 2,11,2,5 |

---

## Capa HA WebSocket

**`lib/ha-client.ts`** — singleton de conexión:
- `connectHA(url, token)` — usa `createLongLivedTokenAuth` + `createConnection` de la librería oficial
- `subscribeAllEntities(conn, cb)` — callback con el mapa completo de entidades en cada cambio
- `callService(conn, domain, service, data?, target?)` — llama servicios HA
- `fetchAllStates(conn)` — carga inicial de todas las entidades
- `disconnectHA()` — cierra la conexión y limpia el singleton

**`store/ha-store.ts`** — Zustand:
- `connect(url, token)`: flujo dev — fetchAllStates inicial + subscribeEntities
- `injectConnection(conn)`: flujo panel — HA ya conectó, solo subscribimos entidades
- `entities`: `Record<string, HassEntity>` actualizado en tiempo real por WS

**`hooks/useEntity(entityId)`** — interfaz principal de los controles:
- Retorna `{ entity, state, attributes, isOn, turnOn, turnOff, toggle, exists, loading }`
- Los controles (`LightTile`, `CoverTile`, etc.) llaman `callService` directamente para tener control más fino (brightness, rgb_color, temperature, etc.)

---

## Trampas conocidas y soluciones

### `process is not defined` en el panel build
- **Causa**: dependencias usan `process.env.NODE_ENV` y el objeto `process` desnudo, ausentes en browser
- **Fix**: `vite.config.ts` → `define: { 'process.env.NODE_ENV': '"production"', 'process': '{ env: { NODE_ENV: "production" } }' }`

### Estilos no aplicados en el panel HA
- **Causa**: `ha-panel-custom` tiene shadow DOM; `document.head` no penetra
- **Fix**: `cssInjectedByJs` con `injectCode` custom guarda CSS en `window.__dashCss`; `panel-element.ts` inyecta `<style>` en `this.getRootNode()` (el shadow root padre)

### TypeScript con react-grid-layout v4 (tipos)
- `Layout` (item individual) → `LayoutItem`
- `Layouts` (colección) → `ResponsiveLayouts`
- Props `isDraggable`/`isResizable`/`resizeHandles` → `dragConfig`/`resizeConfig` (objetos)

### Opacidad sobre colores de token (`bg-bg-secondary/95`, `text-text-secondary/60`…)
- **Causa**: los tokens `bg-*`, `text-*` y `border-main` son `var(--color-…)` sin canal alfa, así que Tailwind 3 **no genera** la clase con `/NN`: el elemento queda sin fondo/color (un overlay `bg-bg-secondary/95 backdrop-blur-sm` termina siendo solo blur sobre lo de abajo)
- **Fix**: superficies sólidas (`bg-bg-secondary`, `bg-bg-tertiary`) y `border-border-main` para separar; la opacidad `/NN` solo sobre `accent-*` (hex fijos)

### Luces Zigbee/Philips: estado intermedio off+brightness=null
- Al cambiar brillo/color, HA reporta brevemente `state=off, brightness=null`
- **Fix en `LightTile`**: debounce de 400 ms antes de ocultar los controles (`offDebounceRef`)

### Robot Dreame (integración Tasshack `dreame_vacuum`)
- **Limpieza personalizada ON** (`switch.<slug>_customized_cleaning`) → los selects globales `cleaning_mode` / `suction_level` / `mop_pad_humidity` quedan `unavailable`. El dashboard edita solo los selects por habitación `select.<slug>_room_<id>_*` (id = segment id del mapa activo).
- `dreame_vacuum.vacuum_clean_segment` exige ints (succión 0–3, humedad 1–3). Una lista vacía `[]` en `repeats`/`suction_level`/`water_volume` = usar la config de cada habitación; omitirlos usa la succión global y 1 pasada.
- Los helpers `schedule.*` son de colección (no config entries): se escriben con WS `schedule/update` (requiere `name`). Cada bloque lleva `data` (`sweep_only`, `suction`, `passes`) que HA expone como atributos mientras está activo.
- El dashboard provisiona `script.mi_dashboard_limpieza_robot` y reescribe la automatización `automation.limpieza_robot_schedule` (REST `/api/config/...`, solo si cambiaron). "Solo aspirado" pasa por el script para que HA restaure los modos por habitación al volver a la base.
- El robot también tiene horarios nativos de la app (atributo `schedule` del vacuum) que corren independientes de HA.

### Forecast del tiempo (API HA)
- `weather.get_forecasts` requiere `return_response: true` en el mensaje WS; se llama con `conn.sendMessagePromise()` ya que la librería no tiene un wrapper tipado para esto

---

## Scripts

```bash
npm run dev           # Servidor de desarrollo (HMR)
npm run build         # Build web estándar
npm run build:panel   # Build del custom panel → dist/main.js
npm run lint          # ESLint
npm run test          # Vitest (run once)
npm run test:watch    # Vitest (watch)
```

## Despliegue del panel en HA

1. `npm run build:panel` → genera `dist/main.js`
2. Copiar `dist/main.js` a `<HA config>/www/mi-dashboard/main.js`
3. En `configuration.yaml`:
   ```yaml
   panel_custom:
     - name: mi-dashboard
       url_path: mi-dashboard
       sidebar_title: Dashboard
       sidebar_icon: mdi:view-dashboard
       js_url: /local/mi-dashboard/main.js
   ```
4. Reiniciar HA o hacer "Check & Restart"
