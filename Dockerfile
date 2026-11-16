# Portal de prácticas: PocketBase sirve la API y la web en un solo contenedor (para Dokploy).
# Los datos viven en /pb/pb_data: hay que montar ahí un volumen persistente.
FROM alpine:3.20

ARG PB_VERSION=0.30.0
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip \
 && mkdir -p /pb/pb_data \
 && unzip -q /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip

COPY servidor/pb_migrations /pb/pb_migrations
COPY servidor/pb_hooks /pb/pb_hooks
COPY servidor/arranque.sh /pb/arranque.sh
COPY prototipo/ /pb/pb_public/
# servidor.cjs es solo para ver la web en local; y los saltos de línea de Windows rompen el script.
RUN rm -f /pb/pb_public/servidor.cjs && sed -i 's/\r$//' /pb/arranque.sh && chmod +x /pb/arranque.sh

VOLUME /pb/pb_data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/api/health || exit 1
CMD ["/pb/arranque.sh"]
