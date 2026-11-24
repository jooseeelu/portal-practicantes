// Recorte manual de la foto a partir de la primera página del currículum.
// Se ve la página con un recuadro: se arrastra para moverlo, y desde los bordes o la esquina se cambia
// el ancho y el alto por separado. Lo que se recorta es exactamente lo que queda dentro del recuadro.
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";
import { Modal, Ic } from "./ui.js";
import { paginaEnCanvas, recuadroFoto } from "./cv.js";

export const RecorteFoto = {
  components: { Modal, Ic },
  props: { archivo: Object, caja: Object, buscando: Boolean },
  emits: ["listo", "cerrar"],
  setup(p, { emit }) {
    const url = ref(""), error = ref(""), img = ref(null);
    const nat = reactive({ w: 0, h: 0 }); // tamaño real de la página
    const sel = reactive({ x: 0, y: 0, w: 0, h: 0 }); // recuadro en píxeles de la página
    let pagina = null;
    let tocado = false; // en cuanto la persona toca el recuadro, nada automático lo vuelve a mover
    const MIN = 30;
    const limitar = () => {
      sel.w = Math.max(MIN, Math.min(sel.w, nat.w)); sel.h = Math.max(MIN, Math.min(sel.h, nat.h));
      sel.x = Math.max(0, Math.min(nat.w - sel.w, sel.x)); sel.y = Math.max(0, Math.min(nat.h - sel.h, sel.y));
    };
    const colocar = (c) => {
      if (!nat.w || tocado) return;
      if (c && c.ancho > 0) Object.assign(sel, { x: c.x * nat.w, y: c.y * nat.h, w: c.ancho * nat.w, h: c.alto * nat.h });
      else Object.assign(sel, { x: nat.w * 0.05, y: nat.h * 0.04, w: nat.w * 0.3, h: nat.w * 0.36 });
      limitar();
    };
    async function afinar(c) {
      try { const r = await recuadroFoto(pagina, c); if (r && !tocado) { Object.assign(sel, { x: r.x, y: r.y, w: r.l, h: r.l }); limitar(); } } catch (_) { /* se queda el de la IA */ }
    }
    onMounted(async () => {
      try {
        pagina = await paginaEnCanvas(p.archivo);
        nat.w = pagina.width; nat.h = pagina.height;
        url.value = pagina.toDataURL("image/jpeg", 0.9);
        colocar(p.caja);
        afinar(p.caja);
      } catch (e) { error.value = "No se pudo abrir el currículum para recortar."; }
    });
    watch(() => p.caja, (c) => { colocar(c); if (pagina) afinar(c); });

    // Arrastrar (mover) y redimensionar desde bordes/esquina, con ratón o dedo
    let modo = "", ini = null;
    const escala = () => (img.value ? nat.w / img.value.getBoundingClientRect().width : 1);
    const empezar = (m, ev) => {
      ev.preventDefault(); ev.stopPropagation();
      modo = m; tocado = true; ini = { cx: ev.clientX, cy: ev.clientY, xs: sel.x, ys: sel.y, ws: sel.w, hs: sel.h };
      window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar);
    };
    const mover = (ev) => {
      if (!modo) return;
      const k = escala(), dx = (ev.clientX - ini.cx) * k, dy = (ev.clientY - ini.cy) * k;
      if (modo === "mover") { sel.x = ini.xs + dx; sel.y = ini.ys + dy; }
      if (modo !== "mover" && modo.includes("e")) sel.w = Math.min(ini.ws + dx, nat.w - ini.xs);
      if (modo !== "mover" && modo.includes("s")) sel.h = Math.min(ini.hs + dy, nat.h - ini.ys);
      if (modo !== "mover" && modo.includes("w")) { const nx = Math.max(0, Math.min(ini.xs + dx, ini.xs + ini.ws - MIN)); sel.w = ini.ws + (ini.xs - nx); sel.x = nx; }
      if (modo !== "mover" && modo.includes("n")) { const ny = Math.max(0, Math.min(ini.ys + dy, ini.ys + ini.hs - MIN)); sel.h = ini.hs + (ini.ys - ny); sel.y = ny; }
      limitar();
    };
    const soltar = () => { modo = ""; window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
    onUnmounted(soltar);

    const estilo = () => (nat.w ? { left: (sel.x / nat.w) * 100 + "%", top: (sel.y / nat.h) * 100 + "%", width: (sel.w / nat.w) * 100 + "%", height: (sel.h / nat.h) * 100 + "%" } : {});
    function usar() {
      if (!pagina) return;
      const k = Math.min(1, 360 / Math.max(sel.w, sel.h));
      const out = document.createElement("canvas"); out.width = Math.round(sel.w * k); out.height = Math.round(sel.h * k);
      out.getContext("2d").drawImage(pagina, sel.x, sel.y, sel.w, sel.h, 0, 0, out.width, out.height);
      emit("listo", out.toDataURL("image/jpeg", 0.9));
    }
    async function cuadrarCara() { tocado = false; await afinar(null); tocado = true; }
    return { url, error, img, estilo, empezar, usar, cuadrarCara };
  },
  template: `<Modal titulo="Recortar la foto del currículum" :ancho="640" @cerrar="$emit('cerrar')">
    <p class="sub">Arrastra el recuadro hasta la foto. Para cambiar el tamaño, tira de los bordes o de las esquinas. <template v-if="buscando">Buscando dónde está la foto…</template></p>
    <div v-if="error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ error }}</span></div>
    <div v-else-if="!url" class="vacio-box" style="padding:28px"><div class="ia-barra"><i></i></div><b>Abriendo el currículum…</b></div>
    <div v-else class="recorte-zona">
      <div class="recorte-lienzo">
        <img ref="img" :src="url" alt="Primera página del currículum" draggable="false" />
        <div class="recorte-caja" :style="estilo()" @pointerdown="empezar('mover', $event)">
          <span class="rc-borde n" @pointerdown="empezar('n', $event)"></span><span class="rc-borde s" @pointerdown="empezar('s', $event)"></span>
          <span class="rc-borde e" @pointerdown="empezar('e', $event)"></span><span class="rc-borde w" @pointerdown="empezar('w', $event)"></span>
          <span class="rc-esq nw" @pointerdown="empezar('nw', $event)"></span><span class="rc-esq ne" @pointerdown="empezar('ne', $event)"></span>
          <span class="rc-esq sw" @pointerdown="empezar('sw', $event)"></span><span class="rc-esq se" @pointerdown="empezar('se', $event)"></span>
        </div>
      </div>
    </div>
    <template #pie><button class="btn btn-ghost" :disabled="!url" @click="cuadrarCara"><Ic n="search" :s="15" />Buscar la cara</button><button class="btn" @click="$emit('cerrar')">Cancelar</button><button class="btn btn-ink" :disabled="!url" @click="usar"><Ic n="check" :s="15" />Usar este recorte</button></template>
  </Modal>`,
};
