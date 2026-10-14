# Lote 8 — retirar módulos sin uso (H30)

Rama `fix/lote-8-codigo-muerto`, desde `main` actualizado a
`60917edea784c46363b7b0ae7708e2f30f6f6bec`. Incluye el cambio de círculos de
categorías recibido en `main`, sin modificar sus componentes.

## Alcance y comprobación de referencias

Se elimina únicamente el código muerto confirmado que autorizó este lote.

| Archivo | Evidencia previa y cambio |
| --- | --- |
| `src/components/cart/CartDrawer.jsx` | Ningún importador ni montaje. Se elimina; el header y `MobileCartBar` enlazan a `/carrito`. |
| `src/pages/admin/AdminCategories.jsx` | Solo aparecía en su declaración `lazy` de `App.jsx`; ninguna ruta lo renderizaba. Se elimina. |
| `src/data/heroSlides.js` | Ningún importador. `HeroSlider` usa `settings.homeBanners` y su función local `fallbackSlides`. Se elimina. |
| `src/App.jsx` | Se retira exclusivamente la declaración `lazy` de `AdminCategories`. `/admin/categorias` conserva `AdminCategoryTree`; `/admin/circulos` conserva `AdminHomeCircles`. |
| `src/data/testimonials.js` | Se retira una comparación en un comentario que citaba el archivo eliminado. Datos y exportación intactos. |
| `docs/lotes/lote-8.md` | Alcance, evidencia y pasos de validación. |

Antes de borrar se ejecutó `rg -n 'CartDrawer|AdminCategories|heroSlides|AdminCategoryTree'`
sobre el repositorio. La única referencia ejecutable a los tres módulos era el
`lazy` sin ruta; además existía el comentario de testimonios. Después de borrar:

```bash
rg -n -i 'cartdrawer|admincategories|heroslides|import\.meta\.glob' src
```

Sin coincidencias (salida 1 de `rg`, esperada). No existe un cargador por glob que
pueda consumir estos módulos sin mencionarlos. El build no emite sus chunks y
sí conserva el chunk `AdminCategoryTree`.

H30 queda resuelto en su apartado de los tres módulos muertos. No se eliminan
`productIndex` ni los archivos `data/products/*`: tienen importadores activos y
su deduplicación sigue pendiente. No se elimina más código por extensión de este
lote. No se tocan archivos reservados a Claude, dependencias, backend ni datos.

## Validación y cómo reproducir

1. Ejecutar `npm ci` y `npm run build` desde la raíz, con el lockfile existente.
   Build correcto con Node 24.19.0 y npm 11.9.0; permanece el aviso previo de
   tamaño de chunks, que no es un error de compilación.
2. Ejecutar el escaneo anterior y comprobar que conserva `/admin/categorias`
   con `AdminCategoryTree`, y que la Home importa `HeroSlider`.
3. Servir el build con `npm run preview`. Con una API local o interceptada,
   recorrer `/`, `/catalogo`, `/carrito`, `/admin/categorias` y `/admin/circulos`.
   Para admin, simular una sesión ADMIN y sus respuestas GET; no usar cuentas
   ni credenciales reales. Probar 390, 768, 1024, 1280, 1440 y 1920 px en claro
   y oscuro. Confirmar hero/círculos, título del catálogo, carrito con un artículo,
   árbol de categorías y panel de círculos. El enlace de carrito del header debe
   navegar a `/carrito`.
4. No crear categorías ni tocar controles de guardado: estos checks verifican
   carga de componentes, rutas y temas, sin escrituras.

Evidencia local, fuera del checkout: `/workspace/audit-tecruta/lote-8/`
(`references-before.log`, `reference-scan.log`, `chunks.log`, `build.log`,
`validate-browser.py`, `browser.log`, `browser.json`). El navegador usa el build
compilado, fixtures para toda la API y medios simulados; bloquea mutaciones.
Resultado: 60 renders correctos (cinco rutas por seis anchos por dos temas),
enlace del header al carrito correcto, cero errores JavaScript y cero
escrituras o peticiones a producción.
Estas comprobaciones no constituyen una nueva auditoría de contraste,
desbordamiento o funcionamiento del backend.

## Integración, riesgos y reversión

Los PR anteriores siguen abiertos: este PR contiene exclusivamente el Lote 8,
no incorpora ni despliega sus correcciones. Una simulación `git merge-tree` con
la rama del Lote 7 resuelve sin conflictos; no sustituye una validación conjunta
del conjunto de PR ni realiza un merge.

Riesgo reducido: un cambio futuro podría intentar importar un módulo retirado.
Debe utilizar los componentes activos indicados arriba. El build comprueba los
imports actuales; los checks de navegador comprueban las rutas conservadas.
Para revertir, revertir los commits de este lote/restaurar los tres archivos y
la declaración `lazy`. No hay migraciones ni configuración que revertir.

No se probaron login real, API de producción, escrituras admin ni despliegue:
no son necesarios para retirar módulos sin uso y quedan fuera de este lote.
No se creó ningún registro de prueba en producción.
