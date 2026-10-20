# Rediseño y reseñas verificadas

Rama `feature/rediseno-tienda-resenas`, desde `main` actualizado `7d14d11`. Entrega local: sin push, merge ni despliegue. No se leen archivos `.env`; PostgreSQL QA aislado mediante los helpers existentes.

## Decisiones de alcance

- Se conserva el orden del CMS y sus campañas reales. Una cuenta regresiva aparece únicamente con fecha de fin real; no se inventan ofertas, beneficios, reseñas ni políticas. Máximo tres diapositivas visibles.
- La excepción a «no tocar el panel» es exclusivamente la página ADMIN de moderación y la configuración comercial solicitadas. POS, caja y pedidos no cambian.
- La compra elegible es una línea de pedido web asociado a la cuenta CUSTOMER y actualmente DELIVERED. No se vinculan ventas anónimas ni POS retrospectivamente. Una reseña por cliente/producto, aunque vuelva a comprarlo. Una rechazada sigue ocupando esa compra y puede aprobarse posteriormente.
- La identidad pública usa nombre e inicial del apellido; no expone correo ni identificadores de compra/usuario. Los votos son de clientes autenticados, no del autor.
- Se conservan reseñas e invitaciones al retirar la función: recuperación mediante desactivar rutas/UI y volver al código compatible con las columnas adicionales. No se eliminan tablas.
- Las reseñas no introducen almacenamiento de tokens. La autenticación existente permitía recordarlos en localStorage; para cumplir el criterio explícito se limita ese helper a sessionStorage, sin cambiar endpoints, Google, roles ni emisión de tokens. Las sesiones persistentes anteriores deben iniciarse otra vez.

Las pruebas, configuración y resultados finales se documentan al completar cada fase.
