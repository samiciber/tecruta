# SEO y vistas al compartir

Metadatos únicos por ruta y entidad, canonical sin parámetros de búsqueda y
noindex para cuenta, carrito, checkout, autenticación y demás rutas privadas.
El panel conserva su robots y noindex propios.

La función api/share entrega HTML mínimo a rastreadores de producto, categoría,
marca, portada, catálogo, ayuda y legales. Usa la misma API y utilidades del
cliente. No tiene acceso a cuentas ni bases de datos. Las URLs de imagen pasan
por imageUrl. No se añaden orígenes a CSP ni se habilita código externo.

La selección por User-Agent utiliza los [rewrites con condiciones de Vercel](https://vercel.com/docs/project-configuration/vercel-json).
El HTML alternativo no se almacena en caché compartida para evitar mezclarlo
con la SPA. No sustituye la información comercial mostrada al cliente.

## Configuración pública

- PUBLIC_API_ORIGIN: origen HTTPS público de la API, sin claves ni rutas. Usa
  por defecto el origen público ya usado por la tienda.
- SEO_STORE_ORIGIN: origen canónico de la tienda; por defecto el dominio actual.
- VITE_STORE_ORIGIN: valor público existente que utiliza el cliente.

No son secretos ni requieren activación externa. Las funciones niegan otros
hosts, incluido el panel; un preview de SEO necesita origen QA explícito. Las
URLs de entrada nunca eligen el servidor upstream (protección contra SSRF).

El sitemap dinámico incluye portada, categorías visibles, marcas visibles y
productos públicos. Hasta 5000 URLs, 2 MiB de XML y 3 MiB por respuesta API.
Superar el límite devuelve 503: dividir el sitemap antes de ampliar catálogo.
Timeout de ocho segundos y sin redirecciones upstream. Caché compartida 60 s,
stale-while-revalidate 120 s y ETag; sin cuentas ni parámetros privados.

## Datos estructurados

Product incluye nombre, imagen disponible, marca/SKU reales, precio PEN y stock.
No declara estado nuevo/usado, envío ni garantía por suposición. AggregateRating
solo se agrega con contadores reales válidos; el texto Review viene únicamente
del endpoint público moderado. Ambos nodos Product comparten @id para evitar
describir dos productos distintos. Organization requiere razón social configurada.
Se sigue la [documentación de datos estructurados de producto de Google](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
Esto prepara metadatos; no garantiza que un buscador muestre resultados enriquecidos.

## Revisión y publicación futura

Las funciones se prueban con fetch inyectado y respuestas sintéticas, sin red
de producción. Validar en un preview aislado con un User-Agent de WhatsApp,
Facebook y Googlebot antes de publicar esta fase. Comprobar canonical, OG, precio,
ausencia de estrellas inventadas, 404 y noindex privados. No hubo despliegue.

Comprobado localmente: seis pruebas de SEO y cinco utilidades vigentes correctas,
build tienda y build panel correctos sin leer .env, y git diff --check. Incluye
escape XSS, traversal, host ajeno/panel, caché, ETag, límite de sitemap y ausencia
de imagen/cifras inventadas.
