// Conexión con el servidor del portal (PocketBase). Sin dependencias: solo fetch.
// Si no hay servidor (p. ej. al abrir la web con servidor.cjs), el portal funciona
// en «modo demo»: datos de ejemplo en memoria y sin inicio de sesión.
import { reactive } from "vue";

const CLAVE = "emadrid-sesion";

export const ROLES = {
  admin: "Administrador",
  tecnico: "Técnico",
  asesor: "Asesor",
  colaborador: "Colaborador",
  consulta: "Consulta",
};

export const sesion = reactive({
  modo: "cargando", // cargando | demo | servidor
  entorno: "demo", // demo | pruebas | produccion
  usuario: null, // registro del usuario con sesión
  token: "",
  guardando: 0, // operaciones de guardado en curso
  errorGuardado: "",
});

export const esAdmin = () => sesion.modo === "demo" || sesion.usuario?.rol === "admin";
export const miNombre = () => (sesion.modo === "demo" ? "Admin" : sesion.usuario?.name || sesion.usuario?.email || "—");
export const miRol = () => (sesion.modo === "demo" ? "Demostración" : ROLES[sesion.usuario?.rol] || "—");

export class ErrorApi extends Error {
  constructor(estado, mensaje, datos) { super(mensaje); this.estado = estado; this.datos = datos; }
}

/** Mensaje legible a partir de la respuesta de error de PocketBase. */
function mensajeDe(estado, cuerpo) {
  const campos = cuerpo?.data && Object.values(cuerpo.data).map((c) => c?.message).filter(Boolean);
  if (campos?.length) return campos.join(" ");
  if (estado === 400 && /authenticate/i.test(cuerpo?.message || "")) return "Correo o contraseña incorrectos, o el acceso está desactivado.";
  if (estado === 403) return "No tienes permiso para hacer esto.";
  if (estado === 404) return "No encontrado (puede que ya no exista o que no tengas acceso).";
  return cuerpo?.message || `Error ${estado}`;
}

