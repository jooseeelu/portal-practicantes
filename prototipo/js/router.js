import { ref } from "vue";

const parse = () => {
  const p = (location.hash || "").replace(/^#\/?/, "").split("/");
  return { nombre: p[0] || "inicio", id: p[1] || "" };
};
export const ruta = ref(parse());
window.addEventListener("hashchange", () => { ruta.value = parse(); window.scrollTo(0, 0); });
export const go = (path) => { location.hash = "#/" + path; };
