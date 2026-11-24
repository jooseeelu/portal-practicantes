// Informe de entrevistas realizadas: un Excel con el detalle y un resumen, o un PDF listo para imprimir.
import { store, candDe, centroDe, nombreCompleto, rondaDe, estadoDe } from "./store.js";
import { crearXlsx } from "./exportar.js";
import { descargarBlob, HOY_ISO } from "./util.js";
import { registrar } from "./api.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
const fecha = (iso) => { const [a, m, d] = String(iso || "").split("-"); return a ? `${d}/${m}/${a}` : ""; };
const punteado = (l) => (l || []).map((x) => "• " + x).join("\n");

/** Las entrevistas con estado «Realizada», de la más reciente a la más antigua, con su valoración. */
export function entrevistasRealizadas() {
  return store.entrevistas
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

export function excelEntrevistas() {
  const l = entrevistasRealizadas();
  const r = resumen(l);
  const detalle = {
    nombre: "Entrevistas realizadas",
    cabeceras: ["Fecha", "Hora", "Candidato/a", "Centro educativo", "Área", "Entrevista", "Modalidad", "Entrevistador/a", "Nota", "Estado actual", "A favor", "En contra", "Observaciones"],
    filas: l.map((x) => [fecha(x.fecha), x.hora, x.candidato, x.centro, x.area, x.ronda + ".ª", x.modalidad, x.entrevistador, x.nota, x.estado, punteado(x.pros), punteado(x.contras), x.obs]),
    estilos: [3, 3, 2, 2, 2, 3, 3, 2, 3, 2, 2, 2, 2],
    anchos: [12, 8, 28, 30, 22, 11, 12, 18, 8, 22, 38, 38, 44],
  };
  const filas = [
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
  descargarBlob(crearXlsx([hojaResumen, detalle]), `entrevistas-realizadas-${HOY_ISO}.xlsx`);
  registrar("Exportó las entrevistas realizadas a Excel", l.length + " entrevistas");
  return l.length;
}

export function htmlEntrevistas() {
  const l = entrevistasRealizadas();
  const r = resumen(l);
  const color = (n) => (typeof n !== "number" ? "#6b7796" : n >= 8 ? "#0b7a52" : n >= 6 ? "#9a6a00" : "#b42338");
  const puntos = (t, a) => (a.length ? `<div class="pt ${t}"><b>${t === "pro" ? "A favor" : "En contra"}</b> ${a.map(esc).join(" · ")}</div>` : "");
  const filas = l.map((x) => `<tr>
    <td class="nw">${fecha(x.fecha)}<br><span>${esc(x.hora)}</span></td>
    <td><b>${esc(x.candidato)}</b><br><span>${esc(x.centro)}${x.area ? " · " + esc(x.area) : ""}</span></td>
    <td class="nw">${x.ronda}.ª · ${esc(x.modalidad)}<br><span>${esc(x.entrevistador)}</span></td>
    <td class="n" style="color:${color(x.nota)}">${typeof x.nota === "number" ? String(x.nota).replace(".", ",") : "—"}</td>
    <td>${puntos("pro", x.pros)}${puntos("con", x.contras)}${x.obs ? `<div class="ob">${esc(x.obs)}</div>` : ""}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Entrevistas realizadas</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font: 11px/1.4 "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif; color: #121c38; margin: 0; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 3px solid #14c8b4; padding-bottom: 8px; margin-bottom: 10px; }
    h1 { font-size: 20px; margin: 0; letter-spacing: -.02em; } header span { color: #6b7796; }
    .res { display: flex; gap: 10px; margin-bottom: 10px; } .res div { border: 1px solid #dde5ee; border-radius: 8px; padding: 6px 12px; } .res b { display: block; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; }
    th { text-align: left; background: #121c38; color: #fff; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 6px 8px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e6ecf3; vertical-align: top; } tr { break-inside: avoid; } tbody tr:nth-child(even) td { background: #f5f8fb; }
    td span { color: #6b7796; } .nw { white-space: nowrap; } .n { text-align: center; font-size: 15px; font-weight: 800; }
    .pt { margin-bottom: 2px; } .pt.pro b { color: #0b7a52; } .pt.con b { color: #b42338; } .ob { color: #3a4a78; font-style: italic; margin-top: 2px; }
  </style></head><body>
  <header><div><h1>Entrevistas realizadas</h1><span>Gestoría eMadrid · prácticas</span></div><span>${r.desde ? `Del ${fecha(r.desde)} al ${fecha(r.hasta)} · ` : ""}generado el ${fecha(HOY_ISO)}</span></header>
  <div class="res"><div><b>${r.total}</b>entrevistas</div><div><b>${r.conNota}</b>con nota</div><div><b>${String(r.media === "" ? "—" : r.media).replace(".", ",")}</b>nota media</div></div>
  <table><thead><tr><th>Fecha</th><th>Candidato/a</th><th>Entrevista</th><th>Nota</th><th>Valoración</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Todavía no hay entrevistas realizadas.</td></tr>'}</tbody></table>
  </body></html>`;
}

/** Abre el diálogo de imprimir (o «Guardar como PDF») con el informe, sin ventanas emergentes. */
export function pdfEntrevistas() {
  const n = entrevistasRealizadas().length;
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  marco.srcdoc = htmlEntrevistas();
  marco.onload = () => { setTimeout(() => { try { marco.contentWindow.focus(); marco.contentWindow.print(); } catch (_) { /* sin impresión */ } setTimeout(() => marco.remove(), 60000); }, 250); };
  document.body.appendChild(marco);
  registrar("Preparó el PDF de entrevistas realizadas", n + " entrevistas");
  return n;
}
