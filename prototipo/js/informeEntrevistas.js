// Informe de entrevistas realizadas: un Excel con el detalle y un resumen, o un PDF listo para imprimir.
import { store, candDe, centroDe, nombreCompleto, rondaDe, estadoDe } from "./store.js";
import { crearXlsx } from "./exportar.js";
import { descargarBlob, HOY_ISO } from "./util.js";
import { registrar } from "./api.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
const slug = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fecha = (iso) => { const [a, m, d] = String(iso || "").split("-"); return a ? `${d}/${m}/${a}` : ""; };
const punteado = (l) => (l || []).map((x) => "• " + x).join("\n");

/** Las entrevistas con estado «Realizada», de la más reciente a la más antigua, con su valoración. */
export function entrevistasRealizadas(origen = store.entrevistas) {
  return origen
    .filter((e) => e.estado === "Realizada")
    .slice()
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))
    .map((e) => {
      const c = candDe(e.candId) || {};
      const ronda = rondaDe(e);
      const primera = ronda === 1;
      // Fichas antiguas: lo que había en la ficha cuenta como de la 1.ª entrevista
      const lista = (k) => (Array.isArray(e[k]) ? e[k] : primera ? c[k] || [] : []);
      const nota = e.nota !== undefined ? e.nota : primera ? c.nota ?? null : null;
      return {
        fecha: e.fecha, hora: e.hora || "", candidato: nombreCompleto(c) || "Sin nombre", centro: centroDe(c.centroId)?.nombre || "Autopostulado",
        area: c.area || "", ronda, modalidad: e.modalidad || "", entrevistador: e.entrevistador || "Sin asignar", nota: nota ?? "",
        estado: c.estado ? estadoDe(c.estado)?.n || "" : "", pros: lista("pros"), contras: lista("contras"), obs: e.obs || "",
      };
    });
}

const media = (l) => { const n = l.map((x) => x.nota).filter((v) => typeof v === "number"); return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : ""; };
const agrupar = (l, clave) => { const m = new Map(); for (const x of l) { const k = clave(x) || "Sin dato"; (m.get(k) || m.set(k, []).get(k)).push(x); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])); };

function resumen(l) {
  const f = l.map((x) => x.fecha).filter(Boolean).sort();
  return { total: l.length, conNota: l.filter((x) => typeof x.nota === "number").length, media: media(l), desde: f[0] || "", hasta: f[f.length - 1] || "" };
}

/** `origen`: las entrevistas a exportar (por defecto todas); `etiqueta`: qué filtro llevan («Agenda de Andrés»…). */
export function excelEntrevistas(origen, etiqueta = "", nombre = "Entrevistas") {
  const l = entrevistasRealizadas(origen);
  const r = resumen(l);
  const detalle = {
    nombre: "Entrevistas realizadas",
    cabeceras: ["Fecha", "Hora", "Candidato/a", "Centro educativo", "Área", "Entrevista", "Modalidad", "Entrevistador/a", "Nota", "Estado actual", "A favor", "En contra", "Observaciones"],
    filas: l.map((x) => [fecha(x.fecha), x.hora, x.candidato, x.centro, x.area, x.ronda + ".ª", x.modalidad, x.entrevistador, x.nota, x.estado, punteado(x.pros), punteado(x.contras), x.obs]),
    estilos: [3, 3, 2, 2, 2, 3, 3, 2, 3, 2, 2, 2, 2],
    anchos: [12, 8, 28, 30, 22, 11, 12, 18, 8, 22, 38, 38, 44],
  };
  const filas = [
    ...(etiqueta ? [["Filtro", etiqueta, ""]] : []),
    ["Entrevistas realizadas", r.total, ""],
    ["Con nota puesta", r.conNota, ""],
    ["Nota media", r.media, ""],
    ["Periodo", r.desde ? `${fecha(r.desde)} – ${fecha(r.hasta)}` : "—", ""],
    ["", "", ""],
    ["POR ENTREVISTADOR/A", "Entrevistas", "Nota media"],
    ...agrupar(l, (x) => x.entrevistador).map(([k, v]) => [k, v.length, media(v)]),
    ["", "", ""],
    ["POR ÁREA", "Entrevistas", "Nota media"],
    ...agrupar(l, (x) => x.area).map(([k, v]) => [k, v.length, media(v)]),
    ["", "", ""],
    ["POR CENTRO EDUCATIVO", "Entrevistas", "Nota media"],
    ...agrupar(l, (x) => x.centro).map(([k, v]) => [k, v.length, media(v)]),
  ];
  const hojaResumen = { nombre: "Resumen", cabeceras: ["Resumen · Gestoría eMadrid", "", ""], filas, estilos: [4, 3, 3], anchos: [38, 14, 14], sinFiltro: true };
  descargarBlob(crearXlsx([hojaResumen, detalle]), nombre + ".xlsx");
  registrar("Exportó las entrevistas realizadas a Excel", l.length + " entrevistas" + (etiqueta ? " · " + etiqueta : ""));
  return l.length;
}

