// Exportar los datos del portal: un libro de Excel (.xlsx, una hoja por tipo de dato) y una copia completa en ZIP
// (Excel + datos en JSON + todos los documentos por carpetas). Todo se hace en el navegador, sin librerías.
import { store, candDe, centroDe, nombreCompleto, estadoDe } from "./store.js";
import { urlArchivo, registrar } from "./api.js";
import { crearZip, descargarBlob, HOY_ISO } from "./util.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const letra = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const nombreHoja = (t) => t.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

function hojaXml(cabeceras, filas, op = {}) {
  const anchos = cabeceras.map((c, i) => op.anchos?.[i] ?? Math.min(60, Math.max(10, String(c).length + 2, ...filas.slice(0, 200).map((f) => String(f[i] ?? "").split("\n")[0].length + 2))));
  const celda = (v, r, c, cab) => {
    const ref = letra(c) + (r + 1);
    const est = cab ? 1 : op.estilos?.[c] || 0, at = est ? ` s="${est}"` : "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${at}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === "") return est ? `<c r="${ref}"${at}/>` : "";
    return `<c r="${ref}" t="inlineStr"${at}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const fila = (f, r, cab) => `<row r="${r + 1}">${f.map((v, c) => celda(v, r, c, cab)).join("")}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${fila(cabeceras, 0, true)}${filas.map((f, i) => fila(f, i + 1, false)).join("")}</sheetData>${op.sinFiltro ? "" : `<autoFilter ref="A1:${letra(cabeceras.length - 1)}${filas.length + 1}"/>`}</worksheet>`;
}

/** hojas: [{ nombre, cabeceras, filas }] → Blob .xlsx */
export function crearXlsx(hojas) {
  const enc = new TextEncoder();
  const f = (nombre, texto) => ({ nombre, datos: enc.encode(texto) });
  const archivos = [
    f("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    f("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${esc(nombreHoja(h.nombre))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    f("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    f("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF121C38"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3B3A5A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3F6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDDE5EE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`),
    ...hojas.map((h, i) => f(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h.cabeceras, h.filas, h))),
  ];
  return new Blob([crearZip(archivos)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Las hojas con todos los datos del portal, en lenguaje de personas. */
export function hojasDelPortal() {
  const centro = (id) => centroDe(id)?.nombre || "";
  const sn = (v) => (v ? "Sí" : "No");
  const cand = store.candidatos.slice().sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre));
  const ultimaEnt = (id) => store.entrevistas.filter((e) => e.candId === id).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))[0];
  return [
    { nombre: "Candidatos", cabeceras: ["Nombre", "Apellidos", "Correo", "Teléfono", "Centro", "Titulación", "Área de interés", "Estado", "Turno", "Nota", "Horas", "Origen", "Alta", "Última entrevista", "A favor", "En contra", "Observaciones"],
      filas: cand.map((c) => { const e = ultimaEnt(c.id); return [c.nombre, c.apellidos, c.email, c.tel, centro(c.centroId), c.titulacion, c.area, estadoDe(c.estado).n, c.turno, c.nota ?? "", c.horas || "", c.origen, c.creado, e ? `${e.fecha} ${e.hora} (${e.estado})` : "", (c.pros || []).join("; "), (c.contras || []).join("; "), c.obs || ""]; }) },
    { nombre: "Entrevistas", cabeceras: ["Candidato", "Fecha", "Hora", "Modalidad", "Entrevistador", "Estado", "Nota del candidato", "Observaciones"],
      filas: store.entrevistas.slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).map((e) => [nombreCompleto(candDe(e.candId)), e.fecha, e.hora, e.modalidad, e.entrevistador, e.estado, candDe(e.candId)?.nota ?? "", e.obs || ""]) },
    { nombre: "Estudiantes", cabeceras: ["Estudiante", "Centro", "Inicio", "Fin previsto", "Horario", "Horas", "Tutor", "Convenio firmado", "Faltas", "Evaluación final"],
      filas: store.estudiantes.slice().sort((a, b) => b.inicio.localeCompare(a.inicio)).map((e) => [nombreCompleto(candDe(e.candId)), centro(e.centroId), e.inicio, e.fin, `${e.horaIni}–${e.horaFin}`, e.horas, e.tutor || "", sn(e.convenio), (e.faltas || []).length, e.evaluacion ? e.evaluacion.resultado || "Hecha" : ""]) },
    { nombre: "Centros", cabeceras: ["Centro", "Tipo", "Responsable", "Contacto", "Correo", "Teléfono", "Horas de prácticas", "Archivado"],
      filas: store.centros.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((c) => [c.nombre, c.tipo, c.responsable, c.contacto, c.email, c.tel, c.horas || "", sn(c.archivado)]) },
    { nombre: "Observaciones internas", cabeceras: ["Candidato", "Fecha", "Autor", "Texto"],
      filas: store.notas.slice().sort((a, b) => b.id - a.id).map((n) => [nombreCompleto(candDe(n.candId)), n.fecha, n.autor, n.texto]) },
    { nombre: "Historial", cabeceras: ["Candidato", "Fecha", "Hora", "Quién", "Qué pasó"],
      filas: store.historial.slice().sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || ""))).map((h) => [nombreCompleto(candDe(h.candId)), h.fecha, h.hora || "", h.autor, h.texto]) },
  ];
}

export function exportarExcel() {
  descargarBlob(crearXlsx(hojasDelPortal()), `portal-practicas-${HOY_ISO}.xlsx`);
  registrar("Exportó todos los datos a Excel", `${store.candidatos.length} candidatos`);
}

/** Copia completa: Excel + datos en JSON + documentos ordenados por persona o centro. progreso(hechos, total) opcional. */
export async function copiaCompleta(progreso = () => {}) {
  const enc = new TextEncoder();
  const archivos = [
    { nombre: `datos/portal-practicas-${HOY_ISO}.xlsx`, datos: new Uint8Array(await crearXlsx(hojasDelPortal()).arrayBuffer()) },
    { nombre: "datos/datos-completos.json", datos: enc.encode(JSON.stringify({ exportado: new Date().toISOString(), centros: store.centros, candidatos: store.candidatos, entrevistas: store.entrevistas, estudiantes: store.estudiantes, documentos: store.documentos, notas: store.notas, historial: store.historial }, null, 1)) },
  ];
  const docs = store.documentos.filter((d) => d.archivoId);
  const usados = new Set(); let fallos = 0, hechos = 0;
  const limpio = (t) => String(t || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  for (const d of docs) {
    try {
      const r = await fetch(await urlArchivo(d)); if (!r.ok) throw new Error();
      const dueno = d.candId ? nombreCompleto(candDe(d.candId)) : "Centro - " + (centroDe(d.centroId)?.nombre || "sin centro");
      let nombre = `documentos/${limpio(dueno) || "Sin ficha"}/${limpio(d.nombre) || "archivo"}`, k = 2;
      while (usados.has(nombre.toLowerCase())) nombre = nombre.replace(/(\.[^./]+)?$/, ` (${k++})$1`);
      usados.add(nombre.toLowerCase());
      archivos.push({ nombre, datos: new Uint8Array(await r.arrayBuffer()) });
    } catch { fallos++; }
    progreso(++hechos, docs.length);
  }
  descargarBlob(crearZip(archivos), `copia-portal-${HOY_ISO}.zip`);
  registrar("Descargó la copia completa (ZIP)", `${archivos.length - 2} documentos`);
  return { documentos: archivos.length - 2, fallos };
}
