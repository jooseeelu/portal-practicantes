import { createApp, computed, ref, onMounted, onUnmounted } from "vue";
import { store, setTema, centroDe, nombreCompleto } from "./store.js";
import { ruta, go } from "./router.js";
import { Ic, Toasts, Avatar, Chip } from "./ui.js";
import { normal, HOY_ISO, dia, fLarga } from "./util.js";
import Inicio from "./views/Inicio.js";
import Candidatos from "./views/Candidatos.js";
import Ficha from "./views/Ficha.js";
import Entrevistas from "./views/Entrevistas.js";
import Estudiantes from "./views/Estudiantes.js";
import Centros from "./views/Centros.js";
import Documentos from "./views/Documentos.js";
import Ajustes from "./views/Ajustes.js";

const VISTAS = { inicio: Inicio, candidatos: Candidatos, candidato: Ficha, entrevistas: Entrevistas, estudiantes: Estudiantes, centros: Centros, documentos: Documentos, ajustes: Ajustes };

const App = {
  components: { Ic, Toasts, Avatar, Chip },
  setup() {
    const vista = computed(() => VISTAS[ruta.value.nombre] || Inicio);
    const activo = computed(() => (ruta.value.nombre === "candidato" ? "candidatos" : VISTAS[ruta.value.nombre] ? ruta.value.nombre : "inicio"));
    const porRevisar = computed(() => store.candidatos.filter((c) => c.estado === "pendiente-revision").length);
    const proximas = computed(() => store.entrevistas.filter((e) => e.fecha >= HOY_ISO && e.fecha <= dia(7) && ["Pendiente", "Confirmada", "Reprogramada"].includes(e.estado)).length);
    const nav = computed(() => [
      { k: "inicio", t: "Inicio", i: "inicio" },
      { k: "candidatos", t: "Candidatos", i: "candidatos", b: porRevisar.value, bt: "Pendientes de revisión" },
      { k: "entrevistas", t: "Entrevistas", i: "entrevistas", b: proximas.value, bt: "Próximos 7 días", am: true },
      { k: "estudiantes", t: "Estudiantes en prácticas", i: "estudiantes" },
      { k: "centros", t: "Centros educativos", i: "centros" },
      { k: "documentos", t: "Documentos", i: "documentos" },
    ]);
    const menu = ref(false);
    const ir = (k) => { menu.value = false; go(k); };

    // Buscador global (Ctrl+K o «/»)
    const q = ref(""), abierto = ref(false), inp = ref(null), raiz = ref(null);
    const res = computed(() => {
      const n = normal(q.value.trim());
      if (n.length < 2) return { cands: [], centros: [] };
      return {
        cands: store.candidatos.filter((c) => normal(`${c.nombre} ${c.apellidos} ${c.email} ${c.titulacion} ${centroDe(c.centroId)?.nombre || ""}`).includes(n)).slice(0, 7),
        centros: store.centros.filter((c) => normal(c.nombre).includes(n)).slice(0, 4),
      };
    });
    const abrir = (path) => { abierto.value = false; q.value = ""; go(path); };
    const tecla = (e) => {
      const enCampo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !enCampo)) { e.preventDefault(); inp.value?.focus(); }
      if (e.key === "Escape") { abierto.value = false; inp.value?.blur(); }
    };
    const fuera = (e) => { if (raiz.value && !raiz.value.contains(e.target)) abierto.value = false; };
    onMounted(() => { window.addEventListener("keydown", tecla); document.addEventListener("mousedown", fuera); });
    onUnmounted(() => { window.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fuera); });

    return { store, ruta, vista, activo, nav, menu, ir, q, abierto, inp, raiz, res, abrir, setTema, centroDe, nombreCompleto, hoy: fLarga(HOY_ISO) };
  },
  template: `
  <div class="shell">
    <aside class="side" :class="{open: menu}">
      <div class="brand"><div class="brand-logo">e</div><div><b>Gestoría eMadrid</b><span>Portal de prácticas</span></div></div>
      <nav class="nav">
        <a v-for="n in nav" :key="n.k" :class="{on: activo===n.k}" @click="ir(n.k)"><Ic :n="n.i" />{{ n.t }}<span v-if="n.b" class="badge" :class="{am: n.am}" :title="n.bt">{{ n.b }}</span></a>
        <div class="nav-label">Sistema</div>
        <a :class="{on: activo==='ajustes'}" @click="ir('ajustes')"><Ic n="ajustes" />Ajustes</a>
      </nav>
      <div class="side-foot">
        <b>Prototipo visual · datos de ejemplo</b>
        <span class="ok"><Ic n="sync" :s="13" /> Notion sincronizado (simulado)</span>
        <span>Nada de lo que hagas aquí se guarda.</span>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="icon-btn menu-btn" @click="menu=!menu" aria-label="Menú"><Ic n="menu" /></button>
        <div class="gsearch" ref="raiz">
          <span class="ico"><Ic n="search" :s="16" /></span>
          <input ref="inp" class="inp" v-model="q" placeholder="Buscar candidato, centro, titulación…" @focus="abierto=true" @input="abierto=true" aria-label="Buscador global" />
          <kbd>Ctrl K</kbd>
          <div class="gres" v-if="abierto && q.trim().length>=2">
            <template v-if="res.cands.length"><h5>Candidatos</h5>
              <a v-for="c in res.cands" :key="c.id" @click="abrir('candidato/'+c.id)"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="28" /><span class="grow"><b>{{ nombreCompleto(c) }}</b> <span class="sub">· {{ centroDe(c.centroId)?.nombre || 'Autopostulado' }}</span></span><Chip :k="c.estado" /></a>
            </template>
            <template v-if="res.centros.length"><h5>Centros</h5>
              <a v-for="c in res.centros" :key="c.id" @click="abrir('centros/'+c.id)"><Ic n="centros" /><span>{{ c.nombre }}</span></a>
            </template>
            <div v-if="!res.cands.length && !res.centros.length" class="vacio-box" style="padding:22px"><span>Sin resultados para «{{ q }}»</span></div>
          </div>
        </div>
        <span class="right sub nowrap" style="text-transform:capitalize">{{ hoy }}</span>
        <button class="icon-btn" @click="setTema(store.tema==='oscuro'?'claro':'oscuro')" :title="store.tema==='oscuro'?'Cambiar a tema claro':'Cambiar a tema oscuro'"><Ic :n="store.tema==='oscuro'?'sun':'moon'" /></button>
        <div class="me"><Avatar nombre="José" apellidos="Luis" :s="32" /><span><b>José Luis</b><small>Administrador</small></span></div>
      </header>
      <component :is="vista" :key="ruta.nombre + '/' + ruta.id" />
    </div>
    <Toasts />
  </div>`,
};

createApp(App).mount("#app");
