# TecRuta — Frontend Ecommerce

Tienda online de accesorios y tecnología para el mercado peruano. Proyecto **frontend-only**, construido con **React + Vite + Tailwind CSS**, con arquitectura modular pensada para crecer (más productos, categorías, marcas y, más adelante, backend) sin rehacer la interfaz.

## 1. Arquitectura

- **UI** (`src/components`, `src/pages`) — solo presentación, no contiene datos de negocio.
- **Datos** (`src/data`) — catálogo de productos y categorías, centralizado.
- **Configuración** (`src/config`) — datos de la tienda (`storeConfig.js`) y de pagos (`paymentConfig.js`), separados del código para poder editarlos sin tocar componentes.
- **Estado** (`src/context`, `src/hooks`) — carrito (persistido en `localStorage`) y tema claro/oscuro, expuestos mediante hooks (`useCart`, `useTheme`, `useProducts`).
- **Utilidades** (`src/utils`) — formato de moneda, mensaje de WhatsApp, lectura/escritura segura de `localStorage`, generación de imágenes de producto locales (SVG, sin depender de internet).

Esta separación es intencional: cuando se agregue un backend, solo hace falta reemplazar `src/data` y partes de `src/context` por llamadas a una API — los componentes no cambian.

### Estructura de carpetas

```text
src/
├── components/
│   ├── layout/      Header, Footer, menú móvil
│   ├── product/      ProductCard, ProductGrid, StockBadge, QuantitySelector...
│   ├── filters/       SearchBar, FilterPanel, SortSelect
│   ├── cart/          CartDrawer, CartItem
│   ├── checkout/     PaymentMethodSelector, ReceiptUpload, WhatsAppButton
│   └── ui/            Modal, Toast, EmptyState, ThemeToggle
├── pages/            Home, Catalog, ProductDetail, Checkout, Help, Legal, NotFound
├── data/               products.js, categories.js
├── config/            storeConfig.js, paymentConfig.js
├── context/           CartContext, ThemeContext
├── hooks/              useCart, useTheme, useProducts
├── utils/              formatCurrency, whatsapp, storage, placeholderImage
├── App.jsx
└── main.jsx
```

### Flujo de usuario

```
Inicio → Catálogo (buscar / filtrar / ordenar) → Producto → Agregar al carrito
→ Carrito → Checkout → Pago directo (Yape / Plin / transferencia / efectivo)
o WhatsApp → Confirmación por WhatsApp
```

## 2. Ejecutar el proyecto localmente

Requisitos: [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (normalmente `http://localhost:5173`).

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## 3. Cómo modificar cada parte

### Productos, precios, stock, categorías
Edita `src/data/products.js`. Cada producto es un objeto con `id, name, slug, description, shortDescription, price, compareAtPrice, category, brand, stock, featured, tags, specifications`. El campo `category` debe coincidir con un `slug` de `src/data/categories.js`. Las imágenes se generan automáticamente en SVG a partir del nombre y la categoría; si más adelante tienes fotos reales, reemplaza el campo `image`/`images` por la ruta del archivo (por ejemplo `/images/producto.jpg` dentro de una carpeta `public/images`).

Para agregar una categoría nueva, añade un objeto en `src/data/categories.js` — el menú, los filtros y las páginas de catálogo la toman automáticamente.

### WhatsApp
Edita `src/config/storeConfig.js` → `whatsapp.number` (formato internacional, sin `+` ni espacios, ej. `51987654321`) y `whatsapp.displayNumber` (formato visual).

### Yape, Plin, transferencia bancaria, efectivo
Edita `src/config/paymentConfig.js`. Cada método tiene sus propios campos (`holderName`, `phoneNumber`, `accountNumber`, `cci`, etc.). Para agregar el QR de Yape o Plin, sube la imagen a la carpeta `public/` y coloca su ruta en `qrImageUrl` (por ejemplo `/qr-yape.png`).

### Redes sociales, correo, horarios, ubicación, envíos
Edita `src/config/storeConfig.js` → `social`, `hours`, `location`, `shipping`.

## 4. Auditoría final

- **Imports y rutas** — verificados: todas las rutas relativas del proyecto resuelven a un archivo existente.
- **Carrito** — agregar, quitar, cambiar cantidad, subtotal y total funcionan; el carrito se valida contra el stock actual del producto en cada lectura, nunca confía en datos de `localStorage` sin verificar.
- **Persistencia** — el carrito y la preferencia de tema se guardan en `localStorage` mediante un envoltorio con manejo de errores (`src/utils/storage.js`), y sobreviven a cerrar y volver a abrir el navegador.
- **Búsqueda y filtros** — funcionan en tiempo real sobre nombre, marca, categoría, tags y descripción; los filtros de categoría, marca, precio y disponibilidad se combinan correctamente; hay un estado vacío diseñado cuando no hay resultados.
- **Checkout** — permite elegir método de pago (con datos configurables desde `paymentConfig.js`), adjuntar un comprobante de pago local (sin enviarlo a ningún servidor, indicado explícitamente en la interfaz) y enviar el pedido por WhatsApp con el detalle completo (productos, cantidades, precios, total y método de pago).
- **WhatsApp** — el mensaje se codifica con `encodeURIComponent` y el número se lee desde la configuración central; no hay ningún número real hardcodeado (usa un valor de ejemplo que debes reemplazar).
- **Responsive y modo oscuro** — construido mobile-first con Tailwind; el tema oscuro/claro detecta la preferencia del sistema, se puede cambiar manualmente y se guarda en `localStorage`. Las animaciones respetan `prefers-reduced-motion`.
- **Enlaces del footer** (Ayuda, Términos, Privacidad) apuntan a páginas reales del proyecto (`/ayuda`, `/legal/terminos`, `/legal/privacidad`), no a URLs inexistentes.

Nada de lo anterior es simulado: si descargas el proyecto, ejecutas `npm install && npm run dev`, puedes navegar la tienda, buscar, filtrar, agregar productos al carrito, cerrar y reabrir el navegador conservando el carrito, llegar al checkout y enviar el pedido por WhatsApp sin código faltante.

## 5. Preparado para backend futuro

Esta versión es frontend-only a propósito. Cuando quieras conectar un backend real (inventario, pedidos, usuarios, pagos, panel administrativo), el punto de entrada natural es:

- Reemplazar `src/data/products.js` por llamadas a una API (por ejemplo dentro de una futura carpeta `src/services/`).
- Sustituir la lógica de `CartContext` para sincronizar el carrito con el backend en vez de (o además de) `localStorage`.
- Conectar `ReceiptUpload` a un endpoint de subida de archivos real.

Ningún componente de la interfaz necesita reescribirse para esto: todos ya leen los datos a través de `data/`, `config/`, `context/` y `hooks/`.
