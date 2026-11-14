# Descuento por hermanos que se recalcula — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `Alumno.aplicaDescuentoHermanos` se recalcule solo (baja, reactivación, cambio de responsable), avise a administración, secretaría y al responsable, y que una revisión única corrija lo existente; las cuotas ya generadas nunca cambian.

**Architecture:** Una función pura decide quién tiene descuento en una familia. `AlumnoService` la aplica dentro de la transacción de cada cambio, actualiza la marca del alumno (y la de su inscripción del ciclo activo) y publica un anuncio nuevo. El módulo `notificaciones/` se suscribe y crea avisos de evento. No hay cambios de esquema Prisma ni de código en `cuotas/` (la generación mensual ya lee la marca).

**Tech Stack:** TypeScript, Express 5, Prisma 6, `tsx --test` (pruebas puras), scripts `server/scripts/_*.ts` (con base y HTTP), Playwright (`pruebas/recorridos/`), React 19.

**Spec:** `docs/superpowers/specs/2026-11-13-descuento-hermanos-design.md` (el spec manda ante cualquier conflicto).

## Global Constraints

- Regla: entre los alumnos con `estado === "activo"` de un mismo `padreId`, paga completo el de `fechaInscripcion` más antigua (desempate por `id` ascendente); los demás, 10% (`PORCENTAJE_DESCUENTO_HERMANOS`, ya existe en `cuotas/`). Con un solo activo: sin descuento.
- **Ninguna cuota ya generada cambia** (ni pendiente, ni vencida, ni pagada). No se escribe en `cuotas/`.
- Todo cambio y su anuncio van dentro de la misma `unitOfWork.runInTransaction`, pasando `tx` a cada llamada al repositorio. Bloqueos: alumno → fichas de responsable, estas últimas en orden de `id`.
- Solo se recalculan alumnos **activos**; la marca de un alumno inactivo/egresado no se toca ni genera avisos.
- `Inscripcion.aplicaDescuentoHermanos` solo del ciclo activo; si el alumno no tiene fila ahí, se omite en silencio.
- Los avisos nunca nombran a un alumno que no es de la familia destinataria (padre). Una ficha sin cuenta activa no recibe aviso. Texto siempre termina con "Rige desde la próxima cuota que se genere."
- La revisión única nunca se ejecuta con `aplicar` contra la base real durante la implementación; las pruebas usan solo ids `prueba-tmp-*`. Dejar `Configuracion.valorCuota` en null.
- Server y client no comparten código: la regla pura vive dos veces (mismos nombres) y `server/tests/` prueba las dos copias con la misma tabla.
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No hacer push ni fusionar sin que el usuario lo pida.

## Review Focus

1. Tres hermanos y el primero se va y vuelve: siempre paga completo exactamente uno, y vuelve a ser el original.
2. Cambio de responsable hacia una familia donde el alumno es más antiguo que los existentes: es el que paga completo y el que ya estaba pasa a tener descuento (el aviso a la familia que lo recibe dice "se sumó un hermano a tu cargo" sin nombrarlo; el de administración y secretaría sí lo nombra).
3. Dos operaciones simultáneas sobre la misma familia no se traban ni dejan dos alumnos sin descuento.
4. Un alumno `inactivo` conserva su marca y no genera avisos; al reactivarse se recalcula.
5. Un adulto `propio` que estudia solo no tiene descuento; con un hijo suyo en el instituto, sí.

---

## File Structure

- Create `server/src/modules/alumnos/alumno.hermanos.ts` — reglas puras (descuento, correcciones).
- Modify `server/src/modules/alumnos/alumno.eventos.ts` — anuncio `alumnos.descuentoCambio`.
- Modify `server/src/modules/alumnos/alumno.service.ts` — recálculo en inscribir / actualizarAlumno / asignarResponsable.
- Create `server/src/modules/notificaciones/notificacion.descuento.ts` — textos puros de los avisos.
- Modify `notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.criterios.ts`, `notificacion.criterios.prisma.ts`, `notificacion.service.ts`, `notificacion.suscripciones.ts` — tipos y avisos nuevos.
- Create `client/src/features/alumnos/descuentoHermanos.ts` — copia de la regla; modify `AlumnoDetailPage.tsx`, `notificaciones/types.ts`, `notificaciones/rutas.ts`.
- Create `server/scripts/revisar-descuentos-hermanos.ts` — revisión única (`mostrar` / `aplicar --confirmo`).
- Tests: `server/tests/descuento-hermanos.test.ts`, `server/tests/descuento-textos.test.ts`, `server/scripts/_descuento-hermanos.ts`, `server/scripts/_descuento-revision.ts`, `pruebas/recorridos/e2e-descuento-hermanos.js`.
- Docs: `CLAUDE.md`, `pruebas/README.md`, `pruebas/bin/bateria.sh`.

