/// <reference path="../pb_data/types.d.ts" />
// Chat interno del equipo: un único canal con mensajes cortos. Cada mensaje guarda quién lo escribió.
// Solo lo ve el equipo con sesión activa; cada uno puede borrar los suyos (y un administrador, cualquiera).
// Idempotente: si la colección ya existe no se toca.
migrate((app) => {
  try { app.findCollectionByNameOrId("chat"); return; } catch (_) { /* se crea */ }
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const users = app.findCollectionByNameOrId("users");
  const chat = new Collection({
    type: "base",
    name: "chat",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: ACTIVO + ` && autor = @request.auth.id`,
    updateRule: null,
    deleteRule: ACTIVO + ` && (autor = @request.auth.id || @request.auth.rol = "admin")`,
    fields: [
      { name: "autor", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: false },
      { name: "nombre", type: "text", max: 120 },
      { name: "texto", type: "text", required: true, max: 4000 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_chat_created ON chat (created)"],
  });
  app.save(chat);
}, (app) => { /* no se borra: contiene los mensajes */ });
