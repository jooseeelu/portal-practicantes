/// <reference path="../pb_data/types.d.ts" />
// Copias de seguridad automáticas de PocketBase: cada día a las 3:00 (hora del servidor) y
// se guardan las 7 últimas. Cada copia es un ZIP con la base de datos y los archivos subidos
// (documentos, currículums, fotos) y queda en /pb/pb_data/backups, dentro del volumen del portal.
//
// IMPORTANTE: esa carpeta está en el MISMO servidor. Para estar a salvo de un fallo del VPS hay
// que copiar esos ZIP a otro sitio (ver servidor/copias/LEEME.md).
//
// Idempotente y respetuosa: si alguien ya programó sus propias copias desde el panel /_/, no las pisa.

migrate((app) => {
  const s = app.settings();
  if (!s.backups.cron) {
    // Mismo método que ya funciona en el CRM (migración «seguridad_limites_y_copias»).
    unmarshal({ backups: { cron: "0 3 * * *", cronMaxKeep: 7 } }, s);
    app.save(s);
    console.log("copias: programadas cada día a las 3:00, guardando las 7 últimas.");
  } else {
    console.log("copias: ya había una programación propia (" + s.backups.cron + "); no se toca.");
  }
}, (app) => {
  // No se desactivan solas al revertir: perder las copias por deshacer una migración sería peor.
  console.log("copias: la programación de copias no se quita automáticamente.");
});
