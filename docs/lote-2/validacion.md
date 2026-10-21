# Validación local — 20 de octubre de 2026 (Lima)

## Resultado comprobado

- 27 pruebas nuevas correctas: correos 6, SEO 7, utilidades de producto 2,
  respuestas públicas 4, búsqueda 5 y telemetría 3.
- `npm test`: 55/55. `npm test --prefix server`: 73/73.
- Batería completa: 199 pruebas, 144 correctas, 55 fallidas, ninguna omitida.
  Antes: 172/115/57. Los 55 fallos pertenecían al conjunto inicial; ver triage.
- Ambos builds correctos sin descubrir .env. Bundle principal +2,45 %, por
  debajo del presupuesto de +10 %. También se compiló en memoria con las
  banderas optativas habilitadas: sus módulos quedan en chunks diferidos.
- ESLint sin errores (cinco advertencias de directivas antiguas); Prettier
  correcto en los seis archivos de reseñas. node --check en 101 archivos.
- Prisma validate, deploy completo, índices y ausencia de deriva comprobados
  contra PostgreSQL desechable. También se ejecutó localmente el contrato del
  servicio PostgreSQL que utilizará CI. El workflow aún no se ejecutó en GitHub.
- npm audit --omit=dev: cero vulnerabilidades en raíz y server.
- git diff --check correcto. Migraciones anteriores de la base intactas.

`verificacion-final.json`, `tests-despues.json`, `bundle.json` y `lighthouse.json`
contienen los resultados. No se guardan logs crudos con rutas temporales, IDs de
contenedores, URLs internas o valores del entorno.

## Comprobación visual

24 capturas con viewport de 390×844 y 1280×900, modos claro/oscuro: portada,
catálogo, producto, carrito, checkout y cuenta. Ver [índice](capturas/README.md).
Sin desbordamiento horizontal en las 24 combinaciones (`diseno-validado.json`).
Se usó un cliente sintético con correo example.test, no una cuenta de negocio.
Las contraseñas no aparecen en capturas; los formularios de cambio están vacíos.

Se comprobó con navegador:

- Inicio y catálogo resuelven las imágenes de fixtures locales y ocho productos
  sintéticos; agotados no se pueden añadir. No existe catálogo de ejemplo ante
  una caída de la API.
- Búsqueda remota: cinco coincidencias reales del fixture, dentro del máximo
  de ocho; selección con flechas/Enter y navegación al producto. Las pruebas
  SQL cubren tildes, marca, categoría, índices y límite por IP.
- Zoom con dos imágenes: flecha avanza, Escape cierra, restablece el scroll y
  devuelve el foco al botón Ampliar. Se corrigió el autofocus inicial del
  diálogo para conservar una referencia explícita al botón de origen.
- Copiar enlace confirma su resultado; Web Share depende del navegador. No se
  compartió ningún enlace con terceros. WhatsApp solo se inspeccionó como enlace.
- Ficha técnica sintética en tabla; garantía/envío/Libro se ocultan sin datos
  comerciales. El checkout tampoco presenta una política de envío predeterminada.
- Carrito con un artículo conserva su contenido al recargar y al consultar con
  la cuenta. No se confirmó una compra desde el navegador ni se adjuntaron archivos.
- Checkout muestra formulario y resumen; no contiene barra inferior ni chat
  flotante. Las demás vistas móviles reservan espacio para navegación y compra.
- Cuenta muestra datos del cliente QA sin cambiar contraseña, perfil o sesiones.
- Privacidad y términos abren desde el pie. Vacíos: mensaje explícito de no
  publicación, noindex, sin contrato inventado. Categorías abre su directorio.

Las pruebas automatizadas usan pedidos y movimientos exclusivamente sintéticos
para comprobar concurrencia, cancelación, correo idempotente, límites y permisos.
No se ejecutó ninguna venta ni emisión fiscal real. La lógica de autenticación,
pagos, POS, permisos de personal y reseñas se conserva; solo hay los hooks mínimos
de analítica y los ajustes de texto/ARIA solicitados.

## Límites reales

La batería completa no está verde. El triage no sustituye la reparación de los
55 históricos. Los correos y la telemetría se probaron con transportes inyectados;
no se ha verificado recepción real de un proveedor. La analítica agrega eventos,
no identifica visitantes ni es un reporte contable. No hay cupones.

Las medidas de rendimiento se limitan al entorno sintético local; no certifican
tiempos de Render/Neon, CDN o dispositivos de clientes. No se ha medido una base
de producción ni una suspensión real del alojamiento. Los textos CMS/legales del
negocio no se inspeccionaron ni se modificaron. Requieren revisión del dueño.
LCP móvil repetido: 2,867 s; la meta orientativa de menos de 2,5 s sigue pendiente.

El cambio mínimo del administrador de contenido se limita a los textos y
destinos predeterminados del pie, y al permiso de guardar documentos legales
vacíos como no publicados; no afecta usuarios, roles ni formularios de personal.
