// Recordatorios automáticos de entrevista por correo (desde info@, con copia oculta a info@).
// Cada día laborable, a la hora elegida en Ajustes, se envía la plantilla «Recordatorio de entrevista» a quien
// tiene entrevista el siguiente día laborable y la cita sigue «Pendiente» o «Reprogramada» (sin confirmar). Los viernes, las del lunes.
// Cada cita lleva apuntado para qué día y hora se mandó: si se reprograma, a la fecha nueva se le vuelve a mandar.
// Está APAGADO hasta que un administrador lo enciende en Ajustes → Mensajes. Con «correo de prueba» puesto,
// todo se manda a ese correo en vez de a los candidatos.
// El correo sale por el mismo flujo de n8n que usa el portal, con la sesión de un administrador activo.
const URL_CORREO = "https://n8n.gestoriainnova.com/webhook/practicas-enviar-correo";
const DIRECCION = "Calle General Álvarez de Castro 41, Escalera Izquierda, Primera Planta, Despacho 10";
const FIRMA = "Equipo de prácticas · Gestoría eMadrid\ninfo@gestoriaemadrid.com";
const PLANTILLA = {
  asunto: "Recordatorio: tu entrevista de prácticas · Gestoría eMadrid",
  texto: "Hola, {nombre}:\n\nTe recordamos tu entrevista de prácticas en Gestoría eMadrid.\n\n📅 {fecha}\n🕒 {hora}\n📍 {donde}\n\n¿Nos confirmas que puedes asistir? Si te surge cualquier imprevisto, avísanos y buscamos otro hueco.\n\nUn saludo,\n{firma}",
};
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function datosDe(rec) { try { return JSON.parse(rec.getString("datos") || "{}"); } catch (_) { return {}; } }
function buscar(app, tipo, clave) {
  try { return app.findFirstRecordByFilter("registros", "tipo = {:t} && clave = {:c}", { t: tipo, c: String(clave) }); } catch (_) { return null; }
}
const pad = (n) => String(n).padStart(2, "0");
// Hora de Madrid: UTC+2 entre el último domingo de marzo y el último de octubre; UTC+1 el resto
function ahoraMadrid() {
  const u = new Date();
  const ultDom = (mes) => { const d = new Date(Date.UTC(u.getUTCFullYear(), mes + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; };
  const verano = u >= ultDom(2) && u < ultDom(9);
  return new Date(u.getTime() + (verano ? 2 : 1) * 3600000); // se lee con getUTC*
}
const isoDe = (d) => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
function siguienteLaborable(d) {
  const x = new Date(d.getTime());
  do { x.setUTCDate(x.getUTCDate() + 1); } while (x.getUTCDay() === 0 || x.getUTCDay() === 6);
  return x;
}
// ¿Ya se le mandó el recordatorio para ESTA fecha y hora? (los de antes de apuntar la fecha: si se mandó hace menos de 4 días)
function yaEnviado(d) {
  if (d.recordatorioPara) return d.recordatorioPara === d.fecha + " " + (d.hora || "");
  return !!d.recordatorioAuto && Date.now() - new Date(d.recordatorioAuto).getTime() < 4 * 86400000;
}
function fechaLarga(iso) { const [a, m, d] = iso.split("-").map(Number); const x = new Date(Date.UTC(a, m - 1, d)); return DIAS[x.getUTCDay()] + " " + d + " " + MESES[m - 1]; }
const rellenar = (t, v) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

function ajustes(app) { const r = buscar(app, "ajustes", "general"); return r ? datosDe(r) : {}; }

/** Envía los recordatorios. modo: "auto" (tarea programada) o "prueba" (botón de Ajustes: solo al correo de prueba). */
function enviar(app, modo) {
  const aj = ajustes(app);
  const conf = Object.assign({ activo: false, hora: "10:00", prueba: "" }, aj.recordatorios || {});
  const ahora = ahoraMadrid();
  const hoy = isoDe(ahora);
  if (modo === "auto") {
    if (!conf.activo) return { hecho: false, motivo: "apagado" };
    if (ahora.getUTCDay() === 0 || ahora.getUTCDay() === 6) return { hecho: false, motivo: "fin de semana" };
    if (pad(ahora.getUTCHours()) + ":" + pad(ahora.getUTCMinutes()) < conf.hora) return { hecho: false, motivo: "aún no es la hora" };
    if (app.store().get("recordatorios_dia") === hoy) return { hecho: false, motivo: "ya enviados hoy" };
    app.store().set("recordatorios_dia", hoy);
  } else if (!conf.prueba) return { hecho: false, motivo: "Pon primero un correo de prueba en Ajustes." };

  const destino = isoDe(siguienteLaborable(ahora));
  const plantilla = (aj.plantillas || []).find((p) => p.id === "recordatorio") || PLANTILLA;
  const firma = aj.firma || FIRMA;
  // Sesión de un administrador activo para el flujo de correo (comprueba que es del equipo)
  let admin = null;
  try { admin = app.findFirstRecordByFilter("users", "rol = 'admin' && activo = true"); } catch (_) { admin = null; }
  if (!admin) return { hecho: false, motivo: "no hay ningún administrador activo" };
  const token = admin.newAuthToken();
  const entorno = $os.getenv("PORTAL_ENTORNO") || "produccion";

  const citas = app.findRecordsByFilter("registros", "tipo = 'entrevistas'", "", 0, 0)
    .map((r) => ({ r, d: datosDe(r) }))
    .filter((x) => x.d.fecha === destino && (x.d.estado === "Pendiente" || x.d.estado === "Reprogramada") && (modo === "prueba" || !yaEnviado(x.d)))
    .filter((x, i, l) => l.findIndex((y) => y.d.candId === x.d.candId) === i); // una sola vez por persona y día
  const enviados = [], sinCorreo = [], fallos = [];
  for (const x of citas) {
    const cr = buscar(app, "candidatos", x.d.candId);
    const c = cr ? datosDe(cr) : {};
    const nombre = [c.nombre, c.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre";
    if (!c.email) { sinCorreo.push(nombre); continue; }
    const v = {
      nombre: c.nombre || "", apellidos: c.apellidos || "", fecha: fechaLarga(x.d.fecha), hora: x.d.hora || "",
      donde: x.d.modalidad === "Online" ? "Online (te enviaremos el enlace)" : "Presencial · " + DIRECCION,
      lugar: x.d.modalidad === "Online" ? " (online; te enviaremos el enlace)" : " en nuestra oficina (" + DIRECCION + ")",
      lugar_oficina: DIRECCION, entrevistador: x.d.entrevistador || "", firma: firma,
    };
    const para = modo === "prueba" ? conf.prueba : c.email;
    const asunto = (modo === "prueba" ? "[PRUEBA para " + c.email + "] " : "") + rellenar(plantilla.asunto, v);
    const res = $http.send({ url: URL_CORREO, method: "POST", headers: { "content-type": "application/json" }, timeout: 30,
      body: JSON.stringify({ para, asunto, texto: rellenar(plantilla.texto, v), token, entorno }) });
    if (res.statusCode !== 200 || !(res.json && res.json.ok)) { fallos.push(nombre); continue; }
    enviados.push(nombre);
    if (modo === "auto") {
      x.d.recordatorioAuto = new Date().toISOString();
      x.d.recordatorioPara = x.d.fecha + " " + (x.d.hora || "");
      x.r.set("datos", x.d); app.save(x.r);
      // En el historial de la ficha
      const h = new Record(app.findCollectionByNameOrId("registros"));
      const id = String(Date.now()) + String(Math.floor(Math.random() * 1000));
      h.set("tipo", "historial"); h.set("clave", id);
      h.set("datos", { id: Number(id), candId: x.d.candId, fecha: hoy, hora: pad(ahora.getUTCHours()) + ":" + pad(ahora.getUTCMinutes()), tipo: "nota", texto: "Recordatorio automático de la entrevista enviado a " + c.email, autor: "Portal" });
      app.save(h);
    }
    sleep(300);
  }
  // Resumen en el chat del equipo
  const partes = [];
  partes.push((modo === "prueba" ? "🧪 Prueba de recordatorios" : "⏰ Recordatorios automáticos") + " para el " + fechaLarga(destino) + ": " + (enviados.length ? enviados.length + " enviados" + (modo === "prueba" ? " a " + conf.prueba : "") : "ninguno que enviar") + ".");
  if (enviados.length) partes.push("✅ " + enviados.join(", "));
  if (sinCorreo.length) partes.push("✉️ Sin correo en la ficha: " + sinCorreo.join(", "));
  if (fallos.length) partes.push("⚠️ No se pudieron enviar: " + fallos.join(", "));
  try {
    const m = new Record(app.findCollectionByNameOrId("chat"));
    m.set("autor", admin.id); m.set("nombre", "Portal (automático)"); m.set("texto", partes.join("\n"));
    app.save(m);
  } catch (err) { console.log("Recordatorios: no se pudo avisar en el chat: " + err); }
  return { hecho: true, destino, enviados: enviados.length, sinCorreo, fallos };
}

module.exports = { enviar };
