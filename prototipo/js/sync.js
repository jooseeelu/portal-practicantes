// Guardado automático: mantiene el estado del portal (store) igual que el servidor.
// Cada ficha (candidato, centro, entrevista…) es un registro en la colección «registros».
// Las vistas siguen trabajando sobre el store como siempre; aquí se detecta qué ha
// cambiado y se envía. Si dos personas editan la misma ficha, gana el último guardado.
//
// Para que aguante muchos datos:
//  - Al entrar se descarga todo una vez. Después solo se pide lo que ha cambiado desde la última vez
//    (registros con «updated» posterior) y lo que otros han borrado (colección «borrados»).
//  - El servidor avisa al momento de cada cambio (tiempo real de PocketBase); por si se pierde un aviso,
//    se pregunta igualmente cada minuto y se recarga todo cada media hora.
//  - Al guardar solo se revisan las listas que se han tocado, no todas.
import { watch } from "vue";
import { store, toast, reemplazar, vaciarDatos, cargarDemo, ajustesPorDefecto, caducadasEnPapelera, vaciarDePapelera } from "./store.js";
import { sesion, pedir, esAdmin, borrarArchivo } from "./api.js";
import { ESTADOS_INICIALES, plantillasIniciales, PLANTILLAS_ANTIGUAS, AREAS_UNIDAS } from "./data.js";
const sinEspacios = (t) => String(t || "").replace(/[ \t\r\n]+/g, " ").trim();

const COLECCIONES = {
  candidatos: (x) => x.id, centros: (x) => x.id, entrevistas: (x) => x.id, estudiantes: (x) => x.candId,
  documentos: (x) => x.id, historial: (x) => x.id, notas: (x) => x.id, papelera: (x) => x.id,
};
const AJUSTES = ["estados", "aforo", "turnosDef", "retencionMeses", "personas", "plantillas", "firma", "recordatorios"];
const K_AJUSTES = "ajustes/general";
const SOLAPE_MS = 5000; // se vuelve a pedir un poco antes de la última marca, por si dos cambios llegaron casi a la vez
const RECARGA_COMPLETA_MS = 30 * 60 * 1000;

const remoto = new Map(); // "tipo/clave" -> { id, json }
// «version» cuenta los cambios hechos aquí: si cambia mientras se trae del servidor, lo traído se descarta
// (si no, un documento recién añadido podía desaparecer al llegar una recarga que había empezado antes).
let version = 0;
let paradas = [], temporizador = null, pendiente = false, cola = Promise.resolve(), avisoAjustes = 0, intervalo = null;
let marca = "", ultimaCompleta = 0, hayRemoto = false, tiempoReal = null, tAviso = null;
const sucias = new Set(); // listas tocadas aquí desde el último guardado («ajustes» para los ajustes)

const leerAjustes = () => Object.fromEntries(AJUSTES.map((k) => [k, store[k]]));
const mayor = (a, b) => (!a || (b && b > a) ? b : a);
/** «2026-11-27 10:00:00.123Z» menos unos milisegundos, en el mismo formato que usa PocketBase. */
const antesDe = (m, ms) => new Date(new Date(m.replace(" ", "T")).getTime() - ms).toISOString().replace("T", " ");
const clavesDe = (tipo) => new Map(store[tipo].map((x) => [String(COLECCIONES[tipo](x)), x]));

function estadoLocal(tipos) {
  const m = new Map();
  for (const [tipo, clave] of Object.entries(COLECCIONES)) {
    if (!tipos.has(tipo)) continue;
    for (const x of store[tipo]) { const c = String(clave(x)); m.set(`${tipo}/${c}`, { tipo, clave: c, json: JSON.stringify(x) }); }
  }
  if (tipos.has("ajustes")) m.set(K_AJUSTES, { tipo: "ajustes", clave: "general", json: JSON.stringify(leerAjustes()) });
  return m;
}

/** Ejecuta tareas con un máximo de `n` a la vez. */
async function enParalelo(tareas, n = 6) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => { while (i < tareas.length) await tareas[i++](); }));
}

