# Validación y límites de la entrega

Revisión cerrada el 20 de octubre de 2026 (America/Lima). Todo el acceso a datos fue a PostgreSQL local desechable mediante los helpers del proyecto. No se abrieron archivos `.env` reales ni se conectó a Neon para estas pruebas. No se enviaron invitaciones, pagos ni documentos reales.

## Resultado medido

| Comprobación | Resultado |
|---|---|
| Pruebas nuevas de reseñas, imágenes, JSON-LD y sesión | 18/18 correctas |
| Prisma validate, migrate deploy y generate | Correctos dentro de los runtimes locales de prueba |
| Prisma migrate diff (BD local contra schema) | Sin diferencias |
| Upgrade desde historial anterior | Conserva cuentas, productos, pedidos y líneas; reseñas vacías y totales cero |
| Build tienda y build panel | Correctos, sin leer archivos de entorno |
| JavaScript principal, mismo modo de compilación | 285301 → 288349 bytes; +1,07 %, límite +10 % |
| Revisión de sintaxis | 70 archivos backend/scripts correctos |
| git diff --check | Correcto |
| Migraciones anteriores y lockfiles | Sin cambios respecto a main base |
| npm audit API | 0 avisos |
| npm audit tienda | 5 avisos altos preexistentes, sin dependencias nuevas |

Los avisos de tienda corresponden a `braces`, `chokidar`, `fast-glob`, `micromatch` y `tailwindcss`, relacionados con su árbol anterior. Los dos lockfiles y las versiones de dependencias permanecen idénticos. No se ejecutó `npm audit fix` ni se cambió ninguna versión para ocultar el resultado. [Informe tienda](audit-tienda.json) · [Informe API](audit-api.json).

## Batería completa: no está verde

La versión base publicada (`7d14d11`, cuyo árbol de código coincide con el worktree base `5deb4b5`) ejecuta 154 pruebas: 97 pasan y 57 fallan. Con esta entrega ejecutan 172: 115 pasan y **fallan las mismas 57 por nombre**, sin fallos adicionales. La [comparación completa](comparacion.json) enumera las coincidencias; [base](baseline-main.log), [entrega](pruebas-finales.log) y [18 pruebas nuevas](resenas-final.log) conservan los resultados sin omitir fallos.

Entre los problemas anteriores hay fixtures que escriben stock directamente e infringen las protecciones de Kardex, pruebas de versiones antiguas que esperan login de personal por correo/Google o invitaciones retiradas, aserciones de separación previas y una expectativa antigua de mantenimiento. No se modificó autenticación, pedidos ni inventario para que una prueba antigua pase. Las suites actuales de inventario, POS y seguridad de personal completan sus pruebas en esta ejecución; ello no convierte en correctos los otros fallos.

Por tanto, el criterio solicitado «deben pasar las pruebas existentes» queda **pendiente de conciliación de la batería heredada**. Esta entrega se puede revisar localmente, pero no se declara totalmente aceptada ni lista para publicar sin resolver ese punto y revisar los avisos de dependencias.

## Qué cubren las pruebas nuevas

- Invitado, personal, compra ajena o pedido no entregado no pueden reseñar. Solo una reseña por usuario/producto y por línea, también con dos envíos simultáneos.
- Solo ADMIN modera; solo APPROVED es público. Nombre e inicial, sin correo, usuario ni línea de compra públicos.
- Aprobar concurrentemente suma una vez; rechazar y re-rechazar restan una vez. Reaprobar y responder conservan contadores y auditoría. Restricciones SQL de rango, texto, rechazo y totales.
- Voto útil simultáneo e idempotente; no permite votar al autor ni a reseñas ocultas. Cursor y filtros, promedio/distribución y portada con al menos tres opiniones sin filtrar notas bajas.
- HTML/enlaces y títulos/calificaciones inválidos rechazados; límite devuelve 429.
- Invitaciones apagadas sin acceso a BD/correo, envíos confirmados una vez, claves conservadas ante fallos, rechazo de respuestas sin identificador y ausencia de reintento automático fuera de ventana. Más de un lote de compras repetidas no bloquea las invitaciones nuevas.
- Upgrade aditivo desde las migraciones anteriores conserva datos; nueva BD coincide con Prisma. No se edita una migración aplicada.
- Cloudinary conserva hosts ajenos, firmas y transformaciones encadenadas; JSON-LD solo con reseñas y con escape de contenido; tokens exclusivamente en sessionStorage; configuración comercial vacía y URLs/RUC inválidos.

## Revisión visual en Edge

Se inspeccionaron portada, catálogo, producto, reseñas y moderación a 390 y 1280 píxeles en claro/oscuro. Se guardaron 21 capturas de escenarios sintéticos. Se observó y midió ausencia de desbordamiento horizontal en los recorridos comprobados; los botones de compra móviles conservan 44 px de alto. Se comprobaron estrellas solo en el producto con opiniones, bloque de portada con notas bajas incluidas y JSON-LD presente en producto.

Con la cuenta QA se envió una reseña desde la interfaz: quedó pendiente, siguió pendiente al recargar y su texto no apareció entre las públicas. El voto útil pasó a uno. ADMIN recibió la misma opinión, pudo rechazarla con motivo y consultar el motivo en Rechazadas. En la revisión anterior de esta misma entrega se guardó una respuesta, persistió tras recargar y se aprobó la reseña correspondiente. Todo se mantuvo en la base local.

Se reforzaron foco visible, contraste de textos secundarios, colores de stock y preferencias de movimiento reducido. Es revisión manual y de estilos; no es una certificación WCAG exhaustiva ni una medición Lighthouse de producción. Cloudinary y Resend no se probaron con credenciales reales: sus límites externos deben verificarse al configurar la publicación. Las capturas son QA, no testimonios de clientes ni fotografías nuevas del catálogo real.

## Repetir pruebas

Con las dependencias fijadas de ambos package-lock y Docker Desktop iniciado:

```powershell
npm.cmd run test:reviews
node --test --test-concurrency=1 server/tests/*.test.mjs server/prisma/tests/*.test.mjs
node --input-type=module -e "import{build}from'vite';await build({mode:'store',envFile:false});await build({mode:'panel',envFile:false});"
git diff --check
npm.cmd audit
npm.cmd audit --prefix server
```

El build programático desactiva la carga de `.env`. Los tests copian el schema/migraciones a un directorio temporal, generan cliente aislado y restringen PostgreSQL a loopback con usuario/base QA; no necesitan conexiones del negocio. El comando completo devuelve error mientras sigan los 57 fallos anteriores y audit tienda devuelve error por los avisos descritos.

Para la revisión visual: `npm.cmd run preview:reviews`, abrir `/revision-local`, consultar allí las credenciales efímeras, entrar como cliente y moderar en el panel con `adminqa`. No copiar la contraseña a documentación ni guardarla en el navegador. Al reiniciar el lanzador, los datos vuelven a su estado inicial sintético.
