/// <reference path="../pb_data/types.d.ts" />
// Fotos de los candidatos como archivo (antes iban dentro de la ficha en texto base64 y se descargaban
// enteras con cada actualización). Una fila por candidato, con el fichero PROTEGIDO: solo lo ve el equipo
// con sesión. Nadie escribe aquí desde la web: lo hace el servidor (pb_hooks/fotos.js) cuando una ficha
// llega con una foto nueva. Idempotente; al revertir NO se borra (se perderían las fotos).
migrate((app) => {
  try { app.findCollectionByNameOrId("fotos"); return; } catch (_) { /* no existe: se crea */ }
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const fotos = new Collection({
    type: "base",
    name: "fotos",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "candId", type: "text", required: true, max: 40 },
      { name: "huella", type: "text", max: 80 },
      { name: "archivo", type: "file", required: true, maxSelect: 1, maxSize: 3 * 1024 * 1024, protected: true, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_fotos_cand ON fotos (candId)"],
  });
  app.save(fotos);
}, (app) => { /* no se borra: contiene las fotos */ });