async function empujar() {
  if (sesion.modo !== "servidor" || !sesion.usuario) return;
  pendiente = false;
  if (!sucias.size) return finEmpuje();
  const tipos = new Set(sucias);
  sucias.clear();
  const local = estadoLocal(tipos);
  const tareas = [], errores = [];
  const intento = (fn) => tareas.push(async () => { try { await fn(); } catch (e) { errores.push(e); } });

  for (const [k, v] of local) {
    const r = remoto.get(k);
    if (r && r.json === v.json) continue;
    if (v.tipo === "ajustes" && !esAdmin()) {
      // Sin registro en el servidor valen los ajustes por defecto; si alguien sin permiso los toca, se deshace.
      if (v.json !== (r ? r.json : JSON.stringify(ajustesPorDefecto()))) {
        Object.assign(store, r ? JSON.parse(r.json) : ajustesPorDefecto());
        if (Date.now() - avisoAjustes > 4000) { avisoAjustes = Date.now(); toast("Solo un administrador puede cambiar los ajustes", "error"); }
      }
      continue;
    }
    const datos = JSON.parse(v.json);
    if (r) intento(async () => { await pedir("PATCH", `api/collections/registros/records/${r.id}`, { datos }); r.json = v.json; });
    else intento(async () => { const d = await pedir("POST", "api/collections/registros/records", { tipo: v.tipo, clave: v.clave, datos }); remoto.set(k, { id: d.id, json: v.json }); });
  }
  for (const [k, r] of remoto) {
    if (tipos.has(k.slice(0, k.indexOf("/"))) && !local.has(k)) intento(async () => { await pedir("DELETE", `api/collections/registros/records/${r.id}`); remoto.delete(k); });
  }
  if (!tareas.length) return finEmpuje();

  sesion.guardando++;
  try { await enParalelo(tareas); } finally { sesion.guardando--; }
  if (errores.length) {
    sesion.errorGuardado = errores[0].message;
    toast(`No se pudo guardar: ${errores[0].message}`, "error");
    if (sesion.usuario) await traer().catch(() => {}); // volver a lo que hay de verdad en el servidor
  } else sesion.errorGuardado = "";
  finEmpuje();
}
/** Si mientras se guardaba llegaron avisos de cambios de otras personas, se traen ahora. */
function finEmpuje() { if (hayRemoto && !pendiente) { hayRemoto = false; refrescar(true); } }

function programar(tipo) {
  version++;
  if (tipo) sucias.add(tipo);
  else { for (const t of Object.keys(COLECCIONES)) sucias.add(t); sucias.add("ajustes"); }
  pendiente = true;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { cola = cola.then(empujar); }, 700);
}

/** Envía ya lo pendiente (al ocultar la pestaña o antes de cerrar sesión). */
export function guardarAhora() {
  if (!pendiente) return cola;
  clearTimeout(temporizador);
  cola = cola.then(empujar);
  return cola;
}

/** Descarga una lista paginada entera (500 por página). */
async function todasLasPaginas(ruta) {
  const filas = [];
  for (let pag = 1; ; pag++) {
    const d = await pedir("GET", `${ruta}&perPage=500&page=${pag}&skipTotal=1`);
    filas.push(...d.items);
    if (d.items.length < 500) break;
  }
  return filas;
}

/** Vuelca en el store una ficha que llega del servidor, sin romper las referencias que usan las vistas.
 *  Devuelve el objeto del store (nuevo o actualizado); si es nuevo lo añade a `nuevas`. */
function volcar(tipo, f, actuales, nuevas) {
  if (!f.datos || typeof f.datos !== "object") return null;
  let x = actuales.get(f.clave);
  if (!x) { x = f.datos; actuales.set(f.clave, x); nuevas.push(x); }
  else if (JSON.stringify(x) !== JSON.stringify(f.datos)) {
    for (const k of Object.keys(x)) if (!(k in f.datos)) delete x[k];
    Object.assign(x, f.datos);
  }
  remoto.set(`${tipo}/${f.clave}`, { id: f.id, json: JSON.stringify(x) });
  return x;
}

function volcarAjustes(f) {
  if (!f?.datos) return;
  const json = JSON.stringify({ ...ajustesPorDefecto(), ...f.datos });
  if (JSON.stringify(leerAjustes()) !== json) Object.assign(store, JSON.parse(json));
  remoto.set(K_AJUSTES, { id: f.id, json: JSON.stringify(leerAjustes()) });
}

