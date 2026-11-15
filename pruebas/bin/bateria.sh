# Batería completa de verificación. Uso: bash pruebas/bin/bateria.sh > pruebas/bin/bateria.log 2>&1
S="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ/server"
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
crear() { pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null; }
echo "== server typecheck+build+test: $(pnpm typecheck >/dev/null && pnpm build >/dev/null && pnpm test 2>&1 | grep -E '^ℹ (pass|fail)' | tr '\n' ' ')"
echo "== client typecheck+build: $(cd ../client && pnpm typecheck >/dev/null && pnpm build >/dev/null 2>&1 && echo ok || echo FALLA) / lint: $(cd ../client && pnpm lint 2>&1 | grep problems)"
for s in _autoria _cambios-destinatarios _cambios-difusion _cambios-claves _cambios-mensajes _cambios-programador _autor-observacion _chat-repo _chat-servicio _chat-editar _avisos-chat _suscripciones _visto _canal _tablero _reconciliar _faltantes _criterios _avisos-servicio _lector-sse _resolver-lote _preferencia-bloqueo _historial-cursor _descuento-avisos _descuento-revision _ciclo-bloqueo _ciclo-guarda _ciclo-inscribir _ciclo-guardas-servicios _pase-de-anio _aviso-ciclo-por-cerrar _pase-de-anio-detalles _ciclo-carrera-inscribir _categoria-pase; do echo "== $s: $(timeout 170 pnpm exec tsx scripts/$s.ts 2>&1 | python3 "$S"/chequear.py | tail -3)"; done
for s in _3d-validacion-http _3d-parcial _3d-responsable _3d-incompletos _3d-menores _notas-numericas _sin-correo _cuentas-crear _cuentas-editar _cuentas-revision _cuentas-menores _chat-editar-http _cambios-publicados _cambios-privacidad _nomina-activos _chat-en-vivo _tiempo-real _carrera-login _descuento-hermanos _ciclo-bloqueado _nomina-inscripciones _historial-cursos; do "$S"/api.sh start; echo "== $s: $(timeout 170 pnpm exec tsx scripts/$s.ts 2>&1 | python3 "$S"/chequear.py | tail -3)"; done
ESTADO_P6=$(docker exec babylon-postgres psql -U babylon -d babylon -tAc "select estado from \"Usuario\" where email='p6@prueba.babylon.test'")
docker exec babylon-postgres psql -U babylon -d babylon -tAc "update \"Usuario\" set estado='activo' where email='p6@prueba.babylon.test'" >/dev/null
"$S"/api.sh start; echo "== _sesiones: $(timeout 170 pnpm exec tsx scripts/_sesiones.ts 2>&1 | python3 "$S"/chequear.py | tail -3)"
docker exec babylon-postgres psql -U babylon -d babylon -tAc "update \"Usuario\" set estado='$ESTADO_P6' where email='p6@prueba.babylon.test'" >/dev/null
echo "== _version: $(timeout 170 pnpm exec tsx scripts/_version.ts 2>&1 | python3 "$S"/chequear.py | tail -3)"
"$S"/api.sh start; "$S"/client.sh start
for f in "$S"/../recorridos/e2e-*.js; do e=$(basename "$f" .js); pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null; crear; echo "== $e: $(timeout 280 bash "$S"/e2e.sh "$f" 2>&1 | python3 "$S"/chequear.py | tail -4)"; "$S"/api.sh start; done
pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
docker exec babylon-postgres psql -U babylon -d babylon -tAc "update \"Configuracion\" set \"valorCuota\"=null" >/dev/null
echo "== BASE: padres reales/alumnos reales/prueba-tmp/valorCuota/p6: $(docker exec babylon-postgres psql -U babylon -d babylon -tAc "select (select count(*) from \"Padre\" where id not like 'prueba-%') || '/' || (select count(*) from \"Alumno\" where id not like 'prueba-%') || '/' || (select count(*) from \"Alumno\" where id like 'prueba-tmp%') || '/' || coalesce((select \"valorCuota\"::text from \"Configuracion\"),'null') || '/' || (select estado from \"Usuario\" where email='p6@prueba.babylon.test')")"
"$S"/api.sh stop; "$S"/client.sh stop
echo terminado
