# Cierre local de Home y administración

## Estado y alcance

Rama conservada: `revision/cambio-5a`. HEAD:
`fc849fbd60f98f879629db84b1a02560f3ad4b73`. Sin staging, commit, push, merge,
cambio de rama ni publicación. No se encontraron AGENTS.md aplicables.
Se mantuvieron los cambios previos; el inventario `cierre-home-cambios.json`
distingue archivos anteriores modificados en este encargo de archivos nuevos.

5a/5b ya aportaban contrato, resolver, compositor y módulos. Este cierre añade
edición y previsualización completas, selección manual, imágenes móviles,
apariencia controlada, footer y suscripción persistente. GuestStrip ya había
sido reincorporado; la integración PostgreSQL de 5a estaba reportada como
aprobada. Esos resultados anteriores no se contabilizan como pruebas de ahora.

## Propuesta de composición

Las cuatro referencias Best Buy se revisaron de arriba abajo. Se adaptó su
ritmo de módulos, filas divididas, tiles y contenido inferior: encabezado y hero
existentes → acceso de invitado → círculos → fila 60/40 editorial/productos →
cuatro tiles → selección por uso → marcas → beneficios informativos → footer.
La campaña del ejemplo permanece desactivada: no representa una promoción real.
Soporte se concentra en el footer para evitar duplicarlo en ese borrador.

El ejemplo ejecutable está en
`server/prisma/tests/helpers/final-home-fixtures.mjs`. Solo se carga en una base
vacía desechable. Sus SVG, precios, marcas y productos son fixtures, no valores
comerciales predeterminados. No sustituye `homeDefaults`, banners, círculos ni
diseños guardados. No se copiaron recursos, marcas o promociones de Best Buy.
El propietario debe cargar fotografía/editoriales y seleccionar productos
reales antes de usar una composición equivalente en su tienda.

Están disponibles los 13 tipos: hero, círculos, acceso de invitado, productos,
campaña, banners inline, fila dividida, tiles, marcas, beneficios, soporte,
texto legal y selecciones por uso. No se agregan automáticamente a diseños
existentes. Los bloques incompletos/inactivos se ocultan con motivo en el admin.

## Mapa de elementos visibles → administración

| Elemento | Pantalla y configuración |
| --- | --- |
| Orden, visibilidad y tipo de sección | Diseño del Home → `homeLayout.sections[]`, `active`; botones subir/bajar |
| Fondo y densidad | Diseño del Home → `appearance.tone/density`, valores enumerados compatibles con temas |
| Hero, banner editorial e inline | Banners del Home → `homeBanners`: título, eyebrow, descripción, imágenes desktop/mobile, alt, posición, overlay, botones, placement/slot, ancho, activación y fechas; ajustes de carrusel existentes |
| Círculos | Círculos de la Home → `homeCircles`; categorías/imágenes/etiquetas/orden, visibilidad, título y límite existentes |
| Franja para invitados | Diseño del Home → sección guestStrip: mensaje, botón y destino; se conserva condición de visitante |
| Carruseles y pestañas | Diseño del Home → products: título, sources (fuente/etiqueta/destino), límite; selección manual ordenable hasta 20; panel título/descripción/etiqueta/destino |
| Campaña | Diseño del Home → título, fin en hora local, fuente, límite, enlace; banners siguen usando sus fechas existentes |
| Fila dividida | Diseño del Home → banner existente, panel de categorías o productos, orden, 50/50 o 60/40 y límite |
| Tiles | Diseño del Home → cuatro/cinco elementos ordenables, título, descripción, imágenes desktop/mobile, alt y enlace |
| Comprar por marca | Diseño del Home → título/límite; Marcas → nombre, slug, logo, visibilidad, destacado y posición |
| Beneficios | Diseño del Home → hasta cuatro iconos de lista permitida, títulos/textos y orden; sin promesas iniciales |
| Soporte | Ajustes del sitio → `cartFooterLinks`, única fuente; sección supportLinks y grupo footer `source: support` la reutilizan |
| Texto legal en Home | Diseño del Home → título y texto plano hasta 6000 caracteres |
| Selecciones por uso | Diseño del Home → título, pestañas/orden, nombre, imágenes desktop/mobile y alt; accesos con imagen opcional, título, descripción y enlace; sin puntos sobre la imagen |
| Precios, stock y fichas | Productos, fuente de API real; no se alteran para la apariencia ni se editan desde el compositor |
| Footer: marca/contacto | Footer y legales → `footerContent`: brand, description, contactTitle, contactLines, email y whatsapp |
| Footer: grupos/redes | Footer y legales → groups/links y socials: orden, etiquetas, destinos, iconos permitidos y visibilidad |
| Suscripción | Footer y legales → newsletter: activación y todos los textos; Suscriptores → lista/CSV de registros, solo ADMIN |
| Barra legal/documentos | Footer y legales → copyright, legalLinks y `legalPages.terminos/privacidad` |
| Menús, tienda y búsquedas populares del encabezado | Pantallas existentes de menús, tiendas y búsquedas; identidad y controles funcionales del encabezado preservados |

