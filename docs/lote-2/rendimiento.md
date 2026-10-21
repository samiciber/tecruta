# Rendimiento medido localmente

20 de octubre de 2026 (Lima). Referencia: rama base de rediseño; después:
este lote en la revisión 5596ecf. Lighthouse 12.8.2 con Edge headless, builds Vite **production**,
datos e imágenes sintéticos y PostgreSQL local desechable. Sin producción ni
servicios privados. Las medidas de desarrollo se descartaron del informe.

`scripts/performance-preview.mjs` reutiliza la fábrica QA existente y compila
en su directorio temporal, sin editar el checkout base ni descubrir .env.
Modo base: `node scripts/performance-preview.mjs base ../checkout-base` (sustituir
la ruta por un checkout de la referencia). Modo nuevo: `node
scripts/performance-preview.mjs current`. Los puertos de medición son 5301 y
5303. Solo se permiten GET/HEAD. Cerrar ambos procesos con Ctrl+C.

El lanzador fuerza NODE_ENV=production y comprueba que el entrypoint cumple el
presupuesto: 288349 bytes en la referencia y 295376 en el comparador nuevo. La
compilación normal de esa revisión medía 295418; la diferencia corresponde a su
configuración de orígenes frente a los de loopback del comparador. La corrección
final retiró el bloque de envío estático del checkout y sus imports; los builds
y el presupuesto se repitieron después. La tabla conserva las medidas anteriores
a esa corrección visual. No se midió React de desarrollo.

Se ejecutó Lighthouse sobre la portada con performance y accessibility. Móvil:
390×844, simulación de CPU 4×, RTT 150 ms y throughput 1638,4 Kbps. Escritorio:
1280×900, CPU 1×, RTT 40 ms y throughput 10240 Kbps. Opciones: --form-factor=mobile
y screenEmulation para móvil, --preset=desktop para escritorio; salida JSON.
Los parámetros completos están en `lighthouse.json`.

«Frío» significa primer navegador del perfil de esa variante; «caliente», segunda
ejecución solicitando conservar perfil/storage con --disable-storage-reset.
La API ya está levantada: **no es un arranque frío de Render/Neon**. No se puede
asumir un hit de CDN ni que cada recurso se haya servido desde caché de navegador.
Una muestra por combinación no establece una garantía de tiempo ni un percentil.

## Resultados

| Versión | Vista | Ejecución | Rendimiento | Accesibilidad | LCP ms | CLS | TBT ms | Bytes transferidos |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Antes | Móvil | Primera | 78 | 97 | 2711 | 0.1647 | 24 | 158566 |
| Antes | Móvil | Repetida | 76 | 97 | 2874 | 0.1647 | 79 | 158566 |
| Antes | Escritorio | Primera | 71 | 97 | 1560 | 0.3415 | 0 | 256933 |
| Antes | Escritorio | Repetida | 97 | 97 | 706 | 0.101 | 0 | 256933 |
| Después | Móvil | Primera | 94 | 100 | 2699 | 0.0379 | 18 | 248036 |
| Después | Móvil | Repetida | 93 | 100 | 2867 | 0.0379 | 19 | 247323 |
| Después | Escritorio | Primera | 96 | 100 | 665 | 0.1131 | 0 | 248611 |
| Después | Escritorio | Repetida | 99 | 100 | 771 | 0.0259 | 0 | 248611 |

El presupuesto final de JavaScript principal se cumple: 288349 → 295046 bytes
(+2,32 %; límite +10 %), gzip 91433 → 93703. Con optativos activados en una
compilación solo en memoria, el principal mide 295365 y ambos módulos quedan
diferidos. Apagados no aparecen sus chunks en el manifest. Ver `bundle.json`.

El cambio reduce el desplazamiento del pie mientras carga el inicio y corrige
el rol accesible de las estrellas. Lighthouse pasa de 97 a 100 en accesibilidad
de la portada. No equivale a certificar toda la web con un lector de pantalla.

**No se alcanzó la meta orientativa de LCP móvil inferior a 2,5 s**: la muestra
repetida nueva es 2,867 s. No se oculta ese pendiente ni se garantiza el resultado
en móviles reales. El LCP repetido de escritorio fluctúa de 0,706 a 0,771 s.

La transferencia móvil tampoco es una comparación uniforme: la muestra base
no contabilizó descargas de fuentes, mientras la nueva sí descargó tres archivos
de fuentes. Por ello aumenta el total móvil en esa ejecución; no se afirma una
reducción global de tráfico. Los fixtures SVG tampoco representan el peso del
catálogo real. Repetir con carga de fuentes controlada y, después de autorización,
con un preview aislado representativo de imágenes/CDN y dispositivos reales.

La reducción del DTO sí se comprobó por separado en PostgreSQL: una tarjeta de
producto con descripción extensa transmite menos de un cuarto del JSON completo,
sin perder precio, stock o SKU. Se comprobó gzip, ETag/304 y cambio de ETag tras
un movimiento real sintético. Las lecturas privadas nunca tienen caché compartida.

## Arranque en frío y siguiente revisión

Render puede suspender servicios Free inactivos; Neon permite que su compute
escale a cero según configuración. Esto añade latencia distinta de la del
navegador. Ver documentación oficial de [Render](https://render.com/docs/free)
y [Neon](https://neon.com/docs/manage/endpoints/). No se inspeccionó el plan del
negocio ni se cambió alojamiento. Un plan/configuración sin suspensión requiere
decisión del dueño. Un monitor puede consultar /api/health según las condiciones
del proveedor; por sí solo no confirma disponibilidad de la base ni garantiza
evitar suspensiones. No se ha activado ningún ping.

Antes de una aprobación integral: reparar el triage histórico, verificar fuentes
y LCP móvil con varias ejecuciones representativas, revisar el arranque real del
alojamiento en la ventana autorizada y conservar las banderas optativas apagadas
hasta validar cada proveedor. No se publicará para realizar estas mediciones.
