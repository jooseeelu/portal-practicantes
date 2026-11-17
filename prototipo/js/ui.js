import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { store, estadoDe } from "./store.js";
import { iniciales, hash, normal } from "./util.js";

export const ICONS = {
  inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  candidatos: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.7-5.4-4-6.5"/>',
  entrevistas: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  estudiantes: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  centros: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20M8 8h3M8 12h3M8 16h3"/>',
  documentos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  tabla: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  tarjetas: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  kanban: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sync: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16M21 21v-5h-5"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  filtros: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};

export const Ic = {
  props: { n: String, s: { type: Number, default: 18 } },
  setup: () => ({ ICONS }),
  template: `<svg :width="s" :height="s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="ICONS[n]"></svg>`,
};

export const Chip = {
  props: { k: String, texto: String, c: String, cd: String },
  setup(p) {
    const e = computed(() => (p.k ? estadoDe(p.k) : { n: p.texto, c: p.c, cd: p.cd }));
    return { e };
  },
  template: `<span class="chip" :style="{'--c': e.c, '--cd': e.cd}"><i></i>{{ e.n }}</span>`,
};

const PALETA = ["var(--navy-300)", "var(--cyan)", "var(--violet)", "var(--gold-500)", "var(--success)", "var(--amber)", "var(--danger)"];
/** Avatar: la foto de la persona si la tiene; si no, sus iniciales. */
export const Avatar = {
  props: { nombre: String, apellidos: String, foto: String, s: { type: Number, default: 34 } },
  setup(p) {
    const col = computed(() => PALETA[hash(p.nombre + p.apellidos) % PALETA.length]);
    // Si no se pasa la foto, se busca la del candidato con ese nombre (así sale en todos los listados)
    const img = computed(() => p.foto || store.candidatos.find((c) => c.nombre === p.nombre && c.apellidos === p.apellidos)?.foto || "");
    return { col, img, ini: computed(() => iniciales(p.nombre, p.apellidos)) };
  },
  template: `<span class="avatar" :style="{width: s+'px', height: s+'px', fontSize: (s*0.38)+'px', '--c': col}"><img v-if="img" :src="img" alt="" /><template v-else>{{ ini }}</template></span>`,
};

/** Lee una imagen elegida por el usuario y la devuelve recortada en cuadrado (256 px) como data URL. */
export function leerFoto(archivo) {
  return new Promise((ok, mal) => {
    if (!archivo || !/^image\//.test(archivo.type)) return mal(new Error("Elige una imagen (JPG o PNG)."));
    const img = new Image();
    img.onload = () => {
      const l = Math.min(img.width, img.height), c = document.createElement("canvas");
      c.width = c.height = 256;
      c.getContext("2d").drawImage(img, (img.width - l) / 2, (img.height - l) / 2, l, l, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => mal(new Error("No se pudo leer la imagen."));
    img.src = URL.createObjectURL(archivo);
  });
}

/** Número que cuenta hasta su valor al aparecer. */
export const Num = {
  props: { v: { type: Number, default: 0 } },
  setup(p) {
    const n = ref(0);
    let raf = 0;
    const animar = (hasta) => {
      cancelAnimationFrame(raf);
      const desde = n.value, t0 = performance.now(), dur = 700;
      const paso = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); n.value = Math.round(desde + (hasta - desde) * e); if (k < 1) raf = requestAnimationFrame(paso); };
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) n.value = hasta; else raf = requestAnimationFrame(paso);
    };
    onMounted(() => animar(p.v));
    watch(() => p.v, animar);
    onUnmounted(() => cancelAnimationFrame(raf));
    return { n };
  },
  template: `<b>{{ n }}</b>`,
};

/** Valoración 0–10 con indicadores discretos (10 marcas, admite medios puntos). */
export const Nota = {
  props: { v: { type: [Number, null], default: null }, grande: Boolean },
  setup(p) {
    const tono = computed(() => (p.v == null ? "" : p.v >= 8 ? "alta" : p.v >= 6 ? "media" : p.v >= 4 ? "baja" : "muy-baja"));
    const pip = (k) => (p.v >= k ? "lleno" : p.v >= k - 0.5 ? "medio" : "");
    return { tono, pip, fmt: (v) => String(v).replace(".", ",") };
  },
  template: `<span v-if="v!=null" class="nota" :class="[tono, {grande}]"><b>{{ fmt(v) }}</b><span class="pips"><i v-for="k in 10" :key="k" :class="pip(k)"></i></span></span><span v-else class="muted">—</span>`,
};

export const Modal = {
  props: { titulo: String, ancho: { type: Number, default: 560 } },
  emits: ["cerrar"],
  setup(_, { emit }) {
    const tecla = (e) => { if (e.key === "Escape") emit("cerrar"); };
    onMounted(() => window.addEventListener("keydown", tecla));
    onUnmounted(() => window.removeEventListener("keydown", tecla));
  },
  components: { Ic },
  template: `<Teleport to="body"><div class="modal-bg" @mousedown.self="$emit('cerrar')"><div class="modal" :style="{maxWidth: ancho+'px'}" role="dialog" aria-modal="true">
    <header><h3>{{ titulo }}</h3><button class="icon-btn" @click="$emit('cerrar')" aria-label="Cerrar"><Ic n="x" /></button></header>
    <div class="modal-body"><slot /></div><footer v-if="$slots.pie"><slot name="pie" /></footer></div></div></Teleport>`,
};

export const Drawer = {
  props: { titulo: String },
  emits: ["cerrar"],
  setup(_, { emit }) {
    const tecla = (e) => { if (e.key === "Escape") emit("cerrar"); };
    onMounted(() => window.addEventListener("keydown", tecla));
    onUnmounted(() => window.removeEventListener("keydown", tecla));
  },
  components: { Ic },
  template: `<Teleport to="body"><div class="drawer-bg" @mousedown.self="$emit('cerrar')"><aside class="drawer"><header><h3>{{ titulo }}</h3><button class="icon-btn" @click="$emit('cerrar')" aria-label="Cerrar"><Ic n="x" /></button></header><div class="drawer-body"><slot /></div></aside></div></Teleport>`,
};

/** Desplegable con buscador (como el del CRM): se escribe y filtra sin importar tildes. */
export const SelectBuscable = {
  props: {
    modelValue: { default: "" }, opciones: { type: Array, default: () => [] },
    etiquetaTodos: { type: String, default: "" }, placeholder: { type: String, default: "Escribe para buscar…" }, vacio: { type: String, default: "Seleccionar…" },
  },
  emits: ["update:modelValue"],
  components: { Ic },
  setup(p, { emit }) {
    const abierto = ref(false), q = ref(""), raiz = ref(null), inp = ref(null), act = ref(0);
    const lista = computed(() => {
      const base = p.etiquetaTodos ? [{ valor: "", etiqueta: p.etiquetaTodos }, ...p.opciones] : p.opciones;
      const n = normal(q.value);
      return n ? base.filter((o) => normal(o.etiqueta).includes(n)) : base;
    });
    const actual = computed(() => { const o = (p.etiquetaTodos ? [{ valor: "", etiqueta: p.etiquetaTodos }] : []).concat(p.opciones).find((x) => x.valor === p.modelValue); return o ? o.etiqueta : p.vacio; });
    const abrir = async () => { abierto.value = true; q.value = ""; act.value = 0; await nextTick(); inp.value?.focus(); };
    const elegir = (o) => { emit("update:modelValue", o.valor); abierto.value = false; };
    const teclas = (e) => {
      if (e.key === "ArrowDown") { act.value = Math.min(act.value + 1, lista.value.length - 1); e.preventDefault(); }
      else if (e.key === "ArrowUp") { act.value = Math.max(act.value - 1, 0); e.preventDefault(); }
      else if (e.key === "Enter" && lista.value[act.value]) { elegir(lista.value[act.value]); e.preventDefault(); }
      else if (e.key === "Escape") abierto.value = false;
    };
    const fuera = (e) => { if (raiz.value && !raiz.value.contains(e.target)) abierto.value = false; };
    onMounted(() => document.addEventListener("mousedown", fuera));
    onUnmounted(() => document.removeEventListener("mousedown", fuera));
    return { abierto, q, raiz, inp, act, lista, actual, abrir, elegir, teclas };
  },
  template: `<div class="selbus" ref="raiz"><button type="button" class="inp selbus-btn" :class="{vacio: modelValue===''&&!etiquetaTodos}" @click="abrir"><span>{{ actual }}</span><Ic n="chevD" :s="14" /></button>
    <div v-if="abierto" class="selbus-pop"><input ref="inp" v-model="q" class="inp" :placeholder="placeholder" @keydown="teclas" @input="act=0" />
    <ul><li v-for="(o,i) in lista" :key="o.valor" :class="{act: i===act, sel: o.valor===modelValue}" @mousedown.prevent="elegir(o)" @mousemove="act=i">{{ o.etiqueta }}</li><li v-if="!lista.length" class="vacio">Sin resultados</li></ul></div></div>`,
};

export const Dropzone = {
  props: { texto: { type: String, default: "Arrastra aquí los archivos o haz clic para elegirlos" }, compacto: Boolean, accept: { type: String, default: ".pdf,.doc,.docx,.jpg,.jpeg,.png" } },
  emits: ["archivos"],
  components: { Ic },
  setup(_, { emit }) {
    const sobre = ref(false), inp = ref(null);
    const soltar = (e) => { sobre.value = false; const f = [...(e.dataTransfer?.files || [])]; if (f.length) emit("archivos", f); };
    const elegir = (e) => { const f = [...e.target.files]; if (f.length) emit("archivos", f); e.target.value = ""; };
    return { sobre, inp, soltar, elegir };
  },
  template: `<div class="dropzone" :class="{sobre, compacto}" @dragover.prevent="sobre=true" @dragleave="sobre=false" @drop.prevent="soltar" @click="inp.click()" tabindex="0" @keydown.enter="inp.click()">
    <Ic n="upload" :s="compacto?18:26" /><div><b>{{ texto }}</b><small>PDF, Word o imágenes · también currículums escaneados</small></div><input ref="inp" type="file" multiple :accept="accept" hidden @change="elegir" /></div>`,
};

export const Toasts = {
  components: { Ic },
  setup: () => ({ store }),
  template: `<div class="toasts" aria-live="polite"><div v-for="t in store.toasts" :key="t.id" class="toast" :class="[t.tipo, {con: t.accion}]"><Ic :n="t.tipo==='error'?'alert':'check'" :s="16" /><span>{{ t.msg }}</span><button v-if="t.accion" class="toast-accion" @click="t.accion.f(); store.toasts = store.toasts.filter((x) => x.id !== t.id)">{{ t.accion.t }}</button></div></div>`,
};

export const Vacio = {
  props: { icono: { type: String, default: "search" }, titulo: String, texto: String },
  components: { Ic },
  template: `<div class="vacio-box"><Ic :n="icono" :s="30" /><b>{{ titulo }}</b><span>{{ texto }}</span><slot /></div>`,
};

// --- Confirmación antes de acciones arriesgadas (cancelar una cita, borrar, cerrar sesión…) ---
// Uso:  if (!(await pedirConfirmacion({ titulo: "¿Cancelar la cita?", texto: "…", boton: "Cancelar la cita" }))) return;
// El botón con el foco es «No, volver»: un Intro sin querer nunca ejecuta la acción.
export const confirmacion = ref(null);
export function pedirConfirmacion({ titulo = "¿Seguro?", texto = "", boton = "Confirmar", peligro = true } = {}) {
  if (confirmacion.value) confirmacion.value.ok(false);
  return new Promise((ok) => { confirmacion.value = { titulo, texto, boton, peligro, ok }; });
}
export const Confirmacion = {
  components: { Ic },
  setup() {
    const volver = ref(null);
    const responder = (si) => { const c = confirmacion.value; confirmacion.value = null; if (c) c.ok(si); };
    const tecla = (e) => { if (confirmacion.value && e.key === "Escape") { e.stopPropagation(); responder(false); } };
    watch(confirmacion, async (v) => { if (v) { await nextTick(); volver.value?.focus(); } });
    onMounted(() => window.addEventListener("keydown", tecla, true));
    onUnmounted(() => window.removeEventListener("keydown", tecla, true));
    return { confirmacion, responder, volver };
  },
  template: `<Teleport to="body"><div v-if="confirmacion" class="modal-bg confirmar-bg" @mousedown.self="responder(false)">
    <div class="modal confirmar" role="alertdialog" aria-modal="true" :aria-label="confirmacion.titulo">
      <div class="confirmar-cuerpo"><span class="confirmar-ico" :class="{peligro: confirmacion.peligro}"><Ic :n="confirmacion.peligro ? 'alert' : 'info'" :s="22" /></span>
        <div><h3>{{ confirmacion.titulo }}</h3><p v-if="confirmacion.texto">{{ confirmacion.texto }}</p></div></div>
      <footer><button ref="volver" class="btn" @click="responder(false)">No, volver</button><button class="btn" :class="confirmacion.peligro ? 'btn-peligro' : 'btn-primary'" @click="responder(true)">{{ confirmacion.boton }}</button></footer>
    </div></div></Teleport>`,
};

/** Campo de contraseña con el ojo para mostrarla u ocultarla. */
export const CampoClave = {
  props: { modelValue: { type: String, default: "" }, id: String, autocomplete: String, required: Boolean },
  emits: ["update:modelValue"],
  components: { Ic },
  setup: () => ({ ver: ref(false) }),
  template: `<div class="clave-campo"><input :id="id" class="inp" :type="ver ? 'text' : 'password'" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" :autocomplete="autocomplete" :required="required" spellcheck="false" autocapitalize="off" />
    <button type="button" class="clave-ojo" @click="ver = !ver" :aria-pressed="ver" :aria-label="ver ? 'Ocultar contraseña' : 'Mostrar contraseña'" :title="ver ? 'Ocultar contraseña' : 'Mostrar contraseña'"><Ic :n="ver ? 'ojoNo' : 'eye'" :s="18" /></button></div>`,
};

/** Opciones de un <select> con las personas de Ajustes → Personas, en dos grupos.
 *  Si la ficha tiene un nombre que ya no está en la lista, se sigue mostrando para no perderlo.
 *  prefijo: texto delante del nombre (p. ej. «Agenda de »). */
export const OpcionesPersonas = {
  props: { actual: { type: String, default: "" }, prefijo: { type: String, default: "" } },
  setup(p) {
    const grupos = computed(() => [["Equipo de la gestoría", store.personas?.equipo || []], ["Practicantes", store.personas?.practicantes || []]]);
    const huerfano = computed(() => p.actual && p.actual !== "Sin asignar" && !grupos.value.some(([, l]) => l.includes(p.actual)) ? p.actual : "");
    return { grupos, huerfano };
  },
  template: `<option v-if="huerfano" :value="huerfano">{{ prefijo }}{{ huerfano }}</option><optgroup v-for="[g, lista] in grupos" :key="g" :label="g"><option v-for="n in lista" :key="n" :value="n">{{ prefijo }}{{ n }}</option></optgroup>`,
};

/* ---------- Menú contextual: clic derecho (ordenador) o mantener pulsado (móvil) ---------- */
export const menuCtx = reactive({ abierto: false, x: 0, y: 0, titulo: "", items: [] });
let ultimaApertura = 0;
export function abrirMenu(x, y, items, titulo = "") {
  const l = items.filter((i) => i && !i.oculto);
  if (!l.length) return;
  Object.assign(menuCtx, { abierto: true, x, y, titulo, items: l });
  ultimaApertura = Date.now();
}
export const cerrarMenu = () => { menuCtx.abierto = false; };

/** v-ctx="() => [{ t: 'Texto', i: 'icono', f: () => …, peligro: true }, { sep: true }]" */
export const vCtx = {
  mounted(el, b) {
    el._ctx = b.value; el.setAttribute("data-ctx", "");
    let t = null, x0 = 0, y0 = 0, disparado = 0;
    const abrir = (x, y) => { const f = el._ctx; const it = typeof f === "function" ? f() : f; const l = it && it.items ? it.items : it; if (l && l.length) { abrirMenu(x, y, l, (it && it.titulo) || ""); disparado = Date.now(); try { navigator.vibrate?.(12); } catch (_) { /* sin vibración */ } } };
    const ini = (e) => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; clearTimeout(t); t = setTimeout(() => abrir(x0, y0), 450); };
    const mueve = (e) => { const p = e.touches[0]; if (p && Math.hypot(p.clientX - x0, p.clientY - y0) > 10) clearTimeout(t); };
    const fin = () => clearTimeout(t);
    const derecho = (e) => { e.preventDefault(); if (Date.now() - disparado < 900) return; abrir(e.clientX, e.clientY); };
    const clic = (e) => { if (Date.now() - disparado < 700) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("touchstart", ini, { passive: true });
    el.addEventListener("touchmove", mueve, { passive: true });
    el.addEventListener("touchend", fin); el.addEventListener("touchcancel", fin);
    el.addEventListener("contextmenu", derecho);
    el.addEventListener("click", clic, true);
    el._ctxLimpiar = () => { clearTimeout(t); el.removeEventListener("touchstart", ini); el.removeEventListener("touchmove", mueve); el.removeEventListener("touchend", fin); el.removeEventListener("touchcancel", fin); el.removeEventListener("contextmenu", derecho); el.removeEventListener("click", clic, true); };
  },
  updated(el, b) { el._ctx = b.value; },
  unmounted(el) { el._ctxLimpiar?.(); },
};

export const MenuCtx = {
  components: { Ic },
  setup() {
    const caja = ref(null); const pos = reactive({ x: 0, y: 0 });
    const tecla = (e) => { if (e.key === "Escape") cerrarMenu(); };
    const fuera = (e) => { if (menuCtx.abierto && Date.now() - ultimaApertura > 350 && !caja.value?.contains(e.target)) cerrarMenu(); };
    onMounted(() => { window.addEventListener("keydown", tecla); window.addEventListener("pointerdown", fuera, true); window.addEventListener("scroll", cerrarMenu, true); window.addEventListener("resize", cerrarMenu); });
    onUnmounted(() => { window.removeEventListener("keydown", tecla); window.removeEventListener("pointerdown", fuera, true); window.removeEventListener("scroll", cerrarMenu, true); window.removeEventListener("resize", cerrarMenu); });
    watch(() => menuCtx.abierto, async (a) => {
      if (!a) return;
      pos.x = menuCtx.x; pos.y = menuCtx.y; await nextTick();
      const r = caja.value?.getBoundingClientRect(); if (!r) return;
      pos.x = Math.max(8, Math.min(menuCtx.x, window.innerWidth - r.width - 8)); pos.y = Math.max(8, Math.min(menuCtx.y, window.innerHeight - r.height - 8));
    });
    const elegir = (i) => { cerrarMenu(); if (!i.desactivado) setTimeout(() => i.f?.(), 0); };
    return { menuCtx, caja, pos, elegir, cerrarMenu };
  },
  template: `<Teleport to="body"><div v-if="menuCtx.abierto" class="ctx-bg" @contextmenu.prevent="cerrarMenu"><div ref="caja" class="ctx" role="menu" :style="{left: pos.x+'px', top: pos.y+'px'}">
    <div v-if="menuCtx.titulo" class="ctx-tit">{{ menuCtx.titulo }}</div>
    <template v-for="(i, n) in menuCtx.items" :key="n"><div v-if="i.sep" class="ctx-sep"></div>
    <button v-else class="ctx-item" :class="{peligro: i.peligro}" :disabled="i.desactivado" role="menuitem" @click="elegir(i)"><Ic v-if="i.i" :n="i.i" :s="16" /><span>{{ i.t }}</span></button></template></div></div></Teleport>`,
};
