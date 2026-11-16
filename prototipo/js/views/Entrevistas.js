import { computed, reactive, ref } from "vue";
import { store, candDe, centroDe, nombreCompleto, programarEntrevista, cambiarEstado, addHist, toast } from "../store.js";
import { go } from "../router.js";
import { enviarPlantilla } from "../mensajes.js";
import { miNombre, registrar } from "../api.js";
import { Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Vacio, pedirConfirmacion, OpcionesPersonas } from "../ui.js";
import { ESTADOS_CITA, ENTREVISTADORES, HORAS_ENTREVISTA } from "../data.js";
import { HOY_ISO, dia, lunesDe, fCorta, fLarga, diaCorto, diaNum, aMin, deMin, normal, esFinde, urlWhatsApp } from "../util.js";

const H0 = 10, H1 = 20, PX = 64, DUR = 45; // horario visible, píxeles por hora y duración de una entrevista
const estado = reactive({ vista: "calendario", semana: lunesDe(dia(3)), fEstado: "", fQuien: "", q: "", orden: { col: "fecha", dir: "desc" } });

export default {
  components: { OpcionesPersonas, Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Vacio },
  setup() {
    const s = estado;
    const dias = computed(() => [0, 1, 2, 3, 4].map((i) => dia(i, s.semana)));
    const horas = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
    const filtradas = computed(() => store.entrevistas.filter((e) => !s.fQuien || (s.fQuien === "_ninguno" ? !e.entrevistador : e.entrevistador === s.fQuien)));

    // Reparto en carriles de las citas que se pisan
    function colocar(evs) {
      const l = evs.map((e) => ({ e, ini: aMin(e.hora), fin: aMin(e.hora) + DUR })).sort((a, b) => a.ini - b.ini);
      const out = []; let grupo = [], fin = -1;
      const cerrar = () => { const n = Math.max(...grupo.map((g) => g.carril)) + 1; grupo.forEach((g) => { g.n = n; out.push(g); }); grupo = []; };
      for (const x of l) {
        if (grupo.length && x.ini >= fin) { cerrar(); fin = -1; }
        let c = 0; while (grupo.some((g) => g.carril === c && g.fin > x.ini)) c++;
        x.carril = c; grupo.push(x); fin = Math.max(fin, x.fin);
      }
      if (grupo.length) cerrar();
      return out.map((g) => ({ ...g, top: ((g.ini - H0 * 60) / 60) * PX, alto: (DUR / 60) * PX - 3, izq: (g.carril / g.n) * 100, ancho: 100 / g.n }));
    }
    const porDia = computed(() => dias.value.map((d) => ({ d, hoy: d === HOY_ISO, citas: colocar(filtradas.value.filter((e) => e.fecha === d)) })));
    const tituloSemana = computed(() => `${fCorta(dias.value[0])} – ${fCorta(dias.value[4])}`);
    const mover = (n) => { s.semana = n === 0 ? lunesDe(HOY_ISO) : dia(n * 7, s.semana); };

    const lista = computed(() => {
      const n = normal(s.q);
      return filtradas.value.filter((e) => (!s.fEstado || e.estado === s.fEstado) && (!n || normal(nombreCompleto(candDe(e.candId))).includes(n)))
        .sort((a, b) => {
          const v = (e) => {
            const c = candDe(e.candId);
            return s.orden.col === "cand" ? normal(nombreCompleto(c)) : s.orden.col === "centro" ? normal(centroDe(c.centroId)?.nombre || "Autopostulado") : s.orden.col === "resp" ? normal(e.entrevistador || "zzz") : s.orden.col === "estado" ? e.estado : s.orden.col === "nota" ? String(c.nota ?? -1).padStart(5, "0") : e.fecha + e.hora;
          };
          const r = v(a).localeCompare(v(b)) || (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
          return s.orden.dir === "asc" ? r : -r;
        });
    });
    const ordenar = (col) => { s.orden = s.orden.col === col ? { col, dir: s.orden.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "fecha" ? "desc" : "asc" }; };
    const flecha = (col) => (s.orden.col === col ? (s.orden.dir === "asc" ? "▲" : "▼") : "↕");
    const cuentas = computed(() => Object.keys(ESTADOS_CITA).map((k) => ({ ...ESTADOS_CITA[k], k, n: filtradas.value.filter((e) => e.estado === k).length })));

    // Detalle de una cita
    const sel = ref(null);
    const selCand = computed(() => (sel.value ? candDe(sel.value.candId) : null));
    const reprog = reactive({ abierto: false, fecha: "", hora: "" });
    const confirmar = () => { sel.value.estado = "Confirmada"; addHist(sel.value.candId, "entrevista", "Entrevista confirmada"); toast("Cita confirmada"); };
    const cancelar = async () => {
      const e = sel.value, c0 = selCand.value;
      if (!(await pedirConfirmacion({ titulo: "¿Cancelar esta entrevista?", texto: `La cita de ${nombreCompleto(c0)} (${fCorta(e.fecha)}, ${e.hora}) quedará cancelada. Se puede volver a programar después.`, boton: "Sí, cancelar la cita" }))) return;
      sel.value.estado = "Cancelada"; addHist(sel.value.candId, "entrevista", "Entrevista cancelada"); const c = selCand.value; if (c.estado === "entrevista-programada") cambiarEstado(c, "pendiente-entrevista", { silencioso: true }); toast("Cita cancelada"); sel.value = null; };
    const abrirReprog = () => Object.assign(reprog, { abierto: true, fecha: sel.value.fecha, hora: sel.value.hora });
    const guardarReprog = () => { if (esFinde(reprog.fecha)) return toast("Ese día es fin de semana. Elige un día de lunes a viernes.", "error"); Object.assign(sel.value, { fecha: reprog.fecha, hora: reprog.hora, estado: "Reprogramada" }); addHist(sel.value.candId, "entrevista", `Entrevista reprogramada para el ${reprog.fecha} a las ${reprog.hora}`); reprog.abierto = false; toast("Cita reprogramada"); };
    const valorar = () => { if (sel.value.estado !== "Realizada") { sel.value.estado = "Realizada"; addHist(sel.value.candId, "entrevista", sel.value.entrevistador ? `Entrevista realizada por ${sel.value.entrevistador}` : "Entrevista realizada", sel.value.entrevistador || miNombre()); const c = selCand.value; if (c.estado === "entrevista-programada") cambiarEstado(c, "entrevistado", { silencioso: true }); } store.fichaTab = "entrevista"; go("candidato/" + sel.value.candId); };
    const miAgenda = computed(() => { const yo = miNombre(); return [...(store.personas?.equipo || []), ...(store.personas?.practicantes || [])].includes(yo) ? yo : ""; });
    const recordar = (canal) => enviarPlantilla(typeof canal === "string" ? canal : "whatsapp", selCand.value, "recordatorio");

    // Menú contextual (clic derecho o mantener pulsado)
    const menuDe = (e) => {
      const c = candDe(e.candId), abierta = !["Cancelada", "Realizada"].includes(e.estado);
      return { titulo: nombreCompleto(c) + " · " + fCorta(e.fecha) + " " + e.hora, items: [
        { t: "Ver la cita", i: "eye", f: () => { sel.value = e; } },
        { t: "Abrir la ficha", i: "user", f: () => go("candidato/" + c.id) },
        { sep: true },
        { t: "Confirmar", i: "check", oculto: !abierta || e.estado === "Confirmada", f: () => { sel.value = e; confirmar(); sel.value = null; } },
        { t: "Reprogramar", i: "calendario", oculto: !abierta, f: () => { sel.value = e; abrirReprog(); } },
        { t: "Recordar por WhatsApp", i: "whatsapp", oculto: !abierta, f: () => { sel.value = e; recordar("whatsapp"); sel.value = null; } },
        { t: "Recordar por correo", i: "mail", oculto: !abierta, f: () => { sel.value = e; recordar("correo"); sel.value = null; } },
        { t: "Marcar como realizada y valorar", i: "star", oculto: !abierta, f: () => { sel.value = e; valorar(); } },
        { sep: true, oculto: !abierta },
        { t: "Cancelar la cita", i: "trash", peligro: true, oculto: !abierta, f: async () => { sel.value = e; await cancelar(); sel.value = null; } },
      ] };
    };

    // Nueva cita
    const nueva = reactive({ abierto: false, candId: "", fecha: dia(3), hora: "10:30", modalidad: "Presencial", entrevistador: "" });
    const opCands = computed(() => store.candidatos.filter((c) => ["pendiente-revision", "pendiente-entrevista"].includes(c.estado)).map((c) => ({ valor: c.id, etiqueta: `${nombreCompleto(c)} · ${centroDe(c.centroId)?.nombre || "Autopostulado"}` })));
    const choque = computed(() => store.entrevistas.find((e) => nueva.entrevistador && e.fecha === nueva.fecha && e.entrevistador === nueva.entrevistador && e.estado !== "Cancelada" && Math.abs(aMin(e.hora) - aMin(nueva.hora)) < DUR));
    const abrirNueva = (fecha, hora) => Object.assign(nueva, { abierto: true, candId: "", fecha: fecha || dia(3), hora: hora || "10:30" });
    const clicHueco = (d, ev) => { const y = ev.offsetY; const m = Math.round(((y / PX) * 60) / 15) * 15 + H0 * 60; abrirNueva(d, deMin(Math.min(m, H1 * 60))); };
    const crear = () => { const c = candDe(nueva.candId); if (!c) return toast("Elige un candidato.", "error"); if (esFinde(nueva.fecha)) return toast("Ese día es fin de semana. Elige un día de lunes a viernes.", "error"); programarEntrevista(c, nueva); nueva.abierto = false; };

    return { menuDe, ordenar, flecha, s, dias, horas, porDia, tituloSemana, mover, lista, cuentas, sel, selCand, reprog, confirmar, cancelar, abrirReprog, guardarReprog, valorar, recordar, miAgenda,
      nueva, opCands, choque, abrirNueva, clicHueco, crear, go, candDe, centroDe, nombreCompleto, ESTADOS_CITA, ENTREVISTADORES, HORAS_ENTREVISTA, PX, fCorta, fLarga, diaCorto, diaNum, deMin, aMin, DUR };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Entrevistas</h1><p>Agenda común del equipo, de lunes a viernes.</p></div>
      <div class="acciones">
        <select class="inp" v-model="s.fQuien" style="width:190px"><option value="">Todo el equipo</option><option v-if="miAgenda" :value="miAgenda">Mi agenda</option><OpcionesPersonas prefijo="Agenda de " /><option value="_ninguno">Sin responsable asignado</option></select>
        <div class="seg"><button :class="{on: s.vista==='calendario'}" @click="s.vista='calendario'"><Ic n="calendario" :s="15" />Calendario</button><button :class="{on: s.vista==='lista'}" @click="s.vista='lista'"><Ic n="tabla" :s="15" />Listado</button></div>
        <button class="btn btn-accent" @click="abrirNueva()"><Ic n="plus" :s="16" />Nueva entrevista</button>
      </div>
    </div>

    <!-- CALENDARIO -->
    <div v-if="s.vista==='calendario'" class="card cal">
      <div class="cal-bar">
        <button class="btn btn-sm" @click="mover(0)">Hoy</button>
        <button class="icon-btn" @click="mover(-1)" aria-label="Semana anterior"><Ic n="chevL" /></button><button class="icon-btn" @click="mover(1)" aria-label="Semana siguiente"><Ic n="chevR" /></button>
        <b>{{ tituloSemana }}</b>
        <span class="right leyenda"><span v-for="c in cuentas" :key="c.k"><i :style="{background: c.c}"></i>{{ c.k }}</span></span>
      </div>
      <div class="cal-grid">
        <div class="cal-horas"><div class="cal-dhead"></div><div v-for="h in horas.slice(0,-1)" :key="h" class="cal-h" :style="{height: PX+'px'}">{{ h }}:00</div></div>
        <div v-for="col in porDia" :key="col.d" class="cal-dia" :class="{hoy: col.hoy}">
          <div class="cal-dhead"><small>{{ diaCorto(col.d) }}</small><b>{{ diaNum(col.d) }}</b><span v-if="col.citas.length">{{ col.citas.length }} citas</span></div>
          <div class="cal-cuerpo" :style="{height: (horas.length-1)*PX+'px'}" @click.self="clicHueco(col.d, $event)" title="Haz clic en un hueco para programar">
            <i v-for="h in horas.length-1" :key="h" class="cal-linea" :style="{top: (h-1)*PX+'px'}"></i>
            <button v-for="x in col.citas" :key="x.e.id" class="cita" :class="'c-'+x.e.estado" :style="{top: x.top+'px', height: x.alto+'px', left: 'calc('+x.izq+'% + 3px)', width: 'calc('+x.ancho+'% - 6px)', '--c': ESTADOS_CITA[x.e.estado].c}" @click="sel=x.e" v-ctx="() => menuDe(x.e)">
              <b>{{ x.e.hora }} · {{ nombreCompleto(candDe(x.e.candId)) }}</b>
              <small><Ic :n="x.e.modalidad==='Online' ? 'video' : 'pin'" :s="11" />{{ x.e.entrevistador || "Sin asignar" }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- LISTADO -->
    <div v-else class="card">
      <div class="barra-filtros">
        <div class="buscar"><Ic n="search" :s="16" /><input class="inp" v-model="s.q" placeholder="Buscar candidato…" /></div>
        <button class="pill" :class="{on: !s.fEstado}" @click="s.fEstado=''">Todas</button>
        <button v-for="c in cuentas" :key="c.k" class="pill" :class="{on: s.fEstado===c.k}" @click="s.fEstado = s.fEstado===c.k ? '' : c.k"><i class="punto" :style="{background: c.c}"></i>{{ c.k }} <b>{{ c.n }}</b></button>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th v-for="h in [['fecha','Fecha y hora'],['cand','Candidato'],['centro','Centro'],[null,'Modalidad'],['resp','Responsable'],['estado','Estado de la cita'],['nota','Valoración'],[null,'Observaciones']]" :key="h[1]" :class="h[0] ? {ordenable: true, activa: s.orden.col===h[0]} : ''" @click="h[0] && ordenar(h[0])" :title="h[0] ? 'Ordenar por ' + h[1].toLowerCase() : ''">{{ h[1] }}<span v-if="h[0]" class="flecha">{{ flecha(h[0]) }}</span></th></tr></thead>
        <tbody><tr v-for="e in lista" :key="e.id" @click="sel=e" v-ctx="() => menuDe(e)">
          <td class="nowrap"><b>{{ fCorta(e.fecha) }}</b> <span class="sub">{{ e.hora }}</span></td>
          <td><div class="who"><Avatar :nombre="candDe(e.candId).nombre" :apellidos="candDe(e.candId).apellidos" :s="30" /><b>{{ nombreCompleto(candDe(e.candId)) }}</b></div></td>
          <td>{{ centroDe(candDe(e.candId).centroId)?.nombre || 'Autopostulado' }}</td>
          <td class="nowrap"><Ic :n="e.modalidad==='Online' ? 'video' : 'pin'" :s="14" /> {{ e.modalidad }}</td>
          <td><span v-if="e.entrevistador">{{ e.entrevistador }}</span><span v-else class="muted">Sin asignar</span></td>
          <td><Chip :texto="e.estado" :c="ESTADOS_CITA[e.estado].c" :cd="ESTADOS_CITA[e.estado].cd" /></td>
          <td><Nota :v="candDe(e.candId).nota" v-if="e.estado==='Realizada' && candDe(e.candId).nota!=null" /><span v-else-if="e.estado==='Realizada'" class="tag gold">Sin valorar</span><span v-else class="muted">—</span></td>
          <td><div class="cell-clip sub">{{ e.obs || '—' }}</div></td>
        </tr></tbody></table>
        <Vacio v-if="!lista.length" titulo="No hay entrevistas con estos filtros" texto="" />
      </div>
    </div>

    <Modal v-if="sel" titulo="Entrevista" :ancho="520" @cerrar="sel=null">
      <div class="who" style="cursor:pointer" @click="go('candidato/'+selCand.id)"><Avatar :nombre="selCand.nombre" :apellidos="selCand.apellidos" :s="46" /><div><b style="font-size:16px">{{ nombreCompleto(selCand) }}</b><small>{{ selCand.titulacion }} · {{ centroDe(selCand.centroId)?.nombre || 'Autopostulado' }}</small></div></div>
      <div class="datos">
        <div><span>Cuándo</span><b style="text-transform:capitalize">{{ fLarga(sel.fecha) }} · {{ sel.hora }}</b></div><div><span>Modalidad</span><b>{{ sel.modalidad }}</b></div>
        <div><span>Entrevistador/a</span><b v-if="sel.entrevistador">{{ sel.entrevistador }}</b><b v-else class="muted">Sin asignar</b></div><div><span>Estado</span><Chip :texto="sel.estado" :c="ESTADOS_CITA[sel.estado].c" :cd="ESTADOS_CITA[sel.estado].cd" /></div>
        <div><span>Turno que pide</span><b>{{ selCand.turno }}</b></div><div><span>Valoración</span><Nota :v="selCand.nota" /></div>
      </div>
      <div v-if="reprog.abierto" class="grid2"><div class="fld"><label>Nueva fecha</label><input class="inp" type="date" v-model="reprog.fecha" /></div><div class="fld"><label>Nueva hora</label><select class="inp" v-model="reprog.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div></div>
      <div class="row wrap">
        <template v-if="reprog.abierto"><button class="btn btn-primary btn-sm" @click="guardarReprog">Guardar nueva fecha</button><button class="btn btn-sm" @click="reprog.abierto=false">Descartar</button></template>
        <template v-else-if="sel.estado!=='Realizada' && sel.estado!=='Cancelada'">
          <button v-if="sel.estado!=='Confirmada'" class="btn btn-sm" @click="confirmar"><Ic n="check" :s="14" />Confirmar</button>
          <button class="btn btn-sm" @click="abrirReprog"><Ic n="clock" :s="14" />Reprogramar</button>
          <button class="btn btn-sm" @click="recordar"><Ic n="whatsapp" :s="14" />Recordar por WhatsApp</button>
          <button class="btn btn-sm btn-danger" @click="cancelar"><Ic n="x" :s="14" />Cancelar cita</button>
        </template>
      </div>
      <template #pie><button class="btn" @click="go('candidato/'+selCand.id)">Abrir ficha</button><button v-if="sel.estado!=='Cancelada'" class="btn btn-primary" @click="valorar"><Ic n="star" :s="16" />{{ sel.estado==='Realizada' ? 'Ver valoración' : 'Marcar realizada y valorar' }}</button></template>
    </Modal>

    <Modal v-if="nueva.abierto" titulo="Nueva entrevista" @cerrar="nueva.abierto=false">
      <div class="fld"><label>Candidato (pendientes de entrevista)</label><SelectBuscable v-model="nueva.candId" :opciones="opCands" vacio="Elegir candidato…" /></div>
      <div class="grid2">
        <div class="fld"><label>Fecha</label><input class="inp" type="date" v-model="nueva.fecha" /></div>
        <div class="fld"><label>Hora</label><select class="inp" v-model="nueva.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div>
        <div class="fld"><label>Modalidad</label><select class="inp" v-model="nueva.modalidad"><option>Presencial</option><option>Online</option></select></div>
        <div class="fld"><label>Quién hace la entrevista (opcional)</label><select class="inp" v-model="nueva.entrevistador"><option value="">Sin asignar</option><OpcionesPersonas :actual="nueva.entrevistador" /></select></div>
      </div>
      <div v-if="choque" class="aviso warn"><Ic n="alert" :s="16" /><span><b>{{ nueva.entrevistador }} ya tiene una entrevista</b> a las {{ choque.hora }} con {{ nombreCompleto(candDe(choque.candId)) }}.</span></div>
      <template #pie><button class="btn" @click="nueva.abierto=false">Cancelar</button><button class="btn btn-primary" @click="crear">Programar</button></template>
    </Modal>
  </div>`,
};
