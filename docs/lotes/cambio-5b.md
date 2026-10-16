# Cambio 5b — Secciones editoriales y contenido inferior administrable

Implementado sobre `revision/cambio-5a`, HEAD base `fc849fb`, conservando los
cambios pendientes de 5a y sus correcciones del panel lateral y contraste.
No se cambió de rama, no se descartó trabajo ni se hicieron commits.

## Alcance y contrato

Se amplió `homeLayoutSchema`, el mismo `resolveHome`, el compositor existente
y `Home`. Se conserva `site_settings.homeLayout`; no hay migraciones ni un
segundo formato de diseño. `homeDefaults` permanece intacto: los tipos nuevos
solo se incorporan al diseño cuando el administrador los agrega y guarda.

| Tipo | Configuración | Publicación |
| --- | --- | --- |
| `splitRow` | Banner existente por ID; panel de categorías por slug o fuente de productos de 5a; proporción 50/50 o 60/40; orden invertible; límite 1–20. | Solo banners vigentes y categorías visibles no legacy/productos resueltos. Si falta un lado, el otro ocupa todo el ancho; si faltan ambos se oculta. La proporción 60/40 reserva 60 al banner incluso al invertirlo. |
| `editorialTiles` | Cuatro o cinco tiles ordenables: imagen, título, descripción opcional y enlace. | Deben estar completos los cuatro/cinco tiles elegidos. Los borradores incompletos se guardan pero no se publican. Dos columnas en móvil, cuatro/cinco en escritorio; imagen con proporción uniforme y tarjetas que llenan su fila. |
| `brands` | Título y límite 1–24. | Consulta marcas visibles, destacadas primero, luego posición/nombre; logo cuando existe y nombre como alternativa, incluso ante error de carga del logo. Enlace `/marca/:slug`. |
| `benefits` | Hasta cuatro elementos ordenables con icono permitido, título y texto. | Omite elementos sin título/texto y oculta la sección si no queda ninguno. Texto plano; React escapa el contenido. No se agregan condiciones comerciales por defecto. |
| `supportLinks` | Título opcional; sin copia de los enlaces. | Lee y valida `site_settings.cartFooterLinks` y mantiene sus cinco destinos/textos y el orden de iconos del carrito. Sin configuración válida, se oculta y el admin indica dónde editarla. |
| `legalText` | Título opcional y texto plano de hasta 6000 caracteres. | Oculto si está vacío; tipografía legible, saltos de línea y ajuste de palabras. Sin HTML ejecutable. |
| `useSelections` | Hasta ocho pestañas ordenables: nombre, imagen, texto alternativo y hasta seis accesos relacionados ordenables. | Solo pestañas con nombre, imagen y al menos un acceso con título/enlace. La imagen no tiene puntos interactivos. Pestañas con flechas, Inicio/Fin y foco itinerante; panel identificado y accesible con Tab. |

Los iconos de beneficios permitidos son `info`, `package`, `headphones`,
`mapPin`, `heart`, `monitor`, `helpCircle`, `fileText`. No se aceptan nombres
arbitrarios ni iconos proporcionados como HTML.

Los nuevos formularios permiten guardar contenido incompleto como borrador;
los estados del resolver explican la ocultación después de guardar/recargar.
Las filas parciales también muestran su motivo aunque sigan visibles.

## Reutilización y fuentes

- `homeSectionsResolver.js` resuelve exclusivamente los tipos adicionales,
  llamado desde `resolveHome` después del control común de activación.
- Filas editoriales usan `HeroSlide` y productos usan `ProductCarousel` con
  una variante embebida; se conserva el comportamiento normal de 5a.
- Las consultas de productos reutilizan los filtros, serializador y límites
  del resolver de 5a. No se descarga un catálogo adicional para construir 5b.
- El admin recibe un listado de banners existentes además de categorías y
  marcas; editar sus recursos sigue correspondiendo a sus pantallas actuales.
- La caché sigue siendo `home`/`useHome`. Se conserva la invalidación de
  productos, categorías, marcas, banners y layout; se añadió
  `cartFooterLinks` a la invalidación de Home y ajustes compartidos.

## Referencia visual

Se revisaron las cuatro referencias `fila-1-columna-1.png` a
`fila-4-columna-1.png` de Best Buy en la carpeta PineTools indicada por el
propietario. Se adaptaron rejillas de cuatro/cinco elementos, filas divididas,
accesos por uso y secciones inferiores, con tipografía, colores, radios y
componentes de TecRuta. No se copiaron imágenes, marcas, textos ni promociones
de Best Buy. El fixture usa SVG locales propios y nombres sintéticos.

