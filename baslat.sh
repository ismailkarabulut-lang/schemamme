#!/bin/sh
# SCHEMAMME · Şema Üretici başlatıcı
# Electron bulunursa kendi penceresinde açar; yoksa dosyayı varsayılan tarayıcıda açar.
# Yol sabit değil: betik hangi klasörde duruyorsa uygulama oradadır.
DIZIN=$(cd "$(dirname "$0")" && pwd)
ELEKTRON=$(command -v electron 2>/dev/null || true)
if [ -z "$ELEKTRON" ] && [ -x "$HOME/.hermes/hermes-agent/node_modules/.bin/electron" ]; then
    ELEKTRON="$HOME/.hermes/hermes-agent/node_modules/.bin/electron"
fi
if [ -n "$ELEKTRON" ] && [ -x "$ELEKTRON" ]; then
    exec "$ELEKTRON" "$DIZIN" "$@"
fi
exec xdg-open "$DIZIN/sema-uretici.html"
