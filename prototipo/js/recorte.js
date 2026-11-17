// Recorte manual de la foto a partir de la primera página del currículum.
// Se ve la página con un recuadro cuadrado: se arrastra para moverlo y desde la esquina para cambiar el tamaño.
import { ref, reactive, onMounted, onUnmounted, watch } from "vue";
import { Modal, Ic } from "./ui.js";
import { paginaEnCanvas } from "./cv.js";

export const RecorteFoto = {
  components: { Modal, Ic },
  props: { archivo: Object, caja: Object, buscando: Boolean },
  emits: ["listo", "cerrar"],
  setup(p, { emit }) {
    const url = ref(""), error = ref(""), img = ref(null), zona = ref(null);
    const nat = reactive({ w: 0, h: 0 }); // tamaño real de la página
    const sel = reactive({ x: 0, y: 0, l: 0 }); // recuadro en píxeles de la página
    let pagina = null;
    const colocar = (c) => {
      if (!nat.w) return;
      if (c && c.ancho > 0) {
        const l = Math.max(c.ancho * nat.w, c.alto * nat.h) * 1.1;
        sel.l = Math.min(l, nat.w, nat.h);
        sel.x = Math.max(0, Math.min(nat.w - sel.l, (c.x + c.ancho / 2) * nat.w - sel.l / 2));
        sel.y = Math.max(0, Math.min(nat.h - sel.l, (c.y + c.alto / 2) * nat.h - sel.l / 2));
      } else { sel.l = nat.w * 0.3; sel.x = nat.w * 0.05; sel.y = nat.h * 0.04; }
    };
    onMounted(async () => {
      try {
        pagina = await paginaEnCanvas(p.archivo);
        nat.w = pagina.width; nat.h = pagina.height;
        url.value = pagina.toDataURL("image/jpeg", 0.9);
        colocar(p.caja);
      } catch (e) { error.value = "No se pudo abrir el currículum para recortar."; }
    });
    watch(() => p.caja, (c) => colocar(c));
    // arrastrar y redimensionar (ratón y dedo)
    let modo = "", ini = null;
    const escala = () => (img.value ? nat.w / img.value.getBoundingClientRect().width : 1);
    const empezar = (m, ev) => { ev.preventDefault(); modo = m; ini = { x: ev.clientX, y: ev.clientY, sx: sel.x, sy: sel.y, sl: sel.l }; window.addEventListener("pointermove", mover); window.addEventListener("pointerup", soltar); };
    const mover = (ev) => {
      if (!modo) return;
      const k = escala(), dx = (ev.clientX - ini.x) * k, dy = (ev.clientY - ini.y) * k;
      if (modo === "mover") { sel.x = Math.max(0, Math.min(nat.w - sel.l, ini.sx + dx)); sel.y = Math.max(0, Math.min(nat.h - sel.l, ini.sy + dy)); }
      else { const l = Math.max(40, ini.sl + Math.max(dx, dy)); sel.l = Math.min(l, nat.w - sel.x, nat.h - sel.y); }
    };
    const soltar = () => { modo = ""; window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
    onUnmounted(soltar);
    const estilo = () => (nat.w ? { left: (sel.x / nat.w) * 100 + "%", top: (sel.y / nat.h) * 100 + "%", width: (sel.l / nat.w) * 100 + "%", height: (sel.l / nat.h) * 100 + "%" } : {});
    function usar() {
      if (!pagina) return;
      const out = document.createElement("canvas"); out.width = out.height = 256;
      out.getContext("2d").drawImage(pagina, sel.x, sel.y, sel.l, sel.l, 0, 0, 256, 256);
      emit("listo", out.toDataURL("image/jpeg", 0.88));
    }
    return { url, error, img, zona, estilo, empezar, usar };
  },
  template: `<Modal titulo="Recortar la foto del currículum" :ancho="620" @cerrar="$emit('cerrar')">
    <p class="sub">Arrastra el recuadro hasta la cara y agrándalo o achícalo desde la esquina. <template v-if="buscando">Buscando dónde está la foto…</template></p>
    <div v-if="error" class="aviso err"><Ic n="alert" :s="16" /><span>{{ error }}</span></div>
    <div v-else-if="!url" class="vacio-box" style="padding:28px"><div class="ia-barra"><i></i></div><b>Abriendo el currículum…</b></div>
    <div v-else class="recorte-zona" ref="zona">
      <img ref="img" :src="url" alt="Primera página del currículum" draggable="false" />
      <div class="recorte-caja" :style="estilo()" @pointerdown="empezar('mover', $event)"><span class="recorte-esquina" @pointerdown.stop="empezar('tam', $event)" aria-hidden="true"></span></div>
    </div>
    <template #pie><button class="btn" @click="$emit('cerrar')">Cancelar</button><button class="btn btn-ink" :disabled="!url" @click="usar"><Ic n="check" :s="15" />Usar este recorte</button></template>
  </Modal>`,
};
