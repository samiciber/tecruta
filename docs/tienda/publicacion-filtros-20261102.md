# Publicación de filtros — 2 de noviembre de 2026

Publicado el commit `665c18f52610eb9f10a95176e82b2e89b2e7deb6`.

- API Render: `dep-dbk4tenb9u1s73fkn140`, estado `live`. El usuario inició
  el despliegue del commit específico desde el Dashboard; el conector no permite
  seleccionar un SHA. `/api/health` confirmó la revisión indicada.
- Tienda Vercel: `dpl_A3zbLbgKST49m1NghsVFkrEC23Q6`, estado `READY`, entorno
  `production`, mismo SHA y dominio `www.tecruta.com` asignado.
- El panel no necesitó despliegue. Sin migraciones, cambios de DNS ni escrituras
  de datos de negocio.

## Comprobaciones

- HTTP 200: inicio, `/catalogo`, `/marca/ugreen`, API `/api/home` y
  `/api/site-settings`.
- Consulta de tarjetas UGREEN: 199 productos, todos con `filterAttributes`;
  ninguno incluye el campo completo `specifications`.
- Repetidas las cuatro pruebas de filtros: 4/4 correctas; `git diff --check`
  limpio. La validación previa completa se detalla en `filtros-contextuales.md`.
- No se efectuaron compras ni otras operaciones de negocio de prueba.
- Pendiente revisión visual de escritorio, móvil y temas: el host del navegador
  no está disponible y el control nativo se detuvo por no poder verificar la URL.
  Las comprobaciones HTTP y de componentes no sustituyen esa revisión.

## Recuperación

Si hay una regresión, revertir primero la tienda a
`dpl_6Hs76WVHbRWh2EfdQGiet7KWwm91` (versión anterior del carrusel) y después,
si hace falta, desplegar en Render el commit
`6e09ef1bf8a6e8148075da01cf74643bfb9c5ef8` (despliegue anterior conocido
`dep-dbi3sr4s728c73c963sg`). Seleccionar siempre el commit específico: `main`
está atrasada y no representa esta entrega. No restaurar ni borrar datos.

## Revisión del usuario

Abrir https://www.tecruta.com/marca/ugreen y seleccionar una familia disponible.
Comprobar categorías, contadores, grupos plegables y quitar filtros mediante
sus etiquetas. Los atributos técnicos solo aparecen cuando las especificaciones
reales del catálogo contienen valores admitidos y opciones distintas; no se
inventan características a partir de nombres de productos.
