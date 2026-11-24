# Clase sin dictar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El profesor puede marcar una clase de su curso como "sin clases" desde la pantalla de asistencia: ese día no cuenta como falta ni como presente, no admite asistencia, no genera el aviso de asistencia pendiente y se ve como "Sin clases" en los calendarios (la familia, sin el motivo).

**Architecture:** Una entidad nueva `ClaseSinDictar` (por curso y día, secundaria del módulo `asistencia/`, gestionada por `AsistenciaRepository`). `AsistenciaService` suma `marcarSinClases`, `quitarSinClases` y dos lecturas; marcar y registrar asistencia de la misma clase toman el mismo bloqueo (`pg_advisory_xact_lock`) para que no puedan cruzarse. Todo lo que cuenta asistencia cuenta filas de `Asistencia`, así que reportes y racha de faltas no cambian solos; el aviso `asistencia_pendiente` y los calendarios sí se actualizan.

**Tech Stack:** Express 5, Prisma 6, PostgreSQL 18, Zod; React 19, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-24-clase-sin-dictar-design.md`

**Rama:** `clase-sin-dictar` (desde `main`).

## Global Constraints

- Node/pnpm: antes de cualquier comando `source ~/.nvm/nvm.sh && nvm use`. Server: `pnpm typecheck`, `pnpm test`. Client: `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Feature-first: nada de carpetas `domain/`, `data/`, `presentation/`. Los services reciben repositorios por constructor, lanzan errores de `core/errors.ts` (nunca códigos HTTP); `container.ts` es el único lugar que instancia repositorios. Todo método de repositorio acepta `tx?: unknown` al final y el service lo reenvía a **cada** llamada dentro de `runInTransaction`. Publicar anuncios siempre dentro de la transacción y con `tx`.
- Server y client no comparten código. Fechas: `Date` a medianoche UTC en la base (como `Asistencia.fecha`); "hoy" siempre con `hoyISOEnArgentina()`/`inicioDeHoyUtc()`, nunca `toISOString()` sobre "ahora"; en las pruebas de navegador, fechas locales de Argentina.
- **La familia nunca recibe el motivo**: se quita en el service (no en la pantalla). Una familia solo ve a su propio hijo.
- Textos exactos de error/ayuda:
  - "Ese día ya tiene asistencia guardada: no se puede marcar como sin clases"
  - "Esa clase está marcada como sin clases: quitá la marca para tomar asistencia"
  - botón "Marcar sin clases", aviso "Clase sin dar", acción "Quitar marca", leyenda y etiqueta "Sin clases".
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Respaldo `pg_dump -Fc` en `~/respaldos-babylon/` antes de la migración. Los scripts nuevos `server/scripts/_*.ts` se versionan con `git add -f`. Probar siempre con `_mundo-avisos.ts` (prefijo `prueba-tmp-av`) y dejar `valorCuota` en `null`.

## Review Focus

- La familia no recibe el motivo ni por error (respuesta cruda del servidor, no solo la pantalla) y no ve el de un alumno ajeno (Task 3, Task 5).
- Un día marcado no cuenta en ningún lado: no crea ni toca filas de `Asistencia`, no genera aviso pendiente, no corta ni alarga la racha de faltas (Task 2, Task 4).
- Carrera: marcar "sin clases" y guardar asistencia del mismo curso y día a la vez nunca dejan las dos cosas (Task 2).
- La marca vale para todos los alumnos inscriptos en el curso, también los que se inscriban después, y un ciclo bloqueado rechaza marcar y quitar (Task 2, Task 3).
- La pantalla del profesor no deja guardar asistencia en una clase marcada ni marcar una que ya tiene asistencia, y los meses del calendario incluyen los días sin clases aunque el alumno no tenga ninguna fila ese mes (Task 5, Task 6).

---

### Task 1: Datos — migración, entidad y repositorio

