# User Stories — Mi Dashboard HA

---

## Epic 1: Dashboard base

**US-01 — Scaffold del proyecto**
Como usuario quiero un proyecto React + TypeScript con Tailwind configurado en dark mode, que sirva como base para construir el dashboard.

**US-02 — Conexión en tiempo real con Home Assistant**
Como usuario quiero que el dashboard se conecte a HA vía WebSocket usando un long-lived token, y que el estado de todas las entidades se actualice automáticamente sin recargar la página.

**US-03 — Control de switches y luces simples**
Como usuario quiero poder encender y apagar luces y enchufes desde el dashboard, viendo el estado actual reflejado inmediatamente.

**US-04 — Control de luces con brillo y color**
Como usuario quiero ajustar el brillo de las luces con un slider y cambiar el color RGB (presets + picker libre) sin que el panel de controles desaparezca durante la transición de estado.

**US-05 — Control de persianas y cortinas**
Como usuario quiero abrir, detener y cerrar persianas, viendo el porcentaje de apertura actual como una barra visual.

**US-06 — Control de aires acondicionados**
Como usuario quiero ver la temperatura actual, ajustar la temperatura objetivo en pasos de 0.5°, y cambiar el modo HVAC (off, heat, cool, auto, dry, fan).

**US-07 — Control del reproductor multimedia**
Como usuario quiero ver qué está reproduciendo el TV, controlar play/pause/anterior/siguiente y apagar/encender el dispositivo.

**US-08 — Control del robot aspirador**
Como usuario quiero iniciar, pausar y enviar a la base el robot aspirador, viendo su estado y nivel de batería.

**US-09 — Cards por habitación**
Como usuario quiero ver todas las entidades de cada habitación agrupadas en una card con el icono del área, temperatura y humedad en el header (si hay sensor disponible).

**US-10 — Widget del clima**
Como usuario quiero ver la temperatura actual, condición, humedad y viento, junto a una curva horaria de las próximas 12 horas y el pronóstico semanal con barras de rango de temperatura.

**US-11 — Widget de energía UTE**
Como usuario quiero ver el consumo en los tres períodos tarifarios (punta/llano/valle), el gasto acumulado, la deuda total y el historial mensual en un gráfico de barras.

**US-12 — Widget de baterías**
Como usuario quiero ver el nivel de batería de todos mis sensores Zigbee/BLE agrupados por habitación, con colores que indican el estado (rojo < 20%, amarillo < 50%, verde ≥ 50%).

**US-13 — Botones de escenas**
Como usuario quiero activar escenas predefinidas ("Buen día", "Modo sueño") desde el header del dashboard con un solo toque.

**US-14 — Sensores de fuga de agua en cocina**
Como usuario quiero ver el estado de los detectores de agua en la cocina con alerta visual animada si detectan fuga, y el nivel de batería de cada sensor.

---

## Epic 2: Panel embebido en Home Assistant

**US-15 — Build dual-mode (dev + panel)**
Como desarrollador quiero que el mismo código funcione tanto como app web standalone (dev con `.env.local`) como custom panel dentro de HA, sin duplicar lógica.

**US-16 — Custom element para HA**
Como desarrollador quiero un custom element (`<mi-dashboard>`) que reciba el objeto `hass` de HA, inyecte la conexión WebSocket al store de Zustand y aplique el dark mode según el tema activo en HA.

**US-17 — CSS disponible dentro del shadow DOM de HA**
Como usuario quiero que los estilos se apliquen correctamente dentro del panel de HA, aunque `ha-panel-custom` use shadow DOM y aísle el `document.head`.

**US-18 — Panel sin errores de `process` en runtime**
Como desarrollador quiero que el bundle del panel no rompa con `ReferenceError: process is not defined`, ya que el entorno browser no tiene el global `process` de Node.

---

## Epic 3: Layout editable

**US-19 — Grid arrastrable y redimensionable**
Como usuario quiero poder reorganizar las cards del dashboard arrastrándolas a cualquier posición y redimensionarlas desde la esquina inferior derecha.

**US-20 — Modo edición explícito**
Como usuario quiero que el drag y el resize solo estén activos cuando presiono "Editar", para no mover cards accidentalmente al usar los controles normalmente.

**US-21 — Persistencia del layout entre sesiones**
Como usuario quiero que la distribución que armé se recuerde entre recargas del navegador, y poder volver al layout por defecto con el botón "Restablecer".

**US-22 — Layout responsive por breakpoint**
Como usuario quiero que el dashboard se adapte automáticamente: 4 columnas en desktop, 2 en tablet y 1 en móvil, con layouts independientes para cada breakpoint.

---

## Epic 4: Calidad y consola limpia

**US-23 — Eliminar logs de debug de producción**
Como desarrollador quiero que la consola del navegador no tenga logs de debug de los widgets (especialmente del WeatherWidget), para no ensuciar la consola de HA.

**US-24 — Indicador de estado de conexión**
Como usuario quiero ver un indicador en el header que muestre si el dashboard está conectado a HA, con estado "Conectando...", "Online" o "Error" según corresponda.

---

## Epic 5: Card de favoritos

**US-25 — Marcar entidades como favorito**
Como usuario quiero ver un ícono de estrella en cada entidad del dashboard para poder marcarla o desmarcarla como favorita con un toque, y que la estrella cambie de color cuando la entidad está marcada.

**US-26 — Card de favoritos siempre primera**
Como usuario quiero que la card de favoritos aparezca siempre en la primera posición del grid y tenga un ícono de pin/chincheta visible que indique que está fija, sin poder ser movida aunque el modo edición esté activo.

**US-27 — Fondo amarillo diferenciado**
Como usuario quiero que la card de favoritos tenga un fondo levemente amarillo que sea claramente visible tanto en el tema oscuro como en el claro, para distinguirla visualmente del resto de las cards.

**US-28 — Grid de 3 columnas con controles compactos**
Como usuario quiero que las entidades favoritas se muestren en un grid de 3 columnas dentro de la card, con controles más pequeños que los habituales para que quepan en aproximadamente 3 filas dentro del ancho de una columna estándar del dashboard.

**US-29 — Agrupación por tipo de entidad**
Como usuario quiero que dentro de la card las entidades favoritas estén agrupadas por tipo (luces, switches, persianas, clima, etc.) con un separador o etiqueta de sección, y que el orden dentro de cada grupo sea de arriba a abajo y de izquierda a derecha.

**US-30 — Sugerencias de entidades frecuentes**
Como usuario quiero ver al pie de la card de favoritos una lista con los nombres de las 5 entidades que más acciono manualmente pero que aún no marqué como favoritas, como sugerencia de qué podría anclar, sin que sean controles accionables.

**US-31 — Persistencia de favoritos**
Como usuario quiero que las entidades que marqué como favoritas se recuerden entre recargas y sesiones, de modo que no tenga que volver a configurarlas cada vez.

**US-32 — Card vacía cuando no hay favoritos**
Como usuario quiero que si no tengo ninguna entidad marcada como favorita la card muestre un estado vacío con una indicación de cómo empezar a agregar favoritos, en lugar de ocultarse o mostrar un error.
