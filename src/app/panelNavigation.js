// Grouping never grants permissions. Existing editor routes remain available.
export const panelGroups = [
  { id: 'administracion', title: 'Administración', description: 'Personas y control del negocio.', items: [
    ['/usuarios', 'Personal y permisos', 'Crear usuarios, suspender accesos y restablecer contraseñas.'],
    ['/clientes', 'Clientes', 'Consultar las cuentas de clientes de la tienda.'],
    ['/pos/reportes', 'Reportes', 'Ventas, pagos, devoluciones, caja y stock bajo.'],
    ['/pos/ventas', 'Ventas y devoluciones', 'Consultar tickets y realizar correcciones autorizadas.'],
    ['/auditoria', 'Historial del personal', 'Consultar quién hizo cada cambio de acceso.'],
  ] },
  { id: 'catalogo', title: 'Catálogo', description: 'Los productos que vendes en tienda y en la web.', items: [
    ['/productos', 'Productos', 'Crear productos y editar nombres, precios y contenido.'],
    ['/categorias', 'Categorías', 'Organizar las familias de productos.'],
    ['/marcas', 'Marcas', 'Administrar las marcas del catálogo.'],
    ['/asignar', 'Asignación de productos', 'Asignar categorías y marcas en bloque.'],
  ] },
  { id: 'diseno', title: 'Diseño de la tienda', description: 'Cambios en la web pública, separados de la operación diaria.', items: [
    ['/home-layout', 'Portada y distribución', 'Organizar las secciones de la página de inicio.'],
    ['/banners', 'Banners', 'Editar las imágenes y campañas de la portada.'],
    ['/circulos', 'Accesos por categoría', 'Editar los círculos de categorías de la portada.'],
    ['/menu', 'Menú de categorías', 'Organizar el menú desplegable de categorías y marcas.'],
    ['/menus', 'Enlaces de navegación', 'Editar Acuerdos, Soporte, Descubre y los demás enlaces.'],
    ['/footer', 'Pie de página y legales', 'Editar enlaces y textos del pie de la tienda.'],
  ] },
  { id: 'configuracion', title: 'Configuración', description: 'Ajustes que se utilizan ocasionalmente.', items: [
    ['/pagos', 'Métodos de pago', 'Configurar los métodos disponibles para cobrar.'],
    ['/tiendas', 'Tiendas y contacto', 'Editar los datos de las tiendas.'],
    ['/busquedas', 'Búsquedas populares', 'Editar las sugerencias de búsqueda de la tienda.'],
    ['/suscriptores', 'Suscriptores', 'Consultar las suscripciones a novedades.'],
    ['/ajustes', 'Ajustes del sitio', 'Configurar los datos generales de la web.'],
  ] },
]
export const panelRoleName = { ADMIN: 'Administrador', CASHIER: 'Cajero / vendedor', WAREHOUSE: 'Almacén' }
export function primaryNavigation(role) {
  if (role === 'WAREHOUSE') return [{ to: '/inventario', label: 'Inventario', icon: 'inventory' }]
  const items = [
    { to: '/pos', label: 'Vender', icon: 'sell' },
    { to: role === 'ADMIN' ? '/pedidos' : '/pos/pedidos', label: 'Pedidos', icon: 'orders' },
    { to: '/inventario', label: 'Inventario', icon: 'inventory' },
    { to: '/pos/caja', label: role === 'ADMIN' ? 'Caja' : 'Mi caja', icon: 'cash' },
  ]
  return role === 'ADMIN' ? [{ to: '/', label: 'Inicio', icon: 'home' }, ...items, { to: '/mas', label: 'Más', icon: 'more' }] : items
}
export function isPrimaryActive(to, pathname, role) {
  if (to === '/mas') return pathname === '/mas' || panelGroups.some(group => group.items.some(([path]) => path === pathname))
  if (to === '/pos') return pathname === '/pos' || role !== 'ADMIN' && ['/pos/ventas', '/pos/reportes'].includes(pathname)
  return pathname === to || to === '/pedidos' && pathname === '/pos/pedidos'
}

const normalizeTool = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function filterPanelGroups(query) {
  const needle = normalizeTool(query.trim())
  return panelGroups.map(group => ({ ...group, items: group.items.filter(item => normalizeTool(group.title + ' ' + item.join(' ')).includes(needle)) })).filter(group => group.items.length)
}