No hay HTML, CSS o JavaScript editable. Las opciones tienen límites y enlaces
validados. El compositor muestra error sin perder borrador, pide confirmación
para restaurar/descartar, avisa al salir por enlaces o recargar/cerrar y agrupa
secciones en paneles desplegables. Los estados corresponden a la última
resolución; previsualizar los actualiza sin escribir. La preview utiliza
`POST /api/admin/home-layout/preview` y el mismo `HomeView` público.

## Archivos y propósito

| Grupo | Archivos principales |
| --- | --- |
| Contrato y resolución | `homeSchemas.js`, `homeResolver.js`, `contentLinks.js`: campos compatibles, fuentes manuales ordenadas/límites, propagación de apariencia y guest; panel previo preservado |
| API y caché | `adminContent.routes.js`, `content.routes.js`, `navSchemas.js`, `api.js`, `liveResource.js`, `useCachedResource.js`: preview, búsqueda manual acotada, footer/legal, transacción e invalidación |
| Edición y render Home | `AdminHomeLayout.jsx`, `HomeAdditionalEditor.jsx`, `ManualProductSource.jsx`, `Home.jsx`, `HomeContentSections.jsx`, `ProductCarousel.jsx`, `GuestStrip.jsx`: formularios, imágenes móviles, apariencia, preview y teclado |
| Footer y legales | `footerContent.js`, `legalDefaults.js`, `Footer.jsx`, `FooterContent.jsx`, `NewsletterForm.jsx`, `Legal.jsx`, `ManagedLegal.jsx`, `AdminFooter.jsx` |
| Newsletter | `newsletter.routes.js`, `schema.prisma`, migración `20261015000000_add_newsletter_subscribers`, `AdminNewsletter.jsx`, montaje en `index.js` |
| Navegación/avisos | `App.jsx`, `AdminLayout.jsx`, `useUnsavedContent.js` |
| Validación | `home-final.test.mjs`, `final-home.integration.test.mjs`, helpers `final-home-*`, scripts `review-final-*`/`serve-final-home.mjs`; expectativa exacta de invalidación actualizada en `tests/lote-7.test.mjs` |

Las rutas anteriores de búsqueda, carrito, guardados, compra y checkout no se
reescribieron en este cierre. Sus cambios pendientes anteriores se conservan.
Los documentos 5a/5b y sus evidencias tampoco se reemplazaron.

## Resultados ejecutados ahora

- Home/contrato: 17 pruebas unitarias/HTTP con delegados controlados aprobadas.
- Integración nueva: 1 prueba compuesta aprobada con PostgreSQL desechable y
  rutas reales. Incluye 13 tipos activos, inactivos, panel, límites, guardado y
  recarga; rechazo inválido sin cambios; preview sin escritura; footer atómico;
  401/403, newsletter 400/201/409/429, normalización/unicidad, CSV y persistencia
  tras reiniciar el listener. Prisma validate/migrate deploy/generate aislados.
- Regresión pertinente `tests/lote-7.test.mjs`: 10/10. Primero falló una
  expectativa anterior que esperaba únicamente `products`; ahora exige
  exactamente `products, home`, conforme a la invalidación ampliada de 5a.
  No se retiraron aserciones de compra, timeout, carrera, caché o recuperación.
- Navegador: preview fiel sin escritura, agregar/editar/ordenar/desactivar,
  guardar/recargar compositor; guardar/recargar footer en PostgreSQL; formulario
  válido, duplicado y error de red sin falso éxito; lista ADMIN y descarga CSV.
  La repetición dirigida de administración comprobó además buscar/agregar/
  reordenar productos manualmente y su orden persistido; cancelar una eliminación
  conserva el contenido y descartar cambios recupera la sección guardada.
