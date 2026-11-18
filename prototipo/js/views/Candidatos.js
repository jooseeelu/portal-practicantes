import { computed, reactive, ref } from "vue";
import { store, etiquetaTurno, centroDe, entrevistaDe, entrevistasDe, estadoDe, cambiarEstado, incorporar, turnoEstudiante, nombreCompleto, addHist, toast, nuevoId } from "../store.js";
import { ruta, go } from "../router.js";
import { registrar, sesion, subirArchivo, borrarArchivo, leerCurriculum, pedir, miNombre } from "../api.js";
import { recortarFoto } from "../cv.js";
import { RecorteFoto } from "../recorte.js";
import { SelectorFechas, textoTramo } from "../fechas.js";
import { elegirMensaje } from "../mensajes.js";
import { Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio, leerFoto, OpcionesPersonas, SelectArea } from "../ui.js";
import { AREAS_UNIDAS, TURNOS, AREAS, ORIGENES, ASESORES } from "../data.js";
import { normal, descargarCsv, fCorta, HOY_ISO, dia, urlWhatsApp } from "../util.js";

// Los filtros viven fuera del componente: al volver de una ficha siguen como estaban.
export const filtros = reactive({ q: "", estado: "", centro: "", turno: "", area: "", notaMin: "", desde: "", hasta: "", rapido: "", vista: "tabla", orden: "creado", desc: true });

const COLS = [
  { k: "nombre", t: "Candidato" }, { k: "centro", t: "Centro educativo" }, { k: "titulacion", t: "Titulación" }, { k: "turno", t: "Turno" },
  { k: "horas", t: "Duración" }, { k: "entrevista", t: "Entrevista" }, { k: "estado", t: "Estado" }, { k: "nota", t: "Valoración" },
];

