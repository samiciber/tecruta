# Diseño visual de la tienda

Publicación autorizada por el titular: «ENTOCES PUBLICA LOS CAMBIOS».

Esta rama publicacion/tienda-estilo contiene el mismo código de src/, scripts/, package.json y vercel.json que la propuesta e5054d7, sobre la versión publicada 14ccfa2. Se separa la entrega del código de las capturas grandes para reducir la transferencia de GitHub. La rama original mejora/tienda-estilo-profesional y todas sus evidencias locales se conservan sin reescribir historial.

## Cambios

Cabecera con navegación secundaria más limpia; banner enmarcado; categorías y accesos editoriales como tarjetas; títulos, precios, fotos y botones uniformes; catálogo con búsqueda y filtros mejor presentados; ambos temas y movimiento reducido. La hoja storefront.css se carga sólo en StoreRoot. Los componentes compartidos reciben clases de presentación: se conservan los datos, acciones, enlaces y configuración de portada.

No cambia el esquema, las cuentas, el inventario, los pagos ni el backend. No requiere migraciones ni pausa del servicio. Los scripts de vista local de sólo lectura no se ejecutan en Vercel.

## Validación

Ambos builds finales y git diff --check pasaron sobre el código original idéntico. Las primeras revisiones visuales locales completaron cinco grupos funcionales; el último intento visual quedó incompleto por espera de imágenes externas. Se respeta el rechazo previo para abrir automáticamente el origen local. La publicación se comprueba en Vercel y en la tienda real mediante navegación de lectura, sin crear pedidos ni cobros de prueba.

Las capturas comparativas y el registro detallado están conservados en el worktree original docs/tienda-estilo. No se presentan como una validación visual automatizada completa de la última revisión.

## Accesos y recuperación

Tienda: https://www.tecruta.com. Panel: https://tecruta-panel.vercel.app.

Si se requiere retirar este diseño, se puede recuperar el frontend 14ccfa2 de Vercel, conservando la API vigente y sin restaurar PostgreSQL. No borrar intentos de cobro pendientes ni volver al backend anterior al Kardex. Esta entrega visual no modifica las reglas comerciales.
