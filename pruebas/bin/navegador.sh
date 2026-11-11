# Solo los recorridos de navegador. Uso: bash pruebas/bin/navegador.sh > pruebas/bin/navegador.log 2>&1
S="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ/server"
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
"$S"/api.sh start; "$S"/client.sh start
for f in "$S"/../recorridos/e2e-*.js; do e=$(basename "$f" .js); pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null; pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null; echo "== $e: $(timeout 280 bash "$S"/e2e.sh "$f" 2>&1 | python3 "$S"/chequear.py | tail -6)"; "$S"/api.sh start; done
pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
docker exec babylon-postgres psql -U babylon -d babylon -tAc "update \"Configuracion\" set \"valorCuota\"=null" >/dev/null
echo "== BASE: padres reales/alumnos reales/prueba-tmp/valorCuota: $(docker exec babylon-postgres psql -U babylon -d babylon -tAc "select (select count(*) from \"Padre\" where id not like 'prueba-%') || '/' || (select count(*) from \"Alumno\" where id not like 'prueba-%') || '/' || (select count(*) from \"Alumno\" where id like 'prueba-tmp%') || '/' || coalesce((select \"valorCuota\"::text from \"Configuracion\"),'null')")"
"$S"/api.sh stop; "$S"/client.sh stop
echo terminado