## Validación ejecutada en esta entrega

- `node --test server/tests/home-layout.test.mjs server/tests/home-sections.test.mjs`:
  **13/13 aprobadas**. Incluye regresiones 5a, siete tipos 5b, límites, iconos y
  enlaces rechazados, IDs repetidos, filas parciales, consulta visible/orden de
  marcas, soporte compartido, vacíos/inactivos e invalidación de fuentes.
- Prueba HTTP con los routers reales y delegates Prisma sustituidos en memoria:
  guardar y recuperar layout ADMIN, contrato público, rechazo de layout inválido
  sin sobrescribir el guardado y un diseño antiguo que no recibe secciones nuevas.
- `node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false });"`:
  **aprobado**, sin lectura de archivos `.env` por Vite. Permanecen los avisos
  de chunks grandes y de importación estática/dinámica de departamentos.
- `git diff --check`: aprobado. Los avisos LF/CRLF de archivos preexistentes
  no son errores de whitespace.
- Navegador Edge con `server/tests/home-5b-visual.mjs`: API local que usa los
  routers reales de Home/admin y el resolver real, sin `/api/home` prefabricado.
  Productos, categorías, marcas, sesiones e imágenes son sintéticos/en memoria.
  No se usó una base de datos; no se instalaron dependencias ni migraciones.
- Home y compositor en **1440 × 1000** y **390 × 844 CSS px**, claro y oscuro.
  Se midieron `innerWidth`/`innerHeight`: `scrollWidth === clientWidth` en las
  cuatro combinaciones. Las filas se apilan, no reservan una columna vacía
  cuando falta el banner, y los tiles y textos conservan su contenido.
- Teclado: flechas cambian pestaña, Inicio/Fin seleccionan extremos y Tab
  alcanza el panel con foco visible; Tab desde el selector del compositor llega
  al botón Agregar sección. Formularios usan etiquetas y controles nativos.
- Compositor: se editaron campos de tiles, marcas, pestañas, iconos, soporte y
  legal; se probaron proporciones; se agregaron los siete tipos. Guardó y
  recargó **20 secciones**. Se verificaron valores persistidos y explicaciones
  de borradores vacíos/inactivos. El Home recibió los nuevos textos guardados.
- Capturas de viewport legibles con solapamiento. Una captura de una transición
  del menú y otra que no mostraba el bloque pretendido se sustituyeron o
  descartaron. No se presentan como evidencia de una página completa.

Véase [evidencia visual y registros](evidencia-5b/README.md).

## Archivos propios de esta entrega

Backend: `homeSchemas.js`, `homeResolver.js`, nuevo `homeSectionsResolver.js`
y listado de fuentes en `adminContent.routes.js`.

Frontend: nuevo `HomeContentSections.jsx`, nuevo `HomeAdditionalEditor.jsx`,
ampliaciones de `Home.jsx`, `AdminHomeLayout.jsx`, `ProductCarousel.jsx` e
invalidación en `liveResource.js`.

Validación: `home-layout.test.mjs` (expectativa del listado aditivo de banners),
nuevo `home-sections.test.mjs`, fixture manual `home-5b-visual.mjs`, esta guía
y `evidencia-5b/`. Los demás cambios pendientes son anteriores y se conservaron.

## Reproducir localmente

```powershell
node --test server/tests/home-layout.test.mjs server/tests/home-sections.test.mjs
node --input-type=module -e "import { build } from 'vite'; await build({ envFile: false });"
node server/tests/home-5b-visual.mjs
```

El fixture usa `127.0.0.1:5176` y `127.0.0.1:4406`; ambos deben estar libres.
La sesión ADMIN del fixture acepta datos sintéticos en el formulario local;
no usar credenciales reales. Se conserva el layout solo en la memoria del
proceso para probar guardado/recarga HTTP. Al reiniciarlo vuelve a su fixture.
Los servicios de esta revisión se detuvieron al terminar.

## Pendientes y fuera de alcance

- Cargar y revisar contenido comercial e imágenes definitivas en un entorno
  autorizado. No se evaluaron datos ni proveedores de producción.
- No se repitió integración PostgreSQL ni se verificó persistencia de 5b tras
  reiniciar una base real. No hay cambio de esquema; se usa el almacenamiento
  JSON de 5a, cuya integración PostgreSQL fue reportada anteriormente.
- No es una auditoría de todos los navegadores, todos los largos de texto
  permitidos o Core Web Vitals. La matriz cubre los dos viewports indicados.
- **5c no iniciado:** footer nuevo y newsletter no implementados. El footer
  anterior se conserva. Sin staging, commit, push, merge o publicación.
