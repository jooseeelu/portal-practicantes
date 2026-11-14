import { ref, computed } from "vue";
import { store, toast, setTema } from "../store.js";
import { Ic, Chip, Avatar } from "../ui.js";
import { COLORES, ASESORES, ENTREVISTADORES } from "../data.js";
import { slug, fCompleta, dia } from "../util.js";

const tabActual = ref("estados");

export default {
  components: { Ic, Chip, Avatar },
  setup() {
    const tab = tabActual;
    const tabs = [["estados", "Estados del proceso", "kanban"], ["turnos", "Turnos y aforo", "clock"], ["equipo", "Equipo y permisos", "candidatos"], ["datos", "Protección de datos", "shield"], ["integraciones", "Integraciones", "link"]];
    const usados = (k) => store.candidatos.filter((c) => c.estado === k).length;
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= store.estados.length) return; const a = store.estados; [a[i], a[j]] = [a[j], a[i]]; };
    const color = (e, col) => Object.assign(e, { col, c: COLORES[col].c, cd: COLORES[col].cd });
    const nuevo = ref("");
    const addEstado = () => { const n = nuevo.value.trim(); if (!n) return; store.estados.push({ k: slug(n).replace(/\./g, "-") + "-" + store.estados.length, c: COLORES.gris.c, cd: COLORES.gris.cd, n, col: "gris", activo: true }); nuevo.value = ""; toast("Estado añadido"); };
    const equipo = [
      ...[["Admin", "Administrador"], ["Andrés", "Administrador"]].map(([n, r]) => ({ n, r })),
      ...[...new Set([...ENTREVISTADORES.slice(1), ...ASESORES])].map((n) => ({ n, r: "Asesor" })),
      { n: "Recepción", r: "Solo lectura" },
    ];
    const registro = [
      [0, "09:12", "Admin", "Abrió el currículum de un candidato"], [0, "09:05", "Admin", "Inició sesión (código de verificación correcto)"],
      [-1, "17:40", "Vanesa", "Descargó un convenio de prácticas"], [-1, "13:02", "Belén", "Exportó el listado de candidatos a Excel"], [-2, "11:20", "Andrés", "Eliminó un documento duplicado"],
    ].map(([d, h, q, t]) => ({ f: fCompleta(dia(d)), h, q, t }));
    const caducan = computed(() => store.candidatos.filter((c) => ["no-seleccionado", "retirada"].includes(c.estado)).length);
    const demo = (m) => toast("Demo: " + m);
    return { store, tab, tabs, usados, mover, color, nuevo, addEstado, equipo, registro, caducan, demo, COLORES, setTema };
  },
  template: `
  <div class="page">
    <div class="page-head"><div><h1>Ajustes</h1><p>Todo lo que se puede cambiar sin tocar código.</p></div></div>
    <div class="card">
      <div class="tabs"><button v-for="[k,t,i] in tabs" :key="k" :class="{on: tab===k}" @click="tab=k"><Ic :n="i" :s="15" />{{ t }}</button></div>

      <div v-if="tab==='estados'" class="card-pad stack">
        <p class="sub">Cambia el nombre, el color o el orden de las fases. Las que desactives dejan de ofrecerse, pero los candidatos que ya las tengan las conservan.</p>
        <div class="estados-lista">
          <div v-for="(e,i) in store.estados" :key="e.k" class="estado-fila" :class="{off: !e.activo}">
            <span class="orden"><button class="icon-btn" @click="mover(i,-1)" :disabled="i===0"><Ic n="up" :s="14" /></button><button class="icon-btn" @click="mover(i,1)" :disabled="i===store.estados.length-1"><Ic n="down" :s="14" /></button></span>
            <input class="inp" v-model="e.n" style="max-width:280px" />
            <span class="colores"><button v-for="(v,k) in COLORES" :key="k" :class="{on: e.col===k}" :style="{background: v.c}" :title="v.n" @click="color(e,k)"></button></span>
            <Chip :k="e.k" />
            <span class="sub right">{{ usados(e.k) }} candidatos</span>
            <label class="switch"><input type="checkbox" v-model="e.activo" /><i></i></label>
          </div>
        </div>
        <div class="row"><input class="inp" v-model="nuevo" placeholder="Nombre del nuevo estado…" style="max-width:320px" @keydown.enter="addEstado" /><button class="btn" @click="addEstado"><Ic n="plus" :s="15" />Añadir estado</button></div>
      </div>

      <div v-else-if="tab==='turnos'" class="card-pad stack">
        <p class="sub">Horario habitual y número máximo de estudiantes que podéis supervisar a la vez. Cada estudiante puede tener además su propio horario.</p>
        <div class="grid2">
          <div v-for="t in ['Mañana','Tarde']" :key="t" class="turno-conf">
            <h3>Turno de {{ t.toLowerCase() }}</h3>
            <div class="grid3"><div class="fld"><label>Entrada</label><input class="inp" type="time" v-model="store.turnosDef[t].ini" /></div><div class="fld"><label>Salida</label><input class="inp" type="time" v-model="store.turnosDef[t].fin" /></div><div class="fld"><label>Aforo</label><input class="inp" type="number" min="1" max="20" v-model.number="store.aforo[t]" /></div></div>
          </div>
        </div>
        <div class="row"><b>Aspecto</b><div class="seg"><button :class="{on: store.tema==='claro'}" @click="setTema('claro')"><Ic n="sun" :s="15" />Claro</button><button :class="{on: store.tema==='oscuro'}" @click="setTema('oscuro')"><Ic n="moon" :s="15" />Oscuro</button></div></div>
      </div>

      <div v-else-if="tab==='equipo'" class="card-pad stack">
        <p class="sub">Mismos criterios que el CRM: acceso con contraseña y código por correo, y permisos comprobados en el servidor.</p>
        <table class="tbl sin-hover"><thead><tr><th>Persona</th><th>Rol</th><th>Qué puede hacer</th><th>Verificación en dos pasos</th></tr></thead>
          <tbody><tr v-for="p in equipo" :key="p.n"><td><div class="who"><Avatar :nombre="p.n" apellidos="" :s="28" /><b>{{ p.n }}</b></div></td><td><span class="tag" :class="{gold: p.r==='Administrador'}">{{ p.r }}</span></td>
            <td class="sub">{{ p.r==='Administrador' ? 'Todo, incluido borrar, exportar y gestionar el equipo' : p.r==='Asesor' ? 'Ver y editar candidatos, entrevistas y documentos. No borra ni exporta todo' : 'Consultar agenda y cuadrante. Sin acceso a currículums ni notas internas' }}</td>
            <td><span class="ico-ok row" style="gap:5px"><Ic n="check" :s="15" />Activa</span></td></tr></tbody></table>
      </div>

      <div v-else-if="tab==='datos'" class="card-pad stack">
        <div class="grid2">
          <div class="caja"><div class="row"><Ic n="clock" /><h3>Conservación de candidaturas</h3></div>
            <p class="sub">Los candidatos no seleccionados o retirados se conservan para futuras oportunidades durante el plazo indicado. Después se avisa para eliminarlos o pedir de nuevo el consentimiento.</p>
            <div class="row"><input class="inp" type="number" min="1" max="60" v-model.number="store.retencionMeses" style="width:90px" /><span>meses desde el último contacto</span></div>
            <div class="aviso"><Ic n="info" :s="16" /><span>Ahora mismo hay <b>{{ caducan }}</b> candidaturas sujetas a este plazo. Plazo a confirmar con vuestro delegado de protección de datos.</span></div></div>
          <div class="caja"><div class="row"><Ic n="db" /><h3>Copias de seguridad y exportación</h3></div>
            <p class="sub">Copia automática diaria a las 03:00 en vuestro servidor, guardando las 7 últimas (igual que el CRM).</p>
            <div class="aviso ok"><Ic n="check" :s="16" /><span>Última copia: hoy a las 03:00 (simulado).</span></div>
            <div class="row wrap"><button class="btn btn-sm" @click="demo('se descargaría todo en Excel')"><Ic n="download" :s="14" />Exportar todo a Excel</button><button class="btn btn-sm" @click="demo('se descargaría un ZIP con datos y documentos')"><Ic n="download" :s="14" />Copia completa (ZIP)</button></div></div>
        </div>
        <div><h3 style="margin-bottom:10px">Registro de acciones sensibles</h3>
          <table class="tbl sin-hover"><thead><tr><th>Fecha</th><th>Hora</th><th>Quién</th><th>Qué hizo</th></tr></thead><tbody><tr v-for="(r,i) in registro" :key="i"><td class="nowrap">{{ r.f }}</td><td>{{ r.h }}</td><td><b>{{ r.q }}</b></td><td>{{ r.t }}</td></tr></tbody></table></div>
      </div>

      <div v-else class="card-pad">
        <div class="integ">
          <div class="caja"><div class="row"><Ic n="sync" /><h3>Notion</h3><span class="notion right">Conectado (simulado)</span></div><p class="sub">Sincronización bidireccional de la agenda de entrevistas: lo que se rellena aquí aparece en Notion y al revés.</p></div>
          <div class="caja"><div class="row"><Ic n="whatsapp" /><h3>WhatsApp</h3><span class="tag right">Siguiente fase</span></div><p class="sub">API oficial de Meta a través de Chatwoot y n8n, como en el CRM: convocatorias, recordatorios de entrevista y avisos de incorporación con plantillas.</p></div>
          <div class="caja"><div class="row"><Ic n="mail" /><h3>Correo</h3><span class="tag right">Siguiente fase</span></div><p class="sub">Envío desde la ficha con plantillas y entrada automática de currículums que llegan por correo.</p></div>
          <div class="caja"><div class="row"><Ic n="calendario" /><h3>Google Calendar</h3><span class="tag right">Más adelante</span></div><p class="sub">Las entrevistas en el calendario de cada persona responsable.</p></div>
          <div class="caja"><div class="row"><Ic n="sparkles" /><h3>Lectura de currículums con IA</h3><span class="tag right">Más adelante</span></div><p class="sub">Propuesta de datos a partir del PDF, siempre con revisión humana antes de guardar.</p></div>
          <div class="caja"><div class="row"><Ic n="pencil" /><h3>Convenios y firma</h3><span class="tag right">Más adelante</span></div><p class="sub">Generación del convenio desde la ficha y firma electrónica.</p></div>
        </div>
      </div>
    </div>
  </div>`,
};
