# Fase 6: navegación y contenido

La tienda incorpora una barra móvil con Inicio, Categorías, Carrito (contador)
y Cuenta. Se oculta en checkout y panel. Respeta el área segura del teléfono;
la compra fija de producto queda encima y el chat se desplaza para no taparla.
Entre 640 y 767 px solo se reserva el espacio de navegación.

`/categorias` consulta las categorías reales. El catálogo deja de sustituir una
API fallida por productos estáticos de ejemplo. Una caída muestra su estado de
error; no aparenta existencias ni precios confirmados.

Los textos de respaldo usan Ofertas, Catálogo, Marcas y Ayuda. Se elimina el
banner de fútbol predeterminado. Los nombres internos de claves CMS se conservan
para compatibilidad; no se ejecuta ningún seed ni se cambia contenido guardado.
Las etiquetas de calificación distinguen 1 estrella y varias estrellas.

## Revisión pendiente del dueño

No se ha consultado el CMS de producción ni se puede afirmar que contenga estos
textos. Revisar desde el panel navegación, banners y enlaces: «Acuerdos»,
referencias a fútbol americano u otoño, membresías, tarjetas, outlets y frases
como «A favor además». Cambiar por textos correspondientes a promociones reales
o desactivar la opción. La configuración guardada tiene prioridad sobre el código.

Revisar Datos comerciales: razón social, RUC, dirección, garantía, envíos y URL
del Libro de Reclamaciones. Solo se muestran campos configurados. Ayuda consume
esa información y los métodos de pago existentes, sin inventar plazos.

Revisar `/legal/terminos` y `/legal/privacidad`, enlazados en el pie. El código
anterior incluía documentos de respaldo; ahora el respaldo es vacío y la página
indica que aún no está publicada. Si está vacía lleva noindex también para
rastreadores. Un texto de ejemplo que ya esté guardado debe retirarse desde el
panel y reemplazarse por un documento aprobado por el dueño. No se ha redactado
ningún contrato ni se ha modificado la base de producción.

La comprobación visual local, de teclado, tamaños y temas se recoge en el informe
de validación. El contenido QA no representa políticas comerciales reales.

La revisión retiró también contactos, horarios y redes del respaldo estático
del pie (los configurados se conservan), enlaces de igualación de precio que
apuntaban a Próximamente y distintivos sin sustento de «pago verificado» o «envío
asegurado» en checkout. Este último muestra solo benefits de Datos comerciales.
El carrito utiliza el único chat global; se elimina su burbuja duplicada para
que no cubra la navegación móvil. No cambia ningún cálculo ni validación de pago.

Se retiró del resumen del checkout el bloque independiente con condiciones de
entrega escritas en storeConfig. El componente compartido FreeShippingBar ya
presenta exclusivamente shippingText de Datos comerciales y se oculta si falta.