---

### Task 1: Regla pura del descuento

**Files:**
- Create: `server/src/modules/alumnos/alumno.hermanos.ts`
- Test: `server/tests/descuento-hermanos.test.ts`

**Interfaces:**
- Produces:
  - `interface AlumnoParaDescuento { id: string; estado: "activo" | "inactivo" | "egresado"; fechaInscripcion: Date; aplicaDescuentoHermanos: boolean }`
  - `alumnosConDescuento(alumnos: AlumnoParaDescuento[]): Set<string>` — ids con descuento (solo activos).
  - `quienPagaCompleto(alumnos: AlumnoParaDescuento[]): string | null` — id del activo más antiguo, `null` si no hay activos.
  - `correccionesDeDescuento(alumnos: AlumnoParaDescuento[]): { alumnoId: string; aplica: boolean }[]` — solo activos cuya marca actual difiere de la correcta.

- [ ] **Step 1: Write the failing test** `server/tests/descuento-hermanos.test.ts` con `node:test`: casos (ids `a`,`b`,`c`, fechas crecientes): (1) uno activo → `Set` vacío y `quienPagaCompleto` = su id; (2) dos activos → solo el segundo con descuento; (3) tres activos → `b` y `c`; (4) `a` inactivo, `b` y `c` activos → solo `c`, paga completo `b`; (5) sin activos → vacío y `null`; (6) mismas fechas → desempate por `id` ascendente; (7) `correccionesDeDescuento` con marcas viejas (`a:true`, `b:true`) devuelve `[{alumnoId:"a",aplica:false}]`; (8) un inactivo con marca desactualizada **no** aparece en las correcciones.
- [ ] **Step 2: Run** `cd server && pnpm test` → Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** las tres funciones en `alumno.hermanos.ts` (sin imports externos; ordenar por `fechaInscripcion.getTime()` y luego `id`).
- [ ] **Step 4: Run** `pnpm test` → Expected: todos pasan (los 220 anteriores + los nuevos).
- [ ] **Step 5: Commit** (rama `descuento-hermanos`, creada desde `main` antes de este paso con `git switch -c descuento-hermanos`; incluir el spec y este plan en el primer commit):

```bash
git add docs/superpowers/specs/2026-11-13-descuento-hermanos-design.md docs/superpowers/plans/2026-11-14-descuento-hermanos.md server/src/modules/alumnos/alumno.hermanos.ts server/tests/descuento-hermanos.test.ts
git commit -m "Descuento por hermanos: diseño, plan y regla pura"
```

---

### Task 2: Textos de los avisos (puros)

**Files:**
- Create: `server/src/modules/notificaciones/notificacion.descuento.ts`
- Test: `server/tests/descuento-textos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CausaDescuento = "baja" | "reactivacion" | "cambio-responsable"`
  - `textoDeAvisoDeDescuento(p: { destinatario: "instituto" | "familia"; alumno: string; aplica: boolean; causa: CausaDescuento; alumnoDeLaCausa: string | null; esElQueSeMovio: boolean }): string`

Texto, con `{S}` = `" Rige desde la próxima cuota que se genere."`:
- `aplica=false`, `baja`: `"{alumno} pasó a pagar la cuota completa porque {alumnoDeLaCausa} se dio de baja.{S}"`.
- `aplica=true`, `reactivacion`: `"{alumno} pasó a tener 10% de descuento por hermanos porque {alumnoDeLaCausa} volvió a estar activo.{S}"`; `aplica=false`, `reactivacion`: `"{alumno} pasó a pagar la cuota completa porque {alumnoDeLaCausa} volvió a estar activo.{S}"`.
- `cambio-responsable`, `esElQueSeMovio=true`: `"{alumno} {pasó a tener 10% de descuento por hermanos | pasó a pagar la cuota completa} por el cambio de responsable.{S}"`.
- `cambio-responsable`, `esElQueSeMovio=false`: para `instituto` nombra a `alumnoDeLaCausa` (`"…porque {alumnoDeLaCausa} cambió de responsable."`); para `familia` **nunca lo nombra**: `aplica=false` → `"{alumno} pasó a pagar la cuota completa porque un hermano dejó de estar a tu cargo.{S}"`, `aplica=true` → `"{alumno} pasó a tener 10% de descuento por hermanos porque se sumó un hermano a tu cargo.{S}"`.
- Para `familia` con `baja`/`reactivacion` se usa el mismo texto que `instituto` (el alumno de la causa es de la misma familia).

