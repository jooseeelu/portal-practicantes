// Horario de cada practicante según Gentrivo (fichajes). Solo lectura: los cambios se hacen en Gentrivo.
import { reactive } from "vue";
import { sesion, pedir } from "./api.js";
import { normal, HOY_ISO } from "./util.js";

export const gentrivo = reactive({ cargando: false, cargado: false, configurado: false, personas: [], actualizado: "", error: "" });

export const DIAS_SEMANA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const TIPO_CAMBIO = { custom: "Horario distinto", work: "Horario distinto", off: "Libre", absence: "Ausencia", remote: "Teletrabajo" };

let promesa = null;
/** Carga los horarios (el servidor los guarda 10 minutos). En modo demostración no hay Gentrivo. */
export function cargarGentrivo(forzar = false) {
  if (sesion.modo !== "servidor") return Promise.resolve();
  if (promesa && !forzar) return promesa;
  gentrivo.cargando = true;
  gentrivo.error = "";
  promesa = pedir("GET", "api/portal/gentrivo/horarios" + (forzar ? "?refrescar=1" : ""))
    .then((d) => Object.assign(gentrivo, { configurado: !!d.configurado, personas: d.personas || [], actualizado: d.actualizado || "", cargado: true }))
    .catch((e) => { gentrivo.error = e.message || "No se pudo leer Gentrivo."; gentrivo.cargado = true; })
    .finally(() => { gentrivo.cargando = false; });
  return promesa;
}

/** Busca a la persona en Gentrivo: primero por correo y, si no, por nombre completo. */
export function enGentrivo(c) {
  if (!c || !gentrivo.personas.length) return null;
  const mail = String(c.email || "").trim().toLowerCase();
  if (mail) { const p = gentrivo.personas.find((x) => x.email === mail); if (p) return p; }
  const nom = normal(`${c.nombre || ""} ${c.apellidos || ""}`).replace(/\s+/g, " ").trim();
  if (!nom) return null;
  return gentrivo.personas.find((x) => normal(x.nombre).replace(/\s+/g, " ").trim() === nom) || null;
}

/** Texto corto del horario de hoy: "10:00–13:00", "Libre", "Ausencia · examen"… */
export function textoHoy(p) {
  const h = p?.hoy;
  if (!h) return "";
  if (h.tipo === "work" && h.ini) return `${h.ini}–${h.fin}`;
  if (h.tipo === "remote") return `Teletrabajo${h.ini ? ` ${h.ini}–${h.fin}` : ""}`;
  return TIPO_CAMBIO[h.tipo] || "Sin horario";
}

/** ¿Hoy es distinto de lo habitual? (cambio puntual, festivo o permiso) */
export const hoyEsCambio = (p) => p?.hoy?.origen === "exception" || p?.hoy?.origen === "holiday";

/** Cambios de hoy en adelante, ordenados. */
export const proximosCambios = (p) => (p?.cambios || []).filter((x) => x.fecha >= HOY_ISO).sort((a, b) => a.fecha.localeCompare(b.fecha));

/** Semana habitual de lunes a viernes (y fin de semana solo si trabaja). */
export const semana = (p) => (p?.semanal || []).filter((d) => d.dia <= 5 || d.trabaja).sort((a, b) => a.dia - b.dia);
