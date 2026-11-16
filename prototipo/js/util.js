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
