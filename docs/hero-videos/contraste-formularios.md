# Contraste de buscadores y formularios

Corrección local, pendiente de publicar junto con videos y paginación.

## Causa

storefront.css asignaba color var(--shop-text) a todos los input, textarea y
select de la tienda, con mayor especificidad que las utilidades del buscador.
En modo oscuro ese color era casi blanco, mientras el buscador de la cabecera
conservaba su fondo blanco. La regla general de placeholder repetía el problema.

Se retiró esa imposición general de color. La superficie del buscador, compartida
en escritorio y móvil, tiene una clase específica: fondo blanco, texto y cursor
oscuros, placeholder gris oscuro, selección azul claro con texto oscuro y esquema
nativo claro. Las sugerencias, situadas fuera del formulario, conservan su tema.

## Casos similares encontrados

- El campo alternativo de Compartir producto, visible cuando falla el portapapeles,
  no tenía clase de formulario: ahora usa input-tr y sus colores de fondo/texto.
- Los placeholders input-tr del panel usaban gris oscuro al 50 % incluso en tema
  oscuro: ahora tienen gris opaco en claro y texto claro al 60 % en oscuro.
  Esto incluye búsqueda de productos, inventario, herramientas de Más y formularios
  que reutilizan esa clase. No cambia su lógica.
- Se declara color-scheme en input-tr, la tienda y el espacio de trabajo para que
  los controles nativos (select, fecha, autocompletado) acompañen al tema.
- Se revisaron los campos JSX y las clases utilizadas en buscador de catálogo,
  filtros, newsletter, acceso, checkout, reseñas, administración y POS. Los campos
  de reseñas ya emparejan fondo y texto en su CSS; los de POS ya tienen variantes
  completas de fondo/texto. Se conservan esas reglas específicas.

## Comprobaciones y límites

Ambos builds sin descubrir .env, ESLint sin errores (cinco advertencias previas)
y git diff --check correctos. Sin cambios a consultas, autenticación, permisos,
datos comerciales ni dependencias.

Ratios calculados con luminancia sRGB sobre los colores declarados, no medidos
en navegador: buscador antes 1,08:1 y después 15,46:1; placeholder de cabecera
6,42:1. Placeholder genérico del panel oscuro antes 1,27:1 y después 6,78:1.
Estos cálculos no certifican toda la interfaz ni su contraste bajo extensiones.

La herramienta de navegador no pudo determinar con confianza la URL de Windows
y detuvo Computer Use. No se capturó evidencia visual ni se verificaron estilos
computados, autofill o selección real. Antes de publicar, revisar en ambos temas
y escritorio/móvil: escribir/borrar/seleccionar en cabecera, abrir sugerencias,
escribir en catálogo y panel, y forzar fallo de portapapeles para revisar el enlace.
La revisión local sigue en el puerto 5213; la web pública conserva su versión.