export function htmlEntrevistas(origen, etiqueta = "", nombre = "Entrevistas realizadas") {
  const l = entrevistasRealizadas(origen);
  const r = resumen(l);
  const color = (n) => (typeof n !== "number" ? "#6b7796" : n >= 8 ? "#0b7a52" : n >= 6 ? "#9a6a00" : "#b42338");
  const fondo = (n) => (typeof n !== "number" ? "#eef2f7" : n >= 8 ? "#ddf5ea" : n >= 6 ? "#fdf1d6" : "#fde8eb");
  const lista = (a) => (a.length ? `<ul>${a.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : '<em class="vac">—</em>');
  const filas = l.map((x) => `<tbody><tr>
    <td class="nw"><b>${fecha(x.fecha)}</b><br><span>${esc(x.hora)}</span></td>
    <td><b>${esc(x.candidato)}</b><br><span>${esc(x.centro)}${x.area ? " · " + esc(x.area) : ""}</span></td>
    <td><b>${x.ronda}.ª</b> · ${esc(x.modalidad)}<br><span>${esc(x.entrevistador)}</span></td>
    <td class="n"><i style="color:${color(x.nota)};background:${fondo(x.nota)}">${typeof x.nota === "number" ? String(x.nota).replace(".", ",") : "—"}</i></td>
    <td class="pro">${lista(x.pros)}</td><td class="con">${lista(x.contras)}</td></tr>${x.obs ? `<tr class="o"><td></td><td colspan="5"><b>Obs.</b> ${esc(x.obs)}</td></tr>` : ""}</tbody>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(nombre)}</title><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { font: 10px/1.35 "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif; color: #121c38; margin: 0; padding: 0 12mm; }
    header { margin-top: 10mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 3px solid #14c8b4; padding-bottom: 8px; margin-bottom: 10px; }
    h1 { font-size: 20px; margin: 0; letter-spacing: -.02em; } header span { color: #6b7796; }
    .res { display: flex; gap: 10px; margin-bottom: 10px; } .res div { border: 1px solid #dde5ee; border-radius: 8px; padding: 6px 12px; } .res b { display: block; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; } thead { display: table-header-group; } tbody { break-inside: avoid; border-bottom: 1px solid #dde5ee; } .nw { white-space: nowrap; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { text-align: left; background: #121c38; color: #fff; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 6px 8px; }
    td { padding: 6px 8px; vertical-align: top; font-size: 10px; line-height: 1.3; } tbody:nth-of-type(even) td { background: #f5f8fb; }
    td span { color: #6b7796; } .nw { white-space: nowrap; } .n { text-align: center; } .n i { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; font-style: normal; font-size: 12px; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ul { margin: 0; padding-left: 12px; } li { margin-bottom: 1px; } .pro { border-left: 3px solid #14c8b4; } .con { border-left: 3px solid #e0566a; } .vac { color: #9aa5bd; font-style: normal; } tr.sp td { height: 10mm; padding: 0; background: #fff !important; border: 0; } tfoot { display: table-footer-group; } tr.o td { padding-top: 0; color: #3a4a78; font-style: italic; }
  </style></head><body>
  <header><div><h1>Entrevistas realizadas</h1><span>Gestoría eMadrid · prácticas${etiqueta ? " · <b>" + esc(etiqueta) + "</b>" : ""}</span></div><span>${r.desde ? `Del ${fecha(r.desde)} al ${fecha(r.hasta)} · ` : ""}generado el ${fecha(HOY_ISO)}</span></header>
  <div class="res"><div><b>${r.total}</b>entrevistas</div><div><b>${r.conNota}</b>con nota</div><div><b>${String(r.media === "" ? "—" : r.media).replace(".", ",")}</b>nota media</div></div>
  <table><colgroup><col style="width:92px"><col style="width:200px"><col style="width:120px"><col style="width:50px"><col><col></colgroup><thead><tr class="sp"><td colspan="6"></td></tr><tr><th>Fecha</th><th>Candidato/a</th><th>Entrevista</th><th>Nota</th><th>A favor</th><th>En contra</th></tr></thead><tfoot><tr class="sp"><td colspan="6"></td></tr></tfoot>${filas || '<tbody><tr><td colspan="6">Todavía no hay entrevistas realizadas.</td></tr></tbody>'}</table>
  </body></html>`;
}

/** Abre el diálogo de imprimir (o «Guardar como PDF») con el informe, sin ventanas emergentes. */
export function pdfEntrevistas(origen, etiqueta = "", nombre = "Entrevistas") {
  const n = entrevistasRealizadas(origen).length;
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  marco.srcdoc = htmlEntrevistas(origen, etiqueta, nombre);
  marco.onload = () => { setTimeout(() => { const t = document.title; try { document.title = nombre; marco.contentWindow.focus(); marco.contentWindow.print(); } catch (_) { /* sin impresión */ } document.title = t; setTimeout(() => marco.remove(), 60000); }, 250); };
  document.body.appendChild(marco);
  registrar("Preparó el PDF de entrevistas realizadas", n + " entrevistas" + (etiqueta ? " · " + etiqueta : ""));
  return n;
}
