# Lote 5: dependencias y configuración de seguridad

## Resumen

- H13 resuelto en la rama: servidor de 6 paquetes afectados (3 críticos, 3 moderados) a 0, según `npm audit` del 12/10/2026.
- H14 parcialmente resuelto: frontend de 18 a 5; `npm audit --omit=dev` queda en 0. Restan avisos de herramientas de Tailwind 3.
- H31 resuelto: producción falla antes de escuchar si faltan variables requeridas, contienen los marcadores del ejemplo o las URLs no son válidas.
- H32 parcialmente resuelto: proxy limitado, Helmet, CSP API/SPA y eliminación de X-Powered-By. Los enlaces quedan pendientes del Cambio 5 de Claude.
- Sin despliegue, consultas ni escrituras contra producción. PR independiente desde `main`; los lotes anteriores aún no están integrados.

## Archivos

| Ruta | Cambio |
|---|---|
| `package.json`, `package-lock.json` | Router 7, Vite 6 y herramientas compatibles; versión mínima de Node y override acotado del parser CSS. |
| `server/package.json`, `server/package-lock.json` | Express 4 actualizado, Helmet y versiones corregidas de proxy-addr, ip-address y qs. |
| `server/src/lib/runtimeConfig.js` | Validación de JWT_SECRET, DATABASE_URL PostgreSQL y CORS_ORIGIN único en producción; errores sin valores. |
| `server/src/middleware/securityHeaders.js` | Helmet y CSP de API sin ejecución de documentos; CORP permite el consumo desde la SPA separada. |
| `server/src/index.js` | Factory para pruebas, proxy 0–5/default 1, configuración y cabeceras antes de las rutas. |
| `vercel.json` | Cabeceras de la SPA, conservando el rewrite para rutas profundas. |
| `server/.env.example` | Marcadores evidentes, integraciones opcionales y TRUST_PROXY. |
| `server/tests/lote-5.test.mjs` | Ocho pruebas de arranque, URLs, cabeceras, CORS y cadena de proxy. |
| `server/prisma/tests/lote-5.test.mjs` | Cuatro pruebas de rutas reales en PostgreSQL desechable, sin proveedores externos. |
| `README.md` | Versiones actuales y enlace a esta guía. |
| `docs/lotes/lote-5-integracion-con-lote-3.patch` | Resolución preparada para el único archivo que se solapa con el PR de pedidos. |
| `docs/lotes/lote-5.md` | Resultados, configuración, pendientes y reversión. |

## Versiones y avisos

Versiones resueltas en los lockfiles (no se actualiza Prisma 5 ni React 18):

| Grupo | Antes → después |
|---|---|
| API | Express 4.22.2 → 4.22.3; proxy-addr 2.0.7 → 2.0.8; ip-address 10.7.0 → 10.7.4; qs 6.15.3 → 6.16.0; Helmet 8.3.0 nuevo. |
| Herramientas frontend | Vite 5.4.21 → 6.4.4; plugin React 4.7.0; PostCSS 8.5.26 → 8.5.30; Autoprefixer 10.5.4 → 10.6.1; Tailwind 3.4.19. |
| Router en el navegador | React Router DOM 6.30.4 → 7.18.4 (compatible con React 18). |
| Transitivas frontend | esbuild 0.25.12, source-map-js 1.2.2 y postcss-selector-parser 7.1.6. |

Vite 6 es la rama mayor más próxima con correcciones publicadas para los avisos detectados; Router 6 no ofrece una versión corregida para los avisos actuales y se migra a 7. Se verificaron build, dev y rutas del bundle publicado localmente. Los overrides fijan versiones corregidas; el parser de selectores pasa de 6 a 7 y su compatibilidad se comprobó compilando Tailwind 3 y cargando la web. No se usa `audit fix --force`.

**Pendiente H14:** cinco paquetes señalados por un mismo aviso de `braces` (recursión/patrones profundamente anidados): braces, chokidar, micromatch, fast-glob y tailwindcss. La última versión publicada de braces sigue siendo 3.0.3, afectada. La alternativa que propone audit es Tailwind 4, con migración de estilos y herramientas; no se fuerza dentro de esta actualización compatible mientras otro proceso modifica Home. No se ocultan avisos: el audit completo termina con código 1 y cinco altos. Esta cadena solo se usa en desarrollo/compilación; no se envía en el bundle ni se ejecuta en la API. Evitar compilar patrones/configuración no confiables; preparar Tailwind 4 como trabajo separado con comparación visual.

