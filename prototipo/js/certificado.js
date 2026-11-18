// Certificado de prácticas: se abre en una ventana lista para imprimir o guardar como PDF.
import { DIRECCION } from "./data.js";

import { fLarga } from "./util.js";

export const CRITERIOS_EVAL = [
  ["puntualidad", "Puntualidad y asistencia"], ["responsabilidad", "Responsabilidad"], ["equipo", "Trabajo en equipo"],
  ["autonomia", "Autonomía"], ["calidad", "Calidad del trabajo"], ["actitud", "Actitud y ganas de aprender"],
];
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);

export function abrirCertificado(c, est, centro, firmante) {
  const nombre = `${c.nombre} ${c.apellidos}`.trim();
  const ev = est.evaluacion;
  const filas = ev ? CRITERIOS_EVAL.filter(([k]) => ev.criterios?.[k]).map(([k, t]) => `<tr><td>${esc(t)}</td><td>${"●".repeat(ev.criterios[k])}${"○".repeat(5 - ev.criterios[k])}</td></tr>`).join("") : "";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado de prácticas · ${esc(nombre)}</title>
<style>body{font:16px/1.6 Georgia,serif;color:#1d2433;max-width:720px;margin:40px auto;padding:0 28px}h1{font-size:26px;text-align:center;letter-spacing:.04em;margin:34px 0 28px}.cab{border-bottom:2px solid #1d2433;padding-bottom:10px;font:600 15px Arial,sans-serif}.cab span{display:block;font-weight:400;color:#555;font-size:13px}
table{border-collapse:collapse;margin:14px 0;width:100%;font:14px Arial,sans-serif}td{border-bottom:1px solid #ddd;padding:6px 4px}.firma{margin-top:70px;font:14px Arial,sans-serif}.btn{position:fixed;top:12px;right:12px;font:14px Arial;padding:8px 14px}@media print{.btn{display:none}}</style></head><body>
<button class="btn" onclick="print()">Imprimir / PDF</button>
<div class="cab">Gestoría eMadrid<span>${esc(DIRECCION)}</span></div>
<h1>CERTIFICADO DE PRÁCTICAS</h1>
<p>${esc(firmante || "Gestoría eMadrid")} certifica que <b>${esc(nombre)}</b>${c.titulacion ? `, alumno/a de <b>${esc(c.titulacion)}</b>${centro ? ` en <b>${esc(centro.nombre)}</b>` : ""},` : ""} ha realizado prácticas en nuestra empresa del <b>${esc(fLarga(est.inicio))}</b> al <b>${esc(fLarga(est.fin))}</b>, con un horario de ${esc(est.horaIni)} a ${esc(est.horaFin)} y un total de <b>${esc(est.horas)} horas</b>${est.tutor ? `, bajo la tutoría de ${esc(est.tutor)}` : ""}.</p>
${ev && ev.resultado ? `<p>Valoración final: <b>${esc(ev.resultado)}</b>.${ev.comentario ? " " + esc(ev.comentario) : ""}</p>` : ""}
${filas ? `<table>${filas}</table>` : ""}
<p>Y para que conste, se expide el presente certificado en Madrid, a ${esc(fLarga(new Date().toISOString().slice(0, 10)))}.</p>
<div class="firma"><br>_______________________________<br>Gestoría eMadrid</div></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close();
  return true;
}
