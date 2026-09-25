// Testimonios/reseñas de clientes mostrados en la Home.
//
// Contenido estático a propósito (mismo patrón que heroSlides.js) — no
// viene de un modelo nuevo en la base de datos. Si más adelante se quiere
// que sean reseñas reales y administrables, el lugar natural sería un
// modelo `Review` en server/prisma/schema.prisma + un endpoint de solo
// lectura, siguiendo el mismo patrón API-primero/estático-de-respaldo que
// ya usa el resto del sitio (ver useCategories.js, usePaymentMethods.js).
//
// Cada testimonio referencia un producto REAL del catálogo por su `id`
// (el mismo id que usan los archivos de src/data/products/*.js) — el
// componente que consume este archivo (Testimonials.jsx) resuelve el
// nombre, slug e imagen actuales de ese producto contra useProductIndex,
// igual que Home.jsx ya hace con PROMO_PRODUCT_ID para el PromoBanner.
// Así, si el producto cambia de imagen o precio, el testimonio nunca
// queda desactualizado ni enlaza a un producto inexistente.
//
// Campos:
// - id:          identificador único del testimonio (string, libre).
// - name:        nombre del cliente (como se muestra públicamente).
// - rating:      1 a 5 estrellas.
// - comment:     el comentario del cliente.
// - productId:   id de un producto real de src/data/products/*.js.

export const testimonials = [
  {
    id: 't1',
    name: 'Rodrigo M.',
    rating: 5,
    comment:
      'El power bank carga mi laptop y mi celular al mismo tiempo sin problema. Llegó bien empacado y antes de lo que esperaba.',
    productId: 'ac31',
  },
  {
    id: 't2',
    name: 'Valeria C.',
    rating: 5,
    comment:
      'Compré el cargador para reemplazar el original que se malogró. Carga rapidísimo y se siente de buena calidad, nada barato.',
    productId: 'cg09',
  },
  {
    id: 't3',
    name: 'Diego A.',
    rating: 4,
    comment:
      'Buen sonido y la cancelación de ruido ayuda bastante en el bus. La batería sí baja un poco más rápido de lo que pensé.',
    productId: 'ad01',
  },
  {
    id: 't4',
    name: 'Camila R.',
    rating: 5,
    comment:
      'El cable se siente resistente, no como los que se pelan a los meses. Ya llevo varios meses usándolo a diario sin fallas.',
    productId: 'cb13',
  },
  {
    id: 't5',
    name: 'Jorge P.',
    rating: 5,
    comment:
      'Practiquísimo el power bank magnético, se pega bien al celular y no se resbala. Ideal para el día a día en la calle.',
    productId: 'ac41',
  },
  {
    id: 't6',
    name: 'Andrea T.',
    rating: 4,
    comment:
      'El lector de tarjetas funcionó perfecto con mi laptop para pasar las fotos de la cámara. Pequeño y no ocupa espacio en la mochila.',
    productId: 'ac09',
  },
]