Los avisos corregidos de Vite/esbuild y herramientas CSS también afectan desarrollo/compilación. React Router sí viaja al navegador: se corrigieron tanto la redirección mediante barras invertidas como el aviso de hidratación SSR (esta aplicación usa SPA, sin SSR). Los avisos del servidor pertenecían a dependencias de ejecución. Cero avisos conocidos no demuestra ausencia de otras vulnerabilidades.

## Configuración y CSP

1. Usar Node LTS vigente, compatible con `^20.19.0 || >=22.0.0` (pruebas realizadas en Node 24.19). En raíz y `server/`, instalar con `npm ci`.
2. En el gestor de secretos del servidor, configurar `NODE_ENV=production`, JWT_SECRET largo/aleatorio, DATABASE_URL real y CORS_ORIGIN igual al origen del frontend, sin barra final. No imprimirlos ni copiarlos a Git. El ejemplo contiene únicamente marcadores; no es una configuración operativa.
3. TRUST_PROXY=1 asume un único salto por Render. Usar 0 si se accede directamente. Se admiten enteros 0–5 y se rechaza `true`; confirmar la topología antes de usar otro número. El conteo de saltos requiere que toda entrada tenga esa longitud y que no se pueda eludir el proxy.
4. `VITE_API_URL` debe configurarse en Vercel antes del build, apuntando a la API pública. La CSP de `vercel.json` permite `https://tecruta.onrender.com`; actualizar su `connect-src` si cambia el dominio. Integraciones de correo, Cloudinary y Google son opcionales al arrancar: requieren sus propias variables para usarse.
5. API: `default-src 'none'`, sin objetos, formularios ni marcos; respuestas JSON, `nosniff`, DENY y sin X-Powered-By. HSTS solo en producción, un año, sin includeSubDomains/preload. CORS mantiene un origen concreto y bearer headers, sin habilitar cookies.
6. SPA: scripts y bundles del propio origen, sin inline JS ni eval de JavaScript; `wasm-unsafe-eval` permite decodificación 3D. Estilos inline siguen permitidos por los atributos de React/Three y se permiten Google Fonts. Imágenes HTTPS/data/blob para medios editables; workers propios/blob. Conexiones limitadas al propio origen, Render, Cloudinary, gstatic (Draco) y raw.githack.com (entornos de drei). HTTPS se exige a recursos del documento desplegado.
7. La política SPA está en Vercel; Helmet protege las respuestas de Express y no puede establecer cabeceras del HTML servido por Vercel. La CSP de producción no se aplica al servidor Vite con HMR. Si el admin añade modelos de otros hosts HTTPS, hay que revisar `connect-src` antes de habilitarlos.

