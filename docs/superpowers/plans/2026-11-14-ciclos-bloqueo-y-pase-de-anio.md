# Ciclos: bloqueo, pase de año e inscripción solo en el ciclo activo — plan de implementación

> **Para quien ejecute:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Los pasos usan casillas (`- [ ]`).

**Objetivo:** poder bloquear un ciclo (nada de lo suyo se escribe), pasar de año con un asistente guiado, y que inscribir o cambiar de curso solo admita cursos del ciclo activo.

**Arquitectura:** una columna `Ciclo.bloqueado` y una única función de entrada `verificarCicloAbierto` (en `modules/ciclos/`, inyectada por `container.ts`) que cada escritura llama dentro de su transacción; una prueba de la batería recorre todas las rutas de escritura. La lista de alumnos de un curso pasa a salir de `Inscripcion`. El asistente "Pasar de año" es un `PaseDeAnioService` con una función pura de planificación, una vista previa que no escribe y una confirmación en una sola transacción. Un aviso de estado `ciclo_por_cerrar` recuerda hacerlo desde el 1 de diciembre.

**Tecnologías:** Express 5, Prisma 6, PostgreSQL 18, zod, `tsx --test`; client React 19 + TanStack Query + Tailwind 4. Server y client no comparten código.

**Spec:** `docs/superpowers/specs/2026-11-14-ciclos-bloqueo-y-pase-de-anio-design.md` (leerla primero: manda ante cualquier duda).

## Restricciones globales

- Feature-first: lógica nueva en `modules/ciclos/`; `core/` no recibe lógica de negocio. Nunca carpetas `domain/`, `data/`, `presentation/`.
- Cada service recibe sus dependencias por constructor; `container.ts` es el único lugar que instancia repositorios y services. Un parámetro nuevo en un service va **al final** y con valor por defecto (como `anuncios = sinAnuncios()`), para no romper los scripts que ya los construyen.
- Todo cambio con `tx` pasado a **cada** llamada al repositorio dentro de `runInTransaction`; los anuncios (`anuncios.publicar`) dentro de la transacción y con `tx`.
- Errores solo de `core/errors.ts` (el rechazo del bloqueo es un `ConflictError`, 409; el de "curso fuera del ciclo activo" un `ValidationError`, 400). Los controllers no atrapan errores.
- Mensaje exacto del bloqueo: `El ciclo {año} está bloqueado. Pedile al administrador que lo desbloquee.`
- Toda hora o fecha de "hoy" con `core/fechas.ts` (hora de Argentina), nunca `getDate()`/`toISOString()`; en el client, `hoyLocalISO()`.
- Pruebas: datos con prefijo `prueba-tmp-av` (`server/scripts/_mundo-avisos.ts`), ciclos de prueba con año 2099, todo limpiado al terminar. **Nunca bloquear un ciclo real, nunca tocar datos reales ni dejar `Configuracion.valorCuota` distinto de null.** Los scripts nuevos se versionan con `git add -f`.
- Antes de cada migración: `docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/<nombre>.dump`.
- Rama de trabajo: `ciclos-bloqueo-y-pase-de-anio` (en worktree). Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. **Nada de fusionar ni subir sin pedido explícito del usuario.**
- Comandos: server `cd server && pnpm typecheck && pnpm test`; scripts `cd server && pnpm exec tsx scripts/_x.ts | python3 ../pruebas/bin/chequear.py` (esperado: `N bien, 0 mal`; los "HTTP" piden `bash pruebas/bin/api.sh start` antes y `stop` después); client `cd client && pnpm typecheck && pnpm lint`.

## Foco de la revisión

Casos que el spec implica y ninguna tarea cubriría sin pedirlo; cada uno tiene su prueba en la tarea indicada:

1. Bloquear mientras otra persona escribe: la guarda toma `FOR SHARE` sobre la fila del ciclo, así un bloqueo simultáneo espera a que termine la escritura (Tarea 2).
2. Una ruta de escritura nueva que nadie clasificó: la batería falla (Tarea 5).
3. Confirmar el asistente dos veces: la segunda no duplica cursos ni inscripciones (Tarea 8).
4. Alumno ya inscripto en el destino con otro curso, y curso con alumnos sin decisión (Tareas 7 y 8).
5. Curso viejo con un alumno dado de baja: administración lo ve en la lista, el profesor no; un alumno con curso actual pero sin inscripción en ese curso aparece en el informe de solo lectura (Tarea 6).

## Estructura de archivos

