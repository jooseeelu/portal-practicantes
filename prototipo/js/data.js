// Datos DE DEMOSTRACIÓN (inventados). Nombres, correos (@ejemplo.test) y teléfonos no son reales.
// Los centros, estados, turnos y áreas salen de los Excel de la gestoría.
import { dia, slug, HOY_ISO, laborable } from "./util.js";

export const COLORES = {
  gris: { c: "var(--text-400)", cd: "var(--text-600)", n: "Gris" },
  azul: { c: "var(--info)", cd: "var(--info-dark)", n: "Azul" },
  dorado: { c: "var(--gold-500)", cd: "var(--gold-700)", n: "Dorado" },
  marino: { c: "var(--navy-500)", cd: "var(--navy-500)", n: "Marino" },
  ambar: { c: "var(--amber)", cd: "var(--amber-dark)", n: "Ámbar" },
  verde: { c: "var(--success)", cd: "var(--ok-dark)", n: "Verde" },
  rojo: { c: "var(--danger)", cd: "var(--err-dark)", n: "Rojo" },
  violeta: { c: "var(--violet)", cd: "var(--violet-dark)", n: "Violeta" },
  turquesa: { c: "var(--cyan)", cd: "var(--cyan-dark)", n: "Turquesa" },
};

// Estados de la candidatura (ajustables desde Ajustes). El orden es el del proceso.
export const ESTADOS_INICIALES = [
  ["pendiente-revision", "Pendiente de revisión", "gris"],
  ["pendiente-entrevista", "Pendiente de entrevista", "azul"],
  ["entrevista-programada", "Entrevista programada", "dorado"],
  ["entrevistado", "Entrevistado", "marino"],
  ["en-valoracion", "En valoración", "ambar"],
  ["seleccionado", "Seleccionado", "verde"],
  ["seleccionado-esperando", "Seleccionado · esperando respuesta", "azul"],
  ["no-seleccionado", "No seleccionado", "rojo"],
  ["no-seleccionado-comunicado", "No seleccionado · ya comunicado", "gris"],
  ["en-reserva", "En reserva", "violeta"],
  ["incorporado", "Incorporado", "turquesa"],
  ["finalizado", "Finalizado", "gris"],
  ["retirada", "Candidatura retirada", "gris"],
].map(([k, n, col]) => ({ ...COLORES[col], k, n, col, activo: true }));

// Estados de la cita (los del Excel de entrevistas)
export const ESTADOS_CITA = {
  Pendiente: COLORES.ambar,
  Confirmada: COLORES.verde,
  Realizada: COLORES.marino,
  Cancelada: COLORES.rojo,
  Reprogramada: COLORES.violeta,
};

export const ASESORES = ["Ileana", "Mayela", "Montse", "Milena", "Daniel", "Vanesa"];
export const ENTREVISTADORES = ["Andrés", "Vanesa", "Belén", "José Manuel"];
export const AREAS = ["Marketing/Comercio", "Contabilidad/Fiscalidad", "Administración/Finanzas", "RRHH", "Asistencia a la dirección", "IT/Tecnología"];
export const TURNOS = ["Mañana", "Tarde", "Tarde 2", "Mañana o tarde", "Disponibilidad completa", "Horario personalizado", "Por confirmar"];
export const ORIGENES = ["Centro educativo", "Autopostulado", "Correo", "WhatsApp", "Manual"];
export const HORAS_ENTREVISTA = Array.from({ length: 41 }, (_, i) => { const m = 600 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; });

