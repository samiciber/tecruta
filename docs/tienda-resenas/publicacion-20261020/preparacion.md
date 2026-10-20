# Publicación autorizada: rediseño y reseñas

Autorización del titular: «esta bien publica todo segun el prompt pasado». Incluye el despliegue y la migración aditiva de reseñas; no implica importar QA ni emitir documentos o correos. Se conserva main: publicación desde feature/rediseno-tienda-resenas mediante selección del commit.

## Comprobado antes de desplegar

- 63/63 pruebas vigentes de inventario, POS, seguridad del personal, reseñas y utilidades, PostgreSQL local desechable. Registro: ../validacion/prepublicacion.log.
- Ambos builds y diff --check correctos en el ajuste compacto 062bd63.
- API actual 972628acddcb2da8a6390b28d4d1e1cbe9cc0ae2, despliegue dep-dbakj1e1egvs73b2sdn0. Autodeploy desactivado.
- Tienda actual 7d14d1180badc16e65f75341a7c723888fb978c4, despliegue EpNwLYN7mpD8HCvQQJ5tTpjZfvHU.
- Neon production br-dark-cell-ayy9bjhb, neondb: 13 migraciones terminadas, hasta staff_credentials_security; la consulta no mostró intentos fallidos.
- Instantánea manual previa: production at 2026-10-20 07:04:32 UTC (manual), visible con caducidad nunca. No se restauró sobre producción.
- Las huellas históricas coinciden con LF salvo inventario/POS que coinciden con CRLF; diferencias de finales de línea, sin modificar SQL aplicado.

## Conciliación de la batería histórica

La batería completa conserva 57 fallos que también reproduce main sin estos cambios (comparacion.json). No se ocultan, omiten ni convierten en correctos. Incluyen instalaciones que excluyen una migración intermedia conservando sus sucesoras, fixtures de stock directo incompatibles con Kardex, y expectativas de Google/personal de versiones sustituidas. La suite vigente de seguridad comprueba el flujo actual de personal y Google de clientes; inventario/POS comprueban la operación actual sin modificarla. La comparación con la API realmente desplegada no contiene cambios en autenticación, órdenes, inventario o POS. Se publica con esa deuda de pruebas documentada; no se declara que todas las pruebas históricas pasen. Permanecen cinco avisos altos preexistentes en dependencias de desarrollo y ninguna dependencia nueva.

## Plan de aplicación

Respaldar, publicar rama en GitHub sin merge a main, ejecutar migrate deploy desde compilación manual de Render con conexión ya configurada, regenerar Prisma, comprobar API, desplegar/promover tienda y panel desde el mismo SHA, verificar lecturas públicas y denegación anónima ADMIN. Restablecer el build original de Render al terminar; mantener autodeploy desactivado. Solo una migración nueva; invitaciones apagadas. No crear operaciones sintéticas en producción.

El resultado final del despliegue se registrará por separado; esta preparación no acredita publicación terminada.
