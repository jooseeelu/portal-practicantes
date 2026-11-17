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
  const base = ($os.getenv("GENTRIVO_URL") || "https://gentrivo.gestoriainnova.com/api").replace(/\/+$/, "");
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
  let r = pedir("GET", "/users", null, token);
  if (r.statusCode === 401) { entrar(); r = pedir("GET", "/users", null, token); }
  if (r.statusCode !== 200) throw new BadRequestError("Gentrivo no respondió (" + r.statusCode + ").");

  const hhmm = (v) => (v ? String(v).slice(0, 5) : "");
  const personas = ((r.json && r.json.users) || []).filter((u) => u.is_intern).map((u) => {
    const h = pedir("GET", "/users/" + u.id + "/schedule", null, token);
    const d = h.statusCode === 200 && h.json ? h.json : {};
    const ef = d.effective || null;
    return {
      nombre: u.name || "", email: String(u.email || "").toLowerCase(), activo: !!u.active, fin: u.ends_on || "",
      semanal: (d.weekly || []).map((w) => ({ dia: w.weekday, trabaja: !!w.is_working, ini: hhmm(w.start_time), fin: hhmm(w.end_time), pausa: w.break_minutes || 0 })),
      cambios: (d.exceptions || []).map((x) => ({ fecha: String(x.date || "").slice(0, 10), tipo: x.kind, ini: hhmm(x.start_time), fin: hhmm(x.end_time), motivo: x.reason || "" })),
      hoy: ef ? { tipo: ef.kind, ini: hhmm(ef.start), fin: hhmm(ef.end), motivo: ef.reason || "", origen: ef.source || "" } : null,
    };
  });
  const datos = { configurado: true, actualizado: new Date().toISOString(), personas: personas };
  almacen.set("gentrivo_cache", { cuando: Date.now(), datos: datos });
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
    const res = n.sincronizar($app, r, false);
    cuenta[res] = (cuenta[res] || 0) + 1;
    hechas++;
  }
  return e.json(200, { revisadas: hechas, resultado: cuenta });
}, $apis.requireSuperuserAuth());