- [ ] **Step 1: Write the failing test** con una aserción de igualdad exacta por cada texto de arriba, más una que verifica que el texto `familia` + `cambio-responsable` + `esElQueSeMovio=false` **no contiene** el nombre `alumnoDeLaCausa` (usar el nombre "Zoe Ajena").
- [ ] **Step 2: Run** `pnpm test` → Expected: FAIL.
- [ ] **Step 3: Implement** `textoDeAvisoDeDescuento` y exportar `CausaDescuento`.
- [ ] **Step 4: Run** `pnpm test` → Expected: PASS.
- [ ] **Step 5: Commit** `"Descuento por hermanos: textos de los avisos"`.

---

### Task 3: Anuncio y avisos de evento

**Files:**
- Modify: `server/src/modules/alumnos/alumno.eventos.ts`, `notificaciones/notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.criterios.ts`, `notificacion.criterios.prisma.ts`, `notificacion.service.ts`, `notificacion.suscripciones.ts`
- Modify: `client/src/features/notificaciones/types.ts`, `client/src/features/notificaciones/rutas.ts`
- Test: `server/scripts/_descuento-avisos.ts` (con base, patrón de `_avisos-chat.ts`: `crearMundo`/`limpiarMundo` de `_mundo-avisos`, `ok(etiqueta, real, esperado)`; agregarlo a `pruebas/bin/bateria.sh` en la primera lista de scripts sin API)

**Interfaces:**
- Consumes: `CausaDescuento`, `textoDeAvisoDeDescuento` (Task 2).
- Produces:
  - `export interface CambioDeDescuento { alumnoId: string; aplica: boolean; causa: CausaDescuento; alumnoDeLaCausaId: string | null }`
  - En `EventosAlumnos`: `"alumnos.descuentoCambio": { cambios: CambioDeDescuento[] }`.
  - `NotificacionService.descuentoCambiado(cambios: CambioDeDescuento[], tx: unknown): Promise<void>`.
  - `CriteriosDeAvisos.descuentoCambiado(cambios: CambioDeDescuento[], ahora: Date, tx?: unknown): Promise<AvisoEsperado[]>`.
  - Tipos de aviso nuevos (evento): `descuento_hermanos_instituto` (grupo `staff`, etiqueta "Cambios en el descuento por hermanos") y `descuento_hermanos` (grupo `padre`, misma etiqueta). `RecursoAviso` suma `{ tipo: "alumno"; alumnoId: string }` (staff); el aviso de padre usa el recurso `hijo` existente.

- [ ] **Step 1: Write the failing test** `_descuento-avisos.ts`: con el mundo de prueba (padre con cuenta, admin, secretario) y alumnos `prueba-tmp-av*`, publicar `alumnos.descuentoCambio` en el `TableroDeAnuncios` real dentro de `uow.runInTransaction` (como `_avisos-chat.ts`) y comprobar: (a) admin y secretario reciben un aviso `descuento_hermanos_instituto` con clave `descuento:<alumnoId>:<momento>`, texto de `textoDeAvisoDeDescuento` con `destinatario:"instituto"`, recurso `{tipo:"alumno",alumnoId}`; (b) el padre con cuenta recibe `descuento_hermanos` con recurso `{tipo:"hijo",alumnoId}` y texto `destinatario:"familia"`; (c) un padre **sin** cuenta activa no recibe nada; (d) un alumno `inactivo` en el cambio no genera avisos; (e) un padre que apagó la preferencia del tipo no recibe; (f) un cambio posterior del mismo alumno crea otro aviso (clave distinta). Expected inicial: FAIL (anuncio inexistente).
- [ ] **Step 2: Run** `pnpm exec tsx scripts/_descuento-avisos.ts | python3 ../pruebas/bin/chequear.py` → Expected: FAIL.
- [ ] **Step 3: Implement** el anuncio, los tipos (server y client), el catálogo, el criterio en `PrismaCriteriosDeAvisos` (leer alumno con `padreId` y `estado`; `staff()` + `cuentasDePadres()`; para `esElQueSeMovio` comparar `alumnoId === alumnoDeLaCausaId` con causa `cambio-responsable`), `NotificacionService.descuentoCambiado` (→ `registrarEventos`), la suscripción `tablero.alPublicarse("alumnos.descuentoCambio", ...)` y `rutaDeAviso` (`case "alumno"` → `/alumnos/${alumnoId}`). Si el typecheck de client o server señala otros `Record<TipoNotificacion, …>` o `switch` exhaustivos, completarlos.
- [ ] **Step 4: Run** el script de arriba → Expected: todo OK; `pnpm typecheck` en `server/` y `client/` limpios; `pnpm exec tsx scripts/_suscripciones.ts | python3 ../pruebas/bin/chequear.py` sigue OK (actualizar su tabla si enumera las suscripciones).
- [ ] **Step 5: Commit** `"Descuento por hermanos: anuncio y avisos de evento"`.

