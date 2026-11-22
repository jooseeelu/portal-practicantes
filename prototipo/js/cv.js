// Recorte de la foto del currículum. La IA indica el recuadro (de 0 a 1 sobre la primera página)
// y aquí se recorta en el navegador. Si el recorte sale mal, la persona puede quitarla con la «x».
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
let promesaPdf = null;

function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!promesaPdf) {
    promesaPdf = new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = PDFJS; s.async = true;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
      s.onerror = () => { promesaPdf = null; mal(new Error("No se pudo cargar el lector de PDF.")); };
      document.head.appendChild(s);
    });
  }
  return promesaPdf;
}

/** Pinta la primera página (o la imagen) en un canvas. */
export async function paginaEnCanvas(archivo) {
  if (/^image\//.test(archivo.type)) {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("imagen")); i.src = URL.createObjectURL(archivo); });
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0); URL.revokeObjectURL(img.src); return c;
  }
  const lib = await cargarPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const pag = await pdf.getPage(1);
  const base = pag.getViewport({ scale: 1 });
  const vp = pag.getViewport({ scale: Math.min(3, 2400 / base.width) });
  const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  await pag.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return c;
}

// --- Detector de caras (MediaPipe, en el navegador): afina el recorte que propone la IA ---
const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELO_CARA = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
let promesaDetector = null;
function cargarDetector() {
  if (!promesaDetector) {
    promesaDetector = (async () => {
      const v = await import(/* @vite-ignore */ MP + "/vision_bundle.mjs");
      const fs = await v.FilesetResolver.forVisionTasks(MP + "/wasm");
      return v.FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELO_CARA, delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
    })().catch((e) => { promesaDetector = null; throw e; });
  }
  return promesaDetector;
}
/** Busca la cara más clara dentro de una zona del canvas (en píxeles). Devuelve {x,y,w,h} o null. */
async function caraEn(canvas, zona) {
  const det = await cargarDetector();
  const escala = Math.min(1, 640 / Math.max(zona.w, zona.h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(zona.w * escala)); c.height = Math.max(1, Math.round(zona.h * escala));
  c.getContext("2d").drawImage(canvas, zona.x, zona.y, zona.w, zona.h, 0, 0, c.width, c.height);
  const r = det.detect(c);
  const mejor = (r.detections || []).sort((a, b) => (b.categories?.[0]?.score || 0) - (a.categories?.[0]?.score || 0))[0];
  if (!mejor) return null;
  const b = mejor.boundingBox;
  return { x: zona.x + b.originX / escala, y: zona.y + b.originY / escala, w: b.width / escala, h: b.height / escala };
}
/** Zonas donde buscar la cara: la que dice la IA (ampliada) y, si no, la parte de arriba de la página por trozos. */
function zonasDe(W, H, caja) {
  const z = [];
  if (caja && caja.ancho > 0) {
    const cx = (caja.x + caja.ancho / 2) * W, cy = (caja.y + caja.alto / 2) * H, l = Math.max(caja.ancho * W, caja.alto * H) * 2.2;
    z.push({ x: Math.max(0, cx - l / 2), y: Math.max(0, cy - l / 2), w: Math.min(W, l), h: Math.min(H, l) });
  }
  const t = W / 2;
  for (const [x, y] of [[0, 0], [W / 2, 0], [0, H * 0.25], [W / 2, H * 0.25], [W / 4, 0]]) z.push({ x, y, w: Math.min(t, W - x), h: Math.min(t, H - y) });
  return z;
}
/** Recuadro cuadrado (px) para la foto: centrado en la cara si se encuentra; si no, el de la IA. */
export async function recuadroFoto(pag, caja) {
  const W = pag.width, H = pag.height;
  try {
    for (const zona of zonasDe(W, H, caja)) {
      const f = await caraEn(pag, zona);
      if (f) {
        let l = Math.min(W, H, Math.max(f.w, f.h) * 2.3);
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2 + f.h * 0.15; // un poco más de hombros que de cabeza
        // Si la IA marcó dónde está la foto y la cara cae dentro, el recorte no se sale de ese marco (así no entra texto del CV)
        let mx = 0, my = 0, MW = W, MH = H;
        if (caja && caja.ancho > 0) {
          const bx = caja.x * W, by = caja.y * H, bw = caja.ancho * W, bh = caja.alto * H;
          if (cx >= bx && cx <= bx + bw && f.y + f.h / 2 >= by && f.y + f.h / 2 <= by + bh) {
            l = Math.max(Math.max(f.w, f.h) * 1.25, Math.min(l, bw, bh));
            mx = bx; my = by; MW = bx + bw; MH = by + bh;
          }
        }
        return { x: Math.max(mx, Math.min(MW - l, cx - l / 2)), y: Math.max(my, Math.min(MH - l, cy - l / 2)), l, cara: true };
      }
    }
  } catch (_) { /* sin detector: se usa la IA */ }
  if (!caja) return null;
  const cx = (caja.x + caja.ancho / 2) * W, cy = (caja.y + caja.alto / 2) * H;
  const l = Math.min(W, H, Math.max(caja.ancho * W, caja.alto * H) * 1.12);
  return { x: Math.max(0, Math.min(W - l, cx - l / 2)), y: Math.max(0, Math.min(H - l, cy - l / 2)), l, cara: false };
}
export function recortarDe(pag, r) {
  const out = document.createElement("canvas"); out.width = out.height = 256;
  out.getContext("2d").drawImage(pag, r.x, r.y, r.l, r.l, 0, 0, 256, 256);
  return out.toDataURL("image/jpeg", 0.88);
}

/** Devuelve la foto recortada (JPG cuadrado de 256 px en base64) o "" si no se pudo.
 *  soloConCara: sin cara detectada no devuelve nada (para no poner trozos del currículum). */
export async function recortarFoto(archivo, caja, { soloConCara = false } = {}) {
  try {
    if (!archivo) return "";
    const pag = await paginaEnCanvas(archivo);
    const r = await recuadroFoto(pag, caja);
    if (!r || (soloConCara && !r.cara)) return "";
    return recortarDe(pag, r);
  } catch (_) { return ""; }
}
