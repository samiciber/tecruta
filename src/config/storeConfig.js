// Configuración central del negocio.
// Modifica estos valores para actualizar los datos de contacto y de la marca
// sin tocar ningún componente.

export const storeConfig = {
  name: 'TecRuta',
  tagline: 'Tecnología que te acompaña.',
  description:
    'Accesorios y tecnología seleccionados para tu día a día: cables, cargadores, audífonos y más, pensados para quienes estudian, trabajan y se mueven.',
  currency: 'PEN',
  currencySymbol: 'S/',
  locale: 'es-PE',

  // Número de WhatsApp para pedidos. Formato internacional sin "+" ni espacios.
  // Reemplaza este valor por el número real de la tienda antes de publicar.
  whatsapp: {
    number: '51927412366',
    displayNumber: '+51 927 412 366',
  },

  social: {
    instagram: 'https://www.instagram.com/samuelfs_10?stkn=MXV6OGNnZnY0YjhjZg==',
    tiktok: 'https://www.tiktok.com/@samuel_fs01?_r=1&_t=ZS-99u6WOgpYlW',
    facebook: 'https://www.facebook.com/samu25534454',
    youtube: 'https://www.youtube.com/@samuelfs10',
    linkedin: 'https://www.linkedin.com/in/marcosfabiansalas',
    email: 'hola@tecruta.pe',
  },

  location: {
    city: 'Lima, Perú',
    detail: 'Coordinación de recojo y envíos a nivel nacional.',
  },

  hours: {
    weekdays: 'Lunes a viernes: 9:00 a. m. – 7:00 p. m.',
    saturday: 'Sábados: 10:00 a. m. – 2:00 p. m.',
    sunday: 'Domingos: cerrado',
  },

  freeShipping: {
    threshold: 150,
  },

  shipping: {
    lima: {
      label: 'Lima Metropolitana',
      detail: 'Delivery coordinado por WhatsApp. Tarifa según distrito, se confirma antes de pagar.',
    },
    provincias: {
      label: 'Provincias',
      detail: 'Envío por agencia de transporte. El costo se coordina con el cliente según destino.',
    },
    pickup: {
      label: 'Recojo coordinado',
      detail: 'Punto de encuentro a coordinar en Lima, sin costo adicional.',
    },
  },
}