---

### Task 4: Recálculo en el servicio de alumnos

**Files:**
- Modify: `server/src/modules/alumnos/alumno.service.ts` (`inscribirAlumno` ~178-247, `asignarResponsable` ~252-279, `actualizarAlumno` ~281-358, comentario de `asignarResponsable`)
- Test: `server/scripts/_descuento-hermanos.ts` (por HTTP contra la API en marcha, mismo esquema que `_3d-responsable.ts`; agregarlo a la segunda lista de `bateria.sh`)

**Interfaces:**
- Consumes: `alumnosConDescuento`, `quienPagaCompleto` (Task 1); `CambioDeDescuento`, anuncio `alumnos.descuentoCambio` (Task 3).
- Produces: método privado `AlumnoService.recalcularDescuentos(padreIds: string[], causa: CausaDescuento, alumnoDeLaCausaId: string, tx: unknown): Promise<string[]>` — devuelve los ids de alumnos cuya marca cambió. Para cada `padreId` único, en orden de `id`: `padreRepo.bloquear`, `alumnoRepo.findByPadreId(padreId, tx)`, `correccionesDeDescuento`; cada corrección: `alumnoRepo.actualizarParcial(id, { aplicaDescuentoHermanos }, tx)` y, si hay ciclo activo y fila de inscripción, `cicloRepo.actualizarInscripcion(id, cicloActivo.id, { aplicaDescuentoHermanos }, tx)`. Si hubo cambios publica `anuncios.publicar("alumnos.descuentoCambio", { cambios }, tx)`.

- [ ] **Step 1: Write the failing test** `_descuento-hermanos.ts` (login admin del mundo `_mundo-avisos`; alumnos/fichas `prueba-tmp-av*`; limpiar al final): (1) inscribir A y luego B con el mismo responsable → A `false`, B `true`; (2) con tres (A,B,C) → A `false`, B y C `true`; (3) baja de A → B `false`, C `true`, aviso a admin y al padre con cuenta, y A conserva su marca; (4) reactivar A → B `true` otra vez, A `false`; (5) cambio de responsable de B a otra familia con otro alumno más antiguo: B `true` en la nueva; en la vieja C pasa a `false` si queda solo con A… (armar el caso con dos familias y verificar las marcas finales de ambas) y avisos a las dos familias; el aviso a la familia vieja **no contiene** el nombre de B; (6) con `prisma` directo: una cuota `prueba-tmp-cuota-*` de B creada antes del cambio conserva `descuento`, `montoBase`, `montoFinal` y `estado` idénticos después de la baja de A; (7) adulto `propio` solo (`vinculoResponsable:"propio"`) → `false`; se le agrega un hijo con él de responsable → ambos activos, el más antiguo `false`, el otro `true`; (8) `Inscripcion.aplicaDescuentoHermanos` del ciclo activo acompaña a la marca cuando hay fila, y sin fila no falla (alumno creado sin ciclo activo o fila borrada a mano); (9) dos `PATCH` de baja simultáneos (A y B de una familia de tres, `Promise.all`) terminan con exactamente un activo que paga completo y sin error 500. Expected inicial: FAIL.
- [ ] **Step 2: Run** (`bash pruebas/bin/api.sh start` antes) `cd server && pnpm exec tsx scripts/_descuento-hermanos.ts | python3 ../pruebas/bin/chequear.py` → Expected: FAIL.
- [ ] **Step 3: Implement** el método y engancharlo:
  - `inscribirAlumno`: reemplazar `hermanosActivos.length >= 1` por `alumnosConDescuento([...hermanosActivos, nuevoComoParaDescuento]).has(nuevo.id)` (el nuevo se arma antes de `create`, así el cálculo y el alta usan la misma función). **No** llamar al recálculo ni generar avisos al inscribir (decisión: inscribir no es un cambio para la familia; la fecha del nuevo es la más reciente, así que no altera a los demás).
  - `actualizarAlumno`: tras `actualizarParcial`, si `actual.estado !== resultado.estado` y `resultado.padreId`, llamar a `recalcularDescuentos([resultado.padreId], estado === "activo" ? "reactivacion" : "baja", id, tx)`; sumar los ids devueltos a `alumnoIds` del `datos.cambiaron` que ya se publica.
  - `asignarResponsable`: tras `actualizarParcial`, llamar a `recalcularDescuentos([actual.padreId, resuelto.padre.id].filter(Boolean), "cambio-responsable", id, tx)` (solo si cambió de ficha); sumar los ids devueltos a `alumnoIds`. Actualizar el comentario que decía "no se recalcula acá".
