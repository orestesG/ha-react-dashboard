# 🏠 Plan de Desarrollo — Dashboard React para Home Assistant

> **Objetivo:** Construir un dashboard custom en React que reemplace el dashboard nativo de Home Assistant, con control total del layout y look-and-feel, comunicándose en tiempo real vía WebSocket.

---

## 📋 Contexto del proyecto

### Stack técnico
- **Vite + React 18 + TypeScript** — base moderna
- **Tailwind CSS 3** — sistema de estilos
- **home-assistant-js-websocket** — cliente oficial de HA
- **Lucide React** — iconos
- **Recharts** — gráficos (reemplaza mini-graph-card)
- **Zustand** — estado global

### Arquitectura híbrida (Opción C)
- **Modo Dev (standalone):** corre en `localhost:5173`, conecta a HA via long-lived token
- **Modo Prod (panel HA):** se compila a un único bundle JS, se monta como panel custom en HA

### Hardware y entorno
- **Home Assistant:** versión 2026.5.1 corriendo en `homeassistant.local:8123`
- **Tablet de visualización:** modo dark, layout horizontal fijo
- **PC de desarrollo:** debe estar en la misma red local que HA

---

## ✅ Checklist previa (a resolver antes de empezar)

Marcar cuando esté listo:

- [ ] **Node.js 20+ LTS instalado** en la PC de desarrollo
  - Verificar con: `node --version`
  - Descargar: https://nodejs.org/
- [ ] **Conectividad con HA verificada**
  - Abrir `http://homeassistant.local:8123` desde el navegador del PC de dev
  - Si no resuelve, anotar la IP local: `____________________`
- [ ] **Long-lived access token generado**
  - HA → Perfil (icono inicial abajo izq) → Security → Long-lived access tokens
  - Click "Create token" → nombre: `react-dashboard-dev`
  - Token guardado en lugar seguro: `✓`
- [ ] **CORS configurado en HA** (`configuration.yaml`)
  ```yaml
  http:
    cors_allowed_origins:
      - http://localhost:5173
      - http://127.0.0.1:5173
  ```
  - HA reiniciado después del cambio: `✓`
- [ ] **VS Code instalado** con extensiones:
  - ES7+ React/Redux/React-Native snippets
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features (built-in)
- [ ] **Acceso a `/config/www/` de HA** (para el deploy como panel)
  - Vía File Editor o Studio Code Server (ambos ya instalados ✅)

---

## 🗺️ Inventario de entidades del proyecto

### Áreas principales

#### 🛋️ Living
| Entidad | ID | Descripción |
|---|---|---|
| Sensor temp | `sensor.living_room_sensor_temperature` | Temperatura |
| Sensor hum | `sensor.living_room_sensor_humidity` | Humedad |
| Luz principal | `switch.sonoff_1002807067_1` | |
| Cenefa | `switch.sonoff_10020c54d4_1` | |
| Persiana | `cover.sonoff_10023e4c70` | Persiana 1 |
| Cortina | `cover.curtain_3_c564` | Cortina motorizada |
| Espejo LED | `light.sonoff_1002307762` | Lespejo 3-5M-P |
| TV | `media_player.the_premiere` | Samsung The Premiere |

#### 🍳 Cocina
| Entidad | ID |
|---|---|
| Sensor temp/hum | `sensor.broadlink_mini_2_temperature` / `_humidity` |
| Luz | `switch.sonoff_10027c9f9d_1` |
| Detector agua 1 | `binary_sensor.detector_fuga_agua` |
| Detector agua 2 | `binary_sensor.cocina_dtector_fuga_agua` |
| Bat agua 1 | `sensor.detector_fuga_agua_battery` |
| Bat agua 2 | `sensor.cocina_dtector_fuga_agua_battery` |

#### 🪑 Oficina
| Entidad | ID |
|---|---|
| Sensor temp/hum | `sensor.broadlink_mini_2_temperature` / `_humidity` |
| Luz | `switch.sonoff_10024ae654_1` |
| Persiana | `cover.sonoff_10023e3f9e` (Persiana 3) |
| Aire | `climate.aire_cuarto_chico` |
| LED Monitor | `light.philips_strip5_9631_light` |
| Suko (enchufe) | `switch.sonoff_10023c5cd0` |
| Power Suko | `sensor.sonoff_10023c5cd0_power` |
| Energy hoy | `sensor.sonoff_10023c5cd0_energy_day` |
| Sensor vibración | `binary_sensor.vibration_sensor` |
| Bat vibración | `sensor.vibration_sensor_battery` |
| Sensor movimiento | `binary_sensor.sensor_movimiento_occupancy` |

