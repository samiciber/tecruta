# Ficha de producto

Conserva la galería y la vista 3D. La foto puede ampliarse en un diálogo nativo
modal: foco contenido, cierre con Escape, retorno al botón de origen, flechas
anterior/siguiente y bloqueo del scroll de fondo. El módulo se carga al abrirlo.

Compartir utiliza Web Share si está disponible, copiar enlace con mensaje de
estado y enlace de WhatsApp como alternativa. El enlace contiene solo origen y
slug del producto, sin query, sesión, comprobante ni datos del cliente.

Migas de pan y BreadcrumbList se construyen de producto y categoría existentes.
La ficha técnica es una tabla con encabezados de fila; se oculta si no hay
atributos. Envío y garantía usan exclusivamente Datos comerciales. Se mantienen
las validaciones de stock, productos relacionados y botones deshabilitados.

La barra de compra móvil permanece alcanzable y reserva espacio sobre la futura
navegación inferior. La foto principal se carga sin diferir pero no solicita
prioridad alta; esa prioridad corresponde solo al banner principal de portada.

Revisión local: node scripts/preview-lote-2.mjs (Docker Desktop). Puertos de QA
separados; credenciales efímeras solo en /revision-local. No enviar ni publicar
esas credenciales, bases o capturas de la página de acceso QA.

Comprobado con navegador local: abrir diálogo de imagen, foco inicial en Cerrar,
Escape cierra, devuelve foco al botón Ampliar y restablece el scroll; Copiar enlace
confirma éxito; canonical y Open Graph muestran el producto QA correcto.
Dos pruebas de utilidades verifican enlaces sin tokens y migas sin categoría
inventada. Ambos builds y diff --check correctos. Se comprobará el móvil junto
con la navegación inferior para validar sus espacios combinados.
