// Utilidades de fechas y texto. «HOY» es la fecha real; los datos de demo se calculan en relación a ella.
export const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const HOY_ISO = iso(new Date());
export const aDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const HOY = aDate(HOY_ISO);
/** Fecha ISO desplazada `n` días desde `base` (ISO, por defecto hoy). */
export const dia = (n, base = HOY_ISO) => { const d = aDate(base); d.setDate(d.getDate() + n); return iso(d); };
export const difDias = (a, b) => Math.round((aDate(a) - aDate(b)) / 86400000);

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const fCorta = (s) => { if (!s) return "—"; const d = aDate(s); return `${d.getDate()} ${MES[d.getMonth()]}`; };
export const fCompleta = (s) => { if (!s) return "—"; const d = aDate(s); return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
export const fLarga = (s) => { const d = aDate(s); return `${DIAS[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
export const nombreDia = (s) => DIAS[aDate(s).getDay()];
export const diaCorto = (s) => DIAS_CORTOS[aDate(s).getDay()];
export const diaNum = (s) => aDate(s).getDate();

/** «hoy», «mañana», «en 3 días», «hace 2 días». */
export function relativo(s) {
  const n = difDias(s, HOY_ISO);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

export const lunesDe = (s) => { const d = aDate(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); };
export const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const iniciales = (n = "", a = "") => ((n[0] || "") + (a[0] || "")).toUpperCase();
export const aMin = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return a * 60 + b; };
export const deMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
// Mañana (hasta las 14:00), Tarde (entra sobre las 15:00) y Tarde 2 (entra sobre las 16:00)
export const turnoDe = (horaIni) => (aMin(horaIni) < 14 * 60 ? "Mañana" : aMin(horaIni) < 15.5 * 60 ? "Tarde" : "Tarde 2");
export const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const slug = (s) => normal(s).replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

// --- Días laborables: la oficina no hace entrevistas en fin de semana ---
export const esFinde = (s) => { if (!s) return false; const d = aDate(s).getDay(); return d === 0 || d === 6; };
/** Si la fecha cae en sábado o domingo, devuelve el lunes siguiente. */
export const laborable = (s) => { let f = s; while (esFinde(f)) f = dia(1, f); return f; };

// --- Enlaces de contacto ---
/** Teléfono en formato internacional para wa.me (España por defecto si son 9 cifras). */
export const telWhatsApp = (tel) => { const d = String(tel || "").replace(/[^0-9]/g, ""); return d.length === 9 ? "34" + d : d.replace(/^00/, ""); };
export const urlWhatsApp = (tel, texto = "") => { const n = telWhatsApp(tel); return n.length >= 10 ? "https://wa.me/" + n + (texto ? "?text=" + encodeURIComponent(texto) : "") : ""; };

// --- Descargas hechas en el navegador ---
export function descargarBlob(blob, nombre) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** CSV que Excel abre bien en español: separador «;», comillas dobles y marca UTF-8. */
/** Trozo de nombre de archivo: sin tildes ni espacios, cada palabra con mayúscula inicial («Andrés» → «Andres»). */
export const trozoNombre = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
/** Nombre de archivo corto: Qué_Quién_Fecha («Entrevistas_Andres_2026-11-24»); sin filtros, «Todas». */
export const nombreArchivo = (que, trozos = [], todo = "Todas") => [que, ...(trozos.map(trozoNombre).filter(Boolean).length ? trozos.map(trozoNombre).filter(Boolean) : [todo]), HOY_ISO].join("_");
export function descargarCsv(nombre, cabeceras, filas) {
  const celda = (v) => { let t = v == null ? "" : String(v); if (/^[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const texto = [cabeceras, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
  descargarBlob(new Blob(["\uFEFF" + texto], { type: "text/csv;charset=utf-8" }), nombre);
}
let TABLA_CRC = null;
function crc32(b) {
  if (!TABLA_CRC) { TABLA_CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLA_CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}
/** ZIP sin compresión (los PDF e imágenes ya van comprimidos). archivos: [{ nombre, datos: Uint8Array }]. */
export function crearZip(archivos) {
  const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
  const ahora = new Date(), hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1), fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  for (const a of archivos) {
    const nom = enc.encode(a.nombre), crc = crc32(a.datos), n = a.datos.length;
    const cab = new DataView(new ArrayBuffer(30)); cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(8, 0, true); cab.setUint16(10, hora, true); cab.setUint16(12, fecha, true); cab.setUint32(14, crc, true); cab.setUint32(18, n, true); cab.setUint32(22, n, true); cab.setUint16(26, nom.length, true); cab.setUint16(28, 0, true);
    partes.push(new Uint8Array(cab.buffer), nom, a.datos);
    const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true); cen.setUint32(16, crc, true); cen.setUint32(20, n, true); cen.setUint32(24, n, true); cen.setUint16(28, nom.length, true); cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nom);
    pos += 30 + nom.length + n;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22)); fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: "application/zip" });
}

/** ¿Encaja el área de un candidato con el filtro? ("__otras" = escrita a mano, fuera de la lista) */
export const cumpleArea = (area, filtro, lista) => (!filtro ? true : filtro === "__otras" ? !!area && !lista.includes(area) : (area || "") === filtro);
