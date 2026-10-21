# Lote 2: tienda completa

## Publicado

El acceso Git se recuperó y se publicó la revisión 8632f75 de esta rama,
sin merge a main: API, tienda y panel. Se aplicaron las dos migraciones nuevas
después de crear una copia aislada del esquema y los datos en Neon. Consulta el
[registro de publicación](publicacion/README.md). Las notas siguientes conservan
el historial de preparación y del bloqueo anterior, ya resuelto.

## Publicación autorizada, pendiente de acceso

El 20 de octubre de 2026 el dueño autorizó «esta bien publicalo».
La comprobación de publicación encontró acceso activo a Vercel, Render y Neon,
pero Git por HTTPS no pudo comunicarse con GitHub y el conector disponible
solo permite leer el repositorio. No se hizo push, promoción, migración ni
cambio de configuración de producción. La tienda conserva su versión anterior.
La autorización se conserva; falta restablecer un acceso de escritura operativo
al repositorio antes de preparar el respaldo y continuar con la API y frontend.
Las notas siguientes describen la entrega local anterior a esa autorización.

Trabajo local desde la rama de rediseño publicada. No se despliega, no se hace
push ni merge a main, no se leen archivos .env reales ni se usa producción.
Los datos sintéticos pertenecen exclusivamente a PostgreSQL local desechable.

## Entrega para revisión local

Rama: `feature/lote-2-tienda-completa`, creada desde
`feature/rediseno-tienda-resenas`. Fases 1–8 implementadas con las limitaciones
de validación que se detallan abajo. La aceptación integral sigue pendiente:
la batería histórica tiene 55 fallos y los proveedores externos no están activos.
La fase 9 no se implementó porque exige las anteriores completamente verdes.

| Documento | Contenido |
|---|---|
| [Validación](validacion.md) | Pruebas, revisión visual y límites reales |
| [Rendimiento](rendimiento.md) | Antes/después y metodología Lighthouse |
| [Capturas](capturas/README.md) | 24 vistas de 390/1280 px, claro/oscuro |
| [Calidad](fase-7-calidad.md) | 199 pruebas, triage por archivo y CI |
| [Publicación y recuperación](publicacion-recuperacion.md) | Dos migraciones, variables y rollback sin perder movimientos |
| [Archivos cambiados](archivos.md) | Lista de rutas respecto a la rama base |

Para revisar: instalar dependencias raíz/server con scripts de instalación
desactivados, generar el cliente mediante `node scripts/qa-generate-client.mjs`
y ejecutar `node scripts/preview-lote-2.mjs` con Docker local. La tienda usa el
puerto 5203 y el panel QA el 5204. `/revision-local` muestra las credenciales
efímeras del entorno, sin guardarlas en documentación. Cerrar con Ctrl+C.

La navegación nueva está en `/categorias`; compartir, zoom y compra móvil en
`/producto/:slug`. Carrito, checkout, cuenta y panel conservan sus rutas.
La tienda de Internet no contiene este lote todavía.

## Orden de trabajo

1. Correos: outbox duradero, cinco estados, proveedor existente y bandera apagada.
2. SEO: metadatos, rastreadores y sitemap limitado con origen API fijo.
3. Rendimiento: compresión, caché pública explícita, tarjetas livianas y medición.
4. Producto: compartir, zoom accesible, información comercial y compra móvil.
5. Búsqueda: normalización sin extensiones nuevas y sugerencias remotas limitadas.
6. Móvil/textos: navegación inferior y auditoría de textos CMS/legales.
7. Calidad: herramientas mínimas, CI sin secretos y conciliación de tests históricos.
8. Opcionales: monitoreo/analítica inactivos y manifest sin service worker.
9. Cupones: solo se abordará si 1–8 están completos y verdes.

Cada fase lleva commit y pruebas pertinentes. Los módulos optativos permanecen
apagados. No hubo contactos con proveedores ni uso de datos reales del negocio.

## Decisiones iniciales

- Los estados notificables son PENDING (recibido), PAID, SHIPPED, DELIVERED y
  CANCELLED. CONFIRMED no equivale a dinero recibido y no genera correo de pago.
- Los registros de envío se insertan a partir del historial dentro de su misma
  transacción mediante un trigger aditivo. El envío ocurre después, en un worker
  separado; no se cambian las transiciones ni el POS. La migración no rellena
  pedidos históricos.
- La búsqueda reutiliza pg_trgm existente; no instala extensiones nuevas.
  La columna normalizada conserva los originales.
- No se infieren políticas comerciales ni se redactan documentos legales.
- No se añadirá un preview enlazado a producción ni se ampliará CORS para probarlo.
  Un eventual preview necesita API QA aislada y no es requisito para esta entrega.

La referencia inicial está en base.json: 172 pruebas, 115 correctas, 57 fallidas.
Después: 199 pruebas, 144 correctas y 55 fallidas; 27 pruebas nuevas correctas y
ningún nombre fallido nuevo. El conjunto vigente pasa 128/128 (55 unitarias y
73 de integración). No se presenta la batería completa como verde.

## Pendientes del dueño

Revisar menús/banners del CMS, reemplazar documentos legales vacíos o de ejemplo,
completar Datos comerciales y verificar contactos configurados del pie. Aprobar
el remitente y conciliar la cola antes de activar correos. Configurar y validar
recepción real de Sentry/Plausible solo si decide usarlos. Aprobar publicación
por fase, después de revisar riesgos y deuda histórica. No es necesario cambiar
de base de datos, dominio o alojamiento para revisar esta entrega.
