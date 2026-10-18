# Preparación de publicación — 18 de octubre de 2026

El titular solicitó publicar el sistema integrado y después eligió **preparar
todo y acordar otro horario** para el corte de escrituras. No se publicó código,
no se ejecutaron migraciones en producción y no se cambiaron cuentas ni DNS.

## Comprobado

- Rama local `implementacion/sistema-personal-integrado`; implementación `f5290f8`.
- Sesiones de Render y Vercel disponibles al preparar; API Render `tecruta`,
  proyectos Vercel `tecruta` y `tecruta-panel`. No se accionó ningún despliegue.
- Main remoto conserva `57e106b`; historial de migraciones de Neon válido,
  sin migraciones fallidas. Los checksums históricos coinciden normalizando
  únicamente finales de línea CRLF/LF de Windows.
- Respaldo privado fuera de Git, en la carpeta de respaldos del titular.
  Restaurado en PostgreSQL Docker desechable, sin seeds ni operaciones comerciales.
- Sobre esa restauración se ejecutó `prisma migrate deploy` con las tres
  migraciones previstas. Se conservaron 148 productos, 10 888 unidades y el
  resumen de stock por producto; cero existencias negativas.
- Se conservaron identidad, alias, correo, hash de contraseña, Google ID y rol
  de las cuentas. Los cambios de seguridad previstos revocan sesiones del
  personal y códigos antiguos de recuperación y exigen cambiar contraseña.
- Kardex inicial: 148 saldos, cero diferencias, cero costos históricos
  inventados. Cero ventas POS y cero cajas generadas por la preparación.
- El mecanismo SQL de pausa se ensayó exclusivamente en la restauración:
  rechazó cambios de stock, altas/bajas de productos y escrituras de pedidos;
  las consultas y migraciones siguieron disponibles. Tras reanudar no quedaron
  disparadores temporales. El contenedor de restauración se eliminó.
- Se conservan los resultados previos de 45 pruebas de API, tres revisiones de
  interfaz, ambos builds y `git diff --check` del sistema integrado.

Los scripts de pausa/reanudación están en `scripts/deploy`. Son herramientas
operativas explícitas; no forman parte de las migraciones ni se ejecutan al
arrancar el servidor. No contienen credenciales y no se ejecutaron en Neon.

## Pendiente para el horario acordado

1. Revalidar accesos y versiones, comprobar que no hubo cambios posteriores y
   anunciar el corte de compras/cancelaciones/stock.
2. Aplicar pausa, tomar respaldo final nuevo y comprobarlo; migrar y desplegar
   API, panel y tienda siguiendo el [procedimiento](publicacion-recuperacion.md).
3. Verificar permisos y datos sin crear ventas ficticias y reabrir escrituras.
4. El titular cambiará su contraseña y creará los empleados reales. Las cuentas
   `adminlocal`, `cajerolocal` y `almacenlocal` nunca se copian a producción.

`admin.tecruta.com` sigue pendiente de DNS y no impide publicar en el panel
provisional. SUNAT requiere proveedor y credenciales reales; MFA requiere
configurar su clave cifradora antes de activarlo. No se configuraron ni se
simularon esas integraciones durante esta preparación.
