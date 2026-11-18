// Plantillas de mensajes de WhatsApp y correo.
// El portal NO envía nada: abre WhatsApp o el correo de quien pulsa, con el texto ya escrito.
// Los textos se editan en Ajustes → Mensajes. Variables: {nombre} {apellidos} {centro} {fecha} {hora} {lugar} {entrevistador} {inicio} {horario} {firma}
import { reactive } from "vue";
import { store, entrevistasDe, estudianteDe, centroDe, addHist, toast, nombreCompleto } from "./store.js";
import { abrirMenu, menuCtx, Modal, Ic } from "./ui.js";
import { registrar, enviarCorreo, sesion } from "./api.js";
import { urlWhatsApp, fLarga, HOY_ISO, normal } from "./util.js";

import { DIRECCION, FIRMA_INICIAL, plantillasIniciales } from "./data.js";
export { DIRECCION, FIRMA_INICIAL, plantillasIniciales };
export const VARIABLES = ["nombre", "apellidos", "centro", "fecha", "hora", "donde", "lugar", "lugar_oficina", "entrevistador", "inicio", "horario", "contacto", "titulacion", "horas", "periodo", "firma"];

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
    donde: e ? (e.modalidad === "Online" ? "Online (te enviaremos el enlace)" : "Presencial · " + DIRECCION) : "",
    inicio: est ? fechaLarga(est.inicio) : "", horario: est ? `${est.horaIni}–${est.horaFin}` : "",
    contacto: centroDe(c.centroId)?.contacto || "equipo de prácticas", titulacion: c.titulacion || "",
    horas: String(est?.horas || c.horas || ""), periodo: est ? `del ${fechaLarga(est.inicio)} al ${fechaLarga(est.fin)}` : "fechas por confirmar",
    firma: store.firma || FIRMA_INICIAL,
  };
}
export const rellenar = (texto, v) => String(texto || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

/** ¿Se puede rellenar esta plantilla con los datos de la persona? */
function aplicable(p, c) {
  if (p.uso === "entrevista") return !!entrevistaPara(c);
  if (p.uso === "estudiante") return !!estudianteDe(c.id);
  if (p.uso === "centro") return !!centroDe(c.centroId)?.email;
  return true;
}

function abrir(canal, c, p) {
  const v = variables(c);
  const texto = p ? rellenar(p.texto, v) : "";
  if (canal === "whatsapp" && p?.destino === "centro") return toast("Esta plantilla es para el correo del centro.", "error");
  if (canal === "whatsapp") {
    const url = urlWhatsApp(c.tel, texto);
    if (!url) return toast("Esta persona no tiene un teléfono válido en su ficha.", "error");
    window.open(url, "_blank", "noopener");
  } else {
    const aCentro = p?.destino === "centro", dest = aCentro ? centroDe(c.centroId)?.email : c.email;
    if (!dest) return toast(aCentro ? "El centro no tiene correo en su ficha." : "Esta persona no tiene correo en su ficha.", "error");
    // El correo se revisa antes de enviarlo: desde info@ (servidor) o con el correo de cada uno
    Object.assign(redactor, { abierto: true, c, para: dest, asunto: p ? rellenar(p.asunto, v) : "", texto, plantilla: p ? p.nombre : "", enviando: false, error: "" });
    return;
  }
  const que = p ? `«${p.nombre}»` : "mensaje en blanco";
  addHist(c.id, "nota", `${canal === "whatsapp" ? "WhatsApp" : "Correo"} abierto con ${que}`);
  registrar(canal === "whatsapp" ? "Abrió WhatsApp con una plantilla" : "Abrió el correo con una plantilla", nombreCompleto(c));
}

// --- Ventana para revisar y enviar un correo ---
export const redactor = reactive({ abierto: false, c: null, para: "", asunto: "", texto: "", plantilla: "", enviando: false, error: "" });
const anotar = (c, como) => {
  addHist(c.id, "nota", `Correo ${como}${redactor.plantilla ? " con «" + redactor.plantilla + "»" : ""}: ${redactor.asunto}`);
  registrar("Correo " + como, nombreCompleto(c));
};
export const RedactorCorreo = {
  components: { Modal, Ic },
  setup() {
    const enServidor = () => sesion.modo === "servidor";
    async function enviar() {
      if (!redactor.para || !redactor.asunto.trim() || !redactor.texto.trim()) return (redactor.error = "Falta el destinatario, el asunto o el texto.");
      redactor.enviando = true; redactor.error = "";
      try { await enviarCorreo(redactor); anotar(redactor.c, "enviado desde info@"); toast("Correo enviado desde info@gestoriaemadrid.com"); redactor.abierto = false; }
      catch (e) { redactor.error = e.message; }
      finally { redactor.enviando = false; }
    }
    function abrirEnMiCorreo() {
      location.href = "mailto:" + encodeURI(redactor.para).replace("%40", "@") + "?subject=" + encodeURIComponent(redactor.asunto) + "&body=" + encodeURIComponent(redactor.texto.replace(/\n/g, "\r\n"));
      anotar(redactor.c, "abierto en el correo propio"); redactor.abierto = false;
    }
    return { r: redactor, enviar, abrirEnMiCorreo, enServidor };
  },
  template: `<Modal v-if="r.abierto" :titulo="'Correo a ' + (r.c ? r.c.nombre : '')" :ancho="640" @cerrar="r.abierto=false">
    <div class="fld"><label>Para</label><input class="inp" type="email" v-model.trim="r.para" /></div>
    <div class="fld"><label>Asunto</label><input class="inp" v-model="r.asunto" /></div>
    <div class="fld"><label>Mensaje</label><textarea class="inp redactor-texto" v-model="r.texto" rows="12"></textarea></div>
    <p class="sub"><Ic n="mail" :s="13" /> Se envía desde <b>info@gestoriaemadrid.com</b>; las respuestas llegan a esa bandeja.</p>
    <div v-if="r.error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ r.error }}</span></div>
    <template #pie><button class="btn" @click="abrirEnMiCorreo">Abrir en mi correo</button><button class="btn btn-ink" :disabled="r.enviando || !enServidor()" @click="enviar"><Ic n="mail" :s="15" />{{ r.enviando ? 'Enviando…' : 'Enviar desde info@' }}</button></template>
  </Modal>`,
};

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
