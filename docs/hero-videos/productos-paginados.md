# Lista de productos del panel

Antes de publicar la rama de videos, se añadió el ajuste solicitado a /productos:
mostrar como máximo 25 productos por página, con navegación manual. Se conserva
la tabla de edición; no se desplaza sola como un carrusel promocional.

- Anterior, Siguiente y selector de página, arriba y debajo de la lista.
- Indicación de rango y total: con 262 productos, primera página 1–25 y última
  251–262, en 11 páginas. Sin resultados, muestra cero y oculta la paginación.
- La búsqueda sigue filtrando todos los productos cargados antes de paginar y
  vuelve a la primera página. No queda limitada a los 25 visibles.
- Si se elimina el último elemento de una página, el índice se ajusta a una
  página válida. Al crear un producto se vuelve a la primera página.
- Cambiar página con cambios rápidos pendientes o un editor abierto muestra
  un aviso antes de desmontar esas filas. Cancelarlo conserva la página y la
  edición. Después del cambio, el foco vuelve al resumen de la lista.

El cambio solo pagina la presentación: se conserva la consulta existente del
catálogo completo en memoria y las rutas de creación/edición. No introduce
paginación SQL ni una migración, no elimina productos y no cambia la tienda
pública. El tamaño es fijo en 25, dentro de los 20–30 solicitados.

Validación: ambos builds con envFile=false, ESLint sin errores y diff --check.
No se declara revisión visual: la herramienta de navegador quedó bloqueada en
esta entrega. Antes de publicar, comprobar con catálogo QA de más de 25 filas:
siguiente/anterior, salto a última, búsqueda de un producto de otra página,
cero resultados y aviso de edición pendiente, en escritorio y tablet.

Permanece local en feature/hero-videos junto al carrusel de video. No se ha
publicado ni se han modificado productos del negocio.
