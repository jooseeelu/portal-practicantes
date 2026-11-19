// Alta automática en Gentrivo: cuando alguien pasa a estudiante en prácticas, se le da de alta en Gentrivo
// (practicante, con su último día) y se le envía la invitación para elegir contraseña. Si la persona ya
// existía en Gentrivo (mismo correo), solo se vincula y no se toca su horario.
// Usa el mismo usuario de servicio que la lectura de horarios (/pb/pb_data/gentrivo.json).

function datosDe(rec) { try { return JSON.parse(rec.getString("datos") || "{}"); } catch (_) { return {}; } }
function buscar(app, tipo, clave) {
  try { return app.findFirstRecordByFilter("registros", "tipo = {:t} && clave = {:c}", { t: tipo, c: String(clave) }); } catch (_) { return null; }
}
function config() {
  try { return JSON.parse(toString($os.readFile($os.getenv("GENTRIVO_CREDENCIALES") || "/pb/pb_data/gentrivo.json"))); } catch (_) { return null; }
}

/** Llamada a la API de Gentrivo con la sesión del usuario de servicio (se renueva sola si caduca). */
function api(app, metodo, ruta, cuerpo) {
  const cfg = config();
  if (!cfg || !cfg.email || !cfg.clave) return null;
  const base = ($os.getenv("GENTRIVO_URL") || "https://app.gentrivo.com/api").replace(/\/+$/, "");
  const almacen = app.store();
  const enviar = (token) => {
    const cab = { "content-type": "application/json" };
    if (token) cab.authorization = "Bearer " + token;
    return $http.send({ url: base + ruta, method: metodo, body: cuerpo ? JSON.stringify(cuerpo) : "", headers: cab, timeout: 20 });
  };
  const entrar = () => {
    const r = $http.send({ url: base + "/auth/login", method: "POST", body: JSON.stringify({ email: cfg.email, password: cfg.clave }), headers: { "content-type": "application/json" }, timeout: 20 });
    if (r.statusCode !== 200 || !r.json || !r.json.token) return "";
    almacen.set("gentrivo_token", r.json.token);
    return r.json.token;
  };
  let token = almacen.get("gentrivo_token") || entrar();
  if (!token) return null;
  let r = enviar(token);
  if (r.statusCode === 401) { token = entrar(); if (!token) return null; r = enviar(token); }
  return r;
}

function altaEstudiante(app, rec) {
  if (!rec || rec.getString("tipo") !== "estudiantes") return "no es estudiante";
  if (!config()) return "sin configurar";
  const e = datosDe(rec);
  const cr = buscar(app, "candidatos", e.candId);
  const c = cr ? datosDe(cr) : {};
  const email = String(c.email || "").trim().toLowerCase();
  if (!/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email)) return "sin email";
  const nombre = [c.nombre, c.apellidos].filter(Boolean).join(" ").trim() || email;
  const mapa = buscar(app, "gentrivo", e.candId);
  const prev = mapa ? datosDe(mapa) : {};
  const huella = JSON.stringify({ nombre, email, inicio: e.inicio || "", fin: e.fin || "", hi: e.horaIni || "", hf: e.horaFin || "" });
  if (prev.huella === huella) return "sin cambios";
  let userId = prev.userId || "", creado = !!prev.creado, res = "actualizado";
  if (!userId) {
    const r = api(app, "POST", "/users", { name: nombre, email, role: "employee", is_intern: true, ends_on: e.fin || null, invite: true });
    if (!r) return "sin conexión";
    if (r.statusCode === 200 && r.json && r.json.user) { userId = r.json.user.id; creado = true; res = r.json.invited ? "creado e invitado" : "creado"; }
    else if (r.statusCode === 409) {
      const l = api(app, "GET", "/users");
      const u = l && l.statusCode === 200 && l.json ? (l.json.users || []).find((x) => String(x.email || "").toLowerCase() === email) : null;
      if (!u) return "ya existe pero no se ve";
      userId = u.id; res = "vinculado";
    } else { console.log("Gentrivo: no se pudo dar de alta (" + r.statusCode + ")"); return "error " + r.statusCode; }
  } else if (creado) {
    api(app, "PATCH", "/users/" + userId, { name: nombre, ends_on: e.fin || null });
  }
  // Horario habitual de lunes a viernes, solo para las personas que da de alta el portal
  const horario = (e.horaIni || "") + "-" + (e.horaFin || "");
  if (creado && e.horaIni && e.horaFin && e.horaIni < e.horaFin && prev.horario !== horario) {
    const dias = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, is_working: true, start: e.horaIni, end: e.horaFin, break_minutes: 0 }))
      .concat([6, 7].map((d) => ({ weekday: d, is_working: false, break_minutes: 0 })));
    const hoy = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
    const desde = e.inicio && e.inicio > hoy ? e.inicio : hoy;
    const s = api(app, "PUT", "/users/" + userId + "/schedule", { valid_from: desde, days: dias });
    if (!s || s.statusCode !== 200) console.log("Gentrivo: no se pudo poner el horario (" + (s ? s.statusCode : "sin conexión") + ")");
  }
  const m = mapa || new Record(app.findCollectionByNameOrId("registros"));
  if (!mapa) { m.set("tipo", "gentrivo"); m.set("clave", String(e.candId)); }
  m.set("datos", { userId, creado, huella, horario, cuando: new Date().toISOString() });
  app.save(m);
  return res;
}

module.exports = { altaEstudiante };
