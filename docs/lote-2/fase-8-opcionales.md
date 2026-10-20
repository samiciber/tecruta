# Monitoreo, analítica y manifest

Todos los módulos están apagados sin variables. El navegador los importa
dinámicamente solo al habilitarlos; el backend carga el transporte al recibir
el primer evento habilitado. No se instalan SDK adicionales ni se amplía CSP:
el navegador solo contacta a la API ya permitida.

## Errores

Backend: `ERROR_MONITOR_DSN`. Frontend: `VITE_ERROR_MONITOR_DSN` en su build y
`FRONTEND_ERROR_MONITOR_DSN` en la API. La primera es una bandera DSN pública;
el destino efectivo lo decide exclusivamente la configuración de la API.
Usar un DSN HTTPS de Sentry SaaS sin clave secreta, obtenido en Project Settings
→ Client Keys (DSN). No guardarlo en el repositorio. Vaciar las variables y
recompilar el frontend para desactivar. No se modifican sesiones ni permisos.

El transporte usa el [formato envelope oficial](https://develop.sentry.dev/sdk/envelopes/).
Solo transmite categoría de error conocida, origen frontend/backend, fecha y un
ID aleatorio de evento. Descarta íntegramente mensajes, stack, cabeceras, cuerpo,
URLs, datos de usuario y pagos. Esto reduce el diagnóstico a conteos por clase;
no incluye replay, trazas, sourcemaps ni captura de errores React recuperados.
Límites: 10 eventos por carga en navegador, 30/minuto/IP en la ruta, 30/minuto por
proceso en el transporte. Un fallo del proveedor no altera una operación.

Validar primero en QA con un error sintético sin información personal y
comprobar su recepción real. Las pruebas locales usan un transporte simulado:
no se ha enviado ningún evento a una cuenta de Sentry ni se afirma que esté activa.

## Analítica

Build: `VITE_ANALYTICS_DOMAIN` (dominio del sitio). API: `PLAUSIBLE_DOMAIN`
y `PLAUSIBLE_ENDPOINT` (HTTPS, ruta `/api/event`). Configurar un sitio en
Plausible y los objetivos exactos: «Vista de producto», «Agregar al carrito»,
«Inicio de checkout» y «Pedido creado». La API valida nombres contra una lista
cerrada; la entrada del navegador nunca decide el destino ni la URL reportada.

Se usa la [API de eventos de Plausible](https://plausible.io/docs/events-api).
No hay cookies, almacenamiento, IDs de cliente/producto/pedido, importes,
búsquedas, referrer, URL real ni reenvío de IP o User-Agent del cliente. Se
respeta Do Not Track y Global Privacy Control. El proveedor ve la conexión del
servidor: son conteos agregados del embudo, **no visitantes únicos ni sesiones
individuales**. Todas las páginas se agrupan en `/tienda`. Los bloqueadores o
la red pueden perder eventos; «Agregar» cuenta una acción aceptada por la UI,
no prueba de venta. «Pedido creado» ocurre tras respuesta del servidor, pero un
reintento recuperado puede contarse otra vez. No sirve para contabilidad.

El proveedor puede filtrar tráfico del servidor: verificar en QA con su panel
y revisar los filtros antes de activar. No se reclama una integración externa
validada sin recepción real. Vaciar las tres variables para apagarla.

## Disponibilidad e instalación

Un monitor externo puede consultar `GET /api/health`, exigir HTTP 200 y
`ok:true`, y avisar al responsable según el intervalo contratado. No incluir
tokens ni credenciales. Health confirma proceso; comprobar también una lectura
pública de catálogo para detectar indisponibilidad de base. No se ha configurado
un servicio externo ni cambiado alojamiento.

La tienda enlaza `manifest.webmanifest`, con nombre, colores e ícono SVG local.
El panel no lo enlaza. La opción de instalar depende del navegador/HTTPS. No hay
service worker, modo sin conexión ni caché de pedidos fuera de línea.
