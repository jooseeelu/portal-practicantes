import { computed, ref } from "vue";
import { store, centroDe, candDe, nombreCompleto, estadoPracticas, turnoEstudiante, TURNOS_OFICINA, etiquetaTurno } from "../store.js";
import { miNombre } from "../api.js";
import { gentrivo, cargarGentrivo, enGentrivo } from "../gentrivo.js";
import { normal } from "../util.js";

// «Requiere tu atención»: por defecto solo lo de quien ha entrado; «Equipo» enseña lo de todos
const verEquipo = ref(false);
import { go } from "../router.js";
import { Ic, Chip, Avatar, Num } from "../ui.js";
import { ESTADOS_CITA, AREAS } from "../data.js";

// El área elegida en Inicio es el mismo filtro que usan Candidatos, Entrevistas y Estudiantes
const fArea = computed({ get: () => filtros.area || "", set: (v) => { filtros.area = v; } });
import { HOY_ISO, dia, fCorta, diaCorto, diaNum, relativo, difDias } from "../util.js";
import { filtros } from "./Candidatos.js";

export default {
  components: { Ic, Chip, Avatar, Num },
  setup() {
    // Filtro por área de interés: afecta a todo lo que se ve en Inicio
    const cands = computed(() => (fArea.value ? store.candidatos.filter((c) => delArea(c.area)) : store.candidatos));
    const ests = computed(() => (fArea.value ? store.estudiantes.filter((e) => delArea(candDe(e.candId)?.area)) : store.estudiantes));
    const ents = computed(() => (fArea.value ? store.entrevistas.filter((e) => delArea(candDe(e.candId)?.area)) : store.entrevistas));
    const areas = AREAS;
    const delArea = (a) => (fArea.value === "__otras" ? !!a && !AREAS.includes(a) : (a || "") === fArea.value);
    const enCurso = computed(() => ests.value.filter((e) => estadoPracticas(e) === "En curso"));
    const previstas = computed(() => ests.value.filter((e) => estadoPracticas(e) === "Prevista").sort((a, b) => a.inicio.localeCompare(b.inicio)));
    const finalizan = computed(() => enCurso.value.filter((e) => difDias(e.fin, HOY_ISO) <= 14).sort((a, b) => a.fin.localeCompare(b.fin)));
    const proximas = computed(() => ents.value.filter((e) => e.fecha >= HOY_ISO && ["Pendiente", "Confirmada", "Reprogramada"].includes(e.estado)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)));
    const sinValorar = computed(() => ents.value.filter((e) => e.estado === "Realizada" && candDe(e.candId)?.nota == null));
    const cuenta = (k) => cands.value.filter((c) => c.estado === k).length;

    const kpis = computed(() => [
      { t: "Candidatos registrados", v: cands.value.length, s: `${cuenta("pendiente-revision")} pendientes de revisión`, i: "candidatos", ir: () => irCands("") },
      { t: "Entrevistas próximas", v: proximas.value.length, s: proximas.value[0] ? `La siguiente, ${relativo(proximas.value[0].fecha)}` : "Ninguna programada", i: "entrevistas", ir: () => go("entrevistas") },
      { t: "Pendientes de valorar", v: sinValorar.value.length, s: "Entrevistas hechas sin nota", i: "star", tono: sinValorar.value.length ? "am" : "", ir: () => irCands("", "sinvalorar") },
      { t: "Seleccionados", v: cuenta("seleccionado") + cuenta("seleccionado-esperando"), s: "Pendientes de incorporación", i: "check", ir: () => irCands("seleccionado") },
      { t: "En prácticas ahora", v: enCurso.value.length, s: `${finalizan.value.length} finalizan en 14 días`, i: "estudiantes", ir: () => go("estudiantes") },
      { t: "Próximas incorporaciones", v: previstas.value.length, s: previstas.value[0] ? `Desde el ${fCorta(previstas.value[0].inicio)}` : "Sin fecha prevista", i: "calendario", ir: () => go("estudiantes") },
    ]);
    function irCands(estado, rapido = "") { filtros.estado = estado; filtros.rapido = rapido; filtros.q = ""; filtros.centro = ""; filtros.turno = ""; go("candidatos"); }

    // Aforo: el día con más gente por turno en los próximos 14 días
    const picos = computed(() => {
      const out = [];
      for (const turno of TURNOS_OFICINA) {
        let max = 0, cuando = HOY_ISO;
        for (let i = 0; i <= 14; i++) {
          const d = dia(i);
          const n = ests.value.filter((e) => e.inicio <= d && e.fin >= d && turnoEstudiante(e) === turno).length;
          if (n > max) { max = n; cuando = d; }
        }
        out.push({ turno, max, cuando, aforo: store.aforo[turno] });
      }
      return out;
    });
    const yo = normal(miNombre() || "").trim();
    const esMio = (n) => { const x = normal(n || "").trim(); return !!x && !!yo && (x === yo || yo.startsWith(x + " ") || x.startsWith(yo)); };
    const alertas = computed(() => (verEquipo.value ? alertasEquipo.value : alertasMias.value));
    const alertasMias = computed(() => {
      const a = [];
      const mias = sinValorar.value.filter((e) => esMio(e.entrevistador));
      if (mias.length) a.push({ tono: "am", i: "star", t: `${mias.length} entrevista${mias.length === 1 ? "" : "s"} tuya${mias.length === 1 ? "" : "s"} sin valorar`, s: mias.map((e) => candDe(e.candId).nombre).join(", "), ir: () => irCands("", "sinvalorar"), cta: "Valorar" });
      finalizan.value.filter((e) => esMio(e.tutor)).forEach((e) => a.push({ tono: "info", i: "clock", t: `${nombreCompleto(candDe(e.candId))} (tu tutorizado/a) termina ${relativo(e.fin)}`, s: fCorta(e.fin), ir: () => go("candidato/" + e.candId), cta: "Abrir ficha" }));
      return a;
    });
    const alertasEquipo = computed(() => {
      const a = [];
      if (sinValorar.value.length) a.push({ tono: "am", i: "star", t: `${sinValorar.value.length} entrevistas realizadas sin valorar`, s: sinValorar.value.map((e) => candDe(e.candId).nombre).join(", "), ir: () => irCands("", "sinvalorar"), cta: "Valorar" });
      // (El aviso de aforo se quitó a petición del equipo)
      finalizan.value.forEach((e) => a.push({ tono: "info", i: "clock", t: `${nombreCompleto(candDe(e.candId))} termina sus prácticas ${relativo(e.fin)}`, s: `${fCorta(e.fin)} · ${e.tutor ? "tutor: " + e.tutor : "sin tutor asignado"}`, ir: () => go("candidato/" + e.candId), cta: "Abrir ficha" }));
      const hoyC = cuenta("pendiente-revision");
      if (hoyC) a.push({ tono: "gold", i: "documentos", t: `${hoyC} currículums nuevos por revisar`, s: "Recibidos por correo y de los centros", ir: () => irCands("pendiente-revision"), cta: "Revisar" });
      return a;
    });

    const embudo = computed(() => { const max = Math.max(1, ...store.estados.map((e) => cuenta(e.k))); return store.estados.filter((e) => e.activo).map((e) => ({ ...e, n2: cuenta(e.k), w: (cuenta(e.k) / max) * 100 })); });
    const porCentro = computed(() => {
      const m = {};
      cands.value.forEach((c) => { const k = c.centroId || "_"; (m[k] ||= { id: k, nombre: centroDe(c.centroId)?.nombre || "Autopostulados", total: 0, activos: 0 }).total++; });
      ests.value.filter((e) => estadoPracticas(e) === "En curso").forEach((e) => { const k = e.centroId || "_"; if (m[k]) m[k].activos++; });
      const l = Object.values(m).sort((a, b) => b.activos - a.activos || b.total - a.total).slice(0, 7); const max = l[0]?.total || 1;
      return l.map((x) => ({ ...x, w: (x.total / max) * 100, wa: (x.activos / max) * 100 }));
    });
    // Hoy en la oficina: solo quien ha fichado hoy en Gentrivo (no quien debería venir)
    cargarGentrivo();
    const fichado = (c) => enGentrivo(c)?.fichajeHoy || null;
    const hoyTurnos = computed(() => TURNOS_OFICINA.map((t) => {
      const l = enCurso.value.filter((e) => turnoEstudiante(e) === t).map((e) => candDe(e.candId)).filter((c) => c && fichado(c));
      return { t, def: store.turnosDef[t], l: l.map((c) => ({ c, f: fichado(c) })), n: l.length };
    }));
    return { gentrivo, verEquipo, fArea, areas, kpis, alertas, proximas, embudo, porCentro, hoyTurnos, previstas, go, irCands, candDe, centroDe, nombreCompleto, ESTADOS_CITA, fCorta, diaCorto, diaNum, relativo, turnoEstudiante, etiquetaTurno };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Buenos días</h1><p>Así está hoy el proceso de prácticas de la gestoría.</p></div>
      <div class="acciones">
        <select class="inp" v-model="fArea" style="width:auto;min-width:190px" title="Filtrar todo Inicio por área de interés"><option value="">Todas las áreas</option><option v-for="a in areas" :key="a" :value="a">{{ a }}</option><option value="__otras">Otra (texto libre)</option></select>
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
      <div class="dash-col">
      <section class="card">
        <div class="card-head"><h3>Requiere tu atención</h3><span class="tag">{{ alertas.length }}</span><div class="seg seg-mini right" role="group" aria-label="De quién"><button :class="{on: !verEquipo}" @click="verEquipo = false">Lo mío</button><button :class="{on: verEquipo}" @click="verEquipo = true">Equipo</button></div></div>
        <div class="alertas">
          <div v-for="(a,i) in alertas" :key="i" class="alerta" :class="a.tono">
            <span class="alerta-ico"><Ic :n="a.i" :s="16" /></span>
            <div class="grow"><b>{{ a.t }}</b><small>{{ a.s }}</small></div>
            <button class="btn btn-sm" @click="a.ir()">{{ a.cta }}</button>
          </div>
          <div v-if="!alertas.length" class="vacio-box"><b>Todo al día</b><span>{{ verEquipo ? 'No hay nada pendiente.' : 'No tienes nada pendiente: ni entrevistas tuyas sin valorar ni tutorizados que terminen pronto.' }}</span></div>
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

      <section class="card ancho">
        <div class="card-head"><h3>Colaboración por centro</h3><span class="sub right"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--navy-300)"></span> candidatos totales · <a @click="go('estudiantes')" style="cursor:pointer;color:var(--cyan-dark);font-weight:600"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--cyan-dark)"></span> en prácticas ahora</a></span></div>
        <div class="barras centros">
          <button v-for="c in porCentro" :key="c.id" class="barra" @click="c.id==='_' ? irCands('') : go('centros/'+c.id)">
            <span class="barra-n">{{ c.nombre }}<small v-if="c.activos" style="display:block;color:var(--cyan-dark);font-weight:600;font-size:11px;line-height:1.2">{{ c.activos }} en prácticas ahora</small></span>
            <span class="barra-pista"><i :style="{width: c.w+'%', background: 'var(--navy-300)'}"></i><i class="sobre" :style="{width: c.wa+'%'}"></i></span>
            <b :title="c.activos + ' en prácticas ahora de ' + c.total + ' candidatos'">{{ c.total }}</b>
          </button>
        </div>
      </section>
      </div>
      <div class="dash-col">
      <section class="card">
        <div class="card-head"><h3>Candidatos por fase</h3><a class="right" @click="irCands('')" style="cursor:pointer">Ver todos</a></div>
        <div class="barras">
          <button v-for="e in embudo" :key="e.k" class="barra" @click="irCands(e.k)" :title="'Ver candidatos en «'+e.n+'»'">
            <span class="barra-n">{{ e.n }}</span>
            <span class="barra-pista"><i :style="{width: e.w+'%', background: e.c}"></i></span>
            <b>{{ e.n2 }}</b>
          </button>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Hoy en la oficina</h3><span v-if="gentrivo.configurado" class="sub" style="margin-left:8px">según los fichajes de Gentrivo</span><a class="right" @click="go('estudiantes/cuadrante')" style="cursor:pointer">Cuadrante</a></div>
        <div class="turnos-hoy">
          <div v-for="t in hoyTurnos" :key="t.t" class="turno-hoy">
            <div class="row"><b>{{ t.t === 'Mañana' ? t.t : 'Tarde' }}</b><span class="sub">{{ t.def.ini }}–{{ t.def.fin }}</span></div>
            <div class="row wrap" style="gap:6px">
              <a v-for="x in t.l" :key="x.c.id" class="persona" :title="x.f.salida ? 'Entró a las ' + x.f.entrada + ' y salió a las ' + x.f.salida : 'Dentro desde las ' + x.f.entrada" @click="go('candidato/'+x.c.id)"><Avatar :nombre="x.c.nombre" :apellidos="x.c.apellidos" :foto="x.c.foto" :s="22" />{{ x.c.nombre }} <span class="sub">{{ x.f.salida ? 'salió ' + x.f.salida : 'desde ' + x.f.entrada }}</span></a>
              <span v-if="!t.l.length" class="muted">Nadie ha fichado en este turno</span>
            </div>
          </div>
          <div v-if="previstas.length" class="aviso gold"><Ic n="calendario" :s="16" /><span><b>{{ previstas.length }} incorporaciones previstas</b> el {{ fCorta(previstas[0].inicio) }}: {{ previstas.map(e => candDe(e.candId).nombre + ' (' + etiquetaTurno(turnoEstudiante(e)).toLowerCase() + ')').join(', ') }}.</span></div>
        </div>
      </section>
      </div>
    </div>
  </div>`,
};
