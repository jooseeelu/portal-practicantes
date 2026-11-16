// Plantillas de mensajes de WhatsApp y correo.
// El portal NO envía nada: abre WhatsApp o el correo de quien pulsa, con el texto ya escrito.
// Los textos se editan en Ajustes → Mensajes. Variables: {nombre} {apellidos} {centro} {fecha} {hora} {lugar} {entrevistador} {inicio} {horario} {firma}
import { store, entrevistasDe, estudianteDe, centroDe, addHist, toast, nombreCompleto } from "./store.js";
import { abrirMenu, menuCtx } from "./ui.js";
import { registrar } from "./api.js";
import { urlWhatsApp, fLarga, HOY_ISO, normal } from "./util.js";

import { DIRECCION, FIRMA_INICIAL, plantillasIniciales } from "./data.js";
export { DIRECCION, FIRMA_INICIAL, plantillasIniciales };
export const VARIABLES = ["nombre", "apellidos", "centro", "fecha", "hora", "lugar", "entrevistador", "inicio", "horario", "firma"];

const fechaLarga = (iso) => { const t = fLarga(iso); return t ? t.charAt(0).toLowerCase() + t.slice(1) : ""; };

/** La entrevista de la que habla el mensaje: la próxima abierta, o la más reciente. */
export function entrevistaPara(c) {
  const l = entrevistasDe(c.id);
  const abiertas = l.filter((e) => !["Cancelada", "Realizada"].includes(e.estado) && e.fecha >= HOY_ISO).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return abiertas[0] || l[0] || null;
}

export function variables(c, e = entrevistaPara(c)) {
  const est = estudianteDe(c.id);
  return {
    nombre: c.nombre, apellidos: c.apellidos, centro: centroDe(c.centroId)?.nombre || "",
    fecha: e ? fechaLarga(e.fecha) : "", hora: e?.hora || "",
    lugar: e ? (e.modalidad === "Online" ? " (online; te enviaremos el enlace)" : " en nuestra oficina (" + DIRECCION + ")") : "",
    lugar_oficina: DIRECCION, entrevistador: e?.entrevistador || "",
    inicio: est ? fechaLarga(est.inicio) : "", horario: est ? `${est.horaIni}–${est.horaFin}` : "",
    firma: store.firma || FIRMA_INICIAL,
  };
}
export const rellenar = (texto, v) => String(texto || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

/** ¿Se puede rellenar esta plantilla con los datos de la persona? */
function aplicable(p, c) {
  if (p.uso === "entrevista") return !!entrevistaPara(c);
  if (p.uso === "estudiante") return !!estudianteDe(c.id);
  return true;
}

function abrir(canal, c, p) {
  const v = variables(c);
  const texto = p ? rellenar(p.texto, v) : "";
  if (canal === "whatsapp") {
    const url = urlWhatsApp(c.tel, texto);
    if (!url) return toast("Esta persona no tiene un teléfono válido en su ficha.", "error");
    window.open(url, "_blank", "noopener");
  } else {
    if (!c.email) return toast("Esta persona no tiene correo en su ficha.", "error");
    const asunto = p ? rellenar(p.asunto, v) : "";
    location.href = "mailto:" + encodeURI(c.email).replace("%40", "@") + "?subject=" + encodeURIComponent(asunto) + "&body=" + encodeURIComponent(texto.replace(/\n/g, "\r\n"));
  }
  const que = p ? `«${p.nombre}»` : "mensaje en blanco";
  addHist(c.id, "nota", `${canal === "whatsapp" ? "WhatsApp" : "Correo"} abierto con ${que}`);
  registrar(canal === "whatsapp" ? "Abrió WhatsApp con una plantilla" : "Abrió el correo con una plantilla", nombreCompleto(c));
}

/** Abre el mensaje con una plantilla concreta (por ejemplo, «recordatorio»). */
export function enviarPlantilla(canal, c, id) {
  const p = (store.plantillas || []).find((x) => x.id === id) || plantillasIniciales().find((x) => x.id === id);
  if (p && !aplicable(p, c)) return toast("Faltan datos en la ficha para esta plantilla (por ejemplo, no hay entrevista).", "error");
  abrir(canal, c, p);
}

/** Menú para elegir plantilla; sale junto al botón pulsado (o donde se abrió el menú anterior). */
export function elegirMensaje(canal, c, ev) {
  let x = menuCtx.x, y = menuCtx.y;
  const el = ev?.currentTarget || ev?.target?.closest?.("button");
  if (el?.getBoundingClientRect) { const r = el.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
  const items = [
    ...(store.plantillas || []).map((p) => ({ t: p.nombre, i: canal === "whatsapp" ? "whatsapp" : "mail", desactivado: !aplicable(p, c), f: () => abrir(canal, c, p) })),
    { sep: true },
    { t: "Mensaje en blanco", i: "pencil", f: () => abrir(canal, c, null) },
  ];
  abrirMenu(x, y, items, (canal === "whatsapp" ? "WhatsApp a " : "Correo a ") + c.nombre);
}
