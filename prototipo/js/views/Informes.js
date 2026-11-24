// Informes: cómo va la colaboración con cada centro y cada convocatoria (curso académico, de septiembre a agosto).
import { ref, computed } from "vue";
import { store, centroDe, entrevistasDe, estudianteDe, estadoPracticas, nombreCompleto } from "../store.js";
import { go } from "../router.js";
import { Ic } from "../ui.js";
import { crearXlsx } from "../exportar.js";
import { descargarBlob, HOY_ISO } from "../util.js";

// Curso académico de una fecha ISO: septiembre de 2026 → «2026/27»
export const cursoDe = (iso) => { if (!iso) return ""; const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); const i = m >= 9 ? a : a - 1; return `${i}/${String((i + 1) % 100).padStart(2, "0")}`; };
const SELECCIONADOS = ["seleccionado", "seleccionado-esperando", "incorporado", "finalizado"];

function resumen(cands) {
  const r = { candidatos: cands.length, entrevistados: 0, seleccionados: 0, practicas: 0, enCurso: 0, finalizadas: 0, horas: 0, convenio: 0 };
  for (const c of cands) {
    const est = estudianteDe(c.id);
    if (c.nota != null || entrevistasDe(c.id).some((e) => e.estado === "Realizada")) r.entrevistados++;
    if (est || SELECCIONADOS.includes(c.estado)) r.seleccionados++;
    if (est) {
      r.practicas++; r.horas += Number(est.horas) || 0; if (est.convenio) r.convenio++;
      const ep = estadoPracticas(est); if (ep === "En curso") r.enCurso++; if (ep === "Finalizada") r.finalizadas++;
    }
  }
  r.tasa = r.candidatos ? Math.round((r.practicas / r.candidatos) * 100) : 0;
  return r;
}

export default {
  components: { Ic },
  setup() {
    // La convocatoria de cada candidato: la de sus prácticas si las tiene; si no, la de su registro
    const cursoCand = (c) => cursoDe(estudianteDe(c.id)?.inicio || c.creado);
    const cursos = computed(() => [...new Set(store.candidatos.map(cursoCand).filter(Boolean))].sort().reverse());
    const curso = ref(cursoDe(HOY_ISO));
    const delCurso = computed(() => store.candidatos.filter((c) => !curso.value || cursoCand(c) === curso.value));
    const porCentro = computed(() => {
      const m = new Map();
      for (const c of delCurso.value) { const k = c.centroId || "_"; if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
      return [...m].map(([id, l]) => ({ id, nombre: centroDe(id)?.nombre || "Autopostulados", ...resumen(l) })).sort((a, b) => b.candidatos - a.candidatos || a.nombre.localeCompare(b.nombre));
    });
    const total = computed(() => resumen(delCurso.value));
    const porCurso = computed(() => cursos.value.map((k) => ({ curso: k, ...resumen(store.candidatos.filter((c) => cursoCand(c) === k)) })));
    const COLS = [["candidatos", "Candidatos"], ["entrevistados", "Entrevistados"], ["seleccionados", "Seleccionados"], ["practicas", "Prácticas"], ["enCurso", "En curso"], ["finalizadas", "Finalizadas"], ["horas", "Horas"], ["convenio", "Con convenio"], ["tasa", "% a prácticas"]];
    const vista = ref("centro");
    function exportar() {
      const cab = COLS.map(([, t]) => t);
      const fila = (x) => COLS.map(([k]) => x[k]);
      const detalle = delCurso.value.map((c) => { const e = estudianteDe(c.id); return [nombreCompleto(c), centroDe(c.centroId)?.nombre || "Autopostulado", c.titulacion || "", cursoCand(c), store.estados.find((s) => s.k === c.estado)?.n || c.estado, e ? estadoPracticas(e) : "", e?.horas || "", e?.evaluacion?.resultado || ""]; });
      descargarBlob(crearXlsx([
        { nombre: "Por centro", cabeceras: ["Centro", ...cab], filas: [...porCentro.value.map((x) => [x.nombre, ...fila(x)]), ["TOTAL", ...fila(total.value)]] },
        { nombre: "Por convocatoria", cabeceras: ["Convocatoria", ...cab], filas: porCurso.value.map((x) => [x.curso, ...fila(x)]) },
        { nombre: "Detalle", cabeceras: ["Persona", "Centro", "Titulación", "Convocatoria", "Estado", "Prácticas", "Horas", "Evaluación"], filas: detalle },
      ]), `Informe-practicas_${(curso.value || "Todos").replace("/", "-")}_${HOY_ISO}.xlsx`);
    }
    return { cursos, curso, porCentro, total, porCurso, COLS, vista, exportar, go };
  },
  template: `<div class="page">
    <div class="page-head">
      <div><h1>Informes</h1><p>Colaboración por centro educativo y por convocatoria (curso académico, de septiembre a agosto).</p></div>
      <div class="row right"><button class="btn" @click="exportar"><Ic n="download" :s="15" />Descargar en Excel</button></div>
    </div>
    <div class="card">
      <div class="card-pad row wrap" style="gap:10px">
        <div class="seg" role="group"><button :class="{on: vista==='centro'}" @click="vista='centro'">Por centro</button><button :class="{on: vista==='curso'}" @click="vista='curso'">Por convocatoria</button></div>
        <select v-if="vista==='centro'" class="inp" v-model="curso" style="width:auto"><option value="">Todas las convocatorias</option><option v-for="k in cursos" :key="k" :value="k">Convocatoria {{ k }}</option></select>
        <span class="sub">La convocatoria es la del inicio de las prácticas o, si no las ha hecho, la de su registro.</span>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>{{ vista==='centro' ? 'Centro' : 'Convocatoria' }}</th><th v-for="[k,t] in COLS" :key="k" style="text-align:right">{{ t }}</th></tr></thead>
        <tbody v-if="vista==='centro'">
          <tr v-for="x in porCentro" :key="x.id" @click="x.id !== '_' && go('centros/' + x.id)" :style="{cursor: x.id !== '_' ? 'pointer' : 'default'}"><td><b>{{ x.nombre }}</b></td><td v-for="[k] in COLS" :key="k" style="text-align:right">{{ x[k] }}{{ k==='tasa' ? ' %' : '' }}</td></tr>
          <tr v-if="!porCentro.length"><td :colspan="COLS.length + 1" class="sub">No hay candidatos en esta convocatoria.</td></tr>
          <tr v-else style="font-weight:700"><td>Total</td><td v-for="[k] in COLS" :key="k" style="text-align:right">{{ total[k] }}{{ k==='tasa' ? ' %' : '' }}</td></tr>
        </tbody>
        <tbody v-else>
          <tr v-for="x in porCurso" :key="x.curso" style="cursor:pointer" @click="curso = x.curso; vista = 'centro'"><td><b>{{ x.curso }}</b></td><td v-for="[k] in COLS" :key="k" style="text-align:right">{{ x[k] }}{{ k==='tasa' ? ' %' : '' }}</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>`,
};
