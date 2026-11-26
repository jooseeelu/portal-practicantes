// Banco de pruebas de rendimiento (solo en local, en modo demo; no se publica: ver .dockerignore).
// Rellena el portal con N candidatos INVENTADOS (con el reparto real de fotos, historial, entrevistas
// y documentos de producción) y mide lo que más pesa con muchos datos.
// Uso, en la consola del navegador con el prototipo abierto:
//   const b = await import("/dev/banco.js"); await b.rellenar(10000); await b.medir();
import { nextTick } from "vue";
import { store, candidaturasCaducadas, cargarDemo } from "../js/store.js";

const NOMBRES = ["Lucía", "Hugo", "Marta", "Pablo", "Carla", "Daniel", "Eva", "Iván", "Sara", "Raúl", "Nerea", "Álvaro", "Paula", "Javier", "Irene", "Mario"];
const APELLIDOS = ["García", "Ruiz", "Navarro", "Peña", "Soto", "Vidal", "Ramos", "Cano", "Sanz", "Montoya", "Lara", "Vega", "Rubio", "Ortega", "Molina", "Iglesias"];
const AREAS = ["Marketing/Comercio", "Contabilidad/Fiscalidad", "Administración/Finanzas", "RRHH", "Asistencia a la dirección", "IT/Tecnología"];
const TURNOS = ["Mañana", "Tarde", "Disponibilidad completa", "Por confirmar"];
const ESTADOS = ["pr", "pe", "ev", "se", "ns", "re"].map((k) => k);

let fotoCache = "";
/** Una foto JPEG de unos 22 KB (lo que pesa de media una foto real recortada). */
function fotoFalsa() {
  if (fotoCache) return fotoCache;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 4000; i++) { g.fillStyle = `hsl(${(i * 37) % 360},60%,${30 + (i % 50)}%)`; g.fillRect((i * 53) % 256, (i * 97) % 256, 6, 6); }
  let q = 0.9; fotoCache = c.toDataURL("image/jpeg", q);
  while (fotoCache.length > 30000 && q > 0.3) { q -= 0.05; fotoCache = c.toDataURL("image/jpeg", q); }
  return fotoCache;
}

const azar = (l, i) => l[(i * 2654435761) % l.length];
const fecha = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

/** Sustituye los datos por N candidatos inventados (proporciones medidas en producción el 26/11/2026). */
export async function rellenar(n = 10000) {
  cargarDemo();
  const estados = store.estados.map((e) => e.k);
  const centros = store.centros.map((c) => c.id);
  const cand = [], hist = [], ents = [], docs = [];
  const foto = fotoFalsa();
  let id = 5_000_000;
  for (let i = 0; i < n; i++) {
    const cid = ++id, dias = i % 730;
    const c = {
      id: cid, nombre: azar(NOMBRES, i), apellidos: azar(APELLIDOS, i + 3) + " " + azar(APELLIDOS, i + 7) + " " + i,
      centroId: i % 5 ? azar(centros, i) : null, titulacion: "Grado en " + azar(AREAS, i).split("/")[0], area: azar(AREAS, i + 1),
      turno: azar(TURNOS, i), horas: 300, estado: azar(estados, i), nota: i % 3 ? (i % 11) : null,
      email: `persona${i}@ejemplo.test`, tel: "600000000", curso: "3.º", disponibilidad: azar(TURNOS, i), origen: "Centro educativo",
      obs: i % 4 ? "" : "Observación de prueba con algo de texto para que pese como una real.", pros: ["Puntual", "Buen nivel de Excel"], contras: ["Disponibilidad limitada"],
      creado: fecha(dias), cv: true,
    };
    if (i % 100 < 68) c.foto = foto; // 68 % con foto, como en producción
    cand.push(c);
    if (i % 10 < 7) ents.push({ id: ++id, candId: cid, fecha: fecha(dias - 5), hora: "10:00", modalidad: "Presencial", entrevistador: "Andrés", estado: "Realizada", criterios: {}, preguntas: [], obs: "", notion: true });
    docs.push({ id: ++id, candId: cid, nombre: `CV_${i}.pdf`, tipo: "Currículum", fecha: fecha(dias), tam: 300, ext: "pdf" });
    for (let h = 0; h < 10; h++) hist.push({ id: ++id, candId: cid, fecha: fecha(dias - h), hora: "10:00", tipo: h % 3 ? "nota" : "estado", texto: "Movimiento de historial de prueba número " + h, autor: "Admin" });
  }
  // (sin «...lista»: con más de ~100.000 elementos el navegador se queda sin pila)
  // Fuera las fichas de demostración que apuntan a candidatos que ya no existen (estudiantes, notas, papelera)
  for (const k of ["estudiantes", "notas", "papelera"]) store[k].length = 0;
  for (const [k, l] of [["candidatos", cand], ["historial", hist], ["entrevistas", ents], ["documentos", docs]]) { store[k].length = 0; for (let i = 0; i < l.length; i += 5000) store[k].push(...l.slice(i, i + 5000)); }
  await nextTick();
  return { candidatos: cand.length, historial: hist.length, entrevistas: ents.length, documentos: docs.length };
}