**Files:**
- Modify: `server/prisma/schema.prisma`, `server/src/modules/asistencia/asistencia.entity.ts`, `asistencia.repository.ts`, `asistencia.repository.prisma.ts`, `server/scripts/_mundo-avisos.ts` (`limpiarMundo`), `server/scripts/datos-prueba-2026.ts` (`borrar`)
- Create: `server/prisma/migrations/<fecha>_clase_sin_dictar/migration.sql` (generada), `server/scripts/_asistencia-sin-clases-datos.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  // asistencia.entity.ts
  export interface ClaseSinDictar { id: string; cursoId: string; fecha: Date; motivo?: string; registradaPor: string; creadaEn: Date }
  // AsistenciaRepository (todos con tx?: unknown al final)
  findClaseSinDictar(cursoId: string, fecha: Date): Promise<ClaseSinDictar | null>
  crearClaseSinDictar(clase: ClaseSinDictar): Promise<ClaseSinDictar>
  actualizarMotivoDeClaseSinDictar(id: string, motivo: string | null): Promise<ClaseSinDictar>
  eliminarClaseSinDictar(id: string): Promise<void>
  findSinDictarByCursoId(cursoId: string): Promise<ClaseSinDictar[]>        // la más nueva primero
  findSinDictarByAlumnoId(alumnoId: string): Promise<ClaseSinDictar[]>      // de los cursos en que el alumno está o estuvo inscripto
  contarRegistrosDelDia(cursoId: string, fecha: Date): Promise<number>      // filas de Asistencia de ese curso y día
  bloquearClase(cursoId: string, fecha: Date): Promise<void>                // pg_advisory_xact_lock de (curso, día)
  ```

- [ ] **Step 1: Write the failing script `_asistencia-sin-clases-datos.ts`** (formato `ok("etiqueta", real, esperado)` de `scripts/_check.ts`, con `try/finally` que limpia con `limpiarMundo` y `process.exit(0)`), con `PrismaAsistenciaRepository` real sobre el mundo de avisos: crear una marca y encontrarla por (curso, fecha); no se puede crear otra igual (índice único); actualizar y borrar el motivo; `findSinDictarByCursoId` ordena la más nueva primero; `findSinDictarByAlumnoId(m.hijo1)` trae las marcas del curso donde está inscripto y no las de otro curso; `contarRegistrosDelDia` cuenta filas de `Asistencia` de ese día; `bloquearClase` corre dentro de `prisma.$transaction` sin error; borrar un curso con marcas falla (RESTRICT). Expected antes de implementar: FALLA (métodos inexistentes).
- [ ] **Step 2: Respaldo y migración.** `mkdir -p ~/respaldos-babylon && docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/antes-clase-sin-dictar-$(date +%F).dump`. En `schema.prisma`: `model ClaseSinDictar { id String @id; cursoId String; curso Curso @relation(fields: [cursoId], references: [id], onDelete: Restrict); fecha DateTime; motivo String?; registradaPor String; creadaEn DateTime @default(now()); @@unique([cursoId, fecha]); @@index([cursoId]) }` y `clasesSinDictar ClaseSinDictar[]` en `Curso`. `pnpm exec prisma migrate dev --name clase_sin_dictar` y `pnpm prisma:generate`.
- [ ] **Step 3: Implement.** Entidad y métodos según Interfaces (en `PrismaAsistenciaRepository`; `bloquearClase` con `$executeRaw` de `SELECT pg_advisory_xact_lock(hashtextextended(${"asistencia:" + cursoId + ":" + fecha.toISOString().slice(0,10)}, 0))`; `findSinDictarByAlumnoId` con `where: { curso: { inscripciones: { some: { alumnoId } } } }`). En `limpiarMundo` borrar `claseSinDictar` de los cursos del mundo antes de `curso.deleteMany`; en `datos-prueba-2026.ts borrar`, antes de `curso.deleteMany(w)`.
- [ ] **Step 4: Verify.** `pnpm exec tsx scripts/_asistencia-sin-clases-datos.ts | python3 ../pruebas/bin/chequear.py` → "0 mal"; `pnpm typecheck`; `pnpm test`.
- [ ] **Step 5: Commit** (`git add -f` el script).

---

### Task 2: Marcar y quitar (servicio y rutas), regla en la asistencia, bloqueo y anuncios

**Files:**
- Modify: `asistencia.schema.ts`, `asistencia.service.ts`, `asistencia.controller.ts`, `asistencia.routes.ts`, `server/src/modules/cambios/cambio.entity.ts` (`AccionCambio` suma `"sin-clases"` y `"quitar-sin-clases"`), `server/scripts/_ciclo-bloqueado.ts`
- Create: `server/scripts/_asistencia-sin-clases.ts`

