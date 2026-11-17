// Guardado automático: mantiene el estado del portal (store) igual que el servidor.
// Cada ficha (candidato, centro, entrevista…) es un registro en la colección «registros».
// Las vistas siguen trabajando sobre el store como siempre; aquí se detecta qué ha
// cambiado y se envía. Si dos personas editan la misma ficha, gana el último guardado.
import { watch } from "vue";
import { store, toast, vaciarDatos, cargarDemo, ajustesPorDefecto } from "./store.js";
import { sesion, pedir, esAdmin } from "./api.js";
import { ESTADOS_INICIALES, plantillasIniciales, PLANTILLAS_ANTIGUAS } from "./data.js";

const COLECCIONES = {
  candidatos: (x) => x.id, centros: (x) => x.id, entrevistas: (x) => x.id, estudiantes: (x) => x.candId,
  documentos: (x) => x.id, historial: (x) => x.id, notas: (x) => x.id,
};
const AJUSTES = ["estados", "aforo", "turnosDef", "retencionMeses", "personas", "plantillas", "firma"];
const K_AJUSTES = "ajustes/general";

const remoto = new Map(); // "tipo/clave" -> { id, json }
// «version» cuenta los cambios hechos aquí: si cambia mientras se trae del servidor, lo traído se descarta
// (si no, un documento recién añadido podía desaparecer al llegar una recarga que había empezado antes).
let version = 0;
let paradas = [], temporizador = null, pendiente = false, cola = Promise.resolve(), avisoAjustes = 0, intervalo = null;

const leerAjustes = () => Object.fromEntries(AJUSTES.map((k) => [k, store[k]]));

function estadoLocal() {
  const m = new Map();
  for (const [tipo, clave] of Object.entries(COLECCIONES)) {
    for (const x of store[tipo]) { const c = String(clave(x)); m.set(`${tipo}/${c}`, { tipo, clave: c, json: JSON.stringify(x) }); }
  }
  m.set(K_AJUSTES, { tipo: "ajustes", clave: "general", json: JSON.stringify(leerAjustes()) });
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
  const local = estadoLocal();
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
    if (!local.has(k)) intento(async () => { await pedir("DELETE", `api/collections/registros/records/${r.id}`); remoto.delete(k); });
  }
  if (!tareas.length) return;

  sesion.guardando++;
  try { await enParalelo(tareas); } finally { sesion.guardando--; }
  if (errores.length) {
    sesion.errorGuardado = errores[0].message;
    toast(`No se pudo guardar: ${errores[0].message}`, "error");
    if (sesion.usuario) await traer().catch(() => {}); // volver a lo que hay de verdad en el servidor
  } else sesion.errorGuardado = "";
}

function programar() {
  version++;
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

/** Lee todo del servidor y lo vuelca en el store sin romper las referencias que usan las vistas. */
async function traer(soloSiNadaCambia = false) {
  const v0 = version;
  const filas = [];
  for (let pag = 1; ; pag++) {
    const d = await pedir("GET", `api/collections/registros/records?perPage=500&page=${pag}&sort=created&skipTotal=1`);
    filas.push(...d.items);
    if (d.items.length < 500) break;
  }
  if (soloSiNadaCambia && (version !== v0 || pendiente || sesion.guardando)) return;
  const porTipo = {};
  for (const f of filas) (porTipo[f.tipo] ||= []).push(f);
  remoto.clear();

  for (const [tipo, clave] of Object.entries(COLECCIONES)) {
    const actuales = new Map(store[tipo].map((x) => [String(clave(x)), x]));
    const nueva = [];
    for (const f of porTipo[tipo] || []) {
      if (!f.datos || typeof f.datos !== "object") continue;
      let x = actuales.get(f.clave);
      if (!x) x = f.datos;
      else if (JSON.stringify(x) !== JSON.stringify(f.datos)) {
        for (const k of Object.keys(x)) if (!(k in f.datos)) delete x[k];
        Object.assign(x, f.datos);
      }
      nueva.push(x);
      remoto.set(`${tipo}/${f.clave}`, { id: f.id, json: JSON.stringify(x) });
    }
    const igual = nueva.length === store[tipo].length && nueva.every((x, i) => x === store[tipo][i]);
    if (!igual) store[tipo].splice(0, store[tipo].length, ...nueva);
  }

  const aj = (porTipo.ajustes || []).find((f) => f.clave === "general");
  if (aj?.datos) {
    const json = JSON.stringify({ ...ajustesPorDefecto(), ...aj.datos });
    if (JSON.stringify(leerAjustes()) !== json) Object.assign(store, JSON.parse(json));
    remoto.set(K_AJUSTES, { id: aj.id, json: JSON.stringify(leerAjustes()) });
  }
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
    store.plantillas.forEach((p, i) => { const n = nuevas.find((x) => x.id === p.id); if (n && PLANTILLAS_ANTIGUAS[p.id] === p.texto) store.plantillas.splice(i, 1, { ...p, texto: n.texto, asunto: n.asunto }); });
  }
  // «Mañana o tarde» se quitó por confundirse con «Disponibilidad completa»
  store.candidatos.forEach((c) => { if (c.turno === "Mañana o tarde") { c.turno = "Disponibilidad completa"; c.disponibilidad = c.turno; } });
}

/** Trae los cambios de otras personas si aquí no hay nada pendiente de guardar. */
function refrescar() {
  if (sesion.modo !== "servidor" || !sesion.usuario || pendiente || sesion.guardando || document.hidden) return;
  cola = cola.then(() => (pendiente ? null : traer(true).catch(() => {})));
}

const alOcultar = () => { if (document.hidden) guardarAhora(); else refrescar(); };
const alSalir = (e) => { if (pendiente || sesion.guardando) { guardarAhora(); e.preventDefault(); e.returnValue = ""; } };

/** Carga inicial y puesta en marcha del guardado automático. */
export async function arrancarSync() {
  pararSync();
  vaciarDatos();
  await traer();
  // Entorno de pruebas vacío: se siembra con los datos de demostración (salvo que un administrador lo haya vaciado a propósito).
  let vaciado = false;
  try { vaciado = !!localStorage.getItem("emadrid-pruebas-vaciado"); } catch (_) { /* sin almacenamiento */ }
  if (sesion.entorno === "pruebas" && esAdmin() && !vaciado && !store.candidatos.length && !store.centros.length) cargarDemo();
  const fuentes = [...Object.keys(COLECCIONES), ...AJUSTES];
  paradas = fuentes.map((k) => watch(() => store[k], programar, { deep: true }));
  window.addEventListener("focus", refrescar);
  document.addEventListener("visibilitychange", alOcultar);
  window.addEventListener("beforeunload", alSalir);
  intervalo = setInterval(refrescar, 45000);
  programar(); // por si falta crear los ajustes por defecto
}

export function pararSync() {
  paradas.forEach((p) => p()); paradas = [];
  clearTimeout(temporizador); clearInterval(intervalo);
  window.removeEventListener("focus", refrescar);
  document.removeEventListener("visibilitychange", alOcultar);
  window.removeEventListener("beforeunload", alSalir);
  pendiente = false; remoto.clear();
}
