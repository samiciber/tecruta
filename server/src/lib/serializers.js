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
    referencia: order.referencia,
    quiereComprobante: order.quiereComprobante,
    documento: order.documento,
    subtotal: Number(order.subtotal),
    savings: Number(order.savings),
    total: Number(order.total),
    paymentMethodLabel: order.paymentMethod?.label ?? null,
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
    name: product.name,
    brand: product.brand,
    category: product.category?.slug,
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