- [ ] **Step 4: Run** el script → Expected: todo OK. Luego `pnpm typecheck && pnpm test` y los scripts existentes que tocan alumnos: `_3d-responsable`, `_3d-menores`, `_nomina-activos`, `_cambios-publicados`, `_cambios-privacidad` → todos OK (el motivo de la parte de ids en `datos.cambiaron` es que `_cambios-privacidad` siga viendo ids recortados por familia).
- [ ] **Step 5: Commit** `"Descuento por hermanos: se recalcula al dar de baja, reactivar y cambiar de responsable"`.

---

### Task 5: Legajo y copia de la regla en el client

**Files:**
- Create: `client/src/features/alumnos/descuentoHermanos.ts`
- Modify: `client/src/features/alumnos/pages/AlumnoDetailPage.tsx` (bloque de hermanos, ~línea 408; el título del panel de cuotas ~652 ya muestra "10% descuento hermano")
- Modify: `server/tests/descuento-hermanos.test.ts` (importar la copia del client por ruta relativa y correr la misma tabla)
- Test: `pruebas/recorridos/e2e-descuento-hermanos.js` (Playwright + Chrome, patrón de `e2e-3d-inscribir.js`; usa alumnos `prueba-tmp-av*`)

**Interfaces:**
- Consumes: reglas de Task 1.
- Produces (client): mismas `alumnosConDescuento` y `quienPagaCompleto` (mismos nombres y semántica; sin alias `@/`, porque se prueban desde `server/tests/`).

- [ ] **Step 1: Write the failing test:** en `descuento-hermanos.test.ts`, ejecutar la misma tabla de casos 1-8 de Task 1 contra la copia del client (refactor: la tabla en un array y un `for` sobre `[server, client]`). Y escribir `e2e-descuento-hermanos.js`: abrir el legajo de un alumno con descuento y esperar el texto `Descuento por hermanos: sí` y el nombre del hermano que paga completo; abrir el de quien paga completo y esperar `Descuento por hermanos: no`; dar de baja desde la pantalla y comprobar que, sin recargar, el legajo del hermano pasa a `no`; abrir la campana como secretaría y encontrar el aviso con su texto.
- [ ] **Step 2: Run** `cd server && pnpm test` → Expected: FAIL (falta la copia del client).
- [ ] **Step 3: Implement** la copia en `descuentoHermanos.ts` y, en `AlumnoDetailPage`, mostrar en el bloque de hermanos una línea `Descuento por hermanos: sí — comparte con <nombre> (paga la cuota completa)` si `alumno.aplicaDescuentoHermanos` y es activo, o `Descuento por hermanos: no` si hay hermanos activos y no lo tiene; el nombre sale de `quienPagaCompleto` sobre los hermanos activos de `alumnos` (ya cargados por `useAlumnos`). La marca guardada manda para el sí/no; la función solo identifica a quién nombrar. No tocar nada del panel del padre.
- [ ] **Step 4: Run** `pnpm test` → Expected: PASS. `cd client && pnpm typecheck && pnpm lint` limpios. El recorrido e2e (`bash pruebas/bin/api.sh start; bash pruebas/bin/client.sh start; bash pruebas/bin/e2e.sh pruebas/recorridos/e2e-descuento-hermanos.js | python3 pruebas/bin/chequear.py`) → Expected: todo OK.
- [ ] **Step 5: Commit** `"Descuento por hermanos: se ve en el legajo"`.

