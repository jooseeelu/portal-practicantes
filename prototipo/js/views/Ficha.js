import { computed, reactive, ref, watch, onUnmounted } from "vue";
import { store, etiquetaTurno, candDe, centroDe, entrevistaDe, entrevistasDe, rondaDe, borrarCandidato, eliminarEntrevista, estudianteDe, docsDe, histDe, cambiarEstado, incorporar, programarEntrevista, addHist, toast, quitarToast, sePuedeDeshacer, deshacerCambio, nuevoId, nombreCompleto, estadoPracticas } from "../store.js";
import { ruta, go } from "../router.js";
import { elegirMensaje } from "../mensajes.js";
import { gentrivo, cargarGentrivo, enGentrivo, textoHoy, hoyEsCambio, proximosCambios, semana, DIAS_SEMANA, TIPO_CAMBIO } from "../gentrivo.js";
import { miNombre, sesion, subirArchivo, urlArchivo, borrarArchivo, leerCurriculum, registrar, esAdmin } from "../api.js";
import { recortarFoto } from "../cv.js";
import { RecorteFoto } from "../recorte.js";
import { Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio, leerFoto, pedirConfirmacion, OpcionesPersonas, SelectArea } from "../ui.js";
import { TURNOS, AREAS, ORIGENES, ENTREVISTADORES, ASESORES, HORAS_ENTREVISTA, ESTADOS_CITA } from "../data.js";
import { fCompleta, fCorta, fLarga, HOY_ISO, dia, relativo, turnoDe, normal, esFinde, urlWhatsApp } from "../util.js";

const CRITERIOS = [["conocimientos", "Conocimientos"], ["comunicacion", "Comunicación"], ["disponibilidad", "Disponibilidad"], ["adecuacion", "Adecuación al puesto"]];
const TIPOS_DOC = ["Currículum", "Convenio", "Anexo", "Justificante", "Otro"];
const ICONO_HIST = { alta: "plus", estado: "sync", entrevista: "calendario", valoracion: "star", incorporacion: "estudiantes", documento: "documentos", nota: "note" };