Server (`server/src/modules/ciclos/`): `ciclo.entity.ts` (+`bloqueado`), `ciclo.repository(.prisma).ts` (+bloqueo, +`bloquearParaLectura`), `ciclo.service.ts` (+bloquear/desbloquear, +`activarEnTransaccion`), `ciclo.guarda.ts` (nuevo: `VerificadorDeCiclo`), `paseDeAnio.plan.ts` (nuevo, pura), `paseDeAnio.schema.ts`, `paseDeAnio.service.ts`, `paseDeAnio.controller.ts` (nuevos), `ciclo.routes.ts`, `ciclo.eventos.ts`. Otros: guardas en los services de cursos, alumnos, asistencia, calificaciones, observaciones, cuotas; `alumnos/alumno.repository.prisma.ts` (nómina); `notificaciones/*` (aviso nuevo); migraciones; `container.ts`.
Client (`client/src/features/ciclos/`): `types.ts`, `cicloService.ts`, hooks (`useBloquearCiclo`, `useDesbloquearCiclo`, `usePaseDeAnio`), `pages/PasarDeAnioPage.tsx` (nuevo, con un componente por paso); `ConfiguracionPage.tsx`; selectores de curso de Inscribir alumno y del legajo; `notificaciones/{types,rutas}.ts`; ruta en `AppRoutes.tsx`.

---

### Tarea 1: Estado "bloqueado" del ciclo y sus dos acciones

**Archivos:** modificar `server/prisma/schema.prisma`, `ciclo.entity.ts`, `ciclo.repository.ts`, `ciclo.repository.prisma.ts`, `ciclo.service.ts`, `ciclo.controller.ts`, `ciclo.routes.ts`, `cambio.entity.ts` (acciones `"bloqueo"` y `"desbloqueo"`), `client/src/features/cambios/{types,mensajes}.ts`; crear migración `…_ciclo_bloqueado`; crear `server/scripts/_ciclo-bloqueo.ts`; modificar `_mundo-avisos.ts` (`limpiarMundo` borra al final los ciclos con id que empiece con `P`).

**Interfaces:**
- Produce: `Ciclo { id; anio; activo; bloqueado: boolean }`; `CicloService.bloquearCiclo(id): Promise<Ciclo>`, `desbloquearCiclo(id): Promise<Ciclo>`; `PATCH /api/ciclos/:id/bloquear|desbloquear` (solo `admin`).

- [ ] **Paso 1: escribir `_ciclo-bloqueo.ts`** (usa servicios reales con `PrismaClient`, ciclos `${P}-ciclo-2099` y `${P}-ciclo-2098`). Comprobaciones, con la forma `ok(etiqueta, real, esperado)`:
  - bloquear un ciclo no activo → `bloqueado` `true`; bloquearlo otra vez no falla y sigue `true`; desbloquear → `false`; desbloquear uno no bloqueado no falla.
  - bloquear el ciclo activo → `ConflictError` (409); activar un ciclo bloqueado → `ConflictError`; ciclo inexistente → `EntityNotFoundError`.
  - bloquear y desbloquear publican `datos.cambiaron` con `dato: "ciclos"` y `accion: "bloqueo"`/`"desbloqueo"`.
- [ ] **Paso 2: correrlo y ver que falla** (`bloquearCiclo` no existe). Esperado: error de compilación/ejecución.
- [ ] **Paso 3: migración.** Agregar `bloqueado Boolean @default(false)` a `model Ciclo`; respaldo con `pg_dump` antes; `pnpm prisma:migrate` con nombre `ciclo_bloqueado`; `pnpm prisma:generate`.
- [ ] **Paso 4: implementar** `bloquearCiclo`/`desbloquearCiclo` (transacción: leer, validar, `cicloRepo.update(id, { ...ciclo, bloqueado })`, publicar `datos.cambiaron`) y, en `marcarActivo`, el 409 si el ciclo está bloqueado. Rutas y controller siguiendo `marcarActivo`.
- [ ] **Paso 5: correr** `_ciclo-bloqueo.ts` (esperado `N bien, 0 mal`) y `pnpm typecheck`.
- [ ] **Paso 6: commit** `Ciclos: estado bloqueado con sus dos acciones` (incluir `git add -f server/scripts/_ciclo-bloqueo.ts`).

### Tarea 2: La guarda `verificarCicloAbierto`

**Archivos:** crear `ciclo.guarda.ts`; modificar `ciclo.repository.ts`/`.prisma.ts`, `container.ts`; crear `server/scripts/_ciclo-guarda.ts`.