- Teclado: pestañas de uso y productos con flechas/Inicio/Fin, foco itinerante,
  panel accesible, controles de carrusel y reordenamiento mediante botones.
- Build Vite aprobado con `envFile:false`. Persisten advertencias previas de
  import mixto de departamentos y tamaño del chunk del visor 3D.
- `git diff --check`: sin errores de espacio; Git avisa de conversión LF/CRLF
  en archivos que ya coexistían con distintos finales de línea.

No se repitieron suites de pagos/pedidos o una compra real: no se cambió ese
flujo. La autenticación del navegador QA es sintética; los middleware de rol
de los endpoints nuevos sí son reales y tienen cobertura 401/403.

## Evidencia visual

Edge headless con contexto nuevo, sin perfiles personales. API local real,
PostgreSQL vacío y fixtures; `/api/home` no se intercepta ni se prefabrica.
Cada captura de página compara `scrollWidth` con `clientWidth`. Se registra
`innerWidth/innerHeight`, tema efectivo y desplazamiento en los JSON.

- Home/footer: **390 × 844 y 1440 × 1000 CSS px**, claro y oscuro, segmentos
  consecutivos con solapamiento y último segmento hasta el final de la página.
- Distribución adicional: **768, 1024, 1280 y 1920 × 1000 CSS px**, ambos temas.
- Compositor/footer admin: 390 × 844 y 1440 × 1000, ambos temas, segmentos
  legibles con los formularios del compositor abiertos.
- Variantes: panel lateral, fila 50/50 invertida, carrusel de ocho/uno,
  campaña sintética, inline, soporte y texto largo, móvil/escritorio y temas.
- Contenido largo en los siete tipos de 5b: títulos extensos, cinco tiles con
  descripciones de 500 caracteres, cuatro beneficios con texto de 500,
  enlaces de soporte de 80, legal de 6000, ocho pestañas y seis accesos por
  pestaña. API/resolver reales y 56 segmentos adicionales sin overflow en
  390 × 844 / 1440 × 1000, claro y oscuro. Los banners de este fixture también
  se validan con su esquema antes de guardarlos en la base desechable.
- Corrección visual final: placeholder del correo demasiado oscuro por heredar
  el color del tema claro; se ajustó únicamente ese input y se verificó su
  color calculado en oscuro. Hay cuatro capturas completas nuevas del footer.

Galería: [evidencia-home-final/index.html](evidencia-home-final/index.html).
Informes vigentes: `resultados.json` (73 capturas), `resultados-variantes.json`
(24), `resultados-largos.json` (56), `resultados-footer.json` (4) y
`resultados-admin.json` (39 segmentos que
actualizan los mismos archivos de administración, sin sumarlos dos veces).
**157 evidencias vigentes únicas**. El footer
completo de la última comprobación prevalece para evaluar el placeholder.
Archivos de intentos anteriores no enumerados en esta galería son diagnósticos,
no evidencia aprobada. Los primeros fallos del guion fueron configuración de
Tailwind, formato JSON del tema, desplazamiento suave y selectores de prueba;
no se atribuyeron a fallos de aplicación ni se alteró el diseño para capturarlo.

La red del navegador QA solo permite loopback. No se descargaron tipografías
de Google ni recursos comerciales externos; las capturas usan las fuentes de
respaldo del CSS. No constituyen aprobación de encuadres de fotografías reales.

## Reproducción local sin producción

Desde la raíz, con Docker Desktop local y Edge instalados:

```powershell
node --test server/tests/home-layout.test.mjs server/tests/home-sections.test.mjs server/tests/home-final.test.mjs server/prisma/tests/final-home.integration.test.mjs
node --test tests/lote-7.test.mjs
node --input-type=module -e "import { build } from 'vite'; await build({ envFile:false });"
node scripts/review-final-home.mjs
node scripts/review-final-variants.mjs
node scripts/review-final-variants.mjs --long-only
```

La herramienta de navegador fue instalada, con aviso previo, exclusivamente en
`$env:TEMP\tecruta-home-final-tools`, sin tocar package.json ni package-lock.
Los scripts la buscan allí. Si ese directorio no existe, hace falta preparar
`playwright-core` en esa ubicación antes de usarlos; no instalan nada solos.

