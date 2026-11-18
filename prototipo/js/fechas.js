// Selector de fechas para filtrar: un botón que abre una ventana con los meses del año (un toque = ese mes)
// o un tramo libre «desde / hasta».
import { ref, computed } from "vue";
import { Ic, Modal } from "./ui.js";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pad = (n) => String(n).padStart(2, "0");
const finDeMes = (a, m) => `${a}-${pad(m + 1)}-${pad(new Date(a, m + 1, 0).getDate())}`;
const corta = (iso) => { const [a, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m - 1].toLowerCase()} ${a}`; };

/** Texto del filtro: «Enero de 2027», «3 ene 2027 – 15 feb 2027», «Desde 3 ene 2027»… */
export function textoTramo(desde, hasta) {
  if (!desde && !hasta) return "";
  if (desde && hasta) {
    const [a, m, d] = desde.split("-").map(Number);
    if (d === 1 && hasta === finDeMes(a, m - 1)) return MESES_L[m - 1].charAt(0).toUpperCase() + MESES_L[m - 1].slice(1) + " de " + a;
    return `${corta(desde)} – ${corta(hasta)}`;
  }
  return desde ? "Desde el " + corta(desde) : "Hasta el " + corta(hasta);
}

export const SelectorFechas = {
  components: { Ic, Modal },
  props: { desde: String, hasta: String },
  emits: ["update:desde", "update:hasta"],
  setup(p, { emit }) {
    const abierto = ref(false);
    const hoy = new Date();
    const anio = ref(hoy.getFullYear());
    const d = ref(""), h = ref("");
    const abrir = () => { d.value = p.desde || ""; h.value = p.hasta || ""; anio.value = p.desde ? Number(p.desde.slice(0, 4)) : hoy.getFullYear(); abierto.value = true; };
    const poner = (a, b) => { emit("update:desde", a); emit("update:hasta", b); abierto.value = false; };
    const elegirMes = (m) => poner(`${anio.value}-${pad(m + 1)}-01`, finDeMes(anio.value, m));
    const mesActivo = (m) => p.desde === `${anio.value}-${pad(m + 1)}-01` && p.hasta === finDeMes(anio.value, m);
    const esHoy = (m) => anio.value === hoy.getFullYear() && m === hoy.getMonth();
    const aplicar = () => { let a = d.value, b = h.value; if (a && b && b < a) [a, b] = [b, a]; poner(a, b); };
    const etiqueta = computed(() => textoTramo(p.desde, p.hasta));
    return { abierto, anio, d, h, abrir, poner, elegirMes, mesActivo, esHoy, aplicar, etiqueta, MESES };
  },
  template: `<button type="button" class="inp fsel sel-fechas" :class="{on: desde || hasta}" @click="abrir"><Ic n="calendario" :s="15" /><span>{{ etiqueta || 'Fechas' }}</span></button>
  <Modal v-if="abierto" titulo="Filtrar por fechas" :ancho="420" @cerrar="abierto=false">
    <p class="sub" style="margin-top:0">Fecha de la entrevista o, si no tiene, del registro.</p>
    <div class="sf-anio"><button class="icon-btn" @click="anio--" aria-label="Año anterior"><Ic n="chevL" /></button><b>{{ anio }}</b><button class="icon-btn" @click="anio++" aria-label="Año siguiente"><Ic n="chevR" /></button></div>
    <div class="sf-meses"><button v-for="(m,i) in MESES" :key="m" type="button" :class="{on: mesActivo(i), hoy: esHoy(i)}" @click="elegirMes(i)">{{ m }}</button></div>
    <div class="sf-tramo"><b>O un tramo</b><div class="grid2"><div class="fld"><label>Desde</label><input class="inp" type="date" v-model="d" /></div><div class="fld"><label>Hasta</label><input class="inp" type="date" v-model="h" /></div></div></div>
    <template #pie><button v-if="desde || hasta" class="btn btn-ghost" @click="poner('', '')">Quitar fechas</button><button class="btn" @click="abierto=false">Cancelar</button><button class="btn btn-ink" :disabled="!d && !h" @click="aplicar">Aplicar tramo</button></template>
  </Modal>`,
};