#### 🛏️ Cuarto Principal
| Entidad | ID |
|---|---|
| Sensor temp/hum | `sensor.broadlink_mini_temperature` / `_humidity` |
| Luz | `switch.sonoff_10024ae259_1` |
| Persiana | `cover.sonoff_10023e3f19` (Persiana 2) |
| Aire | `climate.aire_cuarto_principal_2` |
| LED Cielo | `light.gbk_h613d_323f` |

#### 🚿 Baño
| Entidad | ID |
|---|---|
| Calefón | `switch.sonoff_10023775c6` |

#### 🚪 Entrada & Pasillo
| Entidad | ID |
|---|---|
| Luz Entrada | `switch.sonoff_10024b38be_1` |
| Luz Pasillo | `switch.sonoff_10024b3909_1` |

#### 🌿 Balcón
| Entidad | ID |
|---|---|
| Luz | `switch.sonoff_1002807cb6_1` |

### Globales

#### 🤖 Robot Aspiradora
| Entidad | ID |
|---|---|
| Vacuum | `vacuum.xiaomi_c102gl_43cb_robot_cleaner` |
| Estado | `sensor.xiaomi_c102gl_43cb_status` |
| Batería | `sensor.xiaomi_c102gl_43cb_battery_level` |

#### ⚡ Energía UTE
| Entidad | ID |
|---|---|
| Consumo actual | `sensor.ute_8647965855_consumo_actual` |
| Consumo Punta | `sensor.ute_8647965855_consumo_punta` |
| Consumo Llano | `sensor.ute_8647965855_consumo_llano` |
| Consumo Valle | `sensor.ute_8647965855_consumo_valle` |
| Gasto actual | `sensor.ute_8647965855_gasto_actual` |
| Deuda total | `sensor.ute_8647965855_deuda_total` |
| Última actualización | `sensor.ute_8647965855_ultima_actualizacion` |

#### 🌤️ Clima
- `weather.forecast_home`

#### 🎬 Escenas
- `scene.buen_dia`
- `scene.modo_sueno`

---

## 🏗️ Estructura del proyecto

```
mi-dashboard/
├── public/
├── src/
│   ├── lib/
│   │   ├── ha-client.ts          # Cliente WebSocket + auth
│   │   └── ha-types.ts           # Types TS para entidades
│   ├── hooks/
│   │   ├── useHA.ts              # Hook principal de conexión
│   │   ├── useEntity.ts          # Hook para una entidad específica
│   │   └── useService.ts         # Hook para llamar servicios
│   ├── store/
│   │   └── ha-store.ts           # Estado global con Zustand
│   ├── components/
│   │   ├── ui/                   # Componentes base reutilizables
│   │   │   ├── Card.tsx
│   │   │   ├── Tile.tsx
│   │   │   ├── Button.tsx
│   │   │   └── MetricChip.tsx
│   │   ├── controls/             # Controles específicos de HA
│   │   │   ├── LightTile.tsx
│   │   │   ├── SwitchTile.tsx
│   │   │   ├── CoverTile.tsx
│   │   │   ├── ClimateCard.tsx
│   │   │   ├── MediaPlayerCard.tsx
│   │   │   └── VacuumCard.tsx
│   │   └── widgets/              # Widgets compuestos
│   │       ├── AreaCard.tsx      # Card de área con header + controles
│   │       ├── BatteryWidget.tsx
│   │       ├── EnergyChart.tsx
│   │       └── WeatherWidget.tsx
│   ├── areas/                    # Cards específicas por área
│   │   ├── Living.tsx
│   │   ├── Cocina.tsx
│   │   ├── Oficina.tsx
│   │   ├── CuartoPrincipal.tsx
│   │   ├── Bano.tsx
│   │   ├── EntradaPasillo.tsx
│   │   └── Balcon.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.local                    # NO commitear (tiene token)
├── .env.example                  # Template para otros devs
├── .gitignore
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 🚀 Plan de implementación por fases

### Fase 1: Setup inicial (30 min)

**Objetivo:** Proyecto creado, dependencias instaladas, Tailwind configurado.

```bash
# Crear proyecto
npm create vite@latest mi-dashboard -- --template react-ts
cd mi-dashboard

