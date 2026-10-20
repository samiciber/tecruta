# Publicaci?n autorizada: redise?o y rese?as

Autorizaci?n del titular: ?esta bien publica todo segun el prompt pasado?. Incluye el despliegue y la migraci?n aditiva de rese?as; no implica importar QA ni emitir documentos o correos. Se conserva main: publicaci?n desde feature/rediseno-tienda-resenas mediante selecci?n del commit.

## Comprobado antes de desplegar

- 63/63 pruebas vigentes de inventario, POS, seguridad del personal, rese?as y utilidades, PostgreSQL local desechable. Registro: ../validacion/prepublicacion.log.
- Ambos builds y diff --check correctos en el ajuste compacto 062bd63.
- API actual 972628acddcb2da8a6390b28d4d1e1cbe9cc0ae2, despliegue dep-dbakj1e1egvs73b2sdn0. Autodeploy desactivado.
- Tienda actual 7d14d1180badc16e65f75341a7c723888fb978c4, despliegue EpNwLYN7mpD8HCvQQJ5tTpjZfvHU.
- Neon production br-dark-cell-ayy9bjhb, neondb: 13 migraciones terminadas, hasta staff_credentials_security; la consulta no mostr? intentos fallidos.
- Instant?nea manual previa: production at 2026-10-20 07:04:32 UTC (manual), visible con caducidad nunca. No se restaur? sobre producci?n.
- Las huellas hist?ricas coinciden con LF salvo inventario/POS que coinciden con CRLF; diferencias de finales de l?nea, sin modificar SQL aplicado.

## Conciliaci?n de la bater?a hist?rica

La bater?a completa conserva 57 fallos que tambi?n reproduce main sin estos cambios (comparacion.json). No se ocultan, omiten ni convierten en correctos. Incluyen instalaciones que excluyen una migraci?n intermedia conservando sus sucesoras, fixtures de stock directo incompatibles con Kardex, y expectativas de Google/personal de versiones sustituidas. La suite vigente de seguridad comprueba el flujo actual de personal y Google de clientes; inventario/POS comprueban la operaci?n actual sin modificarla. La comparaci?n con la API realmente desplegada no contiene cambios en autenticaci?n, ?rdenes, inventario o POS. Se publica con esa deuda de pruebas documentada; no se declara que todas las pruebas hist?ricas pasen. Permanecen cinco avisos altos preexistentes en dependencias de desarrollo y ninguna dependencia nueva.

## Plan de aplicaci?n

Respaldar, publicar rama en GitHub sin merge a main, ejecutar migrate deploy desde compilaci?n manual de Render con conexi?n ya configurada, regenerar Prisma, comprobar API, desplegar/promover tienda y panel desde el mismo SHA, verificar lecturas p?blicas y denegaci?n an?nima ADMIN. Restablecer el build original de Render al terminar; mantener autodeploy desactivado. Solo una migraci?n nueva; invitaciones apagadas. No crear operaciones sint?ticas en producci?n.

El resultado final del despliegue se registrar? por separado; esta preparaci?n no acredita publicaci?n terminada.