// --- Centros (los 16 iniciales + los que aparecen en vuestros Excel) ---
const CENTROS = [
  // key, nombre, tipo, responsable, programas, horas, periodos
  ["ue", "Universidad Europea", "Universidad", "Ileana", ["Grado en Marketing", "Grado en Comercio Internacional", "Grado en ADE"], "340 h", "Sep–Jun"],
  ["esic", "ESIC", "Universidad", "Mayela", ["Grado en ADE", "Grado en Marketing", "Máster en Dirección Comercial"], "340 h", "Sep–Jun"],
  ["uam", "Universidad Autónoma de Madrid", "Universidad", "Montse", ["Grado en Economía", "Grado en Finanzas"], "120 h", "Feb–Jun"],
  ["uv", "Universidad Villanueva", "Universidad", "Milena", ["ADE, Finanzas y Contabilidad", "Grado en Derecho"], "340 h", "Sep–Jun"],
  ["ceu", "CEU San Pablo", "Universidad", "Ileana", ["Grado en Comercio Internacional", "Grado en ADE"], "340 h", "Sep–Jun"],
  ["eserp", "ESERP", "Universidad", "Daniel", ["Grado en Marketing", "Grado en ADE"], "340 h", "Todo el año"],
  ["urjc", "URJC", "Universidad", "Mayela", ["Grado en Economía", "Grado en ADE"], "120 h", "Feb–Jun"],
  ["uc3m", "UC3M", "Universidad", "Sin asignar", ["Administración de empresas", "Grado en Finanzas"], "340 h", "Sep–Jun"],
  ["ucjc", "UCJC", "Universidad", "Sin asignar", ["Grado en Marketing", "Marketing, finanzas y administración"], "340 h", "Sep–Jun"],
  ["cunef", "CUNEF Universidad", "Universidad", "Vanesa", ["Grado en Finanzas", "Grado en Economía"], "340 h", "Sep–Jun"],
  ["ucm", "UCM", "Universidad", "Montse", ["Grado en ADE", "Grado en Economía"], "120 h", "Feb–Jun"],
  ["uax", "UAX", "Universidad", "Daniel", ["Grado en ADE"], "120 h", "Sep–Jun"],
  ["valle", "IES Valle Inclán", "FP / Instituto", "Ileana", ["CFGS Administración y Finanzas", "CFGM Gestión Administrativa"], "160 h", "Mar–Jun"],
  ["dali", "IES Salvador Dalí", "FP / Instituto", "Mayela", ["CFGM Gestión Administrativa"], "80 h", "Abr–Jun"],
  ["canaveral", "IES El Cañaveral", "FP / Instituto", "Montse", ["CFGM Gestión Administrativa", "CFGS Asistencia a la Dirección"], "80 h", "Abr–Jun"],
  ["paz", "IES Virgen de la Paz", "FP / Instituto", "Milena", ["CFGS Administración y Finanzas"], "160 h", "Mar–Jun"],
  ["neruda", "IES Pablo Neruda", "FP / Instituto", "Ileana", ["CFGS Gestión de Ventas y Espacios Comerciales"], "160 h", "Mar–Jun"],
  ["tierno", "IES Enrique Tierno Galván", "FP / Instituto", "Sin asignar", ["CFGS Comercio Internacional"], "160 h", "Mar–Jun"],
  ["euroformac", "Euroformac", "FP / Instituto", "Daniel", ["CFGS Asistencia a la Dirección", "CFGS ASIR"], "160 h", "Todo el año"],
  ["cdm", "CDM FP", "FP / Instituto", "Ileana", ["CFGS DAM", "CFGS Marketing y Publicidad"], "340 h", "Todo el año"],
  ["ceac", "CEAC FP", "FP / Instituto", "Daniel", ["FP Gestión contable"], "120 h", "Todo el año"],
  ["adams", "ADAMS", "FP / Instituto", "Milena", ["Formación en gestión administrativa"], "80 h", "Todo el año"],
  ["nascor", "NASCOR", "FP / Instituto", "Mayela", ["Formación en gestión"], "80 h", "Todo el año"],
  ["cesur", "CESUR", "FP / Instituto", "Sin asignar", ["CFGS Administración y Finanzas"], "160 h", "Mar–Jun"],
  ["davante", "DAVANTE MEDAC Fuenlabrada", "FP / Instituto", "Sin asignar", ["CFGS Administración y Finanzas"], "160 h", "Mar–Jun"],
  ["core", "CORE NETWORKS", "FP / Instituto", "Montse", ["Formación en redes"], "80 h", "Todo el año"],
];
const CONTACTOS = ["Mª Carmen Lozano", "Javier Ortuño", "Rosa Beltrán", "Andrés Calleja", "Pilar Ordóñez", "Raúl Zamora", "Elisa Bermejo", "Luis Cañete"];

