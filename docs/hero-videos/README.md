# Videos en el carrusel principal

> Publicado el 2 de noviembre: [carrusel de hasta 30 banners](carrusel-30.md), que elimina
> el recorte de tres descrito en la entrega original de abajo.
> [Despliegues y verificaciones](publicacion-20261102.md).

> Publicación autorizada el 30 de octubre: [estado y continuación](publicacion-20261030.md).
> La rama ya se subió a GitHub; el contenido siguiente describe la preparación original.

Implementación local en feature/hero-videos, sobre fix/produccion-panel-una-hora
(9fef525), conservando lote 2 y el ajuste de sesión posterior. No se publicó,
no se hizo push y no se cambió el contenido del negocio.

## Uso desde el panel

En Más > Banners del Home (/banners), editar o agregar una diapositiva y elegir
Contenido del banner > Video. Subir MP4 o WebM o pegar una URL HTTPS directa del
archivo. YouTube, páginas web e iframes no sirven como URL de video. Las rutas
relativas del propio sitio también se admiten para medios alojados allí.

La carga usa Cloudinary existente, ahora con resource_type video y carpeta
separada. Hasta 20 MB por archivo; diez cargas cada diez minutos por IP y solo
ADMIN, comprobado en la API antes de procesar el cuerpo. Se valida MIME, firma
básica del contenedor y tamaño; Cloudinary y el navegador completan la validación
del archivo/códec. Un contenedor válido no garantiza códec compatible. Se
recomienda MP4 H.264, HD o Full HD. No se generan conversiones de resolución ni
se aumenta artificialmente la calidad del original. No se subieron archivos al
proveedor real durante QA; falta verificar esa carga en el entorno autorizado.

Video móvil opcional; si falta, utiliza el de escritorio. Las imágenes sirven
como portada y se conservan al alternar tipo de contenido. El video usa contain:
se muestra completo, sin estirar ni cortar; habrá franjas cuando su proporción
sea distinta de la caja del carrusel. El texto, botones y oscurecimiento siguen
siendo configurables. Para mostrar solo el video, dejar textos y botones vacíos
y oscurecimiento en cero.

Solo se admite video en Hero, no en banners intercalados. Se conserva el límite
actual de tres diapositivas del carrusel. Las imágenes mantienen el temporizador.
En videos se espera ended para avanzar, aunque el intervalo de imagen sea menor
que la duración del clip. No se repite el video en bucle. Una única diapositiva
permanece al terminar. Los videos inactivos no tienen src y no se reproducen.

Sin sonido y playsInline para móvil. El botón de pausa detiene video y rotación;
al ocultar la pestaña se pausa. Mouse encima o foco de teclado suspenden el
avance de diapositiva, conservando las protecciones anteriores. Si termina
durante esa pausa, avanza al salir. Con movimiento reducido o rotación apagada
se ofrece reproducción manual y no se avanza automáticamente. Si el navegador
bloquea autoplay aparece Reproducir video. Un error o espera de 20 segundos
muestra aviso; con rotación activa salta al siguiente tras el intervalo.

## Persistencia y compatibilidad

mediaType, videoDesktop y videoMobile se guardan en el JSON homeBanners de
site_settings. Sin migración ni cambios a productos, pedidos, permisos o datos
de contacto. Los banners previos se interpretan como imágenes. La API conserva
los nuevos campos al normalizar y resolver Home y panel. CSP permite medios
HTTPS, del propio sitio y blob, sin ampliar script-src ni connect-src.

## Verificación

- npm test: 59/59 unitarias, incluidas cuatro nuevas de video: compatibilidad,
  URLs inseguras, contenido de carga y decisión de avance/pausa/fallo.
- PostgreSQL local desechable: dos pruebas nuevas correctas; rechazo anónimo,
  cliente, almacén y cajero; carga ADMIN con proveedor inyectado; persistencia
  y lectura pública de ambas URLs.
- npm test --prefix server: batería vigente completa 75/75, incluidas esas dos
  y las regresiones de inventario, POS, pedidos, reseñas, personal y búsqueda.
- Ambos builds mediante build:qa (sin descubrir archivos .env), ESLint sin
  errores, comprobación de sintaxis y git diff --check.
- La herramienta de navegador detuvo el acceso porque no pudo determinar la
  URL de Windows con confianza. No se realizaron comprobaciones visuales ni
  se afirma haber probado reproducción real, ended, resolución, móvil o autoplay
  en el navegador. Sigue pendiente esa revisión antes de publicar. No hay capturas
  nuevas que se puedan presentar como comprobación visual.

El runtime QA encontró un Prisma instalado globalmente en el directorio temporal
que impedía generar el cliente. Se aisló su resolución mediante una unión a las
dependencias fijadas de server dentro del sandbox, sin leer .env del repositorio.

## Revisión local reproducible

Requiere Docker Desktop local, Node y FFmpeg instalado para el clip sintético:

    npm ci --ignore-scripts
    npm ci --prefix server --ignore-scripts
    node scripts/qa-generate-client.mjs
    node scripts/preview-hero-video.mjs

Tienda http://127.0.0.1:5213 y panel http://127.0.0.1:5214/banners.
/revision-local muestra el acceso QA efímero. El script crea un MP4 sintético
1080p de ocho segundos, fuera del repositorio, y dos slides en una base Docker
local desechable. Ctrl+C cierra servicios y limpia únicamente estos recursos QA.

Revisar primero autoplay sin mouse sobre el carrusel, fin de video, siguiente
imagen y regreso manual; pausa/reanudación, teclado y pestaña oculta; ambos temas
y 390/1280 px; video horizontal y vertical; archivo roto; autoplay bloqueado;
movimiento reducido. Guardar desde el panel, recargar y comprobar persistencia.
No confirmar pedidos ni cargar videos comerciales durante QA.

## Publicación futura

Publicar primero API con los campos y carga nuevos, luego tienda y panel del
mismo commit, conservando orígenes y credenciales existentes. No aplicar
migraciones ni modificar banners ya guardados de forma automática. Comprobar
Cloudinary y códecs con un archivo autorizado antes de activar un banner real.
No se necesita cambiar dominio, alojamiento ni cuenta de Cloudinary.

Para volver atrás: convertir los banners de video a imagen desde el panel nuevo
antes de retirar esta versión; conservar sus URLs y portadas. Una API anterior
normaliza como imagen y podría descartar campos de video al guardar. No borrar
ventas, movimientos ni contenido para revertir este cambio.
