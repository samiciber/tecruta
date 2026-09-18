// Catálogo de categorías. Agregar una categoría nueva solo requiere
// añadir un objeto aquí — el resto de la interfaz (menú, filtros,
// páginas de catálogo) la toma automáticamente de esta lista.

export const categories = [
  {
    slug: 'power-banks',
    name: 'Power Banks',
    description: 'Baterías portátiles UGREEN para cargar tus dispositivos en cualquier lugar.',
    icon: 'BatteryCharging',
  },
  {
    slug: 'cargadores',
    name: 'Cargadores',
    description: 'Cargadores de pared, autos y bases de carga rápida.',
    icon: 'PlugZap',
  },
  {
    slug: 'cables',
    name: 'Cables',
    description: 'Cables USB-C, Lightning y micro-USB reforzados.',
    icon: 'Cable',
  },
  {
    slug: 'audifonos',
    name: 'Audífonos',
    description: 'In-ear, over-ear e inalámbricos para el día a día.',
    icon: 'Headphones',
  },
  {
    slug: 'accesorios',
    name: 'Accesorios',
    description: 'Hubs, soportes y accesorios para tu equipo.',
    icon: 'Cpu',
  },
  {
    slug: 'celulares',
    name: 'Celulares',
    description: 'Próximamente en TecRuta.',
    icon: 'Smartphone',
  },
  {
    slug: 'tablets',
    name: 'Tablets',
    description: 'Próximamente en TecRuta.',
    icon: 'Tablet',
  },
  {
    slug: 'laptops',
    name: 'Laptops',
    description: 'Próximamente en TecRuta.',
    icon: 'Laptop',
  },
]

export const getCategoryBySlug = (slug) => categories.find((c) => c.slug === slug)