**Interfaces:**
- Consume: `CicloRepository`, `CursoRepository.findById(id, tx?)`.
- Produce, en `ciclo.guarda.ts`:
  ```ts
  export interface VerificadorDeCiclo {
    verificarCicloAbierto(cicloId: string, tx?: unknown): Promise<void>;       // lanza ConflictError con el mensaje exacto
    verificarCicloDelCurso(cursoId: string, tx?: unknown): Promise<void>;      // resuelve curso → cicloId; curso inexistente: EntityNotFoundError
  }
  export function crearVerificadorDeCiclo(cicloRepo: CicloRepository, cursoRepo: CursoRepository): VerificadorDeCiclo;
  export function cicloSiempreAbierto(): VerificadorDeCiclo;                    // valor por defecto de los services (no verifica nada)
  ```
  y `CicloRepository.bloquearParaLectura(id: string, tx?: unknown): Promise<Ciclo | null>` (`SELECT … FOR SHARE` con `$queryRaw`, devuelve `bloqueado` y `anio`).

- [ ] **Paso 1: escribir `_ciclo-guarda.ts`:** (a) ciclo abierto → no lanza; bloqueado → `ConflictError` con el texto `El ciclo 2099 está bloqueado. Pedile al administrador que lo desbloquee.`; (b) `verificarCicloDelCurso` con un curso de ciclo bloqueado → lanza, con curso inexistente → `EntityNotFoundError`; (c) **concurrencia** (Foco 1): abrir una transacción A que llama `verificarCicloAbierto`, sin cerrarla lanzar `cicloService.bloquearCiclo(id)` en paralelo y comprobar que **no terminó** a los 300 ms; cerrar A y comprobar que termina y que el ciclo queda bloqueado.
- [ ] **Paso 2: correrlo y ver que falla** (módulo inexistente).
- [ ] **Paso 3: implementar** la guarda y `bloquearParaLectura`; `bloquearCiclo`/`desbloquearCiclo` leen con `SELECT … FOR UPDATE` (nuevo `bloquear(id, tx)` en el repositorio, mismo patrón que `AlumnoRepository.bloquear`). En `container.ts` crear `const verificadorDeCiclo = crearVerificadorDeCiclo(cicloRepository, cursoRepository)` (todavía sin pasarlo a nadie).
- [ ] **Paso 4: correr** el script (`N bien, 0 mal`), `pnpm typecheck`; **commit** `Ciclos: guarda verificarCicloAbierto con bloqueo compartido`.

### Tarea 3: Guardas en Cursos y Alumnos, e inscribir solo en el ciclo activo

**Archivos:** modificar `curso.service.ts`, `alumno.service.ts`, `container.ts`; crear `server/scripts/_ciclo-inscribir.ts`.

**Interfaces:**
- Consume: `VerificadorDeCiclo`, `cicloSiempreAbierto()` (Tarea 2).
- Produce: `CursoService` y `AlumnoService` reciben `verificador: VerificadorDeCiclo = cicloSiempreAbierto()` como **último** parámetro; `container.ts` se lo pasa a ambos.

- [ ] **Paso 1: escribir `_ciclo-inscribir.ts`** con un ciclo activo de prueba (restaurar el activo real al terminar, en un `finally`) y uno bloqueado 2099:
  - `crearCurso` con `cicloId` de un ciclo bloqueado → 409; sin bloqueo funciona. `actualizarCurso` (incluidos `horarios`) sobre un curso de ciclo bloqueado → 409.
  - `inscribirAlumno` a un curso de un ciclo que **no** es el activo → `ValidationError` (400) con mensaje claro ("…no es del ciclo activo"); sin ciclo activo → 400; a un curso del ciclo activo funciona.
  - `actualizarAlumno` con `cursoId` de otro ciclo → 400; con un curso del activo funciona y actualiza la inscripción.
  - `actualizarAlumno` con solo `estado: "inactivo"` sobre un alumno cuyo curso actual es de un ciclo bloqueado **funciona** (el estado es dato de la persona).
  - `asignarResponsable` y la edición de datos personales funcionan con el ciclo de su curso bloqueado.
- [ ] **Paso 2: correrlo y ver que falla** (inscribe en cualquier ciclo).
- [ ] **Paso 3: implementar.** `CursoService`: `crearCurso` llama `verificarCicloAbierto(cicloId)` antes de crear (dentro de la transacción); `actualizarCurso` llama `verificarCicloAbierto(actual.cicloId)` tras leer el curso. `AlumnoService`: `inscribirAlumno` y `actualizarAlumno` (solo cuando cambia `cursoId`) validan que `curso.cicloId` sea el del ciclo activo (`ValidationError`) y luego `verificarCicloAbierto(curso.cicloId, tx)`; la inscripción del ciclo activo que se crea o cambia pasa por la misma validación (ya implícita: el ciclo activo nunca está bloqueado).
- [ ] **Paso 4: correr** el script, `pnpm typecheck`, `pnpm test`; **commit** `Ciclos: bloqueo en cursos y alumnos; inscribir solo en el ciclo activo`.

