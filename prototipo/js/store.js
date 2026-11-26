import { reactive, computed } from "vue";
import { crearDatos, ESTADOS_INICIALES, plantillasIniciales, FIRMA_INICIAL } from "./data.js";
import { HOY_ISO, turnoDe, dia, pad } from "./util.js";
import { miNombre } from "./api.js";

let tema = "claro";
try { tema = localStorage.getItem("emadrid-tema") === "oscuro" ? "oscuro" : "claro"; } catch { /* sin almacenamiento */ }

/** Ajustes de fábrica (los que se cambian en la pantalla de Ajustes). */
export const ajustesPorDefecto = () => ({
  estados: ESTADOS_INICIALES.map((e) => ({ ...e })),
  aforo: { Mañana: 4, Tarde: 4, "Tarde 2": 4 },
  turnosDef: { Mañana: { ini: "10:00", fin: "15:00" }, Tarde: { ini: "15:00", fin: "20:00" }, "Tarde 2": { ini: "16:00", fin: "21:00" } },
  retencionMeses: 12,
  // Recordatorios automáticos de entrevista (los envía el servidor; apagados hasta que se encienden)
  recordatorios: { activo: false, hora: "10:00", prueba: "" },
  plantillas: plantillasIniciales(),
  firma: FIRMA_INICIAL,
  // Quién puede entrevistar, ser tutor o llevar un centro (se edita en Ajustes → Personas)
  personas: {
    equipo: ["José Luis", "Vanesa", "José Manuel", "Roxana", "Andrés"],
    practicantes: ["Milena", "Montserrat", "Belén", "Johan", "Joaquín", "Mayela", "Ileana", "Daniel", "Mey"],
  },
});
const DATOS = ["centros", "candidatos", "entrevistas", "estudiantes", "documentos", "historial", "notas", "papelera"];

// El portal arranca vacío: los datos llegan del servidor (sync.js) o, en modo demo, de cargarDemo().
export const store = reactive({
  tema,
  ...ajustesPorDefecto(),
  toasts: [],
  fichaTab: "personal",
  ...Object.fromEntries(DATOS.map((k) => [k, []])),
});

/** Sustituye el contenido de una lista sin «...lista» (con más de ~100.000 elementos el navegador se queda sin pila). */
export function reemplazar(arr, nueva) {
  if (nueva.length < 20000) return arr.splice(0, arr.length, ...nueva);
  arr.splice(0, arr.length);
  for (let i = 0; i < nueva.length; i += 10000) arr.push(...nueva.slice(i, i + 10000));
}

export function vaciarDatos() {
  for (const k of DATOS) store[k].splice(0);
  Object.assign(store, ajustesPorDefecto());
}
/** Rellena el portal con los datos de demostración (inventados). */
export function cargarDemo() {
  const d = crearDatos();
  for (const k of DATOS) reemplazar(store[k], d[k] || []);
}

// Turnos de la oficina y cómo se muestran (con su horario, que se edita en Ajustes)
export const TURNOS_OFICINA = ["Mañana", "Tarde", "Tarde 2"];
export const etiquetaTurno = (t) => {
  const d = store.turnosDef[t];
  return d && t !== "Mañana" ? `Tarde · ${d.ini.replace(/^0/, "")}–${d.fin}` : t;
};

export function setTema(t) {
  store.tema = t;
  document.documentElement.setAttribute("data-theme", t === "oscuro" ? "dark" : "light");
  try { localStorage.setItem("emadrid-tema", t); } catch { /* sin almacenamiento */ }
}

// --- Índices: buscar una ficha o «lo de un candidato» sin recorrer todas las listas cada vez ---
// Se recalculan solos cuando cambian las listas (una pasada por lista), no en cada búsqueda.
const agrupar = (l) => { const m = new Map(); for (const x of l) { const g = m.get(x.candId); if (g) g.push(x); else m.set(x.candId, [x]); } return m; };
const porClave = (l, k) => { const m = new Map(); for (const x of l) if (!m.has(x[k])) m.set(x[k], x); return m; };
const idx = {
  cand: computed(() => porClave(store.candidatos, "id")),
  centro: computed(() => porClave(store.centros, "id")),
  est: computed(() => porClave(store.estudiantes, "candId")),
  docs: computed(() => agrupar(store.documentos)),
  hist: computed(() => agrupar(store.historial)),
  // entrevistas de cada candidato, de la más antigua a la más reciente
  ents: computed(() => { const m = agrupar(store.entrevistas); for (const l of m.values()) l.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)); return m; }),
  nombre: computed(() => { const m = new Map(); for (const c of store.candidatos) { const k = c.nombre + "|" + c.apellidos; if (!m.has(k)) m.set(k, c); } return m; }),
};
/** El candidato con ese nombre y apellidos (para poner su foto en listados que solo tienen el nombre). */
export const candPorNombre = (nombre, apellidos) => idx.nombre.value.get(nombre + "|" + apellidos) || null;

