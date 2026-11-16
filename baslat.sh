#!/bin/sh
# Şema Üretici başlatıcı — Electron varsa kendi penceresinde, yoksa tarayıcıda açar.
ELEKTRON=/home/ismail/.hermes/hermes-agent/node_modules/.bin/electron
UYGULAMA=/home/ismail/araclar/sema-uretici
HTML="$UYGULAMA/sema-uretici.html"

if [ -x "$ELEKTRON" ]; then
    exec "$ELEKTRON" "$UYGULAMA" "$@"
fi
exec xdg-open "$HTML"