### Tarea 4: Guardas en asistencia, calificaciones, observaciones y cuotas

**Archivos:** modificar `asistencia.service.ts`, `calificacion.service.ts`, `observacion.service.ts`, `cuota.service.ts`, `container.ts`; crear `server/scripts/_ciclo-guardas-servicios.ts`.

**Interfaces:**
- Consume: `VerificadorDeCiclo.verificarCicloDelCurso(cursoId, tx)`.
- Produce: los cuatro services reciben `verificador` como último parámetro con `cicloSiempreAbierto()` por defecto; `container.ts` lo pasa.

- [ ] **Paso 1: escribir `_ciclo-guardas-servicios.ts`** (curso de prueba en ciclo 2099 bloqueado/desbloqueado, con el profe del mundo de prueba). Con el ciclo bloqueado todas estas llamadas lanzan `ConflictError` y con el ciclo abierto funcionan: `registrarAsistenciaMasiva`; `crearEvaluacion`, `publicarEvaluacion`, `cargarCalificaciones`, `cargarNotasCierre`, `publicarNotasCierre` (las notas se resuelven por la nota → su curso); `crearCategoriaPersonalizada`. Y: `registrarPago` de una cuota pendiente y de una vencida de un alumno de ese curso **funciona** con el ciclo bloqueado (regla B); `marcarVencidas` sigue marcando; `generarCuotaInicial`/`generarCuotasDelMes` no crean nada si el ciclo activo estuviera bloqueado (forzarlo con SQL solo en la prueba).
- [ ] **Paso 2: correrlo y ver que falla.**
- [ ] **Paso 3: implementar** la llamada a `verificarCicloDelCurso(cursoId, tx)` al principio de la transacción de cada operación listada (en `publicarEvaluacion` con `evaluacion.cursoId`; en `publicarNotasCierre` con el curso de cada nota; en `cargarNotasCierre` con cada `cursoId` distinto). En `cuota.service.ts`, `contextoDeGeneracion` devuelve `null` si `ciclo.bloqueado` (la generación automática no debe lanzar). `registrarPago` no cambia.
- [ ] **Paso 4: correr** el script, `pnpm typecheck`, `pnpm test`; **commit** `Ciclos: bloqueo en asistencia, calificaciones, observaciones y cuotas`.

### Tarea 5: Barrido de la batería sobre todas las rutas de escritura

**Archivos:** crear `server/scripts/_ciclo-bloqueado.ts`; modificar `pruebas/bin/bateria.sh` (agregar `_ciclo-bloqueo _ciclo-guarda _ciclo-inscribir _ciclo-guardas-servicios` a la lista de scripts sin HTTP y `_ciclo-bloqueado` a la de HTTP).

**Interfaces:** consume la API real por HTTP (login con las cuentas del mundo de prueba, `http://localhost:4000`).

- [ ] **Paso 1: escribir `_ciclo-bloqueado.ts`** con una tabla `ESCRITURAS` (método, ruta con parámetros, rol que la llama, cuerpo, `resultado: "rechazada" | "exenta"`), un curso con evaluación, nota de cierre, alumno y cuotas en un ciclo 2099:
  - **Parte 1, ciclo bloqueado:** cada ruta marcada `rechazada` responde 409 (o 400 en inscribir/cambiar a un curso que no es del activo) con el mensaje del bloqueo cuando corresponde; las `exentas` (cobro de cuota pendiente/vencida, cambio de estado de un alumno, datos de persona, chats, observaciones, cuentas) responden bien.
  - **Parte 2, ciclo desbloqueado:** las mismas rutas `rechazada` ahora responden 2xx.
  - **Parte 3, cobertura (Foco 2):** recorrer `app._router`/las pilas de los routers montados en `server.ts` (Express 5), listar toda ruta `POST|PUT|PATCH|DELETE` y exigir que cada una figure en `ESCRITURAS` o en una lista `SIN_CICLO` (autenticación, sesiones, usuarios, padres, profesores, documentos, chats, notificaciones, configuración, ciclos, `pase-de-anio`). Una ruta nueva sin clasificar imprime `ruta sin clasificar: <método> <ruta>` con esperado 0 sin clasificar.
- [ ] **Paso 2: correrlo y ver que falla** donde falte alguna guarda (si todas están, pasa: es la red de seguridad, y debe fallar a propósito al quitar una llamada: comprobarlo comentando una guarda y volviéndola a poner).
- [ ] **Paso 3: arreglar** lo que el barrido encuentre (rutas sin guarda), correr (`N bien, 0 mal`), `bash pruebas/bin/api.sh stop`.
- [ ] **Paso 4: commit** `Ciclos: barrido de la batería sobre las rutas de escritura`.

