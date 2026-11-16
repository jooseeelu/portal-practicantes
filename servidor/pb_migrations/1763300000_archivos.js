/// <reference path="../pb_data/types.d.ts" />
// Archivos de verdad (currículums, convenios, anexos…): colección «archivos» con el fichero PROTEGIDO.
// Un archivo protegido no se puede abrir con el enlace directo: hace falta sesión del equipo y un
// token temporal (lo pide el portal al abrirlo o descargarlo), igual que en el CRM.
// Los datos de la ficha (nombre visible, tipo, fecha) siguen en «registros» (tipo «documentos»);
// aquí solo vive el fichero, enlazado por su id.
// Idempotente: si la colección ya existe no se toca. Al revertir NO se borra (se perderían los archivos).

migrate((app) => {
  try { app.findCollectionByNameOrId("archivos"); console.log("archivos: la colección ya existía; no se toca."); return; } catch (_) { /* no existe: se crea */ }

  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const users = app.findCollectionByNameOrId("users");

  const archivos = new Collection({
    type: "base",
    name: "archivos",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: ACTIVO,
    updateRule: ACTIVO,
    deleteRule: ACTIVO,
    fields: [
      { name: "candId", type: "text", required: true, max: 40 },
      { name: "nombre", type: "text", required: true, max: 255 },
      { name: "tipo", type: "text", max: 40 },
      {
        name: "archivo", type: "file", required: true, maxSelect: 1, maxSize: 20 * 1024 * 1024, protected: true,
        mimeTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"],
      },
      { name: "subidoPor", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_archivos_cand ON archivos (candId)"],
  });
  app.save(archivos);
  console.log("archivos: colección creada (ficheros protegidos, solo para el equipo).");
}, (app) => {
  console.log("archivos: la colección no se borra automáticamente (contiene los documentos).");
});
