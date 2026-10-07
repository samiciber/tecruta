// =======================================================================
// navSeed.js — ÚNICA fuente de la taxonomía de navegación de TecRuta.
//
// La usan:
//   • server/prisma/seed-nav.js (siembra la BD: categorías, marcas, menús…)
//   • el frontend, solo como RESPALDO MÍNIMO si la API falla
//     (FALLBACK_PILLS y FALLBACK_QUICK_LINKS — nada del árbol completo).
//
// Archivo ESM puro, sin dependencias, para que lo lean Node y Vite.
//
// Estado de verificación (Plan B: bestbuy.com no fue accesible):
//   verified: true  → transcrito de las capturas del usuario (sección 7).
//   draft: true     → BORRADOR por conocimiento general; pendiente de
//                     verificar contra el sitio. Todo es editable en admin.
// Nada de lo que contiene este archivo usa logos/imágenes de terceros.
// =======================================================================

// Destino genérico mientras un ítem no tenga página asignada.
export const SOON = '/proximamente'

// ----- Respaldo mínimo del frontend (no duplica el árbol) ----------------
export const FALLBACK_PILLS = [
  { key: 'menu', label: 'Menú' },
  { key: 'acuerdos', label: 'Acuerdos' },
  { key: 'soporte', label: 'Soporte y Servicios' },
  { key: 'descubre', label: 'Descubre' },
]

export const FALLBACK_QUICK_LINKS = [
  { type: 'PROMO', label: 'Fútbol americano de otoño', href: '/catalogo' },
  { type: 'LINK', label: 'Mejores ofertas', href: '/catalogo' },
  { type: 'LINK', label: 'Oferta del día', href: '/catalogo' },
  { type: 'LINK', label: 'Ideas de regalos', href: SOON },
  { type: 'LINK', label: 'Mis membresías de TecRuta', href: SOON },
  { type: 'LINK', label: 'Tarjetas de crédito', href: SOON },
  { type: 'LINK', label: 'Tarjetas regalo', href: SOON },
]

// ----- Categorías heredadas (se ocultan en la tienda) ---------------------
export const LEGACY_CATEGORY_SLUGS = [
  'power-banks', 'cargadores', 'cables', 'audifonos', 'accesorios', 'celulares', 'tablets', 'laptops',
]

// ----- Árbol de categorías -------------------------------------------------
// c(nombre, hijos?, opciones?) → nodo. `slug` se deriva del nombre si no se
// indica (el seed resuelve colisiones prefijando el slug del padre).
const c = (name, children = [], opts = {}) => ({ name, children, ...opts })
const D = { draft: true } // pendiente de verificar
const V = { verified: true }

