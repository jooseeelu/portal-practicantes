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
async function paginaEnCanvas(archivo) {
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

/** Devuelve la foto recortada (JPG cuadrado de 256 px en base64) o "" si no se pudo. */
export async function recortarFoto(archivo, caja) {
  try {
    if (!caja || !archivo) return "";
    const pag = await paginaEnCanvas(archivo);
    const W = pag.width, H = pag.height;
    const cx = (caja.x + caja.ancho / 2) * W, cy = (caja.y + caja.alto / 2) * H;
    const lado = Math.max(caja.ancho * W, caja.alto * H) * 1.12; // un poco de margen alrededor de la cara
    const x0 = Math.max(0, Math.min(W - lado, cx - lado / 2)), y0 = Math.max(0, Math.min(H - lado, cy - lado / 2));
    const l = Math.min(lado, W, H);
    const out = document.createElement("canvas"); out.width = out.height = 256;
    out.getContext("2d").drawImage(pag, x0, y0, l, l, 0, 0, 256, 256);
    return out.toDataURL("image/jpeg", 0.88);
  } catch (_) { return ""; }
}
