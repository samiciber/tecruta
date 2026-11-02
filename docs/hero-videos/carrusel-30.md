# Carrusel con más de diez diapositivas

Preparado localmente el 2 de noviembre de 2026 en
`fix/hero-hasta-30-diapositivas`, sobre `6e09ef1`.
Publicado el mismo día: [registro de publicación y verificaciones](publicacion-20261102.md).

Se eliminaron los recortes de tres elementos de HomeView y HeroSlider. La tienda
recorre todos los Hero activos y vigentes que devuelve la API, en su orden.
El panel y la API conservan el máximo existente de 30 banners en total, contando
Hero e intercalados. Por ejemplo, con 5 intercalados quedan 25 posiciones Hero.
No requiere migraciones ni cambios en contenidos existentes.

En **Más → Banners del Home** (`/banners`), agregar los banners, seleccionar
ubicación Hero y guardar. La ayuda del panel muestra el total y explica el límite.
Los banners inactivos, futuros o vencidos mantienen sus reglas actuales.

Hasta siete diapositivas se conservan los puntos de selección. Con más de siete
se utiliza un contador `1 / 30`, flechas visibles también en móvil, deslizamiento
y navegación de teclado existentes. La rotación mantiene las pausas, movimiento
reducido y avance al finalizar el video.

Solo se monta el contenido de la diapositiva actual y sus dos vecinas; las demás
mantienen su espacio en la pista sin cargar sus imágenes o videos. Los videos
vecinos continúan sin `src`; solo reproduce el activo. Esto limita la carga de
medios, no reduce por sí mismo las consultas de la API a PostgreSQL.

Validación local:

- `npm test`: 61/61 pruebas correctas, incluida la lógica de video.
- `node scripts/verify-hero-slides.mjs`: seis escenarios de marcado del componente,
  con 0, 1, 3, 12 y 30 imágenes y 30 videos. Todas las diapositivas se conservan,
  hay un máximo de tres imágenes montadas y solo el video activo tiene `src`.
  Este guion no consulta producción ni reproduce videos en navegador.
- `npm run build:qa`: builds de tienda y panel correctos, sin cargar `.env`.
- ESLint sin errores; cinco advertencias anteriores de comentarios sin efecto.
- `git diff --check` limpio y sintaxis del guion correcta.

Pendiente: revisión visual en navegador en escritorio/móvil y reproducción real
con más de diez slides. No se presentan las comprobaciones de marcado como una
prueba de interacción o reproducción. No se modificaron datos de producción.

Procedimiento de publicación: actualizar tienda y panel con sus configuraciones existentes;
la API actual ya admite los 30 banners, sin despliegue backend obligatorio.
Conservar el código y los datos anteriores para reversión. Volver al frontend
anterior volvería a mostrar solo los tres primeros, sin borrar los demás banners.