// --- Candidatos de demostración ---
// [nombre, apellidos, centro, titulación, área, turno, horas, estado, nota, entrevista|null, observaciones]
// entrevista: [díasDesdeHoy, hora, modalidad, entrevistador, estadoCita]
const E = { pr: "pendiente-revision", pe: "pendiente-entrevista", ep: "entrevista-programada", en: "entrevistado", ev: "en-valoracion", se: "seleccionado", ns: "no-seleccionado", re: "en-reserva", in: "incorporado", fi: "finalizado", rt: "retirada" };
const FILAS = [
  ["Lucía", "Moreno Vidal", "ue", "Grado en Marketing", "Marketing", "Mañana", 340, "in", 9, [-28, "10:30", "Presencial", "Andrés", "Realizada"], "Muy trabajadora, encargada de una tienda. Aprende rápido."],
  ["Hugo", "Navarro Peña", "esic", "Grado en ADE", "Administración y Finanzas", "Tarde", 340, "in", 8.5, [-26, "12:00", "Presencial", "Belén", "Realizada"], "Ordenado, aporta ideas y reacciona bien ante el estrés."],
  ["Carla", "Ortega Ruiz", "valle", "CFGS Administración y Finanzas", "Administración", "Mañana", 160, "in", 8, [-35, "11:15", "Presencial", "Vanesa", "Realizada"], "Seria y responsable. Buena comunicación."],
  ["Iván", "Domínguez Sanz", "cesur", "CFGS Gestión de Ventas y Espacios Comerciales", "Marketing", "Tarde", 160, "in", 9.5, [-33, "13:00", "Online", "Andrés", "Realizada"], "Iniciativa y mucha soltura con el cliente."],
  ["Noa", "Campos Ibáñez", "uam", "Grado en Economía", "Finanzas y análisis", "Tarde", 120, "in", 7.5, [-40, "16:00", "Presencial", "Belén", "Realizada"], "Buen nivel de Excel. Algo tímida al principio."],
  ["Mateo", "Gil Herrero", "dali", "CFGM Gestión Administrativa", "Administración", "Mañana", 80, "fi", 8, [-130, "10:30", "Presencial", "Vanesa", "Realizada"], "Prácticas completadas sin incidencias."],
  ["Elena", "Soto Marín", "urjc", "Grado en Economía", "Finanzas y análisis", "Tarde", 120, "fi", 7, [-120, "17:00", "Presencial", "Belén", "Realizada"], "Cumplió el horario y los objetivos."],
  ["Daniela", "Cruz Ferrer", "ceu", "Grado en Comercio Internacional", "Comercio internacional", "Mañana", 340, "se", 9, [-6, "10:30", "Presencial", "Andrés", "Realizada"], "Perfil sobresaliente. Habla inglés con fluidez."],
  ["Pablo", "Rey Alonso", "uc3m", "Administración de empresas", "Administración y documentación", "Tarde", 340, "se", 9.5, [-8, "17:00", "Online", "Vanesa", "Realizada"], "Entrevista excelente; le gustó mucho la gestoría."],
  ["Sara", "Lozano Prieto", "uv", "ADE, Finanzas y Contabilidad", "Marketing y gestión", "Disponibilidad completa", 340, "se", 7.5, [-5, "12:00", "Presencial", "Belén", "Realizada"], "Buena actitud. Disponibilidad total."],
  ["Adrián", "Pardo Cano", "ucjc", "Marketing, finanzas y administración", "Marketing y gestión", "Mañana", 340, "ev", 6.5, [-3, "11:15", "Presencial", "Andrés", "Realizada"], "Interesado pero poco suelto. Ver si encaja en administración."],
  ["Alba", "Medina Ríos", "neruda", "CFGS Gestión de Ventas", "Marketing", "Tarde", 160, "ev", null, [-2, "16:30", "Presencial", "Vanesa", "Realizada"], ""],
  ["Rubén", "Santos Gallego", "davante", "CFGS Administración y Finanzas", "Administración y Finanzas", "Mañana", 160, "ev", null, [-1, "10:30", "Online", "José Manuel", "Realizada"], ""],
  ["Marta", "Vega Cortés", "ucm", "Grado en ADE", "Administración y Finanzas", "Tarde", 340, "en", null, [0, "10:30", "Presencial", "Belén", "Realizada"], ""],
  ["Jorge", "Rubio León", "ue", "Grado en Marketing", "Marketing", "Mañana", 340, "en", null, [0, "12:00", "Presencial", "Andrés", "Realizada"], ""],
  ["Nerea", "Cabrera Soler", "cunef", "Grado en Finanzas", "Finanzas y análisis", "Tarde", 340, "en", null, [-1, "17:30", "Online", "Vanesa", "Realizada"], ""],
  ["Samuel", "Ibarra Vera", "tierno", "CFGS Comercio Internacional", "Comercio internacional", "Mañana", 160, "ep", null, [3, "10:30", "Presencial", "Andrés", "Confirmada"], ""],
  ["Irene", "Calvo Marcos", "eserp", "Grado en Marketing", "Marketing", "Tarde", 340, "ep", null, [3, "16:00", "Online", "Vanesa", "Confirmada"], ""],
  ["Óscar", "Barrios Gómez", "uax", "Grado en ADE", "Administración", "Mañana", 120, "ep", null, [4, "11:15", "Presencial", "Belén", "Pendiente"], ""],
  ["Paula", "Esteban Roca", "nascor", "Formación en gestión", "Administración", "Tarde", 80, "ep", null, [4, "13:00", "Presencial", "José Manuel", "Confirmada"], ""],
  ["Gonzalo", "Ferrer Luna", "canaveral", "CFGM Gestión Administrativa", "Administración", "Mañana", 80, "ep", null, [5, "12:00", "Presencial", "Andrés", "Confirmada"], ""],
  ["Claudia", "Pastor Nieto", "ucjc", "Grado en Marketing", "Marketing", "Por confirmar", 340, "ep", null, [6, "18:30", "Online", "Vanesa", "Reprogramada"], "Pidió cambiar la hora; confirmar por WhatsApp."],
  ["Diego", "Arias Montes", "paz", "CFGS Administración y Finanzas", "Administración", "Mañana", 160, "pe", null, null, ""],
  ["Julia", "Heredia Cruz", "ue", "Grado en Comercio Internacional", "Comercio internacional", "Tarde", 340, "pe", null, null, ""],
  ["Álex", "Mora Delgado", "euroformac", "CFGS Asistencia a la Dirección", "Administración", "Disponibilidad completa", 160, "pe", null, null, ""],
  ["Beatriz", "Sanz Lara", "ceac", "FP Gestión contable", "Administración y Finanzas", "Tarde", 120, "pe", null, null, ""],
  ["Tomás", "Vidal Ortiz", "esic", "Grado en Marketing", "Marketing", "Mañana", 340, "pr", null, null, ""],
  ["Lorena", "Gil Bravo", "uc3m", "Grado en Finanzas", "Finanzas y análisis", "Tarde", 340, "pr", null, null, ""],
  ["Víctor", "Castro Ramos", "cdm", "CFGS DAM", "Operaciones y logística", "Mañana", 340, "pr", null, null, ""],
  ["Aitana", "Flores Pino", null, "Grado en Derecho", "Administración y documentación", "Mañana", 120, "pr", null, null, "Autopostulada: envió el CV por correo."],
  ["Raúl", "Peña Duque", "urjc", "Grado en ADE", "Administración", "Tarde", 120, "ns", 4, [-9, "12:00", "Presencial", "Belén", "Realizada"], "Poca motivación; no encaja con el puesto."],
  ["Natalia", "Ríos Bernal", "cesur", "CFGS Administración", "Administración", "Mañana", 160, "ns", 3.5, [-10, "11:15", "Presencial", "Andrés", "Realizada"], "Sin disponibilidad real en el horario pedido."],
  ["Cristian", "Lara Mena", "uam", "Grado en Economía", "Finanzas y análisis", "Tarde", 340, "re", 8, [-14, "16:00", "Presencial", "Vanesa", "Realizada"], "Muy buen perfil; no hay hueco en tarde hasta enero."],
  ["Eva", "Montoya Sáez", "uv", "ADE", "Administración", "Mañana", 340, "re", 8.5, [-16, "10:30", "Presencial", "Belén", "Realizada"], "Recuperar cuando se abran plazas."],
  ["Sergio", "Mena Aguilar", "ucm", "Grado en ADE", "Administración", "Mañana", 120, "rt", null, [-4, "12:00", "Presencial", "Andrés", "Cancelada"], "Retiró su candidatura: ha encontrado otras prácticas."],
];

