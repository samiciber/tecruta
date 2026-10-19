# Panel más sencillo de usar

**Publicado el 19 de octubre de 2026.** [Registro de publicación y pendientes](../interfaz/publicacion-20261019.md). Las notas de preparación local de este documento describen el estado anterior al despliegue.

Esta etapa continúa la navegación y los atajos de docs/interfaz y docs/operacion-rapida. Sólo cambia la presentación: sin migraciones, nuevas dependencias ni cambios de permisos, precios o movimientos. Pendiente de publicación.

## Uso diario

- **Inicio**: resumen y accesos a tareas existentes.
- **Vender** (/pos): productos, carrito y cobro. El administrador encuentra el descuento en **Descuento autorizado (opcional)**. Si ya hay un importe, también se muestra al plegarlo; no se pierde por cerrar la sección.
- **Pedidos** (/pedidos): estado legible y siguiente paso para cobrar, despachar o entregar. **Ver detalle** tiene texto y una superficie cómoda para tablet. Los cambios excepcionales de estado se encuentran en **Ver detalle → Más opciones del pedido**, con las mismas restricciones.
- **Inventario** (/inventario): instrucciones según el perfil; primero identifica un producto, luego cantidad y motivo, guarda el borrador y confirma después de revisar. Guardar queda deshabilitado sin producto. Referencia, fecha, proveedor y costo se encuentran en **Datos adicionales (opcional)**. **Administrar códigos del producto** permite agregar códigos. Productos, etiquetas, borradores y Kardex siguen accesibles.
- **Caja** (/pos/caja): indicación de abrir turno o volver a vender. Conteo y cierre siguen visibles; ingresos/retiros autorizados están en **Más opciones de caja: ingreso o retiro**. Historial disponible al final. La conciliación de personal suspendido queda al final dentro de **Gestión excepcional**, accesible sólo al administrador.
- **Más** (/mas): conserva herramientas y el regreso a la búsqueda de Más.

Las secciones plegables funcionan con teclado (Tab y Enter/Espacio). Plegar no envía formularios ni elimina valores. Cada perfil conserva sus permisos y la API sigue comprobándolos.

## Revisión local

Ejecutar npm run preview:local y abrir http://127.0.0.1:5180/revision-local para consultar las instrucciones del entorno sintético. No usar usuarios o datos de pruebas en producción.

Pruebas de navegación, controles plegados, conservación de valores, permisos, cobros e inventario en PostgreSQL Docker desechable; evidencias en evidencia/, regresion-pos/ y regresion-inventario/. Capturas de escritorio y tablet en temas claro y oscuro. Ambos builds deben pasar, junto con git diff --check.

## Publicación y recuperación

Revisar esta rama junto a las mejoras locales anteriores: se basa en mejora/venta-recuperable-y-atajos. Publicar los builds de tienda y panel mediante el procedimiento vigente, conservando configuración de API/orígenes. Esta etapa no requiere migrar datos ni cambiar el backend o DNS. Aún no se ha publicado.

Si se necesita retirar únicamente esta simplificación, volver al frontend c46eb09 mantiene las mejoras anteriores de recuperación de venta. Conservar siempre la API vigente y revisar cualquier operación pendiente antes de cambiar versiones; no borrar almacenamiento de intentos de cobro ni restaurar bases de datos para revertir una presentación.

## Evidencia de validación

- Navegación y usabilidad: [resultados](evidencia/resultados.json), 9 grupos de comprobaciones.
- Operaciones POS: [resultados](regresion-pos/resultados.json), 15 grupos.
- Inventario: [resultados](regresion-inventario/resultados.json), 11 grupos.
- Personal y conciliación administrativa: [resultados](regresion-personal/resultados.json), 6 grupos.
- [Inventario en tablet, tema oscuro](evidencia/inventario-simple-tablet-dark.png).
- [Caja en escritorio, tema claro](evidencia/caja-simple-escritorio-light.png).
- [Pedidos en tablet, tema claro](evidencia/pedido-simple-tablet-light.png).

La primera ejecución simultánea de los tres navegadores agotó el tiempo de carga local; la repetición secuencial pasó. No se consultó ni modificó producción.