Para inspección interactiva: `node scripts/serve-final-home.mjs`. Mantener esa
terminal abierta hasta terminar la revisión. Abre Edge en un perfil temporal y
contexto nuevo, limita su red a loopback y muestra las URLs asignadas. Prefiere
el puerto 5177 para Vite; si está ocupado elige uno libre. API y PostgreSQL usan
puertos locales asignados por el sistema. No cierra procesos ajenos.

Actualización del arranque interactivo (2026-10-15): usa los routers reales de
autenticación, carrito y guardados, además de catálogo, contenido y newsletter.
La opción `realInteractiveApi` del helper conserva el modo anterior para las
pruebas automatizadas históricas. El acceso interactivo valida contraseñas con
bcrypt y sesiones/roles del proyecto; ya no acepta cualquier credencial.
En `/iniciar-sesion`, usar `qa-admin@example.test` / `qa-local-only` para admin,
o `qa-customer@example.test` / `qa-local-only` para cliente. Son cuentas
exclusivamente QA; el correo transaccional está desactivado.

Se filtran las variables heredadas a una lista de variables del sistema, se
desactiva la instalación automática de Prisma y Vite usa `envFile:false`.
Prisma valida, migra y genera su cliente con schema/migraciones copiados al
directorio temporal y URL PostgreSQL loopback QA. No se ejecuta el entrypoint
normal que carga dotenv. No se usa Neon, producción ni respaldos.

El guion comprueba `/`, `/catalogo`, `/carrito`, `/elementos-guardados`,
`/admin/home-layout` y su preview sin escritura, `/admin/footer` y
`/admin/suscriptores`, antes de dejar Home abierta y la sesión admin iniciada.
Usa navegación DOM con margen para la preparación inicial de Vite. Escribe un
informe en `$env:TEMP/tecruta-local-review.json`. El catálogo contiene ocho
productos sintéticos con SVG, precios y stock ficticios; las categorías, marca,
composición y cuentas también son de prueba. El footer identifica QA, con
contacto `contacto@example.test`, sin WhatsApp ni redes. El chequeo deja un
producto en el carrito y guardados del admin y el suscriptor ficticio
`revision-qa@example.test`. No son clientes ni contenido comercial real.

Pulsar Enter en la terminal del guion cierra su navegador, Vite y API, y elimina
exclusivamente su contenedor PostgreSQL, volúmenes y directorio temporal QA.
Los cambios se conservan durante esa ejecución (incluso al recargar páginas),
pero se descartan al detenerla; cada nuevo arranque crea una base vacía y vuelve
a cargar fixtures. El perfil/contexto de prueba tampoco se reutiliza, por lo
que carrito y guardados de invitado en localStorage se reinician. Cerrar solo
Edge no ejecuta la limpieza: finalizar mediante Enter en la terminal. Un cierre
forzado del proceso/sistema puede dejar recursos QA huérfanos, sin reutilizarlos
automáticamente. No apagar Docker Desktop ni detener otras aplicaciones.

## Pendientes reales y límites

1. El propietario debe confirmar contacto/redes anteriores y aprobar textos
   legales, beneficios y cualquier promoción real. No se comprobó su vigencia
   contactando servicios ni se inventaron sustitutos.
2. Cargar recursos comerciales finales y revisar sus encuadres/tipografía con
   esos recursos. Los SVG y el catálogo de evidencia son únicamente sintéticos.
3. Revisar y desplegar esquema/migración/cliente Prisma mediante un encargo
   autorizado. No se aplicó a una base existente ni se publicó diseño alguno.
4. El aviso de cambios cubre enlaces y recarga/cierre; no implementa un bloqueo
   de navegación Atrás del historial del navegador.
5. Un directorio QA antiguo quedó retenido por la revisión automática de
   eliminación: `C:/Users/samue/AppData/Local/Temp/tecruta-final-home-G6Xhvc`.
   No se reintentó su borrado por otra vía. No es una base de producción.

Se detuvieron únicamente navegador, servidores y contenedores creados por
estos guiones. El inventario y la base de continuidad permiten revisar o
revertir exclusivamente esta entrega; ver `cierre-home-revision.md`.