export async function pedir(metodo, ruta, cuerpo) {
  const cab = {};
  if (cuerpo !== undefined) cab["Content-Type"] = "application/json";
  if (sesion.token) cab.Authorization = sesion.token;
  let r;
  try {
    r = await fetch(ruta, { method: metodo, headers: cab, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor. Revisa tu conexión.");
  }
  let datos = null;
  if (r.status !== 204) { try { datos = await r.json(); } catch { /* sin cuerpo */ } }
  if (!r.ok) {
    if (r.status === 401 && sesion.usuario) cerrarSesion();
    throw new ErrorApi(r.status, mensajeDe(r.status, datos), datos);
  }
  return datos;
}

function guardarSesion() {
  try {
    if (sesion.token) localStorage.setItem(CLAVE, JSON.stringify({ token: sesion.token }));
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento */ }
}

/** Averigua si hay servidor y recupera la sesión guardada. */
export async function iniciar() {
  let conf = null;
  try {
    const r = await fetch("api/portal/config", { headers: { Accept: "application/json" } });
    if (r.ok && /json/.test(r.headers.get("content-type") || "")) conf = await r.json();
  } catch { /* sin servidor */ }
  if (!conf) { sesion.modo = "demo"; sesion.entorno = "demo"; return; }
  sesion.entorno = conf.entorno || "produccion";
  try { sesion.token = JSON.parse(localStorage.getItem(CLAVE) || "{}").token || ""; } catch { sesion.token = ""; }
  if (sesion.token) {
    try {
      const d = await pedir("POST", "api/collections/users/auth-refresh");
      sesion.token = d.token; sesion.usuario = d.record; guardarSesion();
    } catch { sesion.token = ""; sesion.usuario = null; guardarSesion(); }
  }
  sesion.modo = "servidor";
}

export async function entrar(email, clave) {
  const d = await pedir("POST", "api/collections/users/auth-with-password", { identity: email.trim(), password: clave });
  sesion.token = d.token; sesion.usuario = d.record; guardarSesion();
}

export function cerrarSesion() {
  sesion.token = ""; sesion.usuario = null; guardarSesion();
}

/** Anota una acción sensible (quién abrió un currículum, quién exportó…). No bloquea nunca. */
export function registrar(accion, detalle = "") {
  if (sesion.modo !== "servidor" || !sesion.usuario) return;
  pedir("POST", "api/collections/accesos/records", { usuario: sesion.usuario.id, nombre: miNombre(), accion, detalle }).catch(() => {});
}

// --- Equipo ---
export const listarEquipo = async () => (await pedir("GET", "api/collections/users/records?perPage=500&sort=name&skipTotal=1")).items;
export const crearPersona = (p) => pedir("POST", "api/collections/users/records", { ...p, passwordConfirm: p.password, emailVisibility: true, verified: true });
export const editarPersona = (id, cambios) => pedir("PATCH", `api/collections/users/records/${id}`, cambios);
export const ponerClave = (id, password) => pedir("POST", `api/portal/clave/${id}`, { password });
export async function cambiarMiClave(actual, nueva) {
  await pedir("PATCH", `api/collections/users/records/${sesion.usuario.id}`, { oldPassword: actual, password: nueva, passwordConfirm: nueva });
  await entrar(sesion.usuario.email, nueva); // cambiar la contraseña invalida la sesión anterior
}
export const listarAccesos = async () => (await pedir("GET", "api/collections/accesos/records?perPage=60&sort=-created&skipTotal=1")).items;

/** Contraseña aleatoria fácil de dictar (sin caracteres que se confundan). */
export function claveAleatoria(n = 14) {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const v = new Uint32Array(n); crypto.getRandomValues(v);
  return Array.from(v, (x) => abc[x % abc.length]).join("");
}

// --- Archivos (currículums, convenios…): colección «archivos», con el fichero protegido ---
/** Sube un archivo privado. Devuelve el registro creado ({ id, archivo, … }). */
export async function subirArchivo(file, { candId, tipo = "", nombre = "" }) {
  const fd = new FormData();
  fd.append("candId", String(candId));
  fd.append("tipo", tipo);
  fd.append("nombre", nombre || file.name);
  if (sesion.usuario) fd.append("subidoPor", sesion.usuario.id);
  fd.append("archivo", file);
  let r;
  try { r = await fetch("api/collections/archivos/records", { method: "POST", headers: sesion.token ? { Authorization: sesion.token } : {}, body: fd }); }
  catch { throw new ErrorApi(0, "No se pudo conectar con el servidor. Revisa tu conexión."); }
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw new ErrorApi(r.status, mensajeDe(r.status, datos), datos);
  return datos;
}

// El fichero protegido solo se abre con un token temporal (dura unos minutos; se reutiliza 1 minuto).
let tokenArchivos = { valor: "", hasta: 0 };
/** Enlace temporal a un fichero protegido de cualquier colección (p. ej. las capturas del chat). */
export async function urlFichero(coleccion, id, nombre) {
  if (Date.now() > tokenArchivos.hasta) { const d = await pedir("POST", "api/files/token"); tokenArchivos = { valor: d.token, hasta: Date.now() + 60000 }; }
  return `api/files/${coleccion}/${id}/${encodeURIComponent(nombre)}?token=${tokenArchivos.valor}`;
}
/** Envía un formulario con archivos (FormData) a una colección. */
export async function crearConArchivo(coleccion, fd) {
  let r;
  try { r = await fetch(`api/collections/${coleccion}/records`, { method: "POST", headers: sesion.token ? { Authorization: sesion.token } : {}, body: fd }); }
  catch { throw new ErrorApi(0, "No se pudo conectar con el servidor. Revisa tu conexión."); }
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw new ErrorApi(r.status, mensajeDe(r.status, datos), datos);
  return datos;
}
/** Enlace temporal para ver (o descargar) el archivo de un documento. */
export async function urlArchivo(doc, { descargar = false } = {}) {
  if (Date.now() > tokenArchivos.hasta) {
    const d = await pedir("POST", "api/files/token");
    tokenArchivos = { valor: d.token, hasta: Date.now() + 60000 };
  }
  return `api/files/archivos/${doc.archivoId}/${encodeURIComponent(doc.archivo)}?token=${tokenArchivos.valor}${descargar ? "&download=1" : ""}`;
}
/** Lectura del currículum con IA (n8n + OpenAI). Devuelve una PROPUESTA de datos: no guarda nada. */
const URL_LEER_CV = "https://n8n.gestoriainnova.com/webhook/practicas-leer-cv";
export async function leerCurriculum(archivoId) {
  let r;
  try {
    r = await fetch(URL_LEER_CV, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archivoId, token: sesion.token, entorno: sesion.entorno }) });
  } catch { throw new ErrorApi(0, "No se pudo conectar con el servicio de lectura. Prueba de nuevo en un momento."); }
  let d = null; try { d = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok || !d?.ok) throw new ErrorApi(r.status, d?.mensaje || "No se pudo leer el currículum. Rellena los datos a mano o prueba de nuevo.", d);
  return d; // { datos, avisos }
}
/** Envía un correo desde info@gestoriaemadrid.com (n8n + SMTP). */
const URL_CORREO = "https://n8n.gestoriainnova.com/webhook/practicas-enviar-correo";
export async function enviarCorreo({ para, asunto, texto }) {
  let r;
  try { r = await fetch(URL_CORREO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ para, asunto, texto, token: sesion.token, entorno: sesion.entorno }) }); }
  catch { throw new ErrorApi(0, "No se pudo conectar con el servicio de correo. Prueba de nuevo en un momento."); }
  let d = null; try { d = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok || !d?.ok) throw new ErrorApi(r.status, d?.mensaje || "No se pudo enviar el correo.", d);
  return d;
}
export const borrarArchivo = (id) => pedir("DELETE", `api/collections/archivos/records/${id}`);
