# Publicación del acceso al panel — 18 de octubre de 2026

Publicación autorizada expresamente después de entregar la corrección para
revisión. Código funcional publicado: `def282d06d0575678aeec33004a25ce64d0a002a`.
Se mantiene la separación compatible con la base existente; inventario, POS y
caja continúan en sus ramas y no se incluyeron en esta publicación.

## Cuenta solicitada

Se creó la cuenta real solicitada con alias de acceso `ADMIN1234`, rol ADMIN y
el correo de recuperación indicado por el titular en la conversación. El correo
está asociado a la misma cuenta; el formulario permite ingresar mediante alias.
Se conservan las cuentas ADMIN anteriores. No se publican aquí correo personal,
contraseña, hashes, tokens, identificadores privados ni archivos de respaldo.
La contraseña temporal solicitada se guardó únicamente como hash bcrypt.
El titular puede cambiarla mediante «Recuperar contraseña» en el panel. No se
envió un correo de recuperación ni se verificó su recepción durante la publicación.

## Despliegues verificados

| Servicio | Versión / despliegue | Resultado |
| --- | --- | --- |
| API Render | `dep-dbage0tg1s2s73c0vevg` | Live; commit `def282d` |
| Panel Vercel | `25xeTKBTY7ngHsqeFQPVaDmLUPpC` | Ready; commit `def282d` |
| Tienda Vercel | `3C3nZ4psi8FEpUdEY6pjMdKjKKZ8` | Ready; commit `def282d` |

- Panel: https://tecruta-panel.vercel.app/iniciar-sesion
- Tienda: https://www.tecruta.com
- API: https://tecruta.onrender.com
- `admin.tecruta.com` continúa pendiente de DNS. No se cambió DNS ni proveedor.

Se añadió `PANEL_ORIGIN=https://tecruta-panel.vercel.app` en Render sin cambiar
secretos existentes, conservando CORS de los orígenes autorizados. Render conserva
el despliegue automático desactivado; se desplegó manualmente el commit de main.
Vercel publicó ambos proyectos desde main con sus builds respectivos.

## Base y respaldo

Se contrastó el historial: la única migración pendiente era
`20261018000000_admin_login_alias`. Se generó un respaldo privado fuera de Git,
se restauró en PostgreSQL local desechable y se comprobó que la migración
preservaba todas las filas de usuarios y las existencias. Esa restauración no
ejecutó seeds ni creó ventas o pedidos.

La migración se aplicó a producción mediante Prisma 5 fijado por el proyecto y
conexión directa al mismo PostgreSQL Neon, con tiempos de espera acotados para
los bloqueos. La conexión agrupada de la aplicación se conservó. No se aplicaron
migraciones de inventario, POS o caja. No hubo modo mantenimiento.

Las comprobaciones anteriores y posteriores conservaron 148 productos y 10 888
unidades; coincidió el resumen de stock por producto. Se creó únicamente la
cuenta administrativa pedida. Los respaldos y los detalles operativos privados
se conservan fuera del repositorio en la carpeta de respaldos del usuario.

## Comprobaciones efectuadas

- Repetidas antes de publicar: 12 pruebas locales de acceso/separación correctas;
  ambos builds correctos y `git diff --check` correcto. La entrega anterior ya
  documenta las 25 pruebas de autenticación y las capturas de regresión local.
- En producción, inicio por alias HTTP 200; correo de recuperación asociado
  correctamente y rol ADMIN; `/api/auth/me` y `/api/admin/dashboard` HTTP 200.
  El dashboard sin sesión devuelve 401. La respuesta CORS permite el origen
  exacto del panel.
- Ingreso real mediante navegador con la cuenta solicitada, navegación
  administrativa visible y sesión conservada tras recargar.
- API health, panel y tienda públicos devuelven HTTP 200. No se crearon pedidos,
  ventas ni documentos reales durante estas comprobaciones.
- El botón Google ya se muestra en el panel publicado. La comprobación real de
  Google se detuvo al no autorizarse el acceso del navegador a
  `accounts.google.com`; no se intentó eludir ese bloqueo. Sus flujos de retorno,
  permisos y protección se validaron con sustitutos locales en la entrega.
- No se verificó la entrega real del proveedor de correo. El correo asignado es
  el indicado por el titular; no se realizó una prueba de posesión del buzón.

Evidencia pública, sin credenciales: [login publicado](publicacion/login-publicado.png).

## Recuperación

Ante un fallo de código, volver a los despliegues anteriores de `fae9594`,
conservando la columna aditiva `adminUsername`, la cuenta solicitada y todas las
escrituras del negocio. El backend anterior ignora la columna extra; permite el
correo y contraseña y conserva Google de tienda. No restaurar un respaldo sobre
pedidos nuevos ni borrar registros para revertir código. Los IDs de los
despliegues previos están disponibles en el historial de cada proveedor.
