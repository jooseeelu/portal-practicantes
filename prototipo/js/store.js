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

export function programarEntrevista(c, { fecha, hora, modalidad, entrevistador }) {
  store.entrevistas.push({
    id: nuevoId(), candId: c.id, fecha, hora, modalidad, entrevistador, estado: "Pendiente", notion: true, obs: "", preguntas: [],
    criterios: { conocimientos: { n: null, t: "" }, comunicacion: { n: null, t: "" }, disponibilidad: { n: null, t: "" }, adecuacion: { n: null, t: "" } },
  });
  if (["pendiente-revision", "pendiente-entrevista"].includes(c.estado)) cambiarEstado(c, "entrevista-programada", { silencioso: true });
  addHist(c.id, "entrevista", `Entrevista programada para el ${fecha} a las ${hora} (${modalidad.toLowerCase()})`);
  toast(`Entrevista programada con ${nombreCompleto(c)}`);
}

export { dia, HOY_ISO };
