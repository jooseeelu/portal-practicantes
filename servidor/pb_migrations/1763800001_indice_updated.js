/// <reference path="../pb_data/types.d.ts" />
// Índice para pedir rápido las fichas que han cambiado desde una fecha (sincronización por cambios).
// Se añade a la definición de la colección (así PocketBase lo conserva al guardar la colección).
const IDX = "CREATE INDEX idx_registros_updated ON registros (updated)";
const lista = (c) => { const l = []; for (let i = 0; i < c.indexes.length; i++) l.push(String(c.indexes[i])); return l; };
migrate((app) => {
  const c = app.findCollectionByNameOrId("registros");
  const l = lista(c);
  if (l.some((i) => i.indexOf("idx_registros_updated") >= 0)) return;
  unmarshal({ indexes: l.concat([IDX]) }, c);
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("registros");
  unmarshal({ indexes: lista(c).filter((i) => i.indexOf("idx_registros_updated") < 0) }, c);
  app.save(c);
});