export const categoryTree = [
  c('TV y cine en casa', [
    c('Televisores'), c('Barras de sonido'), c('Proyectores y pantallas'),
    c('Reproductores de Blu-ray y DVD'), c('Dispositivos de streaming'),
    c('Receptores y amplificadores'), c('Altavoces de cine en casa'),
    c('Soportes y accesorios para TV'), c('Cables y conectores de video'),
  ], D),
  c('Ordenadores y tabletas', [
    c('Portátiles'), c('Ordenadores de escritorio'), c('Tabletas'), c('Monitores'),
    c('Impresoras y tinta'), c('Componentes de PC'), c('Almacenamiento y unidades'),
    c('Accesorios de computadora'), c('Lectores electrónicos'),
  ], D),
  c('Electrodomésticos', [
    c('Refrigeradores'), c('Lavadoras y secadoras'), c('Lavavajillas'),
    c('Cocinas, estufas y hornos'), c('Microondas'), c('Congeladores'),
    c('Aire acondicionado y calefacción'), c('Aspiradoras y limpieza del hogar'),
  ], D),
  c('Pequeños electrodomésticos de cocina', [
    c('Cafeteras y máquinas de espresso'), c('Freidoras de aire'), c('Licuadoras'),
    c('Ollas de cocción lenta y a presión'), c('Hornos tostadores'),
    c('Procesadores de alimentos'), c('Batidoras'), c('Hervidores eléctricos'),
  ], D),
  c('Videojuegos', [
    c('Consolas'), c('Videojuegos'), c('Mandos y accesorios'), c('Juegos para PC'),
    c('Realidad virtual'), c('Auriculares para juegos'), c('Tarjetas regalo de juegos'),
  ], D),
  c('Teléfonos móviles', [
    c('Todos los teléfonos móviles'), c('iPhone'), c('Samsung Galaxy'), c('Google Pixel'),
    c('Fundas y protectores'), c('Cargadores y cables'), c('Baterías externas'),
  ], D),
  c('Auriculares', [
    c('Auriculares inalámbricos'), c('Con cancelación de ruido'), c('Over-ear'),
    c('In-ear'), c('Para juegos'), c('Deportivos'), c('Accesorios para auriculares'),
  ], D),
  c('Audio doméstico y altavoces', [
    c('Altavoces Bluetooth'), c('Altavoces inteligentes'), c('Barras de sonido'),
    c('Equipos de sonido HiFi'), c('Tocadiscos'), c('Receptores'), c('Subwoofers'),
  ], D),
  c('Música, películas y programas de televisión', [
    c('Películas en Blu-ray y 4K'), c('Programas de televisión'), c('Discos de vinilo'), c('CD'),
  ], D),
  c('Cámaras, videocámaras y drones', [
    c('Cámaras digitales'), c('Cámaras sin espejo'), c('Cámaras réflex'), c('Cámaras de acción'),
    c('Cámaras instantáneas'), c('Drones'), c('Lentes'), c('Trípodes y soportes'), c('Tarjetas de memoria'),
  ], D),
  c('Tecnología Portátil', [
    c('Relojes inteligentes'), c('Pulseras de actividad'), c('Anillos y gafas inteligentes'),
    c('Rastreadores'), c('Accesorios para wearables'),
  ], D),
  c('Fitness, deportes y actividades al aire libre', [
    c('Equipo de ejercicio'), c('Bicicletas estáticas y cintas'), c('Pesas y entrenamiento de fuerza'),
    c('Yoga y pilates'), c('Camping y senderismo'), c('Ciclismo'),
  ], D),
  c('Tienda de aficionados al deporte', [
    c('Fútbol americano'), c('Béisbol'), c('Baloncesto'), c('Hockey'), c('Fútbol'),
  ], D),

  // --- RAMA VERIFICADA (capturas del usuario, sección 7.1.b) ---
  c('Salud, Bienestar y Cuidado Personal', [
    c('Atención sanitaria domiciliaria', [], V),
    c('Cuidado personal y belleza', [
      c('Cuidado del cabello', [], { ...V, sourceRef: 'abcat0915009' }),
      c('Cuidado bucal', [], { ...V, sourceRef: 'abcat0915010' }),
      c('Cuidado de la piel', [], { ...V, sourceRef: 'pcmcat259100050005' }), // sin hijos → página con tiles
      c('Spa y Relajación', [], { ...V, sourceRef: 'abcat0915001' }),
      c('Espejos de tocador', [], { ...V, sourceRef: 'pcmcat238300050018' }),
      c('Afeitado y depilación', [], { ...V, sourceRef: 'abcat0915005' }),
      c('Lámparas de fototerapia', [], { ...V, sourceRef: 'pcmcat222900050018' }),
      c('Escalas', [], { ...V, sourceRef: 'abcat0915013' }),
      c('Accesorios para el baño', [], { ...V, sourceRef: 'pcmcat1761160227825' }),
    ], { ...V, sourceRef: 'abcat0915000' }),
    c('Recuperación del entrenamiento', [], V),
    c('Gafas', [], V),
    // OMITIDOS por duda de traducción (ver informe): "Cariño" y un ítem sin
    // nombre entre "Cuidado del oído" y "Ofertas y Liquidación".
    c('Tecnología Wearable', [], V),
    c('Terapia de contraste: Terapia de Frío y Calor', [], V),
    c('Equipo de ejercicio y fitness', [], V),
    c('Alivio del dolor muscular y recuperación durante el entrenamiento', [], V),
    c('Cuidado del oído', [], V),
    c('Ofertas y Liquidación', [], V),
    c('Servicios y Soporte', [], V),
  ], { ...V, sourceRef: 'pcmcat242800050021' }),

  c('Hogar, muebles y oficina', [
    c('Muebles de oficina'), c('Sillas'), c('Escritorios'), c('Iluminación'),
    c('Decoración del hogar'), c('Almacenamiento y organización'), c('Suministros de oficina'),
  ], D),
  c('Hogar inteligente, seguridad y Wi-Fi', [
    c('Routers y Wi-Fi'), c('Sistemas Wi-Fi en malla'), c('Cámaras de seguridad'),
    c('Timbres con video'), c('Cerraduras inteligentes'), c('Termostatos inteligentes'),
    c('Iluminación inteligente'), c('Enchufes y tomas inteligentes'), c('Sistemas de alarma'),
  ], D),
  c('Vida al aire libre', [
    c('Parrillas y asadores'), c('Muebles de exterior'), c('Cuidado del césped y jardín'),
    c('Calefactores de exterior'), c('Piscinas y spas'), c('Iluminación exterior'),
  ], D),
  c('Transporte eléctrico', [
    c('Scooters eléctricos'), c('Bicicletas eléctricas'), c('Hoverboards y patinetas eléctricas'),
    c('Cascos y seguridad'), c('Accesorios de transporte eléctrico'),
  ], D),
  c('Electrónica de automóviles y GPS', [
    c('Estéreos para auto'), c('Altavoces para auto'), c('Cámaras para auto (dashcams)'),
    c('GPS'), c('Arranque remoto y seguridad'), c('Cargadores y soportes para auto'),
  ], D),
  c('Juguetes, Juegos y Manualidades', [
    c('Bloques de construcción'), c('Juegos de mesa'), c('Muñecas y peluches'),
    c('Figuras de acción'), c('Rompecabezas'), c('Juguetes STEM'), c('Manualidades'),
  ], D),
  c('Coleccionables y recuerdos', [
    c('Figuras coleccionables'), c('Cartas coleccionables'), c('Réplicas y modelos'), c('Pósters y arte'),
  ], D),
]