/** Lee TODO del servidor y lo vuelca en el store (al entrar, tras un error y cada media hora). */
async function traer(soloSiNadaCambia = false) {
  const v0 = version;
  const inicio = new Date().toISOString().replace("T", " ");
  const filas = await todasLasPaginas("api/collections/registros/records?sort=created");
  if (soloSiNadaCambia && (version !== v0 || pendiente || sesion.guardando)) { hayRemoto = true; return; }
  const porTipo = {};
  for (const f of filas) (porTipo[f.tipo] ||= []).push(f);
  remoto.clear();

  for (const tipo of Object.keys(COLECCIONES)) {
    const actuales = clavesDe(tipo), nueva = [], vistas = new Set(), sueltas = [];
    for (const f of porTipo[tipo] || []) {
      const x = volcar(tipo, f, actuales, sueltas);
      if (x && !vistas.has(f.clave)) { vistas.add(f.clave); nueva.push(x); }
    }
    const igual = nueva.length === store[tipo].length && nueva.every((x, i) => x === store[tipo][i]);
    if (!igual) reemplazar(store[tipo], nueva);
  }
  volcarAjustes((porTipo.ajustes || []).find((f) => f.clave === "general"));
  // Marca para pedir después «lo que ha cambiado desde…»: lo más reciente recibido (o la hora de inicio si no hay nada)
  marca = filas.reduce((m, f) => mayor(m, f.updated), "") || inicio;
  ultimaCompleta = Date.now();

  // Estados nuevos del proceso: se añaden a los ajustes guardados (solo si quien entra es administrador, que es quien puede guardarlos)
  if (esAdmin()) {
    ESTADOS_INICIALES.forEach((e, i) => {
      if (store.estados.some((x) => x.k === e.k)) return;
      const prev = ESTADOS_INICIALES[i - 1], j = prev ? store.estados.findIndex((x) => x.k === prev.k) : -1;
      store.estados.splice(j >= 0 ? j + 1 : store.estados.length, 0, { ...e });
    });
  }
  if (esAdmin() && Array.isArray(store.plantillas)) {
    const nuevas = plantillasIniciales();
    // Plantillas nuevas (convenio y anexo): se añaden a las guardadas si no están
    nuevas.filter((n) => ["convenio-centro", "anexo-centro", "primer-contacto", "no-seleccionado"].includes(n.id) && !store.plantillas.some((p) => p.id === n.id)).forEach((n) => store.plantillas.push({ ...n }));
    store.plantillas.forEach((p, i) => { const n = nuevas.find((x) => x.id === p.id); if (n && PLANTILLAS_ANTIGUAS[p.id] && sinEspacios(PLANTILLAS_ANTIGUAS[p.id]) === sinEspacios(p.texto)) store.plantillas.splice(i, 1, { ...p, texto: n.texto, asunto: n.asunto }); });
  }
  // La papelera se vacía sola a los 30 días (lo hace un administrador al entrar; también se borran sus archivos)
  if (esAdmin()) for (const p of caducadasEnPapelera()) vaciarDePapelera(p).forEach((a) => borrarArchivo(a).catch(() => {}));
  // «Mañana o tarde» se quitó por confundirse con «Disponibilidad completa»
  store.candidatos.forEach((c) => {
    if (c.turno === "Mañana o tarde") { c.turno = "Disponibilidad completa"; c.disponibilidad = c.turno; }
    if (AREAS_UNIDAS[c.area]) c.area = AREAS_UNIDAS[c.area];
  });
}

/** Trae solo lo que ha cambiado (y lo que se ha borrado) desde la última vez. */
async function traerCambios() {
  if (!marca || Date.now() - ultimaCompleta > RECARGA_COMPLETA_MS) return traer(true);
  const v0 = version;
  const desde = antesDe(marca, SOLAPE_MS);
  const filtro = (campo) => encodeURIComponent(`${campo} >= "${desde}"`);
  const [filas, borrados] = await Promise.all([
    todasLasPaginas(`api/collections/registros/records?sort=updated&filter=${filtro("updated")}`),
    todasLasPaginas(`api/collections/borrados/records?sort=created&filter=${filtro("created")}`).catch(() => []),
  ]);
  // Si mientras tanto se ha tocado algo aquí, no se pisa: se vuelve a pedir después de guardarlo
  if (version !== v0 || pendiente || sesion.guardando) { hayRemoto = true; return; }

  const porTipo = {};
  for (const f of filas) (porTipo[f.tipo] ||= []).push(f);
  for (const tipo of Object.keys(COLECCIONES)) {
    if (!porTipo[tipo]) continue;
    const actuales = clavesDe(tipo), nuevas = [];
    for (const f of porTipo[tipo]) volcar(tipo, f, actuales, nuevas);
    for (let i = 0; i < nuevas.length; i += 5000) store[tipo].push(...nuevas.slice(i, i + 5000));
  }
  volcarAjustes((porTipo.ajustes || []).find((f) => f.clave === "general"));
  for (const b of borrados) {
    const k = `${b.tipo}/${b.clave}`, r = remoto.get(k);
    // Solo si es la misma ficha que tenemos (otra con la misma clave, p. ej. restaurada de la papelera, sigue viva)
    if (!r || r.id !== b.registro || !COLECCIONES[b.tipo]) continue;
    const i = store[b.tipo].findIndex((x) => String(COLECCIONES[b.tipo](x)) === b.clave);
    if (i >= 0) store[b.tipo].splice(i, 1);
    remoto.delete(k);
  }
  marca = filas.reduce((m, f) => mayor(m, f.updated), marca);
  marca = borrados.reduce((m, b) => mayor(m, b.created), marca);
}

