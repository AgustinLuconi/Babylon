# Pruebas de verificación

Además de `pnpm test` (funciones puras), el proyecto tiene tres capas de verificación que **usan la base de datos de
desarrollo y la API real**. Sirven para comprobar una funcionalidad antes de fusionarla o después de tocarla.

| Capa | Dónde está | Qué prueba | Necesita |
|---|---|---|---|
| Funciones puras | `server/tests/*.test.ts` (`pnpm test` en `server/`) | Validadores, reconciliaciones, reglas del client | Nada |
| Scripts del servidor | `server/scripts/_*.ts` | Servicios, repositorios, permisos y HTTP contra la base real | Postgres (y la API para los que dicen "HTTP") |
| Recorridos de navegador | `pruebas/recorridos/e2e-*.js` | Lo que ve y hace cada rol en la pantalla, con varias cuentas a la vez | Postgres, API, Vite y Google Chrome |

## Cómo funcionan

**Un mundo de prueba.** Todo lo que crean estas pruebas lleva el prefijo `prueba-tmp-av` (ids) o el nombre `Pruebaav`.
`server/scripts/_mundo-avisos.ts` lo arma (`crear`), lo borra (`borrar`) y recalcula los avisos (`sincronizar`): un
administrador, una secretaria, un profesor con su curso, dos familias con tres alumnos y una cuenta con dos roles. Todas
las cuentas usan la contraseña `prueba1234` y el email `prueba-tmp-av-<quien>@prueba.babylon.test`. **Nunca tocan los
datos reales**: `borrar` solo elimina lo del prefijo, y las pruebas que editan lo hacen sobre esos registros.

**Cada comprobación imprime una línea** con el formato `etiqueta: real (esperado X)`. `pruebas/bin/chequear.py` lee esas
líneas, cuenta las que coinciden y muestra las que fallan (`N bien, M mal`). Una prueba sin ninguna línea "mal" pasó.

**Los recorridos de navegador** abren Chrome con Playwright, entran con varias cuentas del mundo de prueba (por ejemplo la
familia, la secretaria y el administrador a la vez) y verifican que un cambio hecho por una se vea en vivo en la otra. Algunos
hacen cosas por la API o por SQL para preparar o forzar una situación (por ejemplo, un mensaje de hace 16 minutos).

## Cómo correrlas

Requisitos: Postgres levantado (`docker compose up -d`), `server/.env` y `client` instalados, y Playwright disponible.
Playwright no es dependencia del proyecto: `pruebas/bin/e2e.sh` busca una carpeta `node_modules` que lo tenga en
`PLAYWRIGHT_NODE_PATH` (si no está definida, usa una caché de `npx`). Para tenerlo: `npx playwright@latest --version` una vez,
y apuntar `PLAYWRIGHT_NODE_PATH` a la carpeta `node_modules` que quede en `~/.npm/_npx/<hash>/`.

```bash
# Un script del servidor (los "HTTP" necesitan la API levantada: bash pruebas/bin/api.sh start)
cd server && pnpm exec tsx scripts/_chat-editar.ts | python3 ../pruebas/bin/chequear.py

# Un recorrido de navegador (levantar antes la API y Vite)
bash pruebas/bin/api.sh start; bash pruebas/bin/client.sh start
cd server && pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts crear
bash ../pruebas/bin/e2e.sh ../pruebas/recorridos/e2e-chat-editar.js | python3 ../pruebas/bin/chequear.py

# Todos los recorridos de navegador (~10 minutos)
bash pruebas/bin/navegador.sh > /tmp/navegador.log 2>&1

# Todo: compilación, pruebas puras, scripts del servidor y recorridos (~15 minutos)
bash pruebas/bin/bateria.sh > /tmp/bateria.log 2>&1
```

La batería termina con una línea `BASE:` que confirma que los datos reales siguen intactos (padres reales / alumnos
reales / restos de prueba / valor de cuota). Debe decir `3/148/0/null`.

## Qué hay que saber antes de correrlas

- **Corren sobre la base de desarrollo**, no sobre una copia. Antes de una tanda que edita, conviene un respaldo
  (`docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/<nombre>.dump`).
- Dejan `Configuracion.valorCuota` en `null` al terminar (el programador de cuotas crearía cuotas de verdad si hubiera un valor).
- `_sesiones` usa la cuenta de prueba `p6@prueba.babylon.test` (datos de prueba 2026): la batería la activa solo durante la
  corrida y la restaura.
- `e2e-3c-version` y algunos más reinician la API con otra `APP_VERSION` (`pruebas/bin/reiniciar-api.sh`).
- Al editar por pantalla, apuntar el selector con precisión (el buscador de la barra superior no es el de la pantalla) y
  afirmar el id del recurso en la URL del `PATCH`: una prueba que editó un registro equivocado ya pasó 14 de 14.
- Cada recorrido empieza de cero: la batería borra y vuelve a crear el mundo antes de cada uno.

## Qué cubre cada recorrido

| Recorrido | Cubre |
|---|---|
| `e2e-cuentas-admin` | Cuentas administradas: Sin cuenta → Crear cuenta (email autocompletado), ingreso de la familia, editar contraseña y roles, Crear usuario, aviso de email existente, y que no queda recuperación ni cambio propio |
| `e2e-sesiones-pestanas` | Una sesión por pestaña: dos cuentas a la vez en el mismo navegador, recargar la conserva, cerrar sesión en una no toca la otra, una pestaña nueva arranca sin sesión |
| `e2e-filtros-tanda-2` | Filtros en la dirección de Reportes, Cursos, Observaciones y el legajo: el enlace los trae puestos, recargar los conserva y lo inválido o ajeno cae en el valor por defecto |
| `e2e-chat-editar` | Corregir y eliminar mensajes del chat, quién puede, plazo de 15 minutos |
| `e2e-chat-detalles`, `e2e-chat-revision` | Chat en vivo: "Visto", no leídos, reintentos, conversación nueva |
| `e2e-3bc-vivo` | Lo en vivo de 3b y 3c: avisos del chat y "quién hizo qué" |
| `e2e-3c-*` | Pantallas al día: resaltado, avisos de nómina, versión nueva, cambios sin guardar |
| `e2e-3d-*` | Formularios: inscripción, legajo, cursos y profesores, datos incompletos, panel del responsable |
| `e2e-asistencia-fecha`, `e2e-cierre`, `e2e-profe-flujos` | Flujos del profesor |

Si se agrega una funcionalidad, lo ideal es sumar su script `server/scripts/_<tema>.ts` y, si tiene pantalla, un recorrido en
`pruebas/recorridos/`, y agregarlos a `pruebas/bin/bateria.sh`. Los scripts `_*.ts` están excluidos de git en cada compu
(`.git/info/exclude`); para versionar uno nuevo hace falta `git add -f`.
