# Cambio 5a — Home modular administrable

## Alcance

La Home obtiene su composición de `GET /api/home`. El administrador puede
ordenar, activar, editar y guardar secciones en `GET/PUT /api/admin/home-layout`.
La configuración se conserva en `site_settings.homeLayout`; no requiere una
migración. El guardado valida el payload con el mismo esquema Zod que alimenta
el resolver público.

Las secciones disponibles son hero, círculos, carruseles de productos, banners
inline por slot, campañas con fecha de vencimiento y la franja de acceso a la
cuenta para visitantes. Esta última reutiliza `GuestStrip`, se puede ordenar,
activar o desactivar desde Diseño del Home y no anuncia condiciones comerciales
no configuradas. El resolver omite secciones sin datos publicables y devuelve
las causas para el administrador. Los banners inline se agrupan como banner
completo o parejas de medios banners. El hero y los círculos aceptan props ya
resueltas y mantienen sus fuentes de configuración compatibles para los demás
consumidores.

El carrusel soporta pestañas, desplazamiento horizontal con snap, controles
accesibles, panel lateral y enlace «Ver todo». Las tarjetas no inventan
valoraciones ni descuentos; el descuento se muestra solo si el precio de
comparación supera el actual. Se respeta el stock y la compra desde Home
revalida el producto contra la API antes de agregarlo. La cuenta regresiva se
limita a campañas configuradas con fecha futura y la sección se oculta al vencer.

Los cambios de productos, categorías, marcas, banners, círculos, ajustes de Home
y diseño invalidan la caché de Home. La petición pública usa `no-store` en el
navegador; el TTL lo controla `useCachedResource`. La Home no activa la descarga
del catálogo completo con carrito/guardados vacíos y búsqueda cerrada. El
contenido inferior difiere su renderizado y reserva espacio. Los testimonios y
promociones fijas dejaron de renderizarse en Home; no se borraron componentes
que puedan tener otros consumidores.

## Contexto heredado y estado de los Cambios 1–5

La rama base era `fc849fb`, con `96645a2` como integración del Lote 1 y
`fc849fb` integrando los Lotes 2–9. La historia anterior incluye una base de
panel/API (`e294270`), navegación editable (`8470fc1`), banners del hero
(`f56fbb6`) y círculos administrables (`60917ed`). Son evidencia de código
preexistente, no una certificación de que los Cambios 1–4 de Claude estén
completos: los documentos disponibles no establecen una correspondencia
verificable de cada cambio numerado con esos commits.

Antes de este trabajo ya existían la configuración de banners del Home,
categorías/círculos y ajustes de sitio, pero no `homeLayoutSchema`,
`homeDefaults`, `homeResolver` ni los endpoints dedicados de Home. Este cambio
añade esa parte backend y el compositor/frontend de 5a. No se declara completo
el Cambio 5: los tiles adicionales, marcas, beneficios, footer nuevo y newsletter
de 5b/5c quedan fuera.

## Verificación

Resultados previos reportados por el agente anterior (no repetidos en esta revisión):

- `node --test server/tests/home-layout.test.mjs`: 6/6; incluye ambos GET de
  Express con delegates Prisma en memoria y autorización ADMIN (sin conexión
  a base de datos), junto con compatibilidad de GuestStrip, banners heredados,
  círculos configurados y ajustes del carrusel hero.
- `node --test server/prisma/tests/home-layout.integration.test.mjs`: 1/1 contra
  PostgreSQL desechable. Reutiliza `isolated-runtime.mjs`, verifica el motor
  Docker local, ejecuta Prisma CLI con `process.execPath` desde el sandbox y
  crea conexiones `qa_*` a loopback. El esquema y las migraciones se copian al
  sandbox sin `.env`; el cliente Prisma de la API usa la URL local explícita.
  Limpia el contenedor, su volumen y el sandbox propios al terminar.
- La prueba PostgreSQL comprueba guardar y recuperar el diseño ADMIN, conservar
  el layout y banners después de reiniciar el listener Express, 401 sin sesión,
  403 para un CUSTOMER, rechazo de layout inválido sin alterar el valor guardado,
  orden y activación, ocultación sin datos, filtros de categorías ocultas/legacy
  y banners inactivos, y actualización de Home después de editar banners. Además
  verifica el mapeo de invalidación de caché para banners y productos.
- `npm run build`: finaliza correctamente.
- Navegador con un API mock local en memoria: Home configurada, vacía y error
  de API; editor de Home con edición, orden, guardado, recarga y confirmación
  de restauración. El guardado mock validó el payload con `homeLayoutSchema`.
- En Home configurada se probaron pestañas, scroll snap/controles, ahorro,
  stock, guardados, carrito, banners completos/en pareja, contador futuro y
  desaparición al vencer. Con almacenamiento vacío no se pidió `/api/products`;
  guardar o comprar sí provocó la verificación esperada.
- Ancho de documento sin desbordamiento a 390, 768, 1024, 1280, 1440 y 1920 px.
  Se verificaron ambos estados de la clase `dark`; capturas: móvil claro y
  escritorio oscuro.