# Instalar dependencias
npm install
npm install home-assistant-js-websocket zustand lucide-react recharts
npm install -D tailwindcss@3 postcss autoprefixer @types/node

# Inicializar Tailwind
npx tailwindcss init -p
```

**Archivos a crear/modificar:**
- `tailwind.config.js` — configurar dark mode y content paths
- `src/index.css` — directivas de Tailwind + reset básico
- `.env.local` — variables de entorno (URL + token)
- `.env.example` — template sin valores reales
- `.gitignore` — agregar `.env.local`

**Verificación:**
- `npm run dev` arranca sin errores
- Tailwind funciona (probar una clase como `bg-red-500`)

---

### Fase 2: Conexión con HA (45 min)

**Objetivo:** Cliente WebSocket funcionando, datos en tiempo real.

**Archivos a crear:**

1. `src/lib/ha-client.ts`
   - `connectHA()` — autenticación con long-lived token
   - `subscribeAllEntities()` — suscripción a estados
   - `callService()` — llamar servicios
   - Reconexión automática en caso de desconexión

2. `src/lib/ha-types.ts`
   - Re-exportar types de la librería
   - Types custom para nuestras entidades

3. `src/store/ha-store.ts`
   - Store Zustand con: connection, entities, isConnected, error
   - Actions: connect, disconnect, subscribeEntities

4. `src/hooks/useHA.ts`
   - Hook principal que inicializa la conexión
   - Devuelve: connection, entities, isConnected, error

5. `src/hooks/useEntity.ts`
   - Hook tipado para una entidad específica
   - `useEntity('switch.living_luz')`
   - Devuelve estado + métodos toggle/turn_on/turn_off

6. `src/hooks/useService.ts`
   - Hook para llamar servicios
   - Helpers: `toggleSwitch`, `setCover`, `setClimate`, etc.

**Verificación:**
- En `App.tsx`, mostrar el conteo total de entidades conectadas
- Console.log de un par de estados específicos
- Verificar que actualiza en tiempo real al cambiar algo en HA

---

### Fase 3: Componentes base (1 hora)

**Objetivo:** Sistema de design tokens y componentes reutilizables.

**Archivos a crear:**

1. `src/components/ui/Card.tsx`
   - Wrapper genérico con padding, border, rounded, dark bg
   - Props: `header?`, `children`, `className?`

2. `src/components/ui/Tile.tsx`
   - Tile clickeable estilo HA con icon + name + state
   - Props: `icon`, `name`, `state`, `active`, `onClick`, `color?`

3. `src/components/ui/MetricChip.tsx`
   - Chip pequeño para mostrar valores (temp, humedad, batería)
   - Props: `icon`, `value`, `unit`, `color?`

4. `src/components/ui/Button.tsx`
   - Botón base con variants: primary, secondary, ghost
   - Tamaños: sm, md, lg

**Sistema de colores:**
```ts
// Tokens en tailwind.config.js
const colors = {
  bg: {
    primary: '#0a0a0a',
    secondary: '#171717',
    tertiary: '#262626',
  },
  accent: {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444',
    purple: '#a855f7',
  }
}
```

**Verificación:**
- Storybook visual: renderizar todos los componentes en `App.tsx` con datos mock

---

### Fase 4: Controles específicos de HA (2 horas)

**Objetivo:** Componentes funcionales que llaman servicios reales.

**Archivos a crear:**

1. `src/components/controls/SwitchTile.tsx`
   - Toggle on/off para switches
   - Visual feedback de estado
   - Loading state durante la llamada

2. `src/components/controls/LightTile.tsx`
   - Toggle + brightness slider + color picker (si soporta)
   - Modal con controles avanzados al hacer long-press

3. `src/components/controls/CoverTile.tsx`
   - Botones up/stop/down
   - Indicador visual de posición (si tiene)

4. `src/components/controls/ClimateCard.tsx`
   - Mode selector (heat/cool/auto/off)
   - Temperatura objetivo con +/-
   - Estado actual visible

5. `src/components/controls/MediaPlayerCard.tsx`
   - Play/pause/next/previous
   - Volumen
   - Info del media actual

6. `src/components/controls/VacuumCard.tsx`
   - Start/pause/dock/locate
   - Estado y batería visibles

**Verificación:**
- Cada control prueba con una entidad real
- Al tocar, cambia el estado real en HA
- Se actualiza el visual cuando otro cliente cambia el estado

---

### Fase 5: Widget de área genérico (1 hora)

**Objetivo:** Componente reutilizable para construir cards de áreas.

**Archivo:** `src/components/widgets/AreaCard.tsx`

**Props:**
```ts
interface AreaCardProps {
  name: string
  icon: LucideIcon
  iconColor: string
  tempEntityId?: string
  humidityEntityId?: string
  children: ReactNode
}
```

**Layout:**
- Header con icono + nombre + temp/humedad alineados a la derecha
- Body con los children (los controles)
- Padding y spacing consistente
- Hover/tap states sutiles

**Verificación:**
- Renderizar 3 áreas distintas con diferentes controles
- Verificar que el header se ajusta cuando no hay sensores

---

### Fase 6: Implementación de áreas (2 horas)

**Objetivo:** Replicar el dashboard actual con las 7 áreas.

**Archivos a crear** (uno por área):
- `src/areas/Living.tsx`
- `src/areas/Cocina.tsx`
- `src/areas/Oficina.tsx`
- `src/areas/CuartoPrincipal.tsx`
- `src/areas/Bano.tsx`
- `src/areas/EntradaPasillo.tsx`
- `src/areas/Balcon.tsx`

**Patrón por área:**
```tsx
export function Living() {
  return (
    <AreaCard
      name="Living"
      icon={Sofa}
      iconColor="green"
      tempEntityId="sensor.living_room_sensor_temperature"
      humidityEntityId="sensor.living_room_sensor_humidity"
    >
      <div className="grid grid-cols-2 gap-3">
        <SwitchTile entityId="switch.sonoff_1002807067_1" name="Luz" icon={Lightbulb} />
        <SwitchTile entityId="switch.sonoff_10020c54d4_1" name="Cenefa" icon={Lightbulb} />
      </div>
      <CoverTile entityId="cover.sonoff_10023e4c70" name="Persiana" />
      <CoverTile entityId="cover.curtain_3_c564" name="Cortina" />
    </AreaCard>
  )
}
```

---

### Fase 7: Widgets globales (1.5 horas)

**Objetivo:** Componentes para info no asociada a un área específica.

1. `src/components/widgets/WeatherWidget.tsx`
   - Estado del clima + temperatura + humedad

2. `src/components/widgets/EnergyChart.tsx`
   - Gráfico de UTE con Recharts
   - 3 líneas: punta, llano, valle
   - Datos históricos de los últimos 7 días

3. `src/components/widgets/BatteryWidget.tsx`
   - Lista de baterías con color dinámico (rojo < 20, naranja < 50, verde >= 50)
   - Mínimo destacado en el header

4. `src/components/widgets/SceneButtons.tsx`
   - Botones de escenas (Buen día, Modo sueño)

---

### Fase 8: Layout principal (1 hora)

**Objetivo:** Composición final del dashboard.

**Archivo:** `src/App.tsx`

**Estructura:**
```tsx
<div className="min-h-screen bg-bg-primary p-6">
  <Header />  {/* Hora, clima, escenas */}
  <main className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
    <Living />
    <Cocina />
    <Oficina />
    <CuartoPrincipal />
    <Bano />
    <EntradaPasillo />
    <Balcon />
    <VacuumCard />  {/* Card de robot global */}
  </main>
  <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
    <BatteryWidget />
    <EnergyChart />
  </section>
