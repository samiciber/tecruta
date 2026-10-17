// Estos serializadores devuelven exactamente el mismo shape de objeto que
// hoy exportan src/data/products.js y src/data/categories.js en el
// frontend. Así, cuando en la Fase 1 el catálogo pase a consumir esta API
// en vez del array estático, los componentes (ProductCard, Catalog,
// ProductDetail, etc.) no necesitan cambios.

export function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    fechaNacimiento: user.fechaNacimiento,
    role: user.role,
    verified: user.verified,
  }
}

export function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    customerNombre: order.customerNombre,
    customerApellido: order.customerApellido,
    customerCorreo: order.customerCorreo,
    customerCelular: order.customerCelular,
    deliveryType: order.deliveryType,
    departamento: order.departamento,
    provincia: order.provincia,
    distrito: order.distrito,
    direccion: order.direccion,
    numero: order.numero,
    interior: order.interior,
    referencia: order.referencia,
    quiereComprobante: order.quiereComprobante,
    documento: order.documento,
    otraPersona: order.otraPersona,
    personaNombre: order.personaNombre,
    personaCelular: order.personaCelular,
    subtotal: Number(order.subtotal),
    savings: Number(order.savings),
    total: Number(order.total),
    paymentMethodLabel: order.paymentMethod?.label ?? null,
    receiptUrl: order.receiptUrl ?? null,
    posSale: order.posSale ?? null,
    items: (order.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      image: it.product?.image ?? null,
      slug: it.product?.slug ?? null,
    })),
  }
}

export function serializeCategory(category) {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    icon: category.icon,
  }
}

export function serializeProduct(product) {
  const images = (product.images || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => img.url)

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku ?? null,
    name: product.name,
    brand: product.brand,
    category: product.category?.slug,
    brandSlug: product.brandRef?.slug ?? null,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice !== null && product.compareAtPrice !== undefined ? Number(product.compareAtPrice) : null,
    stock: product.stock,
    featured: product.featured,
    bestSeller: product.bestSeller,
    image: product.image || images[0] || null,
    images,
    shortDescription: product.shortDescription,
    description: product.description,
    tags: product.tags,
    specifications: product.specifications,
    // Campos 3D — undefined-safe: productos creados antes de esta
    // migración no los tendrán en la fila de la BD hasta que se
    // regenere el cliente de Prisma, así que se leen con `?? null` /
    // `?? false` para que nunca revienten el serializado.
    model3DUrl: product.model3DUrl ?? null,
    model3DPoster: product.model3DPoster ?? null,
    enable3D: product.enable3D ?? false,
    hotspots: product.hotspots ?? null,
  }
}

// ---------------------------------------------------------------------
// Navegación, marcas, tiendas (Bloque 1)
// ---------------------------------------------------------------------

export function serializeBrand(brand) {
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    logo: brand.logo ?? null,
    featured: brand.featured,
    featuredPosition: brand.featuredPosition,
    visible: brand.visible,
    productCount: brand._count?.products ?? undefined,
  }
}

export function serializeStore(store) {
  return {
    id: store.id,
    name: store.name,
    address1: store.address1,
    address2: store.address2 ?? null,
    city: store.city,
    postalCode: store.postalCode ?? null,
    opensAt: store.opensAt ?? null,
    active: store.active,
    isDefault: store.isDefault,
    position: store.position,
  }
}

export function serializeTile(tile) {
  return {
    id: tile.id,
    title: tile.title,
    image: tile.image ?? null,
    href: tile.href ?? null,
    position: tile.position,
    visible: tile.visible,
  }
}

// Fila plana de categoría (admin y público).
export function serializeCategoryNode(c) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description ?? null,
    icon: c.icon ?? null,
    image: c.image ?? null,
    parentId: c.parentId ?? null,
    position: c.position,
    visible: c.visible,
    legacy: c.legacy,
    productCount: c._count?.products ?? undefined,
  }
}

// Descarta filas cuyo ancestro no está en la lista (p. ej. porque está
// oculto), a cualquier profundidad. Evita ramas "huérfanas" en el árbol.
export function pruneUnreachable(rows) {
  const byParent = new Map()
  for (const r of rows) {
    const key = r.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(r)
  }
  const out = []
  const walk = (parentId) => {
    for (const r of byParent.get(parentId) || []) {
      out.push(r)
      walk(r.id)
    }
  }
  walk(null)
  return out
}

// Convierte filas planas (con parentId) en un árbol ordenado por `position`.
export function buildTree(rows, parentKey = 'parentId') {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    const parent = node[parentKey] ? byId.get(node[parentKey]) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list) => {
    list.sort((a, b) => a.position - b.position || String(a.label ?? a.name).localeCompare(String(b.label ?? b.name)))
    list.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

// Ítem de menú. Si es PROMO, el texto/enlace vienen de SiteSetting
// "seasonalPromo" (se edita en un solo lugar); devuelve null si la promo
// está oculta, para que el frontend lo omita.
export function serializeNavItem(item, seasonalPromo) {
  let { label, href } = item
  if (item.type === 'PROMO') {
    if (!seasonalPromo || seasonalPromo.visible === false) return null
    label = seasonalPromo.label
    href = seasonalPromo.href
  }
  return {
    id: item.id,
    type: item.type,
    label: label ?? '',
    href: href ?? null,
    position: item.position,
    visible: item.visible,
    parentId: item.parentId ?? null,
    menuKey: item.menuKey,
    children: (item.children || []).map((c) => serializeNavItem(c, seasonalPromo)).filter(Boolean),
  }
}