/** Trae los cambios de otras personas si aquí no hay nada pendiente de guardar. */
function refrescar(aunqueOculta = false) {
  if (sesion.modo !== "servidor" || !sesion.usuario) return;
  if (pendiente || sesion.guardando) { hayRemoto = true; return; }
  if (document.hidden && !aunqueOculta) return;
  cola = cola.then(() => (pendiente ? (hayRemoto = true) : traerCambios().catch(() => {})));
}

// --- Avisos al momento (tiempo real de PocketBase) ---
// El servidor avisa de cada cambio en «registros» y «borrados». No se usa el contenido del aviso:
// solo sirve para pedir los cambios enseguida (agrupando varios avisos seguidos).
function conectarTiempoReal() {
  desconectarTiempoReal();
  if (!("EventSource" in window)) return;
  const es = new EventSource("api/realtime");
  es.addEventListener("PB_CONNECT", async (ev) => {
    try {
      const { clientId } = JSON.parse(ev.data);
      await pedir("POST", "api/realtime", { clientId, subscriptions: ["registros", "borrados"] });
    } catch (_) { /* sin avisos: queda la consulta de cada minuto */ }
    refrescar(true); // al (re)conectar se pide lo que haya podido cambiar mientras tanto
  });
  const aviso = () => { clearTimeout(tAviso); tAviso = setTimeout(() => refrescar(true), 400); };
  es.addEventListener("registros", aviso);
  es.addEventListener("borrados", aviso);
  tiempoReal = es;
}
function desconectarTiempoReal() { if (tiempoReal) { tiempoReal.close(); tiempoReal = null; } clearTimeout(tAviso); }

const alOcultar = () => { if (document.hidden) guardarAhora(); else refrescar(); };
const alSalir = (e) => { if (pendiente || sesion.guardando) { guardarAhora(); e.preventDefault(); e.returnValue = ""; } };
const alEnfocar = () => refrescar();

/** Carga inicial y puesta en marcha del guardado automático. */
export async function arrancarSync() {
  pararSync();
  vaciarDatos();
  await traer();
  // Entorno de pruebas vacío: se siembra con los datos de demostración (salvo que un administrador lo haya vaciado a propósito).
  let vaciado = false;
  try { vaciado = !!localStorage.getItem("emadrid-pruebas-vaciado"); } catch (_) { /* sin almacenamiento */ }
  if (sesion.entorno === "pruebas" && esAdmin() && !vaciado && !store.candidatos.length && !store.centros.length) cargarDemo();
  paradas = [
    ...Object.keys(COLECCIONES).map((k) => watch(() => store[k], () => programar(k), { deep: true })),
    ...AJUSTES.map((k) => watch(() => store[k], () => programar("ajustes"), { deep: true })),
  ];
  window.addEventListener("focus", alEnfocar);
  document.addEventListener("visibilitychange", alOcultar);
  window.addEventListener("beforeunload", alSalir);
  intervalo = setInterval(() => refrescar(), 60000);
  conectarTiempoReal();
  programar(); // por si falta crear los ajustes por defecto
}

export function pararSync() {
  paradas.forEach((p) => p()); paradas = [];
  clearTimeout(temporizador); clearInterval(intervalo);
  desconectarTiempoReal();
  window.removeEventListener("focus", alEnfocar);
  document.removeEventListener("visibilitychange", alOcultar);
  window.removeEventListener("beforeunload", alSalir);
  pendiente = false; hayRemoto = false; marca = ""; ultimaCompleta = 0; sucias.clear(); remoto.clear();
}