</div>
```

**Responsive:**
- 1 columna en mobile (< 768px)
- 2 columnas en tablet portrait (768-1280px)
- 4 columnas en tablet landscape / desktop (> 1280px)

---

### Fase 9: Build standalone (30 min)

**Objetivo:** Generar un build production probable desde cualquier servidor.

```bash
npm run build
npm run preview  # probar el build
```

Probar en `http://localhost:4173` que todo funciona igual.

---

### Fase 10: Build como panel HA (1 hora)

**Objetivo:** Montar el dashboard dentro de HA como panel custom.

**Archivos a crear:**

1. `vite.config.ts` — agregar config de build para single-file bundle:
```ts
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'main.js',
      chunkFileNames: 'main.js',
      assetFileNames: 'main.[ext]',
      inlineDynamicImports: true,
    }
  }
}
```

2. `src/panel-init.ts` — punto de entrada para HA panel:
```ts
// Detecta si está corriendo como panel de HA o standalone
if (window.hass) {
  // Modo panel: usar window.hass directamente
} else {
  // Modo standalone: usar token
}
```

**Pasos de deploy:**

1. `npm run build`
2. Copiar `dist/main.js` a `/config/www/react-dashboard/main.js` en HA
3. Agregar a `configuration.yaml`:
```yaml
panel_custom:
  - name: react-dashboard
    sidebar_title: Dashboard
    sidebar_icon: mdi:view-dashboard
    url_path: react-dashboard
    module_url: /local/react-dashboard/main.js
    embed_iframe: false
    require_admin: false
```
4. Reiniciar HA
5. Acceder al panel desde la sidebar

