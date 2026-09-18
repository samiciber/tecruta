# TecRuta API (Fase 0)

Backend de TecRuta: Express + Prisma + PostgreSQL. Esta es la base sobre la
que la web (y en el futuro la app móvil) van a apoyarse para tener
clientes, productos, pedidos y estados reales en una base de datos —ya no
en `localStorage` ni en archivos estáticos.

## Qué incluye esta fase

- **Esquema completo de base de datos** (`prisma/schema.prisma`): usuarios,
  direcciones, categorías, productos, imágenes, métodos de pago, carrito,
  pedidos, ítems de pedido e historial de estados.
- **Seed** (`prisma/seed.js`): migra tus categorías, productos y métodos de
  pago **actuales** (los mismos de `src/data/products.js`,
  `src/data/categories.js` y `src/config/paymentConfig.js`) hacia la base
  de datos, para arrancar con el mismo catálogo que ya tienes hoy.
- **API de solo lectura del catálogo**:
  - `GET /api/health`
  - `GET /api/categories`
  - `GET /api/products` (filtros opcionales: `?category=power-banks`, `?q=cargador`, `?featured=true`)
  - `GET /api/products/:slug`

Lo que **todavía no incluye** (fases siguientes, ya con la base lista para
soportarlo): carrito persistente por usuario, panel visual de
administración (los endpoints ya existen — falta la interfaz).

## Endpoints de administración (Fase 4)

Todo bajo `/api/admin/*` exige sesión + rol `ADMIN` (header
`Authorization: Bearer <token>` de una cuenta con ese rol).

- `POST /api/admin/products` · `PATCH /api/admin/products/:id` · `DELETE /api/admin/products/:id`
- `POST /api/admin/categories` · `PATCH /api/admin/categories/:slug`
- `PATCH /api/admin/payment-methods/:key`
- `GET /api/admin/orders` (todos los pedidos, filtro opcional `?status=PENDING`)
- `PATCH /api/admin/orders/:id/status` (cambia el estado; si se cancela un
  pedido, devuelve automáticamente el stock que se había descontado)
- `GET /api/admin/users` (solo lectura por ahora)

### Cómo crear tu primer administrador

No existe ningún endpoint público para esto (sería una puerta de entrada
peligrosa). Primero regístrate normalmente desde `/crear-cuenta` en la
web, verifica tu correo, y luego corre:

```bash
npm run make-admin -- tu-correo@ejemplo.com
```

## 1. Requisitos

- Node.js 18+
- Una base de datos PostgreSQL. Opciones rápidas y gratuitas para empezar:
  - [Neon](https://neon.tech) (recomendado, tiene un plan gratuito generoso)
  - [Railway](https://railway.app)
  - [Supabase](https://supabase.com)
  - O PostgreSQL local / Docker si prefieres no depender de un servicio externo.

## 2. Configurar variables de entorno

```bash
cd server
cp .env.example .env
```

Edita `.env` y reemplaza `DATABASE_URL` con la cadena de conexión real que
te da tu proveedor de PostgreSQL (se ve como
`postgresql://usuario:contraseña@host:puerto/basededatos?schema=public`).

## 3. Instalar dependencias

```bash
npm install
```

## 4. Crear las tablas en la base de datos

```bash
npx prisma migrate dev --name init
```

Esto lee `prisma/schema.prisma`, crea la migración SQL y la aplica a tu
base de datos. La primera vez te pedirá confirmar el nombre de la
migración (`init` ya lo dejamos como sugerencia arriba).

## 5. Cargar tu catálogo actual

```bash
npm run seed
```

Esto copia tus 8 categorías, tus productos y tus 4 métodos de pago
actuales hacia la base de datos.

## 6. Levantar la API

```bash
npm run dev
```

Deberías ver:
```
✔ API de TecRuta corriendo en http://localhost:4000
```

Prueba abriendo en el navegador:
- http://localhost:4000/api/health
- http://localhost:4000/api/categories
- http://localhost:4000/api/products

## Notas importantes

- **El frontend (carpeta `tecruta/`, un nivel arriba) NO fue modificado en
  esta fase.** Sigue funcionando exactamente igual que antes (catálogo
  desde `products.js`, carrito y sesión en `localStorage`, checkout por
  WhatsApp). Conectar el frontend a esta API es la Fase 1.
- `npx prisma studio` abre una interfaz visual en el navegador para ver y
  editar los datos de la base directamente — útil mientras no exista un
  panel de administración propio.
- Si cambias el esquema (`schema.prisma`), vuelve a correr
  `npx prisma migrate dev --name algun_nombre_descriptivo` para generar la
  migración correspondiente.