import { computed, reactive } from "vue";
import { store, candDe, centroDe, nombreCompleto, estadoPracticas, turnoEstudiante, etiquetaTurno } from "../store.js";
import { ruta, go } from "../router.js";
import { Ic, Chip, Avatar, Vacio } from "../ui.js";
import { registrar } from "../api.js";
import { elegirMensaje } from "../mensajes.js";
import { gentrivo, cargarGentrivo, enGentrivo, textoHoy, hoyEsCambio, proximosCambios, semana, DIAS_SEMANA, TIPO_CAMBIO } from "../gentrivo.js";
import { toast } from "../store.js";
import { filtros as filtrosC } from "./Candidatos.js";
import { AREAS } from "../data.js";
import { cumpleArea, urlWhatsApp, HOY_ISO, dia, lunesDe, fCorta, fCompleta, diaCorto, diaNum, difDias, relativo } from "../util.js";

const COLOR = { "En curso": ["var(--cyan)", "var(--cyan-dark)"], Prevista: ["var(--gold-500)", "var(--gold-700)"], Finalizada: ["var(--text-400)", "var(--text-600)"] };
const estado = reactive({ semana: lunesDe(HOY_ISO), filtro: "activos" });

export default {
  components: { Ic, Chip, Avatar, Vacio },
  setup() {
    const s = estado;
    cargarGentrivo();
    const vista = computed(() => (ruta.value.id === "cuadrante" ? "cuadrante" : "lista"));
    const filas = computed(() => store.estudiantes.filter((e) => cumpleArea(candDe(e.candId)?.area, filtrosC.area, AREAS)).map((e) => {
      const c = candDe(e.candId), est = estadoPracticas(e);
      const total = Math.max(1, difDias(e.fin, e.inicio)), hecho = Math.min(total, Math.max(0, difDias(HOY_ISO, e.inicio)));
      return { e, c, est, g: enGentrivo(c), turno: turnoEstudiante(e), pct: est === "Finalizada" ? 100 : est === "Prevista" ? 0 : Math.round((hecho / total) * 100), quedan: difDias(e.fin, HOY_ISO) };
    }).filter((f) => s.filtro === "todos" || (s.filtro === "activos" ? f.est !== "Finalizada" : f.est === "Finalizada"))
      .sort((a, b) => a.e.fin.localeCompare(b.e.fin)));

    // Cuadrante: tres semanas, por día y turno
    const diasCuad = computed(() => [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].map((i) => dia(i, s.semana)));
    const celda = (d, turno) => {
      const l = store.estudiantes.filter((e) => e.inicio <= d && e.fin >= d && turnoEstudiante(e) === turno).map((e) => ({ e, c: candDe(e.candId), nuevo: e.inicio === d, ultimo: e.fin === d, previsto: e.inicio > HOY_ISO }));
      const aforo = store.aforo[turno];
      return { l, n: l.length, aforo, pasa: false, lleno: false };
    };
    const cuadrante = computed(() => diasCuad.value.map((d) => ({ d, hoy: d === HOY_ISO, lunes: diaCorto(d) === "Lun", M: celda(d, "Mañana"), T: celda(d, "Tarde"), T2: celda(d, "Tarde 2") })));
    const excesos = computed(() => cuadrante.value.filter((f) => f.M.pasa || f.T.pasa || f.T2.pasa).length);
    const mover = (n) => { s.semana = n === 0 ? lunesDe(HOY_ISO) : dia(n * 7, s.semana); };

    const menuCand = (c) => ({ titulo: nombreCompleto(c), items: [
      { t: "Abrir la ficha", i: "user", f: () => go("candidato/" + c.id) },
      { t: "Escribir por WhatsApp…", i: "whatsapp", f: () => elegirMensaje("whatsapp", c) },
      { t: "Enviar un correo…", i: "mail", f: () => elegirMensaje("correo", c) },
    ] });
    return { filtrosC, gentrivo, cargarGentrivo, textoHoy, hoyEsCambio, menuCand, etiquetaTurno, store, s, vista, filas, cuadrante, excesos, mover, go, centroDe, nombreCompleto, COLOR, fCorta, fCompleta, diaCorto, diaNum, relativo, diasCuad };
  },
  template: `
  <div class="page">
    <div v-if="filtrosC.area" class="chip-area-global"><span class="chip-filtro" @click="filtrosC.area = ''" role="button" tabindex="0">Área: {{ filtrosC.area === '__otras' ? 'Otra' : filtrosC.area }}<Ic n="x" :s="14" /></span><span class="sub">Solo se ve lo de esta área (elegida en Inicio o en Candidatos).</span></div>
    <div class="page-head">
      <div><h1>Estudiantes en prácticas</h1><p>Seguimiento de quién está en la oficina, en qué turno y hasta cuándo.</p></div>
      <div class="acciones"><div class="seg"><button :class="{on: vista==='lista'}" @click="go('estudiantes')"><Ic n="tabla" :s="15" />Listado</button><button :class="{on: vista==='cuadrante'}" @click="go('estudiantes/cuadrante')"><Ic n="calendario" :s="15" />Cuadrante de turnos</button></div></div>
    </div>

    <div v-if="vista==='lista'" class="card">
      <div class="barra-filtros">
        <button class="pill" :class="{on: s.filtro==='activos'}" @click="s.filtro='activos'">En curso y previstas</button>
        <button class="pill" :class="{on: s.filtro==='finalizados'}" @click="s.filtro='finalizados'">Finalizadas</button>
        <button class="pill" :class="{on: s.filtro==='todos'}" @click="s.filtro='todos'">Todas</button>
        <span class="sub right">Para incorporar a alguien, abre su ficha y pulsa «Convertir en estudiante».</span>
        <span v-if="gentrivo.configurado" class="sub gentrivo-estado"><Ic n="clock" :s="13" /> Horario de hoy según Gentrivo<template v-if="gentrivo.actualizado"> · {{ new Date(gentrivo.actualizado).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}) }}</template> <button class="btn-link" :disabled="gentrivo.cargando" @click="cargarGentrivo(true)">{{ gentrivo.cargando ? 'Actualizando…' : 'Actualizar' }}</button></span>
        <span v-else-if="gentrivo.error" class="sub" style="color:var(--err-dark)">Gentrivo: {{ gentrivo.error }}</span>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Estudiante</th><th>Centro</th><th>Estado</th><th>Turno y horario</th><th>Periodo</th><th style="min-width:130px">Avance</th><th>Horas</th><th>Tutor</th><th>Convenio</th></tr></thead>
        <tbody><tr v-for="f in filas" :key="f.e.candId" @click="go('candidato/'+f.e.candId)" v-ctx="() => menuCand(f.c)">
          <td><div class="who"><Avatar :nombre="f.c.nombre" :apellidos="f.c.apellidos" /><div><b>{{ nombreCompleto(f.c) }}</b><small>{{ f.c.titulacion }}</small></div></div></td>
          <td>{{ centroDe(f.e.centroId)?.nombre || '—' }}</td>
          <td><Chip :texto="f.est" :c="COLOR[f.est][0]" :cd="COLOR[f.est][1]" /></td>
          <td class="nowrap"><template v-if="f.g && f.est==='En curso'"><b>Hoy {{ textoHoy(f.g) }}</b> <span v-if="hoyEsCambio(f.g)" class="tag gold" :title="f.g.hoy.motivo || 'Cambio puntual en Gentrivo'">{{ f.g.hoy.motivo || 'Cambio' }}</span><br><span class="sub">Habitual {{ f.e.horaIni }}–{{ f.e.horaFin }}</span></template><template v-else><b>{{ f.turno === 'Mañana' ? 'Mañana' : 'Tarde' }}</b> <span class="sub">{{ f.e.horaIni }}–{{ f.e.horaFin }}</span></template></td>
          <td class="nowrap">{{ fCorta(f.e.inicio) }} → {{ fCorta(f.e.fin) }}</td>
          <td><div class="avance"><span><i :style="{width: f.pct+'%'}"></i></span><small v-if="f.est==='En curso'" :class="{urge: f.quedan<=14}">{{ f.quedan<=14 ? 'Termina ' + relativo(f.e.fin) : f.pct + ' %' }}</small><small v-else-if="f.est==='Prevista'">Empieza {{ relativo(f.e.inicio) }}</small><small v-else>Completadas</small></div></td>
          <td class="nowrap">{{ f.e.horas }} h</td><td><span v-if="f.e.tutor">{{ f.e.tutor }}</span><span v-else class="muted">Sin tutor</span></td>
          <td><span v-if="f.e.convenio" class="ico-ok row" style="gap:5px"><Ic n="check" :s="15" />Firmado</span><span v-else class="tag gold">Pendiente</span></td>
        </tr></tbody></table>
        <Vacio v-if="!filas.length" titulo="No hay estudiantes en esta vista" texto="" />
      </div>
    </div>

    <div v-else class="card">
      <div class="cal-bar">
        <button class="btn btn-sm" @click="mover(0)">Hoy</button>
        <button class="icon-btn" @click="mover(-1)"><Ic n="chevL" /></button><button class="icon-btn" @click="mover(1)"><Ic n="chevR" /></button>
        <b>{{ fCorta(diasCuad[0]) }} – {{ fCorta(diasCuad[diasCuad.length-1]) }}</b>
        <span class="right leyenda"><span><i style="background:var(--cyan)"></i>En curso</span><span><i class="dash"></i>Incorporación prevista</span></span>
      </div>
      <div class="cuad">
        <div class="cuad-head"><span></span><span>Mañana <small>{{ store.turnosDef['Mañana'].ini }}–{{ store.turnosDef['Mañana'].fin }}</small></span><span>Tarde <small>{{ store.turnosDef['Tarde'].ini }}–{{ store.turnosDef['Tarde'].fin }}</small></span><span>Tarde <small>{{ store.turnosDef['Tarde 2'].ini }}–{{ store.turnosDef['Tarde 2'].fin }}</small></span></div>
        <div v-for="f in cuadrante" :key="f.d" class="cuad-fila" :class="{hoy: f.hoy, lunes: f.lunes}">
          <div class="cuad-dia"><small>{{ diaCorto(f.d) }}</small><b>{{ diaNum(f.d) }}</b><span v-if="f.hoy">hoy</span></div>
          <div v-for="t in [f.M, f.T, f.T2]" class="cuad-celda" :class="{pasa: t.pasa, lleno: t.lleno}">
            <span class="aforo" :title="t.n + (t.n === 1 ? ' persona' : ' personas') + ' en este turno'">{{ t.n }}</span>
            <a v-for="x in t.l" :key="x.e.candId" class="persona" :class="{previsto: x.previsto}" @click="go('candidato/'+x.e.candId)" :title="x.e.horaIni + '–' + x.e.horaFin + (x.e.tutor ? ' · tutor: ' + x.e.tutor : ' · sin tutor')">
              <Avatar :nombre="x.c.nombre" :apellidos="x.c.apellidos" :s="22" />{{ x.c.nombre }} {{ x.c.apellidos.split(' ')[0] }}<em v-if="x.nuevo">empieza</em><em v-else-if="x.ultimo" class="fin">último día</em>
            </a>
            <span v-if="!t.n" class="muted">Libre</span>
          </div>
        </div>
      </div>
    </div>
  </div>`,
};