// ----- Marcas -----------------------------------------------------------------
// BORRADOR por conocimiento general (la página "Todas las marcas" no fue
// accesible). UGREEN es la única con productos y va primera en destacadas.
export const featuredBrandNames = [
  'UGREEN', 'Apple', 'Samsung', 'Sony', 'LG', 'HP', 'Dell', 'Microsoft', 'Google',
  'Nintendo', 'Insignia', 'Bose', 'Dyson', 'GoPro', 'Canon', 'JBL',
]

export const allBrandNames = [
  ...featuredBrandNames,
  '3M', 'Acer', 'Amazon', 'Anker', 'ASUS', 'Beats', 'Belkin', 'Breville', 'Cuisinart', 'DJI',
  'Eufy', 'Fitbit', 'Fujifilm', 'Garmin', 'Hisense', 'Hoover', 'Hamilton Beach', 'iRobot',
  'KitchenAid', 'Lenovo', 'Logitech', 'Meta', 'Nikon', 'Nespresso', 'Nest', 'Panasonic',
  'Philips', 'PlayStation', 'Razer', 'Ring', 'Roku', 'Shark', 'SteelSeries', 'TCL', 'Toshiba',
  'Turtle Beach', 'Vizio', 'Whirlpool', 'Xbox', 'Yamaha',
]

// ----- Menús de navegación -----------------------------------------------------
// Tipos: LINK | HEADING (subtítulo en negrita) | DIVIDER | SUBMENU | PROMO.
const L = (label, href = SOON) => ({ type: 'LINK', label, href })
const H = (label) => ({ type: 'HEADING', label })
const DIV = () => ({ type: 'DIVIDER', label: '' })
const SUB = (label, children = []) => ({ type: 'SUBMENU', label, children })
const PROMO = () => ({ type: 'PROMO', label: '' })
const cat = (label, slug) => L(label, `/categoria/${slug}`)

