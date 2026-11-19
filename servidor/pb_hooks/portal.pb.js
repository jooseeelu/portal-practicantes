/// <reference path="../pb_data/types.d.ts" />
// Lógica de servidor del portal de prácticas (PocketBase).

// Cabeceras: portal interno, que no lo indexen los buscadores.
routerUse((e) => {
  const h = e.response.header();
  h.set("X-Robots-Tag", "noindex, nofollow");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "same-origin");
  h.set("X-Frame-Options", "SAMEORIGIN");
  // La web (html, js, css) se revalida siempre: así nadie se queda con una versión vieja tras desplegar.
  if (!e.request.url.path.startsWith("/api/")) h.set("Cache-Control", "no-cache");
  return e.next();
});

// Configuración pública que necesita la web antes de iniciar sesión.
// De paso, la primera vez crea el primer administrador del portal a partir de las
// variables de entorno (se definen en Dokploy, nunca en el repositorio).
routerAdd("GET", "/api/portal/config", (e) => {
  const email = $os.getenv("PORTAL_ADMIN_EMAIL");
  const clave = $os.getenv("PORTAL_ADMIN_PASSWORD");
  if (email && clave) {
    let hay = false;
    try { $app.findFirstRecordByFilter("users", "rol = 'admin'"); hay = true; } catch (_) { /* aún no hay ninguno */ }
    if (!hay) {
      try {
        const u = new Record($app.findCollectionByNameOrId("users"));
        u.set("email", email);
        u.set("emailVisibility", true);
        u.set("verified", true);
        u.set("password", clave);
        u.set("name", $os.getenv("PORTAL_ADMIN_NOMBRE") || "Administrador");
        u.set("rol", "admin");
        u.set("activo", true);
        $app.save(u);
        console.log("Portal: creado el primer administrador");
      } catch (err) {
        console.log("Portal: no se pudo crear el primer administrador: " + err);
      }
    }
  }
  return e.json(200, { entorno: $os.getenv("PORTAL_ENTORNO") || "produccion" });
});