**H32 enlaces pendiente:** la autorización reserva `server/src/lib/navSchemas.js` hasta terminar el Cambio 5 de Claude. `main` permanece en 8470fc1 y no hay evidencia de que esa coordinación haya terminado. No se toca ningún archivo reservado. El rechazo de `//` y `/\` sigue pendiente; Router actualizado no sustituye la validación de enlaces editables.

## Cómo probar

1. Instalar con `npm ci` en raíz y servidor. Desde raíz ejecutar `npm run build`; desde servidor `npm audit --omit=dev` (esperado 0). En raíz, `npm audit --omit=dev` (0) y `npm audit` (cinco avisos altos de desarrollo).
2. Desde raíz ejecutar `node --test server/tests/lote-5.test.mjs`: 8/8. Incluye un proceso real que falla al arrancar en producción sin variables, además de HTTP y preflight PATCH con Authorization. Usa configuración sintética y `DOTENV_CONFIG_PATH=/dev/null`.
3. Integrar primero la migración del Lote 2; generar Prisma sobre una configuración local de prueba y ejecutar `node --test server/prisma/tests/lote-5.test.mjs`: 4/4. Requiere Docker local. Alternativamente `TECRUTA_QA_MIGRATIONS_DIR` puede señalar una copia sin modificaciones de las cinco migraciones de main más la de navegación del Lote 2. Crea su propio contenedor con puerto loopback aleatorio, aplica allí las migraciones y lo elimina con sus volúmenes. No usa una DATABASE_URL proporcionada por el usuario.
4. Rutas verificadas contra esa base: catálogo, filtros, detalle 200/404, categorías, marcas, nav, búsquedas, tiendas, ajustes, métodos de pago, login/me, colecciones privadas, dashboard ADMIN y denegaciones 401/403. Nueve intentos fallidos de login desde una IP sintética llegan a 429 y otra IP sigue recibiendo 401.
5. Servir `dist/` con las cabeceras exactas de `vercel.json` y fallback a index.html. Probar catálogo, producto, marca, categoría, carrito con un artículo, checkout e iniciar sesión; admin sin sesión debe volver a Inicio en main. Verificar navegación mediante Link, volver atrás, filtros query y recarga directa. Probar 390, 768, 1024, 1280, 1440 y 1920 px en claro y oscuro: 96 cargas sin errores JS ni bloqueos CSP inesperados.
6. Usar respuestas locales/simuladas para toda API y medios. Se verificaron además dashboard/productos con ADMIN simulado, Vite dev y bundle 3D con GLB/HDR diminutos. Una inyección inline de prueba debe ser bloqueada por la CSP. No confirmar checkout ni iniciar proveedores reales.

**Evidencia de esta ejecución:** `/workspace/audit-tecruta/lote-5/`: audit before/after/runtime, build.log, security.log, integration.log, browser-matrix.log, browser.log/browser.json y combined-orders.log. Los desbordamientos ya existentes de main no se atribuyen a este lote; las correcciones visuales están en el PR del Lote 1. Esta matriz valida carga/tema/rutas/CSP, no certifica nuevamente contraste ni scroll de esas correcciones.

## Integración con el Lote 3

Los PR previos están abiertos, sin integrar. Hay un conflicto anticipado en `server/src/index.js` porque ambos lotes convierten el arranque en factory. La resolución preparada añade a la versión del Lote 3 los imports de `validateRuntimeEnv` y `apiSecurityHeaders`, la validación al entrar en `createApp`, `app.disable('x-powered-by')` y Helmet después del proxy. **Conservar `defaultJson` del Lote 3 y sus parsers por ruta: no restaurar el parser global de 20 MB al combinarlos.**

El parche `lote-5-integracion-con-lote-3.patch` aplica exactamente sobre el index del PR del Lote 3. Es un diff sin contexto (`git apply --unidiff-zero`), una guía revisable de resolución, no una migración ni un script de despliegue. En una rama de integración, resolver el archivo con esos cambios y ejecutar las pruebas de ambos lotes antes de integrar. La combinación se probó fuera del checkout en una copia temporal: 10/10 pruebas de pedidos y 8/8 de seguridad sobre dependencias actualizadas, todo en PostgreSQL desechable.

## Riesgos y reversión

Los saltos de Vite/Router elevan el requisito de Node y requieren reinstalar desde lockfiles. La CSP puede bloquear dominios de medios futuros no incluidos o cambios de integraciones; revisar primero en un preview de Vercel. TRUST_PROXY debe coincidir con la infraestructura. Un deploy con variables faltantes o marcadores fallará deliberadamente antes de aceptar tráfico.

No hay migración nueva ni modificación de datos en este lote. Antes de despliegue, revisar los PR y la resolución anterior. Para revertir, hacer un commit de reversión del PR y reinstalar los dos lockfiles; volver a desplegar API/SPA anteriores. Si solo un recurso nuevo necesita permiso, ajustar la directiva concreta y probarla; no desactivar toda la CSP.

## Límites

No se desplegó ni se verificaron cabeceras realmente aplicadas por Vercel/Render. No se usaron Google, correo, Cloudinary o modelos comerciales reales; el GLB/HDR de QA es un fixture sin compresión y no prueba todos los decodificadores. No se crearon registros ni pedidos en producción. La comprobación de paquetes ocurre en Linux; los avisos específicos de Windows se corrigieron por versión, sin ejecutar Windows. Pendientes: Tailwind 4, validación de enlaces coordinada con Claude y revisión de la topología real del proxy.

Lote 5 listo. Escribe continuar para el Lote 6.
