import { createApp, computed, ref, reactive, watch, onMounted, onUnmounted } from "vue";
import { store, setTema, centroDe, nombreCompleto, cargarDemo, vaciarDatos, toast } from "./store.js";
import { sesion, iniciar, entrar, cerrarSesion, cambiarMiClave, miNombre, miRol } from "./api.js";
import { arrancarSync, pararSync, guardarAhora } from "./sync.js";
import { ruta, go } from "./router.js";
import { Ic, Toasts, Avatar, Chip, Modal } from "./ui.js";
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
  components: { Ic, Toasts, Avatar, Chip, Modal },
  setup() {
    // --- Sesión ---
    const acceso = reactive({ email: "", clave: "", error: "", ocupado: false });
    const cargando = ref(false), errorCarga = ref("");
    const dentro = computed(() => sesion.modo === "demo" || (sesion.modo === "servidor" && !!sesion.usuario));
    const cargarDatos = async () => {
      cargando.value = true; errorCarga.value = "";
      try { await arrancarSync(); } catch (e) { errorCarga.value = e.message; } finally { cargando.value = false; }
    };
    const login = async () => {
      if (acceso.ocupado) return;
      acceso.ocupado = true; acceso.error = "";
      try { await entrar(acceso.email, acceso.clave); acceso.clave = ""; }
      catch (e) { acceso.error = e.message; }
      finally { acceso.ocupado = false; }
    };
    const menuYo = ref(false);
    const salir = async () => { menuYo.value = false; await guardarAhora(); pararSync(); vaciarDatos(); cerrarSesion(); };
    // Al entrar se cargan los datos; si la sesión se pierde (caduca o la desactivan), se limpia la pantalla.
    watch(() => sesion.usuario?.id, (id, antes) => { if (id) cargarDatos(); else if (antes) { pararSync(); vaciarDatos(); } });
    onMounted(async () => { await iniciar(); if (sesion.modo === "demo") cargarDemo(); });

    const clave = reactive({ abierto: false, actual: "", nueva: "", repetir: "", error: "", ocupado: false });
    const abrirClave = () => { menuYo.value = false; Object.assign(clave, { abierto: true, actual: "", nueva: "", repetir: "", error: "" }); };
    const guardarClave = async () => {
      if (clave.nueva.length < 10) { clave.error = "La contraseña nueva debe tener al menos 10 caracteres."; return; }
      if (clave.nueva !== clave.repetir) { clave.error = "Las dos contraseñas nuevas no coinciden."; return; }
      clave.ocupado = true; clave.error = "";
      try { await cambiarMiClave(clave.actual, clave.nueva); clave.abierto = false; toast("Contraseña cambiada"); }
      catch (e) { clave.error = e.estado === 400 ? "La contraseña actual no es correcta." : e.message; }
      finally { clave.ocupado = false; }
    };

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
    const yoRef = ref(null);
    const fuera = (e) => { if (raiz.value && !raiz.value.contains(e.target)) abierto.value = false; if (yoRef.value && !yoRef.value.contains(e.target)) menuYo.value = false; };
    onMounted(() => { window.addEventListener("keydown", tecla); document.addEventListener("mousedown", fuera); });
    onUnmounted(() => { window.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fuera); });

    return { store, ruta, vista, activo, nav, menu, ir, q, abierto, inp, raiz, res, abrir, setTema, centroDe, nombreCompleto, hoy: fLarga(HOY_ISO),
      sesion, dentro, acceso, login, cargando, errorCarga, cargarDatos, menuYo, yoRef, salir, clave, abrirClave, guardarClave, miNombre, miRol };
  },
  template: `
  <div v-if="sesion.modo==='cargando'" class="acceso"><div class="acceso-espera"><img src="img/logo-g.svg" alt="" /><span>Cargando…</span></div></div>

  <div v-else-if="!dentro" class="acceso">
    <form class="acceso-caja" @submit.prevent="login">
      <img class="acceso-logo" src="img/logo-g.svg" alt="" />
      <h1>Gestoría eMadrid</h1>
      <p class="acceso-sub">Portal de prácticas<span v-if="sesion.entorno==='pruebas'" class="tag">Entorno de pruebas</span></p>
      <div class="fld"><label for="acc-email">Correo</label><input id="acc-email" class="inp" type="email" v-model="acceso.email" autocomplete="username" required autofocus /></div>
      <div class="fld"><label for="acc-clave">Contraseña</label><input id="acc-clave" class="inp" type="password" v-model="acceso.clave" autocomplete="current-password" required /></div>
      <div v-if="acceso.error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ acceso.error }}</span></div>
      <button class="btn btn-primary" type="submit" :disabled="acceso.ocupado"><Ic n="lock" :s="15" />{{ acceso.ocupado ? 'Entrando…' : 'Entrar' }}</button>
      <small class="sub">Acceso solo para el equipo. Si no recuerdas tu contraseña, pide a un administrador que te ponga una nueva.</small>
    </form>
    <Toasts />
  </div>

  <div v-else class="shell">
    <aside class="side" :class="{open: menu}">
      <div class="brand"><img class="brand-logo" src="img/logo-g.svg" alt="" /><div><b>Gestoría eMadrid</b><span>Portal de prácticas</span></div></div>
      <nav class="nav">
        <a v-for="n in nav" :key="n.k" :class="{on: activo===n.k}" @click="ir(n.k)"><Ic :n="n.i" />{{ n.t }}<span v-if="n.b" class="badge" :class="{am: n.am}" :title="n.bt">{{ n.b }}</span></a>
        <div class="nav-label">Sistema</div>
        <a :class="{on: activo==='ajustes'}" @click="ir('ajustes')"><Ic n="ajustes" />Ajustes</a>
      </nav>
      <div class="side-foot" v-if="sesion.modo==='demo'">
        <b>Demostración · datos de ejemplo</b>
        <span>Sin servidor: nada de lo que hagas aquí se guarda.</span>
      </div>
      <div class="side-foot" v-else>
        <b>{{ sesion.entorno==='pruebas' ? 'Entorno de pruebas' : 'Portal de la gestoría' }}</b>
        <span v-if="sesion.guardando" class="ok"><Ic n="sync" :s="13" /> Guardando…</span>
        <span v-else-if="sesion.errorGuardado" class="mal"><Ic n="alert" :s="13" /> Hay cambios sin guardar</span>
        <span v-else class="ok"><Ic n="check" :s="13" /> Cambios guardados</span>
        <span v-if="sesion.entorno==='pruebas'">Usa solo datos inventados.</span>
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
        <div class="yo" ref="yoRef">
          <button class="me" @click="menuYo=!menuYo" :aria-expanded="menuYo" aria-haspopup="menu"><Avatar :nombre="miNombre()" apellidos="" :s="32" /><span><b>{{ miNombre() }}</b><small>{{ miRol() }}</small></span></button>
          <div class="yo-menu" v-if="menuYo && sesion.modo==='servidor'" role="menu">
            <small>{{ sesion.usuario?.email }}</small>
            <button role="menuitem" @click="abrirClave"><Ic n="lock" :s="15" />Cambiar mi contraseña</button>
            <button role="menuitem" @click="salir"><Ic n="x" :s="15" />Cerrar sesión</button>
          </div>
        </div>
      </header>
      <div v-if="cargando" class="page"><div class="vacio-box"><span>Cargando los datos del portal…</span></div></div>
      <div v-else-if="errorCarga" class="page"><div class="aviso err"><Ic n="alert" :s="16" /><span>No se pudieron cargar los datos: {{ errorCarga }}</span><button class="btn btn-sm" @click="cargarDatos">Reintentar</button></div></div>
      <component v-else :is="vista" :key="ruta.nombre + '/' + ruta.id" />
    </div>
    <Modal v-if="clave.abierto" titulo="Cambiar mi contraseña" :ancho="420" @cerrar="clave.abierto=false">
      <form class="stack" @submit.prevent="guardarClave" id="f-clave">
        <div class="fld"><label>Contraseña actual</label><input class="inp" type="password" v-model="clave.actual" autocomplete="current-password" required /></div>
        <div class="fld"><label>Contraseña nueva (mínimo 10 caracteres)</label><input class="inp" type="password" v-model="clave.nueva" autocomplete="new-password" required /></div>
        <div class="fld"><label>Repite la contraseña nueva</label><input class="inp" type="password" v-model="clave.repetir" autocomplete="new-password" required /></div>
        <div v-if="clave.error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ clave.error }}</span></div>
      </form>
      <template #pie><button class="btn" @click="clave.abierto=false">Cancelar</button><button class="btn btn-primary" type="submit" form="f-clave" :disabled="clave.ocupado">Guardar</button></template>
    </Modal>
    <Toasts />
  </div>`,
};

createApp(App).mount("#app");
