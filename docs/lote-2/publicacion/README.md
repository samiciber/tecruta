# Publicación del lote 2

Autorización del dueño: «esta bien publicalo», reiterada al pedir continuar.
Se recuperó Git HTTPS con configuración de transporte por comando, sin cambiar
la configuración global ni obtener nuevas credenciales. Se subió la rama
feature/lote-2-tienda-completa. Main se conserva.

## Resultado

Revisión funcional 8632f75 publicada en API Render y ambos proyectos Vercel.
La tienda y el panel terminaron Ready/Production con configuración de producción,
no mediante la simple asignación del build preview. Dominios conservados:

- https://www.tecruta.com
- https://tecruta-panel.vercel.app

Neon no permitía otra instantánea manual en el plan actual. Se creó en su lugar
una rama aislada con datos y esquema desde producción, sin vencimiento automático.
No se contrató un plan, no se cambió la conexión del negocio y no se restauró
sobre producción. Una consulta de lectura en la copia confirmó 149 productos,
7 pedidos, 14 migraciones terminadas y ninguna fallida. La copia sigue dentro
del proyecto privado existente; no se descargaron datos ni credenciales.

Render aplicó exclusivamente 20261021000000_order_email_outbox y
20261021010000_store_search, con resultado correcto, y generó Prisma Client.
Después se restauró el build habitual npm ci && npx prisma generate.
Auto-deploy de Render permanece desactivado. No se bloqueó la API por anticipado.

Lectura final de producción: 149 productos, 7 pedidos, 16 migraciones terminadas,
ninguna fallida, cero productos sin searchText y cero registros de correo.
Las cantidades coinciden con la copia en estas comprobaciones; no se crearon
ventas, usuarios, reseñas ni datos QA para verificar producción.

## Comprobaciones

Ver [resultados HTTP](verificacion.json), [tienda](tienda.jpg) y
[login del panel](panel-login.jpg). Health devuelve la revisión publicada;
catálogo y sitemap responden 200; ETag devuelve 304; API de personal sin sesión
devuelve 401. Panel conserva noindex y caché privada. CORS autoriza tienda y panel
y no autoriza example.com. Un producto existente devuelve Open Graph y JSON-LD
con User-Agent de WhatsApp. No se confirmó una compra real ni se inició sesión
con credenciales del dueño durante la verificación.

## Límites y recuperación

No se activaron correos, monitoreo, analítica ni cupones; no se añadieron variables
de proveedores o jobs. Sigue pendiente la recepción real de los proveedores.
Persisten los 55 fallos históricos y la meta móvil descritos en validacion.md;
publicar no convierte esa batería en verde. La portada estática conserva sus
metadatos iniciales para bots; su rewrite no sustituye index.html en Vercel.
Las vistas específicas de producto sí se comprobaron con etiquetas del servidor.
Los textos CMS existentes se conservaron, incluidos los que el dueño debe revisar.

Para revertir funcionalmente, volver a los despliegues anteriores de tienda,
panel y API identificados en el historial de cada proveedor. Mantener las dos
migraciones aditivas y todos los pedidos, movimientos y registros de correo.
No restaurar una copia antigua encima de ventas posteriores. La rama de respaldo
permite consultar el estado previo; no se ha ensayado una restauración completa
de este respaldo del negocio. Ver ../publicacion-recuperacion.md.
