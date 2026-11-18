/// <reference path="../pb_data/types.d.ts" />
// Chat del equipo: responder a un mensaje concreto (campo «respuesta» con el id del mensaje citado)
// y «visto por» (colección chat_visto: una fila por persona con el último mensaje que ha visto). Idempotente.
migrate((app) => {
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const chat = app.findCollectionByNameOrId("chat");
  if (!chat.fields.getByName("respuesta")) { chat.fields.add(new TextField({ name: "respuesta", max: 20 })); app.save(chat); }
  try { app.findCollectionByNameOrId("chat_visto"); return; } catch (_) { /* se crea */ }
  const users = app.findCollectionByNameOrId("users");
  const visto = new Collection({
    type: "base",
    name: "chat_visto",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: ACTIVO + ` && usuario = @request.auth.id`,
    updateRule: ACTIVO + ` && usuario = @request.auth.id`,
    deleteRule: null,
    fields: [
      { name: "usuario", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "nombre", type: "text", max: 120 },
      { name: "ultimo", type: "text", max: 40 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_chat_visto_usuario ON chat_visto (usuario)"],
  });
  app.save(visto);
}, (app) => { /* no se deshace */ });