### Tarea 6: La lista de alumnos de un curso sale de las inscripciones

**Archivos:** modificar `alumno.repository.prisma.ts` (`findByCursoId`), `alumno.service.ts` si hace falta; crear `server/scripts/revisar-nomina-inscripciones.ts` (solo lectura) y `server/scripts/_nomina-inscripciones.ts`; ajustar `_nomina-activos.ts` si su mundo no tiene inscripciones.

**Interfaces:** `AlumnoRepository.findByCursoId(cursoId, tx?)` mantiene su firma, ahora devuelve los alumnos con una `Inscripcion` en ese curso (sin duplicados). `Alumno.cursoId` sigue siendo el curso actual.

- [ ] **Paso 1: escribir `_nomina-inscripciones.ts`:** un alumno con inscripción 2099 en el curso A y luego otra en el curso B (otro ciclo, `cursoId` actual = B) aparece en `findByCursoId(A)` y en `findByCursoId(B)`; un alumno con `cursoId` = A pero **sin** inscripción en A no aparece; sin duplicados; `cargarCalificaciones` acepta a un alumno que solo tiene inscripción en el curso. Y por HTTP: administración ve en el curso viejo al alumno dado de baja, el profesor no (Foco 5; `_nomina-activos` debe seguir en verde).
- [ ] **Paso 2: correrlo y ver que falla** (hoy sale de `cursoId`).
- [ ] **Paso 3: implementar** `findByCursoId` con `inscripcion.findMany({ where: { cursoId }, include: { alumno: true } })` y `aEntidad`. Revisar con `grep -rn findByCursoId server/src` que los dos usos (`AlumnoService.listarPorCurso`, `CalificacionService.cargarCalificaciones`) quedan bien.
- [ ] **Paso 4: `revisar-nomina-inscripciones.ts`** (solo lee, nunca escribe): imprime los alumnos con `cursoId` sin inscripción en ese curso (caso conocido: Valentino Rodríguez) y cursos con alumnos que dejarían de aparecer. **Correrlo contra la base real y mostrar la lista al usuario; no corregir nada sin su autorización.**
- [ ] **Paso 5: correr** los scripts de nómina y `pnpm test`; **commit** `Ciclos: la lista de alumnos de un curso sale de las inscripciones`.

### Tarea 7: Planificación del pase de año (función pura)

**Archivos:** crear `paseDeAnio.plan.ts`, `server/tests/pase-de-anio.test.ts`.

**Interfaces — produce:**
```ts
export type DestinoDeAlumnos =
  | { tipo: "curso"; cursoId: string }          // curso que ya existe en el destino
  | { tipo: "copia"; copiaDe: string }          // la copia (de este curso de origen) que se crea o reutiliza
  | { tipo: "egresan" } | { tipo: "no-continuan" };
export interface CursoOrigen { id: string; nombre: string; alumnos: { id: string; nombre: string; cursoActualId: string | null }[] }  // activos con inscripción en el origen
export interface DatosDelPlan {
  origen: CursoOrigen[];
  cursosDestino: { id: string; nombre: string }[];
  yaInscriptos: Map<string, string>;            // alumnoId → nombre del curso en que ya está inscripto en el destino
  copiar: string[];                              // ids de curso de origen a copiar
  decisiones: { cursoOrigenId: string; destino?: DestinoDeAlumnos; excepciones?: { alumnoId: string; destino: DestinoDeAlumnos }[] }[];
}
export interface Plan {
  copias: { cursoOrigenId: string; reutilizaCursoId: string | null }[];   // reutiliza si el destino ya tiene uno con el mismo nombre (sin mirar mayúsculas ni tildes)
  movimientos: { alumnoId: string; destino: DestinoDeAlumnos }[];
  yaInscriptos: { alumnoId: string; cursoNombre: string }[];             // se saltean
  avisos: { alumnoId: string; tipo: "curso-actual-distinto" }[];          // cursoActualId ≠ curso de origen: no bloquea
  cursosSinDecision: string[];                                            // cursos de origen con alumnos sin destino
  invalidos: string[];                                                    // referencias que no existen ("copia" de un curso no copiado, "curso" fuera del destino)
}
export function planificarPaseDeAnio(datos: DatosDelPlan): Plan;
```

