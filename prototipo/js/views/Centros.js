import { computed, reactive, ref } from "vue";
import { store, centroDe, nombreCompleto, estadoPracticas, estudianteDe, toast } from "../store.js";
import { ruta, go } from "../router.js";
import { filtros } from "./Candidatos.js";
import { Ic, Chip, Avatar, Modal, Drawer, Nota, Vacio } from "../ui.js";
import { ASESORES } from "../data.js";
import { normal, slug } from "../util.js";

const estado = reactive({ q: "", tipo: "", resp: "", archivados: false });
const TIPOS = ["Universidad", "FP / Instituto"];

export default {
  components: { Ic, Chip, Avatar, Modal, Drawer, Nota, Vacio },
  setup() {
    const s = estado;
    const datos = (c) => {
      const cands = store.candidatos.filter((x) => x.centroId === c.id);
      const est = store.estudiantes.filter((e) => e.centroId === c.id);
      return { cands, total: cands.length, activos: est.filter((e) => estadoPracticas(e) === "En curso").length, hechos: est.filter((e) => estadoPracticas(e) === "Finalizada").length, proceso: cands.filter((x) => !["incorporado", "finalizado", "no-seleccionado", "retirada"].includes(x.estado)).length };
    };
    const lista = computed(() => {
      const n = normal(s.q);
      return store.centros.filter((c) => (s.archivados || !c.archivado) && (!s.tipo || c.tipo === s.tipo) && (!s.resp || c.responsable === s.resp) && (!n || normal(c.nombre + " " + c.contacto).includes(n)))
        .map((c) => ({ c, ...datos(c) })).sort((a, b) => Number(a.c.archivado) - Number(b.c.archivado) || b.total - a.total || a.c.nombre.localeCompare(b.c.nombre));
    });
    const sinResp = computed(() => store.centros.filter((c) => !c.archivado && c.responsable === "Sin asignar").length);
    const sel = computed(() => (ruta.value.id ? centroDe(ruta.value.id) : null));
    const selDatos = computed(() => (sel.value ? datos(sel.value) : null));
    const nuevoProg = ref("");
    const addProg = () => { const t = nuevoProg.value.trim(); if (t && !sel.value.programas.includes(t)) sel.value.programas.push(t); nuevoProg.value = ""; };
    const verCandidatos = (id) => { Object.assign(filtros, { q: "", estado: "", centro: id, turno: "", notaMin: "", rapido: "" }); go("candidatos"); };
    const archivar = () => { sel.value.archivado = !sel.value.archivado; toast(sel.value.archivado ? "Centro archivado: deja de salir en los desplegables" : "Centro restaurado"); };

    const alta = reactive({ abierto: false, nombre: "", tipo: "Universidad", responsable: "Sin asignar", contacto: "", email: "", tel: "", horas: "", periodos: "" });
    const repetido = computed(() => alta.nombre.trim().length > 2 && store.centros.find((c) => normal(c.nombre) === normal(alta.nombre.trim())));
    const crear = () => {
      if (!alta.nombre.trim()) return toast("Escribe el nombre del centro.", "error");
      if (repetido.value) return toast("Ese centro ya existe.", "error");
      const id = slug(alta.nombre) + "-" + store.centros.length;
      const { abierto, ...d } = alta;
      store.centros.push({ id, ...d, nombre: alta.nombre.trim(), programas: [], archivado: false, notas: "" });
      alta.abierto = false; toast("Centro añadido"); go("centros/" + id);
    };
    const abrirAlta = () => Object.assign(alta, { abierto: true, nombre: "", contacto: "", email: "", tel: "", horas: "", periodos: "", responsable: "Sin asignar" });
    return { store, s, TIPOS, ASESORES, lista, sinResp, sel, selDatos, nuevoProg, addProg, archivar, verCandidatos, alta, repetido, crear, abrirAlta, go, nombreCompleto, estudianteDe, estadoPracticas };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Centros educativos</h1><p>{{ store.centros.filter(c => !c.archivado).length }} centros activos<template v-if="sinResp"> · <b style="color:var(--amber-dark)">{{ sinResp }} sin responsable asignado</b></template></p></div>
      <div class="acciones"><button class="btn btn-accent" @click="abrirAlta"><Ic n="plus" :s="16" />Nuevo centro</button></div>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="barra-filtros">
      <div class="buscar"><Ic n="search" :s="16" /><input class="inp" v-model="s.q" placeholder="Buscar centro o persona de contacto…" /></div>
      <button class="pill" :class="{on: !s.tipo}" @click="s.tipo=''">Todos</button>
      <button v-for="t in TIPOS" :key="t" class="pill" :class="{on: s.tipo===t}" @click="s.tipo = s.tipo===t ? '' : t">{{ t }}</button>
      <select class="inp" v-model="s.resp" style="width:200px"><option value="">Cualquier responsable</option><option v-for="a in ASESORES" :key="a">{{ a }}</option><option>Sin asignar</option></select>
      <label class="row sub right" style="gap:6px"><input type="checkbox" v-model="s.archivados" /> Mostrar archivados</label>
    </div></div>

    <div class="centros-grid">
      <button v-for="x in lista" :key="x.c.id" class="card centro-card" :class="{arch: x.c.archivado}" @click="go('centros/'+x.c.id)">
        <div class="row" style="align-items:flex-start"><span class="centro-ico"><Ic n="centros" :s="20" /></span><div class="grow"><b>{{ x.c.nombre }}</b><div class="sub">{{ x.c.tipo }} · {{ x.c.horas }}</div></div><span v-if="x.c.archivado" class="tag">Archivado</span></div>
        <div class="centro-nums"><div><b>{{ x.total }}</b><span>candidatos</span></div><div><b>{{ x.proceso }}</b><span>en proceso</span></div><div><b style="color:var(--cyan-dark)">{{ x.activos }}</b><span>en prácticas</span></div><div><b>{{ x.hechos }}</b><span>finalizadas</span></div></div>
        <div class="row sub"><Ic n="user" :s="14" /><span class="grow" style="text-align:left">{{ x.c.contacto }}</span><span :class="x.c.responsable==='Sin asignar' ? 'tag gold' : 'tag'">{{ x.c.responsable==='Sin asignar' ? 'Sin responsable' : 'Lo lleva ' + x.c.responsable }}</span></div>
      </button>
    </div>
    <Vacio v-if="!lista.length" titulo="Ningún centro con estos filtros" texto="" />

    <Drawer v-if="sel" :titulo="sel.nombre" @cerrar="go('centros')">
      <div class="row wrap"><span class="tag">{{ sel.tipo }}</span><span v-if="sel.archivado" class="tag gold">Archivado</span><button class="btn btn-sm btn-accent right" :disabled="!selDatos.total" @click="verCandidatos(sel.id)"><Ic n="user" :s="14" />Ver candidatos ({{ selDatos.total }})</button><button class="btn btn-sm" @click="archivar"><Ic :n="sel.archivado ? 'restore' : 'archive'" :s="14" />{{ sel.archivado ? 'Restaurar' : 'Archivar' }}</button></div>
      <div class="centro-nums"><div><b>{{ selDatos.total }}</b><span>candidatos</span></div><div><b>{{ selDatos.proceso }}</b><span>en proceso</span></div><div><b style="color:var(--cyan-dark)">{{ selDatos.activos }}</b><span>en prácticas</span></div><div><b>{{ selDatos.hechos }}</b><span>finalizadas</span></div></div>
      <div class="grid2">
        <div class="fld"><label>Nombre del centro</label><input class="inp" v-model="sel.nombre" /></div>
        <div class="fld"><label>Tipo</label><select class="inp" v-model="sel.tipo"><option v-for="t in TIPOS" :key="t">{{ t }}</option></select></div>
        <div class="fld"><label>Responsable de prácticas del centro</label><input class="inp" v-model="sel.contacto" /></div>
        <div class="fld"><label>Asesor de la gestoría que lo lleva</label><select class="inp" v-model="sel.responsable"><option>Sin asignar</option><option v-for="a in ASESORES" :key="a">{{ a }}</option></select></div>
        <div class="fld"><label>Correo de contacto</label><input class="inp" v-model="sel.email" /></div>
        <div class="fld"><label>Teléfono</label><input class="inp" v-model="sel.tel" /></div>
        <div class="fld"><label>Horas de prácticas habituales</label><input class="inp" v-model="sel.horas" /></div>
        <div class="fld"><label>Periodos de incorporación</label><input class="inp" v-model="sel.periodos" /></div>
      </div>
      <div class="fld"><label>Programas formativos</label>
        <div class="row wrap" style="gap:6px"><span v-for="(p,i) in sel.programas" :key="p" class="tag">{{ p }}<button class="x-mini" @click="sel.programas.splice(i,1)" aria-label="Quitar"><Ic n="x" :s="11" /></button></span></div>
        <div class="row"><input class="inp" v-model="nuevoProg" placeholder="Añadir titulación o curso…" @keydown.enter="addProg" /><button class="btn" @click="addProg">Añadir</button></div>
      </div>
      <div class="fld"><label>Notas sobre la colaboración</label><textarea class="inp" v-model="sel.notas" rows="2" placeholder="Convenio marco, condiciones, historial de la relación…"></textarea></div>
      <div>
        <h4 style="margin-bottom:8px">Personas de este centro ({{ selDatos.cands.length }})</h4>
        <a v-for="c in selDatos.cands" :key="c.id" class="item compacto" @click="go('candidato/'+c.id)"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="28" /><span class="grow"><b>{{ nombreCompleto(c) }}</b><small>{{ c.titulacion }}</small></span><Nota :v="c.nota" v-if="c.nota!=null" /><Chip :k="c.estado" /></a>
        <p v-if="!selDatos.cands.length" class="sub">Todavía no hay candidatos de este centro.</p>
      </div>
    </Drawer>

    <Modal v-if="alta.abierto" titulo="Nuevo centro educativo" @cerrar="alta.abierto=false">
      <div v-if="repetido" class="aviso warn"><Ic n="alert" :s="16" /><span>Ya existe un centro llamado <b>{{ repetido.nombre }}</b>.</span></div>
      <div class="grid2">
        <div class="fld" style="grid-column:1/-1"><label>Nombre *</label><input class="inp" v-model="alta.nombre" /></div>
        <div class="fld"><label>Tipo</label><select class="inp" v-model="alta.tipo"><option v-for="t in TIPOS" :key="t">{{ t }}</option></select></div>
        <div class="fld"><label>Asesor que lo lleva</label><select class="inp" v-model="alta.responsable"><option>Sin asignar</option><option v-for="a in ASESORES" :key="a">{{ a }}</option></select></div>
        <div class="fld"><label>Responsable de prácticas</label><input class="inp" v-model="alta.contacto" /></div>
        <div class="fld"><label>Correo</label><input class="inp" v-model="alta.email" /></div>
        <div class="fld"><label>Horas habituales</label><input class="inp" v-model="alta.horas" placeholder="340 h" /></div>
        <div class="fld"><label>Periodos de incorporación</label><input class="inp" v-model="alta.periodos" placeholder="Sep–Jun" /></div>
      </div>
      <template #pie><button class="btn" @click="alta.abierto=false">Cancelar</button><button class="btn btn-primary" @click="crear">Añadir centro</button></template>
    </Modal>
  </div>`,
};
