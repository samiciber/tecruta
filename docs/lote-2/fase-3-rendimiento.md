# Rendimiento y caché

Se usa compression 1.8.2 únicamente en la API. Son cuatro paquetes adicionales
en el árbol instalado, sin vulnerabilidades de producción al instalar. Evita
mantener un compresor HTTP propio (streaming, negociación y cabeceras).
No se añade código al bundle del navegador. Revisión de API según la
[documentación oficial de compression](https://expressjs.com/en/resources/middleware/compression/).

Compresión solo para lecturas públicas anónimas, a partir de 1024 bytes.
Las respuestas privadas no se comprimen para evitar mezclar secretos y contenido
controlado por el usuario. Autorización o cookie desactivan caché compartida.

La lista explícita de rutas públicas permite GET/HEAD, status 200, ETag débil,
max-age=0, s-maxage=30 y stale-while-revalidate=60. Todo lo demás queda private,
no-store: pedidos, cuentas, carrito, elegibilidad, panel, POS y errores. La
política final de JSON prevalece sobre los antiguos cacheShort de las rutas.
No se añade caché en memoria ni se cambia la validación de stock/precio al comprar.

## Respuesta ligera

GET /api/products?view=cards selecciona solo datos de tarjetas y una imagen.
Sin ese parámetro conserva el DTO completo para compatibilidad. El índice del
cliente usa cards, mantiene images para el validador existente y distingue el
resumen con summary=true. El detalle pide la ficha completa y respeta 404/errores,
sin reemplazar un fallo por datos antiguos. El frontend revalida catálogo y
portada con no-cache; los recursos privados conservan no-store.

## Arranque en frío

Render y Neon pueden suspender recursos inactivos; una carga fría no representa
el rendimiento con caché caliente. Documentar resultados fríos y calientes por
separado. Opciones futuras del dueño: plan sin suspensión o un monitor externo
de /api/health acorde con las condiciones del proveedor. No se cambian planes,
alojamiento ni se configura un ping en esta entrega. Health comprueba proceso;
la comprobación operativa del catálogo cubre también el acceso a la base.

Las mediciones antes/después están en [rendimiento.md](rendimiento.md), y las
capturas en [capturas/README.md](capturas/README.md). No son mediciones de producción.

La utilidad Cloudinary también se aplica a miniaturas de carrito/checkout,
productos recomendados, referencias de categoría y logos. Las imágenes tienen
dimensiones y carga diferida; no se transforman comprobantes ni QR de pago.
La prioridad alta se limita al primer slide principal de la portada.

Comprobado: cuatro pruebas PostgreSQL correctas para 304 y cambio de ETag tras
un ingreso real al Kardex sintético, exclusión de todas las rutas privadas,
gzip de extremo a extremo, reducción de JSON cards y detalle completo/404/error.