**Interfaces:**
- Consumes: Task 1 (métodos del repositorio), `verificador.verificarCicloDelCurso`, `verificador.verificarDiaDeClases`, `AlumnoRepository.findByCursoId`.
- Produces:
  ```ts
  // AsistenciaService
  marcarSinClases(datos: { cursoId: string; fecha: Date; motivo?: string }, profesorId: string, registradaPor: string): Promise<ClaseSinDictar>
  quitarSinClases(datos: { cursoId: string; fecha: Date }, profesorId: string): Promise<void>
  // asistencia.schema.ts
  marcarSinClasesSchema = z.object({ cursoId, fecha: fechaDeAsistenciaSchema, motivo: textoOpcional(200) }).strict()
  ```
  Rutas (solo `profesor`): `POST /api/asistencia/sin-clases` → 201 con la marca; `DELETE /api/asistencia/sin-clases/:cursoId/:fecha` (`AAAA-MM-DD`) → 204.

- [ ] **Step 1: Write the failing script `_asistencia-sin-clases.ts`** (servicio real vía `container`, mundo de avisos; fechas dentro del calendario del ciclo activo 2026, no futuras, p. ej. `2026-03-17`, `2026-03-19`, `2026-03-24`): (a) marcar crea la marca con su motivo y `registradaPor`; marcar de nuevo solo actualiza el motivo (una sola fila); (b) quitar la borra; quitar una inexistente no falla; (c) con asistencia guardada ese día, marcar da 409 con el texto exacto y no crea nada; (d) con el día marcado, `registrarAsistenciaMasiva` da 409 con el texto exacto y no guarda ninguna fila (todo o nada); (e) otro profesor (`m.profesorMultiId`) → `AuthorizationError` al marcar y al quitar; (f) un día futuro y un día sin clases del calendario (una pausa creada para la prueba) se rechazan; (g) marcar y quitar **no crean ni tocan filas de `Asistencia`** (conteo igual antes y después); (h) cada operación anuncia `datos.cambiaron` (`asistencia`, `sin-clases` / `quitar-sin-clases`) con `cursoIds` y los `alumnoIds` inscriptos al curso, y `asistencia.registrada` (capturar con un `TableroDeAnuncios` propio como en `_ciclo-calendario-servicio.ts`); (i) la marca vale para un alumno inscripto **después** (los `alumnoIds` anunciados salen de la nómina del momento); (j) **carrera**: `Promise.all([marcarSinClases(...), registrarAsistenciaMasiva(...)])` del mismo curso y día termina con exactamente una de las dos cosas (la otra rechazada) y nunca con las dos; (k) con el ciclo bloqueado (`UPDATE "Ciclo" SET bloqueado = true`, restaurar en `finally`) marcar y quitar dan 409. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** `marcarSinClases`: dentro de `runInTransaction`, en este orden: `verificarDuenoDelCurso`; `verificador.verificarCicloDelCurso(cursoId, tx)`; `asistenciaRepo.bloquearClase(cursoId, fecha, tx)`; `verificador.verificarDiaDeClases(cursoId, diaISO, tx)`; `contarRegistrosDelDia(...) > 0` → `ConflictError` con el texto de Global Constraints; crear la marca (id `randomUUID()`, `registradaPor`) o, si ya existía, `actualizarMotivoDeClaseSinDictar`; publicar `asistencia.registrada` y `datos.cambiaron { dato: "asistencia", accion: "sin-clases", ids: { cursoIds: [cursoId], alumnoIds: (await alumnoRepo.findByCursoId(cursoId, tx)).map(a => a.id) } }` con `tx`. `quitarSinClases`: mismo orden hasta el bloqueo; si existe la marca, `eliminarClaseSinDictar` y publicar los mismos anuncios con acción `quitar-sin-clases`; si no existe, no publica. `registrarAsistenciaMasiva`: después de `verificarCicloDelCurso`, tomar `bloquearClase(cursoId, datos.fecha, tx)` y, si `findClaseSinDictar(...)` existe, `ConflictError` con el texto de Global Constraints (antes de leer o escribir filas). Controller: `marcarSinClases` (`profesorService.buscarPorUsuarioId(req.auth!.sub)` y `req.auth!.sub` como `registradaPor`) y `quitarSinClases` (valida `fecha` con `fechaCalendario`). Rutas con `requireRole("profesor")`.
- [ ] **Step 3: Clasificar las rutas nuevas** en `_ciclo-bloqueado.ts`: agregar a `RECHAZADAS` `POST /api/asistencia/sin-clases` (rol `profe`, fecha de **ayer** en hora de Argentina para no chocar con la asistencia de "hoy" de otra entrada, `bloqueado: [409]`, `desbloqueado: [201]`) y `DELETE /api/asistencia/sin-clases/:cursoId/:fecha` (misma fecha, `bloqueado: [409]`, `desbloqueado: [204]`), colocadas **antes** de la entrada `PATCH /api/ciclos/:id/fechas` (que va al final).
- [ ] **Step 4: Verify.** `_asistencia-sin-clases` y `_asistencia-sin-clases-datos` con `chequear.py` ("0 mal"); `_ciclo-bloqueado` con `pruebas/bin/api.sh start`; `_ciclo-calendario-asistencia`, `_asistencia-justificada`; `pnpm typecheck`; `pnpm test`.
- [ ] **Step 5: Commit.**

