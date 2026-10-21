# Calidad y deuda histórica

## Comandos reproducibles

Instalar con `npm ci --ignore-scripts` en raíz y server. Generar el cliente QA
mediante `node scripts/qa-generate-client.mjs`: usa schema temporal, dotenv vacío
y URL local sintética; no descubre la configuración del negocio.

| Comando (raíz) | Alcance |
|---|---|
| `npm test` | Todas las pruebas unitarias en server/tests |
| `npm test --prefix server` | Integración vigente: inventario, POS, personal, reseñas y este lote |
| `npm run test:all` | Batería completa, incluidos históricos pendientes; devuelve error si fallan |
| `npm run lint` | Errores sintácticos/lógicos básicos en JS/JSX, sin plugins extra |
| `npm run format:reviews` | Comprueba los seis archivos formateados |
| `npm run check:syntax` | node --check de backend, funciones y scripts |
| `npm run build:qa` | Tienda y panel sin cargar archivos .env |

El workflow ejecuta instalación, lint, build, sintaxis, Prisma, auditoría de
producción y pruebas. Un servicio PostgreSQL vacío comprueba deploy, índices y
ausencia de deriva. Las suites vigentes usan sus contenedores desechables para
aislar concurrencia y migraciones. Sin secretos. El job `historicos` ejecuta
todo con fallo visible y continue-on-error: **su resultado no demuestra que
toda la batería esté verde**. No se omiten tests mediante skip ni se eliminan
aserciones para esconder deuda.

ESLint y Prettier son dependencias exclusivamente de desarrollo, requeridas por
el encargo. Configuración mínima, sin plugins de React ni cambios de versiones
de React/Express/Prisma/Vite. Cinco comentarios heredados de react-hooks producen
advertencias de directiva inactiva; no son errores de lint ni un análisis de
hooks. ESLint 9.39.1 informa fin de soporte al instalar: actualizar esta
herramienta de desarrollo queda como mantenimiento separado. El commit
`style: format` afecta únicamente los seis archivos de reseñas, sin comportamiento.

## Antes y después

Base: 172 pruebas, 115 correctas, 57 fallidas, ninguna omitida. Resultado del
lote: **199 pruebas, 144 correctas y 55 fallidas**, ninguna omitida. Unitarias:
55/55. Integración vigente: 73/73. Los 55 nombres restantes pertenecían ya al
conjunto de fallos de la base; no hay nombres fallidos nuevos. Ver
`tests-despues.json` y `triage-fallos.json` para el inventario completo.

Se actualizó la prueba de MAINTENANCE_MODE: el sistema actual ya no implementa
ese bloqueo global. Ahora comprueba health disponible y que esa variable antigua
no sustituye la autorización de API. No se restablece un bloqueo ni se modifica
autenticación. La prueba de creación/DTO por marca también pasa con el contrato
actual; sus aserciones se conservaron.

Durante este lote apareció y se corrigió un fallo nuevo real: la migración de
búsqueda con productos existentes debía resolver los triggers diferidos de
integridad antes de crear índices. SET CONSTRAINTS ALL IMMEDIATE valida esas
comprobaciones; no las desactiva. Se repitió el upgrade con saldo existente y
pasaron sus 14 pruebas. No se editó ninguna migración de la rama base.

## Triage de los 55 pendientes

| Archivo en server/prisma/tests | Fallos | Motivo y tratamiento pendiente |
|---|---:|---|
| final-home.integration | 1 | Fixture inserta stock directo, incompatible con Kardex. Adaptar al servicio central; revisar además el antiguo contrato de newsletter y la expectativa de texto legal de respaldo. |
| home-layout.integration | 1 | Productos anidados con stock sin movimiento. Construir fixtures mediante inventario. |
| lote-2 | 3 | Historia «anterior» excluye una migración intermedia pero conserva sucesoras. Reconstruir prefijos históricos y comparar columnas existentes sin aplicar guardias futuras prematuramente. |
| lote-3 | 8 | Fixtures de pedidos anteriores a Kardex y creación directa de stock. Las pruebas vigentes inventario/POS cubren reserva, concurrencia, pago y cancelación. No desactivar los triggers para hacerlas pasar. |
| lote-4 | 13 | Setup histórico de seguridad excluye una migración mientras conserva las dependientes. Falla el hook; no acredita trece defectos independientes. Reconstruir su esquema anterior sin cambiar auth en este lote. |
| lote-6 | 7 | Creación/edición de stock sin stockReason. Adaptar entradas al contrato vigente conservando las aserciones de pares marca/relación y concurrencia. |
| lote-9 | 6 | Fixtures de lectura de pedidos insertan stock directamente y fallan antes de probar permisos. Usar movimientos sintéticos auditables y repetir privacidad. |
| panel-access | 8 | Supone panel con Google/correo y esquema sin inventario/POS; política posterior exige usuario de personal. Separar pruebas históricas del contrato actual, sin reabrir acceso anterior. |
| panel | 6 | Invitaciones por correo y perfiles de una versión anterior. La suite staff-system vigente prueba usuarios sin correo, contraseña temporal, revocación y MFA. |
| separation | 2 | Afirma ausencia de módulos y espera destinos de una separación anterior. Actualizar sobre la aplicación integrada y su configuración de orígenes. |

Son correcciones de fixtures y de versiones de contrato que requieren su propia
revisión; no se declara una certificación integral mientras permanezcan rojas.
La fase 9 de cupones **no se implementa ni se activa**, porque su condición exige
fases 1–8 completas y verdes. No se agregan tablas, campos, descuentos ni bandera
de cupones al checkout.

Auditoría de producción en raíz y server: cero vulnerabilidades. El árbol de
desarrollo conserva cinco altas anteriores en herramientas de estilos; no se
ejecutó audit fix ni una actualización mayor de versiones fijadas.
