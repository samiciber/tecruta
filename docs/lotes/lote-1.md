# Lote 1 — UX, foco, contraste y mensajes

## Resumen

Corrige H19, H22, H23, H28, H29 (combinaciones detectadas), H33 (resumen del checkout) y H34. H18 queda corregido **solo en el manejo de errores del detalle**; el respaldo de catálogo/IDs y su política de compra siguen pendientes de otro lote.
Carrito, marca y categoría se mantienen dentro del ancho disponible; detalle inexistente tiene salida al catálogo y el fallo de respaldo permite reintentar.
Modal reutiliza el hook de los paneles; zod 4 muestra tipos/cantidades en español; el ahorro ya incluido no se vuelve a restar ni se promete envío gratis en checkout.
No hay migraciones nuevas, cambios de datos, .env, dependencias, lockfiles ni archivos reservados para los Cambios 4/5 de Home.
Validación: 7 tests de Node, build Vite y 60 casos de ancho/tema; todos pasaron.

## Archivos

| Ruta | Qué cambió |
|---|---|
| src/pages/Cart.jsx | Grid minmax(0,1fr) y columnas min-w-0 |
| src/components/cart/CartParts.jsx | Scroll acotado a los carruseles y filas de artículos que se adaptan en móvil |
| src/components/catalog/ProductBrowser.jsx | Controles con wrap y grid/columna que pueden contraerse |
| src/components/ui/Modal.jsx | Foco inicial, trap y restauración por hook compartido; conserva el scroll previo |
| src/hooks/usePanel.js | Excluye tabindex=-1 en todos los tipos de control; el backdrop no participa en el ciclo Tab |
| src/pages/ProductDetail.jsx | Estado por slug, 404 explícito, error con reintento y guard frente a respuestas tardías |
| src/services/productDetail.js | Resolver probado para API/404/respaldo/fallo del import |
| src/components/cart/FreeShippingBar.jsx | Mensaje único de envío por coordinar; elimina umbral/progreso gratuito |
| src/pages/Checkout.jsx | Ahorro informativo positivo, total igual al subtotal real y un único mensaje de coordinación |
| src/index.css | Texto semántico verde/rojo según tema |
| tailwind.config.js | Fondos sólidos verde/rojo con contraste suficiente para texto blanco |
| server/src/lib/schemas.js | Opciones error de zod 4, errores de entero/positivo y locale español de respaldo |
| tests/lote-1.test.js | Siete pruebas pequeñas con node:test, sin nueva infraestructura |
| docs/lotes/lote-1.md | Resultado, instrucciones, riesgos y reversión |

## Cómo probar

### Comandos

Desde la raíz del repo con dependencias instaladas:

```bash
node --test tests/lote-1.test.js
npm run build
```

No hay nuevos scripts ni dependencias. Reiniciar Vite al cambiar tailwind.config.js para evitar CSS de configuración anterior. No editar .env: se puede lanzar el frontend con `VITE_API_URL=<URL de API de pruebas> npm run dev`.

### Comprobaciones de navegador

Utilizar la API de desarrollo/staging o respuestas interceptadas; sin confirmar compras ni hacer escrituras en producción.