---

### Task 3: Lecturas (el motivo solo para el equipo)

**Files:**
- Modify: `asistencia.service.ts`, `asistencia.controller.ts`, `asistencia.routes.ts`, `server/scripts/_asistencia-sin-clases.ts`

**Interfaces:**
- Consumes: Task 1 (`findSinDictarByCursoId`, `findSinDictarByAlumnoId`), `Solicitante` de `asistencia.service.ts`, `verificarDuenoDelCurso`.
- Produces:
  ```ts
  // AsistenciaService
  listarSinClasesDeCurso(cursoId: string, solicitante: { rol: Rol; profesorId?: string }): Promise<{ fecha: Date; motivo?: string }[]>
  listarSinClasesDeAlumno(alumnoId: string, solicitante: Solicitante): Promise<{ cursoId: string; fecha: Date; motivo?: string }[]>
  ```
  Rutas: `GET /api/asistencia/cursos/:cursoId/sin-clases` (admin, secretario, profesor dueño del curso) y `GET /api/asistencia/alumnos/:alumnoId/sin-clases` (admin, secretario, profesor, padre solo de su propio hijo).

- [ ] **Step 1: Write the failing assertions** en `_asistencia-sin-clases.ts`: `listarSinClasesDeCurso` con el profesor dueño trae `{ fecha, motivo }` y con otro profesor da `AuthorizationError`; administración y secretaría ven todo; `listarSinClasesDeAlumno(m.hijo1, { rol: "padre", padreId: m.padreId })` devuelve las marcas **sin la clave `motivo`** (comprobar `Object.keys`) y las de `m.alumnoAjeno` con ese mismo padre → `AuthorizationError`; con `rol: "admin"` el motivo sí viene; las marcas de un curso donde el alumno no estuvo inscripto no aparecen. Además, por HTTP (API levantada, login real de la cuenta del padre): la respuesta cruda de `GET /api/asistencia/alumnos/:alumnoId/sin-clases` no contiene la palabra del motivo de la prueba. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** El service quita `motivo` para `rol === "padre"` (construye objetos nuevos sin la clave, no `undefined`); `listarSinClasesDeAlumno` verifica el parentesco como `listarPorAlumno`. Controller y rutas como las demás lecturas del módulo (resolver `padreId`/`profesorId` con `padreService`/`profesorService`).
- [ ] **Step 3: Verify.** Script con `chequear.py` ("0 mal", incluida la parte por HTTP con `api.sh start`); `pnpm typecheck`; `pnpm test`.
- [ ] **Step 4: Commit.**

---

### Task 4: El aviso de asistencia pendiente saltea las clases marcadas

**Files:**
- Modify: `server/src/modules/notificaciones/notificacion.criterios.prisma.ts` (`asistenciaPendiente`), `server/scripts/_asistencia-sin-clases.ts`

**Interfaces:**
- Consumes: Task 1 (modelo `claseSinDictar` de Prisma).
- Produces: comportamiento (sin firmas nuevas).

- [ ] **Step 1: Write the failing assertions** en `_asistencia-sin-clases.ts` con `PrismaCriteriosDeAvisos` (patrón de `_ciclo-calendario-asistencia.ts`, `JUEVES_15 = new Date("2026-10-15T18:00:00Z")`, curso del mundo con clases martes y jueves 14:00): sin marca, el aviso `asistencia:<curso>:2026-10-15` figura para `m.profe`; con la clase del 15/10 marcada, ya no figura y los de otros días sí; al quitar la marca vuelve a figurar. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** En `asistenciaPendiente`, junto con la consulta de `asistencia.groupBy`, leer `claseSinDictar.findMany({ where: { cursoId: { in: cursos.map(c => c.id) }, fecha: { gte: desde, lt: hoy + 1 día } } })`, armar el set `cursoId|AAAA-MM-DD` y saltear esas clases (`continue`) igual que las que ya tienen asistencia.
- [ ] **Step 3: Verify.** `_asistencia-sin-clases`, `_criterios`, `_avisos-servicio`, `_ciclo-calendario-asistencia` con `chequear.py`; `pnpm typecheck`; `pnpm test`.
- [ ] **Step 4: Commit.**