- [ ] **Paso 1: escribir los casos en `pase-de-anio.test.ts`** (`node:test`, `assert/strict`, mismo estilo que `descuento-hermanos.test.ts`): todos pasan a una copia; una excepción manda a un alumno a `egresan`; un alumno ya inscripto en el destino se saltea y aparece en `yaInscriptos`; `cursoActualId` distinto → aviso sin sacarlo del plan; curso con alumnos y sin decisión → `cursosSinDecision`; curso sin alumnos activos no exige decisión; destino ya tiene "A1 (Niños)" y se copia "a1 (niños)" → `reutilizaCursoId`; `copia` de un curso que no está en `copiar` → `invalidos`; volver a planificar con todos ya inscriptos → sin movimientos (idempotencia, Foco 3).
- [ ] **Paso 2: `pnpm test`** y ver el fallo (módulo inexistente).
- [ ] **Paso 3: implementar** `planificarPaseDeAnio` (sin Prisma ni Express, sin importar nada externo).
- [ ] **Paso 4: `pnpm test`** (todo en verde); **commit** `Ciclos: planificación pura del pase de año`.

### Tarea 8: Vista previa y confirmación del pase de año

**Archivos:** crear `paseDeAnio.schema.ts`, `paseDeAnio.service.ts`, `paseDeAnio.controller.ts`; modificar `ciclo.service.ts` (extraer `activarEnTransaccion`), `alumno.service.ts` (`registrarPaseDeAnio`), `ciclo.routes.ts`, `container.ts`, `server.ts` si monta rutas aparte, `ciclo.eventos.ts`; crear `server/scripts/_pase-de-anio.ts`.

**Interfaces:**
- Consume: `planificarPaseDeAnio`, `CicloService.bloquearCiclo`, `CursoRepository.create/agregarHorario/findHorariosByCursoId`, `CicloRepository.findInscripcionesByCicloId/crearInscripcion/findInscripcionByAlumnoYCiclo`.
- Produce:
  - `CicloService.activarEnTransaccion(id: string, tx: unknown): Promise<Ciclo>` y `bloquearEnTransaccion(id, tx)` (los públicos `marcarActivo`/`bloquearCiclo` las llaman dentro de su transacción; **no anidar transacciones**).
  - `AlumnoService.registrarPaseDeAnio(movimientos: { alumnoId: string; destino: { tipo: "pasa"; cursoId: string; cicloId: string } | { tipo: "egresa" | "no-continua" } }[], tx: unknown): Promise<void>`: toma las fichas de los responsables **antes** que los alumnos (`bloquearFamilias`, en orden de id), crea la `Inscripcion` (fecha de hoy, marca de descuento actual) y pone `cursoId` nuevo a quien pasa, pone `estado` `egresado`/`inactivo` a los otros (conservan su `cursoId`), recalcula el descuento por hermanos de las familias afectadas **sin** `anunciarDescuento`, y publica `alumnos.cambiaron` y `datos.cambiaron` normales.
  - `PaseDeAnioService.vistaPrevia(input): Promise<VistaPrevia>` (no escribe) y `confirmar(input): Promise<Resumen>`; `POST /api/ciclos/pase-de-anio/vista-previa` y `POST /api/ciclos/pase-de-anio/confirmar`, solo `admin`.
  - `PaseDeAnioInput` (zod `.strict()`): `{ origenId: string; destino: { cicloId: string } | { anio: number }; copiarCursoIds: string[]; cursos: { cursoOrigenId: string; destino?: DestinoDeAlumnos; excepciones?: { alumnoId: string; destino: DestinoDeAlumnos }[] }[]; cierre?: { activarDestino: boolean; bloquearOrigen: boolean } }`; `VistaPrevia` = `Plan` + `{ origenAnio, destinoAnio, destinoNuevo: boolean, totales: { pasan, egresan, noContinuan, cursosCopiados }, advertenciaAnioEnCurso: boolean }` (esta última `true` si hoy es anterior al 1 de diciembre del año del origen).

- [ ] **Paso 1: escribir `_pase-de-anio.ts`** (servicios reales, mundo de prueba; ciclos 2098 origen y 2099 destino, restaurando el activo real al terminar):
  - vista previa no escribe nada (contar filas antes y después);
  - confirmar: se copian los cursos con sus horarios (reutiliza uno del mismo nombre sin tocarlo), cada alumno pasa con su inscripción nueva y la vieja intacta, `Alumno.cursoId` nuevo; uno egresa (`egresado`) y uno no continúa (`inactivo`) conservando su `cursoId`;
  - con `cierre` el destino queda activo y el origen bloqueado;
  - **idempotencia (Foco 3):** confirmar de nuevo no duplica cursos, inscripciones ni cambia nada;
  - alumno ya inscripto en el destino con otro curso → se saltea y figura;
  - curso con alumnos activos sin decisión → `ValidationError` (400) que lista los cursos, y no se escribe nada;
  - origen = destino, origen o destino bloqueado → error; `destino: { anio }` inexistente crea el ciclo dentro de la misma transacción;
  - si falla algo a mitad (forzar un `cursoId` inexistente en una excepción) no queda nada escrito (todo o nada);
  - no se crea ningún aviso de descuento (`descuento_hermanos*`) y sí se publica `datos.cambiaron`.
