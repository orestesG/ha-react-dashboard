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

---

## Auto-deploy con GitHub Actions

Cada push a `main` construye el panel y lo sube automáticamente a HA via SSH.

### Requisitos previos

**1. Habilitar SSH en HA**

Instalar el add-on **Terminal & SSH** desde HA → Settings → Add-ons → Add-on Store.

En la configuración del add-on, agregar la clave pública SSH bajo `authorized_keys`.

**2. Generar clave SSH para el workflow**

```bash
ssh-keygen -t ed25519 -C "github-actions-ha-deploy" -f ~/.ssh/ha_deploy
# No poner passphrase (dejar vacío)
```

Esto genera dos archivos:
- `ha_deploy` — clave privada (va a GitHub Secrets)
- `ha_deploy.pub` — clave pública (va a HA)

**3. Agregar la clave pública a HA**

En HA → Settings → Add-ons → Terminal & SSH → Configuration:

```yaml
authorized_keys:
  - ssh-ed25519 AAAA... github-actions-ha-deploy
```

**4. Configurar GitHub Secrets**

En el repo de GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|--------|-------|
| `HA_HOST` | IP local de HA, ej: `192.168.1.100` (no usar `homeassistant.local`) |
| `HA_SSH_KEY` | Contenido completo del archivo `ha_deploy` (clave privada) |
| `HA_SSH_PORT` | `22222` (HA OS) o `22` (instalación custom) |

**5. Activar el workflow**

El archivo `.github/workflows/deploy.yml` ya está incluido. Hacer un push a `main` para disparar el primer deploy automático.

---

## Configuración de opencode (MCP)

Si usás [opencode](https://opencode.ai) para desarrollo con el servidor MCP de HA:

```bash
cp opencode.json.example opencode.json
# Editar opencode.json con tu token real
```

`opencode.json` está en `.gitignore` para que el token no se suba accidentalmente.
