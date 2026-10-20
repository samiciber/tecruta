# Lote 2: tienda completa

Trabajo local desde la rama de rediseño publicada. No se despliega, no se hace
push ni merge a main, no se leen archivos .env reales ni se usa producción.
Los datos sintéticos pertenecen exclusivamente a PostgreSQL local desechable.

## Orden de trabajo

1. Correos: outbox duradero, cinco estados, proveedor existente y bandera apagada.
2. SEO: metadatos, rastreadores y sitemap limitado con origen API fijo.
3. Rendimiento: compresión, caché pública explícita, tarjetas livianas y medición.
4. Producto: compartir, zoom accesible, información comercial y compra móvil.
5. Búsqueda: normalización sin extensiones nuevas y sugerencias remotas limitadas.
6. Móvil/textos: navegación inferior y auditoría de textos CMS/legales.
7. Calidad: herramientas mínimas, CI sin secretos y conciliación de tests históricos.
8. Opcionales: monitoreo/analítica inactivos y manifest sin service worker.
9. Cupones: solo se abordará si 1–8 están completos y verdes.

Cada fase lleva commit y pruebas pertinentes. El informe final distinguirá
comprobaciones reales, mediciones y pendientes externos. La revisión local
puede conservar todos los módulos optativos apagados.

## Decisiones iniciales

- Los estados notificables son PENDING (recibido), PAID, SHIPPED, DELIVERED y
  CANCELLED. CONFIRMED no equivale a dinero recibido y no genera correo de pago.
- Los registros de envío se insertan a partir del historial dentro de su misma
  transacción mediante un trigger aditivo. El envío ocurre después, en un worker
  separado; no se cambian las transiciones ni el POS. La migración no rellena
  pedidos históricos.
- La búsqueda reutilizará pg_trgm ya existente si hace falta un índice; no
  instalará extensiones nuevas. La columna normalizada conservará los originales.
- No se infieren políticas comerciales ni se redactan documentos legales.
- No se añadirá un preview enlazado a producción ni se ampliará CORS para probarlo.
  Un eventual preview necesita API QA aislada y no es requisito para esta entrega.

La referencia inicial de tamaño está en base.json. La referencia de pruebas es
la batería completa de la rama base: 172 pruebas, 115 correctas y 57 fallidas;
se repetirá y clasificará durante la fase de calidad.