// Un administrador pone una contraseña nueva a otra persona (p. ej. si la olvida).
routerAdd("POST", "/api/portal/clave/{id}", (e) => {
  const yo = e.auth;
  if (!yo || yo.collection().name !== "users" || yo.getString("rol") !== "admin" || !yo.getBool("activo")) {
    throw new ForbiddenError("Solo un administrador puede cambiar la contraseña de otra persona.");
  }
  const cuerpo = new DynamicModel({ password: "" });
  e.bindBody(cuerpo);
  if (!cuerpo.password || cuerpo.password.length < 10) {
    throw new BadRequestError("La contraseña debe tener al menos 10 caracteres.");
  }
  const persona = $app.findRecordById("users", e.request.pathValue("id"));
  persona.set("password", cuerpo.password);
  $app.save(persona);

  try {
    const reg = new Record($app.findCollectionByNameOrId("accesos"));
    reg.set("usuario", yo.id);
    reg.set("nombre", yo.getString("name"));
    reg.set("accion", "Cambió la contraseña de otra persona");
    reg.set("detalle", persona.getString("name"));
    $app.save(reg);
  } catch (_) { /* el registro no debe impedir la operación */ }

  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Siempre debe quedar al menos un administrador activo.
onRecordUpdateRequest((e) => {
  const antes = e.record.original();
  const era = antes.getString("rol") === "admin" && antes.getBool("activo");
  const sigue = e.record.getString("rol") === "admin" && e.record.getBool("activo");
  if (era && !sigue) {
    let otros = 1;
    try {
      otros = $app.countRecords("users", $dbx.exp("rol = 'admin' AND activo = TRUE AND id != {:id}", { id: e.record.id }));
    } catch (_) { /* si no se puede contar, no bloqueamos */ }
    if (otros === 0) throw new BadRequestError("Debe quedar al menos un administrador activo.");
  }
  return e.next();
}, "users");

// Registro de inicios de sesión.
onRecordAuthWithPasswordRequest((e) => {
  e.next();
  try {
    if (!e.record) return;
    const reg = new Record($app.findCollectionByNameOrId("accesos"));
    reg.set("usuario", e.record.id);
    reg.set("nombre", e.record.getString("name"));
    reg.set("accion", "Inició sesión");
    $app.save(reg);
  } catch (_) { /* el registro no debe impedir el acceso */ }
}, "users");

// Horarios de los practicantes leídos de Gentrivo (fichajes). Solo lectura: Gentrivo es quien manda en los horarios.
// La dirección se cambia con GENTRIVO_URL (p. ej. al pasar a otro dominio). Las credenciales del usuario de servicio
// están en un archivo del volumen de datos (nunca en el repositorio): /pb/pb_data/gentrivo.json → {"email":"…","clave":"…"}.
routerAdd("GET", "/api/portal/gentrivo/horarios", (e) => {
  const yo = e.auth;
  if (!yo || yo.collection().name !== "users" || !yo.getBool("activo")) throw new ForbiddenError("Sin permiso.");
  const base = ($os.getenv("GENTRIVO_URL") || "https://app.gentrivo.com/api").replace(/\/+$/, "");
  let cfg = null;
  try { cfg = JSON.parse(toString($os.readFile($os.getenv("GENTRIVO_CREDENCIALES") || "/pb/pb_data/gentrivo.json"))); } catch (_) { cfg = null; }
  if (!cfg || !cfg.email || !cfg.clave) return e.json(200, { configurado: false, personas: [] });

  const almacen = $app.store();
  const forzar = e.request.url.query().get("refrescar") === "1";
  const cache = almacen.get("gentrivo_cache");
  if (!forzar && cache && Date.now() - cache.cuando < 10 * 60 * 1000) return e.json(200, cache.datos);

  const pedir = (metodo, ruta, cuerpo, token) => {
    const cab = { "content-type": "application/json" };
    if (token) cab.authorization = "Bearer " + token;
    return $http.send({ url: base + ruta, method: metodo, body: cuerpo ? JSON.stringify(cuerpo) : "", headers: cab, timeout: 20 });
  };
  let token = almacen.get("gentrivo_token");
  const entrar = () => {
    const r = pedir("POST", "/auth/login", { email: cfg.email, password: cfg.clave });
    if (r.statusCode !== 200 || !r.json || !r.json.token) throw new BadRequestError("No se pudo entrar en Gentrivo (" + r.statusCode + ").");
    token = r.json.token;
    almacen.set("gentrivo_token", token);
  };
  if (!token) entrar();
  // Si la sesión del usuario de servicio caduca a mitad (o se abrió otra), se vuelve a entrar y se repite
  let fallos = 0;
  // Gentrivo limita las peticiones por segundo: se espera un poco entre lecturas y, si responde «espera» (429/503), se reintenta
  const leer = (ruta) => {
    let x = null;
    for (let i = 0; i < 5; i++) {
      sleep(i ? 600 * i : 120);
      x = pedir("GET", ruta, null, token);
      if (x.statusCode === 401) { entrar(); x = pedir("GET", ruta, null, token); }
      if (x.statusCode !== 429 && x.statusCode !== 503) break;
    }
    if (x.statusCode !== 200) fallos++;
    return x;
  };
  let r = pedir("GET", "/users", null, token);
  if (r.statusCode === 401) { entrar(); r = pedir("GET", "/users", null, token); }
  if (r.statusCode !== 200) throw new BadRequestError("Gentrivo no respondió (" + r.statusCode + ").");

  const hhmm = (v) => (v ? String(v).slice(0, 5) : "");
  const personas = ((r.json && r.json.users) || []).filter((u) => u.is_intern || u.active !== false).map((u) => {
    const h = leer("/users/" + u.id + "/schedule");
    const d = h.statusCode === 200 && h.json ? h.json : {};
    const ef = d.effective || null;
    // Faltas y ausencias según los fichajes de Gentrivo (últimos 90 días, sin hoy): «Falta sin justificar», permisos…
    let faltas = [];
    if (u.is_intern) {
      const hoy = new Date(), desde = new Date(hoy.getTime() - 90 * 86400000), ayer = new Date(hoy.getTime() - 86400000);
      const iso = (x) => x.toISOString().slice(0, 10);
      const rp = leer("/reports/person?user_id=" + u.id + "&from=" + iso(desde) + "&to=" + iso(ayer));
      const NORMALES = ["worked", "off", "holiday", "no_schedule", "before_start", "pending", "after_end"];
      if (rp.statusCode === 200 && rp.json && rp.json.days) faltas = rp.json.days.filter((x) => x.status && NORMALES.indexOf(x.status) < 0).map((x) => ({ fecha: String(x.date).slice(0, 10), tipo: x.status, etiqueta: x.status_label || x.status }));
    }
    return {
      nombre: u.name || "", email: String(u.email || "").toLowerCase(), activo: !!u.active, practicante: !!u.is_intern, fin: u.ends_on || "",
      semanal: (d.weekly || []).map((w) => ({ dia: w.weekday, trabaja: !!w.is_working, ini: hhmm(w.start_time), fin: hhmm(w.end_time), pausa: w.break_minutes || 0 })),
      cambios: (d.exceptions || []).map((x) => ({ fecha: String(x.date || "").slice(0, 10), tipo: x.kind, ini: hhmm(x.start_time), fin: hhmm(x.end_time), motivo: x.reason || "" })),
      faltas: faltas,
      hoy: ef ? { tipo: ef.kind, ini: hhmm(ef.start), fin: hhmm(ef.end), motivo: ef.reason || "", origen: ef.source || "" } : null,
    };
  });
  const datos = { configurado: true, actualizado: new Date().toISOString(), personas: personas };
  // Si algo falló, no se guarda 10 minutos: se vuelve a intentar en la siguiente carga
  if (!fallos) almacen.set("gentrivo_cache", { cuando: Date.now(), datos: datos });
  return e.json(200, datos);
}, $apis.requireAuth("users"));

// Entrevistas → Notion (y de ahí al Excel). Cada cambio de una entrevista se manda a n8n (ver notion.js).
onRecordAfterCreateSuccess((e) => {
  e.next();
  try { require(`${__hooks}/notion.js`).sincronizar(e.app, e.record, false); } catch (err) { console.log("Notion: " + err); }
}, "registros");
onRecordAfterUpdateSuccess((e) => {
  e.next();
  try { require(`${__hooks}/notion.js`).sincronizar(e.app, e.record, false); } catch (err) { console.log("Notion: " + err); }
}, "registros");
onRecordAfterDeleteSuccess((e) => {
  e.next();
  try { require(`${__hooks}/notion.js`).sincronizar(e.app, e.record, true); } catch (err) { console.log("Notion: " + err); }
}, "registros");

// Puesta al día (solo superusuario): manda a Notion las entrevistas de hoy en adelante. ?limite=N para probar con pocas.
routerAdd("POST", "/api/portal/notion/sincronizar", (e) => {
  const lim = Number(e.request.url.query().get("limite") || 0);
  const hoy = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  const recs = $app.findRecordsByFilter("registros", "tipo = 'entrevistas'", "", 0, 0);
  const n = require(`${__hooks}/notion.js`);
  const cuenta = {};
  let hechas = 0;
  for (const r of recs) {
    let fecha = "";
    try { fecha = JSON.parse(r.getString("datos") || "{}").fecha || ""; } catch (_) {}
    if (fecha < hoy) continue;
    if (lim && hechas >= lim) break;
    const res = n.sincronizar($app, r, false, { soloVincular: true });
    cuenta[res] = (cuenta[res] || 0) + 1;
    hechas++;
  }
  return e.json(200, { revisadas: hechas, resultado: cuenta });
}, $apis.requireSuperuserAuth());

// Gentrivo: alta automática de quien pasa a estudiante en prácticas (ver gentrivo.js)
onRecordAfterCreateSuccess((e) => {
  e.next();
  if (e.record.getString("tipo") !== "estudiantes") return;
  try { const r = require(`${__hooks}/gentrivo.js`).altaEstudiante(e.app, e.record); e.app.store().remove("gentrivo_cache"); console.log("Gentrivo: " + r); } catch (err) { console.log("Gentrivo: " + err); }
}, "registros");
onRecordAfterUpdateSuccess((e) => {
  e.next();
  if (e.record.getString("tipo") !== "estudiantes") return;
  try { require(`${__hooks}/gentrivo.js`).altaEstudiante(e.app, e.record); } catch (err) { console.log("Gentrivo: " + err); }
}, "registros");

// Notion (y el Excel, que se sincroniza con Notion) → portal. n8n manda las citas de entrevista que han cambiado.
// Con cita vinculada: se actualizan fecha, hora, estado y entrevistador. Sin vincular: se crea la entrevista solo si
// el candidato existe (por correo o nombre exacto) y no tiene ya una entrevista ese día; si no, se omite.
routerAdd("POST", "/api/portal/notion/entrada", (e) => {
  const N = require(`${__hooks}/notion.js`);
  const cfg = N.leerConfig();
  if (!cfg || !cfg.secreto || e.request.header.get("x-portal-secreto") !== cfg.secreto) throw new ForbiddenError("Sin permiso.");
  const cuerpo = new DynamicModel({ citas: [] });
  e.bindBody(cuerpo);
  const citas = Array.isArray(cuerpo.citas) ? cuerpo.citas : [];
  const ESTADO = { "🟡 Pendiente": "Pendiente", "Confirmada": "Confirmada", "✅ Completada": "Realizada", "❌ Cancelada": "Cancelada", "Reprogramada": "Reprogramada" };
  const ASESOR = { DANI: "Daniel", JOAQUIN: "Joaquín" };
  const sinTildes = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").split(" ").filter((t) => t.length > 1).sort().join(" ");
  const todas = $app.findRecordsByFilter("registros", "tipo = 'candidatos'", "", 0, 0).map((r) => N.datosDe(r));
  const mapas = $app.findRecordsByFilter("registros", "tipo = 'notion'", "", 0, 0);
  const cuenta = { actualizada: 0, igual: 0, creada: 0, omitida: 0 };
  for (const x of citas) {
    const fecha = String(x.fecha || "").slice(0, 10), hora = String(x.hora || "").slice(0, 5);
    const cambios = {};
    if (fecha) cambios.fecha = fecha;
    if (/^[0-9]{2}:[0-9]{2}$/.test(hora)) cambios.hora = hora;
    if (ESTADO[x.estado]) cambios.estado = ESTADO[x.estado];
    if (x.asesor) cambios.entrevistador = ASESOR[x.asesor] || x.asesor;
    if (x.modalidad) cambios.modalidad = /video|online|llamada/i.test(x.modalidad) ? "Online" : "Presencial";
    const mapa = mapas.find((m) => N.datosDe(m).pageId === x.pageId);
    let ent = mapa ? N.buscar($app, "entrevistas", mapa.getString("clave")) : null;
    if (ent) {
      const d = N.datosDe(ent);
      const nuevo = Object.assign({}, d, cambios);
      if (JSON.stringify(nuevo) === JSON.stringify(d)) { cuenta.igual++; continue; }
      const md = N.datosDe(mapa); md.huella = N.huellaDe($app, nuevo); mapa.set("datos", md); $app.save(mapa);
      ent.set("datos", nuevo); $app.save(ent);
      cuenta.actualizada++;
      continue;
    }
    // Sin vincular: buscar al candidato
    const email = String(x.email || "").trim().toLowerCase();
    const cand = (email && todas.find((c) => String(c.email || "").trim().toLowerCase() === email)) || (x.nombre && todas.find((c) => sinTildes(c.nombre + " " + c.apellidos) === sinTildes(x.nombre)));
    if (!cand || !fecha) { cuenta.omitida++; continue; }
    const yaHay = $app.findRecordsByFilter("registros", "tipo = 'entrevistas'", "", 0, 0).some((r) => { const d = N.datosDe(r); return String(d.candId) === String(cand.id) && d.fecha === fecha; });
    if (yaHay) { cuenta.omitida++; continue; }
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const datos = Object.assign({ id, candId: cand.id, fecha, hora: "10:00", modalidad: "Presencial", entrevistador: "", estado: "Pendiente", notion: true, obs: "", preguntas: [],
      criterios: { conocimientos: { n: null, t: "" }, comunicacion: { n: null, t: "" }, disponibilidad: { n: null, t: "" }, adecuacion: { n: null, t: "" } } }, cambios);
    const m = new Record($app.findCollectionByNameOrId("registros"));
    m.set("tipo", "notion"); m.set("clave", String(id)); m.set("datos", { pageId: x.pageId, huella: N.huellaDe($app, datos), cuando: new Date().toISOString() });
    $app.save(m);
    const r = new Record($app.findCollectionByNameOrId("registros"));
    r.set("tipo", "entrevistas"); r.set("clave", String(id)); r.set("datos", datos);
    $app.save(r);
    cuenta.creada++;
  }
  return e.json(200, cuenta);
});