export const estadoDe = (k) => store.estados.find((e) => e.k === k) || { k, n: k, c: "var(--text-400)", cd: "var(--text-600)" };
export const centroDe = (id) => idx.centro.value.get(id) || null;
export const candDe = (id) => idx.cand.value.get(Number(id)) || null;
export const nombreCompleto = (c) => (c ? `${c.nombre} ${c.apellidos}` : "—");
export const entrevistasDe = (candId) => (idx.ents.value.get(candId) || []).slice().reverse();
export const entrevistaDe = (candId) => { const l = idx.ents.value.get(candId); return l && l.length ? l[l.length - 1] : null; };
export const estudianteDe = (candId) => idx.est.value.get(candId) || null;
export const docsDe = (candId) => (idx.docs.value.get(candId) || []).slice();
export const histDe = (candId) => (idx.hist.value.get(candId) || []).slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora) || b.id - a.id);
// Identificador único aunque varias personas creen fichas a la vez (hora en ms + azar).
let ultimoId = 0;
export const nuevoId = () => { const n = Date.now() * 1000 + Math.floor(Math.random() * 1000); ultimoId = n > ultimoId ? n : ultimoId + 1; return ultimoId; };

/** Estado de las prácticas de un estudiante según las fechas. */
export function estadoPracticas(e) {
  if (e.fin < HOY_ISO) return "Finalizada";
  if (e.inicio > HOY_ISO) return "Prevista";
  return "En curso";
}
export const turnoEstudiante = (e) => turnoDe(e.horaIni);

/** Aviso abajo. Con «accion» ({ t: "Deshacer", f }) lleva un botón y dura más. */
export function toast(msg, tipo = "ok", accion = null) {
  const id = nuevoId();
  store.toasts.push({ id, msg, tipo, accion });
  setTimeout(() => { store.toasts = store.toasts.filter((t) => t.id !== id); }, accion ? 8000 : tipo === "error" ? 6000 : 3200);
  return id;
}
export const quitarToast = (id) => { store.toasts = store.toasts.filter((t) => t.id !== id); };

