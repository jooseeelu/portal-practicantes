// Entrevistas del portal → cita en Notion (y de Notion pasa sola al Excel con el flujo de n8n de cada 5 minutos).
// El servidor llama a un flujo de n8n que crea o actualiza la cita; aquí se guarda el vínculo (tipo «notion»,
// clave = id de la entrevista) aparte de la entrevista para que la web nunca lo pise al guardar.
// Configuración fuera del repositorio: /pb/pb_data/notion.json → {"url": "...", "secreto": "..."}.
const ESTADOS_OK = ["Pendiente", "Confirmada", "Realizada", "Cancelada", "Reprogramada"];

function leerConfig() {
  try { return JSON.parse(toString($os.readFile($os.getenv("NOTION_CONFIG") || "/pb/pb_data/notion.json"))); } catch (_) { return null; }
}
function datosDe(rec) { try { return JSON.parse(rec.getString("datos") || "{}"); } catch (_) { return {}; } }
function buscar(app, tipo, clave) {
  try { return app.findFirstRecordByFilter("registros", "tipo = {:t} && clave = {:c}", { t: tipo, c: String(clave) }); } catch (_) { return null; }
}
function hoyMadrid() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // aproximación a la hora de Madrid para decidir «desde hoy»
  return d.toISOString().slice(0, 10);
}

/** Lo que se manda a Notion de una entrevista (sin el id de la página). */
function cuerpoDe(app, d) {
  const cr = buscar(app, "candidatos", d.candId);
  const c = cr ? datosDe(cr) : {};
  return {
    accion: "guardar", pageId: "",
    nombre: [c.nombre, c.apellidos].filter(Boolean).join(" ").trim(), email: c.email || "", tel: c.tel || "",
    fecha: d.fecha || "", hora: d.hora || "", modalidad: d.modalidad || "", entrevistador: d.entrevistador || "",
    estado: ESTADOS_OK.indexOf(d.estado) >= 0 ? d.estado : "Pendiente",
  };
}
const huellaDe = (app, d) => JSON.stringify(cuerpoDe(app, d));

/** Sincroniza una entrevista. borrada = la entrevista se ha borrado en el portal. Devuelve un texto con lo que pasó. */
function sincronizar(app, rec, borrada) {
  if (!rec || rec.getString("tipo") !== "entrevistas") return "no es entrevista";
  const cfg = leerConfig();
  if (!cfg || !cfg.url || !cfg.secreto) return "sin configurar";
  const clave = rec.getString("clave");
  const d = datosDe(rec);
  const mapa = buscar(app, "notion", clave);
  const prev = mapa ? datosDe(mapa) : {};
  let cuerpo;
  if (borrada) {
    if (!prev.pageId) return "borrada sin cita";
    cuerpo = { accion: "cancelar", pageId: prev.pageId };
  } else {
    if (!prev.pageId && String(d.fecha || "") < hoyMadrid()) return "pasada";
    cuerpo = Object.assign(cuerpoDe(app, d), { pageId: prev.pageId || "" });
  }
  const huella = JSON.stringify(Object.assign({}, cuerpo, { pageId: "" }));
  if (prev.huella === huella) return "sin cambios";
  const r = $http.send({ url: cfg.url, method: "POST", body: JSON.stringify(cuerpo), headers: { "content-type": "application/json", "x-portal-secreto": cfg.secreto }, timeout: 30 });
  if (r.statusCode !== 200 || !r.json || !r.json.pageId) { console.log("Notion: no se pudo sincronizar la entrevista " + clave + " (" + r.statusCode + ")"); return "error " + r.statusCode; }
  const m = mapa || new Record(app.findCollectionByNameOrId("registros"));
  if (!mapa) { m.set("tipo", "notion"); m.set("clave", clave); }
  m.set("datos", { pageId: r.json.pageId, huella: huella, cuando: new Date().toISOString() });
  app.save(m);
  return borrada ? "cancelada" : prev.pageId ? "actualizada" : r.json.vinculada ? "vinculada" : "creada";
}

module.exports = { sincronizar, huellaDe, leerConfig, datosDe, buscar };