// Prácticas: [díaInicio, díaFin, horaIni, horaFin, horas, tutor]
const PRACT = {
  0: [-21, 45, "10:00", "15:00", 340, "Ileana"],
  1: [-14, 50, "15:00", "20:00", 340, "Mayela"],
  2: [-7, 14, "10:00", "15:00", 160, "Montse"],
  3: [-30, 10, "16:00", "20:00", 160, "Daniel"],
  4: [-10, 20, "15:00", "19:00", 120, "Mayela"],
  5: [-150, -100, "10:00", "15:00", 80, "Milena"],
  6: [-140, -110, "15:00", "20:00", 120, "Montse"],
  7: [10, 60, "10:00", "15:00", 340, "Ileana"],
  8: [10, 60, "15:00", "20:00", 340, "Mayela"],
  9: [10, 60, "15:00", "20:00", 340, "Daniel"],
};

const COM = {
  alto: ["Domina los conceptos básicos y tiene ganas de aprender.", "Se expresa con claridad y seguridad.", "Disponibilidad total y buena puntualidad.", "Encaja muy bien con el equipo y el puesto."],
  medio: ["Conocimientos suficientes; necesitará guía al principio.", "Comunicación correcta, algo reservada.", "Disponibilidad limitada a su turno.", "Podría encajar con algo de acompañamiento."],
  bajo: ["Conocimientos justos para el puesto.", "Le cuesta expresarse con soltura.", "Disponibilidad poco clara.", "No termina de encajar con lo que buscamos."],
};
const PROS = {
  alto: ["Iniciativa y ganas de aprender", "Muy buena comunicación", "Disponibilidad total", "Buen nivel de Excel", "Inglés fluido", "Experiencia previa atendiendo clientes", "Puntual y organizado/a"],
  medio: ["Actitud positiva", "Cumple con el horario que pide", "Conocimientos suficientes", "Responsable"],
  bajo: ["Puntual"],
};
const CONTRAS = {
  alto: ["Todavía sin experiencia en una gestoría", "Pide poca flexibilidad de horario"],
  medio: ["Algo reservado/a al principio", "Necesitará guía los primeros días", "Disponibilidad limitada a su turno"],
  bajo: ["Poca motivación por el puesto", "Disponibilidad poco clara", "Conocimientos justos", "Le cuesta expresarse con soltura"],
};
const clamp = (n) => Math.max(0, Math.min(10, Math.round(n * 2) / 2));