export default {
  components: { SelectorFechas, RecorteFoto, SelectArea, OpcionesPersonas, Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio },
  setup() {
    const f = filtros;
    const opCentros = computed(() => store.centros.filter((c) => !c.archivado).map((c) => ({ valor: c.id, etiqueta: c.nombre })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)));
    const fechaEnt = (c) => entrevistaDe(c.id)?.fecha || "";

    // «base» = todo menos el filtro de estado (así los contadores por fase siguen siendo útiles)
    const base = computed(() => {
      const n = normal(f.q.trim());
      return store.candidatos.filter((c) => {
        if (n && !normal(`${c.nombre} ${c.apellidos} ${c.email} ${c.tel} ${c.titulacion} ${c.area} ${centroDe(c.centroId)?.nombre || "autopostulado"} ${c.obs} ${entrevistaDe(c.id)?.obs || ""}`).includes(n)) return false;
        if (f.centro && c.centroId !== f.centro) return false;
        if (f.turno && c.turno !== f.turno) return false;
        if (f.area === "__otras" ? (!c.area || AREAS.includes(c.area)) : f.area && (c.area || "") !== f.area) return false;
        if (f.desde || f.hasta) { const x = fechaEnt(c) || c.creado || ""; if (!x || (f.desde && x < f.desde) || (f.hasta && x > f.hasta)) return false; }
        if (f.notaMin && !(c.nota != null && c.nota >= Number(f.notaMin))) return false;
        if (f.rapido === "sinvalorar" && !(c.nota == null && entrevistaDe(c.id)?.estado === "Realizada")) return false;
        if (f.rapido === "semana") { const d = fechaEnt(c); if (!(d >= HOY_ISO && d <= dia(7))) return false; }
        if (f.rapido === "reserva" && c.estado !== "en-reserva") return false;
        return true;
      });
    });
    const valor = (c, k) => ({
      nombre: normal(c.nombre + " " + c.apellidos), centro: normal(centroDe(c.centroId)?.nombre || "zz"), titulacion: normal(c.titulacion), turno: c.turno, horas: c.horas,
      entrevista: fechaEnt(c) || (f.desc ? "0" : "9"), estado: store.estados.findIndex((e) => e.k === c.estado), nota: c.nota ?? (f.desc ? -1 : 99), creado: c.creado,
    })[k];
    const lista = computed(() => {
      const l = base.value.filter((c) => !f.estado || c.estado === f.estado);
      const s = f.desc ? -1 : 1;
      return [...l].sort((a, b) => { const x = valor(a, f.orden), y = valor(b, f.orden); return (x > y ? 1 : x < y ? -1 : 0) * s; });
    });
    const ordenar = (k) => { if (f.orden === k) f.desc = !f.desc; else { f.orden = k; f.desc = k === "nota" || k === "entrevista"; } };
    const fases = computed(() => store.estados.filter((e) => e.activo).map((e) => ({ ...e, cnt: base.value.filter((c) => c.estado === e.k).length })));
    const exportar = () => {
      const filas = lista.value.map((c) => { const e = entrevistaDe(c.id); return [c.nombre, c.apellidos, c.email, c.tel, centroDe(c.centroId)?.nombre || "Autopostulado", c.titulacion, c.area, c.turno, c.horas, estadoDe(c.estado).n, c.nota == null ? "" : String(c.nota).replace(".", ","), e ? e.fecha : "", e ? e.hora : "", e ? e.estado : "", c.origen, c.creado, c.obs]; });
      descargarCsv("candidatos-" + HOY_ISO + ".csv", ["Nombre", "Apellidos", "Correo", "Teléfono", "Centro", "Titulación", "Área", "Turno", "Horas", "Estado", "Valoración", "Fecha entrevista", "Hora entrevista", "Estado de la cita", "Origen", "Registrado", "Observaciones"], filas);
      registrar("Exportó candidatos a Excel", filas.length + " fichas"); toast(filas.length + " candidatos exportados");
    };
    const areasFiltro = AREAS;
    const hayFiltros = computed(() => f.q || f.estado || f.centro || f.turno || f.area || f.notaMin || f.desde || f.hasta || f.rapido);
    const limpiar = () => Object.assign(f, { q: "", estado: "", centro: "", turno: "", area: "", notaMin: "", desde: "", hasta: "", rapido: "" });
    const rapido = (k) => { f.rapido = f.rapido === k ? "" : k; };
    // Filtros: hoja en móvil y etiquetas de los filtros puestos (cada una con su x)
    const hoja = ref(false);
    const NOTAS = ["9", "8", "7", "5"];
    const RAPIDOS = [{ k: "sinvalorar", t: "Entrevistados sin valorar", i: "star" }, { k: "semana", t: "Entrevista en 7 días", i: "calendario" }, { k: "reserva", t: "En reserva", i: "archive" }];
    const chips = computed(() => {
      const out = [];
      if (f.area) out.push({ k: "area", t: "Área: " + (f.area === "__otras" ? "Otra" : f.area), quitar: () => (f.area = "") });
      if (f.turno) out.push({ k: "turno", t: "Turno: " + etiquetaTurno(f.turno), quitar: () => (f.turno = "") });
      if (f.centro) out.push({ k: "centro", t: "Centro: " + (centroDe(f.centro)?.nombre || "—"), quitar: () => (f.centro = "") });
      if (f.desde || f.hasta) out.push({ k: "fechas", t: textoTramo(f.desde, f.hasta), quitar: () => { f.desde = ""; f.hasta = ""; } });
      if (f.notaMin) out.push({ k: "nota", t: "Nota " + f.notaMin + " o más", quitar: () => (f.notaMin = "") });
      if (f.rapido) out.push({ k: "rapido", t: RAPIDOS.find((r) => r.k === f.rapido)?.t || f.rapido, quitar: () => (f.rapido = "") });
      return out;
    });

    // Kanban: arrastrar una tarjeta a otra columna cambia su estado
    const arrastrando = ref(null), sobre = ref("");
    const soltar = (k) => { const c = store.candidatos.find((x) => x.id === arrastrando.value); if (c) cambiarEstado(c, k); arrastrando.value = null; sobre.value = ""; };
    const columnas = computed(() => fases.value.map((e) => ({ ...e, cands: base.value.filter((c) => c.estado === e.k) })));

    // Alta rápida
    const alta = ref(ruta.value.id === "nuevo");
    const vacio = () => ({ nombre: "", apellidos: "", email: "", tel: "", centroId: "", titulacion: "", area: "", turno: "Por confirmar", horarioLibre: "", idiomas: "", herramientas: "", experiencia: "", archivoId: "", archivoSrv: "", horas: "", origen: "Centro educativo", obs: "", archivo: null, foto: "", situacion: "nuevo", inicio: "", fin: "", horaIni: "", horaFin: "", tutor: "" });
    // Lectura automática del currículum al adjuntarlo: rellena lo que esté vacío y propone la foto
    const lee = reactive({ cargando: false, error: "", hecho: 0, avisos: [], fotoIA: false });
    const enServidor = () => sesion.modo === "servidor";
    async function adjuntar(files) {
      const f = files[0]; if (!f) return;
      if (!/\.(pdf|docx?|jpe?g|png|webp)$/i.test(f.name)) return toast("Solo se admiten PDF, Word o imágenes.", "error");
      if (f.size > 20 * 1024 * 1024) return toast("El archivo pesa más de 20 MB.", "error");
      n.archivo = f; n.archivoId = ""; n.archivoSrv = "";
      Object.assign(lee, { cargando: false, error: "", hecho: 0, avisos: [], fotoIA: false });
      if (!enServidor()) return;
      lee.cargando = true;
      try {
        const r = await subirArchivo(f, { candId: "borrador", tipo: "Currículum", nombre: f.name });
        n.archivoId = r.id; n.archivoSrv = r.archivo;
        if (!/\.(pdf|jpe?g|png|webp)$/i.test(f.name)) { lee.error = "Este formato (Word) no se puede leer solo. Guárdalo como PDF si quieres que se rellene automáticamente."; return; }
        const d = await leerCurriculum(r.id), x = d.datos || {};
        const pon = (k, v) => { if (v && !String(n[k] || "").trim()) { n[k] = v; lee.hecho++; } };
        ["nombre", "apellidos", "email", "tel", "titulacion", "idiomas", "herramientas", "experiencia"].forEach((k) => pon(k, x[k]));
        pon("area", AREAS_UNIDAS[x.area] || x.area);
        if (x.centro && !n.centroId) {
          const nc = normal(x.centro);
          const m = store.centros.find((ce) => !ce.archivado && (normal(ce.nombre) === nc || (normal(ce.nombre).length > 3 && (nc.includes(normal(ce.nombre)) || normal(ce.nombre).includes(nc)))));
          if (m) { n.centroId = m.id; lee.hecho++; }
        }
        lee.avisos = d.avisos || [];
        recorteAlta.caja = d.foto || null;
        if (d.foto && !n.foto) { const fo = await recortarFoto(f, d.foto, { soloConCara: true }); if (fo) { n.foto = fo; lee.fotoIA = true; } }
        registrar("Leyó un currículum con IA al dar de alta", f.name);
      } catch (e) { lee.error = e.message; } finally { lee.cargando = false; }
    }
    const quitarArchivo = () => { if (n.archivoId) borrarArchivo(n.archivoId).catch(() => {}); n.archivo = null; n.archivoId = ""; n.archivoSrv = ""; Object.assign(lee, { cargando: false, error: "", hecho: 0, avisos: [], fotoIA: false }); };
    const recorteAlta = reactive({ abierto: false, caja: null });
    const usarRecorteAlta = (url) => { n.foto = url; lee.fotoIA = false; recorteAlta.abierto = false; };
    const quitarFotoAlta = () => { n.foto = ""; lee.fotoIA = false; };
    const fotoAlta = async (ev) => { const a = ev.target.files[0]; ev.target.value = ""; try { n.foto = await leerFoto(a); } catch (e) { toast(e.message, "error"); } };
    const n = reactive(vacio());
    const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
    const duplicado = computed(() => store.candidatos.find((c) => (n.email.trim() && c.email.toLowerCase() === n.email.trim().toLowerCase()) || (soloDigitos(n.tel).length >= 9 && soloDigitos(c.tel) === soloDigitos(n.tel))));
    const titulaciones = computed(() => { const c = centroDe(n.centroId); return c ? c.programas : [...new Set(store.candidatos.map((x) => x.titulacion))].sort(); });
    const abrirAlta = () => { Object.assign(n, vacio()); Object.assign(lee, { cargando: false, error: "", hecho: 0, avisos: [], fotoIA: false }); alta.value = true; };
    const cerrarAlta = () => { alta.value = false; if (ruta.value.id === "nuevo") go("candidatos"); };
    function guardar() {
      if (!n.nombre.trim() || !n.apellidos.trim()) return toast("Escribe al menos el nombre y los apellidos.", "error");
      const yaHizo = n.situacion === "practicas";
      if (yaHizo && (!n.inicio || !n.fin)) return toast("Indica desde cuándo y hasta cuándo hizo las prácticas.", "error");
      if (yaHizo && n.fin < n.inicio) return toast("La fecha de fin no puede ser anterior a la de inicio.", "error");
      const id = nuevoId();
      store.candidatos.push({ id, nombre: n.nombre.trim(), apellidos: n.apellidos.trim(), email: n.email.trim(), tel: n.tel.trim(), centroId: n.centroId || null, titulacion: n.titulacion, area: n.area, turno: n.turno, horarioLibre: n.horarioLibre, disponibilidad: n.turno, horas: Number(n.horas) || "", curso: "", idiomas: n.idiomas, herramientas: n.herramientas, experiencia: n.experiencia, origen: n.origen, obs: n.obs, estado: "pendiente-revision", nota: null, pros: [], contras: [], creado: HOY_ISO, cv: !!n.archivo, foto: n.foto });
      if (n.archivo) {
        store.documentos.push({ id: nuevoId(), candId: id, nombre: n.archivo.name, tipo: "Currículum", fecha: HOY_ISO, hora: new Date().toTimeString().slice(0, 5), por: miNombre(), tam: Math.max(1, Math.round(n.archivo.size / 1024)), ext: n.archivo.name.split(".").pop().toLowerCase(), ...(n.archivoId ? { archivoId: n.archivoId, archivo: n.archivoSrv } : {}) });
        if (n.archivoId) pedir("PATCH", `api/collections/archivos/records/${n.archivoId}`, { candId: String(id) }).catch(() => {});
      }
      addHist(id, "alta", `Candidatura registrada (${n.origen.toLowerCase()})${n.archivo ? " con currículum adjunto" : ""}`);
      if (yaHizo) {
        const t = ["Tarde", "Tarde 2"].includes(n.turno) ? n.turno : "Mañana";
        const cand = store.candidatos.find((x) => x.id === id);
        incorporar(cand, { inicio: n.inicio, fin: n.fin, horaIni: n.horaIni || store.turnosDef[t].ini, horaFin: n.horaFin || store.turnosDef[t].fin, horas: Number(n.horas) || 340, tutor: n.tutor, convenio: true });
        if (n.fin < HOY_ISO) cambiarEstado(cand, "finalizado", { silencioso: true });
      } else toast("Candidato registrado");
      alta.value = false;
      go("candidato/" + id);
    }

    // Observaciones del listado: las de la última entrevista (o las antiguas de la ficha)
    // Si tiene varias entrevistas con observaciones, salen todas numeradas («1.ª: … · 2.ª: …»)
    const obsDe = (c) => { const l = entrevistasDe(c.id).slice().reverse(); const con = l.map((e, i) => [i, e.obs]).filter(([, o]) => o); if (!con.length) return c.obs || ""; if (con.length === 1) return con[0][1]; return con.map(([i, o]) => (i + 1) + ".ª: " + o).join(" · "); };
    const menuCand = (c) => ({ titulo: nombreCompleto(c), items: [
      { t: "Abrir la ficha", i: "user", f: () => go("candidato/" + c.id) },
      { t: "Escribir por WhatsApp…", i: "whatsapp", f: () => elegirMensaje("whatsapp", c) },
      { t: "Enviar un correo…", i: "mail", f: () => elegirMensaje("correo", c) },
    ] });
    return { obsDe, menuCand, ASESORES, etiquetaTurno, store, f, COLS, TURNOS, AREAS, ORIGENES, opCentros, lista, base, fases, columnas, exportar, hayFiltros, areasFiltro, limpiar, rapido, ordenar, fechaEnt, arrastrando, sobre, soltar,
      hoja, NOTAS, RAPIDOS, chips, alta, n, lee, adjuntar, quitarArchivo, recorteAlta, usarRecorteAlta, quitarFotoAlta, fotoAlta, duplicado, titulaciones, abrirAlta, cerrarAlta, guardar, go, centroDe, estadoDe, nombreCompleto, fCorta, entrevistaDe };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Candidatos</h1><p>{{ store.candidatos.length }} personas en la base de datos · {{ lista.length }} con los filtros actuales</p></div>
      <div class="acciones">
        <button class="btn" @click="exportar" :disabled="!lista.length"><Ic n="download" :s="16" />Exportar a Excel</button>
        <button class="btn btn-accent" @click="abrirAlta"><Ic n="plus" :s="16" />Nuevo candidato</button>
      </div>
    </div>

    <div class="estado-pills" role="group" aria-label="Filtrar por estado">
      <button class="pill" :class="{on: !f.estado}" @click="f.estado=''">Todos <b>{{ base.length }}</b></button>
      <button v-for="e in fases" :key="e.k" class="pill" :class="{on: f.estado===e.k, cero: !e.cnt}" @click="f.estado = f.estado===e.k ? '' : e.k"><i class="punto" :style="{background: e.c}"></i>{{ e.n }} <b>{{ e.cnt }}</b></button>
    </div>

    <div class="card">
      <div class="barra-filtros">
        <div class="buscar"><Ic n="search" :s="16" /><input class="inp" type="search" v-model="f.q" placeholder="Buscar por nombre, correo, teléfono, titulación…" aria-label="Buscar candidatos" /></div>
        <select class="inp fsel solo-esc" :class="{on: f.area}" v-model="f.area" aria-label="Área de interés"><option value="">Área</option><option v-for="a in areasFiltro" :key="a" :value="a">{{ a }}</option><option value="__otras">Otra (texto libre)</option></select>
        <select class="inp fsel solo-esc" :class="{on: f.turno}" v-model="f.turno" aria-label="Turno"><option value="">Turno</option><option v-for="t in TURNOS" :key="t" :value="t">{{ etiquetaTurno(t) }}</option></select>
        <div class="fsel-centro solo-esc" :class="{on: f.centro}"><SelectBuscable v-model="f.centro" :opciones="opCentros" etiqueta-todos="Centro" /></div>
        <SelectorFechas v-model:desde="f.desde" v-model:hasta="f.hasta" /><select class="inp fsel solo-esc" :class="{on: f.notaMin}" v-model="f.notaMin" aria-label="Valoración mínima"><option value="">Valoración</option><option v-for="v in NOTAS" :key="v" :value="v">Nota {{ v }} o más</option></select>
        <button class="btn btn-ink btn-filtros solo-movil" @click="hoja = true"><Ic n="filtros" :s="17" />Filtros<span v-if="chips.length" class="badge">{{ chips.length }}</span></button>
        <div class="seg seg-iconos right solo-movil" role="group" aria-label="Vista">
          <button :class="{on: f.vista==='tabla'}" @click="f.vista='tabla'" title="Tabla" aria-label="Vista en tabla"><Ic n="tabla" :s="16" /></button>
          <button :class="{on: f.vista==='tarjetas'}" @click="f.vista='tarjetas'" title="Tarjetas" aria-label="Vista en tarjetas"><Ic n="tarjetas" :s="16" /></button>
          <button :class="{on: f.vista==='kanban'}" @click="f.vista='kanban'" title="Kanban" aria-label="Vista kanban"><Ic n="kanban" :s="16" /></button>
        </div>
      </div>
      <div class="barra-rapidos solo-esc">
        <div class="seg seg-iconos right orden-final" role="group" aria-label="Vista">
          <button :class="{on: f.vista==='tabla'}" @click="f.vista='tabla'" title="Tabla" aria-label="Vista en tabla"><Ic n="tabla" :s="16" /></button>
          <button :class="{on: f.vista==='tarjetas'}" @click="f.vista='tarjetas'" title="Tarjetas" aria-label="Vista en tarjetas"><Ic n="tarjetas" :s="16" /></button>
          <button :class="{on: f.vista==='kanban'}" @click="f.vista='kanban'" title="Kanban" aria-label="Vista kanban"><Ic n="kanban" :s="16" /></button>
        </div>
        <button v-for="r in RAPIDOS" :key="r.k" class="pill pill-rapida" :class="{on: f.rapido===r.k}" @click="rapido(r.k)"><Ic :n="r.i" :s="13" />{{ r.t }}</button>
      </div>
      <div v-if="chips.length" class="filtros-activos">
        <span class="lbl">Filtrando por</span>
        <button v-for="c in chips" :key="c.k" class="chip-filtro" @click="c.quitar()" :aria-label="'Quitar filtro ' + c.t">{{ c.t }}<Ic n="x" :s="14" /></button>
        <button class="btn-link" @click="limpiar">Limpiar filtros</button>
      </div>

      <Modal v-if="hoja" titulo="Filtros" :ancho="520" @cerrar="hoja = false">
        <div class="hoja-grupo"><span class="lbl">Área de interés</span>
          <div class="hoja-chips"><button v-for="a in [...areasFiltro, '__otras']" :key="a" class="pill" :class="{on: f.area===a}" @click="f.area = f.area===a ? '' : a">{{ a === '__otras' ? 'Otra' : a }}</button></div></div>
        <div class="hoja-grupo"><span class="lbl">Turno disponible</span>
          <div class="hoja-chips"><button v-for="t in TURNOS" :key="t" class="pill" :class="{on: f.turno===t}" @click="f.turno = f.turno===t ? '' : t">{{ etiquetaTurno(t) }}</button></div></div>
        <div class="hoja-grupo"><span class="lbl">Valoración mínima</span>
          <div class="seg seg-lleno"><button :class="{on: !f.notaMin}" @click="f.notaMin=''">Todas</button><button v-for="v in [...NOTAS].reverse()" :key="v" :class="{on: f.notaMin===v}" @click="f.notaMin=v">{{ v }}+</button></div></div>
        <div class="hoja-grupo"><span class="lbl">Centro educativo</span><SelectBuscable v-model="f.centro" :opciones="opCentros" etiqueta-todos="Todos los centros" /></div>
        <div class="hoja-grupo"><span class="lbl">Vistas rápidas</span>
          <div class="hoja-chips"><button v-for="r in RAPIDOS" :key="r.k" class="pill" :class="{on: f.rapido===r.k}" @click="rapido(r.k)"><Ic :n="r.i" :s="13" />{{ r.t }}</button></div></div>
        <template #pie><button class="btn btn-ghost" @click="limpiar">Limpiar todo</button><button class="btn btn-ink" @click="hoja = false">Ver {{ lista.length }} candidato{{ lista.length === 1 ? '' : 's' }}</button></template>
      </Modal>

      <!-- TABLA -->
      <div v-if="f.vista==='tabla'" class="tbl-wrap tbl-scroll" v-alto>
        <table class="tbl">
          <thead><tr>
            <th v-for="c in COLS" :key="c.k" class="ord" @click="ordenar(c.k)">{{ c.t }}<span class="arr" v-if="f.orden===c.k">{{ f.desc ? '↓' : '↑' }}</span></th>
            <th title="Currículum adjunto">CV</th><th>Observaciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="c in lista" :key="c.id" @click="go('candidato/'+c.id)" v-ctx="() => menuCand(c)">
              <td><div class="who"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" /><div><b>{{ c.nombre }} {{ c.apellidos }}</b><small>{{ c.email }} · {{ c.tel }}</small></div></div></td>
              <td>{{ centroDe(c.centroId)?.nombre || 'Autopostulado' }}</td>
              <td><div class="cell-clip" :title="c.titulacion">{{ c.titulacion }}</div></td>
              <td class="nowrap">{{ etiquetaTurno(c.turno) }}</td>
              <td class="nowrap">{{ c.horas ? c.horas + ' h' : '—' }}</td>
              <td class="nowrap"><template v-if="fechaEnt(c)">{{ fCorta(fechaEnt(c)) }} <span class="sub">{{ entrevistaDe(c.id).hora }}</span></template><span v-else class="muted">—</span></td>
              <td><Chip :k="c.estado" /></td>
              <td><Nota :v="c.nota" /></td>
              <td><span :class="c.cv ? 'ico-ok' : 'ico-no'" :title="c.cv ? 'Currículum adjunto' : 'Sin currículum'"><Ic :n="c.cv ? 'documentos' : 'minus'" :s="16" /></span></td>
              <td><div class="cell-clip sub" :title="obsDe(c)">{{ obsDe(c) || '—' }}</div></td>
            </tr>
          </tbody>
        </table>
        <Vacio v-if="!lista.length" titulo="Ningún candidato con estos filtros" texto="Prueba a quitar algún filtro o cambia la búsqueda." />
      </div>

      <!-- TARJETAS -->
      <div v-else-if="f.vista==='tarjetas'" class="cands-grid">
        <button v-for="c in lista" :key="c.id" class="cand-card" @click="go('candidato/'+c.id)" v-ctx="() => menuCand(c)">
          <div class="row"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="44" /><div class="grow" style="text-align:left"><b>{{ c.nombre }} {{ c.apellidos }}</b><div class="sub">{{ c.titulacion }}</div></div></div>
          <div class="cand-meta"><span><Ic n="centros" :s="14" />{{ centroDe(c.centroId)?.nombre || 'Autopostulado' }}</span><span><Ic n="clock" :s="14" />{{ etiquetaTurno(c.turno) }}{{ c.horas ? ' · ' + c.horas + ' h' : '' }}</span></div>
          <div v-if="(c.pros && c.pros.length) || (c.contras && c.contras.length)" class="pc-mini"><span class="pro" :title="(c.pros || []).join(' · ')"><Ic n="plus" :s="12" />{{ (c.pros || []).length }} a favor</span><span class="con" :title="(c.contras || []).join(' · ')"><Ic n="minus" :s="12" />{{ (c.contras || []).length }} en contra</span></div>
          <div class="row"><Chip :k="c.estado" /><span class="right"><Nota :v="c.nota" /></span></div>
        </button>
        <Vacio v-if="!lista.length" titulo="Ningún candidato con estos filtros" texto="Prueba a quitar algún filtro." style="grid-column:1/-1" />
      </div>

      <!-- KANBAN -->
      <div v-else class="kanban">
        <div v-for="col in columnas" :key="col.k" class="kcol" :class="{sobre: sobre===col.k}" @dragover.prevent="sobre=col.k" @dragleave="sobre=''" @drop.prevent="soltar(col.k)">
          <div class="kcol-head" :style="{'--c': col.c}"><i></i><b>{{ col.n }}</b><span>{{ col.cands.length }}</span></div>
          <div class="kcol-body">
            <div v-for="c in col.cands" :key="c.id" class="kcard" :class="{mov: arrastrando===c.id}" draggable="true" @dragstart="arrastrando=c.id" @dragend="arrastrando=null; sobre=''" @click="go('candidato/'+c.id)">
              <div class="row"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="28" /><b class="grow">{{ c.nombre }} {{ c.apellidos }}</b></div>
              <div class="sub">{{ centroDe(c.centroId)?.nombre || 'Autopostulado' }} · {{ etiquetaTurno(c.turno) }}</div>
              <div class="row" v-if="c.nota!=null || fechaEnt(c)"><Nota :v="c.nota" v-if="c.nota!=null" /><span v-else class="tag"><Ic n="calendario" :s="12" />{{ fCorta(fechaEnt(c)) }} {{ entrevistaDe(c.id).hora }}</span></div>
            </div>
            <div v-if="!col.cands.length" class="kvacio">Suelta aquí</div>
          </div>
        </div>
      </div>
    </div>

    <Modal v-if="alta" titulo="Nuevo candidato" :ancho="680" @cerrar="cerrarAlta">
      <Dropzone v-if="!n.archivo" texto="📄 Arrastra aquí el currículum: se leerá solo y rellenará la ficha" compacto @archivos="adjuntar" />
      <div v-else class="aviso ok"><Ic n="documentos" :s="16" /><span class="grow"><b>{{ n.archivo.name }}</b> se adjuntará a la ficha.</span><button class="btn btn-sm btn-ghost" @click="quitarArchivo">Quitar</button></div>
      <div v-if="lee.cargando" class="aviso"><Ic n="sparkles" :s="16" /><span class="grow"><b>Leyendo el currículum…</b> suele tardar unos segundos.<div class="ia-barra" style="margin-top:6px"><i></i></div></span></div>
      <div v-else-if="lee.error" class="aviso warn"><Ic n="alert" :s="16" /><span class="grow">{{ lee.error }}</span></div>
      <div v-else-if="lee.hecho || lee.fotoIA" class="aviso ok"><Ic n="sparkles" :s="16" /><span class="grow">✨ Rellenado desde el currículum: <b>{{ lee.hecho }}</b> campo{{ lee.hecho === 1 ? '' : 's' }}{{ lee.fotoIA ? ' y la foto' : '' }}. Revísalo antes de guardar.</span></div>
      <div v-for="a in lee.avisos" :key="a" class="aviso warn"><Ic n="alert" :s="16" /><span>{{ a }}</span></div>
      <div v-if="duplicado" class="aviso warn"><Ic n="alert" :s="16" /><span class="grow"><b>Posible duplicado:</b> {{ nombreCompleto(duplicado) }} ya está registrado con ese correo o teléfono.</span><button class="btn btn-sm" @click="cerrarAlta(); go('candidato/'+duplicado.id)">Abrir su ficha</button></div>
      <div class="foto-alta">
        <label class="foto-edit" title="Añadir foto"><Avatar v-if="n.nombre || n.foto" :nombre="n.nombre" :apellidos="n.apellidos" :foto="n.foto" :s="60" /><span v-else class="avatar avatar-vacio" style="width:60px;height:60px"><Ic n="camara" :s="24" /></span><span class="camara"><Ic n="camara" :s="14" /></span><input type="file" accept="image/*" hidden @change="fotoAlta" /><button v-if="n.foto" type="button" class="foto-x" title="Quitar esta foto" aria-label="Quitar la foto" @click.prevent.stop="quitarFotoAlta">×</button></label>
        <div><b>Foto de la persona (opcional)</b><div class="sub">Ayuda a reconocerla en listados, agenda y cuadrante. Se puede añadir o cambiar después.</div><button v-if="n.archivo" type="button" class="btn btn-sm" style="margin-top:6px" @click="recorteAlta.abierto = true"><Ic n="camara" :s="14" />{{ n.foto ? "Recortar mejor" : "Recortar del currículum" }}</button></div>
        <RecorteFoto v-if="recorteAlta.abierto" :archivo="n.archivo" :caja="recorteAlta.caja" @listo="usarRecorteAlta" @cerrar="recorteAlta.abierto = false" />
      </div>
      <div class="grid2">
        <div class="fld"><label>Nombre *</label><input class="inp" v-model="n.nombre" /></div>
        <div class="fld"><label>Apellidos *</label><input class="inp" v-model="n.apellidos" /></div>
        <div class="fld"><label>Correo electrónico</label><input class="inp" type="email" v-model="n.email" placeholder="nombre@ejemplo.test" /></div>
        <div class="fld"><label>Teléfono</label><input class="inp" v-model="n.tel" placeholder="600 000 000" /></div>
        <div class="fld"><label>Centro educativo</label><SelectBuscable v-model="n.centroId" :opciones="opCentros" etiqueta-todos="Sin centro (autopostulado)" /></div>
        <div class="fld"><label>Titulación o especialidad</label><input class="inp" v-model="n.titulacion" list="dl-tit" placeholder="Elige o escribe" /><datalist id="dl-tit"><option v-for="t in titulaciones" :key="t" :value="t" /></datalist></div>
        <div class="fld"><label>Área de interés</label><SelectArea v-model="n.area" :areas="AREAS" /></div>
        <div class="fld"><label>Turno disponible</label><select class="inp" v-model="n.turno"><option v-for="t in TURNOS" :key="t" :value="t">{{ etiquetaTurno(t) }}</option></select></div>
        <div v-if="n.turno==='Horario personalizado'" class="fld" style="grid-column:1/-1"><label>Horario personalizado</label><input class="inp" v-model="n.horarioLibre" placeholder="Ej.: lunes y miércoles de 9 a 13, resto de la semana por la tarde" /></div>
        <div class="fld"><label>Duración prevista (horas)</label><input class="inp" type="number" min="0" v-model="n.horas" placeholder="340" /></div>
        <div class="fld"><label>Cómo ha llegado</label><select class="inp" v-model="n.origen"><option v-for="o in ORIGENES" :key="o">{{ o }}</option></select></div>
      </div>
      <div class="fld"><label>Situación</label><select class="inp" v-model="n.situacion"><option value="nuevo">Candidato nuevo (todavía sin prácticas)</option><option value="practicas">Ya hizo, o está haciendo, prácticas con nosotros</option></select></div>
      <div v-if="n.situacion==='practicas'" class="grid2">
        <div class="fld"><label>Inicio de las prácticas *</label><input class="inp" type="date" v-model="n.inicio" /></div>
        <div class="fld"><label>Fin de las prácticas *</label><input class="inp" type="date" v-model="n.fin" /></div>
        <div class="fld"><label>Hora de entrada (opcional)</label><input class="inp" type="time" v-model="n.horaIni" /></div>
        <div class="fld"><label>Hora de salida (opcional)</label><input class="inp" type="time" v-model="n.horaFin" /></div>
        <div class="fld"><label>Tutor en la gestoría (opcional)</label><select class="inp" v-model="n.tutor"><option value="">Sin tutor asignado</option><OpcionesPersonas :actual="n.tutor" /></select></div>
        <div class="aviso gold" style="grid-column:1/-1"><Ic n="info" :s="16" /><span>Se registra directamente como estudiante en prácticas: sale en el cuadrante y en «Estudiantes». Si las fechas ya pasaron, queda como «Finalizado».</span></div>
      </div>
      <div class="fld"><label>Observaciones</label><textarea class="inp" v-model="n.obs" rows="2"></textarea></div>
      <template #pie><button class="btn" @click="cerrarAlta">Cancelar</button><button class="btn btn-primary" @click="guardar"><Ic n="check" :s="16" />Registrar candidato</button></template>
    </Modal>
  </div>`,
};
