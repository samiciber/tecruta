# Contraseñas asignadas por el administrador

Estado: preparado localmente en `feature/panel-credenciales-administradas`.
No publicado. Esta actualización sustituye las instrucciones históricas sobre
contraseñas temporales para las nuevas altas y restablecimientos del personal.

## Uso

1. Un ADMIN abre **Más → Usuarios y permisos** (`/usuarios`), crea la cuenta
   individual y asigna una contraseña. Puede generar una aleatoria de 24 caracteres.
2. Entrega usuario y contraseña por un canal privado. El trabajador ingresa
   directamente: no debe cambiarla al primer acceso y la contraseña asignada no
   caduca a las 24 horas. Las sesiones mantienen sus vencimientos existentes.
3. Cajeros, almaceneros y administradores adicionales no pueden cambiar su propia
   contraseña. `/seguridad` explica cómo contactar al administrador; la API también
   rechaza el cambio aunque se intente fuera de la interfaz.
4. Ante olvido, un ADMIN verifica la identidad y utiliza **Restablecer contraseña**,
   con una contraseña nueva y un motivo. Las sesiones anteriores se revocan y la
   contraseña antigua deja de funcionar. El administrador no puede consultar el
   hash como contraseña ni recuperar la anterior.

La contraseña asignada debe tener entre 12 y 72 caracteres, no superar 72 bytes
UTF-8 y combinar al menos tres tipos entre mayúsculas, minúsculas, números y
símbolos. No admite espacios al principio/final ni caracteres de control. Debe
ser diferente del usuario; en un restablecimiento también de la clave anterior.
No se guardan contraseñas en respuestas, auditoría ni documentación.

El **administrador principal habilitado para recuperación** conserva su cambio
propio, recuperación por correo y segundo factor existentes. Esta excepción evita
depender de otro administrador para recuperar el control. Ningún administrador
puede restablecerse a sí mismo desde la gestión de personal. No se cambian las
cuentas existentes, sus roles, sus correos ni el acceso de clientes de la tienda.

## Compatibilidad y publicación pendiente

- No requiere migraciones ni cambios de esquema. No se modificaron cuentas reales.
- API: las altas y restablecimientos aceptan `password`; durante la transición
  también aceptan el campo anterior `temporaryPassword`, con la misma política
  nueva. Debe enviarse exactamente uno. Los restablecimientos requieren `reason`.
- Las credenciales antiguas pendientes de cambio o caducadas no se activan
  silenciosamente. Un ADMIN debe asignarles una nueva contraseña mediante el
  restablecimiento. Una cuenta con cambio pendiente recibe
  `PASSWORD_RESET_REQUIRED` al intentar operar. Una temporal caducada sigue
  rechazándose en el inicio de sesión.
- Publicar primero API y después panel, una vez revisado el conjunto. El panel
  anterior seguirá pudiendo enviar el campo legado, aunque mostrará instrucciones
  antiguas hasta actualizarse. No publicar únicamente el panel nuevo sobre la API
  antigua, que no admite `password` y todavía exige cambios temporales.
- Mantener las comprobaciones y respaldos del procedimiento de publicación
  existente. Este cambio no necesita apagar compras ni modificar inventario.

## Recuperación de la publicación

Conservar la versión anterior de API y panel para revertir ambas juntas. No
restaurar la base de datos para deshacer esta interfaz: se perderían operaciones
posteriores y auditoría. Las contraseñas asignadas permanecen como hashes válidos.
La versión anterior volvería a exigir cambio al crear/restablecer credenciales;
documentar esa diferencia si se revierte. Nunca intentar recuperar contraseñas
anteriores ni borrar auditoría. La cuenta principal conserva su recuperación.

## Comprobaciones

Las pruebas usan datos sintéticos y PostgreSQL local desechable: creación y
acceso directo por perfil; rechazo de claves débiles y solicitudes ambiguas;
denegación de cambio propio por las dos APIs; permisos de administración;
restablecimiento con revocación y rechazo de la clave anterior; cuentas heredadas;
recuperación del titular y de clientes; cambio propio del titular y MFA existente.
También se ejecutan las suites actuales de inventario, POS, reseñas, correo,
búsqueda y video para comprobar regresiones, además de los dos builds, lint,
sintaxis y `git diff --check`.

Resultado del 30 de octubre de 2026: **61/61 pruebas unitarias y 78/78 de
integración correctas**, builds de tienda y panel correctos, sintaxis de 102
archivos correcta y `git diff --check` limpio. ESLint terminó sin errores, con
cinco advertencias existentes por comentarios deshabilitadores sin efecto.
Se actualizó el guion `scripts/verify-staff-system-ui.mjs` para revisar el acceso
directo y restablecimiento; todavía no se ejecutó su recorrido de navegador.

La revisión visual en navegador sigue pendiente: el control del navegador no está
disponible en esta sesión. No se presentan capturas ni reproducción manual como
comprobadas. La validación automatizada no envía correos ni opera sobre producción.