const ms = (t) => Math.round(performance.now() - t);
// Con la pestaña oculta el navegador no pinta (requestAnimationFrame se para): se fuerza el cálculo de la página
const esperarPintado = () => new Promise((r) => setTimeout(() => { void document.body.offsetHeight; r(); }, 0));

/** Mide: descarga que haría cada navegador, coste de revisar cambios al guardar, revisión de conservación y pintar pantallas. */
export async function medir() {
  const r = {};
  const tipos = ["candidatos", "centros", "entrevistas", "estudiantes", "documentos", "historial", "notas", "papelera"];
  // 1) Lo que baja del servidor cada 45 s (cada fila es {id, tipo, clave, datos, created, updated})
  let bytes = 0, fotos = 0;
  for (const k of tipos) for (const x of store[k]) { const j = JSON.stringify(x); bytes += j.length + 120; if (x.foto) fotos += x.foto.length; }
  r.descargaMB = +(bytes / 1048576).toFixed(1);
  r.deEllasFotosMB = +(fotos / 1048576).toFixed(1);
  // 2) Al guardar cualquier cambio se convierte todo a texto para compararlo (sync.js → estadoLocal)
  let t = performance.now();
  for (const k of tipos) for (const x of store[k]) JSON.stringify(x);
  r.revisarCambiosAlGuardarMs = ms(t);
  // 3) Revisión de conservación de datos (Inicio y Ajustes)
  t = performance.now(); const cad = candidaturasCaducadas(30); r.revisionConservacionMs = ms(t); r.caducadas = cad.length;
  // 4) Pintar pantallas
  // Se cronometra desde que el navegador avisa del cambio de página hasta que está calculada (sin contar esperas)
  // (sin temporizadores: con el panel oculto el navegador los retrasa y falsearía la medida)
  const pintar = (ruta) => new Promise((ok) => {
    let t0 = 0;
    window.addEventListener("hashchange", () => { t0 = performance.now(); }, { once: true, capture: true });
    // Este se apunta después del router, así que corre cuando el router ya ha cambiado de página
    window.addEventListener("hashchange", async () => { await nextTick(); void document.body.offsetHeight; ok(Math.round(performance.now() - t0)); }, { once: true });
    location.hash = ruta;
  });
  for (const [nombre, ruta] of [["Inicio", "#/"], ["Candidatos", "#/candidatos"], ["Entrevistas", "#/entrevistas"], ["Ajustes", "#/ajustes"]]) {
    location.hash = "#/centros"; await esperarPintado(); // (Ajustes no: allí está la revisión lenta)
    r["pintar" + nombre + "Ms"] = await pintar(ruta);
    if (nombre === "Candidatos") r.filasEnCandidatos = document.querySelectorAll("table tbody tr, .cand-card").length;
  }
  return r;
}