export function addHist(candId, tipo, texto, autor = miNombre(), extra = null) {
  const ahora = new Date();
  store.historial.push({ id: nuevoId(), candId, fecha: HOY_ISO, hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`, tipo, texto, autor, ...(extra || {}) });
}

export function cambiarEstado(c, k, { silencioso = false } = {}) {
  if (!c || c.estado === k) return;
  const previo = c.estado, antes = estadoDe(previo).n;
  c.estado = k;
  addHist(c.id, "estado", `Estado: ${antes} → ${estadoDe(k).n}`, miNombre(), { cambio: { campo: "estado", antes: previo, despues: k } });
  if (!silencioso) toast(`${nombreCompleto(c)} pasa a «${estadoDe(k).n}»`, "ok", { t: "Deshacer", f: () => cambiarEstado(c, previo, { silencioso: true }) });
}

/** ¿Se puede deshacer ese cambio del historial? (solo si la ficha sigue como la dejó) */
export function sePuedeDeshacer(h) {
  const c = h?.cambio && candDe(h.candId);
  if (!c) return false;
  // solo el último cambio de ese dato (deshacer uno antiguo pisaría los posteriores)
  const ultimo = store.historial.filter((x) => x.candId === h.candId && x.cambio?.campo === h.cambio.campo).reduce((a, x) => (!a || x.id > a.id ? x : a), null);
  if (ultimo !== h) return false;
  return JSON.stringify(c[h.cambio.campo] ?? null) === JSON.stringify(h.cambio.despues ?? null);
}
/** Vuelve la ficha a como estaba antes de ese cambio del historial. */
export function deshacerCambio(h) {
  const c = candDe(h.candId);
  if (!c || !sePuedeDeshacer(h)) return false;
  const { campo, antes } = h.cambio;
  if (campo === "estado") cambiarEstado(c, antes, { silencioso: true });
  else {
    c[campo] = antes;
    addHist(c.id, h.tipo, `Deshecho: ${h.texto}`, miNombre(), { cambio: { campo, antes: h.cambio.despues, despues: antes } });
  }
  return true;
}

/** Convierte un candidato en estudiante en prácticas SIN duplicar la ficha. */
export function incorporar(c, datos) {
  let e = estudianteDe(c.id);
  if (!e) { e = { candId: c.id, centroId: c.centroId, obs: "" }; store.estudiantes.push(e); }
  Object.assign(e, datos);
  cambiarEstado(c, "incorporado", { silencioso: true });
  addHist(c.id, "incorporacion", `Incorporado como estudiante en prácticas (${datos.inicio} → ${datos.fin})`);
  toast(`${nombreCompleto(c)} ya es estudiante en prácticas`);
  return e;
}

// --- Papelera: una ficha borrada se guarda entera 30 días y se puede recuperar ---
export const DIAS_PAPELERA = 30;
const FICHA = ["entrevistas", "documentos", "historial", "notas", "estudiantes"];

/** Manda la ficha de un candidato y todo lo suyo (entrevistas, prácticas, documentos, historial y notas) a la papelera.
 *  Los archivos subidos NO se borran: se borran cuando la ficha se elimina para siempre. */
export function borrarCandidato(c) {
  const id = c.id, ahora = new Date();
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const datos = { cand: copia(c) };
  for (const k of FICHA) datos[k] = store[k].filter((x) => x.candId === id).map(copia);
  store.papelera.push({ id: nuevoId(), candId: id, nombre: nombreCompleto(c), fecha: HOY_ISO, hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`, por: miNombre(), estado: c.estado, centro: centroDe(c.centroId)?.nombre || "", datos });
  for (const k of FICHA) {
    const queda = store[k].filter((x) => x.candId !== id);
    if (queda.length !== store[k].length) reemplazar(store[k], queda);
  }
  const i = store.candidatos.findIndex((x) => x.id === id);
  if (i >= 0) store.candidatos.splice(i, 1);
}
/** Los ids de archivo del servidor que lleva una ficha de la papelera. */
export const archivosDe = (p) => (p.datos?.documentos || []).filter((d) => d.archivoId).map((d) => d.archivoId);
/** Saca una ficha de la papelera y la deja como estaba. */
export function restaurarDePapelera(p) {
  if (store.candidatos.some((x) => x.id === p.candId)) { toast("Ya hay una ficha con ese número; no se puede restaurar.", "error"); return false; }
  store.candidatos.push(p.datos.cand);
  for (const k of FICHA) store[k].push(...(p.datos[k] || []));
  store.papelera.splice(store.papelera.indexOf(p), 1);
  addHist(p.candId, "estado", "Ficha restaurada desde la papelera");
  return true;
}
/** Elimina para siempre una ficha de la papelera. Devuelve los archivos que hay que borrar del servidor. */
export function vaciarDePapelera(p) {
  const i = store.papelera.indexOf(p);
  if (i >= 0) store.papelera.splice(i, 1);
  return archivosDe(p);
}
export const diasEnPapelera = (p) => Math.round((Date.parse(HOY_ISO) - Date.parse(p.fecha)) / 86400000);
/** Fichas que llevan más de 30 días en la papelera. */
export const caducadasEnPapelera = () => store.papelera.filter((p) => diasEnPapelera(p) >= DIAS_PAPELERA);

