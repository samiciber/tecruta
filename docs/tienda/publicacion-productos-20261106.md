# Mejoras de productos — 6 de noviembre de 2026

## Alcance revisado

Rama de entrega: `publicacion/mejoras-productos-20261106`.
Commit funcional: `601ba15f81181966435d95b47d5fc18eca440095`.

Los cambios nuevos del commit `9bda225` se integraron sobre `a86f768`, que
contiene los filtros contextuales publicados el 2 de noviembre. Se resolvió
el conflicto de imports del listado de productos conservando su paginación.
No se publicó directamente la rama antigua: habría retirado filtros, videos
del carrusel, contraste del buscador y la política de claves administradas.
Las ramas y archivos locales originales se conservaron.

- Creación de productos con enlace generado a partir del nombre; colisiones
  secuenciales reciben sufijos. Los enlaces explícitos duplicados se rechazan.
- Listado del panel con búsqueda por SKU, SKU visible, enlace a la tienda y
  recarga del saldo ante conflictos de edición. Se conservan 25 filas por página.
- Ficha técnica pública compacta: cinco filas y botón para mostrar el resto.
  Imagen fallida muestra un marcador estable.
- Bloqueos de productos antes de crear líneas de pedidos y ventas, para evitar
  el ciclo de bloqueos con claves foráneas. Precios y existencias se consultan
  después del bloqueo. Se conserva el mecanismo transaccional de Kardex.
- Corrección del orden de bloqueo marca/producto al editar.
- Actualizaciones ya propuestas de dependencias de servidor, instaladas con
  `npm ci`: Zod, qs y body-parser. React, Express y Prisma conservan sus versiones.

No cambian esquema Prisma, migraciones, DNS ni credenciales. No se cargaron
datos QA ni se realizaron compras de prueba en producción.

## Validación local

Todas las pruebas con base usan PostgreSQL local desechable y datos sintéticos.

- Unitarias: 65/65.
- Inventario y POS tras ajustar lectura bajo bloqueo: 34/34, incluida nueva
  prueba HTTP de generación de enlaces, duplicados, precio cero y persistencia.
- Rendimiento público y búsqueda: 9/9; se mantienen atributos de filtros,
  tarjetas compactas, caché, compresión y búsqueda indexada.
- Pedidos y autenticación de lotes 3 y 4: 23/23.
- Panel y sistema de personal: 21/21. Se corrigió una expectativa de prueba
  antigua que pedía cambio obligatorio de contraseña; la política vigente usa
  claves asignadas por ADMIN y está cubierta por la suite de personal.
- Ambos builds locales correctos (`npm run build:qa`, sin cargar archivos .env).
- Sintaxis de 106 archivos correcta; lint sin errores y cinco advertencias previas.
- `git diff --check` limpio.

La revisión visual interactiva sigue pendiente: el host del navegador y la
conexión nativa no están disponibles. No se presentan capturas nuevas como
evidencia ni se afirma haber comprobado visualmente móvil y temas.

## Despliegues y recuperación

- Tienda: `dpl_D5Bv5aLo4cP4coJtL1QRp9TTy627`, READY y dominio
  `www.tecruta.com` asignado al commit funcional indicado.
- API: `dep-dbmvgmgm7kps73ceq4t0`, iniciada por el usuario desde Render
  seleccionando el commit específico. Estado `live`; `/api/health` devuelve el
  SHA funcional esperado.
- Panel: `dpl_E1bcoD5Cr2rHNiH6BYRuchBMWRTL`, READY, entorno `production`,
  mismo SHA y dominio `tecruta-panel.vercel.app` asignado.

Comprobaciones posteriores: HTTP 200 de tienda, catálogo, UGREEN, panel y API
de inicio/pie de página; tarjetas UGREEN conservan `filterAttributes`;
API administrativa sin credenciales devuelve 401. Los archivos JavaScript
servidos incluyen ficha compacta, marcador de imagen, enlace desde el editor
a la tienda y paginación. Son comprobaciones de entrega de archivos y respuesta
HTTP; no equivalen a una sesión visual autenticada. No aparecieron registros
de nivel error de Render desde el arranque de esta revisión, ni error/fatal
de Vercel en la ventana inmediata de cinco minutos consultada. Esto no cubre
errores del navegador del cliente ni sustituye seguimiento posterior.

Versiones previas para reversión de código:

- API: `665c18f52610eb9f10a95176e82b2e89b2e7deb6`,
  `dep-dbk4tenb9u1s73fkn140`.
- Tienda: `dpl_A3zbLbgKST49m1NghsVFkrEC23Q6`.
- Panel: `dpl_EZCasCF5wxFjwtyJ2uXKGrrmw239`.

Ante una regresión, revertir primero el panel si ya se desplegó y después la
API al commit específico anterior. Para un problema visual de la tienda,
revertir su despliegue. No restaurar bases ni borrar productos, ventas o
movimientos. No usar «Deploy latest commit»: la rama `main` está atrasada
respecto de las entregas publicadas.
