import { ref, reactive, computed, watch } from "vue";
import { store, toast, setTema, TURNOS_OFICINA, cargarDemo, vaciarDatos, addHist, nombreCompleto, estadoDe, DIAS_PAPELERA, borrarCandidato, restaurarDePapelera, vaciarDePapelera, diasEnPapelera, ESTADOS_SIN_PROCESO, candidaturasCaducadas, mantenerCandidatura, ultimoContacto } from "../store.js";
import { exportarExcel, copiaCompleta } from "../exportar.js";
import { recortarFoto } from "../cv.js";
import { sesion, esAdmin, ROLES, listarEquipo, crearPersona, editarPersona, ponerClave, listarAccesos, claveAleatoria, leerCurriculum, urlArchivo, registrar, borrarArchivo } from "../api.js";
import { Ic, Chip, Avatar, Modal, pedirConfirmacion } from "../ui.js";
import { COLORES, ASESORES, ENTREVISTADORES } from "../data.js";
import { plantillasIniciales, FIRMA_INICIAL, VARIABLES } from "../mensajes.js";
import { slug, fCompleta, dia, HOY_ISO, iso, pad } from "../util.js";

const tabActual = ref("equipo");

export default {
  components: { Ic, Chip, Avatar, Modal },
  setup() {
    const tab = tabActual;
    // Por orden de importancia: lo estético (colores de los estados) al final
    const tabs = computed(() => [["equipo", "Equipo y permisos", "candidatos"], ["personas", "Personas", "user"], ["mensajes", "Mensajes", "mail"], ["turnos", "Turnos y aforo", "clock"], ["integraciones", "Integraciones", "link"], ["datos", "Protección de datos", "shield"], ["estados", "Estados del proceso", "kanban"], ["papelera", "Papelera" + (store.papelera.length ? " (" + store.papelera.length + ")" : ""), "trash"]]);
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

    // --- Poner a cada candidato sin foto la foto de su currículum (lee cada currículum con la IA) ---
    const LEGIBLE = /^(pdf|jpe?g|png|webp)$/;
    // Fotos que se pueden rehacer: sin foto o con la que se puso sola desde el currículum (no las subidas o recortadas a mano)
    const fotoManual = (c) => {
      const h = store.historial.filter((x) => x.candId === c.id && /foto/i.test(x.texto || "")).sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || "")) || b.id - a.id)[0];
      return !!h && /Foto de perfil actualizada|Foto recortada del currículum|Foto eliminada|Foto quitada/.test(h.texto);
    };
    const pendientesFoto = computed(() => store.candidatos.filter((c) => !c.foto || !fotoManual(c)).map((c) => {
      const cv = store.documentos.filter((d) => d.candId === c.id && d.tipo === "Currículum" && d.archivoId && LEGIBLE.test(d.ext || "")).sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || "")) || b.id - a.id)[0];
      return cv ? { c, cv } : null;
    }).filter(Boolean));
    const lote = reactive({ activo: false, parar: false, hechos: 0, total: 0, conFoto: 0, sinFoto: 0, errores: 0, actual: "", terminado: false });
    async function fotosDesdeCurriculums() {
      const lista = [...pendientesFoto.value];
      if (!lista.length) return toast("No hay candidatos sin foto con currículum en PDF o imagen.");
      if (!(await pedirConfirmacion({ titulo: "¿Rehacer las fotos de " + lista.length + " candidatos?", texto: "Se abre cada currículum, se busca la cara de la foto y se recorta centrada. No se tocan las fotos subidas o recortadas a mano, ni se quita ninguna si no se encuentra la cara. Tarda un par de segundos por persona; puedes pararlo cuando quieras.", boton: "Empezar" }))) return;
      Object.assign(lote, { activo: true, parar: false, hechos: 0, total: lista.length, conFoto: 0, sinFoto: 0, errores: 0, actual: "", terminado: false });
      for (const { c, cv } of lista) {
        if (lote.parar) break;
        lote.actual = nombreCompleto(c);
        try {
          const blob = await (await fetch(await urlArchivo(cv))).blob();
          const tipo = cv.ext === "pdf" ? "application/pdf" : blob.type || "image/" + cv.ext;
          const foto = await recortarFoto(new File([blob], cv.nombre, { type: tipo }), null, { soloConCara: true });
          if (foto) { c.foto = foto; addHist(c.id, "documento", "Foto puesta desde el currículum (" + cv.nombre + ")"); lote.conFoto++; } else lote.sinFoto++;
        } catch (e) {
          lote.errores++;
          if (e.estado === 429) { toast("La IA pide una pausa: vuelve a pulsar el botón dentro de un rato para seguir.", "error"); break; }
        }
        lote.hechos++;
      }
      registrar("Puso fotos desde los currículums", lote.conFoto + " de " + lote.hechos);
      Object.assign(lote, { activo: false, actual: "", terminado: true });
      toast(lote.conFoto + " fotos puestas");
    }
    const caducan = computed(() => store.candidatos.filter((c) => ESTADOS_SIN_PROCESO.includes(c.estado)).length);
    const demo = (m) => toast((enServidor.value ? "Todavía no disponible: " : "Demo: ") + m);
    const restaurarPlantillas = async () => { if (!(await pedirConfirmacion({ titulo: "¿Restaurar los textos originales?", texto: "Se perderán los cambios que hayas hecho en las plantillas.", boton: "Sí, restaurar" }))) return; store.plantillas = plantillasIniciales(); store.firma = FIRMA_INICIAL; toast("Plantillas restauradas"); };
    const nuevaPlantilla = () => store.plantillas.push({ id: "p" + Date.now().toString(36), nombre: "Nueva plantilla", uso: "general", asunto: "", texto: "Hola {nombre}, \n\n{firma}" });
    const quitarPlantilla = async (i) => { if (await pedirConfirmacion({ titulo: "¿Quitar esta plantilla?", texto: store.plantillas[i].nombre, boton: "Sí, quitar" })) store.plantillas.splice(i, 1); };
    // Vista previa de una plantilla con datos de ejemplo
    const EJEMPLO = { nombre: "Laura", apellidos: "García", centro: "Universidad", fecha: "lunes 24 de noviembre", hora: "10:30", donde: "Presencial · Calle General Álvarez de Castro 41", lugar: " en nuestra oficina", lugar_oficina: "Calle General Álvarez de Castro 41", entrevistador: "Vanesa", inicio: "lunes 1 de diciembre", horario: "10:00–15:00" };
    const vistaPrevia = (t) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (k === "firma" ? store.firma || "" : EJEMPLO[k] ?? m));
    // --- Exportar todo ---
    const copia = reactive({ ocupado: false, hechos: 0, total: 0 });
    const hacerExcel = () => { exportarExcel(); toast("Excel descargado"); };
    const hacerCopia = async () => {
      if (copia.ocupado) return;
      Object.assign(copia, { ocupado: true, hechos: 0, total: 0 });
      try { const r = await copiaCompleta((h, t) => Object.assign(copia, { hechos: h, total: t })); toast("Copia descargada: " + r.documentos + " documentos" + (r.fallos ? " (" + r.fallos + " no se pudieron bajar)" : ""), r.fallos ? "error" : "ok"); }
      catch (e) { toast("No se pudo preparar la copia: " + e.message, "error"); }
      finally { copia.ocupado = false; }
    };
    // --- Conservación de datos ---
    const caducadas = computed(() => candidaturasCaducadas());
    const proximasCad = computed(() => candidaturasCaducadas(30).length - caducadas.value.length);
    const revision = reactive({ abierto: false, sel: {} });
    const abrirRevision = () => { revision.sel = {}; revision.abierto = true; };
    const seleccionadas = computed(() => caducadas.value.filter((c) => revision.sel[c.id]));
    const mantener = (c) => { mantenerCandidatura(c); toast("Se mantiene la ficha de " + nombreCompleto(c) + " otros " + store.retencionMeses + " meses"); if (!caducadas.value.length) revision.abierto = false; };
    const mandarSeleccion = async () => {
      const l = seleccionadas.value; if (!l.length) return;
      if (!(await pedirConfirmacion({ titulo: "¿Mandar " + l.length + " fichas a la papelera?", texto: "Se guardan " + DIAS_PAPELERA + " días en Ajustes → Papelera, por si alguna se manda por error. Pasado ese tiempo se borran para siempre.", boton: "Mandar a la papelera" }))) return;
      l.forEach((c) => borrarCandidato(c));
      registrar("Mandó a la papelera candidaturas caducadas", l.length + " fichas");
      toast(l.length + " fichas en la papelera");
      if (!caducadas.value.length) revision.abierto = false;
    };
    // --- Papelera ---
    const papelera = computed(() => store.papelera.slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)));
    const restaurar = (p) => { if (restaurarDePapelera(p)) { toast("Ficha de " + p.nombre + " restaurada"); registrar("Restauró una ficha de la papelera", p.nombre); } };
    const borrarArchivos = (ids) => { if (sesion.modo === "servidor") ids.forEach((a) => borrarArchivo(a).catch(() => {})); };
    const eliminarYa = async (p) => {
      if (!(await pedirConfirmacion({ titulo: "¿Borrar para siempre a " + p.nombre + "?", texto: "Se borran su ficha y todos sus archivos. No se puede deshacer.", boton: "Borrar para siempre" }))) return;
      borrarArchivos(vaciarDePapelera(p)); registrar("Borró para siempre una ficha de la papelera", p.nombre); toast("Ficha borrada para siempre");
    };
    const vaciarPapelera = async () => {
      const n = store.papelera.length;
      if (!(await pedirConfirmacion({ titulo: "¿Vaciar la papelera?", texto: "Se borran para siempre " + n + " fichas y todos sus archivos. No se puede deshacer.", boton: "Vaciar la papelera" }))) return;
      store.papelera.slice().forEach((p) => borrarArchivos(vaciarDePapelera(p))); registrar("Vació la papelera", n + " fichas"); toast("Papelera vacía");
    };
    return { fCompleta, nombreCompleto, copia, hacerExcel, hacerCopia, caducadas, proximasCad, revision, abrirRevision, seleccionadas, mantener, mandarSeleccion, papelera, restaurar, eliminarYa, vaciarPapelera, DIAS_PAPELERA, diasEnPapelera, estadoDe, ultimoContacto, vistaPrevia, pendientesFoto, lote, fotosDesdeCurriculums, VARIABLES, restaurarPlantillas, nuevaPlantilla, quitarPlantilla, GRUPOS, nuevaP, addPersona, quitarPersona, pasarA, TURNOS_OFICINA, store, tab, tabs, usados, mover, color, nuevo, addEstado, equipo, errEquipo, registro, caducan, demo, COLORES, setTema,
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

      <div v-else-if="tab==='mensajes'" class="card-pad stack">
        <div class="caja"><div class="row"><Ic n="whatsapp" /><h3>Plantillas de WhatsApp y correo</h3></div>
          <p class="sub">Al pulsar WhatsApp o Correo en una ficha se abre tu WhatsApp o tu correo con el mensaje ya escrito; tú lo revisas y lo envías. Salen desde la cuenta que tengas abierta en ese aparato. Variables disponibles: <b v-for="v in VARIABLES" :key="v" style="margin-right:6px">{{ '{' + v + '}' }}</b></p>
          <div class="fld"><label>Firma ({firma})</label><input class="inp" v-model="store.firma" /></div></div>
        <div v-for="(p, i) in store.plantillas" :key="p.id" class="caja">
          <div class="row"><input class="inp grow" v-model="p.nombre" style="font-weight:700" /><button class="icon-btn" @click="quitarPlantilla(i)" title="Quitar plantilla"><Ic n="trash" :s="16" /></button></div>
          <div class="fld"><label>Asunto del correo</label><input class="inp" v-model="p.asunto" /></div>
          <div class="plantilla-edicion"><div class="fld"><label>Texto</label><textarea class="inp plantilla-texto" v-model="p.texto" rows="12"></textarea></div><div class="fld"><label>Así se verá</label><div class="plantilla-vista">{{ vistaPrevia(p.texto) }}</div></div></div>
          <div class="fld"><label>Se puede usar</label><select class="inp" v-model="p.uso"><option value="general">Con cualquier persona</option><option value="entrevista">Solo si tiene entrevista</option><option value="estudiante">Solo si está en prácticas</option></select></div>
        </div>
        <div class="row wrap"><button class="btn btn-sm" @click="nuevaPlantilla"><Ic n="plus" :s="14" />Nueva plantilla</button><button class="btn btn-sm" @click="restaurarPlantillas">Restaurar textos originales</button></div>
      </div>

      <div v-else-if="tab==='datos'" class="card-pad stack">
        <div class="grid2">
          <div class="caja"><div class="row"><Ic n="clock" /><h3>Conservación de candidaturas</h3></div>
            <p class="sub">Los candidatos no seleccionados, retirados o cancelados se conservan durante el plazo que indiques, contado desde el último contacto con ellos. Pasado el plazo aparecen aquí para que decidáis: mandarlos a la papelera o mantenerlos otro periodo.</p>
            <div class="row"><input class="inp" type="number" min="1" max="60" v-model.number="store.retencionMeses" style="width:90px" /><span>meses desde el último contacto</span></div>
            <div class="aviso" :class="{warn: caducadas.length}"><Ic :n="caducadas.length ? 'alert' : 'info'" :s="16" /><span v-if="caducadas.length" class="grow"><b>{{ caducadas.length }}</b> candidaturas han pasado el plazo y esperan una decisión.</span><span v-else class="grow">Ninguna candidatura ha pasado el plazo. Ahora mismo hay <b>{{ caducan }}</b> en un estado sin proceso<template v-if="proximasCad > 0"> y <b>{{ proximasCad }}</b> lo cumplen en el próximo mes</template>.</span><button v-if="caducadas.length && admin" class="btn btn-sm" @click="abrirRevision">Revisar ahora</button></div></div>
          <div class="caja"><div class="row"><Ic n="db" /><h3>Copias de seguridad y exportación</h3></div>
            <template v-if="!enServidor"><p class="sub">Copia automática diaria a las 03:00 en vuestro servidor, guardando las 7 últimas (igual que el CRM).</p>
            <div class="aviso ok"><Ic n="check" :s="16" /><span>Última copia: hoy a las 03:00 (simulado).</span></div></template>
            <div v-else class="aviso warn"><Ic n="alert" :s="16" /><span>Las copias de seguridad automáticas de este servidor todavía no están configuradas.</span></div>
            <p class="sub">Excel: candidatos, entrevistas, estudiantes, centros, observaciones e historial, una hoja de cada. La copia completa añade los datos en JSON y todos los documentos ordenados por persona.</p>
            <div class="row wrap"><button class="btn btn-sm" @click="hacerExcel"><Ic n="download" :s="14" />Exportar todo a Excel</button><button class="btn btn-sm" :disabled="copia.ocupado" @click="hacerCopia"><Ic n="download" :s="14" />{{ copia.ocupado ? 'Preparando ' + copia.hechos + ' de ' + copia.total + '…' : 'Copia completa (ZIP)' }}</button></div></div>
        </div>
        <Modal v-if="revision.abierto" titulo="Candidaturas que han pasado el plazo" :ancho="760" @cerrar="revision.abierto=false">
          <p class="sub">Marca las que quieras mandar a la papelera (se pueden recuperar durante {{ DIAS_PAPELERA }} días). Con «Mantener», la ficha se queda otros {{ store.retencionMeses }} meses.</p>
          <div class="tbl-wrap"><table class="tbl sin-hover"><thead><tr><th></th><th>Persona</th><th>Estado</th><th>Último contacto</th><th></th></tr></thead><tbody>
            <tr v-for="c in caducadas" :key="c.id"><td><input type="checkbox" v-model="revision.sel[c.id]" /></td><td><b>{{ nombreCompleto(c) }}</b></td><td>{{ estadoDe(c.estado).n }}</td><td class="nowrap">{{ fCompleta(ultimoContacto(c)) }}</td><td class="nowrap"><button class="btn btn-sm" @click="mantener(c)">Mantener</button></td></tr>
          </tbody></table></div>
          <template #pie><button class="btn" @click="revision.abierto=false">Cerrar</button><button class="btn btn-danger" :disabled="!seleccionadas.length" @click="mandarSeleccion">Mandar {{ seleccionadas.length }} a la papelera</button></template>
        </Modal>
        <div v-if="puedeDemo" class="caja"><div class="row"><Ic n="sparkles" /><h3>Datos de demostración</h3></div>
          <p class="sub">Solo en el entorno de pruebas: rellena el portal con candidatos, centros y entrevistas inventados para probar, o déjalo vacío.</p>
          <div class="row wrap"><button class="btn btn-sm" @click="rellenarDemo" :disabled="store.candidatos.length>0" :title="store.candidatos.length>0 ? 'Vacía antes el entorno' : ''"><Ic n="plus" :s="14" />Cargar datos de demostración</button><button class="btn btn-sm btn-danger" @click="vaciarTodo"><Ic n="trash" :s="14" />Vaciar todos los datos</button></div></div>
        <div v-if="!enServidor || admin"><h3 style="margin-bottom:10px">Registro de acciones sensibles</h3>
          <p v-if="!registro.length" class="sub">Todavía no hay nada registrado.</p>
          <div v-else class="tbl-wrap"><table class="tbl sin-hover"><thead><tr><th>Fecha</th><th>Hora</th><th>Quién</th><th>Qué hizo</th></tr></thead><tbody><tr v-for="(r,i) in registro" :key="i"><td class="nowrap">{{ r.f }}</td><td>{{ r.h }}</td><td><b>{{ r.q }}</b></td><td>{{ r.t }}</td></tr></tbody></table></div></div>
      </div>

      <div v-else-if="tab==='papelera'" class="card-pad stack">
        <p class="sub">Las fichas que se borran no desaparecen del todo: se guardan aquí {{ DIAS_PAPELERA }} días con todo lo suyo (entrevistas, valoraciones, documentos, notas e historial). Puedes recuperarlas o borrarlas ya; pasado ese tiempo se borran solas.</p>
        <div v-if="!admin" class="aviso"><Ic n="info" :s="16" /><span>Solo un administrador puede gestionar la papelera.</span></div>
        <p v-else-if="!papelera.length" class="sub">La papelera está vacía.</p>
        <template v-else>
          <div class="tbl-wrap"><table class="tbl sin-hover"><thead><tr><th>Persona</th><th>Centro</th><th>Mandada a la papelera</th><th>Por</th><th>Se borra en</th><th></th></tr></thead><tbody>
            <tr v-for="p in papelera" :key="p.id"><td><b>{{ p.nombre }}</b></td><td>{{ p.centro || 'Autopostulado' }}</td><td class="nowrap">{{ fCompleta(p.fecha) }}, {{ p.hora }}</td><td>{{ p.por }}</td><td class="nowrap">{{ Math.max(0, DIAS_PAPELERA - diasEnPapelera(p)) }} días</td><td class="nowrap"><button class="btn btn-sm" @click="restaurar(p)">Restaurar</button> <button class="btn btn-sm btn-danger" @click="eliminarYa(p)">Borrar ya</button></td></tr>
          </tbody></table></div>
          <div><button class="btn btn-sm btn-danger" @click="vaciarPapelera"><Ic n="trash" :s="14" />Vaciar la papelera</button></div>
        </template>
      </div>

      <div v-else class="card-pad">
        <div class="integ">
          <div class="caja"><div class="row"><Ic n="sparkles" /><h3>Lectura de currículums con IA</h3><span class="tag right" style="background:var(--success-bg);color:var(--ok-dark)">Activa</span></div><p class="sub">Al dar de alta un candidato y en la pestaña Currículum de la ficha: rellena los datos y recorta la foto a partir del PDF o la imagen. El archivo se envía a OpenAI solo para leerlo.</p><div v-if="enServidor && admin" class="lote-fotos">
              <div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn btn-sm" :disabled="lote.activo || !pendientesFoto.length" @click="fotosDesdeCurriculums"><Ic n="user" :s="14" />Arreglar las fotos de los currículums</button><span class="sub">{{ pendientesFoto.length }} candidatos con currículum en PDF o imagen (sin foto o con foto automática)</span><button v-if="lote.activo" class="btn btn-sm btn-ghost" @click="lote.parar = true">Parar</button></div>
              <div v-if="lote.activo || lote.terminado" class="lote-prog"><div class="ia-barra-fija"><i :style="{width: (lote.total ? Math.round(lote.hechos / lote.total * 100) : 0) + '%'}"></i></div><span class="sub">{{ lote.hechos }} de {{ lote.total }} · {{ lote.conFoto }} con foto · {{ lote.sinFoto }} sin cara en el currículum<template v-if="lote.errores"> · {{ lote.errores }} no se pudieron leer</template><template v-if="lote.actual"> · leyendo {{ lote.actual }}…</template></span></div>
            </div></div>
          <div class="caja"><div class="row"><Ic n="whatsapp" /><h3>WhatsApp y correo</h3><span class="tag right" style="background:var(--success-bg);color:var(--ok-dark)">Activo</span></div><p class="sub">Desde la ficha, las entrevistas y el menú de cada persona: abre WhatsApp o el correo del equipo con la plantilla ya rellenada (se editan en la pestaña Mensajes). El envío automático con la API de Meta queda para más adelante.</p></div>
          <div class="caja"><div class="row"><Ic n="sync" /><h3>Notion y Excel de entrevistas</h3><span class="tag right" style="background:var(--success-bg);color:var(--ok-dark)">Activa</span></div><p class="sub">Cada entrevista que se crea o cambia aquí pasa sola a Notion (servicio «Entrevista prácticas») y de ahí al Excel de la agenda en unos minutos. Sin avisos automáticos de Chatwoot. Lo que se cambie en Notion o en el Excel todavía no vuelve al portal.</p></div>
          <div class="caja"><div class="row"><Ic n="clock" /><h3>Gentrivo (fichajes y horarios)</h3><span class="tag right" style="background:var(--success-bg);color:var(--ok-dark)">Activa</span></div><p class="sub">El horario de cada practicante y sus cambios puntuales (exámenes, días libres) se leen de Gentrivo y se ven en Estudiantes y en la ficha. Falta: dar de alta en Gentrivo automáticamente a quien empieza las prácticas.</p></div>
          <div class="caja"><div class="row"><Ic n="pencil" /><h3>Convenios y firma</h3><span class="tag right">Más adelante</span></div><p class="sub">Generación del convenio desde la ficha y firma electrónica.</p></div>
        </div>
      </div>
    </div>
  </div>`,
};
