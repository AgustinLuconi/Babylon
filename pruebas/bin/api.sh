#!/usr/bin/env bash
# api.sh start|stop — levanta o baja la API del server en :4000 (un solo proceso, con PID conocido).
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ/server" || exit 1
PIDF=/tmp/babylon-api.pid
parar() { [ -f $PIDF ] && kill $(cat $PIDF) 2>/dev/null; rm -f $PIDF; for i in $(seq 1 20); do ss -ltn 2>/dev/null | grep -q ":4000 " || break; sleep 0.3; done; }
case "$1" in
  stop) parar ;;
  start)
    parar
    source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
    nohup node --import tsx src/server.ts > /tmp/babylon-api.log 2>&1 &
    echo $! > $PIDF
    for i in $(seq 1 60); do curl -s -o /dev/null localhost:4000/api/auth/yo && break; sleep 0.5; done
    ;;
esac
