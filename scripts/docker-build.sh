#!/bin/bash
# Build de la web con reintentos: el registry de Docker a veces responde
# con timeouts al resolver la imagen base (DeadlineExceeded / i/o timeout).
set -u
INTENTOS=${1:-3}
for i in $(seq 1 "$INTENTOS"); do
  echo "Intento $i/$INTENTOS: docker compose build web"
  if docker compose build web; then
    echo "Build OK"
    exit 0
  fi
  [ "$i" -lt "$INTENTOS" ] && echo "Reintentando en 15s..." && sleep 15
done
echo "Build falló tras $INTENTOS intentos. Revisa tu conexión a registry-1.docker.io y auth.docker.io."
exit 1
