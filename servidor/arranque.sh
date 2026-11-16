#!/bin/sh
# Arranque del portal: PocketBase sirve la API y la web (pb_public) en el puerto 80.
set -e

# Superusuario del panel técnico de PocketBase (/_/). Mismas credenciales que el
# primer administrador del portal; se definen en Dokploy, nunca en el repositorio.
if [ -n "$PORTAL_ADMIN_EMAIL" ] && [ -n "$PORTAL_ADMIN_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PORTAL_ADMIN_EMAIL" "$PORTAL_ADMIN_PASSWORD" --dir=/pb/pb_data >/dev/null 2>&1 \
    || echo "Aviso: no se pudo crear el superusuario de PocketBase"
fi

exec /pb/pocketbase serve \
  --http=0.0.0.0:80 \
  --dir=/pb/pb_data \
  --publicDir=/pb/pb_public \
  --hooksDir=/pb/pb_hooks \
  --migrationsDir=/pb/pb_migrations
