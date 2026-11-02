# Publicación del carrusel: 2 de noviembre de 2026

Autorización: «revisa y publica». Código funcional publicado:
`ef52d4450aa2ed5c8a6b0e1688569d56fde6ccdd`, rama
`fix/hero-hasta-30-diapositivas`. El commit documental posterior no modifica
los artefactos publicados.

Se usaron las herramientas conectadas de Vercel, verificando equipo, proyectos,
repositorio `samiciber/tecruta`, SHA y destino producción. Ambos despliegues
terminaron **READY**, con los dominios existentes asignados al nuevo código.

| Servicio | Despliegue | Build | Resultado |
| --- | --- | --- | --- |
| Tienda: https://www.tecruta.com | `dpl_6Hs76WVHbRWh2EfdQGiet7KWwm91` | `npm run build:store`, `dist`, Vite | READY / production, 26 s |
| Panel: https://tecruta-panel.vercel.app | `dpl_EZCasCF5wxFjwtyJ2uXKGrrmw239` | `npm run build:panel`, `dist-panel`, Vite | READY / production, 23 s |
| API: https://tecruta.onrender.com | Conserva `6e09ef1bf8a6e8148075da01cf74643bfb9c5ef8` | Sin nuevo despliegue | Rutas públicas correctas |

Se preservaron variables de producción, dominios, DNS y base de datos. No hubo
migraciones, semillas, cambios de cuentas, banners, pedidos, ventas o stock.
La API existente ya admite 30 banners y no necesita desplegarse para este ajuste.

## Comprobación

- 61 pruebas unitarias correctas y ambos builds locales correctos.
- Seis escenarios de marcado de componentes con datos sintéticos: 0, 1, 3,
  12 y 30 imágenes y 30 videos; solo el video activo recibe `src`.
- ESLint sin errores, cinco advertencias anteriores; `git diff --check` limpio.
- HTTP 200 de tienda, login del panel, Home, catálogo y footer.
- La API devuelve los seis Hero ya guardados. No se añadieron banners de prueba.
- El recurso público `Home-Dda9Jb34.js` ya no contiene `.slice(0,3)`; contiene el
  contador compacto. El recurso del panel `AdminBanners-BW12HwNL.js` contiene
  la ayuda para más de diez banners y el límite total de treinta.
- Panel conserva `noindex, nofollow, noarchive` y `private, no-store`.
  CSP de ambos sitios conserva `media-src 'self' https: blob:`.
- Personal sin sesión responde 401, como corresponde.
- Consulta de logs de ejecución de Vercel en producción, niveles error/fatal,
  ventana de cinco minutos: sin registros devueltos en ambos proyectos. Esto
  no comprueba errores de JavaScript en los navegadores de clientes. No se
  configuró ni verificó un receptor externo de monitoreo.

## Límite de revisión visual

El acceso de navegador sigue sin estar disponible (`browser access host is
unavailable`; el canal nativo también está desconectado). No hay capturas nuevas
ni se declara comprobada la interacción visual o reproducción real de video.
La comprobación del código y las respuestas HTTP no sustituye esa revisión.

## Recuperación

Versiones anteriores conservadas en Vercel: tienda
`dpl_JEF1YFpUW1NnrfSBnnXsp55GJeku`, panel
`dpl_HpYQtWdcqXZGo9kqJ1Q3ZyJs7PDD`. Si se necesita revertir, utilizar esos
artefactos compatibles, preservando los datos. Una reversión vuelve a mostrar
solo tres diapositivas, pero no borra los demás banners. No restaurar una base
antigua sobre ventas posteriores ni modificar la API por este cambio visual.
