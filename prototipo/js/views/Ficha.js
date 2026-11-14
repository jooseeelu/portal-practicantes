import { computed, reactive, ref } from "vue";
import { store, candDe, centroDe, entrevistaDe, estudianteDe, docsDe, histDe, cambiarEstado, incorporar, programarEntrevista, addHist, toast, nuevoId, nombreCompleto, estadoPracticas } from "../store.js";
import { ruta, go } from "../router.js";
import { Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio, leerFoto } from "../ui.js";
import { TURNOS, AREAS, ORIGENES, ENTREVISTADORES, ASESORES, HORAS_ENTREVISTA, ESTADOS_CITA } from "../data.js";
import { fCompleta, fCorta, fLarga, HOY_ISO, dia, relativo, turnoDe } from "../util.js";

const CRITERIOS = [["conocimientos", "Conocimientos"], ["comunicacion", "Comunicación"], ["disponibilidad", "Disponibilidad"], ["adecuacion", "Adecuación al puesto"]];
const TIPOS_DOC = ["Currículum", "Convenio", "Anexo", "Justificante", "Otro"];
const ICONO_HIST = { alta: "plus", estado: "sync", entrevista: "calendario", valoracion: "star", incorporacion: "estudiantes", documento: "documentos", nota: "note" };

export default {
  components: { Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio },
  setup() {
    const c = computed(() => candDe(ruta.value.id));
    const tab = ref(store.fichaTab || "personal"); store.fichaTab = "personal";
    const ent = computed(() => (c.value ? entrevistaDe(c.value.id) : null));
    const est = computed(() => (c.value ? estudianteDe(c.value.id) : null));
    const docs = computed(() => (c.value ? docsDe(c.value.id) : []));
    const hist = computed(() => (c.value ? histDe(c.value.id) : []));
    const notas = computed(() => store.notas.filter((n) => n.candId === c.value?.id).sort((a, b) => b.id - a.id));
    const cv = computed(() => docs.value.find((d) => d.tipo === "Currículum") || null);
    const cvSel = ref(null);
    const cvActual = computed(() => docs.value.find((d) => d.id === cvSel.value) || cv.value);
    const opCentros = computed(() => store.centros.filter((x) => !x.archivado).map((x) => ({ valor: x.id, etiqueta: x.nombre })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)));
    const centroSel = computed({ get: () => c.value.centroId || "", set: (v) => { c.value.centroId = v || null; } });
    const tabs = computed(() => [
      { k: "personal", t: "Información personal", i: "user" }, { k: "formacion", t: "Formación", i: "estudiantes" }, { k: "cv", t: "Currículum", i: "documentos" },
      { k: "entrevista", t: "Entrevista", i: "entrevistas" }, { k: "pc", t: "A favor y en contra", i: "star", n: (c.value.pros?.length || 0) + (c.value.contras?.length || 0) }, { k: "docs", t: "Documentación", i: "archive", n: docs.value.length },
      { k: "historial", t: "Historial", i: "history", n: hist.value.length }, { k: "notas", t: "Observaciones internas", i: "lock", n: notas.value.length },
    ]);
    const estadoSel = computed({ get: () => c.value.estado, set: (k) => cambiarEstado(c.value, k) });
    const zoom = ref(1);

    // --- Entrevista: programar y valorar ---
    const prog = reactive({ abierto: false, fecha: dia(3), hora: "10:30", modalidad: "Presencial", entrevistador: "" });
    const guardarProg = () => { programarEntrevista(c.value, prog); prog.abierto = false; tab.value = "entrevista"; };
    const media = computed(() => { const v = CRITERIOS.map(([k]) => ent.value?.criterios[k].n).filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 2) / 2 : null; });
    const notaFinal = ref(c.value?.nota ?? null);
    const guardarValoracion = () => {
      const v = notaFinal.value ?? media.value;
      if (v == null) return toast("Puntúa al menos un criterio o escribe la nota final.", "error");
      c.value.nota = Number(v); notaFinal.value = Number(v);
      ent.value.estado = "Realizada";
      addHist(c.value.id, "valoracion", `Valoración final: ${String(v).replace(".", ",")}/10`, ent.value.entrevistador || "Admin");
      if (["entrevista-programada", "entrevistado", "pendiente-entrevista"].includes(c.value.estado)) cambiarEstado(c.value, "en-valoracion", { silencioso: true });
      toast("Valoración guardada · sincronizada con Notion");
    };
    const addPregunta = () => ent.value.preguntas.push({ q: "", a: "" });

    // --- Documentos ---
    function subir(files, tipo = "Otro") {
      files.forEach((f) => {
        const repe = docs.value.find((d) => d.nombre === f.name);
        if (repe) return toast(`«${f.name}» ya está en esta ficha: no se duplica.`, "error");
        store.documentos.push({ id: nuevoId(), candId: c.value.id, nombre: f.name, tipo: /cv|curr/i.test(f.name) ? "Currículum" : tipo, fecha: HOY_ISO, tam: Math.max(1, Math.round(f.size / 1024)), ext: f.name.split(".").pop().toLowerCase() });
        addHist(c.value.id, "documento", `Documento añadido: ${f.name}`);
        if (/cv|curr/i.test(f.name) || tipo === "Currículum") c.value.cv = true;
      });
      toast(files.length > 1 ? `${files.length} archivos añadidos` : "Archivo añadido");
    }
    const borrarDoc = (d) => { store.documentos = store.documentos.filter((x) => x.id !== d.id); addHist(c.value.id, "documento", `Documento eliminado: ${d.nombre}`); toast("Documento eliminado"); };
    const tam = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB");

    // --- Notas internas ---
    const nuevaNota = ref("");
    const addNota = () => { if (!nuevaNota.value.trim()) return; store.notas.push({ id: nuevoId(), candId: c.value.id, autor: "Admin", fecha: HOY_ISO, texto: nuevaNota.value.trim() }); addHist(c.value.id, "nota", "Nueva observación interna"); nuevaNota.value = ""; };

    // --- Convertir en estudiante ---
    const inc = reactive({ abierto: false, inicio: dia(10), fin: dia(70), horaIni: "10:00", horaFin: "15:00", horas: 340, tutor: "", convenio: false });
    const abrirInc = () => {
      const e = est.value, t = c.value.turno === "Tarde" ? "Tarde" : "Mañana";
      Object.assign(inc, { abierto: true, inicio: e?.inicio || dia(10), fin: e?.fin || dia(70), horaIni: e?.horaIni || store.turnosDef[t].ini, horaFin: e?.horaFin || store.turnosDef[t].fin, horas: e?.horas || c.value.horas || 340, tutor: e ? e.tutor : "", convenio: e?.convenio || false });
    };
    const ocupacion = computed(() => { const t = turnoDe(inc.horaIni); const n = store.estudiantes.filter((e) => e.candId !== c.value.id && e.inicio <= inc.inicio && e.fin >= inc.inicio && turnoDe(e.horaIni) === t).length; return { t, n, aforo: store.aforo[t], pasa: n + 1 > store.aforo[t] }; });
    const guardarInc = () => { const { abierto, ...datos } = inc; incorporar(c.value, datos); inc.abierto = false; };
    const demo = (m) => toast("Demo: " + m);
    // Puntos a favor y en contra
    const nuevo = reactive({ pros: "", contras: "" });
    const addPC = (tipo) => {
      const t = nuevo[tipo].trim(); if (!t) return;
      const l = (c.value[tipo] ||= []);
      if (l.some((x) => x.toLowerCase() === t.toLowerCase())) return toast("Ese punto ya está anotado.", "error");
      l.push(t); nuevo[tipo] = "";
      addHist(c.value.id, "nota", (tipo === "pros" ? "Punto a favor: " : "Punto en contra: ") + t);
    };
    const quitarPC = (tipo, i) => c.value[tipo].splice(i, 1);
    // Foto de la persona (se recorta en cuadrado al subirla)
    const ponerFoto = async (ev) => {
      const archivo = ev.target.files[0]; ev.target.value = "";
      try { c.value.foto = await leerFoto(archivo); addHist(c.value.id, "documento", "Foto de perfil actualizada"); toast("Foto actualizada"); } catch (e) { toast(e.message, "error"); }
    };
    const quitarFoto = () => { c.value.foto = ""; toast("Foto eliminada"); };

    return { store, c, tab, tabs, ent, est, docs, hist, notas, cv, cvSel, cvActual, opCentros, centroSel, estadoSel, zoom, prog, guardarProg, media, notaFinal, guardarValoracion, addPregunta,
      subir, borrarDoc, tam, nuevo, addPC, quitarPC, ponerFoto, quitarFoto, nuevaNota, addNota, inc, abrirInc, ocupacion, guardarInc, demo, go, centroDe, nombreCompleto, estadoPracticas,
      CRITERIOS, TIPOS_DOC, ICONO_HIST, TURNOS, AREAS, ORIGENES, ENTREVISTADORES, ASESORES, HORAS_ENTREVISTA, ESTADOS_CITA, fCompleta, fCorta, fLarga, relativo };
  },
  template: `
  <div class="page" v-if="c">
    <a class="volver" @click="go('candidatos')"><Ic n="chevL" :s="15" />Candidatos</a>

    <div class="card ficha-head">
      <div class="foto-col">
        <label class="foto-edit" title="Cambiar la foto"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :foto="c.foto" :s="84" /><span class="camara"><Ic n="camara" :s="15" /></span><input type="file" accept="image/*" hidden @change="ponerFoto" /></label>
        <button v-if="c.foto" class="foto-quitar" @click="quitarFoto">Quitar foto</button>
      </div>
      <div class="grow">
        <div class="row wrap"><h1>{{ c.nombre }} {{ c.apellidos }}</h1><Chip :k="c.estado" /><span v-if="est" class="tag gold"><Ic n="estudiantes" :s="13" />Prácticas: {{ estadoPracticas(est).toLowerCase() }}</span></div>
        <div class="ficha-sub">
          <span><Ic n="centros" :s="14" />{{ centroDe(c.centroId)?.nombre || 'Autopostulado' }}</span>
          <span><Ic n="estudiantes" :s="14" />{{ c.titulacion || 'Sin titulación' }}</span>
          <span><Ic n="mail" :s="14" />{{ c.email || 'Sin correo' }}</span>
          <span><Ic n="phone" :s="14" />{{ c.tel || 'Sin teléfono' }}</span>
        </div>
      </div>
      <div class="ficha-nota"><span class="lbl">Valoración</span><Nota :v="c.nota" grande /></div>
      <div class="ficha-acc">
        <div class="fld"><label>Estado de la candidatura</label><select class="inp" v-model="estadoSel"><option v-for="e in store.estados.filter(x => x.activo || x.k===c.estado)" :key="e.k" :value="e.k">{{ e.n }}</option></select></div>
        <div class="row">
          <button class="btn btn-sm" @click="demo('se abriría WhatsApp (API de Meta vía Chatwoot) con la plantilla elegida')" title="WhatsApp"><Ic n="whatsapp" :s="15" />WhatsApp</button>
          <button class="btn btn-sm" @click="demo('se abriría el redactor de correo con plantillas')" title="Correo"><Ic n="mail" :s="15" />Correo</button>
          <button v-if="!ent || ent.estado==='Cancelada'" class="btn btn-sm btn-primary" @click="prog.abierto=true"><Ic n="calendario" :s="15" />Programar entrevista</button>
          <button v-else-if="!est || estadoPracticas(est)==='Prevista'" class="btn btn-sm btn-accent" @click="abrirInc"><Ic n="estudiantes" :s="15" />{{ est ? 'Editar incorporación' : 'Convertir en estudiante' }}</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="tabs"><button v-for="t in tabs" :key="t.k" :class="{on: tab===t.k}" @click="tab=t.k"><Ic :n="t.i" :s="15" />{{ t.t }}<span v-if="t.n" class="cnt">{{ t.n }}</span></button></div>

      <!-- PERSONAL -->
      <div v-if="tab==='personal'" class="card-pad stack">
        <div class="grid3">
          <div class="fld"><label>Nombre</label><input class="inp" v-model="c.nombre" /></div>
          <div class="fld"><label>Apellidos</label><input class="inp" v-model="c.apellidos" /></div>
          <div class="fld"><label>Cómo ha llegado</label><select class="inp" v-model="c.origen"><option v-for="o in ORIGENES" :key="o">{{ o }}</option></select></div>
          <div class="fld"><label>Correo electrónico</label><input class="inp" v-model="c.email" /></div>
          <div class="fld"><label>Teléfono</label><input class="inp" v-model="c.tel" /></div>
          <div class="fld"><label>Área de interés</label><select class="inp" v-model="c.area"><option v-for="a in AREAS" :key="a">{{ a }}</option></select></div>
          <div class="fld"><label>Turno disponible</label><select class="inp" v-model="c.turno"><option v-for="t in TURNOS" :key="t">{{ t }}</option></select></div>
          <div class="fld"><label>Duración prevista (horas)</label><input class="inp" type="number" v-model="c.horas" /></div>
          <div class="fld"><label>Registrado el</label><input class="inp" :value="fCompleta(c.creado)" disabled /></div>
        </div>
        <div class="fld"><label>Observaciones</label><textarea class="inp" v-model="c.obs" rows="3" placeholder="Resumen visible en el listado de candidatos"></textarea></div>
        <div v-if="est" class="practicas-box">
          <div class="row"><Ic n="estudiantes" /><b>Prácticas en la gestoría</b><Chip :texto="estadoPracticas(est)" c="var(--cyan)" cd="var(--cyan-dark)" /><button class="btn btn-sm right" @click="abrirInc"><Ic n="pencil" :s="14" />Editar</button></div>
          <div class="datos"><div><span>Inicio</span><b>{{ fCompleta(est.inicio) }}</b></div><div><span>Fin previsto</span><b>{{ fCompleta(est.fin) }}</b></div><div><span>Horario</span><b>{{ est.horaIni }}–{{ est.horaFin }}</b></div><div><span>Horas totales</span><b>{{ est.horas }} h</b></div><div><span>Tutor en la gestoría</span><b v-if="est.tutor">{{ est.tutor }}</b><b v-else class="muted">Sin asignar</b></div><div><span>Convenio</span><b>{{ est.convenio ? 'Firmado' : 'Pendiente de firma' }}</b></div></div>
        </div>
        <p class="sub"><Ic n="check" :s="13" /> Los cambios se guardan al escribir (en el prototipo no se conservan al recargar).</p>
      </div>

      <!-- FORMACIÓN -->
      <div v-else-if="tab==='formacion'" class="card-pad stack">
        <div class="grid2">
          <div class="fld"><label>Centro educativo</label><SelectBuscable v-model="centroSel" :opciones="opCentros" etiqueta-todos="Sin centro (autopostulado)" /></div>
          <div class="fld"><label>Titulación</label><input class="inp" v-model="c.titulacion" list="dl-prog" /><datalist id="dl-prog"><option v-for="p in (centroDe(c.centroId)?.programas || [])" :key="p" :value="p" /></datalist></div>
          <div class="fld"><label>Curso</label><input class="inp" v-model="c.curso" placeholder="2.º" /></div>
          <div class="fld"><label>Especialidad / área</label><select class="inp" v-model="c.area"><option v-for="a in AREAS" :key="a">{{ a }}</option></select></div>
        </div>
        <div v-if="centroDe(c.centroId)" class="centro-mini" @click="go('centros/'+c.centroId)">
          <Ic n="centros" :s="22" /><div class="grow"><b>{{ centroDe(c.centroId).nombre }}</b><div class="sub">{{ centroDe(c.centroId).tipo }} · prácticas de {{ centroDe(c.centroId).horas }} · {{ centroDe(c.centroId).periodos }} · responsable en la gestoría: {{ centroDe(c.centroId).responsable }}</div></div><Ic n="chevR" />
        </div>
      </div>

      <!-- CURRÍCULUM -->
      <div v-else-if="tab==='cv'" class="visor-wrap">
        <div class="visor" v-if="cvActual">
          <div class="visor-bar">
            <Ic n="documentos" :s="16" /><b class="grow">{{ cvActual.nombre }}</b>
            <span v-if="cvActual.ext!=='pdf'" class="tag gold">Escaneado</span>
            <button class="icon-btn" @click="zoom=Math.max(.7, zoom-.15)" title="Alejar"><Ic n="minus" :s="16" /></button><span class="sub">{{ Math.round(zoom*100) }} %</span>
            <button class="icon-btn" @click="zoom=Math.min(1.6, zoom+.15)" title="Acercar"><Ic n="plus" :s="16" /></button>
            <button class="icon-btn" @click="demo('se descargaría el archivo original')" title="Descargar"><Ic n="download" :s="16" /></button>
          </div>
          <div class="visor-area">
            <div class="papel" :class="{escaneado: cvActual.ext!=='pdf'}" :style="{transform: 'scale('+zoom+')'}">
              <div class="papel-head"><div><h2>{{ c.nombre }} {{ c.apellidos }}</h2><p>{{ c.titulacion }}</p></div><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :s="56" /></div>
              <div class="papel-cols">
                <div><h4>Contacto</h4><p>{{ c.email }}<br>{{ c.tel }}<br>Madrid</p><h4>Idiomas</h4><i class="l" style="width:70%"></i><i class="l" style="width:55%"></i><h4>Herramientas</h4><i class="l" style="width:80%"></i><i class="l" style="width:60%"></i><i class="l" style="width:72%"></i></div>
                <div><h4>Formación</h4><p><b>{{ c.titulacion }}</b><br>{{ centroDe(c.centroId)?.nombre || 'Centro no indicado' }}</p><i class="l"></i><i class="l" style="width:85%"></i>
                  <h4>Experiencia</h4><i class="l" style="width:45%;height:9px"></i><i class="l"></i><i class="l" style="width:92%"></i><i class="l" style="width:64%"></i><i class="l" style="width:40%;height:9px;margin-top:12px"></i><i class="l"></i><i class="l" style="width:78%"></i>
                  <h4>Sobre mí</h4><i class="l"></i><i class="l" style="width:88%"></i><i class="l" style="width:52%"></i></div>
              </div>
              <span class="papel-pie">Documento de ejemplo · en la versión real aquí se ve el PDF original</span>
            </div>
          </div>
        </div>
        <aside class="visor-lado">
          <h4>Currículums de esta ficha</h4>
          <button v-for="d in docs.filter(x => x.tipo==='Currículum')" :key="d.id" class="doc-fila" :class="{on: cvActual && cvActual.id===d.id}" @click="cvSel=d.id"><Ic n="documentos" :s="16" /><span class="grow"><b>{{ d.nombre }}</b><small>{{ fCorta(d.fecha) }} · {{ tam(d.tam) }}</small></span></button>
          <Dropzone compacto texto="Soltar otro currículum" @archivos="subir($event, 'Currículum')" />
          <div class="ia-box">
            <div class="row"><Ic n="sparkles" :s="16" /><b>Lectura con IA</b><span class="tag">Fase posterior</span></div>
            <p class="sub">Propondrá nombre, contacto, formación e idiomas a partir del PDF. Siempre los revisa una persona antes de guardarlos.</p>
            <button class="btn btn-sm" disabled>Extraer datos del currículum</button>
          </div>
        </aside>
      </div>

      <!-- ENTREVISTA -->
      <div v-else-if="tab==='entrevista'" class="card-pad stack">
        <Vacio v-if="!ent" icono="calendario" titulo="Sin entrevista programada" texto="Programa la entrevista para poder valorarla después."><button class="btn btn-primary" style="margin-top:8px" @click="prog.abierto=true"><Ic n="calendario" :s="16" />Programar entrevista</button></Vacio>
        <template v-else>
          <div class="ent-cab">
            <div class="fecha-b grande"><small>{{ fLarga(ent.fecha).split(' ')[0] }}</small><b>{{ fCorta(ent.fecha) }}</b></div>
            <div class="grid3 grow">
              <div class="fld"><label>Fecha</label><input class="inp" type="date" v-model="ent.fecha" /></div>
              <div class="fld"><label>Hora</label><select class="inp" v-model="ent.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div>
              <div class="fld"><label>Modalidad</label><select class="inp" v-model="ent.modalidad"><option>Presencial</option><option>Online</option></select></div>
              <div class="fld"><label>Entrevistador/a (opcional)</label><select class="inp" v-model="ent.entrevistador"><option value="">Sin asignar</option><option v-for="p in ENTREVISTADORES" :key="p">{{ p }}</option></select></div>
              <div class="fld"><label>Estado de la cita</label><select class="inp" v-model="ent.estado"><option v-for="(v,k) in ESTADOS_CITA" :key="k">{{ k }}</option></select></div>
              <div class="fld"><label>Sincronización</label><span class="notion" style="align-self:flex-start;margin-top:6px"><Ic n="sync" :s="13" />Notion (bidireccional)</span></div>
            </div>
          </div>

          <div class="valoracion">
            <div class="val-crit">
              <h3>Valoración por criterios</h3>
              <div v-for="[k, t] in CRITERIOS" :key="k" class="crit">
                <div class="row"><b class="grow">{{ t }}</b><Nota :v="ent.criterios[k].n" /></div>
                <input type="range" min="0" max="10" step="0.5" :value="ent.criterios[k].n ?? 5" @input="ent.criterios[k].n = Number($event.target.value)" :class="{sin: ent.criterios[k].n==null}" />
                <input class="inp" v-model="ent.criterios[k].t" :placeholder="'Comentario sobre ' + t.toLowerCase()" />
              </div>
            </div>
            <div class="val-final">
              <h3>Valoración final</h3>
              <Nota :v="notaFinal ?? media" grande />
              <div class="fld"><label>Nota (0–10, admite medios puntos)</label><input class="inp" type="number" min="0" max="10" step="0.5" v-model.number="notaFinal" :placeholder="media!=null ? 'Media: ' + media : '—'" /></div>
              <button class="btn btn-sm" v-if="media!=null" @click="notaFinal=media">Usar la media de criterios ({{ String(media).replace('.', ',') }})</button>
              <div class="fld"><label>Observaciones de la entrevista</label><textarea class="inp" rows="4" v-model="ent.obs" placeholder="Impresión general, puntos fuertes, dudas…"></textarea></div>
              <button class="btn btn-primary" @click="guardarValoracion"><Ic n="check" :s="16" />Guardar valoración</button>
            </div>
          </div>

          <div>
            <div class="row" style="margin-bottom:10px"><h3>Preguntas y respuestas</h3><button class="btn btn-sm right" @click="addPregunta"><Ic n="plus" :s="14" />Añadir pregunta</button></div>
            <div v-for="(p,i) in ent.preguntas" :key="i" class="qa"><input class="inp" v-model="p.q" placeholder="Pregunta" /><textarea class="inp" v-model="p.a" rows="2" placeholder="Respuesta del candidato"></textarea></div>
            <p v-if="!ent.preguntas.length" class="sub">Aún no hay preguntas. Podrás guardar un guion de preguntas habituales en Ajustes.</p>
          </div>
        </template>
      </div>

      <!-- A FAVOR Y EN CONTRA -->
      <div v-else-if="tab==='pc'" class="card-pad stack">
        <p class="sub">Apunta aquí lo que te ha gustado y lo que te frena de esta persona, tanto de la entrevista como del currículum. Sirve para decidir con calma y para recordarlo cuando haya una nueva oportunidad.</p>
        <div class="pc-grid">
          <div class="pc-col pro">
            <div class="pc-head"><span class="pc-ico"><Ic n="plus" :s="16" /></span><h3>A favor</h3><span class="tag">{{ (c.pros || []).length }}</span></div>
            <ul><li v-for="(p, i) in (c.pros || [])" :key="p"><Ic n="check" :s="15" /><span class="grow">{{ p }}</span><button class="icon-btn" @click="quitarPC('pros', i)" title="Quitar"><Ic n="x" :s="14" /></button></li></ul>
            <p v-if="!(c.pros || []).length" class="sub">Todavía no hay puntos a favor.</p>
            <div class="row"><input class="inp" v-model="nuevo.pros" placeholder="Añadir punto a favor…" @keydown.enter="addPC('pros')" /><button class="btn btn-sm" @click="addPC('pros')"><Ic n="plus" :s="14" />Añadir</button></div>
          </div>
          <div class="pc-col con">
            <div class="pc-head"><span class="pc-ico"><Ic n="minus" :s="16" /></span><h3>En contra</h3><span class="tag">{{ (c.contras || []).length }}</span></div>
            <ul><li v-for="(p, i) in (c.contras || [])" :key="p"><Ic n="alert" :s="15" /><span class="grow">{{ p }}</span><button class="icon-btn" @click="quitarPC('contras', i)" title="Quitar"><Ic n="x" :s="14" /></button></li></ul>
            <p v-if="!(c.contras || []).length" class="sub">Todavía no hay puntos en contra.</p>
            <div class="row"><input class="inp" v-model="nuevo.contras" placeholder="Añadir punto en contra…" @keydown.enter="addPC('contras')" /><button class="btn btn-sm" @click="addPC('contras')"><Ic n="plus" :s="14" />Añadir</button></div>
          </div>
        </div>
      </div>

      <!-- DOCUMENTACIÓN -->
      <div v-else-if="tab==='docs'" class="card-pad stack">
        <Dropzone texto="Arrastra aquí convenios, anexos, justificantes o currículums" @archivos="subir($event)" />
        <div class="tbl-wrap"><table class="tbl sin-hover">
          <thead><tr><th>Documento</th><th>Tipo</th><th>Fecha</th><th>Tamaño</th><th></th></tr></thead>
          <tbody><tr v-for="d in docs" :key="d.id">
            <td><div class="row"><span class="ext" :class="d.ext">{{ d.ext }}</span><input class="inp nombre-doc" v-model="d.nombre" title="Haz clic para renombrar" /></div></td>
            <td><select class="inp" v-model="d.tipo" style="width:150px"><option v-for="t in TIPOS_DOC" :key="t">{{ t }}</option></select></td>
            <td class="nowrap">{{ fCompleta(d.fecha) }}</td><td class="nowrap">{{ tam(d.tam) }}</td>
            <td class="nowrap"><button class="icon-btn" title="Ver" @click="d.tipo==='Currículum' ? (cvSel=d.id, tab='cv') : demo('se abriría la vista previa del documento')"><Ic n="eye" :s="16" /></button><button class="icon-btn" title="Descargar" @click="demo('se descargaría el archivo')"><Ic n="download" :s="16" /></button><button class="icon-btn" title="Eliminar" @click="borrarDoc(d)"><Ic n="trash" :s="16" /></button></td>
          </tr></tbody></table></div>
        <p class="sub"><Ic n="lock" :s="13" /> Archivos privados: solo se abren con sesión iniciada y un enlace temporal, como en el CRM.</p>
      </div>

      <!-- HISTORIAL -->
      <div v-else-if="tab==='historial'" class="card-pad">
        <ol class="timeline">
          <li v-for="h in hist" :key="h.id" :class="h.tipo"><span class="t-ico"><Ic :n="ICONO_HIST[h.tipo] || 'info'" :s="14" /></span><div><b>{{ h.texto }}</b><small>{{ fCompleta(h.fecha) }} · {{ h.autor }}</small></div></li>
        </ol>
      </div>

      <!-- NOTAS INTERNAS -->
      <div v-else class="card-pad stack">
        <div class="aviso gold"><Ic n="lock" :s="16" /><span>Estas observaciones solo las ve el personal autorizado de la gestoría. Nunca se comparten con el candidato ni con el centro.</span></div>
        <div class="row" style="align-items:flex-start"><textarea class="inp grow" rows="2" v-model="nuevaNota" placeholder="Escribe una observación interna…" @keydown.ctrl.enter="addNota"></textarea><button class="btn btn-primary" @click="addNota">Añadir</button></div>
        <div v-for="n in notas" :key="n.id" class="nota-int"><Avatar :nombre="n.autor" apellidos="" :s="30" /><div><div class="row"><b>{{ n.autor }}</b><span class="sub">{{ fCompleta(n.fecha) }}</span></div><p>{{ n.texto }}</p></div></div>
        <p v-if="!notas.length" class="sub">Todavía no hay observaciones internas.</p>
      </div>
    </div>

    <Modal v-if="prog.abierto" titulo="Programar entrevista" @cerrar="prog.abierto=false">
      <div class="grid2">
        <div class="fld"><label>Fecha</label><input class="inp" type="date" v-model="prog.fecha" /></div>
        <div class="fld"><label>Hora</label><select class="inp" v-model="prog.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div>
        <div class="fld"><label>Modalidad</label><select class="inp" v-model="prog.modalidad"><option>Presencial</option><option>Online</option></select></div>
        <div class="fld"><label>Quién hace la entrevista (opcional)</label><select class="inp" v-model="prog.entrevistador"><option value="">Sin asignar</option><option v-for="p in ENTREVISTADORES" :key="p">{{ p }}</option></select></div>
      </div>
      <div class="aviso"><Ic n="sync" :s="16" /><span>La cita se creará también en Notion. Más adelante podrá avisar al candidato por WhatsApp o correo.</span></div>
      <template #pie><button class="btn" @click="prog.abierto=false">Cancelar</button><button class="btn btn-primary" @click="guardarProg">Programar</button></template>
    </Modal>

    <Modal v-if="inc.abierto" :titulo="est ? 'Editar incorporación' : 'Convertir en estudiante en prácticas'" :ancho="620" @cerrar="inc.abierto=false">
      <div class="aviso ok"><Ic n="check" :s="16" /><span>Se usa la misma ficha de <b>{{ nombreCompleto(c) }}</b>: no se duplica nada, solo se añaden los datos de las prácticas.</span></div>
      <div class="grid2">
        <div class="fld"><label>Fecha de inicio</label><input class="inp" type="date" v-model="inc.inicio" /></div>
        <div class="fld"><label>Fecha prevista de fin</label><input class="inp" type="date" v-model="inc.fin" /></div>
        <div class="fld"><label>Hora de entrada</label><input class="inp" type="time" v-model="inc.horaIni" /></div>
        <div class="fld"><label>Hora de salida</label><input class="inp" type="time" v-model="inc.horaFin" /></div>
        <div class="fld"><label>Horas totales</label><input class="inp" type="number" v-model.number="inc.horas" /></div>
        <div class="fld"><label>Tutor en la gestoría (opcional)</label><select class="inp" v-model="inc.tutor"><option value="">Sin tutor asignado</option><option v-for="a in ASESORES" :key="a">{{ a }}</option></select></div>
      </div>
      <label class="row"><input type="checkbox" v-model="inc.convenio" /> Convenio de prácticas firmado</label>
      <div class="aviso" :class="ocupacion.pasa ? 'err' : ''"><Ic :n="ocupacion.pasa ? 'alert' : 'info'" :s="16" /><span>Turno de <b>{{ ocupacion.t.toLowerCase() }}</b> el día de inicio: {{ ocupacion.n }} de {{ ocupacion.aforo }} plazas ocupadas.<template v-if="ocupacion.pasa"> <b>Con esta incorporación se supera el aforo supervisable.</b></template></span></div>
      <template #pie><button class="btn" @click="inc.abierto=false">Cancelar</button><button class="btn btn-accent" @click="guardarInc"><Ic n="estudiantes" :s="16" />{{ est ? 'Guardar' : 'Incorporar' }}</button></template>
    </Modal>
  </div>
  <div class="page" v-else><div class="card"><div class="vacio-box"><b>Candidato no encontrado</b><button class="btn" @click="go('candidatos')">Volver al listado</button></div></div></div>`,
};
