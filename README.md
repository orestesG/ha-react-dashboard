# HA React Dashboard

Dashboard personalizado para Home Assistant construido con React + TypeScript. Corre como panel nativo dentro de HA (sin iframe) comunicándose en tiempo real vía WebSocket.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS con dark mode nativo
- [home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket)
- Zustand — estado global
- Recharts — gráficos de energía
- Lucide React — iconos

## Funcionalidades

- Control de luces, persianas, clima, media players y aspiradora
- Widget de clima en tiempo real
- Gráfico de consumo energético
- Indicadores de batería de sensores
- Escenas de un toque (Buen día / Modo sueño)
- Dark mode sincronizado con el tema de HA
- **Commute ETA** — tiempos de viaje a destinos recurrentes via Waze, con chip en el header y card en el grid

---

## Desarrollo standalone

```bash
# 1. Clonar el repo
git clone https://github.com/orestesgpf/ha-react-dashboard.git
cd ha-react-dashboard

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales
cp .env.local.example .env.local
# Editar .env.local con tu URL y token
```

`.env.local`:
```
VITE_HA_URL=http://homeassistant.local:8123
VITE_HA_TOKEN=tu_long_lived_token_aqui
```

```bash
# 4. Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173
```

**Generar un Long-lived token:** HA → Perfil (esquina inferior izquierda) → Security → Long-lived access tokens → Create token.

---

## Instalar en Home Assistant como panel

### 1. Build

```bash
npm run build:panel
```

Genera `dist/main.js` — un único archivo con JS + CSS incrustado, listo para HA.

### 2. Copiar a HA

Crear la carpeta `/config/www/mi-dashboard/` en tu servidor HA y copiar `dist/main.js` dentro.

**Opciones para copiar:**

- **File Editor add-on**: navegar a `www/mi-dashboard/` y subir el archivo
- **Samba**: `\\homeassistant.local\config\www\mi-dashboard\main.js`
- **SSH**: `scp dist/main.js root@<IP_HA>:/config/www/mi-dashboard/main.js`

Verificar que el archivo sea accesible en: `http://homeassistant.local:8123/local/mi-dashboard/main.js`

### 3. Registrar en `configuration.yaml`

```yaml
panel_custom:
  - name: mi-dashboard
    sidebar_title: Dashboard
    sidebar_icon: mdi:view-dashboard
    url_path: mi-dashboard
    module_url: /local/mi-dashboard/main.js
```

### 4. Reiniciar HA

Settings → System → Restart (solo necesario la primera vez).

### 5. Acceder al panel

Navegar a `http://homeassistant.local:8123/mi-dashboard` o hacer clic en "Dashboard" en el sidebar.

**Para actualizaciones posteriores:** reemplazar `main.js` en HA y hacer Ctrl+Shift+R en el browser. No hace falta reiniciar HA.

---

## Configurar Commute ETA

Muestra el tiempo de viaje desde casa a destinos recurrentes. El chip en el header muestra el destino más relevante según la hora; la card en el grid muestra todos los destinos con barra de color.

### 1. Crear sensores Waze en HA

**Settings > Devices & Services > Add Integration > "Waze Travel Time"** — uno por destino.

| Campo | Valor |
|---|---|
| Origin | `zone.home` |
| Destination | Dirección exacta del destino |
| Region | EU o NA según corresponda |

El sensor resultante tiene el tiempo en minutos como estado (ej. `sensor.waze_home_to_trabajo_home_to_trabajo`).

### 2. Configurar en `src/App.tsx`

```ts
const PERSON_ENTITY = "person.gabriel";  // entity ID de tu persona en HA

const commuteRoutes: CommuteRoute[] = [
  {
    entityId:  "sensor.waze_home_to_trabajo_home_to_trabajo",
    label:     "Trabajo",
    icon:      Briefcase,
    chipHours: { from: 6, to: 13 },  // el chip aparece solo en este rango horario
  },
  {
    entityId: "sensor.waze_home_to_super",
    label:    "Supermercado",
    icon:     ShoppingCart,
    // sin chipHours → fallback cuando ningún horario aplica
  },
];
```

El chip del header solo aparece cuando `person.*` está en estado `home`.

### 3. Presencia estable con WiFi (recomendado)

El GPS del celular puede oscilar entre `home`/`not_home` en interiores. Para evitarlo, agregar un tracker por WiFi:

**a)** En la app de HA (Android): Perfil → Sensores del dispositivo → activar **"WiFi Connection"** → aparece `sensor.DISPOSITIVO_wi_fi_connection`.

**b)** Crear automation (Settings > Automations > New → Edit YAML):

```yaml
alias: Presencia por WiFi
trigger:
  - platform: state
    entity_id: sensor.DISPOSITIVO_wi_fi_connection
  - platform: homeassistant
    event: start
action:
  - choose:
      - conditions:
          - condition: state
            entity_id: sensor.DISPOSITIVO_wi_fi_connection
            state: "NOMBRE_DE_TU_RED_WIFI"
        sequence:
          - service: device_tracker.see
            data:
              dev_id: gabriel_wifi
              location_name: home
    default:
      - service: device_tracker.see
        data:
          dev_id: gabriel_wifi
          location_name: not_home
```

**c)** Settings > People → editar tu persona → agregar `device_tracker.gabriel_wifi` como tracker adicional.

Con GPS + WiFi, HA marca `home` si cualquiera de los dos lo reporta, eliminando el flicker del GPS en interiores.

