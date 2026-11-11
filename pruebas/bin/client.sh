#!/usr/bin/env bash
# client.sh start|stop — levanta o baja Vite en :5173.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ/client" || exit 1
PIDF=/tmp/babylon-client.pid
parar() { [ -f $PIDF ] && kill $(cat $PIDF) 2>/dev/null; rm -f $PIDF; for i in $(seq 1 20); do ss -ltn 2>/dev/null | grep -q ":5173 " || break; sleep 0.3; done; }
case "$1" in
  stop) parar ;;
  start)
    parar
    source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
    nohup node node_modules/vite/bin/vite.js --port 5173 --strictPort > /tmp/babylon-client.log 2>&1 &
    echo $! > $PIDF
    for i in $(seq 1 60); do curl -s -o /dev/null localhost:5173 && break; sleep 0.5; done
    ;;
esac
