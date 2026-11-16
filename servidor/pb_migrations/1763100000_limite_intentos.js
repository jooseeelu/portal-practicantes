/// <reference path="../pb_data/types.d.ts" />
// Límite de intentos: frena a quien pruebe contraseñas contra la pantalla de acceso.
// El portal está detrás de Traefik, así que la IP real del visitante llega en la
// cabecera X-Forwarded-For (sin esto, todo el mundo parecería la misma IP).

migrate((app) => {
  const s = app.settings();
  s.trustedProxy.headers = ["X-Forwarded-For"];
  s.trustedProxy.useLeftmostIP = false;
  s.rateLimits.enabled = true;
  s.rateLimits.rules = [
    // Inicios de sesión: 10 intentos por minuto y por IP (una oficina entera comparte IP).
    { label: "*:auth", audience: "", duration: 60, maxRequests: 10 },
    // Resto de la API: margen amplio para el guardado automático de varias personas a la vez.
    { label: "/api/", audience: "", duration: 10, maxRequests: 1000 },
  ];
  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.enabled = false;
  s.trustedProxy.headers = [];
  app.save(s);
});
