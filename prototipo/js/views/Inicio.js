import { computed } from "vue";
import { store, centroDe, candDe, nombreCompleto, estadoPracticas, turnoEstudiante } from "../store.js";
import { go } from "../router.js";
import { Ic, Chip, Avatar, Num } from "../ui.js";
import { ESTADOS_CITA } from "../data.js";
import { HOY_ISO, dia, fCorta, diaCorto, diaNum, relativo, difDias } from "../util.js";
import { filtros } from "./Candidatos.js";

export default {
  components: { Ic, Chip, Avatar, Num },
  setup() {
    const enCurso = computed(() => store.estudiantes.filter((e) => estadoPracticas(e) === "En curso"));
    const previstas = computed(() => store.estudiantes.filter((e) => estadoPracticas(e) === "Prevista").sort((a, b) => a.inicio.localeCompare(b.inicio)));
    const finalizan = computed(() => enCurso.value.filter((e) => difDias(e.fin, HOY_ISO) <= 14).sort((a, b) => a.fin.localeCompare(b.fin)));
    const proximas = computed(() => store.entrevistas.filter((e) => e.fecha >= HOY_ISO && ["Pendiente", "Confirmada", "Reprogramada"].includes(e.estado)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)));
    const sinValorar = computed(() => store.entrevistas.filter((e) => e.estado === "Realizada" && candDe(e.candId)?.nota == null));
    const cuenta = (k) => store.candidatos.filter((c) => c.estado === k).length;

    const kpis = computed(() => [
      { t: "Candidatos registrados", v: store.candidatos.length, s: `${cuenta("pendiente-revision")} pendientes de revisión`, i: "candidatos", ir: () => irCands("") },
      { t: "Entrevistas próximas", v: proximas.value.length, s: proximas.value[0] ? `La siguiente, ${relativo(proximas.value[0].fecha)}` : "Ninguna programada", i: "entrevistas", ir: () => go("entrevistas") },
      { t: "Pendientes de valorar", v: sinValorar.value.length, s: "Entrevistas hechas sin nota", i: "star", tono: sinValorar.value.length ? "am" : "", ir: () => irCands("", "sinvalorar") },
      { t: "Seleccionados", v: cuenta("seleccionado"), s: "Pendientes de incorporación", i: "check", ir: () => irCands("seleccionado") },
      { t: "En prácticas ahora", v: enCurso.value.length, s: `${finalizan.value.length} finalizan en 14 días`, i: "estudiantes", ir: () => go("estudiantes") },
      { t: "Próximas incorporaciones", v: previstas.value.length, s: previstas.value[0] ? `Desde el ${fCorta(previstas.value[0].inicio)}` : "Sin fecha prevista", i: "calendario", ir: () => go("estudiantes") },
    ]);
    function irCands(estado, rapido = "") { filtros.estado = estado; filtros.rapido = rapido; filtros.q = ""; filtros.centro = ""; filtros.turno = ""; go("candidatos"); }

    // Aforo: el día con más gente por turno en los próximos 14 días
    const picos = computed(() => {
      const out = [];
      for (const turno of ["Mañana", "Tarde"]) {
        let max = 0, cuando = HOY_ISO;
        for (let i = 0; i <= 14; i++) {
          const d = dia(i);
          const n = store.estudiantes.filter((e) => e.inicio <= d && e.fin >= d && turnoEstudiante(e) === turno).length;
          if (n > max) { max = n; cuando = d; }
        }
        out.push({ turno, max, cuando, aforo: store.aforo[turno] });
      }
      return out;
    });
    const alertas = computed(() => {
      const a = [];
      if (sinValorar.value.length) a.push({ tono: "am", i: "star", t: `${sinValorar.value.length} entrevistas realizadas sin valorar`, s: sinValorar.value.map((e) => candDe(e.candId).nombre).join(", "), ir: () => irCands("", "sinvalorar"), cta: "Valorar" });
      picos.value.filter((p) => p.max > p.aforo).forEach((p) => a.push({ tono: "err", i: "alert", t: `Turno de ${p.turno.toLowerCase()} por encima del aforo el ${fCorta(p.cuando)}`, s: `${p.max} estudiantes para ${p.aforo} plazas supervisables`, ir: () => go("estudiantes/cuadrante"), cta: "Ver cuadrante" }));
      finalizan.value.forEach((e) => a.push({ tono: "info", i: "clock", t: `${nombreCompleto(candDe(e.candId))} termina sus prácticas ${relativo(e.fin)}`, s: `${fCorta(e.fin)} · ${e.tutor ? "tutor: " + e.tutor : "sin tutor asignado"}`, ir: () => go("candidato/" + e.candId), cta: "Abrir ficha" }));
      const hoyC = cuenta("pendiente-revision");
      if (hoyC) a.push({ tono: "gold", i: "documentos", t: `${hoyC} currículums nuevos por revisar`, s: "Recibidos por correo y de los centros", ir: () => irCands("pendiente-revision"), cta: "Revisar" });
      return a;
    });

    const embudo = computed(() => { const max = Math.max(1, ...store.estados.map((e) => cuenta(e.k))); return store.estados.filter((e) => e.activo).map((e) => ({ ...e, n2: cuenta(e.k), w: (cuenta(e.k) / max) * 100 })); });
    const porCentro = computed(() => {
      const m = {};
      store.candidatos.forEach((c) => { const k = c.centroId || "_"; (m[k] ||= { id: k, nombre: centroDe(c.centroId)?.nombre || "Autopostulados", total: 0, activos: 0 }).total++; });
      store.estudiantes.filter((e) => estadoPracticas(e) === "En curso").forEach((e) => { if (m[e.centroId]) m[e.centroId].activos++; });
      const l = Object.values(m).sort((a, b) => b.total - a.total).slice(0, 7); const max = l[0]?.total || 1;
      return l.map((x) => ({ ...x, w: (x.total / max) * 100, wa: (x.activos / max) * 100 }));
    });
    const hoyTurnos = computed(() => ["Mañana", "Tarde"].map((t) => {
      const l = enCurso.value.filter((e) => turnoEstudiante(e) === t);
      return { t, def: store.turnosDef[t], l: l.map((e) => candDe(e.candId)), n: l.length, aforo: store.aforo[t] };
    }));
    return { kpis, alertas, proximas, embudo, porCentro, hoyTurnos, previstas, go, irCands, candDe, centroDe, nombreCompleto, ESTADOS_CITA, fCorta, diaCorto, diaNum, relativo, turnoEstudiante };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Buenos días</h1><p>Así está hoy el proceso de prácticas de la gestoría.</p></div>
      <div class="acciones">
        <button class="btn" @click="go('entrevistas')"><Ic n="calendario" :s="16" />Programar entrevista</button>
        <button class="btn btn-accent" @click="go('candidatos/nuevo')"><Ic n="plus" :s="16" />Nuevo candidato</button>
      </div>
    </div>

    <div class="kpis">
      <button v-for="k in kpis" :key="k.t" class="card kpi" :class="k.tono" @click="k.ir()">
        <span class="kpi-ico"><Ic :n="k.i" :s="18" /></span>
        <span class="kpi-t">{{ k.t }}</span><Num :v="k.v" /><small>{{ k.s }}</small>
      </button>
    </div>

    <div class="dash">
      <section class="card">
        <div class="card-head"><h3>Requiere tu atención</h3><span class="tag">{{ alertas.length }}</span></div>
        <div class="alertas">
          <div v-for="(a,i) in alertas" :key="i" class="alerta" :class="a.tono">
            <span class="alerta-ico"><Ic :n="a.i" :s="16" /></span>
            <div class="grow"><b>{{ a.t }}</b><small>{{ a.s }}</small></div>
            <button class="btn btn-sm" @click="a.ir()">{{ a.cta }}</button>
          </div>
          <div v-if="!alertas.length" class="vacio-box"><b>Todo al día</b><span>No hay nada pendiente.</span></div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Próximas entrevistas</h3><a class="right" @click="go('entrevistas')" style="cursor:pointer">Ver agenda</a></div>
        <div class="lista">
          <a v-for="e in proximas.slice(0,6)" :key="e.id" class="item" @click="go('candidato/'+e.candId)">
            <span class="fecha-b"><small>{{ diaCorto(e.fecha) }}</small><b>{{ diaNum(e.fecha) }}</b></span>
            <span class="grow"><b>{{ nombreCompleto(candDe(e.candId)) }}</b><small>{{ e.hora }} · {{ e.modalidad }} · {{ e.entrevistador ? "con " + e.entrevistador : "sin responsable" }} · {{ centroDe(candDe(e.candId).centroId)?.nombre || 'Autopostulado' }}</small></span>
            <Chip :texto="e.estado" :c="ESTADOS_CITA[e.estado].c" :cd="ESTADOS_CITA[e.estado].cd" />
          </a>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Candidatos por fase</h3><a class="right" @click="go('candidatos')" style="cursor:pointer">Ver todos</a></div>
        <div class="barras">
          <button v-for="e in embudo" :key="e.k" class="barra" @click="irCands(e.k)" :title="'Ver candidatos en «'+e.n+'»'">
            <span class="barra-n">{{ e.n }}</span>
            <span class="barra-pista"><i :style="{width: e.w+'%', background: e.c}"></i></span>
            <b>{{ e.n2 }}</b>
          </button>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Hoy en la oficina</h3><a class="right" @click="go('estudiantes/cuadrante')" style="cursor:pointer">Cuadrante</a></div>
        <div class="turnos-hoy">
          <div v-for="t in hoyTurnos" :key="t.t" class="turno-hoy">
            <div class="row"><b>{{ t.t }}</b><span class="sub">{{ t.def.ini }}–{{ t.def.fin }}</span><span class="right aforo" :class="{lleno: t.n>=t.aforo, pasa: t.n>t.aforo}">{{ t.n }} / {{ t.aforo }}</span></div>
            <div class="medidor"><i v-for="k in t.aforo" :key="k" :class="{on: k<=t.n}"></i></div>
            <div class="row wrap" style="gap:6px">
              <a v-for="c in t.l" :key="c.id" class="persona" @click="go('candidato/'+c.id)"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="22" />{{ c.nombre }}</a>
              <span v-if="!t.l.length" class="muted">Nadie en este turno</span>
            </div>
          </div>
          <div v-if="previstas.length" class="aviso gold"><Ic n="calendario" :s="16" /><span><b>{{ previstas.length }} incorporaciones previstas</b> el {{ fCorta(previstas[0].inicio) }}: {{ previstas.map(e => candDe(e.candId).nombre + ' (' + turnoEstudiante(e).toLowerCase() + ')').join(', ') }}.</span></div>
        </div>
      </section>

      <section class="card ancho">
        <div class="card-head"><h3>Colaboración por centro</h3><span class="sub right">Candidatos totales · <span style="color:var(--cyan-dark);font-weight:600">en prácticas ahora</span></span></div>
        <div class="barras centros">
          <button v-for="c in porCentro" :key="c.id" class="barra" @click="c.id==='_' ? irCands('') : go('centros/'+c.id)">
            <span class="barra-n">{{ c.nombre }}</span>
            <span class="barra-pista"><i :style="{width: c.w+'%', background: 'var(--navy-300)'}"></i><i class="sobre" :style="{width: c.wa+'%'}"></i></span>
            <b>{{ c.total }}</b>
          </button>
        </div>
      </section>
    </div>
  </div>`,
};
