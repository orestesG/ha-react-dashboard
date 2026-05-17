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