---

### Task 5: Client — tipos, servicio, hooks, mensajes y calendarios

**Files:**
- Modify: `client/src/features/asistencia/types.ts`, `asistenciaService.ts`, `components/AttendanceCalendar.tsx`, `client/src/features/cambios/types.ts` (`AccionCambio` suma `"sin-clases"` y `"quitar-sin-clases"`), `client/src/features/cambios/mensajes.ts`, `client/src/features/alumnos/pages/AlumnoDetailPage.tsx`, `client/src/features/alumnos/pages/ParentDashboardPage.tsx`
- Create: `client/src/features/asistencia/hooks/{useSinClasesDelCurso,useSinClasesDelAlumno,useMarcarSinClases,useQuitarSinClases}.ts`

**Interfaces:**
- Consumes: la API de Tasks 2 y 3 (JSON: `fecha` como `"AAAA-MM-DDT00:00:00.000Z"`).
- Produces:
  ```ts
  // types.ts
  export interface ClaseSinDictar { cursoId: string; fecha: string; motivo?: string }   // sin `motivo` para la familia
  // asistenciaService
  marcarSinClases(datos: { cursoId: string; fecha: string; motivo?: string }): Promise<ClaseSinDictar>
  quitarSinClases(cursoId: string, fecha: string): Promise<void>
  sinClasesDelCurso(cursoId: string): Promise<{ fecha: string; motivo?: string }[]>
  sinClasesDelAlumno(alumnoId: string): Promise<ClaseSinDictar[]>
  // hooks (claves que empiezan con "asistencia": las señales en vivo ya las vuelven a pedir)
  useSinClasesDelCurso(cursoId: string | undefined)   // ["asistencia", "sin-clases", "curso", cursoId]
  useSinClasesDelAlumno(alumnoId: string | undefined) // ["asistencia", "sin-clases", "alumno", alumnoId]
  useMarcarSinClases() / useQuitarSinClases()         // invalidan ["asistencia"]
  // AttendanceCalendar: prop opcional  sinClases?: { fecha: string; motivo?: string }[]
  ```

- [ ] **Step 1: Types, servicio, hooks y mensajes.** `mensajes.ts`: `asistencia/sin-clases` → `${quien} marcó una clase como sin clases` y `asistencia/quitar-sin-clases` → `${quien} quitó la marca de sin clases de una clase`, en el estilo de las entradas existentes.
- [ ] **Step 2: `AttendanceCalendar`** dibuja cada día de `sinClases` con fondo `var(--muted)`, texto atenuado y la sigla "SC" (título "Sin clases" y, si viene `motivo`, "Sin clases: <motivo>"), con una entrada "Sin clases" en la leyenda; un día con asistencia y sin marca se dibuja como hasta hoy.
- [ ] **Step 3: Legajo (`AlumnoDetailPage`) y panel de la familia (`ParentDashboardPage`).** Pedir `useSinClasesDelAlumno(alumnoId)`, filtrarlas con el mismo `vista.filtrar(...)` que la asistencia (por curso del año elegido) y pasarlas al `AttendanceCalendar`; **los meses navegables del calendario se arman también con las fechas de sin clases** (hoy salen solo de las filas de asistencia, así que un alumno sin ninguna fila ese mes no vería la marca); en la lista de días del panel de la familia sumar filas "Sin clases" mezcladas por fecha (la más nueva primero) con una insignia neutra, sin motivo. El legajo muestra el motivo en el título del día.
- [ ] **Step 4: Verify.** `pnpm typecheck && pnpm lint && pnpm build` en el client (solo las 2 advertencias que ya existían).
- [ ] **Step 5: Commit.**

---

### Task 6: Client — pantalla de asistencia del profesor

**Files:**
- Create: `client/src/features/asistencia/components/ModalSinClases.tsx`
- Modify: `client/src/features/asistencia/pages/AsistenciaProfesorPage.tsx`

