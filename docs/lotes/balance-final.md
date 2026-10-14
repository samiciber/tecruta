# Balance de los lotes autorizados 0–9

Se completó la entrega en ramas/PR, sin integrar en `main` ni desplegar.
Los resultados siguientes describen el código propuesto y sus pruebas locales;
no certifican que producción ya tenga las correcciones. Base más reciente:
`60917ed`, que incluye los círculos de categorías de la Home recibidos de otro
proceso. No se modificaron los archivos reservados a Claude.

| Lote | Entrega | Resultado |
| --- | --- | --- |
| 0 | [PR #1](https://github.com/samiciber/tecruta/pull/1) | Diagnóstico H01/H12, inventario corregido y plan de limpieza del historial sin ejecutar. |
| 1 | [PR #2](https://github.com/samiciber/tecruta/pull/2) | H19/H22/H23/H28/H29/H34 y resumen checkout de H33; manejo de respaldo en detalle (parte de H18). |
| 2 | [PR #3](https://github.com/samiciber/tecruta/pull/3) | H12: migración de navegación/guardados probada de cero y sobre historial previo; guía de producción con respaldo y revisión manual. |
| 3 | [PR #4](https://github.com/samiciber/tecruta/pull/4) | H07–H11: propiedad/capability, archivos/límites, stock atómico, idempotencia, confirmación y transiciones. |
| 4 | [PR #5](https://github.com/samiciber/tecruta/pull/5) | H02–H06/H16/H17: OAuth y códigos con hash/caducidad, intercambio breve, revocación y sesión temporal/recuperable. Cookies de sesión solo propuestas por escrito, según el alcance. |
| 5 | [PR #6](https://github.com/samiciber/tecruta/pull/6) | H13/H31 corregidos; H14/H32 parciales: dependencias, CSP/Helmet/proxy y placeholders seguros. |
| 6 | [PR #7](https://github.com/samiciber/tecruta/pull/7) | H15 y sincronización de marca en endpoints legados de H21; transacciones y validación probadas. |
| 7 | [PR #8](https://github.com/samiciber/tecruta/pull/8) | H18/H20: productos/pagos con revalidación real; respaldo para consulta, compras bloqueadas sin datos verificados y revisión explícita del carrito. |
| 8 | [PR #9](https://github.com/samiciber/tecruta/pull/9) | H30: tres módulos sin uso retirados con verificación de imports; datos estáticos activos conservados. |
| 9 | [Detalle del lote](lote-9.md) | H35: comprobante autenticado y eventos reales del propietario; comprobaciones IDOR y de cambio de cuenta. |

Las pruebas incluyen builds, navegador en seis anchos y dos temas para cambios
visuales, pruebas pequeñas y PostgreSQL desechable para las escrituras. Los
documentos de cada PR contienen su evidencia y limitaciones. Hay resoluciones
preparadas de conflictos entre lotes; no se ha validado un único despliegue con
todos los PR y proveedores reales. No hay registros de QA creados en producción.

## Pendiente dentro de hallazgos parcialmente tratados

- **H01:** confirmar rotación/revocación de la clave histórica de Resend y el
  secreto OAuth de Google. No se usaron para comprobar vigencia. La limpieza de
  historial solo tiene un plan: las reglas actuales prohíben force-push y esa
  publicación requiere una autorización distinta. Los demás literales detectados
  eran plantillas, no credenciales operativas confirmadas.
- **H14:** cinco avisos altos de la cadena de desarrollo Tailwind 3/braces y
  transitivas siguen sin una actualización compatible disponible en las pruebas
  del Lote 5. Tailwind 4 necesita una migración visual aparte. La auditoría de
  dependencias de producción con `--omit=dev` no tenía avisos en ambos proyectos
  después de las actualizaciones propuestas.
- **H21:** asignación masiva y renombrado de marcas en `adminContent.routes.js`
  requieren coordinación con Claude; los endpoints legados sí sincronizan
  nombre/ID. No se barrió ni corrigió catálogo existente.
- **H30:** deduplicar/generar las representaciones estáticas de productos que
  aún tienen importadores. No se elimina respaldo activo como parte de la limpieza.
- **H32:** normalizar enlaces editables (`//` y `/\\`) en `navSchemas.js` después
  de coordinar el Cambio 5; cabeceras y proxy sí se prepararon en los lotes previos.
- **H33:** el resumen checkout/cart se corrigió; la promesa de envío del
  componente reservado `GuestStrip` requiere coordinación y definición comercial.
- **H35:** compras de invitado siguen sin vinculación a cuentas. Las rutas de
  TecRuta autorizan las lecturas, pero no convierten activos públicos antiguos de
  Cloudinary en privados.

## Fuera de estos lotes y comprobaciones pendientes

H24 (referencia del banner) y H25 (reasignación de categorías/imágenes) son datos
del admin: no se escribieron ni se verificó su corrección actual. H26, rendimiento
de la Home, está reservado al otro proceso; H27, SEO, y suscripciones por email
se dejaron expresamente para otra fase. No se amplía automáticamente el trabajo
a nuevos lotes.

Antes de producción corresponde revisar/integrar los PR y sus resoluciones,
comprobar la combinación final, revisar el estado real de migraciones y respaldar
la base. `migrate status` y el diff vacío compartidos por el propietario no
autorizan aplicar DDL nuevo a ciegas: el Lote 2 documenta cómo comparar estructura
e historial y decidir `resolve` o `deploy`. No se ejecutó nada de eso contra Neon.

Las pruebas autenticadas de producción descritas anteriormente no se presentan
como ejecutadas: estos lotes usaron sesiones/datos sintéticos y proveedores
simulados. No se añaden hallazgos H36+ ni IDs de registros reales inventados.
