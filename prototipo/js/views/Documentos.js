import { computed, reactive } from "vue";
import { store, candDe, centroDe, nombreCompleto, toast } from "../store.js";
import { go } from "../router.js";
import { sesion, urlArchivo } from "../api.js";
import { Ic, Avatar, Vacio } from "../ui.js";
import { normal, fCompleta } from "../util.js";

const TIPOS = ["Currículum", "Convenio", "Anexo", "Justificante", "Otro"];
const estado = reactive({ q: "", tipo: "" });

export default {
  components: { Ic, Avatar, Vacio },
  setup() {
    const s = estado;
    const lista = computed(() => {
      const n = normal(s.q);
      return store.documentos.map((d) => ({ d, c: candDe(d.candId) })).filter(({ d, c }) => (!s.tipo || d.tipo === s.tipo) && (!n || normal(d.nombre + " " + nombreCompleto(c)).includes(n)))
        .sort((a, b) => b.d.fecha.localeCompare(a.d.fecha) || b.d.id - a.d.id);
    });
    const cuentas = computed(() => TIPOS.map((t) => ({ t, n: store.documentos.filter((d) => d.tipo === t).length })));
    const pendientes = computed(() => store.documentos.filter((d) => /pendiente de firma/i.test(d.nombre)).length);
    const tam = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB");
    const abrir = (d) => { store.fichaTab = d.tipo === "Currículum" ? "cv" : "docs"; go("candidato/" + d.candId); };
    const demo = (m) => toast("Demo: " + m);
    const descargar = async (d) => { try { window.open(await urlArchivo(d, { descargar: true }), "_blank", "noopener"); } catch (e) { toast(`No se pudo descargar: ${e.message}`, "error"); } };
    return { store, s, TIPOS, lista, cuentas, pendientes, tam, abrir, demo, descargar, sesion, centroDe, nombreCompleto, fCompleta };
  },
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Documentos</h1><p>{{ store.documentos.length }} archivos asociados a candidatos y estudiantes<template v-if="pendientes"> · <b style="color:var(--amber-dark)">{{ pendientes }} convenios pendientes de firma</b></template></p></div>
      <div class="acciones"><button class="btn" @click="demo('se descargaría un ZIP con los documentos filtrados')"><Ic n="download" :s="16" />Descargar selección (ZIP)</button></div>
    </div>
    <div class="card">
      <div class="barra-filtros">
        <div class="buscar"><Ic n="search" :s="16" /><input class="inp" v-model="s.q" placeholder="Buscar por nombre de archivo o persona…" /></div>
        <button class="pill" :class="{on: !s.tipo}" @click="s.tipo=''">Todos <b>{{ store.documentos.length }}</b></button>
        <button v-for="c in cuentas" :key="c.t" class="pill" :class="{on: s.tipo===c.t}" @click="s.tipo = s.tipo===c.t ? '' : c.t">{{ c.t }} <b>{{ c.n }}</b></button>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Documento</th><th>Tipo</th><th>Persona</th><th>Centro</th><th>Subido</th><th>Tamaño</th><th></th></tr></thead>
        <tbody><tr v-for="x in lista" :key="x.d.id" @click="abrir(x.d)">
          <td><div class="row"><span class="ext" :class="x.d.ext">{{ x.d.ext }}</span><b>{{ x.d.nombre }}</b></div></td>
          <td><span class="tag">{{ x.d.tipo }}</span></td>
          <td><div class="who"><Avatar :nombre="x.c.nombre" :apellidos="x.c.apellidos" :s="26" />{{ nombreCompleto(x.c) }}</div></td>
          <td>{{ centroDe(x.c.centroId)?.nombre || 'Autopostulado' }}</td>
          <td class="nowrap">{{ fCompleta(x.d.fecha) }}</td><td class="nowrap">{{ tam(x.d.tam) }}</td>
          <td class="nowrap"><button class="icon-btn" title="Ver"><Ic n="eye" :s="16" /></button><button class="icon-btn" title="Descargar" @click.stop="x.d.archivoId ? descargar(x.d) : demo('se descargaría el archivo')"><Ic n="download" :s="16" /></button></td>
        </tr></tbody></table>
        <Vacio v-if="!lista.length" titulo="Ningún documento con estos filtros" texto="" />
      </div>
    </div>
    <p class="sub" style="margin-top:12px"><Ic n="lock" :s="13" /> Almacenamiento privado en vuestro servidor. Cada apertura y descarga queda en el registro de acciones (Ajustes → Protección de datos).</p>
  </div>`,
};
