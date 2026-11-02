# Filtros contextuales de TecRuta

Preparado localmente el 2 de noviembre de 2026 en
`feature/filtros-contextuales-catalogo`, sobre `e741579`. No publicado.

## Funcionamiento

- `/catalogo`: al marcar una marca aparecen sus categorías y subcategorías con
  cantidades. Se ocultan opciones ajenas a la selección, conservando las
  seleccionadas aunque tengan cero coincidencias para permitir desmarcarlas.
- `/marca/:slug`: muestra directamente las categorías de esa marca, sin repetir
  un selector de marca que solo tendría una opción. Seleccionar categoría conserva
  la ruta de la marca y añade el parámetro `categoria`.
- `/categoria/:slug`: ofrece las subcategorías de esa rama y marcas compatibles.
  El enlace de categoría sigue siendo el ámbito fijo; «Todas las categorías»
  elimina la selección adicional, sin salir de esa página.
- Grupos plegables, lista de marcas/atributos con «Ver más / Ver menos», contador
  por opción y etiquetas removibles encima de los productos. Las categorías tienen
  desplazamiento propio para que una jerarquía larga no ocupe toda la página.
- Precio conserva mínimo y máximo; disponibilidad conserva «Solo disponibles».
  Se mantienen ordenación y paginación existentes, con reinicio de página al filtrar.
- En escritorio el lateral tiene altura acotada y desplazamiento. En móvil se
  reutiliza el diálogo existente con el botón para ver resultados. Clases para ambos
  temas, controles etiquetados y teclado nativo en `details/summary`.
- Estado en URL: `categoria`, `marcas`, `min`, `max`, `stock` y parámetros repetidos
  `f_ram`, `f_capacidad`, `f_pantalla`, `f_procesador`, `f_potencia`, `f_conexion`.
  Repetir parámetros conserva valores con comas, como `15,6 pulgadas`.

## Características reales

Se extraen únicamente de `specifications`, usando etiquetas reconocidas: RAM,
capacidad/almacenamiento, pantalla, procesador, potencia y conexión. No se infieren
datos de nombres, descripciones o imágenes. Valores largos, HTML y etiquetas de
modelo/código no se convierten en filtros. Una dimensión aparece cuando existe una
categoría seleccionada o el ámbito tiene una sola categoría, y hay al menos dos
opciones distintas o una opción seleccionada. Los productos sin atributo no
coinciden al filtrar por él; no se les asigna un valor ficticio.

Dentro de una marca o característica se aplica OR; entre dimensiones se aplica
AND. Los conteos excluyen el propio filtro de la dimensión para que sea posible
añadir otra opción. Cambiar/quitar la categoría limpia características específicas.

## Datos, API y límites de rendimiento

Sin migraciones ni nuevas dependencias. El DTO de tarjetas incorpora
`filterAttributes` con valores cortos; no expone `specifications` ni descripción.
Para `GET /api/products?view=cards` se hace una consulta adicional parametrizada,
limitada a los IDs del resultado, que proyecta en PostgreSQL solo etiquetas
admitidas y valores de hasta 60 caracteres. No descarga las fichas técnicas
completas de Neon para construir filtros y evita una consulta por producto.

Las casillas no generan peticiones HTTP adicionales ni llamadas por pulsación:
se filtra el índice compartido ya existente. Esta etapa conserva la carga global
de ese índice y su paginación en cliente; **no resuelve la paginación SQL general
ni promete reducir la transferencia total de Neon**. Se añade trabajo SQL y un
pequeño campo por producto para permitir características. El precio y el stock
de compra siguen sujetos a las validaciones existentes del servidor.

## Validación y revisión

- `npm test`: 65/65 pruebas, incluidas cuatro nuevas de conteos, árbol, marca,
  atributos, selección sin resultados, precio, stock y persistencia en parámetros.
- `node --test server/prisma/tests/public-performance.test.mjs`: 4/4 con PostgreSQL
  local desechable; atributos reales en tarjetas, ausencia de ficha completa,
  conservación de precio/stock, ETag y compresión existentes.
- `node scripts/verify-catalog-filters.mjs`: marcado de componentes con datos
  sintéticos, categorías pertinentes, grupos, precio y etiquetas removibles.
- Ambos builds correctos; sintaxis correcta; lint sin errores (cinco advertencias
  anteriores); `git diff --check` limpio.
- Navegador: no disponible en esta sesión. No se declara comprobada visualmente
  la interacción, el diseño móvil ni los temas, y no hay capturas nuevas.

Revisión local reproducible, con Docker Desktop iniciado:

```powershell
node scripts/preview-catalog-filters.mjs
```

- Marca QA: http://127.0.0.1:5223/marca/qa-ugreen
- Catálogo QA: http://127.0.0.1:5223/catalogo
- Categoría QA: http://127.0.0.1:5223/categoria/qa-accesorios

Solo productos sintéticos en PostgreSQL desechable, sin correos ni proveedores
reales. Revisar marca → cargadores → potencia, quitar chips, recargar URL,
precio/disponibilidad y grupos plegables en 390/834/1280 px y ambos temas.
Ctrl+C cierra servicios y limpia únicamente los recursos de ese entorno QA.

## Publicación y recuperación

Pendiente de publicación. Desplegar primero la API y después la tienda. El panel
no necesita cambios. Con API anterior funcionan marca/categoría/precio, pero no
se ofrecen características porque falta `filterAttributes`. Una reversión de
código conserva todos los datos; no restaurar bases ni borrar especificaciones.
Los filtros son de consulta, sin modificar productos, pedidos, usuarios o stock.

## Referencias de diseño consultadas

Se revisaron la navegación por familias y el filtro de [UGREEN UK](https://uk.ugreen.com/collections/charger)
y los grupos por marca, categoría y especificaciones de [Best Buy](https://www.bestbuy.com/site/searchpage.jsp?browsedCategory=pcmcat138500050001&id=pcat17071&st=categoryid%24pcmcat138500050001).
La implementación usa los componentes, los colores y el catálogo de TecRuta;
no copia el diseño ni introduce características inexistentes.
