#!/bin/bash
# Copia, FUERA del contenedor, las copias de seguridad que PocketBase genera cada día a las 3:00
# (migración 1763200000_copias_diarias.js), y opcionalmente las envía a otra máquina.
#
# Se ejecuta en el host del VPS (no dentro de Docker), por ejemplo con cron a las 4:00:
#   0 4 * * * /root/backups/copiar-portal.sh >> /root/backups/backup-portal.log 2>&1
#
# Variables opcionales (se pueden poner delante del comando en el cron):
#   DESTINO_EXTERNO="usuario@otra-maquina:/ruta/copias-portal"   → además envía las copias por rsync + SSH
#   DIAS_A_CONSERVAR=30                                           → cuántos días se guardan aquí (por defecto 30)
set -u

DESTINO="/root/backups/portal"
DIAS="${DIAS_A_CONSERVAR:-30}"
ERRORES=0
FECHA=$(date '+%Y-%m-%d %H:%M')

for ENTORNO in practicas pruebas-practicas; do
  ORIGEN="/var/lib/docker/volumes/${ENTORNO}-pbdata/_data/backups"
  ULTIMA=$(ls -t "$ORIGEN"/*.zip 2>/dev/null | head -n 1)
  if [ -z "$ULTIMA" ]; then
    echo "[$FECHA] AVISO: no hay copias de PocketBase en $ORIGEN (¿está desplegada la migración de copias?)"
    ERRORES=1
    continue
  fi
  # Una copia vacía o casi vacía es una copia rota
  if [ "$(stat -c %s "$ULTIMA")" -lt 10000 ]; then
    echo "[$FECHA] ERROR: la copia $ULTIMA pesa demasiado poco; no se usa."
    ERRORES=1
    continue
  fi
  mkdir -p "$DESTINO/$ENTORNO"
  cp -n "$ULTIMA" "$DESTINO/$ENTORNO/" && echo "[$FECHA] OK $ENTORNO: $(basename "$ULTIMA")"
  find "$DESTINO/$ENTORNO" -name '*.zip' -mtime +"$DIAS" -delete
done

# Copia fuera del servidor (si se ha configurado). Nunca borra nada en el destino.
if [ -n "${DESTINO_EXTERNO:-}" ]; then
  if rsync -a -e "ssh -o BatchMode=yes -o ConnectTimeout=20" "$DESTINO/" "$DESTINO_EXTERNO/"; then
    echo "[$FECHA] OK copia enviada a $DESTINO_EXTERNO"
  else
    echo "[$FECHA] ERROR: no se pudo enviar la copia a $DESTINO_EXTERNO"
    ERRORES=1
  fi
fi

exit "$ERRORES"
