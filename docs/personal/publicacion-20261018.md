# Sistema integrado publicado — 18 de octubre de 2026

Autorización: el titular confirmó «esta ahora si publica todo», después de haber
pospuesto la ventana. Se publicó la revisión funcional
`972628acddcb2da8a6390b28d4d1e1cbe9cc0ae2` en main, sin cambiar DNS ni proveedor.

## Acceso real

- Tienda: https://www.tecruta.com
- Panel: https://tecruta-panel.vercel.app/iniciar-sesion
- Usuarios del personal: `/usuarios`; auditoría: `/auditoria`.
- Inventario/Kardex: `/inventario`; ventas: `/pos`; caja: `/pos/caja`.
- Seguridad: `/seguridad`. La cuenta principal existente conserva su alias.

El acceso del personal usa usuario y contraseña, sin Google. Se comprobó el
inicio de sesión de la cuenta principal existente y la conservación de ADMIN.
La migración exige cambiar su contraseña antes de operar: no se cambió por el
titular ni se omitió esa protección. La API devuelve `PASSWORD_CHANGE_REQUIRED`
en personal, inventario y caja mientras ese cambio esté pendiente.

El titular debe completar ese cambio con una contraseña nueva de al menos
12 caracteres, iniciar sesión otra vez y crear los trabajadores reales. No
utilizar credenciales locales en la web publicada. No se creó ningún empleado
real ni se asignaron nuevos permisos a otras cuentas durante el despliegue.

## Despliegues y base

| Servicio | Despliegue verificado | Estado |
| --- | --- | --- |
| API Render | `dep-dbakj1e1egvs73b2sdn0` | Live; revisión `972628a`, configuración MFA incluida |
| Panel Vercel | `HS2bh7q24tap5poqsPQYzfp7Pdb6` | Listo; producción `972628a` |
| Tienda Vercel | `2ZZ4Rrz7ZTRJGM8APuEgdzdXTRsS` | Listo; producción `972628a` |

Se aplicaron únicamente las migraciones preparadas de inventario, POS y
seguridad de personal. El alias ya aplicado no se repitió. No se ejecutaron
seeds, `db push`, resets ni pruebas comerciales sobre la base real.

El primer despliegue de API fue `dep-dbakhq5g1s2s73cfbek0`; el siguiente reinició
el mismo código con la clave cifradora MFA, sin nuevas migraciones.

Se pausaron las escrituras en PostgreSQL con disparadores temporales, se tomó
un respaldo final privado y se comprobó su restauración local antes de migrar.
Se conservaron 148 productos, 10 888 unidades, 6 pedidos y 3 cuentas; coincidieron
el resumen de stock por producto y el contenido de los pedidos. El Kardex
registró 148 saldos iniciales, cero diferencias y ningún costo inventado.

Una primera conexión del CLI a Neon falló antes de migrar; el reintento validó
el historial y completó las tres migraciones. No se marcaron migraciones a
ciegas ni se modificó SQL histórico para eludir el fallo.

La API compatible se verificó antes de retirar los cuatro disparadores
temporales. Las escrituras se reabrieron a las **17:33, America/Lima**. No quedaron
migraciones incompletas ni bloqueos de corte. La comprobación posterior registró
cero ventas POS, cajas o usuarios QA.

Se guardaron el respaldo final, su comprobación, las instantáneas y el registro
operativo fuera de Git, en la carpeta privada de respaldos del titular. No se
incluyen contraseñas, hashes, tokens ni conexiones en esta documentación.

## Validación y límites

- Ambos builds repetidos antes del corte; `git diff --check` correcto.
- Las 45 pruebas de API y las revisiones de interfaz previas se ejecutaron
  sobre PostgreSQL local desechable, no sobre producción.
- API health, tienda y panel responden HTTP 200; health identifica `972628a`.
- CORS permite los dos orígenes concretos y no permite `https://example.com`.
- Personal, inventario y caja rechazan peticiones anónimas con 401.
- Acceso real mediante navegador y API; cambio obligatorio comprobado en ambos.
- No se crearon ventas, movimientos comerciales, pagos o documentos ficticios
  para probar producción. Su operación completa se ensayó localmente.
- Clave cifradora MFA generada aleatoriamente, respaldada fuera de Git y
  configurada en Render. No se activó MFA por el titular ni se generaron sus
  códigos de respaldo: debe hacerlo él desde Seguridad después de cambiar su
  contraseña. Se conserva el resto de secretos del servicio.
- DNS `admin.tecruta.com`, proveedor SUNAT, prueba física de impresora/lectora y
  entrega real de correo siguen pendientes. El ticket interno no es fiscal.

Datos comprobados: [resumen sin datos personales](publicacion/verificacion-datos.json).
Evidencia: [cambio obligatorio](publicacion/cambio-obligatorio.png),
[tienda publicada](publicacion/tienda-publicada.png).

## Recuperación

Desde este despliegue no volver a la API antigua que no registra Kardex.
Corregir hacia adelante preservando todas las ventas, pedidos y movimientos
posteriores. No restaurar el respaldo final sobre operaciones nuevas. La
restauración, si fuese necesaria, se hace en una base aislada y se concilian
las escrituras posteriores antes de cualquier cambio de conexión.

Conservar la clave cifradora MFA junto con los respaldos protegidos; perderla
impide descifrar los factores configurados. No reutilizar el SQL de pausa en
otro mantenimiento sin comprobar también las nuevas tablas de POS/caja: estos
scripts fueron preparados específicamente para el corte desde la API antigua.