// --- Conservación de datos: candidaturas que ya no siguen en el proceso y han pasado el plazo ---
export const ESTADOS_SIN_PROCESO = ["no-seleccionado", "no-seleccionado-comunicado", "retirada", "cancelado"];
/** Último contacto real con la persona: alta, entrevista ya hecha o cambio de estado hecho por alguien del equipo. */
export function ultimoContacto(c) {
  const f = [c.creado];
  for (const e of idx.ents.value.get(c.id) || []) if (e.fecha <= HOY_ISO) f.push(e.fecha);
  for (const h of idx.hist.value.get(c.id) || []) if (h.tipo === "estado" && h.autor !== "Portal") f.push(h.fecha);
  if (c.conservadoHasta) f.push(c.conservadoDesde || "");
  return f.filter(Boolean).sort().pop() || HOY_ISO;
}
const sumarMeses = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
/** Fecha en la que termina el plazo de conservación de una candidatura. */
export const venceEl = (c) => { const v = sumarMeses(ultimoContacto(c), store.retencionMeses || 12); return c.conservadoHasta && c.conservadoHasta > v ? c.conservadoHasta : v; };
/** Candidaturas sin proceso cuyo plazo ya ha pasado (o pasa en los próximos `dias` días). */
export const candidaturasCaducadas = (dias = 0) => store.candidatos.filter((c) => ESTADOS_SIN_PROCESO.includes(c.estado) && !idx.est.value.has(c.id) && venceEl(c) <= dia(dias)).sort((a, b) => venceEl(a).localeCompare(venceEl(b)));
/** Decidir conservar una candidatura otro periodo completo. */
export function mantenerCandidatura(c) {
  c.conservadoDesde = HOY_ISO; c.conservadoHasta = sumarMeses(HOY_ISO, store.retencionMeses || 12);
  addHist(c.id, "nota", `Se mantiene la candidatura otros ${store.retencionMeses || 12} meses (hasta el ${c.conservadoHasta})`);
}

/** Elimina una entrevista creada por error (en Notion queda como cancelada). */
export async function eliminarEntrevista(e) {
  const { pedirConfirmacion } = await import("./ui.js");
  const c = candDe(e.candId);
  if (!(await pedirConfirmacion({ titulo: "¿Eliminar esta entrevista?", texto: "Úsalo solo si se creó por error o está repetida. Desaparece del portal y en Notion queda como cancelada. Si la entrevista no se va a hacer, mejor márcala como «Cancelada».", boton: "Eliminar entrevista" }))) return false;
  const i = store.entrevistas.findIndex((x) => x.id === e.id);
  if (i >= 0) store.entrevistas.splice(i, 1);
  if (c) addHist(c.id, "entrevista", `Entrevista del ${e.fecha} a las ${e.hora} eliminada (creada por error)`);
  toast("Entrevista eliminada");
  return true;
}

/** Número de entrevista de esa persona (1.ª, 2.ª…) por orden de fecha, sin contar las canceladas. */
// Las canceladas y las reprogramadas (la cita vieja que Notion deja al moverla a otro día) no cuentan: la cita nueva sigue siendo la 1.ª
const NO_CUENTA = ["Cancelada", "Reprogramada"];
const ordenCitas = (candId) => idx.ents.value.get(candId) || [];
export function rondaDe(e) {
  const l = ordenCitas(e.candId);
  const i = l.findIndex((x) => x.id === e.id);
  return 1 + l.slice(0, i < 0 ? l.length : i).filter((x) => !NO_CUENTA.includes(x.estado)).length;
}
/** Cuántas entrevistas «de verdad» tiene (sin canceladas ni reprogramadas) */
export const rondasDe = (candId) => ordenCitas(candId).filter((x) => !NO_CUENTA.includes(x.estado)).length;

export function programarEntrevista(c, { fecha, hora, modalidad, entrevistador }) {
  const previas = store.entrevistas.filter((x) => x.candId === c.id && x.estado !== "Cancelada").length;
  const nueva = {
    id: nuevoId(), candId: c.id, fecha, hora, modalidad, entrevistador, estado: "Pendiente", notion: true, obs: "", preguntas: [],
    criterios: { conocimientos: { n: null, t: "" }, comunicacion: { n: null, t: "" }, disponibilidad: { n: null, t: "" }, adecuacion: { n: null, t: "" } },
  };
  store.entrevistas.push(nueva);
  // Una 2.ª entrevista (p. ej. con dirección) vuelve a dejar la candidatura en «Entrevista programada»
  const pasa = previas ? ["pendiente-revision", "pendiente-entrevista", "entrevistado", "en-valoracion"] : ["pendiente-revision", "pendiente-entrevista"];
  if (pasa.includes(c.estado)) cambiarEstado(c, "entrevista-programada", { silencioso: true });
  const n = previas ? `${previas + 1}.ª entrevista` : "Entrevista";
  addHist(c.id, "entrevista", `${n} programada para el ${fecha} a las ${hora} (${modalidad.toLowerCase()})${entrevistador ? " con " + entrevistador : ""}`);
  toast(`${n} programada con ${nombreCompleto(c)}`);
  return nueva;
}

export { dia, HOY_ISO };