export function crearDatos() {
  const centros = CENTROS.map(([key, nombre, tipo, resp, programas, horas, periodos], i) => ({
    id: key, nombre, tipo, responsable: resp, programas: [...programas], horas, periodos,
    contacto: CONTACTOS[i % CONTACTOS.length], email: `practicas@${slug(nombre).replace(/\./g, "")}.ejemplo.test`,
    tel: `91 000 ${String(10 + i).padStart(2, "0")} ${String(20 + i * 3).slice(-2)}`, archivado: key === "core",
    notas: key === "core" ? "El convenio de prácticas se desestimó. Archivado." : "",
  }));
  const candidatos = [], entrevistas = [], estudiantes = [], documentos = [], historial = [], notas = [];
  let nid = 1, did = 1, hid = 1, eid = 1;
  FILAS.forEach((f, i) => {
    const [nombre, apellidos, centro, titulacion, area, turno, horas, est, nota, ent, obs] = f;
    const id = nid++;
    const estado = E[est];
    const banda = nota == null ? null : nota >= 8 ? "alto" : nota >= 6 ? "medio" : "bajo";
    const elegir = (lista, n) => [...new Set(Array.from({ length: n }, (_, k) => lista[(i + k * 2) % lista.length]))];
    const pros = banda ? elegir(PROS[banda], banda === "alto" ? 3 : banda === "medio" ? 2 : 1) : [];
    const contras = banda ? elegir(CONTRAS[banda], banda === "alto" ? i % 2 : 2) : [];
    const c = {
      id, nombre, apellidos, centroId: centro, titulacion, area, turno, horas, estado, nota,
      email: `${slug(nombre)}.${slug(apellidos.split(" ")[0])}@ejemplo.test`, tel: `600 1${String(i).padStart(2, "0")} ${String(300 + i * 7).slice(-3)}`,
      curso: /Grado/.test(titulacion) ? "3.º" : "2.º", disponibilidad: turno, origen: centro ? "Centro educativo" : "Autopostulado",
      obs, pros, contras, creado: dia(ent ? ent[0] - 6 : -(2 + (i % 5))), cv: true,
    };
    candidatos.push(c);
    // entrevista
    if (ent) {
      const q = nota == null ? 7 : nota;
      const band = q >= 8 ? "alto" : q >= 6 ? "medio" : "bajo";
      const realizada = ent[4] === "Realizada";
      const cr = (k, d) => ({ n: realizada && nota != null ? clamp(q + d) : null, t: realizada && nota != null ? COM[band][k] : "" });
      entrevistas.push({
        id: eid++, candId: id, fecha: laborable(dia(ent[0])), hora: ent[1], modalidad: ent[2], entrevistador: ent[3], estado: ent[4],
        criterios: { conocimientos: cr(0, 0), comunicacion: cr(1, 0.5), disponibilidad: cr(2, -0.5), adecuacion: cr(3, 0) },
        preguntas: realizada ? [
          { q: "¿Por qué quieres hacer las prácticas en una gestoría?", a: "Quiere conocer cómo funciona el trabajo administrativo real y aplicar lo estudiado." },
          { q: "¿Qué conocimientos de Excel y herramientas ofimáticas tienes?", a: "Nivel medio-alto; ha usado tablas dinámicas en la carrera." },
          { q: "¿Qué disponibilidad horaria tienes?", a: `Prefiere turno de ${turno === "Mañana" ? "mañana" : turno === "Tarde" ? "tarde" : "mañana o tarde"}.` },
        ] : [],
        obs: realizada ? obs : "", notion: true,
      });
    }
    // documentos
    const nombreArch = `CV_${slug(nombre).replace(/\./g, "")}_${slug(apellidos.split(" ")[0]).replace(/\./g, "")}.pdf`;
    documentos.push({ id: did++, candId: id, nombre: nombreArch, tipo: "Currículum", fecha: c.creado, tam: 180 + ((i * 37) % 220), ext: "pdf" });
    if (i === 4) documentos.push({ id: did++, candId: id, nombre: "CV escaneado (archivo 2023).jpg", tipo: "Currículum", fecha: dia(-60), tam: 1450, ext: "jpg" });
    if (["in", "fi", "se"].includes(est)) {
      documentos.push({ id: did++, candId: id, nombre: est === "se" ? "Convenio de prácticas (pendiente de firma).pdf" : "Convenio de prácticas firmado.pdf", tipo: "Convenio", fecha: dia(-15), tam: 320, ext: "pdf" });
      if (est !== "se") documentos.push({ id: did++, candId: id, nombre: "Anexo de horario.pdf", tipo: "Anexo", fecha: dia(-14), tam: 95, ext: "pdf" });
    }
    // historial
    const base = ent ? ent[0] : -4;
    const h = (d, tipo, texto, autor = "Admin") => historial.push({ id: hid++, candId: id, fecha: dia(d), hora: `${9 + (hid % 8)}:${String((hid * 7) % 60).padStart(2, "0")}`, tipo, texto, autor });
    h(base - 6, "alta", `Currículum recibido (${c.origen.toLowerCase()}) y candidatura registrada`);
    if (est !== "pr") h(base - 5, "estado", "Estado: Pendiente de revisión → Pendiente de entrevista");
    if (ent) {
      h(base - 4, "entrevista", `Entrevista programada para el ${dia(ent[0])} a las ${ent[1]} (${ent[2].toLowerCase()})`);
      if (ent[4] === "Realizada") h(base, "entrevista", `Entrevista realizada por ${ent[3]}`, ent[3]);
      if (ent[4] === "Cancelada") h(base, "entrevista", "Entrevista cancelada: el candidato retira su candidatura");
    }
    if (nota != null) h(base + 1, "valoracion", `Valoración final: ${String(nota).replace(".", ",")}/10`, ent ? ent[3] : "Admin");
    if (["se", "in", "fi"].includes(est)) h(base + 2, "estado", "Estado: En valoración → Seleccionado");
    if (est === "ns") h(base + 2, "estado", "Estado: En valoración → No seleccionado");
    if (est === "re") h(base + 2, "estado", "Estado: En valoración → En reserva (se recupera cuando haya hueco)");
    if (["in", "fi"].includes(est)) h(PRACT[i] ? PRACT[i][0] : base + 10, "incorporacion", "Incorporado como estudiante en prácticas");
    if (est === "fi") h(PRACT[i][1], "estado", "Prácticas finalizadas");
    // estudiante
    if (PRACT[i]) {
      const [a, b, hi, hf, hh, tutor] = PRACT[i];
      estudiantes.push({ candId: id, centroId: centro, inicio: dia(a), fin: dia(b), horaIni: hi, horaFin: hf, horas: hh, tutor, convenio: est !== "se", obs: "" });
    }
  });
  notas.push({ id: 1, candId: 1, autor: "Ileana", fecha: dia(-9), texto: "Muy buena evolución. Valorar ofrecerle contrato tras las prácticas." });
  notas.push({ id: 2, candId: 12, autor: "Vanesa", fecha: dia(-2), texto: "Pendiente de valorar: comentar con Andrés su experiencia previa en ventas." });
  notas.push({ id: 3, candId: 10, autor: "Belén", fecha: dia(-5), texto: "Confirmar si puede empezar el 23/11 en turno de tarde." });
  return { centros, candidatos, entrevistas, estudiantes, documentos, historial, notas, nextId: 1000, hoy: HOY_ISO };
}

