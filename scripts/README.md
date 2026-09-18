# Scripts

Herramientas de mantenimiento que operan sobre `src/data/products.js` (el
catálogo estático que se usa como respaldo cuando la API no responde) o
sobre recursos externos relacionados. **Ninguno de estos scripts toca la
base de datos real** — para eso está el panel `/admin`.

Todos se ejecutan desde la raíz del proyecto:

```bash
node scripts/sincronizar-imagenes.cjs
node scripts/legacy/agregar-bestseller.cjs
```

## `sincronizar-imagenes.cjs`

Sigue en uso. Trae desde Cloudinary la URL más reciente de cada imagen y
actualiza `src/data/products.js` con ellas. Necesita `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en el `.env` de la raíz
(ver `.env.example`).

## `legacy/`

Scripts de un solo uso que ya cumplieron su propósito (reorganizar o
migrar datos del catálogo estático en su momento). Se conservan como
referencia por si hace falta repetir una migración parecida, pero no se
espera que se vuelvan a correr:

- `agregar-bestseller.cjs` — agregó el campo `bestSeller` a los productos existentes.
- `dividir-productos.js` — dividió `products.js` en archivos individuales por producto (no se terminó de adoptar; `products.js` sigue siendo un solo archivo).
- `mover-powerbanks.js` — reclasificó los power banks a su propia categoría.
