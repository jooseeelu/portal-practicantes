import { reactive } from "vue";
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
  plantillas: plantillasIniciales(),
  firma: FIRMA_INICIAL,
  // Quién puede entrevistar, ser tutor o llevar un centro (se edita en Ajustes → Personas)
  personas: {
    equipo: ["José Luis", "Vanesa", "José Manuel", "Roxana", "Andrés"],
    practicantes: ["Milena", "Montserrat", "Belén", "Johan", "Joaquín", "Mayela", "Ileana", "Daniel", "Mey"],
  },
});
const DATOS = ["centros", "candidatos", "entrevistas", "estudiantes", "documentos", "historial", "notas"];

// El portal arranca vacío: los datos llegan del servidor (sync.js) o, en modo demo, de cargarDemo().
export const store = reactive({
  tema,
  ...ajustesPorDefecto(),
  toasts: [],
  fichaTab: "personal",
  ...Object.fromEntries(DATOS.map((k) => [k, []])),
});

export function vaciarDatos() {
  for (const k of DATOS) store[k].splice(0);
  Object.assign(store, ajustesPorDefecto());
}
/** Rellena el portal con los datos de demostración (inventados). */
export function cargarDemo() {
  const d = crearDatos();
  for (const k of DATOS) store[k].splice(0, store[k].length, ...d[k]);
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

export const estadoDe = (k) => store.estados.find((e) => e.k === k) || { k, n: k, c: "var(--text-400)", cd: "var(--text-600)" };
export const centroDe = (id) => store.centros.find((c) => c.id === id) || null;
export const candDe = (id) => store.candidatos.find((c) => c.id === Number(id)) || null;
export const nombreCompleto = (c) => (c ? `${c.nombre} ${c.apellidos}` : "—");
export const entrevistasDe = (candId) => store.entrevistas.filter((e) => e.candId === candId).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
export const entrevistaDe = (candId) => entrevistasDe(candId)[0] || null;
export const estudianteDe = (candId) => store.estudiantes.find((e) => e.candId === candId) || null;
export const docsDe = (candId) => store.documentos.filter((d) => d.candId === candId);
export const histDe = (candId) => store.historial.filter((h) => h.candId === candId).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora) || b.id - a.id);
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

export function toast(msg, tipo = "ok") {
  const id = nuevoId();
  store.toasts.push({ id, msg, tipo });
  setTimeout(() => { store.toasts = store.toasts.filter((t) => t.id !== id); }, tipo === "error" ? 6000 : 3200);
}

export function addHist(candId, tipo, texto, autor = miNombre()) {
  const ahora = new Date();
  store.historial.push({ id: nuevoId(), candId, fecha: HOY_ISO, hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`, tipo, texto, autor });
}

export function cambiarEstado(c, k, { silencioso = false } = {}) {
  if (!c || c.estado === k) return;
  const antes = estadoDe(c.estado).n;
  c.estado = k;
  addHist(c.id, "estado", `Estado: ${antes} → ${estadoDe(k).n}`);
  if (!silencioso) toast(`${nombreCompleto(c)} pasa a «${estadoDe(k).n}»`);
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

/** Borra la ficha de un candidato y todo lo suyo (entrevistas, prácticas, documentos, historial y notas).
 *  Devuelve los ids de archivo del servidor para borrarlos también. */
export function borrarCandidato(c) {
  const id = c.id;
  const archivos = store.documentos.filter((d) => d.candId === id && d.archivoId).map((d) => d.archivoId);
  for (const k of ["entrevistas", "documentos", "historial", "notas", "estudiantes"]) {
    const queda = store[k].filter((x) => x.candId !== id);
    if (queda.length !== store[k].length) store[k].splice(0, store[k].length, ...queda);
  }
  const i = store.candidatos.findIndex((x) => x.id === id);
  if (i >= 0) store.candidatos.splice(i, 1);
  return archivos;
}

/** Número de entrevista de esa persona (1.ª, 2.ª…) por orden de fecha, sin contar las canceladas. */
export function rondaDe(e) {
  const l = store.entrevistas.filter((x) => x.candId === e.candId && x.estado !== "Cancelada").sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const i = l.findIndex((x) => x.id === e.id);
  return i >= 0 ? i + 1 : 1;
}

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
