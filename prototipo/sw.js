// Service worker del portal: permite instalarlo y abrirlo aunque falle la conexión.
// Siempre intenta primero la red (así nunca se queda con una versión vieja) y solo
// tira de la copia guardada si no hay conexión. Los datos (/api/) nunca se guardan aquí.
const CACHE = "portal-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/_/")) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(r, copia)); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || (r.mode === "navigate" ? caches.match("./") : Response.error())))
  );
});
