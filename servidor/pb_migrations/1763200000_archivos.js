/// <reference path="../pb_data/types.d.ts" />
// Archivos de las fichas (currículums, convenios, justificantes…). El portal guarda la ficha del
// documento en «registros» y el archivo en esta colección, que es privada: solo se abre con sesión
// y un enlace temporal (campo protegido).

migrate((app) => {
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const archivos = new Collection({
    type: "base",
    name: "archivos",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: ACTIVO,
    updateRule: null, // un archivo no se edita: se sube otro
    deleteRule: ACTIVO,
    fields: [
      { name: "docId", type: "text", max: 40 },
      { name: "candId", type: "text", max: 40 },
      {
        name: "archivo", type: "file", required: true, maxSelect: 1, maxSize: 15 * 1024 * 1024, protected: true,
        mimeTypes: [
          "application/pdf", "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/jpeg", "image/png",
        ],
      },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_archivos_doc ON archivos (docId)"],
  });
  app.save(archivos);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("archivos")); } catch (_) { /* no existe */ }
});