---

## 🎨 Guía de diseño (UI/UX)

### Principios
- **Dark mode primero** — base es siempre oscura
- **Información jerarquizada** — header con esencial, controles abajo
- **Feedback inmediato** — animaciones al tocar, loading sutil
- **Touch-friendly** — targets mínimos 44px, espacios generosos
- **Tipografía clara** — system font, pesos 400/500/600

### Spacing
- Card padding: `20px` (p-5)
- Gap entre cards: `16px` (gap-4)
- Gap interno entre controles: `12px` (gap-3)
- Border radius cards: `16px` (rounded-2xl)
- Border radius tiles: `12px` (rounded-xl)

### Colores
- Background principal: `#0a0a0a`
- Cards: `#171717` con border `#262626`
- Tiles activos: tint del color del área (20% opacity bg + color text)
- Tiles inactivos: `#262626` bg + `#737373` text

### Iconos
- Tamaño en tiles: 24px
- Tamaño en headers: 20px
- Color: matching al área o estado

---

## 🔍 Testing y QA

### Por cada componente
- ✅ Renderiza con datos válidos
- ✅ Maneja entidad inexistente o `unknown`
- ✅ Estado de loading durante llamadas
- ✅ Error visible si la llamada falla

### End-to-end
- ✅ Conecta a HA al cargar
- ✅ Reconecta automáticamente si se cae el WebSocket
- ✅ Cambios en HA se reflejan en < 1 segundo
- ✅ Cambios desde el dashboard cambian el estado real
- ✅ Funciona en tablet (touch) y desktop (mouse)
- ✅ Responsive en distintos tamaños

---

## 📦 Entregables finales

Al completar el proyecto, deberías tener:

1. **Repo Git** con código fuente y README
2. **Build standalone** (`dist/`) que podés hostear en cualquier lugar
3. **Bundle para HA panel** (`dist/main.js`) listo para copiar
4. **Documentación** con:
   - Cómo configurar el `.env.local`
   - Cómo agregar una nueva entidad o área
   - Cómo customizar colores y layout

---

## 🚦 Próximos pasos (después del MVP)

Ideas para iteraciones futuras:

- **Histórico de sensores** — gráficos de temp/hum por área
- **Logs de actividad** — quién encendió qué y cuándo
- **Notificaciones in-app** — alertas de batería, fugas, etc.
- **Modo edición visual** — drag-and-drop de áreas y controles
- **Multi-vista** — distintos dashboards (oficina, dormitorio, etc.)
- **Calendario integrado** — eventos del día en el header
- **Voice integration** — botón para hablarle a Claude desde el dashboard
- **Energy dashboard avanzado** — análisis de consumo por dispositivo

---

## 🎯 Tiempos estimados

| Fase | Tiempo |
|---|---|
| 1. Setup inicial | 30 min |
| 2. Conexión con HA | 45 min |
| 3. Componentes base | 1 h |
| 4. Controles HA | 2 h |
| 5. AreaCard genérica | 1 h |
| 6. 7 áreas | 2 h |
| 7. Widgets globales | 1.5 h |
| 8. Layout principal | 1 h |
| 9. Build standalone | 30 min |
| 10. Build panel HA | 1 h |
| **Total estimado** | **~11 horas** |

Es factible hacerlo en 2-3 sesiones de trabajo concentrado.

---

## 📝 Notas finales para Claude Code

Cuando ejecutes este plan:

1. **Empezá por la Fase 1 y 2** — son la base, sin esto no se puede hacer nada
2. **No avances de fase sin verificar** — cada fase tiene un punto de "verificación" claro
3. **Commiteá frecuentemente** — al menos al terminar cada fase
4. **Si algo no funciona, NO improvises** — lee la doc oficial de `home-assistant-js-websocket` y los types
5. **Manten el código simple** — preferí composición de componentes pequeños sobre componentes mega-completos
6. **Dark mode es obligatorio** — no implementes light mode por ahora
7. **TypeScript estricto** — no usar `any` salvo último recurso

---

¡Suerte con la implementación! 🚀