- [ ] **Paso 2: correrlo y ver que falla.**
- [ ] **Paso 3: implementar.** Orden dentro de **una** transacción en `confirmar`: validar ciclos → crear el ciclo destino si viene `anio` → crear/reutilizar cursos con horarios → si `cierre.activarDestino`, `activarEnTransaccion(destino)` → releer datos con `tx` y volver a planificar (`cursosSinDecision` o `invalidos` no vacío → `ValidationError`) → `registrarPaseDeAnio` → si `cierre.bloquearOrigen`, `bloquearEnTransaccion(origen)` → publicar `datos.cambiaron` de `cursos` y `ciclos`. Cada curso nuevo y cada alumno pasan por la guarda. Si ~150 alumnos rozan los 20 s de `PrismaUnitOfWork`, medir con la base de prueba y, solo si hace falta, subir el tiempo de forma acotada para esta operación.
- [ ] **Paso 4: correr** el script (`N bien, 0 mal`), `pnpm typecheck`, `pnpm test`, y agregar `_pase-de-anio` a `bateria.sh` (lista HTTP si usa la API; si no, la otra); **commit** `Ciclos: asistente Pasar de año (vista previa y confirmación)`.

### Tarea 9: Aviso `ciclo_por_cerrar`

**Archivos:** modificar `schema.prisma` (valor en `enum TipoNotificacion`) + migración `…_aviso_ciclo_por_cerrar` (respaldo antes), `notificacion.entity.ts` (`TipoEstado` y `RecursoAviso { tipo: "pase-de-anio" }`), `notificacion.tipos.ts`, `notificacion.criterios.prisma.ts`, `notificacion.suscripciones.ts`; client `features/notificaciones/{types,rutas}.ts`; crear `server/scripts/_aviso-ciclo-por-cerrar.ts`.

**Interfaces:** tipo `ciclo_por_cerrar`: grupo `staff`, pero el criterio entrega el aviso **solo a cuentas con rol `admin`** (secretaría no lo recibe; si sus preferencias en "Mi cuenta" lo listarían, ocultarlo para ese rol), clase `estado`, etiqueta `"Año lectivo por cerrar"`, clave `ciclo-por-cerrar:<cicloId>`, tono `warning`, nivel 0, recurso `{ tipo: "pase-de-anio" }`, texto `El ciclo {anio} terminó. Falta pasar de año: pasá a los alumnos y activá el ciclo nuevo.`

- [ ] **Paso 1: escribir `_aviso-ciclo-por-cerrar.ts`** usando `criterios.esperados("ciclo_por_cerrar", ahora)` con fechas fijas: el 30/11 del año del ciclo activo no hay aviso; el 1/12 hay uno por cada administrador activo y ninguno para la secretaria; con el ciclo activo bloqueado (forzado por SQL en la prueba) no hay aviso; tras `marcarActivo` de otro ciclo se resuelve; la preferencia apagada lo oculta.
- [ ] **Paso 2: correrlo y ver que falla.**
- [ ] **Paso 3: implementar** el criterio (`ciclo.activo = true`, `bloqueado = false`, `fechaHoraEnArgentina(ahora)` ≥ 1 de diciembre de `ciclo.anio`), el valor del enum, el catálogo (con `_avisos-servicio` ajustado si cuenta tipos por rol) y la suscripción: `ciclo.activado` ya sincroniza todos los tipos; bloquear no puede cambiar el aviso (el activo no se bloquea), así que no hace falta otro anuncio. La revisión de las 03:00 ya lo cubre. En el client, el tipo y `rutaDeAviso("pase-de-anio")` → `/ciclos/pasar-de-anio`.
- [ ] **Paso 4: correr** el script, `_avisos-servicio`, `_criterios`, `pnpm typecheck`; **commit** `Ciclos: aviso de fin de año para el administrador`.

### Tarea 10: Client — bloquear y desbloquear, y selectores solo del ciclo activo

**Archivos:** modificar `client/src/features/ciclos/{types,cicloService}.ts`, crear `hooks/useBloquearCiclo.ts` y `hooks/useDesbloquearCiclo.ts` (mismo patrón que `useMarcarCicloActivo`), `ConfiguracionPage.tsx`, `InscribirAlumnoPage.tsx`, `AlumnoDetailPage.tsx`.

**Interfaces:** `Ciclo` suma `bloqueado: boolean`; `cicloService.bloquear(id)`/`desbloquear(id)` → `PATCH /api/ciclos/:id/bloquear|desbloquear`.

