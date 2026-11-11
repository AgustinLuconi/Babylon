#!/usr/bin/env bash
# La usan algunos recorridos para reiniciar la API (por ejemplo con otra APP_VERSION en el entorno).
bash "$(dirname "${BASH_SOURCE[0]}")/api.sh" start
