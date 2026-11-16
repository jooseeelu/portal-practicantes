# Sirve el prototipo estático con nginx (para Dokploy).
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY prototipo/ /usr/share/nginx/html/
# servidor.cjs es solo para verlo en local; no hace falta en el contenedor.
RUN rm -f /usr/share/nginx/html/servidor.cjs

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
