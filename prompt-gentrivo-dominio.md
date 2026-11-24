# Prompt: pasar Gentrivo a gentrivo.com

Copia y pega esto en una conversación nueva (desde este mismo ordenador, que tiene acceso por SSH al servidor):

---

Quiero pasar Gentrivo (mi app de fichajes) del dominio actual `gentrivo.gestoriainnova.com` (y `gentrivo-pruebas.gestoriainnova.com`) al dominio nuevo `gentrivo.com`. El dominio ya está comprado, pero NO en IONOS (donde está `gestoriainnova.com`), sino en **Hostinger**: los registros DNS los tendré que crear yo en el panel de Hostinger (hPanel → Dominios → DNS / Nameservers), así que dime exactamente cuáles (tipo, nombre, valor y TTL) y si hay que borrar los que Hostinger pone por defecto (p. ej. el registro A de «@» que apunta a su aparcamiento). Solo falta configurarlo (DNS si hace falta, nginx, HTTPS y la app). Hazlo con cuidado y sin perder datos.

Contexto técnico:
- Servidor: `31.70.139.85` (entro con `ssh root@31.70.139.85`, sin contraseña desde este equipo).
- Gentrivo corre en Docker: contenedores `gentrivo-api-1` (API, puerto interno 8787), `gentrivo-web-1` (web, publicada en `127.0.0.1:3100`), `gentrivo-gentrivo-db-1` (Postgres). Hay una copia de pruebas: `gentrivo-pruebas-*` (web en `127.0.0.1:3101`).
- Delante hay nginx: `/etc/nginx/sites-enabled/gentrivo.gestoriainnova.com` (y el de pruebas) con `proxy_pass http://127.0.0.1:3100`. La API se sirve en `/api` del mismo dominio.
- La API usa la variable de entorno `APP_URL` (hoy `https://gentrivo.gestoriainnova.com`) para los enlaces de los correos (invitaciones, recuperar contraseña). Revisa también `CORS_ORIGINS`.
- El portal de prácticas (otro servidor, Dokploy en `212.227.178.103`) lee Gentrivo con la variable `GENTRIVO_URL` (por defecto `https://gentrivo.gestoriainnova.com/api`) usando un usuario de servicio de solo lectura. Usa `/auth/login`, `/users`, `/users/:id/schedule` y `/reports/person` (para las faltas de los practicantes). Gracias a la redirección seguirá funcionando, pero lo correcto es cambiar `GENTRIVO_URL` en Dokploy (app `practicas`) a `https://gentrivo.com/api` y redesplegar; si desde aquí no tienes acceso a Dokploy, dímelo y lo hago desde la conversación del portal.
- Gentrivo tiene notificaciones push (`/push/...`): las suscripciones del navegador van ligadas al dominio, así que en el dominio nuevo cada persona tendrá que volver a permitirlas.

Pasos que espero:
1. Comprobar el DNS de `gentrivo.com` (y `www`, y `pruebas` si se usa) apuntando a `31.70.139.85`; si no, decirme exactamente qué registros crear en el panel donde compré el dominio (tipo, nombre y valor).
2. Copia de seguridad de la base de datos (pg_dump) antes de tocar nada, y decirme dónde queda.
3. Nuevo bloque de nginx para `gentrivo.com` (y decidir `pruebas.gentrivo.com` para la copia de pruebas), certificado HTTPS con certbot.
4. Cambiar `APP_URL` (y CORS si aplica) de la API y reiniciar solo lo necesario.
5. Dejar `gentrivo.gestoriainnova.com` redirigiendo al dominio nuevo para que los enlaces y códigos QR ya impresos sigan funcionando: 301 para la web y 308 para `/api` (el 308 conserva el POST; con un 301 el inicio de sesión de las apps que llaman a la API fallaría).
6. Revisar si los QR de fichaje llevan la dirección escrita y, si es así, decirme si conviene reimprimirlos.
7. Avisarme de lo que notará la gente: volver a iniciar sesión, reinstalar la app en el móvil desde el dominio nuevo y volver a permitir las notificaciones.
8. Cambiar `GENTRIVO_URL` del portal de prácticas y comprobar que los horarios y las faltas se siguen viendo.
9. Comprobar al final que `https://gentrivo.com` carga, que el inicio de sesión responde y que la API contesta en `/api/health`. No generes fichajes de prueba.

No imprimas contraseñas ni valores de variables secretas; pídeme confirmación antes de reiniciar servicios en producción.
