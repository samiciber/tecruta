# Más: herramientas sin volver atrás

Implementación local en la rama mejora/mas-menu-lateral, sobre las mejoras de usabilidad anteriores. Pendiente de publicación. No requiere migraciones, DNS ni cambios del backend.

## Cómo usarlo

1. Pulsa **Más** en la barra principal desde cualquier pantalla del administrador. Se abre un menú lateral sobre la pantalla; abrirlo no cambia la ruta ni descarta lo escrito.
2. Busca una herramienta o elígela en Administración, Catálogo, Diseño de la tienda o Configuración. La búsqueda acepta texto sin acentos y se recuerda para esta cuenta en este navegador.
3. La herramienta actual queda resaltada. Vuelve a pulsar Más para cambiar a otra, sin retroceder.
4. En escritorio de al menos 1280 px, marca **Mantener abierto en escritorio** para dejar las herramientas a la derecha mientras trabajas. La preferencia se conserva al recargar y entre las áreas de administración y POS.
5. En tablet y móvil funciona como diálogo y se cierra al elegir una herramienta. Ciérralo con la X, Escape o tocando fuera. El teclado permanece dentro mientras está abierto; al cerrarlo, el foco regresa al botón Más.
6. **Ver página completa de Más** conserva la vista anterior con tarjetas. El botón **Volver a Más** continúa disponible y conserva la búsqueda de origen.

La fijación se desactiva al cerrar el panel en escritorio. Al reducir la ventana se oculta la barra fijada; se puede abrir Más para usar el menú móvil. El tamaño mínimo evita comprimir formularios en tablet.

## Alcance

Se reutilizan las mismas 20 herramientas y los mismos permisos. Cajero y almacén mantienen su navegación autorizada y no reciben el menú administrativo. La búsqueda es local sobre los títulos y descripciones; no hace consultas de negocio por cada pulsación. Las preferencias opcionales de interfaz están separadas por cuenta; no contienen contraseñas ni datos de venta.

Se conserva el control de salida existente del POS y su recuperación de carrito. Cambiar de herramienta conserva las reglas de guardado y confirmación de cada formulario: abrir Más no equivale a guardar un editor.

## Validación

Pruebas sintéticas con PostgreSQL local desechable mediante scripts/verify-panel-workspace-ui.mjs. Evidencias y capturas en evidencia/. Comprobar ambos builds (tienda y panel) y git diff --check.

Cobertura: abrir sin navegar, búsqueda sin acentos y sin resultados, herramienta actual, fijación entre áreas y recarga, foco y Escape, tablet/móvil, temas claro/oscuro, las 20 rutas anteriores, ventas por escaneo, recuperación del carrito, pedidos y permisos por perfil.

## Publicación y recuperación

Publicar sólo tras revisar esta etapa y las mejoras locales anteriores. No se ha publicado ni se ha cambiado producción. Para retirar únicamente esta etapa, volver al frontend 38560eb conserva la simplificación anterior. Mantener la API vigente; no restaurar bases de datos ni borrar intentos de cobro por un cambio de navegación.

Capturas: [escritorio oscuro con barra fija](evidencia/mas-fijado-escritorio-dark.png), [menú en tablet claro](evidencia/mas-lateral-tablet-light.png), [móvil](evidencia/mas-lateral-movil.png). El buscador y cerrar permanecen visibles mientras se recorre la lista.

Resultado: 10 grupos de comprobaciones de interfaz completados, con cero errores JavaScript. [Registro de pruebas](evidencia/resultados.json). Incluye prueba de ciclo Tab dentro del diálogo y regreso del foco al cerrar.
