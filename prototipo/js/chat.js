// Chat interno del equipo: una ventana flotante con un único canal de mensajes.
// Se consulta cada pocos segundos mientras está abierta (y cada medio minuto cerrada, para el aviso de no leídos).
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { sesion, pedir, esAdmin, urlFichero, crearConArchivo } from "./api.js";
import { Ic, Avatar } from "./ui.js";

const K_VISTO = "emadrid-chat-visto";
const EMOJIS = "😀 😂 😊 😍 🥰 😎 🤔 😅 😢 😮 😡 🙏 👍 👎 👏 🙌 💪 🤝 👋 ✌️ 👀 🎉 🔥 ✅ ❌ ⚠️ ❤️ 💙 ⭐ 💡 📌 📎 📅 🕒 📞 📧 📄 ☕ 🍕 🚀".split(" ");
const leerVisto = () => { try { return localStorage.getItem(K_VISTO) || ""; } catch (_) { return ""; } };
const ponerVisto = (v) => { try { localStorage.setItem(K_VISTO, v); } catch (_) { /* sin almacenamiento */ } };

export const ChatEquipo = {
  components: { Ic, Avatar },
  setup() {
    const abierto = ref(false), texto = ref(""), lista = ref(null), enviando = ref(false), error = ref("");
    // Adjunto (captura o archivo): se elige con el clip o se pega con Ctrl+V
    const adjunto = ref(null), vistaAdj = ref(""), entradaArchivo = ref(null);
    const urls = reactive({}); // id del mensaje -> enlace temporal del adjunto
    const esImagen = (n) => /\.(png|jpe?g|webp|gif)$/i.test(n || "");
    const ponerAdjunto = (f) => {
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { error.value = "El archivo pesa más de 10 MB."; return; }
      adjunto.value = f; vistaAdj.value = f.type.startsWith("image/") ? URL.createObjectURL(f) : "";
    };
    const quitarAdjunto = () => { if (vistaAdj.value) URL.revokeObjectURL(vistaAdj.value); adjunto.value = null; vistaAdj.value = ""; };
    const elegirArchivo = (e) => { ponerAdjunto(e.target.files[0]); e.target.value = ""; };
    const pegar = (e) => { const it = [...(e.clipboardData?.items || [])].find((x) => x.kind === "file"); if (it) { e.preventDefault(); const f = it.getAsFile(); ponerAdjunto(new File([f], f.name && f.name !== "image.png" ? f.name : "captura-" + Date.now() + ".png", { type: f.type })); } };
    async function cargarUrls() {
      for (const m of estado.mensajes) if (m.archivo && !urls[m.id]) { try { urls[m.id] = await urlFichero("chat", m.id, m.archivo); } catch (_) { /* se reintenta */ } }
    }
    const estado = reactive({ mensajes: [], visto: leerVisto(), vistos: [] });
    // Responder a un mensaje concreto y panel de emojis
    const respondiendo = ref(null), emojis = ref(false), caja = ref(null);
    const porId = computed(() => Object.fromEntries(estado.mensajes.map((m) => [m.id, m])));
    const resumen = (m) => (m ? (m.texto ? m.texto.slice(0, 90) + (m.texto.length > 90 ? "…" : "") : m.archivo ? (esImagen(m.archivo) ? "📷 Captura" : "📎 Archivo") : "") : "Mensaje borrado");
    const responder = (m) => { respondiendo.value = m; nextTick(() => caja.value?.focus()); };
    const irA = (id) => { const el = lista.value?.querySelector(`[data-id="${id}"]`); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("chat-resalta"); setTimeout(() => el.classList.remove("chat-resalta"), 1400); } };
    const ponerEmoji = (e) => {
      const el = caja.value; const t = texto.value;
      if (el && el.selectionStart != null) { const a = el.selectionStart, b = el.selectionEnd; texto.value = t.slice(0, a) + e + t.slice(b); nextTick(() => { el.focus(); el.selectionStart = el.selectionEnd = a + e.length; }); }
      else texto.value = t + e;
    };
    // «Visto por»: cada persona guarda hasta qué mensaje ha visto
    let miVisto = null;
    async function cargarVistos() { try { const d = await pedir("GET", "api/collections/chat_visto/records?perPage=100&skipTotal=1"); estado.vistos = d.items; miVisto = d.items.find((v) => v.usuario === yo.value) || miVisto; } catch (_) { /* sin «visto» */ } }
    async function guardarVisto(ultimo) {
      if (!ultimo || (miVisto && miVisto.ultimo >= ultimo)) return;
      const datos = { usuario: yo.value, nombre: sesion.usuario.name || sesion.usuario.email, ultimo };
      try { miVisto = miVisto ? await pedir("PATCH", `api/collections/chat_visto/records/${miVisto.id}`, { ultimo }) : await pedir("POST", "api/collections/chat_visto/records", datos); }
      catch (_) { await cargarVistos(); }
    }
    // Quién ha visto cada uno de mis mensajes (se enseña solo en el último mío)
    const ultimoMio = computed(() => [...estado.mensajes].reverse().find((m) => m.autor === yo.value)?.id);
    const vistoPor = (m) => estado.vistos.filter((v) => v.usuario !== yo.value && v.ultimo >= m.created).map((v) => String(v.nombre || "").split(" ")[0]);
    const yo = computed(() => sesion.usuario?.id);
    const noLeidos = computed(() => estado.mensajes.filter((m) => m.created > estado.visto && m.autor !== yo.value).length);
    let t = null;
    const bajar = () => nextTick(() => { const el = lista.value; if (el) el.scrollTop = el.scrollHeight; });
    const marcarVisto = () => { const u = estado.mensajes[estado.mensajes.length - 1]; if (u) { estado.visto = u.created; ponerVisto(u.created); guardarVisto(u.created); } };
    async function cargar() {
      if (sesion.modo !== "servidor" || !sesion.usuario) return;
      try {
        const d = await pedir("GET", "api/collections/chat/records?perPage=200&sort=-created&skipTotal=1");
        const nuevos = d.items.reverse();
        const antes = estado.mensajes.length ? estado.mensajes[estado.mensajes.length - 1].id : "";
        estado.mensajes = nuevos; error.value = "";
        if (abierto.value) { cargarUrls(); cargarVistos(); }
        if (abierto.value) { marcarVisto(); if (antes !== (nuevos[nuevos.length - 1]?.id || "")) bajar(); }
      } catch (e) { error.value = "No se pudo cargar el chat."; }
    }
    const programar = () => { clearTimeout(t); t = setTimeout(async () => { if (!document.hidden) await cargar(); programar(); }, abierto.value ? 4000 : 30000); };
    const alternar = async () => { abierto.value = !abierto.value; if (abierto.value) { await cargar(); marcarVisto(); bajar(); } programar(); };
    async function enviar() {
      const x = texto.value.trim(); if ((!x && !adjunto.value) || enviando.value) return;
      enviando.value = true;
      try {
        const nombre = sesion.usuario.name || sesion.usuario.email;
        const resp = respondiendo.value?.id || "";
        if (adjunto.value) { const fd = new FormData(); fd.append("autor", yo.value); fd.append("nombre", nombre); fd.append("texto", x); fd.append("respuesta", resp); fd.append("archivo", adjunto.value); await crearConArchivo("chat", fd); }
        else await pedir("POST", "api/collections/chat/records", { autor: yo.value, nombre, texto: x, respuesta: resp });
        texto.value = ""; quitarAdjunto(); respondiendo.value = null; emojis.value = false; await cargar(); bajar();
      }
      catch (e) { error.value = "No se pudo enviar: " + e.message; }
      finally { enviando.value = false; }
    }
    async function borrar(m) { try { await pedir("DELETE", `api/collections/chat/records/${m.id}`); await cargar(); } catch (_) { error.value = "No se pudo borrar."; } }
    const teclas = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } else if (e.key === "Escape") { respondiendo.value = null; emojis.value = false; } };
    const hora = (iso) => { const d = new Date(String(iso).replace(" ", "T")); const hoy = new Date().toDateString() === d.toDateString(); return (hoy ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · ") + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); };
    const partes = (n) => { const p = String(n || "?").split(" "); return { nombre: p[0], apellidos: p.slice(1).join(" ") }; };
    onMounted(() => { cargar(); programar(); });
    onUnmounted(() => clearTimeout(t));
    return { EMOJIS, respondiendo, emojis, caja, porId, resumen, responder, irA, ponerEmoji, ultimoMio, vistoPor, bajar, adjunto, vistaAdj, entradaArchivo, urls, esImagen, quitarAdjunto, elegirArchivo, pegar, abierto, texto, lista, enviando, error, estado, yo, noLeidos, alternar, enviar, borrar, teclas, hora, partes, esAdmin, sesion };
  },
  template: `<div v-if="sesion.modo === 'servidor' && sesion.usuario" class="chat-eq">
    <div v-if="abierto" class="chat-panel">
      <div class="chat-cab"><Ic n="chat" :s="18" /><b>Chat del equipo</b><button class="chat-cerrar" title="Cerrar" @click="alternar">×</button></div>
      <div ref="lista" class="chat-lista">
        <p v-if="!estado.mensajes.length" class="sub" style="text-align:center;margin-top:30px">Todavía no hay mensajes. Escribe el primero.</p>
        <div v-for="m in estado.mensajes" :key="m.id" :data-id="m.id" class="chat-msg" :class="{mio: m.autor === yo}">
          <Avatar v-if="m.autor !== yo" v-bind="partes(m.nombre)" :s="28" />
          <div class="chat-burbuja">
            <div class="chat-meta"><b v-if="m.autor !== yo">{{ m.nombre }}</b><span>{{ hora(m.created) }}</span><button class="chat-resp" title="Responder" @click="responder(m)">↩</button><button v-if="m.autor === yo || esAdmin()" class="chat-borrar" title="Borrar mensaje" @click="borrar(m)">×</button></div>
            <button v-if="m.respuesta" class="chat-cita" @click="irA(m.respuesta)"><b>{{ porId[m.respuesta]?.nombre || "" }}</b>{{ resumen(porId[m.respuesta]) }}</button>
            <a v-if="m.archivo && esImagen(m.archivo) && urls[m.id]" :href="urls[m.id]" target="_blank" rel="noopener" class="chat-img"><img :src="urls[m.id]" alt="Captura" @load="bajar" /></a>
            <a v-else-if="m.archivo" :href="urls[m.id] || '#'" target="_blank" rel="noopener" class="chat-file"><Ic n="documentos" :s="15" />{{ m.archivo.replace(/_[a-z0-9]{10}(\.[a-z0-9]+)$/i, "$1") }}</a>
            <div v-if="m.texto" class="chat-texto">{{ m.texto }}</div>
            <div v-if="m.id === ultimoMio && vistoPor(m).length" class="chat-visto">✓✓ Visto por {{ vistoPor(m).join(", ") }}</div>
          </div>
        </div>
      </div>
      <p v-if="error" class="chat-error">{{ error }}</p>
      <div v-if="respondiendo" class="chat-adj chat-respondiendo"><span class="grow"><b>Respondiendo a {{ respondiendo.nombre }}</b><br>{{ resumen(respondiendo) }}</span><button class="chat-borrar" title="Cancelar" @click="respondiendo=null">×</button></div>
      <div v-if="emojis" class="chat-emojis"><button v-for="e in EMOJIS" :key="e" @click="ponerEmoji(e)">{{ e }}</button></div>
      <div v-if="adjunto" class="chat-adj"><img v-if="vistaAdj" :src="vistaAdj" alt="" /><Ic v-else n="documentos" :s="18" /><span class="grow">{{ adjunto.name }}</span><button class="chat-borrar" title="Quitar" @click="quitarAdjunto">×</button></div>
      <div class="chat-pie"><button class="chat-clip" title="Adjuntar captura o archivo" @click="entradaArchivo.click()"><Ic n="upload" :s="18" /></button><input ref="entradaArchivo" type="file" accept="image/*,application/pdf" hidden @change="elegirArchivo" /><button class="chat-clip" title="Emojis" @click="emojis = !emojis">😊</button><textarea ref="caja" v-model="texto" rows="2" class="inp" placeholder="Escribe un mensaje… (Intro para enviar, Ctrl+V para pegar una captura)" @keydown="teclas" @paste="pegar"></textarea><button class="btn btn-ink" :disabled="(!texto.trim() && !adjunto) || enviando" @click="enviar">Enviar</button></div>
    </div>
    <button class="chat-boton" :title="abierto ? 'Cerrar el chat' : 'Chat del equipo'" @click="alternar"><Ic n="chat" :s="22" /><span v-if="noLeidos && !abierto" class="chat-badge">{{ noLeidos > 9 ? '9+' : noLeidos }}</span></button>
  </div>`,
};
