/// <reference path="../pb_data/types.d.ts" />
// «borrados»: una fila por cada ficha eliminada de «registros» (la escribe el servidor). Sirve para que cada
// navegador, al pedir solo lo que ha cambiado desde la última vez, se entere también de lo que otros han borrado.
// Solo guarda el identificador, el tipo y la clave (nada de datos personales). Se limpia sola a los 90 días.
migrate((app) => {
  try { app.findCollectionByNameOrId("borrados"); return; } catch (_) { /* no existe: se crea */ }
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const c = new Collection({
    type: "base",
    name: "borrados",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "registro", type: "text", required: true, max: 40 },
      { name: "tipo", type: "text", max: 40 },
      { name: "clave", type: "text", max: 80 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_borrados_created ON borrados (created)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("borrados")); } catch (_) { /* no existe */ }
});