// Plantillas de mensajes (WhatsApp y correo). Se editan en Ajustes → Mensajes.
export const DIRECCION = "Calle General Álvarez de Castro 41, Escalera Izquierda, Primera Planta, Despacho 10";
export const FIRMA_INICIAL = "Equipo de prácticas · Gestoría eMadrid";

export const plantillasIniciales = () => [
  { id: "recordatorio", nombre: "Recordatorio de entrevista", uso: "entrevista", asunto: "Recordatorio de tu entrevista · Gestoría eMadrid",
    texto: "Hola {nombre}, te escribimos de Gestoría eMadrid para recordarte tu entrevista de prácticas el {fecha} a las {hora}{lugar}. ¿Nos confirmas que puedes asistir? Gracias.\n\n{firma}" },
  { id: "confirmacion", nombre: "Confirmación de entrevista", uso: "entrevista", asunto: "Confirmación de tu entrevista · Gestoría eMadrid",
    texto: "Hola {nombre}, te confirmamos tu entrevista de prácticas en Gestoría eMadrid el {fecha} a las {hora}{lugar}. Si no puedes asistir, avísanos con tiempo, por favor.\n\n{firma}" },
  { id: "documentacion", nombre: "Pedir documentación", uso: "general", asunto: "Documentación para tus prácticas · Gestoría eMadrid",
    texto: "Hola {nombre}, para seguir con tu proceso de prácticas en Gestoría eMadrid necesitamos que nos envíes tu currículum actualizado y los datos de tu centro educativo. Gracias.\n\n{firma}" },
  { id: "bienvenida", nombre: "Bienvenida a las prácticas", uso: "estudiante", asunto: "Bienvenida a tus prácticas · Gestoría eMadrid",
    texto: "Hola {nombre}, ¡te damos la bienvenida a las prácticas en Gestoría eMadrid! Empiezas el {inicio} con horario {horario}. Te esperamos en {lugar_oficina}.\n\n{firma}" },
];