1. Abrir una sesión de invitado, sin token. En 390, 768, 1024, 1280, 1440 y 1920 px repetir en claro y oscuro:
   - /carrito vacío, con un artículo y con ocho guardados.
   - /marca/ugreen y /categoria/telefonos-moviles con productos.
   - Comprobar en consola `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. El carrusel sí puede tener scrollWidth mayor que su propio clientWidth: su scroll debe permanecer local.
   - Revisar filas de producto, controles de cantidad/precio y que el resumen permanezca dentro de la pantalla.
2. A 390 px abrir “Filtros”: foco inicial en Cerrar; Tab desde el último control vuelve al primero; Shift+Tab desde el primero vuelve al último. Esc, Cerrar y backdrop devuelven foco a Filtros y restauran el overflow previo del body.
3. Abrir los siete paneles del header y cerrarlos con Esc para verificar que el hook compartido conserva su funcionamiento.
4. /producto/un-slug-inexistente: ver “Producto no encontrado” y “Ver catálogo”, sin spinner permanente. Un 404 real no carga un producto antiguo del respaldo.
5. Bloquear/simular fallo de detalle de una categoría nueva sin archivo estático: aparece error con Reintentar. Restablecer la API y reintentar: aparece el producto.
6. Retrasar una respuesta de detalle A, navegar a detalle B antes de completarse y liberar A: el título/datos de B permanecen. La prueba local utilizó navegación SPA y respuestas retenidas/liberadas en orden inverso, incluyendo el doble efecto de desarrollo.
7. Checkout con artículo con descuento: Subtotal y Total coinciden con la suma de precios vigentes; “Ahorro incluido en los precios” muestra importe positivo informativo. Una sola explicación de envío por coordinar; no hay “envío gratis desbloqueado”. No pulsar “Comprar por WhatsApp”.
8. Verde/rojo sobre superficies paper y card, con y sin fondo tintado al 15%, texto blanco sobre fondos sólidos y hover brightness(1.1): contrastes >=4.5:1 en ambos temas. Revisar visualmente el cambio tonal y los estados de error/stock/descuento.
9. En Node, verificar cantidades string/fraccionarias: siguen rechazadas con mensajes en español. No se conectan a BD.

### Resultados medidos

Matriz Chromium: 6 anchos × 2 temas × 5 estados/rutas = **60 casos**, todos con scrollWidth <= clientWidth. Incluye carrito vacío, con artículos y con guardados; marca y categoría. Fuentes reales Sora/Inter/JetBrains Mono obtenidas con HTTPS verificado. Ninguna excepción JS no capturada.

API interceptada con nueve respuestas públicas capturadas por GET, 148 productos reales; no se llamó a API de producción desde el navegador de pruebas. Imágenes reemplazadas por superficies de tamaño estable para aislar layout: no es una revisión de fotografías ni del banner H24. El detalle de categoría usa el árbol público y tiles vacíos en la prueba: no se certifica el contenido de tiles.

Pruebas funcionales: foco/Tab/Shift+Tab/Esc/Cerrar/backdrop, paneles del header, 404, import fallido, reintento, respuesta tardía y regla de resumen/envío: aprobadas.
Contraste: 28 combinaciones de superficies/variantes, mínimo **4.62:1**, incluido fondo tintado en paper y hover del botón verde. Fondos sólidos: #07723A verde y #B53131 rojo; texto semántico se aclara en modo oscuro.
node:test: **7 ejecutados, 7 aprobados, 0 omitidos**.
Build Vite: exit 0; persisten avisos previos de ubigeo con import mixto y chunk opcional 3D >500 KB. No hay migraciones ni escrituras de producción.

Capturas y resultados completos se entregaron fuera del repositorio en /workspace/audit-tecruta/lote-1 (matrix.json, checks.json y capturas de carrito). No se añadieron snapshots de datos ni herramientas de navegador al paquete de aplicación.

## Decisiones por defecto, riesgos y alcance

- Se conserva el total igual al subtotal real. El ahorro es informativo; no se alteró lógica de pedidos ni mensaje WhatsApp en este lote.
- Se consulta el detalle en API aunque el índice no contenga aún el slug. El fallback solo se intenta en fallos distintos de 404 y si hay entrada conocida; su import fallido queda atrapado.
- Los colores globales afectan a componentes que usan tokens, incluidos elementos de Home, **sin modificar sus archivos**. Se conservan las familias de verde/rojo; revisar visualmente tono y cualquier composición sobre fotografías no incluida en las mediciones.
- El locale español cambia mensajes por defecto de zod en servidor; las restricciones y códigos HTTP no cambian. Las opciones explícitas continúan prevaleciendo.
- FreeShippingBar conserva el nombre por compatibilidad de imports, aunque ahora comunica coordinación sin barra de umbral. storeConfig.freeShipping no se elimina aquí; no se usa para prometer envío gratis en este componente.
- **GuestStrip de Home todavía contiene un texto de envío gratis.** No se tocó porque src/components/home/* está reservado al otro proceso. Coordinar ese copy con Claude; H33 queda resuelto en el resumen/checkout, no se afirma que toda la Home esté ya unificada.
- H24 (imagen 404) lo corrige el propietario desde el admin. El resto de H18 (IDs estáticos/política de compra), H01/H12 y los lotes posteriores permanecen pendientes.

## Revertir

No requiere reversión de BD. Si se integra el PR, crear una rama fix/revert-lote-1 desde main actualizado y revertir el commit squash o los tres commits de este lote en orden inverso; abrir otro PR. No revertir cambios ajenos ni reescribir historial. Si hay un merge commit, revisar git revert -m 1 del SHA de ese merge en la rama de reversión.

## No probado

Despliegue de producción, sesiones privadas, checkout confirmado, pedidos, stock concurrente, recibos y proveedores; quedan fuera de alcance.
No se certifican Safari/Firefox, lector de pantalla, todos los colores/elementos sobre imágenes ni contenidos editoriales de Home. El navegador local validó lógica de UI con API interceptada, no una integración backend completa; la BD de navegación todavía requiere resolver H12.
No se crearon registros de producción ni se usaron cuentas/variables de pruebas autenticadas.

Lote 1 listo. Escribe continuar para el Lote 2.

