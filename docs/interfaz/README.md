# Panel de trabajo: navegación y diseño para revisión local

Navegación rápida entre herramientas: [menú lateral de Más](../mas-lateral/README.md), preparado localmente.

Último ajuste de facilidad de uso: [panel más sencillo](../usabilidad/README.md), con opciones secundarias plegadas y guía por tarea. Preparado localmente; pendiente de publicación.

> Etapa siguiente preparada localmente: [carritos recuperables, atajos y
> siguientes pasos](../operacion-rapida/README.md). Esa etapa sustituye la
> limitación del carrito no guardado y amplía la persistencia de filtros.

Rama: `mejora/panel-operacion-clara`, basada en el sistema integrado publicado.
Esta etapa cambia la interfaz; no publica código, no ejecuta migraciones y no
modifica cuentas ni datos reales. React, Express, Prisma y las dependencias
conservan sus versiones. La web pública mantiene sus rutas y autenticación.

## Qué cambió

- Una cabecera común para administración, inventario y POS; sin el listado de
  más de veinte opciones ni una segunda barra lateral distinta al entrar a vender.
- ADMIN: **Inicio, Vender, Pedidos, Inventario, Caja, Más**. Inicio ofrece cuatro
  acciones grandes y el resumen real existente. La cifra de treinta días se
  identifica como pedidos web cobrados, sin presentarla como ventas POS ni como
  ventas de hoy. Las fechas de pedidos se muestran en America/Lima.
- Cajero: **Vender, Pedidos, Inventario, Mi caja**. Conserva el historial de ventas
  y sus reportes en las pestañas del POS. Pedidos lleva a su bandeja por cobrar,
  sin dar acceso al administrador de estados de los pedidos web.
- Almacén: **Inventario**, con accesos a consultas/etiquetas, entrada, salida,
  borradores y Kardex. Entrada y salida solo preparan el tipo y enfocan el lector;
  no guardan ni confirman operaciones. El usuario revisa el motivo concreto.
- Nombre, perfil, tienda pública, seguridad y cierre de sesión en **Mi cuenta**.
  Funciona con teclado; Escape cierra el desplegable. El selector de tema queda
  en el mismo lugar para todas las áreas operativas.

## Dónde quedaron las opciones

| Grupo en Más | Herramientas |
| --- | --- |
| Administración | Personal/permisos, clientes, reportes, ventas/devoluciones, auditoría |
| Catálogo | Productos, categorías, marcas, asignaciones |
| Diseño de la tienda | Portada, banners, círculos, menú de categorías, enlaces de navegación, pie/legales |
| Configuración | Métodos de pago, tiendas, búsquedas populares, suscriptores, ajustes |

**No se eliminó ninguna función ni registro.** «Menú de categorías» (`/menu`) y
«Enlaces de navegación» (`/menus`) son editores distintos; se conservaron y
renombraron en el acceso para explicar su diferencia. Las rutas anteriores siguen
funcionando. El buscador de herramientas es local, ignora tildes y no consulta la
API con cada pulsación. Más solo está disponible para ADMIN; se mantiene la
validación de permisos de la API existente.

Al abrir cualquiera de esas herramientas aparece **Volver a Más** sobre el
contenido. Regresa al listado conservando la búsqueda utilizada, incluso si
se recargó la herramienta. Si se abrió directamente, vuelve a Más sin filtro.

## Venta con menos elementos en pantalla

La lista de pedidos por cobrar está en `/pos/pedidos`, fuera de la nueva venta.
Seleccionar un pedido lleva al cobro con sus líneas y reserva originales. No se
vuelve a descontar stock. Mientras carga un pedido se deshabilitan las operaciones
del formulario para impedir que se mezclen dos selecciones.

El lector y la búsqueda siguen siendo dedicados, con búsqueda acotada y demorada
300 ms como antes. Se destaca el último producto identificado y hay un botón para
volver al lector. No se añadieron atajos globales ni se confirma al escanear.

