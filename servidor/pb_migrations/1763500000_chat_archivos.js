/// <reference path="../pb_data/types.d.ts" />
// Chat del equipo: permite adjuntar una captura o un archivo a cada mensaje (fichero protegido, solo para el equipo).
// El texto deja de ser obligatorio (un mensaje puede ser solo una imagen). Idempotente.
migrate((app) => {
  const chat = app.findCollectionByNameOrId("chat");
  if (chat.fields.getByName("archivo")) return;
  const texto = chat.fields.getByName("texto");
  if (texto) texto.required = false;
  chat.fields.add(new FileField({
    name: "archivo", maxSelect: 1, maxSize: 10 * 1024 * 1024, protected: true,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
  }));
  app.save(chat);
}, (app) => { /* no se quita: contiene los adjuntos */ });
