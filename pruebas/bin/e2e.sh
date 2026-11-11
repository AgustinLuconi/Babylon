#!/usr/bin/env bash
# e2e.sh ARCHIVO.js — corre un recorrido de Playwright con Node 24.
# Playwright no es dependencia del proyecto: PLAYWRIGHT_NODE_PATH apunta a una carpeta node_modules que lo tenga
# (ver pruebas/README.md). El navegador es Google Chrome del sistema (/usr/bin/google-chrome).
source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null
NODE_PATH="${PLAYWRIGHT_NODE_PATH:-$HOME/.npm/_npx/e41f203b7505f1fb/node_modules}" node "$@"
