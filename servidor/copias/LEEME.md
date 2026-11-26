# Copias de seguridad del portal

El portal guarda **datos personales** (candidatos, currículums, fotos, documentos). Sus datos viven en el
volumen de Docker `practicas-pbdata` (producción) y `pruebas-practicas-pbdata` (pruebas) del VPS. **No están
en GitHub**: sin copias, un fallo del servidor los pierde.

## Qué hay (en dos capas)

1. **Dentro de PocketBase** — la migración `pb_migrations/1763200000_copias_diarias.js` programa una copia
   cada día a las 3:00 y guarda las 7 últimas, en `/pb/pb_data/backups` (volumen del portal). Cada ZIP incluye
   la base de datos y los archivos subidos. Se activa al desplegar la migración.
2. **Fuera del contenedor y fuera del servidor** — `copiar-portal.sh`, un script para el host que copia el
   último ZIP a `/root/backups/portal/` y, si se indica `DESTINO_EXTERNO`, lo envía a otra máquina por SSH.

La capa 1 sola **no protege de un fallo del VPS**: las copias estarían en el mismo disco. La capa 2 con un
destino externo es la que lo cubre.

## Instalar la capa 2 (una vez, en el VPS)

```bash
mkdir -p /root/backups
cp servidor/copias/copiar-portal.sh /root/backups/copiar-portal.sh
chmod +x /root/backups/copiar-portal.sh
/root/backups/copiar-portal.sh            # prueba manual (necesita que la capa 1 ya haya hecho una copia)
crontab -e                                # añadir la línea de abajo
```

Línea de cron (a las 4:00, una hora después de la copia de PocketBase):

```
0 4 * * * DESTINO_EXTERNO="usuario@otra-maquina:/ruta/copias-portal" /root/backups/copiar-portal.sh >> /root/backups/backup-portal.log 2>&1
```

Sin `DESTINO_EXTERNO` solo copia dentro del propio servidor.

## Restaurar

1. Parar el contenedor del portal en Dokploy.
2. Descomprimir el ZIP elegido sobre el volumen (`/var/lib/docker/volumes/practicas-pbdata/_data/`),
   conservando la carpeta `storage`, o usar *Ajustes → Copias de seguridad → Restaurar* en el panel `/_/`.
3. Arrancar el contenedor y comprobar el acceso.

**Haz una restauración de prueba en el entorno de pruebas** antes de necesitarla de verdad.

## Copia fuera del servidor: Google Drive cifrado (activa desde el 26/11/2026)

- Cada noche a las 3:30 (hora del servidor, UTC) el cron de root ejecuta `/root/backups/subir-copias-drive.sh`.
- Sube las copias de los últimos 3 días al Drive de la **cuenta de Google de la gestoría**, carpeta `copias-servidor-portal-practicas`,
  **cifradas** con rclone (remoto `gdrive-cifrado`). En Drive se ven nombres y contenidos ilegibles. Se conservan 30 días.
- rclone solo tiene permiso sobre los archivos que sube él (permiso «drive.file»), no sobre el resto del Drive.
- Las **dos contraseñas del cifrado** están guardadas por la gestoría fuera del servidor. **Sin ellas las copias no se
  pueden abrir.** La configuración de rclone está en `/root/.config/rclone/rclone.conf` (solo root).
- Registro: `/root/backups/subir-copias-drive.log`.

### Recuperar una copia desde Drive

1. En el servidor (o en cualquier equipo con rclone configurado con la misma cuenta y las dos contraseñas):
   `rclone ls gdrive-cifrado:copias-servidor/portal-practicas` y
   `rclone copy "gdrive-cifrado:copias-servidor/portal-practicas/<copia>.zip" /root/restaurar/`
2. Seguir los pasos de «Restaurar» de arriba con ese ZIP.

Prueba hecha el 26/11/2026: se bajó la copia del día de Drive, era idéntica a la original, el ZIP estaba sano, la base
de datos pasó la comprobación de integridad y un portal temporal arrancó con ella (sin hooks, para no lanzar
recordatorios ni sincronizaciones). Conviene repetir esta prueba cada pocos meses.

## Pendiente de decidir

- Plazo de conservación de las copias, de acuerdo con la política de protección de datos
  (las copias también contienen datos de candidatos no seleccionados).
