# Cambio 5c — Footer, documentos legales y suscripción

Implementado sobre el trabajo pendiente de 5a/5b, sin sustituir sus diseños,
hero, círculos, paneles ni fuentes guardadas. No se publicó configuración.

## Contenido y administración

- `/admin/footer`: marca/descripción, contacto, grupos y enlaces ordenables,
  visibilidad, redes con iconos permitidos, textos de suscripción y barra legal.
- Los grupos con fuente `support` leen `cartFooterLinks`: no copian su contenido.
  Los destinos pendientes `/proximamente` y rutas no disponibles no se publican
  en el footer. Los enlaces propios se validan como rutas reconocidas o HTTPS.
- `/legal/terminos` y `/legal/privacidad` leen `site_settings.legalPages`.
  Se conservó el contenido anterior como valor inicial de texto plano; se
  añadió la información del registro de suscripción, sin inventar políticas
  comerciales. El propietario debe revisar estos documentos antes de publicar.
- Los valores iniciales de contacto/redes proceden del `storeConfig` anterior.
  Su vigencia no se verificó contactando a terceros; requieren confirmación del
  propietario. No se visitaron redes ni se enviaron correos o WhatsApp.
- `GET /api/footer`, `GET /api/legal/:type` y `GET/PUT
  /api/admin/footer-content` usan las configuraciones guardadas. El PUT valida
  ambos documentos y el footer antes de una transacción atómica.
- Guardar invalida `footer`, `legal*` y los ajustes compartidos. La API fallida
  se distingue del contenido vacío; se ofrece reintentar y se conserva la
  última respuesta válida cuando existe.

## Suscripción

- `POST /api/newsletter/subscribe`: correo validado, recortado y normalizado a
  minúsculas, aceptación obligatoria, 201 solo tras escritura, 409 duplicado,
  400 inválido y límite de cinco solicitudes por IP cada quince minutos.
- `newsletter_subscribers`: ID, correo único y fecha de registro. Migración
  `20261015000000_add_newsletter_subscribers`; CHECK adicional de normalización.
- `/admin/suscriptores`: lista paginada de 50 y exportación CSV, solo ADMIN.
  Sus dos endpoints responden 401/403 y `Cache-Control: no-store`.
- CSV entrecomilla y escapa las celdas, neutraliza prefijos de fórmulas y carga
  lotes de 500. Una descarga interrumpida o un error durante su transmisión no
  se transforma en una respuesta de éxito JSON.
- El formulario distingue envío, éxito y error; un fallo de API no muestra
  éxito ni agrega un registro. Privacidad enlazada y aceptación explícita.
- No se integraron proveedores de correo ni se implementaron campañas de email.

## Validación

Se usaron exclusivamente PostgreSQL Docker desechable, rutas de contenido
reales, resolver real y navegador Edge con contexto nuevo. Prisma se validó,
migró y generó dentro del sandbox, nunca usando un `.env` del proyecto.
Guardado/recarga se verificaron por HTTP, navegador y consulta de la base QA;
reiniciar el listener conserva las escrituras. No se probó un despliegue real.

Resultados, evidencias, mapa de campos y pasos reproducibles:
[cierre-home.md](cierre-home.md). El cliente Prisma de la instalación real no
fue regenerado; cualquier despliegue futuro debe generar su cliente y revisar
la migración mediante el procedimiento autorizado para ese entorno.
