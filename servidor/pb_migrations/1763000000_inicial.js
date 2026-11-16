/// <reference path="../pb_data/types.d.ts" />
// Esquema inicial del portal de prácticas.
//  - users: se le añaden rol, activo y fecha de fin (caducidad de practicantes).
//  - registros: los datos del portal (candidatos, centros, entrevistas…), un registro por ficha.
//  - accesos: registro de acciones sensibles (solo lo leen los administradores).
//
// Permisos: los administradores pueden todo. El resto de roles (técnico, asesor,
// colaborador, consulta) comparten los mismos permisos: ver y editar, sin borrar
// fichas, sin tocar los ajustes y sin gestionar el equipo.

migrate((app) => {
  // Usuario con sesión, activo y sin caducar.
  const ACTIVO = `@request.auth.id != "" && @request.auth.activo = true && (@request.auth.fin = "" || @request.auth.fin >= @now)`;
  const ADMIN = `(${ACTIVO} && @request.auth.rol = "admin")`;

  // --- Usuarios ---
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new SelectField({ name: "rol", required: true, maxSelect: 1, values: ["admin", "tecnico", "asesor", "colaborador", "consulta"] }));
  users.fields.add(new BoolField({ name: "activo" }));
  users.fields.add(new DateField({ name: "fin" }));
  // Solo entra quien está activo y no ha caducado.
  users.authRule = `activo = true && (fin = "" || fin >= @now)`;
  users.listRule = ACTIVO;
  users.viewRule = ACTIVO;
  users.createRule = ADMIN;
  // Cada persona puede cambiar sus datos, pero no su rol, su estado ni su fecha de fin.
  users.updateRule = `${ADMIN} || (${ACTIVO} && id = @request.auth.id && @request.body.rol:isset = false && @request.body.activo:isset = false && @request.body.fin:isset = false)`;
  users.deleteRule = null; // nunca se borra a nadie: se desactiva
  // Los administradores gestionan las cuentas de los demás (correo, contraseña, verificación).
  users.manageRule = ADMIN;
  app.save(users);

  // --- Datos del portal ---
  const registros = new Collection({
    type: "base",
    name: "registros",
    listRule: ACTIVO,
    viewRule: ACTIVO,
    createRule: `${ACTIVO} && (@request.body.tipo != "ajustes" || @request.auth.rol = "admin")`,
    updateRule: `${ACTIVO} && (tipo != "ajustes" || @request.auth.rol = "admin")`,
    deleteRule: `${ACTIVO} && (@request.auth.rol = "admin" || (tipo != "candidatos" && tipo != "centros" && tipo != "estudiantes" && tipo != "ajustes"))`,
    fields: [
      { name: "tipo", type: "text", required: true, max: 40 },
      { name: "clave", type: "text", required: true, max: 80 },
      { name: "datos", type: "json", maxSize: 5000000 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_registros_tipo_clave ON registros (tipo, clave)"],
  });
  app.save(registros);

  // --- Registro de acciones sensibles ---
  const accesos = new Collection({
    type: "base",
    name: "accesos",
    listRule: ADMIN,
    viewRule: ADMIN,
    createRule: `${ACTIVO} && @request.body.usuario = @request.auth.id`,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "usuario", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "nombre", type: "text", max: 120 },
      { name: "accion", type: "text", required: true, max: 200 },
      { name: "detalle", type: "text", max: 500 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_accesos_created ON accesos (created)"],
  });
  app.save(accesos);
}, (app) => {
  for (const n of ["accesos", "registros"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) { /* no existe */ }
  }
  const users = app.findCollectionByNameOrId("users");
  for (const f of ["rol", "activo", "fin"]) users.fields.removeByName(f);
  users.authRule = "";
  users.manageRule = null;
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  app.save(users);
});