export default {
  components: { SelectArea, RecorteFoto, OpcionesPersonas, Ic, Chip, Avatar, Nota, Modal, SelectBuscable, Dropzone, Vacio },
  setup() {
    const c = computed(() => candDe(ruta.value.id));
    const tab = ref(store.fichaTab === "pc" ? "entrevista" : store.fichaTab || "personal"); store.fichaTab = "personal";
    // Entrevistas de la persona (1.ª, 2.ª…): se ve la elegida o, si no, la más reciente
    const entSel = ref(null);
    const ents = computed(() => (c.value ? entrevistasDe(c.value.id).slice().reverse() : []));
    const ent = computed(() => (c.value ? ents.value.find((e) => e.id === entSel.value) || entrevistaDe(c.value.id) : null));
    const est = computed(() => (c.value ? estudianteDe(c.value.id) : null));
    cargarGentrivo();
    const g = computed(() => (est.value ? enGentrivo(c.value) : null));
    // Vincular a mano con su persona de Gentrivo cuando no se encuentra sola (o se encuentra mal)
    const eligeG = ref(false);
    const opcionesG = computed(() => [...gentrivo.personas].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    const vincularG = (email) => {
      const p = gentrivo.personas.find((x) => x.email === email);
      c.value.gentrivo = email || "";
      eligeG.value = false;
      addHist(c.value.id, "nota", email === "-" ? "Marcado como sin ficha en Gentrivo" : p ? "Vinculado con Gentrivo: " + p.nombre : "Quitado el vínculo con Gentrivo");
      toast(email === "-" ? "Marcado: no está en Gentrivo" : p ? "Vinculado con Gentrivo" : "Vínculo quitado");
    };
    const docs = computed(() => (c.value ? docsDe(c.value.id) : []));
    const docsCentro = computed(() => (c.value && c.value.centroId ? store.documentos.filter((d) => !d.candId && String(d.centroId) === String(c.value.centroId)) : []));
    const hist = computed(() => (c.value ? histDe(c.value.id) : []));
    const notas = computed(() => store.notas.filter((n) => n.candId === c.value?.id).sort((a, b) => b.id - a.id));
    const cv = computed(() => docs.value.find((d) => d.tipo === "Currículum") || null);
    const cvSel = ref(null);
    const cvActual = computed(() => docs.value.find((d) => d.id === cvSel.value) || cv.value);
    const opCentros = computed(() => store.centros.filter((x) => !x.archivado).map((x) => ({ valor: x.id, etiqueta: x.nombre })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta)));
    const centroSel = computed({ get: () => c.value.centroId || "", set: (v) => { c.value.centroId = v || null; } });
    const tabs = computed(() => [
      { k: "personal", t: "Información personal", i: "user" }, { k: "formacion", t: "Formación", i: "estudiantes" }, { k: "cv", t: "Currículum", i: "documentos" },
      { k: "entrevista", t: "Entrevista", i: "entrevistas", n: (c.value.pros?.length || 0) + (c.value.contras?.length || 0) || null }, { k: "docs", t: "Documentación", i: "archive", n: docs.value.length },
      { k: "historial", t: "Historial", i: "history", n: hist.value.length }, { k: "notas", t: "Observaciones internas", i: "lock", n: notas.value.length },
    ]);
    const estadoSel = computed({ get: () => c.value.estado, set: (k) => cambiarEstado(c.value, k) });
    const zoom = ref(1);

    // --- Entrevista: programar y valorar ---
    const prog = reactive({ abierto: false, otra: false, fecha: dia(3), hora: "10:30", modalidad: "Presencial", entrevistador: "" });
    const guardarProg = () => { if (esFinde(prog.fecha)) return toast("Ese día es fin de semana. Elige un día de lunes a viernes.", "error"); const e = programarEntrevista(c.value, prog); entSel.value = e?.id || null; prog.abierto = false; prog.otra = false; tab.value = "entrevista"; };
    const otraEntrevista = () => Object.assign(prog, { abierto: true, otra: true, fecha: dia(3), entrevistador: "" });
    // Valoración en BORRADOR: lo que se toca aquí no se guarda hasta pulsar «Guardar valoración» (o se descarta)
    const vacioCrit = () => Object.fromEntries(CRITERIOS.map(([k]) => [k, { n: null, t: "" }]));
    const bor = reactive({ criterios: vacioCrit(), obs: "", nota: null, de: null });
    const original = () => ({ criterios: JSON.parse(JSON.stringify(ent.value?.criterios || vacioCrit())), obs: ent.value?.obs || "", nota: c.value?.nota ?? null });
    function cargarBorrador() { const o = original(); Object.assign(bor, { ...o, de: ent.value?.id ?? null }); }
    watch(() => ent.value && ent.value.id, cargarBorrador, { immediate: true });
    const cambiosVal = computed(() => {
      if (!ent.value) return 0;
      const o = original(); let n = 0;
      for (const [k] of CRITERIOS) { if ((bor.criterios[k]?.n ?? null) !== (o.criterios[k]?.n ?? null)) n++; if ((bor.criterios[k]?.t || "") !== (o.criterios[k]?.t || "")) n++; }
      if ((bor.obs || "") !== o.obs) n++;
      if ((bor.nota ?? null) !== (o.nota ?? null)) n++;
      return n;
    });
    const ponerNota = (n) => { bor.nota = bor.nota === n ? n - 0.5 : n; };
    const notaEscrita = (ev) => { const v = ev.target.value === "" ? null : Number(String(ev.target.value).replace(",", ".")); if (v === null) bor.nota = null; else if (!isNaN(v) && v >= 0 && v <= 10) bor.nota = v; };
    const etiquetaNota = (v) => (v >= 9 ? "Excelente" : v >= 8 ? "Muy buena" : v >= 7 ? "Buena" : v >= 6 ? "Correcta" : v >= 5 ? "Justa" : "Floja");
    const descartarValoracion = () => { cargarBorrador(); toast("Cambios descartados"); };
    const elegirRonda = async (id) => {
      if (cambiosVal.value && !(await pedirConfirmacion({ titulo: "Hay cambios sin guardar", texto: "La valoración de esta entrevista tiene cambios sin guardar. Si cambias de entrevista se descartan.", boton: "Descartar y cambiar" }))) return;
      entSel.value = id;
    };
    const quitarCriterio = (k) => { bor.criterios[k] = { n: null, t: "" }; };
    const borrarValoracion = async () => {
      if (!(await pedirConfirmacion({ titulo: "¿Borrar la valoración?", texto: "Se quitan las notas y comentarios de los criterios de esta entrevista y la nota final de la ficha.", boton: "Borrar valoración" }))) return;
      const copia = { criterios: JSON.parse(JSON.stringify(ent.value.criterios)), obs: ent.value.obs, nota: c.value.nota };
      ent.value.criterios = vacioCrit();
      const tenia = c.value.nota;
      c.value.nota = null;
      if (tenia != null) addHist(c.value.id, "valoracion", "Valoración borrada", miNombre(), { cambio: { campo: "nota", antes: tenia, despues: null } });
      cargarBorrador();
      const e = ent.value;
      toast("Valoración borrada", "ok", { t: "Deshacer", f: () => { e.criterios = copia.criterios; e.obs = copia.obs; c.value.nota = copia.nota; cargarBorrador(); } });
    };
    const media = computed(() => { const v = CRITERIOS.map(([k]) => bor.criterios[k]?.n).filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 2) / 2 : null; });
    const notaFinal = computed({ get: () => bor.nota, set: (v) => { bor.nota = v === "" || v == null ? null : Number(v); } });
    const guardarValoracion = () => {
      const v = bor.nota ?? media.value;
      if (v == null) return toast("Elige una nota del 1 al 10.", "error");
      const antes = c.value.nota ?? null;
      ent.value.criterios = JSON.parse(JSON.stringify(bor.criterios));
      ent.value.obs = bor.obs;
      c.value.nota = Number(v);
      ent.value.estado = "Realizada";
      addHist(c.value.id, "valoracion", `Valoración final: ${String(v).replace(".", ",")}/10`, ent.value.entrevistador || miNombre(), { cambio: { campo: "nota", antes, despues: Number(v) } });
      if (["entrevista-programada", "entrevistado", "pendiente-entrevista"].includes(c.value.estado)) cambiarEstado(c.value, "en-valoracion", { silencioso: true });
      cargarBorrador();
      toast("Valoración guardada");
    };
    // Al salir de la página con la valoración a medias, el navegador avisa
    const avisoSalir = (e) => { if (cambiosVal.value) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", avisoSalir);
    onUnmounted(() => window.removeEventListener("beforeunload", avisoSalir));
    const addPregunta = () => ent.value.preguntas.push({ q: "", a: "" });

    // --- Documentos ---
    // Con servidor, el archivo se sube de verdad (colección «archivos», protegido); en la demo solo se anota.
    const enServidor = () => sesion.modo === "servidor";
    const EXT_OK = /\.(pdf|docx?|jpe?g|png|webp)$/i;
    const subiendo = ref(0);
    async function subir(files, tipo = "Otro") {
      let hechos = 0;
      for (const f of files) {
        if (docs.value.find((d) => d.nombre === f.name)) { toast(`«${f.name}» ya está en esta ficha: no se duplica.`, "error"); continue; }
        const tipoDoc = /cv|curr/i.test(f.name) || tipo === "Currículum" ? "Currículum" : tipo;
        const ahora = new Date();
        const doc = { id: nuevoId(), candId: c.value.id, nombre: f.name, tipo: tipoDoc, fecha: HOY_ISO, hora: ahora.toTimeString().slice(0, 5), por: miNombre(), tam: Math.max(1, Math.round(f.size / 1024)), ext: f.name.split(".").pop().toLowerCase() };
        if (enServidor()) {
          if (!EXT_OK.test(f.name)) { toast(`«${f.name}»: solo se admiten PDF, Word o imágenes.`, "error"); continue; }
          if (f.size > 20 * 1024 * 1024) { toast(`«${f.name}» pesa más de 20 MB.`, "error"); continue; }
          subiendo.value++;
          try { const r = await subirArchivo(f, { candId: c.value.id, tipo: tipoDoc, nombre: f.name }); doc.archivoId = r.id; doc.archivo = r.archivo; }
          catch (e) { toast(`No se pudo subir «${f.name}»: ${e.message}`, "error"); continue; }
          finally { subiendo.value--; }
        }
        store.documentos.push(doc);
        addHist(c.value.id, "documento", `Documento añadido: ${f.name}`);
        if (tipoDoc === "Currículum") { c.value.cv = true; cvSel.value = doc.id; }
        hechos++;
      }
      if (hechos) toast(hechos > 1 ? `${hechos} archivos añadidos` : "Archivo añadido");
      // Currículum nuevo: se lee solo y rellena lo que falte en la ficha (y la foto si no tiene)
      if (hechos && cvActual.value?.archivoId && files.some((f) => f.name === cvActual.value.nombre) && puedeLeerIA.value) leerAuto();
    }
    // Visor del currículum y apertura/descarga de archivos reales (con enlace temporal)
    const urlVisor = ref(""), errorVisor = ref("");
    watch(() => cvActual.value && cvActual.value.archivoId, async () => {
      urlVisor.value = ""; errorVisor.value = "";
      const d = cvActual.value;
      if (!d || !d.archivoId || !enServidor()) return;
      try { urlVisor.value = await urlArchivo(d); } catch (e) { errorVisor.value = e.message; }
    }, { immediate: true });
    async function abrirArchivo(d, descargar = false) {
      try { window.open(await urlArchivo(d, { descargar }), "_blank", "noopener"); }
      catch (e) { toast(`No se pudo abrir el archivo: ${e.message}`, "error"); }
    }
    const borrarDoc = (d) => {
      store.documentos = store.documentos.filter((x) => x.id !== d.id);
      addHist(c.value.id, "documento", `Documento eliminado: ${d.nombre}`);
      let deshecho = false;
      // El archivo del servidor se borra cuando ya no se puede deshacer
      const t = setTimeout(() => { if (!deshecho && d.archivoId && enServidor()) borrarArchivo(d.archivoId).catch(() => {}); }, 9000);
      toast(`«${d.nombre}» eliminado`, "ok", { t: "Deshacer", f: () => { deshecho = true; clearTimeout(t); store.documentos.push(d); addHist(d.candId, "documento", `Documento recuperado: ${d.nombre}`); } });
    };
    const tam = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB");

    // --- Notas internas ---
    const nuevaNota = ref("");
    const addNota = () => { if (!nuevaNota.value.trim()) return; store.notas.push({ id: nuevoId(), candId: c.value.id, autor: miNombre(), fecha: HOY_ISO, texto: nuevaNota.value.trim() }); addHist(c.value.id, "nota", "Nueva observación interna"); nuevaNota.value = ""; };

    // --- Faltas de asistencia (si se recupera el día, el fin se alarga un día laborable) ---
    const falta = reactive({ fecha: HOY_ISO, motivo: "", recupera: true });
    const sigLaborable = (f) => { let d = dia(1, f); while ([0, 6].includes(new Date(d + "T12:00").getDay())) d = dia(1, d); return d; };
    const antLaborable = (f) => { let d = dia(-1, f); while ([0, 6].includes(new Date(d + "T12:00").getDay())) d = dia(-1, d); return d; };
    const addFalta = () => {
      const e = est.value; if (!e || !falta.fecha) return;
      const l = (e.faltas ||= []);
      if (l.some((x) => x.fecha === falta.fecha)) return toast("Esa falta ya está apuntada.", "error");
      if (falta.fecha < e.inicio || falta.fecha > e.fin) return toast("Ese día está fuera del periodo de prácticas.", "error");
      l.push({ fecha: falta.fecha, motivo: falta.motivo.trim(), recupera: falta.recupera });
      l.sort((a, b) => a.fecha.localeCompare(b.fecha));
      if (falta.recupera) e.fin = sigLaborable(e.fin);
      addHist(c.value.id, "nota", `Falta el ${fCorta(falta.fecha)}${falta.motivo.trim() ? " (" + falta.motivo.trim() + ")" : ""}${falta.recupera ? "; se recupera: el fin pasa al " + fCorta(e.fin) : "; no se recupera"}`);
      toast(falta.recupera ? `Falta apuntada. Termina el ${fCorta(e.fin)}` : "Falta apuntada");
      falta.motivo = "";
    };
    const quitarFalta = (x) => {
      const e = est.value; e.faltas = e.faltas.filter((y) => y !== x);
      if (x.recupera) e.fin = antLaborable(e.fin);
      addHist(c.value.id, "nota", `Falta del ${fCorta(x.fecha)} eliminada`);
    };

    // --- Convertir en estudiante ---
    const inc = reactive({ abierto: false, inicio: dia(10), fin: dia(70), horaIni: "10:00", horaFin: "15:00", horas: 340, tutor: "", convenio: false });
    const abrirInc = () => {
      const e = est.value, t = ["Tarde", "Tarde 2"].includes(c.value.turno) ? c.value.turno : "Mañana";
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
    const editarPC = (tipo, i, ev) => {
      const t = ev.target.value.trim(), antes = c.value[tipo][i];
      if (!t) { ev.target.value = antes; return; }
      if (t === antes) return;
      c.value[tipo][i] = t;
      addHist(c.value.id, "nota", (tipo === "pros" ? "Punto a favor cambiado: " : "Punto en contra cambiado: ") + antes + " → " + t);
    };
    // Foto de la persona (se recorta en cuadrado al subirla)
    const ponerFoto = async (ev) => {
      const archivo = ev.target.files[0]; ev.target.value = "";
      try { c.value.foto = await leerFoto(archivo); addHist(c.value.id, "documento", "Foto de perfil actualizada"); toast("Foto actualizada"); } catch (e) { toast(e.message, "error"); }
    };
    // Foto en grande: cambiar o eliminar (con confirmación)
    const fotoAbierta = ref(false);
    const quitarFoto = async () => {
      if (!(await pedirConfirmacion({ titulo: "¿Eliminar la foto?", texto: "En su lugar se verán las iniciales. Podrás poner otra cuando quieras o volver a buscarla en su currículum.", boton: "Sí, eliminar" }))) return;
      c.value.foto = ""; fotoAbierta.value = false;
      addHist(c.value.id, "documento", "Foto eliminada");
      toast("Foto eliminada");
    };
    const cambiarFoto = async (ev) => { await ponerFoto(ev); fotoAbierta.value = false; };
    // Recorte manual de la foto sobre el currículum (la IA coloca el recuadro de partida)
    const recorte = reactive({ abierto: false, archivo: null, caja: null, buscando: false });
    async function abrirRecorte() {
      const d = cvActual.value;
      if (!d || !d.archivoId || !/^(pdf|jpe?g|png|webp)$/.test(d.ext || "")) return toast("Sube primero el currículum en PDF o imagen.", "error");
      fotoAbierta.value = false;
      try { const blob = await (await fetch(await urlArchivo(d))).blob(); recorte.archivo = new File([blob], d.nombre, { type: d.ext === "pdf" ? "application/pdf" : blob.type || "image/" + d.ext }); }
      catch (_) { return toast("No se pudo abrir el currículum.", "error"); }
      Object.assign(recorte, { abierto: true, caja: null, buscando: true });
      leerCurriculum(d.archivoId).then((r) => { if (recorte.abierto && r.foto) recorte.caja = r.foto; }).catch(() => {}).finally(() => { recorte.buscando = false; });
    }
    // Encuadre automático: busca la cara en el currículum y recorta centrado (sin IA de pago)
    const encuadrando = ref(false);
    async function encuadrarSola() {
      const d = cvActual.value;
      if (!d || !d.archivoId || !/^(pdf|jpe?g|png|webp)$/.test(d.ext || "")) return toast("Sube primero el currículum en PDF o imagen.", "error");
      encuadrando.value = true;
      try {
        const blob = await (await fetch(await urlArchivo(d))).blob();
        const foto = await recortarFoto(new File([blob], d.nombre, { type: d.ext === "pdf" ? "application/pdf" : blob.type || "image/" + d.ext }), null, { soloConCara: true });
        if (!foto) return toast("No se ha encontrado la cara en el currículum. Recórtala a mano.", "error");
        c.value.foto = foto; addHist(c.value.id, "documento", "Foto puesta desde el currículum (encuadre automático)"); toast("Foto encuadrada");
      } catch (e) { toast("No se pudo abrir el currículum: " + e.message, "error"); }
      finally { encuadrando.value = false; }
    }
    const usarRecorte = (url) => { c.value.foto = url; recorte.abierto = false; addHist(c.value.id, "documento", "Foto recortada del currículum"); toast("Foto actualizada"); };
    const buscarFotoCv = abrirRecorte;

    // --- Lectura del currículum con IA: propone datos y una persona decide cuáles aplicar ---
    const CAMPOS_IA = [["nombre", "Nombre"], ["apellidos", "Apellidos"], ["email", "Correo electrónico"], ["tel", "Teléfono"], ["titulacion", "Titulación"], ["curso", "Curso"], ["idiomas", "Idiomas"], ["herramientas", "Herramientas"], ["experiencia", "Experiencia previa"]];
    const ia = reactive({ abierto: false, cargando: false, error: "", campos: [], avisos: [], centro: "", centroId: "", usarCentro: false, otros: [], doc: "", foto: "", usarFoto: false });
    const puedeLeerIA = computed(() => enServidor() && !!cvActual.value?.archivoId && /^(pdf|jpe?g|png|webp)$/.test(cvActual.value.ext || ""));
    async function leerConIA() {
      const d = cvActual.value; if (!d || ia.cargando) return;
      Object.assign(ia, { abierto: true, cargando: true, error: "", campos: [], avisos: [], centro: "", centroId: "", usarCentro: false, otros: [], doc: d.nombre, foto: "", usarFoto: false });
      try {
        const r = await leerCurriculum(d.archivoId);
        const x = r.datos || {};
        ia.campos = CAMPOS_IA.map(([k, etq]) => ({ k, etq, actual: String(c.value[k] ?? ""), nuevo: x[k] || "" }))
          .filter((f) => f.nuevo && normal(f.nuevo) !== normal(f.actual)).map((f) => ({ ...f, usar: !f.actual }));
        if (x.centro) {
          const n = normal(x.centro);
          const m = store.centros.find((ce) => !ce.archivado && (normal(ce.nombre) === n || (normal(ce.nombre).length > 3 && (n.includes(normal(ce.nombre)) || normal(ce.nombre).includes(n)))));
          ia.centro = x.centro; ia.centroId = m && m.id !== c.value.centroId ? m.id : ""; ia.usarCentro = !!ia.centroId && !c.value.centroId;
        }
        ia.otros = [["Localidad", x.localidad], ["Disponibilidad", x.disponibilidad]].filter(([, v]) => v);
        ia.avisos = r.avisos || [];
        if (r.foto) {
          try {
            const blob = await (await fetch(await urlArchivo(d))).blob();
            const tipo = d.ext === "pdf" ? "application/pdf" : blob.type || "image/" + d.ext;
            ia.foto = await recortarFoto(new File([blob], d.nombre, { type: tipo }), r.foto);
            ia.usarFoto = !!ia.foto && !c.value.foto;
          } catch (_) { /* sin foto: no impide aplicar el resto */ }
        }
        registrar("Leyó un currículum con IA", d.nombre);
      } catch (e) { ia.error = e.message; } finally { ia.cargando = false; }
    }
    // Lectura automática al subir el currículum: solo rellena lo que esté vacío; no pregunta
    const auto = reactive({ cargando: false });
    async function leerAuto() {
      const d = cvActual.value; if (!d || auto.cargando) return;
      auto.cargando = true;
      try {
        const r = await leerCurriculum(d.archivoId);
        const x = r.datos || {};
        const puestos = [];
        for (const [k, etq] of [...CAMPOS_IA, ["area", "Área"]]) if (x[k] && !String(c.value[k] ?? "").trim()) { c.value[k] = x[k]; puestos.push(etq.toLowerCase()); }
        if (x.centro && !c.value.centroId) {
          const n = normal(x.centro);
          const m = store.centros.find((ce) => !ce.archivado && (normal(ce.nombre) === n || (normal(ce.nombre).length > 3 && (n.includes(normal(ce.nombre)) || normal(ce.nombre).includes(n)))));
          if (m) { c.value.centroId = m.id; puestos.push("centro"); }
        }
        if (r.foto && !c.value.foto) {
          try {
            const blob = await (await fetch(await urlArchivo(d))).blob();
            const foto = await recortarFoto(new File([blob], d.nombre, { type: d.ext === "pdf" ? "application/pdf" : blob.type || "image/" + d.ext }), r.foto);
            if (foto) { c.value.foto = foto; puestos.push("foto"); }
          } catch (_) { /* sin foto */ }
        }
        if (puestos.length) { addHist(c.value.id, "documento", "Rellenado desde el currículum: " + puestos.join(", ")); toast("Rellenado desde el currículum: " + puestos.join(", ")); }
        else toast("Currículum leído: la ficha ya tenía todos esos datos");
        registrar("Leyó un currículum con IA", d.nombre);
      } catch (e) { toast("No se pudo leer el currículum: " + e.message, "error"); }
      finally { auto.cargando = false; }
    }
    function aplicarIA() {
      const usados = ia.campos.filter((f) => f.usar);
      usados.forEach((f) => { c.value[f.k] = f.nuevo; });
      const conCentro = ia.usarCentro && ia.centroId;
      if (conCentro) c.value.centroId = ia.centroId;
      const conFoto = ia.usarFoto && ia.foto;
      if (conFoto) c.value.foto = ia.foto;
      const n = usados.length + (conCentro ? 1 : 0) + (conFoto ? 1 : 0);
      if (n) {
        addHist(c.value.id, "documento", "Datos rellenados desde el currículum con IA: " + [...usados.map((f) => f.etq.toLowerCase()), ...(conCentro ? ["centro"] : []), ...(conFoto ? ["foto"] : [])].join(", "));
        toast(n > 1 ? n + " datos aplicados a la ficha" : "Dato aplicado a la ficha");
      }
      ia.abierto = false;
    }
    // --- Contacto directo desde la ficha ---
    const abrirWhatsApp = (ev) => elegirMensaje("whatsapp", c.value, ev);
    const abrirCorreo = (ev) => elegirMensaje("correo", c.value, ev);
    const borrarFicha = async () => {
      const nom = nombreCompleto(c.value);
      if (!(await pedirConfirmacion({ titulo: "¿Borrar a " + nom + "?", texto: "Se borra su ficha con sus entrevistas, valoraciones, documentos (también los archivos), historial y notas. No se puede deshacer. Si solo no sigue en el proceso, mejor cambia su estado a «Cancelado» o «Candidatura retirada».", boton: "Borrar para siempre" }))) return;
      const archivos = borrarCandidato(c.value);
      if (enServidor()) archivos.forEach((a) => borrarArchivo(a).catch(() => {}));
      registrar("Borró la ficha de un candidato", nom);
      toast("Ficha de " + nom + " borrada");
      go("candidatos");
    };
    const deshacerHist = (h) => { if (deshacerCambio(h)) toast("Cambio deshecho"); };
    const borrarCv = async (d) => {
      if (!(await pedirConfirmacion({ titulo: "¿Borrar este currículum?", texto: "«" + d.nombre + "» se quita de la ficha. Los datos que ya se rellenaron con él se quedan.", boton: "Borrar currículum" }))) return;
      borrarDoc(d);
      if (cvSel.value === d.id) cvSel.value = null;
    };
    const borrarEsta = async () => { if (ent.value && (await eliminarEntrevista(ent.value))) entSel.value = null; };
    const borrarNota = async (n) => {
      if (!(await pedirConfirmacion({ titulo: "¿Borrar esta observación?", texto: "Se quita de las observaciones internas de esta persona.", boton: "Borrar" }))) return;
      const i = store.notas.findIndex((x) => x.id === n.id);
      if (i >= 0) store.notas.splice(i, 1);
      addHist(c.value.id, "nota", "Observación interna borrada");
      toast("Observación borrada");
    };
    return { encuadrando, encuadrarSola, docsCentro, borrarNota, miNombre, recorte, abrirRecorte, usarRecorte, auto, leerAuto, borrarCv, borrarEsta, notaEscrita, fotoAbierta, cambiarFoto, buscarFotoCv, ponerNota, etiquetaNota, bor, cambiosVal, descartarValoracion, elegirRonda, deshacerHist, sePuedeDeshacer, esAdmin, borrarFicha, entSel, ents, rondaDe, otraEntrevista, quitarCriterio, borrarValoracion, eligeG, opcionesG, vincularG, gentrivo, g, textoHoy, hoyEsCambio, proximosCambios, semana, DIAS_SEMANA, TIPO_CAMBIO, abrirWhatsApp, abrirCorreo, ia, puedeLeerIA, leerConIA, aplicarIA, falta, addFalta, quitarFalta, etiquetaTurno, store, c, tab, tabs, ent, est, docs, hist, notas, cv, cvSel, cvActual, opCentros, centroSel, estadoSel, zoom, prog, guardarProg, media, notaFinal, guardarValoracion, addPregunta,
      subir, borrarDoc, tam, enServidor, subiendo, urlVisor, errorVisor, abrirArchivo, nuevo, addPC, quitarPC, editarPC, ponerFoto, quitarFoto, nuevaNota, addNota, inc, abrirInc, ocupacion, guardarInc, demo, go, centroDe, nombreCompleto, estadoPracticas,
      CRITERIOS, TIPOS_DOC, ICONO_HIST, TURNOS, AREAS, ORIGENES, ENTREVISTADORES, ASESORES, HORAS_ENTREVISTA, ESTADOS_CITA, fCompleta, fCorta, fLarga, relativo };
  },
  template: `
  <div class="page" v-if="c">
    <a class="volver" @click="go('candidatos')"><Ic n="chevL" :s="15" />Candidatos</a>

    <div class="card ficha-head">
      <div class="foto-col">
        <button v-if="c.foto" type="button" class="foto-edit" title="Ver la foto" aria-label="Ver la foto en grande" @click="fotoAbierta = true"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :foto="c.foto" :s="84" /><span class="camara"><Ic n="search" :s="14" /></span></button>
        <label v-else class="foto-edit" title="Poner una foto"><Avatar :nombre="c.nombre" :apellidos="c.apellidos" :foto="c.foto" :s="84" /><span class="camara"><Ic n="camara" :s="15" /></span><input type="file" accept="image/*" hidden @change="ponerFoto" /></label>
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
          <button class="btn btn-sm" @click="abrirWhatsApp($event)" :disabled="!c.tel" :title="c.tel ? 'Abrir un chat de WhatsApp con ' + c.nombre : 'Falta el teléfono en la ficha'"><Ic n="whatsapp" :s="15" />WhatsApp</button>
          <button class="btn btn-sm" @click="abrirCorreo($event)" :disabled="!c.email" :title="c.email ? 'Escribir un correo a ' + c.email : 'Falta el correo en la ficha'"><Ic n="mail" :s="15" />Correo</button>
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
          <div class="fld"><label>Área de interés</label><SelectArea v-model="c.area" :areas="AREAS" /></div>
          <div class="fld"><label>Turno disponible</label><select class="inp" v-model="c.turno"><option v-for="t in TURNOS" :key="t" :value="t">{{ etiquetaTurno(t) }}</option></select></div>
        <div v-if="c.turno==='Horario personalizado'" class="fld" style="grid-column:1/-1"><label>Horario personalizado</label><input class="inp" v-model="c.horarioLibre" placeholder="Ej.: lunes y miércoles de 9 a 13, resto de la semana por la tarde" /></div>
          <div class="fld"><label>Duración prevista (horas)</label><input class="inp" type="number" v-model="c.horas" /></div>
          <div class="fld"><label>Registrado el</label><input class="inp" :value="fCompleta(c.creado)" disabled /></div>
        </div>
        <div v-if="est" class="practicas-box">
          <div class="row"><Ic n="estudiantes" /><b>Prácticas en la gestoría</b><Chip :texto="estadoPracticas(est)" c="var(--cyan)" cd="var(--cyan-dark)" /><button class="btn btn-sm right" @click="abrirInc"><Ic n="pencil" :s="14" />Editar</button></div>
          <div class="datos"><div><span>Inicio</span><b>{{ fCompleta(est.inicio) }}</b></div><div><span>Fin previsto</span><b>{{ fCompleta(est.fin) }}</b></div><div><span>Horario</span><b>{{ est.horaIni }}–{{ est.horaFin }}</b></div><div><span>Horas totales</span><b>{{ est.horas }} h</b></div><div><span>Tutor en la gestoría</span><b v-if="est.tutor">{{ est.tutor }}</b><b v-else class="muted">Sin asignar</b></div><div><span>Convenio</span><b>{{ est.convenio ? 'Firmado' : 'Pendiente de firma' }}</b></div></div>
          <div v-if="g" class="gentrivo-box">
            <div class="row"><Ic n="clock" :s="16" /><b>Horario en Gentrivo</b><span class="sub">· {{ g.nombre }}</span><button class="btn-link right" @click="eligeG = !eligeG">{{ eligeG ? 'Cancelar' : 'No es esta persona' }}</button></div>
            <div v-if="eligeG" class="vincular-g"><select class="inp" @change="vincularG($event.target.value)"><option value="">Elige su persona en Gentrivo…</option><option v-for="p in opcionesG" :key="p.email" :value="p.email">{{ p.nombre }} · {{ p.email }}</option><option value="-">No está en Gentrivo</option></select></div>
            <div class="row"><span class="sub"><span class="sub">Hoy: <b>{{ textoHoy(g) }}</b><template v-if="hoyEsCambio(g) && g.hoy.motivo"> · {{ g.hoy.motivo }}</template></span></div>
            <div class="semana-g"><span v-for="d in semana(g)" :key="d.dia" :class="{libre: !d.trabaja}"><small>{{ DIAS_SEMANA[d.dia].slice(0, 3) }}</small><b>{{ d.trabaja ? d.ini + '–' + d.fin : 'Libre' }}</b></span></div>
            <div v-if="proximosCambios(g).length" class="cambios-g"><b class="sub">Cambios apuntados</b>
              <div v-for="x in proximosCambios(g)" :key="x.fecha" class="falta"><span><b>{{ fLarga(x.fecha) }}</b> · {{ (TIPO_CAMBIO[x.tipo] || x.tipo) + (x.ini ? " " + x.ini + "–" + x.fin : "") }}<template v-if="x.motivo"> · {{ x.motivo }}</template></span></div>
            </div>
            <p class="sub">Los cambios de horario (exámenes, días libres) se apuntan en Gentrivo y aparecen aquí.</p>
          </div>
          <div v-else-if="gentrivo.configurado && gentrivo.cargado" class="gentrivo-box">
            <div class="row"><Ic n="clock" :s="16" /><b>Horario en Gentrivo</b><span v-if="c.gentrivo === '-'" class="sub">· Marcado como que no está en Gentrivo</span></div>
            <p class="sub">{{ c.gentrivo === '-' ? 'Si ya tiene ficha en Gentrivo, elígela:' : 'No se ha encontrado sola (ni por correo ni por nombre). Elige su persona en Gentrivo y se verá su horario:' }}</p>
            <div class="vincular-g"><select class="inp" @change="vincularG($event.target.value)"><option value="">Elige su persona en Gentrivo…</option><option v-for="p in opcionesG" :key="p.email" :value="p.email">{{ p.nombre }} · {{ p.email }}</option><option v-if="c.gentrivo !== '-'" value="-">No está en Gentrivo</option></select></div>
          </div>
          <div class="faltas">
            <b>Faltas de asistencia <span class="sub">({{ (est.faltas || []).length }})</span></b>
            <div v-for="x in est.faltas || []" :key="x.fecha" class="falta"><span><b>{{ fLarga(x.fecha) }}</b><template v-if="x.motivo"> · {{ x.motivo }}</template></span><Chip :texto="x.recupera ? 'Se recupera (+1 día)' : 'No se recupera'" :c="x.recupera ? 'var(--gold-500)' : 'var(--text-400)'" :cd="x.recupera ? 'var(--gold-700)' : 'var(--text-600)'" /><button class="btn btn-sm" @click="quitarFalta(x)">Quitar</button></div>
            <div class="falta-nueva"><input class="inp" type="date" v-model="falta.fecha" :min="est.inicio" :max="est.fin" /><input class="inp" v-model="falta.motivo" placeholder="Motivo (opcional)" @keydown.enter="addFalta" /><label class="check"><input type="checkbox" v-model="falta.recupera" /> Recupera el día (termina 1 día más tarde)</label><button class="btn" @click="addFalta"><Ic n="plus" :s="15" />Apuntar falta</button></div>
          </div>
        </div>
        <p class="sub"><Ic n="check" :s="13" /> Los cambios se guardan solos al escribir.</p>
        <div v-if="esAdmin()" class="zona-peligro"><div><b>Borrar esta ficha</b><span class="sub">Solo administración. Borra a la persona y todo lo suyo; no se puede deshacer.</span></div><button class="btn btn-peligro" @click="borrarFicha"><Ic n="trash" :s="15" />Borrar candidato</button></div>
      </div>

      <!-- FORMACIÓN -->
      <div v-else-if="tab==='formacion'" class="card-pad stack">
        <div class="grid2">
          <div class="fld"><label>Centro educativo</label><SelectBuscable v-model="centroSel" :opciones="opCentros" etiqueta-todos="Sin centro (autopostulado)" /></div>
          <div class="fld"><label>Titulación</label><input class="inp" v-model="c.titulacion" list="dl-prog" /><datalist id="dl-prog"><option v-for="p in (centroDe(c.centroId)?.programas || [])" :key="p" :value="p" /></datalist></div>
          <div class="fld"><label>Curso</label><input class="inp" v-model="c.curso" placeholder="2.º" /></div>
          <div class="fld"><label>Especialidad / área</label><SelectArea v-model="c.area" :areas="AREAS" /></div>
          <div class="fld"><label>Idiomas</label><input class="inp" v-model="c.idiomas" placeholder="Inglés (B2), francés (básico)…" /></div>
          <div class="fld"><label>Herramientas</label><input class="inp" v-model="c.herramientas" placeholder="Excel, Word, Canva…" /></div>
          <div class="fld" style="grid-column:1/-1"><label>Experiencia previa</label><textarea class="inp" v-model="c.experiencia" rows="2" placeholder="Prácticas o trabajos anteriores"></textarea></div>
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
            <template v-if="cvActual.archivoId">
              <button class="icon-btn" @click="abrirArchivo(cvActual)" title="Abrir en otra pestaña"><Ic n="link" :s="16" /></button>
              <button class="icon-btn" @click="abrirArchivo(cvActual, true)" title="Descargar"><Ic n="download" :s="16" /></button>
            </template>
            <template v-else-if="!enServidor()">
              <span v-if="cvActual.ext!=='pdf'" class="tag gold">Escaneado</span>
              <button class="icon-btn" @click="zoom=Math.max(.7, zoom-.15)" title="Alejar"><Ic n="minus" :s="16" /></button><span class="sub">{{ Math.round(zoom*100) }} %</span>
              <button class="icon-btn" @click="zoom=Math.min(1.6, zoom+.15)" title="Acercar"><Ic n="plus" :s="16" /></button>
              <button class="icon-btn" @click="demo('se descargaría el archivo original')" title="Descargar"><Ic n="download" :s="16" /></button>
            </template>
          </div>
          <div v-if="cvActual.archivoId" class="visor-area visor-real">
            <iframe v-if="urlVisor && cvActual.ext==='pdf'" :src="urlVisor + '#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH'" title="Currículum"></iframe>
            <img v-else-if="urlVisor && /^(jpe?g|png|webp)$/.test(cvActual.ext)" :src="urlVisor" alt="Currículum escaneado" class="visor-img" />
            <div v-else-if="urlVisor" class="vacio-box"><Ic n="documentos" :s="30" /><b>Documento de Word</b><span>El navegador no puede mostrarlo dentro de la ficha.</span><button class="btn btn-primary" @click="abrirArchivo(cvActual, true)"><Ic n="download" :s="15" />Descargar</button></div>
            <div v-else-if="errorVisor" class="vacio-box"><Ic n="alert" :s="30" /><b>No se pudo abrir el documento</b><span>{{ errorVisor }}</span></div>
            <div v-else class="vacio-box"><span>Cargando el documento…</span></div>
          </div>
          <div v-else-if="enServidor()" class="visor-area"><div class="vacio-box"><Ic n="upload" :s="30" /><b>Falta el archivo de este currículum</b><span>Arrástralo a la columna de la derecha para verlo aquí.</span></div></div>
          <div v-else class="visor-area">
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
        <div class="visor" v-else><div class="visor-area"><div class="vacio-box"><Ic n="documentos" :s="30" /><b>Sin currículum</b><span>Arrastra el PDF a la columna de la derecha (o haz clic allí para elegirlo).</span></div></div></div>
        <aside class="visor-lado">
          <h4>Currículums de esta ficha</h4>
          <div v-for="d in docs.filter(x => x.tipo==='Currículum')" :key="d.id" class="doc-fila-env"><button class="doc-fila" :class="{on: cvActual && cvActual.id===d.id}" @click="cvSel=d.id"><Ic n="documentos" :s="16" /><span class="grow"><b>{{ d.nombre }}</b><small>{{ fCorta(d.fecha) }} · {{ tam(d.tam) }}</small></span></button><button class="icon-btn icon-btn-sm doc-borrar" title="Borrar este currículum" aria-label="Borrar este currículum" @click="borrarCv(d)"><Ic n="trash" :s="14" /></button></div>
          <Dropzone compacto :texto="subiendo ? 'Subiendo…' : 'Soltar o elegir el currículum'" @archivos="subir($event, 'Currículum')" />
          <div v-if="auto.cargando" class="aviso"><Ic n="sparkles" :s="16" /><span class="grow"><b>Leyendo el currículum…</b> rellena solo lo que falte en la ficha.<div class="ia-barra" style="margin-top:6px"><i></i></div></span></div>
          <p v-else class="sub"><Ic n="sparkles" :s="13" /> Al subir un currículum se lee solo y rellena lo que falte en la ficha (también la foto).</p>
          <div v-if="puedeLeerIA" class="foto-mas"><button class="btn btn-sm" :disabled="encuadrando" @click="encuadrarSola"><Ic n="search" :s="14" />{{ encuadrando ? 'Buscando…' : 'Foto: encuadrar sola' }}</button><button class="btn btn-sm" @click="abrirRecorte"><Ic n="camara" :s="14" />Recortar a mano</button></div>
        </aside>
        <Modal v-if="ia.abierto" titulo="Datos leídos del currículum" :ancho="620" @cerrar="ia.abierto=false">
          <div v-if="ia.cargando" class="vacio-box" style="padding:28px"><div class="ia-barra"><i></i></div><b>Leyendo «{{ ia.doc }}»…</b><span>Suele tardar entre 5 y 20 segundos.</span></div>
          <div v-else-if="ia.error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ ia.error }}</span></div>
          <template v-else>
            <p class="sub">Marca lo que quieras pasar a la ficha. Lo que ya estaba escrito no se cambia si no lo marcas.</p>
            <div v-for="a in ia.avisos" :key="a" class="aviso warn"><Ic n="alert" :s="16" /><span>{{ a }}</span></div>
            <label v-if="ia.foto" class="ia-fila ia-foto"><input type="checkbox" v-model="ia.usarFoto" /><img :src="ia.foto" alt="Foto recortada del currículum" /><span class="grow"><small>Foto</small><b>Foto del currículum</b><small v-if="c.foto" class="ia-antes">Ya tiene foto: se cambia solo si lo marcas.</small></span></label>
            <p v-if="!ia.campos.length && !ia.centro && !ia.foto" class="sub"><b>No hay nada nuevo:</b> la ficha ya tiene todo lo que se lee en el currículum.</p>
            <label v-for="f in ia.campos" :key="f.k" class="ia-fila"><input type="checkbox" v-model="f.usar" /><span class="grow"><small>{{ f.etq }}</small><b>{{ f.nuevo }}</b><small v-if="f.actual" class="ia-antes">Ahora en la ficha: {{ f.actual }}</small></span></label>
            <label v-if="ia.centro && ia.centroId" class="ia-fila"><input type="checkbox" v-model="ia.usarCentro" /><span class="grow"><small>Centro educativo</small><b>{{ centroDe(ia.centroId)?.nombre }}</b><small class="ia-antes">En el currículum: {{ ia.centro }}<template v-if="c.centroId"> · Ahora en la ficha: {{ centroDe(c.centroId)?.nombre }}</template></small></span></label>
            <div v-else-if="ia.centro && !c.centroId" class="aviso"><Ic n="info" :s="16" /><span>El currículum menciona <b>{{ ia.centro }}</b>, que no está en la lista de centros. Si procede, elígelo o créalo a mano.</span></div>
            <p v-for="o in ia.otros" :key="o[0]" class="sub"><b>{{ o[0] }}:</b> {{ o[1] }}</p>
          </template>
          <template #pie><button class="btn" @click="ia.abierto=false">{{ ia.error || ia.cargando ? 'Cerrar' : 'No aplicar nada' }}</button><button v-if="!ia.cargando && !ia.error" class="btn btn-primary" :disabled="!ia.campos.some(f => f.usar) && !(ia.usarCentro && ia.centroId) && !(ia.usarFoto && ia.foto)" @click="aplicarIA"><Ic n="check" :s="15" />Aplicar a la ficha</button></template>
        </Modal>
      </div>

      <!-- ENTREVISTA -->
      <div v-else-if="tab==='entrevista'" class="card-pad stack">
        <template v-if="!ent"><Vacio icono="calendario" titulo="Sin entrevista programada" texto="Programa la entrevista para poder ponerle nota después."><button class="btn btn-primary" style="margin-top:8px" @click="prog.abierto=true"><Ic n="calendario" :s="16" />Programar entrevista</button></Vacio>
          <div class="pc-grid">
            <div class="pc-col pro">
              <div class="pc-head"><span class="pc-ico"><Ic n="plus" :s="16" /></span><h3>A favor</h3><span class="tag">{{ (c.pros || []).length }}</span></div>
              <ul><li v-for="(p, i) in (c.pros || [])" :key="p"><Ic n="check" :s="15" /><input class="pc-txt grow" :value="p" :aria-label="'Editar: ' + p" title="Pulsa para editar" @change="editarPC('pros', i, $event)" @keydown.enter="$event.target.blur()" @keydown.esc="$event.target.value = p; $event.target.blur()" /><button class="icon-btn" @click="quitarPC('pros', i)" title="Quitar" aria-label="Quitar"><Ic n="x" :s="14" /></button></li></ul>
              <p v-if="!(c.pros || []).length" class="sub">Lo que te ha gustado de la entrevista o del currículum.</p>
              <div class="row pc-nuevo"><input class="inp" v-model="nuevo.pros" placeholder="Añadir punto a favor…" @keydown.enter="addPC('pros')" /><button class="btn btn-sm" @click="addPC('pros')"><Ic n="plus" :s="14" />Añadir</button></div>
            </div>
            <div class="pc-col con">
              <div class="pc-head"><span class="pc-ico"><Ic n="minus" :s="16" /></span><h3>En contra</h3><span class="tag">{{ (c.contras || []).length }}</span></div>
              <ul><li v-for="(p, i) in (c.contras || [])" :key="p"><Ic n="alert" :s="15" /><input class="pc-txt grow" :value="p" :aria-label="'Editar: ' + p" title="Pulsa para editar" @change="editarPC('contras', i, $event)" @keydown.enter="$event.target.blur()" @keydown.esc="$event.target.value = p; $event.target.blur()" /><button class="icon-btn" @click="quitarPC('contras', i)" title="Quitar" aria-label="Quitar"><Ic n="x" :s="14" /></button></li></ul>
              <p v-if="!(c.contras || []).length" class="sub">Lo que te frena o hay que confirmar.</p>
              <div class="row pc-nuevo"><input class="inp" v-model="nuevo.contras" placeholder="Añadir punto en contra…" @keydown.enter="addPC('contras')" /><button class="btn btn-sm" @click="addPC('contras')"><Ic n="plus" :s="14" />Añadir</button></div>
            </div>
          </div></template>
        <template v-else>
          <div class="rondas">
            <button v-for="(e, i) in ents" :key="e.id" class="pill" :class="{on: ent.id === e.id}" @click="elegirRonda(e.id)">{{ i + 1 }}.ª entrevista · {{ fCorta(e.fecha) }}<template v-if="e.entrevistador"> · {{ e.entrevistador }}</template><template v-if="e.estado === 'Cancelada'"> · cancelada</template></button>
            <button class="btn btn-sm right" @click="otraEntrevista"><Ic n="plus" :s="14" />Programar otra entrevista</button><button class="btn btn-sm btn-ghost" title="Eliminar esta entrevista (creada por error)" @click="borrarEsta"><Ic n="trash" :s="14" />Eliminar</button>
          </div>
          <div class="ent-cab">
            <div class="fecha-b grande"><small>{{ fLarga(ent.fecha).split(' ')[0] }}</small><b>{{ fCorta(ent.fecha) }}</b></div>
            <div class="grid3 grow">
              <div class="fld"><label>Fecha</label><input class="inp" type="date" v-model="ent.fecha" /></div>
              <div class="fld"><label>Hora</label><select class="inp" v-model="ent.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div>
              <div class="fld"><label>Modalidad</label><select class="inp" v-model="ent.modalidad"><option>Presencial</option><option>Online</option></select></div>
              <div class="fld"><label>Entrevistador/a (opcional)</label><select class="inp" v-model="ent.entrevistador"><option value="">Sin asignar</option><OpcionesPersonas :actual="ent.entrevistador" /></select></div>
              <div class="fld"><label>Estado de la cita</label><select class="inp" v-model="ent.estado"><option v-for="(v,k) in ESTADOS_CITA" :key="k">{{ k }}</option></select></div>
            </div>
          </div>

          <div class="ent-valor">
          <div class="pc-grid">
            <div class="pc-col pro">
              <div class="pc-head"><span class="pc-ico"><Ic n="plus" :s="16" /></span><h3>A favor</h3><span class="tag">{{ (c.pros || []).length }}</span></div>
              <ul><li v-for="(p, i) in (c.pros || [])" :key="p"><Ic n="check" :s="15" /><input class="pc-txt grow" :value="p" :aria-label="'Editar: ' + p" title="Pulsa para editar" @change="editarPC('pros', i, $event)" @keydown.enter="$event.target.blur()" @keydown.esc="$event.target.value = p; $event.target.blur()" /><button class="icon-btn" @click="quitarPC('pros', i)" title="Quitar" aria-label="Quitar"><Ic n="x" :s="14" /></button></li></ul>
              <p v-if="!(c.pros || []).length" class="sub">Lo que te ha gustado de la entrevista o del currículum.</p>
              <div class="row pc-nuevo"><input class="inp" v-model="nuevo.pros" placeholder="Añadir punto a favor…" @keydown.enter="addPC('pros')" /><button class="btn btn-sm" @click="addPC('pros')"><Ic n="plus" :s="14" />Añadir</button></div>
            </div>
            <div class="pc-col con">
              <div class="pc-head"><span class="pc-ico"><Ic n="minus" :s="16" /></span><h3>En contra</h3><span class="tag">{{ (c.contras || []).length }}</span></div>
              <ul><li v-for="(p, i) in (c.contras || [])" :key="p"><Ic n="alert" :s="15" /><input class="pc-txt grow" :value="p" :aria-label="'Editar: ' + p" title="Pulsa para editar" @change="editarPC('contras', i, $event)" @keydown.enter="$event.target.blur()" @keydown.esc="$event.target.value = p; $event.target.blur()" /><button class="icon-btn" @click="quitarPC('contras', i)" title="Quitar" aria-label="Quitar"><Ic n="x" :s="14" /></button></li></ul>
              <p v-if="!(c.contras || []).length" class="sub">Lo que te frena o hay que confirmar.</p>
              <div class="row pc-nuevo"><input class="inp" v-model="nuevo.contras" placeholder="Añadir punto en contra…" @keydown.enter="addPC('contras')" /><button class="btn btn-sm" @click="addPC('contras')"><Ic n="plus" :s="14" />Añadir</button></div>
            </div>
          </div>
          <div class="nota-final">
            <div class="nf-fila">
              <label class="nf-lbl" for="nota-exacta">Nota final<span class="nf-caja"><input id="nota-exacta" class="nf-input" type="number" min="0" max="10" step="0.25" inputmode="decimal" :value="bor.nota ?? ''" placeholder="—" @input="notaEscrita($event)" /><span class="nf-de">/ 10</span></span></label>
              <span v-if="bor.nota != null" class="nf-tag">{{ etiquetaNota(bor.nota) }}</span>
            </div>
            <div class="fld"><label>Observaciones</label><textarea class="inp" rows="2" v-model="bor.obs" placeholder="Impresión general de la entrevista…"></textarea></div>
            <button class="btn nf-guardar" @click="guardarValoracion"><Ic n="check" :s="16" />Guardar valoración</button>
            <div class="row nf-mas"><button v-if="cambiosVal" class="btn-link" @click="descartarValoracion">Descartar cambios</button><button v-if="c.nota != null || bor.nota != null" class="btn-link peligro" @click="borrarValoracion">Borrar valoración</button></div>
          </div>
          </div>

          <Teleport to="body"><div v-if="cambiosVal && tab==='entrevista'" class="barra-guardar" role="status">
            <Ic n="alert" :s="17" /><span class="grow"><b>{{ cambiosVal }} cambio{{ cambiosVal === 1 ? '' : 's' }} sin guardar</b> en la valoración de la {{ ents.findIndex(e => e.id === ent.id) + 1 }}.ª entrevista</span>
            <button class="btn btn-borde-claro" @click="descartarValoracion">Descartar</button>
            <button class="btn btn-accent" @click="guardarValoracion"><Ic n="check" :s="15" />Guardar valoración</button>
          </div></Teleport>
          <div>
            <div class="row" style="margin-bottom:10px"><h3>Preguntas y respuestas</h3><button class="btn btn-sm right" @click="addPregunta"><Ic n="plus" :s="14" />Añadir pregunta</button></div>
            <div v-for="(p,i) in ent.preguntas" :key="i" class="qa"><input class="inp" v-model="p.q" placeholder="Pregunta" /><textarea class="inp" v-model="p.a" rows="2" placeholder="Respuesta del candidato"></textarea></div>
            <p v-if="!ent.preguntas.length" class="sub">Aún no hay preguntas. Podrás guardar un guion de preguntas habituales en Ajustes.</p>
          </div>
        </template>
      </div>

      <!-- A FAVOR Y EN CONTRA -->
      <!-- DOCUMENTACIÓN -->
      <div v-else-if="tab==='docs'" class="card-pad stack">
        <div v-if="docsCentro.length" class="convenio-centro">
          <h4>Convenio de su centro <span class="sub">({{ centroDe(c.centroId)?.nombre }})</span></h4>
          <div v-for="d in docsCentro" :key="d.id" class="doc-centro"><span class="ext" :class="d.ext">{{ d.ext }}</span><span class="grow"><b>{{ d.nombre }}</b><small class="sub" style="display:block">Común a todos los alumnos del centro · se cambia en Centros educativos</small></span><button class="btn btn-sm" @click="abrirArchivo(d)">Abrir</button></div>
        </div>
        <p v-else-if="c.centroId" class="sub"><Ic n="info" :s="13" /> Su centro todavía no tiene convenio subido (se sube en Centros educativos).</p>
        <Dropzone :texto="subiendo ? 'Subiendo…' : 'Arrastra aquí anexos, justificantes o currículums de esta persona'" @archivos="subir($event)" />
        <div class="tbl-wrap"><table class="tbl sin-hover">
          <thead><tr><th>Documento</th><th>Tipo</th><th>Subido</th><th>Tamaño</th><th></th></tr></thead>
          <tbody><tr v-for="d in docs" :key="d.id">
            <td><div class="row"><span class="ext" :class="d.ext">{{ d.ext }}</span><input class="inp nombre-doc" v-model="d.nombre" title="Haz clic para renombrar" /></div></td>
            <td><select class="inp" v-model="d.tipo" style="width:150px"><option v-for="t in TIPOS_DOC" :key="t">{{ t }}</option></select></td>
            <td class="nowrap">{{ fCompleta(d.fecha) }}<template v-if="d.hora">, {{ d.hora }}</template><small v-if="d.por" class="sub" style="display:block">{{ d.por }}</small></td><td class="nowrap">{{ tam(d.tam) }}</td>
            <td class="nowrap"><button class="icon-btn" title="Ver" @click="d.tipo==='Currículum' ? (cvSel=d.id, tab='cv') : (d.archivoId ? abrirArchivo(d) : demo('se abriría la vista previa del documento'))"><Ic n="eye" :s="16" /></button><button class="icon-btn" title="Descargar" @click="d.archivoId ? abrirArchivo(d, true) : demo('se descargaría el archivo')"><Ic n="download" :s="16" /></button><button class="icon-btn" title="Eliminar" @click="borrarDoc(d)"><Ic n="trash" :s="16" /></button></td>
          </tr></tbody></table></div>
        <p class="sub"><Ic n="lock" :s="13" /> Archivos privados: solo se abren con sesión iniciada y un enlace temporal, como en el CRM.</p>
      </div>

      <!-- HISTORIAL -->
      <div v-else-if="tab==='historial'" class="card-pad">
        <ol class="timeline">
          <li v-for="h in hist" :key="h.id" :class="h.tipo"><span class="t-ico"><Ic :n="ICONO_HIST[h.tipo] || 'info'" :s="14" /></span><div class="grow"><b>{{ h.texto }}</b><small>{{ fCompleta(h.fecha) }}<template v-if="h.hora">, {{ h.hora }}</template> · {{ h.autor }}</small></div><button v-if="sePuedeDeshacer(h)" class="btn btn-sm" @click="deshacerHist(h)"><Ic n="history" :s="14" />Deshacer este cambio</button></li>
        </ol>
      </div>

      <!-- NOTAS INTERNAS -->
      <div v-else class="card-pad stack">
        <div class="aviso gold"><Ic n="lock" :s="16" /><span>Estas observaciones solo las ve el personal autorizado de la gestoría. Nunca se comparten con el candidato ni con el centro.</span></div>
        <div class="row" style="align-items:flex-start"><textarea class="inp grow" rows="2" v-model="nuevaNota" placeholder="Escribe una observación interna…" @keydown.ctrl.enter="addNota"></textarea><button class="btn btn-primary" @click="addNota">Añadir</button></div>
        <div v-for="n in notas" :key="n.id" class="nota-int"><Avatar :nombre="n.autor" apellidos="" :s="30" /><div><div class="row"><b>{{ n.autor }}</b><span class="sub">{{ fCompleta(n.fecha) }}</span></div><p>{{ n.texto }}</p></div><button v-if="n.autor === miNombre() || esAdmin()" class="icon-btn icon-btn-sm nota-borrar" title="Borrar esta observación" aria-label="Borrar esta observación" @click="borrarNota(n)"><Ic n="trash" :s="14" /></button></div>
        <p v-if="!notas.length" class="sub">Todavía no hay observaciones internas.</p>
      </div>
    </div>

    <RecorteFoto v-if="recorte.abierto" :archivo="recorte.archivo" :caja="recorte.caja" :buscando="recorte.buscando" @listo="usarRecorte" @cerrar="recorte.abierto = false" />

    <Modal v-if="fotoAbierta && c.foto" :titulo="nombreCompleto(c)" :ancho="460" @cerrar="fotoAbierta = false">
      <img :src="c.foto" class="foto-grande" :alt="'Foto de ' + nombreCompleto(c)" />
      <div class="foto-acciones">
        <label class="btn btn-ink"><Ic n="camara" :s="16" />Cambiar foto<input type="file" accept="image/*" hidden @change="cambiarFoto" /></label>
        <button class="btn btn-peligro" @click="quitarFoto"><Ic n="trash" :s="16" />Eliminar foto</button>
      </div>
      <div v-if="puedeLeerIA" class="foto-mas"><button class="btn btn-sm" :disabled="encuadrando" @click="encuadrarSola"><Ic n="search" :s="14" />{{ encuadrando ? 'Buscando la cara…' : 'Encuadrar sola' }}</button><button class="btn btn-sm" @click="buscarFotoCv"><Ic n="camara" :s="14" />Recortar a mano</button></div>
    </Modal>

    <Modal v-if="prog.abierto" :titulo="prog.otra ? 'Programar ' + (ents.filter(e => e.estado !== 'Cancelada').length + 1) + '.ª entrevista' : 'Programar entrevista'" @cerrar="prog.abierto=false; prog.otra=false">
      <p v-if="prog.otra" class="sub">La entrevista anterior y su valoración se conservan. Elige quién hace esta (por ejemplo, dirección).</p>
      <div class="grid2">
        <div class="fld"><label>Fecha</label><input class="inp" type="date" v-model="prog.fecha" /></div>
        <div class="fld"><label>Hora</label><select class="inp" v-model="prog.hora"><option v-for="h in HORAS_ENTREVISTA" :key="h">{{ h }}</option></select></div>
        <div class="fld"><label>Modalidad</label><select class="inp" v-model="prog.modalidad"><option>Presencial</option><option>Online</option></select></div>
        <div class="fld"><label>Quién hace la entrevista (opcional)</label><select class="inp" v-model="prog.entrevistador"><option value="">Sin asignar</option><OpcionesPersonas :actual="prog.entrevistador" /></select></div>
      </div>
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
        <div class="fld"><label>Tutor en la gestoría (opcional)</label><select class="inp" v-model="inc.tutor"><option value="">Sin tutor asignado</option><OpcionesPersonas :actual="inc.tutor" /></select></div>
      </div>
      <label class="row"><input type="checkbox" v-model="inc.convenio" /> Convenio de prácticas firmado</label>
      <div class="aviso" :class="ocupacion.pasa ? 'err' : ''"><Ic :n="ocupacion.pasa ? 'alert' : 'info'" :s="16" /><span>Turno de <b>{{ etiquetaTurno(ocupacion.t).toLowerCase() }}</b> el día de inicio: {{ ocupacion.n }} de {{ ocupacion.aforo }} plazas ocupadas.<template v-if="ocupacion.pasa"> <b>Con esta incorporación se supera el aforo supervisable.</b></template></span></div>
      <template #pie><button class="btn" @click="inc.abierto=false">Cancelar</button><button class="btn btn-accent" @click="guardarInc"><Ic n="estudiantes" :s="16" />{{ est ? 'Guardar' : 'Incorporar' }}</button></template>
    </Modal>
  </div>
  <div class="page" v-else><div class="card"><div class="vacio-box"><b>Candidato no encontrado</b><button class="btn" @click="go('candidatos')">Volver al listado</button></div></div></div>`,
};