Cliente y carga manual por referencia quedan plegados; consumidor final no
necesita datos. Los descuentos y las verificaciones de dinero conservan sus
permisos y validaciones. El servidor sigue recalculando precios y stock antes
de confirmar; el nuevo diseño no permite vender sin conexión.

Desde 1024 px, la columna de cobro acompaña el desplazamiento y los métodos de
pago tienen desplazamiento propio, conservando el total y las acciones de cobro.
En pantallas menores, una barra inferior muestra el total y **Ir al cobro**:
este acceso solo navega al formulario, nunca confirma la venta.

Salir por los enlaces de la cabecera con una venta sin guardar requiere
confirmación. Cancelar conserva el carrito. Iniciar otra venta también avisa si
hay contenido. La recuperación de un cobro incierto sigue usando el mismo
identificador persistido. Los enlaces dentro del POS conservan su estado.

Limitación existente: el carrito aún no confirmado no se guarda como borrador
automático al recargar/cerrar el navegador. La advertencia nueva cubre las
salidas mediante la cabecera y el botón Nueva venta, no el botón Atrás del
navegador ni el cierre de pestaña. Las ventas pendientes guardadas y los intentos
de cobro persistidos conservan su recuperación anterior.

## Pedidos del administrador

`/pedidos` usa los seis estados reales existentes; no se inventan estados de
preparación. Los filtros y el texto de búsqueda quedan en la URL y persisten al
recargar. El texto filtra exclusivamente la lista cargada, como indica su etiqueta;
no es una búsqueda global de todos los pedidos. Solo cambiar el estado solicita
otra lista al servidor; escribir el texto no dispara peticiones adicionales.
Se muestran carga, error y reintento sin hacer pasar datos anteriores por actuales.
Se conservan comprobantes, historial, reglas de transición y enlace al cobro POS.

## Revisión local y validación

Desde esta carpeta del repositorio, ejecutar `npm run preview:local`. Usa
PostgreSQL local desechable y datos sintéticos; no copiar `.env` de producción.

- Revisión y credenciales sintéticas: http://127.0.0.1:5180/revision-local
- Panel: http://127.0.0.1:5180/iniciar-sesion
- Tienda de prueba: http://127.0.0.1:5181

La nueva suite visual cubre siete grupos de escenarios: inicio por perfil,
acceso a las veinte herramientas, teclado/filtros, venta por escaneo con pago,
pedidos del cajero, almacén y conservación de la tienda. Captura escritorio,
tablet vertical/horizontal y móvil; ambos temas en las pantallas principales.

```powershell
node scripts/verify-panel-workspace-ui.mjs
node scripts/verify-pos-ui.mjs
node scripts/verify-inventory-ui.mjs
node scripts/verify-staff-system-ui.mjs
npm run build:all
git diff --check
```

Las cuatro suites usan bases locales aisladas, bloquean el tráfico del navegador
a hosts externos y conservan las evidencias de la entrega anterior en sus carpetas
originales. Las nuevas capturas/resultados están aquí:

- [Diseño y navegación](evidencia/resultados.json)
- [Regresión de ventas/caja](regresion-pos/resultados.json)
- [Regresión de inventario](regresion-inventario/resultados.json)
- [Regresión de personal](regresion-personal/resultados.json)
- [Inicio claro](evidencia/inicio-escritorio-light.png)
- [Herramientas en tablet oscuro](evidencia/herramientas-tablet-dark.png)
- [Venta en tablet horizontal](evidencia/venta-tablet-horizontal.png)
- [Venta en móvil](evidencia/venta-movil.png)

No se requieren cambios en la base ni en los orígenes CORS para publicar esta
interfaz. La publicación queda pendiente de revisión del diseño y autorización;
se usarán los mismos builds separados de tienda y panel. Si hubiera que revertir
solo esta mejora, restaurar el frontend integrado anterior; conservar siempre
la API con Kardex, las migraciones ya publicadas y todos los datos del negocio.