- [ ] **Paso 1: implementar.** En Configuración → Ciclos lectivos: etiqueta `Bloqueado` (`Badge variant="warning"`) junto a Histórico/Activo; botones "Bloquear" (solo si no es el activo) y "Desbloquear" con confirmación (`Modal`/`ConfirmDialog` existente); "Marcar como activo" deshabilitado en un ciclo bloqueado con el motivo. Los mensajes del servidor se muestran como los demás (`ApiError.message`). En Inscribir alumno y en la edición del curso del legajo, los selectores usan `useCursosDelCicloActivo()` (hoy usan `useCursos()`); un curso actual de un ciclo viejo se muestra como texto, no como opción.
- [ ] **Paso 2: verificar** `cd client && pnpm typecheck && pnpm lint && pnpm build`; **commit** `Ciclos: bloquear y desbloquear desde Configuración; selectores del ciclo activo`.

### Tarea 11: Client — pantalla "Pasar de año"

**Archivos:** crear `client/src/features/ciclos/pages/PasarDeAnioPage.tsx` y un componente por paso en `features/ciclos/components/` (`PasoCiclos`, `PasoCursos`, `PasoAlumnos`, `PasoRevision`, `PasoCierre`), `hooks/usePaseDeAnio.ts` (vista previa y confirmación), tipos en `types.ts`; modificar `AppRoutes.tsx` (`/ciclos/pasar-de-anio`, `rolesPermitidos={["admin"]}`), `pageTitles.ts`, `ConfiguracionPage.tsx` (botón "Pasar de año").

**Interfaces:** consume los dos endpoints de la Tarea 8 (`vista-previa`, `confirmar`) con el `PaseDeAnioInput` y la `VistaPrevia` definidos allí (copiarlos a `types.ts` con los mismos nombres).

- [ ] **Paso 1: implementar** los cinco pasos del spec (Ciclos → Cursos → Alumnos → Revisión → Cierre): casilla "copiar" marcada por defecto para los cursos con alumnos activos; por curso de origen un selector con los cursos del destino, las copias, "Egresan" y "No continúan", y la lista de alumnos desplegable para excepciones; el botón de confirmar deshabilitado mientras `cursosSinDecision` no esté vacío; la revisión muestra los totales, los "ya inscripto en {curso}" y los avisos de curso actual distinto, y la advertencia si `advertenciaAnioEnCurso`; la vista previa se pide con cada cambio de decisión. Usar `useSinGuardar` con las decisiones sin confirmar. Tras confirmar, invalidar `["ciclos"]`, `["cursos"]`, `["alumnos"]`.
- [ ] **Paso 2: verificar** `pnpm typecheck && pnpm lint && pnpm build`; **commit** `Ciclos: pantalla del asistente Pasar de año`.

### Tarea 12: Recorrido de navegador, documentación y batería completa

**Archivos:** crear `pruebas/recorridos/e2e-ciclos.js`; modificar `pruebas/bin/navegador.sh` y `bateria.sh` (registrarlo), `CLAUDE.md` (nueva sección "Ciclos: bloqueo, pase de año y avisos"; actualizar la tabla de API con las rutas nuevas y la nota "Pendiente aparte: cómo funciona la inscripción al ciclo lectivo" de la regla de descuento), `pruebas/README.md`.

- [ ] **Paso 1: escribir `e2e-ciclos.js`** (mismo estilo que `e2e-descuento-hermanos.js`): el administrador bloquea un ciclo de prueba y ve la etiqueta; un profesor no puede guardar asistencia en un curso de ese ciclo y ve el mensaje del servidor; el administrador completa el asistente de punta a punta con ciclos 2098/2099 de prueba y comprueba el resultado en el legajo de un alumno y en la lista del curso viejo; el aviso aparece en la campana con fecha forzada.
- [ ] **Paso 2: correrlo** (`bash pruebas/bin/e2e.sh ../pruebas/recorridos/e2e-ciclos.js | python3 ../pruebas/bin/chequear.py`, con API y Vite levantados y el mundo de prueba creado; `N bien, 0 mal`).
- [ ] **Paso 3: documentar** en `CLAUDE.md` lo construido, en el mismo estilo de las secciones existentes (qué se bloquea y dónde se resuelve el ciclo, la guarda y su default, el barrido de la batería, la nómina por inscripción, el asistente, el aviso).
- [ ] **Paso 4: batería completa** con respaldo previo: `bash pruebas/bin/bateria.sh > /tmp/bateria.log 2>&1`. Esperado: todos los bloques sin fallas y la línea final `BASE: 3/148/0/null`. Cualquier falla se informa por nombre.
- [ ] **Paso 5: commit** `Ciclos: recorrido de navegador, documentación y batería`. Avisar al usuario que la rama está lista para revisión final; **no fusionar ni subir sin su orden**.
