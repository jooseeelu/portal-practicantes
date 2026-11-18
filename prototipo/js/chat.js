// Chat interno del equipo: una ventana flotante con un único canal de mensajes.
// Se consulta cada pocos segundos mientras está abierta (y cada medio minuto cerrada, para el aviso de no leídos).
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { sesion, pedir, esAdmin } from "./api.js";
import { Ic, Avatar } from "./ui.js";

const K_VISTO = "emadrid-chat-visto";
const leerVisto = () => { try { return localStorage.getItem(K_VISTO) || ""; } catch (_) { return ""; } };
const ponerVisto = (v) => { try { localStorage.setItem(K_VISTO, v); } catch (_) { /* sin almacenamiento */ } };

export const ChatEquipo = {
  components: { Ic, Avatar },
  setup() {
    const abierto = ref(false), texto = ref(""), lista = ref(null), enviando = ref(false), error = ref("");
    const estado = reactive({ mensajes: [], visto: leerVisto() });
    const yo = computed(() => sesion.usuario?.id);
    const noLeidos = computed(() => estado.mensajes.filter((m) => m.created > estado.visto && m.autor !== yo.value).length);
    let t = null;
    const bajar = () => nextTick(() => { const el = lista.value; if (el) el.scrollTop = el.scrollHeight; });
    const marcarVisto = () => { const u = estado.mensajes[estado.mensajes.length - 1]; if (u) { estado.visto = u.created; ponerVisto(u.created); } };
    async function cargar() {
      if (sesion.modo !== "servidor" || !sesion.usuario) return;
      try {
        const d = await pedir("GET", "api/collections/chat/records?perPage=200&sort=-created&skipTotal=1");
        const nuevos = d.items.reverse();
        const antes = estado.mensajes.length ? estado.mensajes[estado.mensajes.length - 1].id : "";
        estado.mensajes = nuevos; error.value = "";
        if (abierto.value) { marcarVisto(); if (antes !== (nuevos[nuevos.length - 1]?.id || "")) bajar(); }
      } catch (e) { error.value = "No se pudo cargar el chat."; }
    }
    const programar = () => { clearTimeout(t); t = setTimeout(async () => { if (!document.hidden) await cargar(); programar(); }, abierto.value ? 4000 : 30000); };
    const alternar = async () => { abierto.value = !abierto.value; if (abierto.value) { await cargar(); marcarVisto(); bajar(); } programar(); };
    async function enviar() {
      const x = texto.value.trim(); if (!x || enviando.value) return;
      enviando.value = true;
      try { await pedir("POST", "api/collections/chat/records", { autor: yo.value, nombre: sesion.usuario.name || sesion.usuario.email, texto: x }); texto.value = ""; await cargar(); bajar(); }
      catch (e) { error.value = "No se pudo enviar: " + e.message; }
      finally { enviando.value = false; }
    }
    async function borrar(m) { try { await pedir("DELETE", `api/collections/chat/records/${m.id}`); await cargar(); } catch (_) { error.value = "No se pudo borrar."; } }
    const teclas = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } };
    const hora = (iso) => { const d = new Date(String(iso).replace(" ", "T")); const hoy = new Date().toDateString() === d.toDateString(); return (hoy ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · ") + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); };
    const partes = (n) => { const p = String(n || "?").split(" "); return { nombre: p[0], apellidos: p.slice(1).join(" ") }; };
    onMounted(() => { cargar(); programar(); });
    onUnmounted(() => clearTimeout(t));
    return { abierto, texto, lista, enviando, error, estado, yo, noLeidos, alternar, enviar, borrar, teclas, hora, partes, esAdmin, sesion };
  },
  template: `<div v-if="sesion.modo === 'servidor' && sesion.usuario" class="chat-eq">
    <div v-if="abierto" class="chat-panel">
      <div class="chat-cab"><Ic n="chat" :s="18" /><b>Chat del equipo</b><button class="chat-cerrar" title="Cerrar" @click="alternar">×</button></div>
      <div ref="lista" class="chat-lista">
        <p v-if="!estado.mensajes.length" class="sub" style="text-align:center;margin-top:30px">Todavía no hay mensajes. Escribe el primero.</p>
        <div v-for="m in estado.mensajes" :key="m.id" class="chat-msg" :class="{mio: m.autor === yo}">
          <Avatar v-if="m.autor !== yo" v-bind="partes(m.nombre)" :s="28" />
          <div class="chat-burbuja">
            <div class="chat-meta"><b v-if="m.autor !== yo">{{ m.nombre }}</b><span>{{ hora(m.created) }}</span><button v-if="m.autor === yo || esAdmin()" class="chat-borrar" title="Borrar mensaje" @click="borrar(m)">×</button></div>
            <div class="chat-texto">{{ m.texto }}</div>
          </div>
        </div>
      </div>
      <p v-if="error" class="chat-error">{{ error }}</p>
      <div class="chat-pie"><textarea v-model="texto" rows="2" class="inp" placeholder="Escribe un mensaje… (Intro para enviar)" @keydown="teclas"></textarea><button class="btn btn-ink" :disabled="!texto.trim() || enviando" @click="enviar">Enviar</button></div>
    </div>
    <button class="chat-boton" :title="abierto ? 'Cerrar el chat' : 'Chat del equipo'" @click="alternar"><Ic n="chat" :s="22" /><span v-if="noLeidos && !abierto" class="chat-badge">{{ noLeidos > 9 ? '9+' : noLeidos }}</span></button>
  </div>`,
};
