// Configuración del carrusel principal (Hero) de la Home.
//
// Cada slide representa una CATEGORÍA (no un producto individual): al hacer
// clic lleva al catálogo filtrado por esa categoría (/catalogo?categoria=...).
//
// El ORDEN de este arreglo es el orden en que se muestran los slides —
// para reordenarlos, reordena los objetos aquí.
//
// Campos de cada slide:
// - id:         identificador único del slide (string, libre).
// - category:   slug de la categoría (debe existir en src/data/categories.js).
//               Determina a dónde lleva el slide: /catalogo?categoria=<category>.
// - media:      fondo del slide. Es OPCIONAL — si se omite, el slide usa
//               automáticamente un fondo con degradado + ícono de la
//               categoría (útil mientras no haya foto/video real).
//     - type:   'image' | 'video'
//     - src:    URL de la imagen o del video.
//     - poster: (solo video, opcional) imagen mientras el video carga.
// - eyebrow:    texto pequeño / etiqueta sobre el título.
// - title:      título grande del slide.
// - subtitle:   texto de apoyo debajo del título.
// - ctaLabel:   texto del botón.
//
// Para actualizar la campaña semanal: cambia media/eyebrow/title/subtitle/
// ctaLabel de cualquier slide, o reordena/agrega/quita objetos — el
// componente HeroSlider no necesita ningún cambio.

export const heroSlides = [
  {
    id: 'power-banks',
    category: 'power-banks',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659266/f1d2e2e7-b819-4be3-8f46-348fe5ed3df3._CR0_0_3000_1500_SX3000_.png',
    },
    eyebrow: 'Energía portátil',
    title: 'Power banks para todo el día',
    subtitle: 'Carga tus dispositivos estés donde estés, sin cables ni tomas cerca.',
    ctaLabel: 'Ver power banks',
    textPosition: 'top-center',
  },
  {
    id: 'cargadores',
    category: 'cargadores',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659272/f0bb21e1-9b77-4ca1-989b-22fe9176ee35._CR0_0_3000_1500_.png',
    },
    eyebrow: 'Carga rápida',
    title: 'Un cargador para todo lo que llevas',
    subtitle: 'Cargadores de pared, auto y carga rápida para cada dispositivo.',
    ctaLabel: 'Ver cargadores',
    textPosition: 'top-center',
  },
  {
    id: 'cables',
    category: 'cables',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659268/49b450c3-2d34-44b1-a83a-52578dbd49ab.png',
    },
    eyebrow: 'Conexión resistente',
    title: 'Cables pensados para durar',
    subtitle: 'USB-C, Lightning y micro-USB reforzados para el uso diario.',
    ctaLabel: 'Ver cables',
  },
  {
    id: 'audifonos',
    category: 'audifonos',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659270/4dbda6d9-1f52-4efc-91bf-aa209933048d.png',
    },
    eyebrow: 'Sonido sin cables',
    title: 'Escucha sin distracciones',
    subtitle: 'In-ear, over-ear e inalámbricos para acompañar tu día.',
    ctaLabel: 'Ver audífonos',
    textPosition: 'top-center',
  },
  {
    id: 'accesorios',
    category: 'accesorios',
    // Sin 'media': usa el fondo con degradado + ícono de la categoría.
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787659271/9a98511d-deb4-465b-b225-f0bc220ca79c.png',
    },
    eyebrow: 'Completa tu setup',
    title: 'Accesorios para tu equipo',
    subtitle: 'Hubs, soportes y más para sacarle el máximo provecho a tus dispositivos.',
    ctaLabel: 'Ver accesorios',
  },
  {
    id: 'celulares',
    category: 'celulares',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787700529/hero_iphone_family__be5jkzxszb1e_large.jpg',
    },
    eyebrow: 'Muy pronto',
    title: 'Celulares en camino',
    subtitle: 'Estamos preparando una selección de celulares para ti.',
    ctaLabel: 'Ver más',
  },
  {
    id: 'tablets',
    category: 'tablets',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787702079/TabA11-Plus-KV-PCD_KV_DT_1440x640.webp',
    },
    eyebrow: 'Muy pronto',
    title: 'Tablets en camino',
    subtitle: 'Pronto sumaremos tablets a nuestro catálogo.',
    ctaLabel: 'Ver más',
  },
  {
    id: 'laptops',
    category: 'laptops',
    media: {
      type: 'image',
      src: 'https://res.cloudinary.com/u6oy2szr/image/upload/v1787702080/fwebp.png',
    },
    eyebrow: 'Muy pronto',
    title: 'Laptops en camino',
    subtitle: 'Pronto sumaremos laptops a nuestro catálogo.',
    ctaLabel: 'Ver más',
  },
]
