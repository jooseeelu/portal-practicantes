/// <reference path="../pb_data/types.d.ts" />
// Lógica de servidor del portal de prácticas (PocketBase).

// Cabeceras: portal interno, que no lo indexen los buscadores.
routerUse((e) => {
  const h = e.response.header();
  h.set("X-Robots-Tag", "noindex, nofollow");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "same-origin");
  h.set("X-Frame-Options", "SAMEORIGIN");
  return e.next();
});

// Configuración pública que necesita la web antes de iniciar sesión.
routerAdd("GET", "/api/portal/config", (e) => {
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

// Primer arranque: crea el primer administrador del portal a partir de las variables
// de entorno (se definen en Dokploy, nunca en el repositorio).
onServe((e) => {
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
        console.log("Portal: creado el primer administrador (" + email + ")");
      } catch (err) {
        console.log("Portal: no se pudo crear el primer administrador: " + err);
      }
    }
  }
  return e.next();
});
