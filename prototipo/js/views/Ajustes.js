import { ref, reactive, computed, watch } from "vue";
import { store, toast, setTema, TURNOS_OFICINA, cargarDemo, vaciarDatos } from "../store.js";
import { sesion, esAdmin, ROLES, listarEquipo, crearPersona, editarPersona, ponerClave, listarAccesos, claveAleatoria } from "../api.js";
import { Ic, Chip, Avatar, Modal, pedirConfirmacion } from "../ui.js";
import { COLORES, ASESORES, ENTREVISTADORES } from "../data.js";
import { slug, fCompleta, dia, HOY_ISO, iso, pad } from "../util.js";

const tabActual = ref("estados");

export default {
  components: { Ic, Chip, Avatar, Modal },
  setup() {
    const tab = tabActual;
    const tabs = [["estados", "Estados del proceso", "kanban"], ["turnos", "Turnos y aforo", "clock"], ["equipo", "Equipo y permisos", "candidatos"], ["personas", "Personas", "user"], ["datos", "Protección de datos", "shield"], ["integraciones", "Integraciones", "link"]];
    const usados = (k) => store.candidatos.filter((c) => c.estado === k).length;
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= store.estados.length) return; const a = store.estados; [a[i], a[j]] = [a[j], a[i]]; };
    const color = (e, col) => Object.assign(e, { col, c: COLORES[col].c, cd: COLORES[col].cd });
    const nuevo = ref("");
    const addEstado = () => { const n = nuevo.value.trim(); if (!n) return; store.estados.push({ k: slug(n).replace(/\./g, "-") + "-" + store.estados.length, c: COLORES.gris.c, cd: COLORES.gris.cd, n, col: "gris", activo: true }); nuevo.value = ""; toast("Estado añadido"); };
    const enServidor = computed(() => sesion.modo === "servidor");
    const admin = computed(() => esAdmin());

    // --- Personas que entrevistan, tutorizan o llevan centros (no necesitan cuenta) ---
    const GRUPOS = [{ k: "equipo", t: "Equipo de la gestoría", i: "briefcase" }, { k: "practicantes", t: "Practicantes", i: "estudiantes" }];
    const nuevaP = reactive({ equipo: "", practicantes: "" });
    const normalN = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const addPersona = (g) => {
      const n = nuevaP[g].trim().replace(/\s+/g, " ");
      if (!n) return;
      const ya = [...store.personas.equipo, ...store.personas.practicantes].find((x) => normalN(x) === normalN(n));
      if (ya) { toast(`«${ya}» ya está en la lista.`, "error"); return; }
      store.personas[g].push(n); nuevaP[g] = ""; toast(`«${n}» añadido`);
    };
    const quitarPersona = async (g, i) => {
      const n = store.personas[g][i];
      if (!(await pedirConfirmacion({ titulo: `¿Quitar a ${n} de la lista?`, texto: "Dejará de salir en los desplegables y en el filtro de agendas. Las entrevistas, prácticas y centros que ya tiene asignados no cambian.", boton: "Quitar" }))) return;
      store.personas[g].splice(i, 1);
    };
    const pasarA = (g, i) => { const otro = g === "equipo" ? "practicantes" : "equipo"; store.personas[otro].push(store.personas[g].splice(i, 1)[0]); };

    // --- Equipo ---
    const EQUIPO_DEMO = [
      ...[["Admin", "admin"], ["Andrés", "admin"]].map(([name, rol]) => ({ name, rol })),
      ...[...new Set([...ENTREVISTADORES.slice(1), ...ASESORES])].map((name) => ({ name, rol: "asesor" })),
    ].map((p, i) => ({ id: "demo" + i, email: "", activo: true, fin: "", ...p }));
    const equipo = ref([]), errEquipo = ref("");
    const cargarEquipo = async () => {
      if (!enServidor.value) { equipo.value = EQUIPO_DEMO; return; }
      try { equipo.value = await listarEquipo(); errEquipo.value = ""; } catch (e) { errEquipo.value = e.message; }
    };
    const finDe = (p) => (p.fin ? String(p.fin).slice(0, 10) : "");
    const caducada = (p) => !!finDe(p) && finDe(p) < HOY_ISO;
    const accesoDe = (p) => (!p.activo ? "Desactivado" : caducada(p) ? `Caducó el ${fCompleta(finDe(p))}` : finDe(p) ? `Hasta el ${fCompleta(finDe(p))}` : "Activo");
    const permisos = (rol) => (rol === "admin" ? "Todo: borrar fichas, cambiar los ajustes y gestionar el equipo" : "Ver y editar candidatos, entrevistas, estudiantes, centros y documentos. No borra fichas ni cambia ajustes");

    const form = reactive({ abierto: false, id: null, name: "", email: "", rol: "asesor", fin: "", activo: true, password: "", error: "", ocupado: false });
    const nuevaPersona = () => Object.assign(form, { abierto: true, id: null, name: "", email: "", rol: "asesor", fin: "", activo: true, password: claveAleatoria(), error: "" });
    const editar = (p) => Object.assign(form, { abierto: true, id: p.id, name: p.name, email: p.email, rol: p.rol, fin: finDe(p), activo: !!p.activo, password: "", error: "" });
    const guardarPersona = async () => {
      if (form.ocupado) return;
      const fin = form.fin ? `${form.fin} 23:59:59.000Z` : "";
      form.ocupado = true; form.error = "";
      try {
        if (form.id) {
          await editarPersona(form.id, { name: form.name.trim(), rol: form.rol, fin, activo: form.activo });
          toast("Cambios guardados");
          form.abierto = false;
        } else {
          if (form.password.length < 10) throw new Error("La contraseña inicial debe tener al menos 10 caracteres.");
          await crearPersona({ name: form.name.trim(), email: form.email.trim(), rol: form.rol, fin, activo: true, password: form.password });
          Object.assign(entrega, { abierto: true, nombre: form.name.trim(), email: form.email.trim(), password: form.password });
          form.abierto = false;
        }
        form.password = "";
        await cargarEquipo();
      } catch (e) { form.error = e.message; } finally { form.ocupado = false; }
    };
    // Tras crear una cuenta o poner una contraseña nueva, se enseña una sola vez para pasársela a la persona.
    const entrega = reactive({ abierto: false, nombre: "", email: "", password: "" });
    const nuevaClave = async (p) => {
      if (!(await pedirConfirmacion({ titulo: `¿Poner una contraseña nueva a ${p.name}?`, texto: "La contraseña actual dejará de valer en ese momento.", boton: "Poner contraseña nueva" }))) return;
      const password = claveAleatoria();
      try { await ponerClave(p.id, password); Object.assign(entrega, { abierto: true, nombre: p.name, email: p.email, password }); }
      catch (e) { toast(e.message, "error"); }
    };
    const copiar = async (t) => { try { await navigator.clipboard.writeText(t); toast("Copiado"); } catch { toast("No se pudo copiar; selecciónala a mano", "error"); } };
    const cerrarEntrega = () => Object.assign(entrega, { abierto: false, password: "" });

    // --- Registro de acciones sensibles ---
    const REGISTRO_DEMO = [
      [0, "09:12", "Admin", "Abrió el currículum de un candidato"], [0, "09:05", "Admin", "Inició sesión"],
      [-1, "17:40", "Vanesa", "Descargó un convenio de prácticas"], [-1, "13:02", "Belén", "Exportó el listado de candidatos a Excel"], [-2, "11:20", "Andrés", "Eliminó un documento duplicado"],
    ].map(([d, h, q, t]) => ({ f: fCompleta(dia(d)), h, q, t }));
    const registro = ref([]);
    const cargarRegistro = async () => {
      if (!enServidor.value) { registro.value = REGISTRO_DEMO; return; }
      if (!admin.value) { registro.value = []; return; }
      try {
        registro.value = (await listarAccesos()).map((a) => {
          const d = new Date(String(a.created).replace(" ", "T"));
          return { f: fCompleta(iso(d)), h: `${pad(d.getHours())}:${pad(d.getMinutes())}`, q: a.nombre || "—", t: a.detalle ? `${a.accion}: ${a.detalle}` : a.accion };
        });
      } catch { registro.value = []; }
    };
    watch(tab, (t) => { if (t === "equipo") cargarEquipo(); if (t === "datos") cargarRegistro(); }, { immediate: true });

    // --- Datos de demostración (solo en el entorno de pruebas) ---
    const puedeDemo = computed(() => enServidor.value && sesion.entorno === "pruebas" && admin.value);
    const rellenarDemo = () => { try { localStorage.removeItem("emadrid-pruebas-vaciado"); } catch (_) {} cargarDemo(); toast("Datos de demostración cargados; se están guardando"); };
    const vaciarTodo = async () => {
      if (!(await pedirConfirmacion({ titulo: "¿Borrar TODOS los datos de este entorno?", texto: "Candidatos, entrevistas, centros y todo lo demás. No se puede deshacer.", boton: "Borrar todo" }))) return;
      try { localStorage.setItem("emadrid-pruebas-vaciado", "1"); } catch (_) {}
      vaciarDatos(); toast("Entorno vaciado");
    };

    const caducan = computed(() => store.candidatos.filter((c) => ["no-seleccionado", "retirada"].includes(c.estado)).length);
    const demo = (m) => toast((enServidor.value ? "Todavía no disponible: " : "Demo: ") + m);
    return { GRUPOS, nuevaP, addPersona, quitarPersona, pasarA, TURNOS_OFICINA, store, tab, tabs, usados, mover, color, nuevo, addEstado, equipo, errEquipo, registro, caducan, demo, COLORES, setTema,
      sesion, enServidor, admin, ROLES, accesoDe, caducada, permisos, form, nuevaPersona, editar, guardarPersona, entrega, nuevaClave, copiar, cerrarEntrega, puedeDemo, rellenarDemo, vaciarTodo, claveAleatoria };
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
          <div v-for="t in TURNOS_OFICINA" :key="t" class="turno-conf">
            <h3>{{ t === 'Mañana' ? 'Turno de mañana' : t === 'Tarde' ? 'Turno de tarde 1' : 'Turno de tarde 2' }}</h3>
            <div class="grid3"><div class="fld"><label>Entrada</label><input class="inp" type="time" v-model="store.turnosDef[t].ini" /></div><div class="fld"><label>Salida</label><input class="inp" type="time" v-model="store.turnosDef[t].fin" /></div><div class="fld"><label>Aforo</label><input class="inp" type="number" min="1" max="20" v-model.number="store.aforo[t]" /></div></div>
          </div>
        </div>
        <div class="row"><b>Aspecto</b><div class="seg"><button :class="{on: store.tema==='claro'}" @click="setTema('claro')"><Ic n="sun" :s="15" />Claro</button><button :class="{on: store.tema==='oscuro'}" @click="setTema('oscuro')"><Ic n="moon" :s="15" />Oscuro</button></div></div>
      </div>

      <div v-else-if="tab==='equipo'" class="card-pad stack">
        <div class="equipo-cab">
          <p class="sub">Cada persona entra con su correo y su contraseña, y los permisos se comprueban en el servidor. A quien se va no se le borra: se desactiva, y su nombre sigue en el historial.</p>
          <button v-if="enServidor && admin" class="btn btn-primary" @click="nuevaPersona"><Ic n="plus" :s="15" />Añadir persona</button>
        </div>
        <div v-if="!enServidor" class="aviso"><Ic n="info" :s="16" /><span>Demostración: aquí no hay cuentas reales. En el portal con servidor, un administrador añade y desactiva personas desde esta pantalla.</span></div>
        <div v-else-if="!admin" class="aviso"><Ic n="info" :s="16" /><span>Solo un administrador puede añadir personas o cambiar roles.</span></div>
        <div v-if="errEquipo" class="aviso err"><Ic n="alert" :s="16" /><span>{{ errEquipo }}</span></div>
        <table class="tbl sin-hover tbl-tarjetas"><thead><tr><th>Persona</th><th>Rol</th><th>Qué puede hacer</th><th>Acceso</th><th v-if="enServidor && admin"></th></tr></thead>
          <tbody><tr v-for="p in equipo" :key="p.id" :class="{inactiva: !p.activo || caducada(p)}">
            <td><div class="who"><Avatar :nombre="p.name || p.email" apellidos="" :s="28" /><span><b>{{ p.name || '—' }}</b><small v-if="p.email" class="sub" style="display:block">{{ p.email }}</small></span></div></td>
            <td><span class="tag" :class="{gold: p.rol==='admin'}">{{ ROLES[p.rol] || p.rol }}</span></td>
            <td class="sub solo-escritorio">{{ permisos(p.rol) }}</td>
            <td><span v-if="p.activo && !caducada(p)" class="ico-ok row" style="gap:5px"><Ic n="check" :s="15" />{{ accesoDe(p) }}</span><span v-else class="tag off">{{ accesoDe(p) }}</span></td>
            <td v-if="enServidor && admin" class="nowrap fila-acciones"><button class="btn btn-sm" @click="editar(p)"><Ic n="pencil" :s="14" />Editar</button> <button class="btn btn-sm" @click="nuevaClave(p)" :disabled="p.id===sesion.usuario?.id" :title="p.id===sesion.usuario?.id ? 'Tu contraseña se cambia desde tu menú, arriba a la derecha' : 'Poner una contraseña nueva'"><Ic n="lock" :s="14" />Contraseña</button></td>
          </tr></tbody></table>
        <p class="sub">Los roles Técnico, Asesor, Colaborador y Consulta tienen los mismos permisos; solo cambia el nombre. La verificación en dos pasos por correo se activará cuando se configure el buzón de envío.</p>

        <Modal v-if="form.abierto" :titulo="form.id ? 'Editar persona' : 'Añadir persona'" :ancho="480" @cerrar="form.abierto=false">
          <form class="stack" id="f-persona" @submit.prevent="guardarPersona">
            <div class="fld"><label>Nombre</label><input class="inp" v-model="form.name" required maxlength="80" placeholder="Nombre y apellido" /></div>
            <div class="fld"><label>Correo (será su usuario)</label><input class="inp" type="email" v-model="form.email" :disabled="!!form.id" required /></div>
            <div class="grid2">
              <div class="fld"><label>Rol</label><select class="inp" v-model="form.rol" :disabled="form.id===sesion.usuario?.id"><option v-for="(n,k) in ROLES" :key="k" :value="k">{{ n }}</option></select></div>
              <div class="fld"><label>Acceso hasta (opcional)</label><input class="inp" type="date" v-model="form.fin" /></div>
            </div>
            <p class="sub">Para practicantes: pon la fecha en la que terminan y el acceso se cortará solo al día siguiente.</p>
            <div v-if="!form.id" class="fld"><label>Contraseña inicial (mínimo 10 caracteres)</label><div class="clave-fila"><input class="inp" v-model="form.password" required minlength="10" autocomplete="off" /><button type="button" class="btn" @click="form.password=claveAleatoria()">Otra</button></div></div>
            <label v-else-if="form.id!==sesion.usuario?.id" class="row" style="gap:10px"><span class="switch"><input type="checkbox" v-model="form.activo" /><i></i></span><span>Acceso activo</span></label>
            <div v-if="form.error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ form.error }}</span></div>
          </form>
          <template #pie><button class="btn" @click="form.abierto=false">Cancelar</button><button class="btn btn-primary" type="submit" form="f-persona" :disabled="form.ocupado">{{ form.id ? 'Guardar' : 'Crear cuenta' }}</button></template>
        </Modal>

        <Modal v-if="entrega.abierto" titulo="Contraseña para entregar" :ancho="460" @cerrar="cerrarEntrega">
          <div class="stack">
            <p>Pásale estos datos a <b>{{ entrega.nombre }}</b> por un canal seguro. Esta contraseña no se volverá a mostrar; podrá cambiarla desde su menú al entrar.</p>
            <div class="fld"><label>Correo</label><input class="inp" :value="entrega.email" readonly /></div>
            <div class="fld"><label>Contraseña</label><div class="clave-fila"><input class="inp" :value="entrega.password" readonly /><button class="btn" @click="copiar(entrega.password)">Copiar</button></div></div>
          </div>
          <template #pie><button class="btn btn-primary" @click="cerrarEntrega">Hecho</button></template>
        </Modal>
      </div>

      <div v-else-if="tab==='personas'" class="card-pad stack">
        <p class="sub">Las personas que salen al elegir quién hace una entrevista, en el filtro «Agenda de…», en el tutor de unas prácticas y en quién lleva cada centro. No hace falta que tengan cuenta en el portal.</p>
        <div v-if="!admin" class="aviso"><Ic n="lock" :s="16" /><span>Solo un administrador puede cambiar esta lista.</span></div>
        <div class="personas-grid">
          <div v-for="g in GRUPOS" :key="g.k" class="caja">
            <div class="row"><Ic :n="g.i" /><h3>{{ g.t }}</h3><span class="tag right">{{ store.personas[g.k].length }}</span></div>
            <div class="personas-lista">
              <span v-for="(p, i) in store.personas[g.k]" :key="p" class="persona-chip">
                <Avatar :nombre="p" apellidos="" :s="24" />{{ p }}
                <button v-if="admin" class="x-mini" @click="pasarA(g.k, i)" :title="g.k==='equipo' ? 'Pasar a practicantes' : 'Pasar al equipo'" :aria-label="(g.k==='equipo' ? 'Pasar a practicantes a ' : 'Pasar al equipo a ') + p"><Ic n="sync" :s="11" /></button>
                <button v-if="admin" class="x-mini" @click="quitarPersona(g.k, i)" :title="'Quitar a ' + p" :aria-label="'Quitar a ' + p"><Ic n="x" :s="11" /></button>
              </span>
              <span v-if="!store.personas[g.k].length" class="muted">Nadie todavía.</span>
            </div>
            <div v-if="admin" class="row"><input class="inp" v-model="nuevaP[g.k]" :placeholder="'Nombre…'" @keydown.enter="addPersona(g.k)" /><button class="btn" @click="addPersona(g.k)"><Ic n="plus" :s="15" />Añadir</button></div>
          </div>
        </div>
      </div>

      <div v-else-if="tab==='datos'" class="card-pad stack">
        <div class="grid2">
          <div class="caja"><div class="row"><Ic n="clock" /><h3>Conservación de candidaturas</h3></div>
            <p class="sub">Los candidatos no seleccionados o retirados se conservan para futuras oportunidades durante el plazo indicado. Después se avisa para eliminarlos o pedir de nuevo el consentimiento.</p>
            <div class="row"><input class="inp" type="number" min="1" max="60" v-model.number="store.retencionMeses" style="width:90px" /><span>meses desde el último contacto</span></div>
            <div class="aviso"><Ic n="info" :s="16" /><span>Ahora mismo hay <b>{{ caducan }}</b> candidaturas sujetas a este plazo. Plazo a confirmar con vuestro delegado de protección de datos.</span></div></div>
          <div class="caja"><div class="row"><Ic n="db" /><h3>Copias de seguridad y exportación</h3></div>
            <template v-if="!enServidor"><p class="sub">Copia automática diaria a las 03:00 en vuestro servidor, guardando las 7 últimas (igual que el CRM).</p>
            <div class="aviso ok"><Ic n="check" :s="16" /><span>Última copia: hoy a las 03:00 (simulado).</span></div></template>
            <div v-else class="aviso warn"><Ic n="alert" :s="16" /><span>Las copias de seguridad automáticas de este servidor todavía no están configuradas.</span></div>
            <div class="row wrap"><button class="btn btn-sm" @click="demo('se descargaría todo en Excel')"><Ic n="download" :s="14" />Exportar todo a Excel</button><button class="btn btn-sm" @click="demo('se descargaría un ZIP con datos y documentos')"><Ic n="download" :s="14" />Copia completa (ZIP)</button></div></div>
        </div>
        <div v-if="puedeDemo" class="caja"><div class="row"><Ic n="sparkles" /><h3>Datos de demostración</h3></div>
          <p class="sub">Solo en el entorno de pruebas: rellena el portal con candidatos, centros y entrevistas inventados para probar, o déjalo vacío.</p>
          <div class="row wrap"><button class="btn btn-sm" @click="rellenarDemo" :disabled="store.candidatos.length>0" :title="store.candidatos.length>0 ? 'Vacía antes el entorno' : ''"><Ic n="plus" :s="14" />Cargar datos de demostración</button><button class="btn btn-sm btn-danger" @click="vaciarTodo"><Ic n="trash" :s="14" />Vaciar todos los datos</button></div></div>
        <div v-if="!enServidor || admin"><h3 style="margin-bottom:10px">Registro de acciones sensibles</h3>
          <p v-if="!registro.length" class="sub">Todavía no hay nada registrado.</p>
          <div v-else class="tbl-wrap"><table class="tbl sin-hover"><thead><tr><th>Fecha</th><th>Hora</th><th>Quién</th><th>Qué hizo</th></tr></thead><tbody><tr v-for="(r,i) in registro" :key="i"><td class="nowrap">{{ r.f }}</td><td>{{ r.h }}</td><td><b>{{ r.q }}</b></td><td>{{ r.t }}</td></tr></tbody></table></div></div>
      </div>

      <div v-else class="card-pad">
        <div class="integ">
          <div class="caja"><div class="row"><Ic n="sync" /><h3>Notion</h3><span class="notion right">Conectado (simulado)</span></div><p class="sub">Sincronización bidireccional de la agenda de entrevistas: lo que se rellena aquí aparece en Notion y al revés.</p></div>
          <div class="caja"><div class="row"><Ic n="whatsapp" /><h3>WhatsApp</h3><span class="tag right">Siguiente fase</span></div><p class="sub">API oficial de Meta a través de Chatwoot y n8n, como en el CRM: convocatorias, recordatorios de entrevista y avisos de incorporación con plantillas.</p></div>
          <div class="caja"><div class="row"><Ic n="mail" /><h3>Correo</h3><span class="tag right">Siguiente fase</span></div><p class="sub">Envío desde la ficha con plantillas y entrada automática de currículums que llegan por correo.</p></div>
          <div class="caja"><div class="row"><Ic n="calendario" /><h3>Google Calendar</h3><span class="tag right">Más adelante</span></div><p class="sub">Las entrevistas en el calendario de cada persona responsable.</p></div>
          <div class="caja"><div class="row"><Ic n="sparkles" /><h3>Lectura de currículums con IA</h3><span class="tag right" style="background:var(--success-bg);color:var(--ok-dark)">Activa</span></div><p class="sub">En la pestaña Currículum de cada ficha: propone los datos a partir del PDF y una persona elige qué se guarda. El archivo se envía a OpenAI solo para leerlo.</p></div>
          <div class="caja"><div class="row"><Ic n="pencil" /><h3>Convenios y firma</h3><span class="tag right">Más adelante</span></div><p class="sub">Generación del convenio desde la ficha y firma electrónica.</p></div>
        </div>
      </div>
    </div>
  </div>`,
};