**Interfaces:**
- Consumes: Task 5 (`useSinClasesDelCurso`, `useMarcarSinClases`, `useQuitarSinClases`), `Modal` de `core/components/ui/modal.tsx` (el pie termina en el botón principal; Enter lo aprieta), `ApiError`.
- Produces: componente `ModalSinClases({ cursoId, fecha, onClose })`.

- [ ] **Step 1: `ModalSinClases`:** un `Modal` con un campo de motivo opcional (hasta 200 caracteres), "Cancelar" y "Marcar sin clases" (último botón del pie), `sinGuardar` si hay texto, y el error del servidor debajo (`ApiError.message`).
- [ ] **Step 2: Pantalla.** Con `useSinClasesDelCurso(cursoId)`, `marcada = lista.find(c => c.fecha.slice(0,10) === fecha)`. Botón "Marcar sin clases" en la tarjeta "Clase" cuando no hay `marcada`, no hay asistencia guardada ese día (`hayAsistenciaGuardada`), el día tiene clases (`sinClases` del calendario es `null`) y hay curso. Con `marcada`: reemplazar la grilla de alumnos, "Marcar todos como presentes" y la barra de guardado por una tarjeta "Clase sin dar" (con el motivo si lo hay, y el texto "No cuenta como falta ni como asistencia"), con el botón "Quitar marca". En las clases de la lista, la marcada lleva el punto neutro y el título "Sin clases", y `sesionCompleta` la cuenta como completa (hoy se vería como incompleta).
- [ ] **Step 3: Verify.** `pnpm typecheck && pnpm lint && pnpm build`. Verificación visual con `pruebas/bin/api.sh start && pruebas/bin/client.sh start` y una captura Playwright de la pantalla con una clase marcada (mundo de avisos); deshacer lo creado.
- [ ] **Step 4: Commit.**

---

### Task 7: Recorrido de navegador, batería y documentación

**Files:**
- Create: `pruebas/recorridos/e2e-sin-clases.js`
- Modify: `pruebas/bin/bateria.sh`, `pruebas/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: batería actualizada.

- [ ] **Step 1: Recorrido `e2e-sin-clases.js`** (estilo de `e2e-automatizaciones.js`, salida `etiqueta: real (esperado X)`, mundo de avisos, fechas locales de Argentina, limpieza al final): el profesor abre su curso en un día con clases (`/asistencia?curso=prueba-tmp-av-curso&fecha=<hace 2 días>`), toca "Marcar sin clases", escribe un motivo y confirma con **Enter**; la pantalla muestra "Clase sin dar" con el motivo y no deja guardar asistencia; en la base hay una fila de `ClaseSinDictar` y ninguna de `Asistencia` ese día; el responsable (cuenta del padre del mundo) entra a su panel de asistencia, ve el día como "Sin clases" y el texto del motivo **no aparece en la página**; secretaría abre el legajo del alumno y ve el día con el motivo; el profesor toca "Quitar marca", la grilla vuelve y el día ya no figura en el calendario de la familia.
- [ ] **Step 2: Batería.** En `bateria.sh` agregar `_asistencia-sin-clases-datos _asistencia-sin-clases` a la lista de scripts del servidor (el recorrido se recoge solo por el comodín `e2e-*.js`).
- [ ] **Step 3: Documentación.** `CLAUDE.md`: sección "Clase sin dictar" (modelo `ClaseSinDictar`, las cuatro rutas, las reglas: solo el profesor dueño, no con asistencia guardada, no asistencia en un día marcado, el bloqueo `pg_advisory_xact_lock`, el motivo nunca llega a la familia, qué cambia en avisos y calendarios, y que reportes y racha no cambian porque cuentan filas de `Asistencia`); sumar las rutas a la tabla de la API; en "Limitaciones" actualizar la frase "una clase de feriado genera asistencia sin tomar". `pruebas/README.md`: el recorrido nuevo.
- [ ] **Step 4: Verify con la batería completa.** `bash pruebas/bin/bateria.sh > pruebas/bin/bateria.log 2>&1`; todos los bloques "0 mal" salvo las 4 pruebas ya conocidas por inestables en la corrida completa (`_version`, `e2e-3c-version`, `e2e-3c-staff`, `e2e-chat-revision`), que se repiten sueltas con servidores recién reiniciados (`api.sh stop`, `client.sh stop`, matar por PID lo que quede en :4000 y :5173); última línea `BASE:` con `valorCuota` en `null` y 0 datos de prueba.
- [ ] **Step 5: Commit.**