- Regresión de navegador adicional con un mock separado en `localhost:4001`:
  Home abre sin pedir `/api/products` con carrito/guardados vacíos y búsqueda
  cerrada; abrir búsqueda y consultar sugerencias sí solicita el catálogo.
  Guardar un producto lo conserva en la lista; verificar y agregar lo persiste
  en el carrito, donde aparecen producto, cantidad y subtotal. Se verificó que
  el compositor admin carga con una sesión ADMIN simulada.
- Cierre de GuestStrip/Home con Edge local y un mock dedicado en `127.0.0.1:4002`:
  configuración ausente usa defaults y muestra GuestStrip al visitante; la franja
  se oculta con sesión simulada; la API en 503 deja mensaje de error, reintento y
  enlace al catálogo sin listar productos; un diseño con hero y GuestStrip
  desactivados muestra estado vacío sin reactivarlos. El compositor añadió y
  guardó GuestStrip, volvió a cargar el diseño y validó el payload con el esquema
  Zod del servidor. Las ilustraciones son SVG de prueba servidas localmente;
  no se consultaron imágenes ni APIs externas.
- Capturas locales del cierre: `cambio-5a-home-desktop.png`,
  `cambio-5a-home-movil.png` y `cambio-5a-compositor-actual.png`. En móvil
  (390 px) el ancho del documento coincide con el viewport.
- `git diff --check`.

Limitaciones de la verificación previa:

- No se levantó la API Express con una base existente. Sí se reportó aprobada
  la integración HTTP contra PostgreSQL desechable indicada arriba (1/1).
  La suite unitaria usa delegates Prisma en memoria y el navegador usó respuestas
  simuladas, sin llamadas de producción.
- No se midió Lighthouse, Core Web Vitals ni rendimiento con imágenes reales.
- El repositorio solo contiene el favicon como imagen raster local; por eso las
  capturas nuevas usan ilustraciones SVG generadas para el mock, no fotografías
  reales del catálogo ni contenido comercial de producción.
- No se repitió la matriz visual completa al cerrar 5a; la única comprobación
  de navegador adicional cubrió el fallback, GuestStrip, el compositor y el
  ancho móvil de 390 px.
- La revisión visual quedó pendiente tras esas capturas: el capturador produjo
  imágenes incompletas, especialmente en oscuro. Esto no confirmó un fallo de
  la aplicación. La revisión dirigida posterior se registra abajo.
- El proyecto no expone un modelo ni selector de variantes; el inventario actual
  se maneja por producto. Algunas entradas del catálogo describen variantes con
  productos/IDs/slugs separados (por ejemplo, Uno Variante A y B); no hay
  relación de agrupación ni selector compartido. Se conserva ese comportamiento:
  cada ficha y compra apunta al producto individual. Agrupación/selección de
  variantes queda como función futura, sujeta a un contrato de catálogo y UX.

### Revisión dirigida del panel lateral — 15 de octubre de 2026

- La prueba nueva reprodujo el fallo antes de corregirlo: un diseño aceptado
  por `homeLayoutSchema` perdía `panel` al resolver la sección de productos.
  El resolver ahora conserva ese mismo objeto validado, sin cambiar el esquema.
- `node --test server/tests/home-layout.test.mjs`: 7/7 aprobadas en esta revisión.
  La regresión verifica el panel después de serializar/deserializar el JSON,
  la sección sin panel y la ocultación de secciones desactivadas o sin productos.
  Por inspección, `Home` pasa `section.panel` a `ProductCarousel`, que renderiza
  sus campos; no se repitió la revisión visual del navegador.
- Build aprobado con la configuración existente de Vite y lectura de `.env`
  desactivada: `node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false });"`.
  El primer intento falló por permisos del sandbox al cargar la configuración;
  el reintento autorizado terminó correctamente. Emitió avisos sobre el import
  estático/dinámico de departamentos y chunks mayores de 500 kB.
- `git diff --check`: aprobado. No se repitió la integración PostgreSQL ni
  se ejecutaron migraciones, instalaciones o consultas a producción.

### Revisión visual dirigida posterior — 15 de octubre de 2026

Se revisó Home con API sintética local que ejecuta el resolver real, sin
prefabricar `/api/home`, a 1440 × 1000 y 390 × 844 CSS px, claro y oscuro.
El panel, hero, banners, precios, stock y controles quedaron comprobados, sin
desbordamiento horizontal de la página. Se corrigió únicamente el contraste
de textos del carrusel en oscuro. Después: pruebas de Home 7/7, build sin
lectura de `.env` y `git diff --check` aprobados. Capturas recortadas descartadas;
se entregan segmentos legibles. Véase [evidencia y pendientes](evidencia-5a/README.md).

## Reproducir

```powershell
node --test .\server\tests\home-layout.test.mjs
npm run build
git diff --check
```

El compositor requiere una sesión ADMIN. La restauración de valores iniciales
solicita confirmación antes de reemplazar el diseño actual. No ejecutar
migraciones ni seeds para probar este cambio.

## Fuera de alcance y limitaciones

- Cambio 5b/5c.
- Verificación contra las credenciales/proveedores reales de producción.
- Migraciones o escrituras sobre bases existentes: no son necesarias para 5a
  y no se ejecutaron. La integración previamente reportada creó y escribió solo
  su PostgreSQL desechable de prueba.
- Los banners/imágenes del navegador fueron fixtures servidos por el API mock;
  no sustituyen la revisión de contenido comercial real en el admin.