---

### Task 6: Revisión única de lo existente

**Files:**
- Create: `server/scripts/revisar-descuentos-hermanos.ts`
- Test: `server/scripts/_descuento-revision.ts` (con base; agregarlo a la primera lista de `bateria.sh`)

**Interfaces:**
- Consumes: `correccionesDeDescuento` (Task 1).
- Produces: en el script, `export async function revisar(prisma: PrismaClient, opciones: { aplicar: boolean; prefijoDeId?: string }): Promise<{ alumnoId: string; nombre: string; de: boolean; a: boolean }[]>` — agrupa por `padreId` los alumnos (solo los que empiezan con `prefijoDeId` si se pasa), calcula las correcciones, **si `aplicar`** actualiza `Alumno.aplicaDescuentoHermanos` y la `Inscripcion` del ciclo activo (si existe); nunca toca cuotas ni publica avisos. CLI: `pnpm exec tsx scripts/revisar-descuentos-hermanos.ts mostrar` imprime `Nombre Apellido: pasa de 10% a completo` / `de completo a 10%`; `aplicar --confirmo` ejecuta; `aplicar` sin `--confirmo` imprime un error y no hace nada. El bloque CLI solo corre con `require.main === module`.

- [ ] **Step 1: Write the failing test** `_descuento-revision.ts`: crear con `prisma` dos familias `prueba-tmp-av*` con marcas viejas incorrectas; `revisar(prisma, { aplicar: false, prefijoDeId: "prueba-tmp-" })` devuelve las correcciones esperadas y **no cambia** ninguna fila; con `aplicar: true` las marcas quedan correctas, las `Cuota` `prueba-tmp-*` creadas antes quedan idénticas, no se crean `Notificacion`, y los alumnos reales (sin prefijo) no cambian (contar filas reales con marca distinta antes y después: igual). Expected inicial: FAIL.
- [ ] **Step 2: Run** `pnpm exec tsx scripts/_descuento-revision.ts | python3 ../pruebas/bin/chequear.py` → Expected: FAIL.
- [ ] **Step 3: Implement** `revisar` y el CLI. La prueba **nunca** pasa `aplicar: true` sin `prefijoDeId`.
- [ ] **Step 4: Run** el script de prueba → OK. Luego, **solo `mostrar`** contra la base real: `pnpm exec tsx scripts/revisar-descuentos-hermanos.ts mostrar` y guardar la salida para mostrársela al usuario (no ejecutar `aplicar`).
- [ ] **Step 5: Commit** `"Descuento por hermanos: revisión única de lo existente (mostrar / aplicar)"`.

---

### Task 7: Documentación y batería completa

**Files:**
- Modify: `CLAUDE.md` (secciones "Reglas de negocio transversales", "Cuotas: generación automática…", avisos y `asignarResponsable`; quitar "se calcula al inscribir y no se recalcula"), `pruebas/README.md` (filas de los scripts y del recorrido nuevos), `pruebas/bin/bateria.sh` (ya con los scripts de las Tasks 3-6)

- [ ] **Step 1:** Actualizar `CLAUDE.md` y `pruebas/README.md` con: la regla única, cuándo se recalcula, "las cuotas ya generadas no cambian; rige para las que se generen después", los tipos de aviso nuevos, el anuncio `alumnos.descuentoCambio`, la revisión única (`mostrar`/`aplicar --confirmo`, solo con autorización del usuario y respaldo previo) y la nota de que `Inscripcion` del ciclo activo acompaña a la marca.
- [ ] **Step 2:** Respaldo `docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/antes-descuento-hermanos-$(date +%F).dump` (por prolijidad, aunque no hay migración).
- [ ] **Step 3: Run** `bash pruebas/bin/bateria.sh > pruebas/bin/bateria.log 2>&1` y revisar el log. Expected: todos los bloques sin fallas (los 71 anteriores + `_descuento-avisos`, `_descuento-hermanos`, `_descuento-revision`, `e2e-descuento-hermanos`), la línea BASE `3/148/0/null/inactivo` intacta y `valorCuota` en null.
- [ ] **Step 4: Commit** `"Descuento por hermanos: documentación y batería"`.
- [ ] **Step 5:** No fusionar ni pushear. Informar al usuario: resultado de la batería, la salida de `mostrar` contra la base real (para que decida si corre `aplicar`) y preguntar si fusiona a `main`.
