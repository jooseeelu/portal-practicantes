// Fotos de los candidatos: el servidor las saca de la ficha y las guarda como archivo (colección «fotos»).
// La web sigue poniendo la foto como siempre (texto base64 en «foto»); al guardarse la ficha, aquí:
//  - si llega una foto nueva → se guarda el archivo y la ficha queda con fotoId/fotoNombre/fotoHuella (sin el base64);
//  - si llega la MISMA foto que ya está guardada (un navegador que aún la tenía en memoria) → solo se quita el base64;
//  - si llega foto = "" → se quita la foto;
//  - si la ficha llega sin foto ni fotoId (un navegador que no sabía de ella) → se conserva la que había.
// Las fichas antiguas con foto base64 se convierten solas (tarea cada 10 minutos).

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VAL = (() => { const m = {}; for (let i = 0; i < B64.length; i++) m[B64[i]] = i; return m; })();
const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** «data:image/jpeg;base64,....» → { bytes: [...], ext } o null si no es una imagen válida. */
function decodificar(url) {
  const m = /^data:(image\/[a-z+]+);base64,(.*)$/.exec(String(url || ""));
  if (!m || !EXT[m[1]]) return null;
  const s = m[2].replace(/[^A-Za-z0-9+/]/g, "");
  const out = [];
  for (let i = 0; i + 1 < s.length; i += 4) {
    const a = VAL[s[i]], b = VAL[s[i + 1]], c = VAL[s[i + 2]], d = VAL[s[i + 3]];
    out.push((a << 2) | (b >> 4));
    if (c !== undefined) out.push(((b & 15) << 4) | (c >> 2));
    if (d !== undefined) out.push(((c & 3) << 6) | d);
  }
  return out.length ? { bytes: out, ext: EXT[m[1]] } : null;
}

function filaDe(app, candId) {
  try { return app.findFirstRecordByFilter("fotos", "candId = {:c}", { c: String(candId) }); } catch (_) { return null; }
}

/** Guarda (o sustituye) la foto de un candidato. Devuelve { id, nombre } o null. */
function guardar(app, candId, url, huella) {
  const d = decodificar(url);
  if (!d) return null;
  let r = filaDe(app, candId);
  if (!r) { r = new Record(app.findCollectionByNameOrId("fotos")); r.set("candId", String(candId)); }
  r.set("huella", huella);
  r.set("archivo", $filesystem.fileFromBytes(d.bytes, "foto." + d.ext));
  app.save(r);
  return { id: r.id, nombre: r.getString("archivo") };
}

function quitar(app, candId) {
  const r = filaDe(app, candId);
  if (r) app.delete(r);
}

/**
 * Ajusta los datos de una ficha de candidato antes de guardarla. `previo` son los datos que había (o null).
 * Devuelve true si ha cambiado algo.
 */
function procesar(app, d, previo) {
  if (!d || typeof d !== "object" || !d.id) return false;
  const p = previo || {};
  if (typeof d.foto === "string" && d.foto.indexOf("data:image/") === 0) {
    const huella = $security.sha256(d.foto);
    if (p.fotoId && p.fotoHuella === huella) {
      d.fotoId = p.fotoId; d.fotoNombre = p.fotoNombre; d.fotoHuella = huella;
    } else {
      const g = guardar(app, d.id, d.foto, huella);
      if (!g) return false; // no es una imagen válida: se deja como estaba
      d.fotoId = g.id; d.fotoNombre = g.nombre; d.fotoHuella = huella;
    }
    delete d.foto;
    return true;
  }
  if (d.foto === "") {
    if (p.fotoId || d.fotoId) quitar(app, d.id);
    delete d.foto; delete d.fotoId; delete d.fotoNombre; delete d.fotoHuella;
    return true;
  }
  if (!("foto" in d) && !d.fotoId && p.fotoId) {
    d.fotoId = p.fotoId; d.fotoNombre = p.fotoNombre; d.fotoHuella = p.fotoHuella;
    return true;
  }
  return false;
}

const leer = (r) => { try { return JSON.parse(r.getString("datos") || "{}"); } catch (_) { return null; } };

/** Convierte las fichas que aún llevan la foto en base64 (como mucho `limite` cada vez). */
function convertirPendientes(app, limite) {
  const recs = app.findRecordsByFilter("registros", "tipo = 'candidatos' && datos ~ '\"foto\":\"data:image/'", "", limite || 40, 0);
  let n = 0;
  for (const r of recs) {
    const d = leer(r);
    if (!d) continue;
    try { if (procesar(app, d, d)) { r.set("datos", d); app.save(r); n++; } } catch (err) { console.log("Fotos: no se pudo convertir la ficha " + r.getString("clave") + ": " + err); }
  }
  return n;
}

/** Borra las fotos de candidatos que ya no existen (ni en la lista ni en la papelera), con un día de margen. */
function limpiarHuerfanas(app) {
  const ayer = new Date(Date.now() - 86400000).toISOString().replace("T", " ");
  const fotos = app.findRecordsByFilter("fotos", "updated < {:f}", "", 0, 0, { f: ayer });
  let n = 0;
  for (const f of fotos) {
    const c = f.getString("candId");
    let vivo = false;
    try { app.findFirstRecordByFilter("registros", "tipo = 'candidatos' && clave = {:c}", { c }); vivo = true; } catch (_) { /* no está */ }
    if (!vivo) try { app.findFirstRecordByFilter("registros", "tipo = 'papelera' && datos ~ {:c}", { c: '"candId":' + c + ',' }); vivo = true; } catch (_) { /* no está */ }
    if (!vivo) { app.delete(f); n++; }
  }
  return n;
}

module.exports = { procesar, convertirPendientes, limpiarHuerfanas, leer, decodificar };