export const navMenus = {
  // 7.2 Acuerdos
  acuerdos: [
    L('Mejores ofertas', '/catalogo'),
    L('Oferta del día', '/catalogo'),
    L('Ofertas exclusivas para miembros'),
    L('Acuerdos con Outlets'),
    L('Acuerdos de liquidación'),
    H('Ofertas por categoría'),
    cat('TV y cine en casa', 'tv-y-cine-en-casa'),
    cat('Ordenadores y tabletas', 'ordenadores-y-tabletas'),
    cat('Videojuegos', 'videojuegos'),
    cat('Audio doméstico y altavoces', 'audio-domestico-y-altavoces'),
    cat('Auriculares', 'auriculares'),
    cat('Teléfonos móviles', 'telefonos-moviles'),
    cat('Hogar inteligente, seguridad y Wi-Fi', 'hogar-inteligente-seguridad-y-wi-fi'),
    cat('Juguetes, Juegos y Manualidades', 'juguetes-juegos-y-manualidades'),
    cat('Cámaras, videocámaras y drones', 'camaras-videocamaras-y-drones'),
    cat('Tecnología Portátil', 'tecnologia-portatil'),
    cat('Electrodomésticos', 'electrodomesticos'),
    cat('Hogar, muebles y oficina', 'hogar-muebles-y-oficina'),
    cat('Vida al aire libre', 'vida-al-aire-libre'),
    cat('Electrónica de coches', 'electronica-de-automoviles-y-gps'),
    cat('Transporte eléctrico', 'transporte-electrico'),
    cat('Salud, Bienestar y Cuidado Personal', 'salud-bienestar-y-cuidado-personal'),
  ],

  // 7.3 Soporte y Servicios
  soporte: [
    L('Visita nuestro Centro de Apoyo', '/ayuda'),
    L('Servicios de Reparación y Tecnología'),
    L('Soporte remoto'),
    L('Gestionar una cita'),
    L('Entrega de tu dispositivo'),
    L('Comprobar el estado de la reparación'),
    L('Soporte de marcas de TecRuta'),
    L('Servicios Profesionales Empresariales de TecRuta'),
    H('Infórmate sobre los servicios por categoría'),
    L('Servicios de Ordenadores y Tabletas'),
    L('Servicios de TV y cine en casa'),
    L('Servicios de electrodomésticos'),
    L('Servicios de telefonía móvil'),
    L('Reparación autorizada por Apple'),
    L('Servicios de Hogar Inteligente'),
    L('Instalación profesional de electrónica para automóviles'),
    L('Servicios de Equipamiento de Fitness'),
    L('Todos los servicios'),
    H('Planes de Protección y Apoyo'),
    L('Mi membresía total de TecRuta'),
    L('Protección Geek'),
    L('AppleCare+'),
    L('Protección TecRuta'),
    H('Servicios adicionales'),
    L('Transporte y reciclaje'),
    L('Encuentra piezas de repuesto'),
    L('Suscripciones', '/planes'),
  ],

  // 7.4 Descubre. Los subniveles quedan vacíos (el frontend muestra
  // "Próximamente") hasta que se editen desde el admin.
  descubre: [
    L('Descubre todo', '/catalogo'),
    PROMO(), // "Fútbol americano de otoño": editable en Ajustes del sitio
    L('Halloween'),
    L('Cuidado del césped en otoño'),
    L('Lanzamientos de TecRuta'),
    SUB('Ideas de regalos destacados'),
    SUB('Nuevos lanzamientos'),
    SUB('Tecnología mejor calificada'),
    SUB('Más vendidos'),
    SUB('Descubre y aprende (blog)'),
  ],

  // 7.5 Más
  mas: [
    L('Mis membresías de TecRuta'),
    L('Tarjetas de crédito'),
    L('Tarjetas regalo'),
    L('Intercambio'),
    L('Negocio de TecRuta'),
  ],

  // 7.6 Enlaces rápidos de la fila 2 (los que no caben pasan a "Más ▾"
  // por CSS en el Bloque 2).
  quick: [
    PROMO(),
    L('Mejores ofertas', '/catalogo'),
    L('Oferta del día', '/catalogo'),
    L('Ideas de regalos'),
    L('Mis membresías de TecRuta'),
    L('Tarjetas de crédito'),
    L('Tarjetas regalo'),
  ],
}

// ----- Búsquedas populares ---------------------------------------------------------
// Por defecto, términos que SÍ devuelven resultados con el catálogo actual
// (todo UGREEN). Las de la captura (iPad, iPhone…) pueden cargarse desde el
// admin cuando existan esos productos.
export const popularSearchSeed = [
  'power bank', 'cargador rápido', 'cable USB-C', 'audífonos', 'cargador inalámbrico',
  'hub USB-C', 'MagSafe', 'Nexode', 'adaptador', 'UGREEN',
]

// ----- Tiendas ------------------------------------------------------------------------
// Sin tiendas por defecto: la web muestra "Tienda online" hasta que se cree
// una desde el admin.
export const storeSeed = []

// ----- Ajustes del sitio --------------------------------------------------------------------
export const siteSettingsSeed = {
  seasonalPromo: { label: 'Fútbol americano de otoño', href: '/catalogo', visible: true },
}