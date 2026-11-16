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

## Pendiente de decidir

- Destino externo de las copias (otro VPS propio, un ordenador de la oficina…).
- Plazo de conservación de las copias, de acuerdo con la política de protección de datos
  (las copias también contienen datos de candidatos no seleccionados).
