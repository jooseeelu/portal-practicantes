import { ref } from "vue";

const parse = () => {
  const p = (location.hash || "").replace(/^#\/?/, "").split("/");
  return { nombre: p[0] || "inicio", id: p[1] || "" };
};
export const ruta = ref(parse());
// De dónde se abrió la ficha (Estudiantes, Entrevistas…): «Volver» lleva ahí y el menú lo deja marcado
const leerOrigen = () => { try { return sessionStorage.getItem("origenFicha"); } catch { return null; } };
export const origenFicha = ref(leerOrigen() || "candidatos");

// Al volver de una ficha al listado, se recupera la posición donde estaba (página y tabla).
const ZONAS = ".tbl-scroll, .kanban, .tbl-wrap";
const posiciones = {};
const guardar = (nombre) => {
  posiciones[nombre] = { y: window.scrollY, zonas: [...document.querySelectorAll(ZONAS)].map((el) => [el.scrollTop, el.scrollLeft]) };
};
const recuperar = (nombre) => {
  const p = posiciones[nombre];
  if (!p) return window.scrollTo(0, 0);
  const aplicar = () => {
    document.querySelectorAll(ZONAS).forEach((el, i) => { if (p.zonas[i]) { el.scrollTop = p.zonas[i][0]; el.scrollLeft = p.zonas[i][1]; } });
    window.scrollTo(0, p.y);
  };
  window.scrollTo(0, 0);
  [0, 60, 200, 450].forEach((t) => setTimeout(aplicar, t)); // la lista y su altura se pintan en varios pasos
};
window.addEventListener("hashchange", () => {
  const antes = ruta.value;
  if (antes.nombre !== "candidato") guardar(antes.nombre);
  ruta.value = parse();
  if (ruta.value.nombre === "candidato" && antes.nombre !== "candidato") { origenFicha.value = antes.nombre || "candidatos"; try { sessionStorage.setItem("origenFicha", origenFicha.value); } catch {} }
  if (antes.nombre === "candidato" && ruta.value.nombre !== "candidato") recuperar(ruta.value.nombre);
  else window.scrollTo(0, 0);
});
export const go = (path) => { location.hash = "#/" + path; };
