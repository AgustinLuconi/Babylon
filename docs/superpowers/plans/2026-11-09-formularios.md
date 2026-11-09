# Formularios: datos incompletos, edición parcial y validación — Plan de implementación (subproyecto 3d)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que se pueda cargar alumnos y responsables con lo mínimo y completar después, que editar mande solo lo que cambió, que quien edita se entere de lo que otro cambió, que todo campo guardado pase por una validación clara, y que un alumno adulto sea responsable de sí mismo en el mismo panel de las familias.

**Architecture:** Reglas de validación escritas dos veces (server y client, sin compartir código) y probadas contra una misma tabla de casos con el ejecutor de pruebas incluido en Node. El vínculo con el responsable pasa a la ficha del alumno; `dni` y `fechaNacimiento` pasan a poder faltar; las escrituras de edición tocan solo las columnas recibidas (`actualizarParcial`). "Datos incompletos" es un criterio único (función pura) que alimenta la marca, el filtro y un aviso de estado nuevo; "Mientras editabas…" es un mecanismo genérico en `core/` apoyado en las señales del 3c.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4, tsx (`node:test` vía `tsx --test`), React 19, TanStack Query 5, react-hook-form, Tailwind 4. Node 24 (`source ~/.nvm/nvm.sh && nvm use` antes de cada comando), pnpm 11.

**Spec:** `docs/superpowers/specs/2026-11-07-formularios-design.md` (leerlo entero: el plan no repite sus razones).

## Global Constraints

- Rama `subproyecto-3d-formularios`; no se fusiona hasta el final (el client queda desfasado del server entre las Tareas 2 y 9).
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nada se sube a GitHub sin que el usuario lo pida.
- Server y client **no comparten código**: cada regla de validación existe en `server/src/core/validacion.ts` y en `client/src/core/lib/validacion.ts` con los mismos nombres. Los módulos del client que prueban las Tareas 1, 7, 8, 10 y 13 solo importan con **rutas relativas** (nunca `@/`), para poder cargarlos desde `server/tests/`.
- Sin dependencias nuevas. No se renombra `Padre` en código, tablas, rol ni rutas: solo cambian textos ("Responsable").
- Solo DNI argentino: 7 u 8 dígitos, con o sin puntos, se guarda solo con dígitos. Celular argentino: se guarda como `+549` + 10 dígitos. Email: sin espacios y en minúsculas. Fecha de nacimiento: fecha real, edad entre 2 y 100 años a hoy (hora de Argentina).
- Largos máximos: nombre y apellido 60; dirección 150; observaciones médicas 1000; texto de observación docente 1000; mensaje de chat 2000; nombre de curso, evaluación o categoría 80; aula 30. Cupo: entero de 1 a 50. Fecha de evaluación: entre un año atrás y un año adelante. Fecha de asistencia: no futura.
- Un texto de puros espacios cuenta como vacío. En PATCH, "no vino" no toca; `null` borra (solo campos borrables); `null` en un campo obligatorio es 400. Nunca se guarda `""`.
- Obligatorio al crear y **no borrable** después: nombre, apellido, curso del alumno, teléfono y vínculo del responsable. Borrables: DNI, fecha de nacimiento, email, dirección, observaciones médicas, foto, teléfono del alumno, DNI/email/dirección del responsable.
- Todo mensaje de error en castellano. Ningún dato mal formado produce un 500: siempre 400 con `details` por campo (`z.flattenError(...).fieldErrors`, ya lo hace `errorHandler`).
- Las pruebas de edición se hacen sobre datos `prueba-tmp-av*` (mundo de `server/scripts/_mundo-avisos.ts`), nunca sobre alumnos reales. Los scripts `server/scripts/_*.ts` no se versionan (convención del proyecto); las pruebas puras nuevas van versionadas en `server/tests/`. Dejar `Configuracion.valorCuota` en `null` al terminar de probar.

## Review Focus

1. **Un alumno viejo con un dato que hoy no cumple las reglas** (teléfono `2622-54555P`) se edita en otro campo y guarda sin error: lo no tocado no se revalida. → Tarea 4 (server) y Tarea 10 (client).
2. **Vacíos y espacios:** `"   "`, `""` y `null` en cada campo opcional y obligatorio; nunca queda `""` guardado. → Tarea 3.
3. **DNI:** `12.345.678` se guarda como `12345678`; moverlo a un DNI ya usado es 409 en el campo; dos fichas sin DNI no chocan. → Tareas 1, 4, 5.
4. **Inscripción que falla a mitad** no deja ficha de responsable huérfana ni reintento que la duplique; reutilizar una ficha por DNI no pisa sus datos. → Tarea 5.
5. **Cuerpos mal formados** (número donde va texto, arreglo, objeto vacío, campo desconocido) dan 400, no 500. → Tarea 3.
6. **Cuenta de responsable con cero alumnos, con solo un alumno `propio` y con `propio` + hijos:** el panel no se rompe y los textos corresponden. → Tarea 13.

---

### Task 1: Ejecutor de pruebas y validadores base (server y client)

**Files:**
- Modify: `server/package.json` (script `"test": "tsx --test tests/*.test.ts"`), `CLAUDE.md` (sección Comandos: documentar `pnpm test` y que cubre funciones puras)
- Modify: `server/src/core/validacion.ts`, `client/src/core/lib/validacion.ts`, `server/src/core/fechas.ts` (agregar `hoyISOEnArgentina(ahora = new Date()): string` si no existe un equivalente)
- Create: `server/tests/casos-validacion.ts`, `server/tests/validacion.test.ts`

**Interfaces:**
- Produces (idénticos en las dos copias): `recortar(texto: string): string`; `normalizarDni(texto: string): string | null`; `normalizarCelular(texto: string): string | null`; `normalizarEmail(texto: string): string`; `fechaNacimientoValida(fechaISO: string, hoyISO: string): boolean`.
- Produces (zod, en las dos copias): `textoRequerido(etiqueta: string, max: number)`, `textoOpcional(max: number)` (vacío → `undefined`), `dniSchema`, `celularSchema`, `emailSchema`, `fechaNacimientoSchema`, y los envoltorios `opcional(schema)` (vacío → `undefined`) y `borrable(schema)` (vacío o `null` → `null`; el tipo resultante admite `null`). Cada esquema entrega el valor **normalizado**.

- [ ] **Step 1: Escribir la tabla de casos y el test** (falla porque faltan las funciones). En `casos-validacion.ts` exportar `CASOS_DNI`, `CASOS_CELULAR`, `CASOS_EMAIL`, `CASOS_FECHA_NACIMIENTO` como `[entrada, esperado][]`. El test (`node:test`) corre **cada tabla contra las dos copias**, importando la del client por ruta relativa (`../../client/src/core/lib/validacion`). Casos mínimos:
  - DNI: `"12.345.678"→"12345678"`, `"1234567"→"1234567"`, `" 33444555 "→"33444555"`, `"123456"→null`, `"123456789"→null`, `"12345678A"→null`, `""→null`.
  - Celular: `"351 555-1234"`, `"0351 15 555 1234"`, `"+54 9 351 5551234"`, `"54 351 555 1234"`, `"+5493515551234"` → `"+5493515551234"`; `"(011) 15-5555-1234"` y `"11 5555 1234"` → `"+5491155551234"`; `"2622-553670"` → `"+5492622553670"`; inválidos (`null`): `"hola"`, `""`, `"123"`, `"351 555-123"`, `"2622-553670M"`, `"+54 9 351 5551234 5"`, `"0800 555 1234"`.
  - Email: `" Juan@Mail.COM "→"juan@mail.com"`.
  - Fecha (con `hoy = "2026-11-07"`): `"2024-11-07"` válida (2 años justos), `"2024-11-08"` inválida, `"1926-11-07"` válida (100 años), `"1925-11-07"` inválida, `"2026-02-31"` inválida, `"1800-01-01"` inválida, `"mañana"` inválida.
- [ ] **Step 2: Agregar el script `test` y correr** `cd server && pnpm test` → falla por las funciones faltantes.
- [ ] **Step 3: Implementar las funciones y esquemas** en las dos copias. Celular, algoritmo (los casos no lo determinan): quitar espacios, puntos, guiones y paréntesis; rechazar cualquier otro carácter salvo un `+` inicial; quitar `+`; si empieza con `54` y tiene al menos 12 dígitos, quitar `54` y después un `9` si sigue; quitar un `0` inicial; si quedan 12 dígitos y los dígitos en posición 2, 3 o 4 son `15`, quitar ese `15` (probar la posición menor primero); aceptar solo 10 dígitos que no empiecen con `0` ni con `800`; devolver `+549` + los 10 dígitos. Fecha: validar el calendario con `Date.UTC` ida y vuelta y comparar la edad por año, mes y día contra `hoyISO` (sin `new Date()` local).
- [ ] **Step 4: Correr** `pnpm test` → todos los casos pasan en las dos copias. `pnpm typecheck` (server) y `cd client && pnpm typecheck` limpios.
- [ ] **Step 5: Commit** — `git add server/package.json server/tests server/src/core client/src/core/lib/validacion.ts CLAUDE.md && git commit -m "Validadores base de DNI, celular, email y fecha de nacimiento, con ejecutor de pruebas"`.

### Task 2: Modelo de datos y migración

**Files:**
- Modify: `server/prisma/schema.prisma`, `server/prisma/seed.ts`, `server/scripts/datos-prueba-2026.ts`, los `server/scripts/_*.ts` que crean padres con `vinculo` (`_mundo-avisos`, `_cambios-publicados`, `_invitaciones`, `_activacion`, `_minors-sub2`, `_chat-en-vivo`, `_chat-servicio`)
- Create: `server/prisma/migrations/<timestamp>_responsable_y_datos_incompletos/migration.sql`
- Modify: entidades y repositorios de `alumnos/` y `padres/`; `server/src/modules/notificaciones/notificacion.entity.ts` (agregar `"datos_incompletos"` a `TipoEstado`) y su zod en `notificacion.schema.ts`

**Interfaces:**
- Produces: `Alumno` con `dni?: string`, `fechaNacimiento?: Date`, `vinculoResponsable?: VinculoResponsable`; `Padre` con `dni?: string` y **sin** `vinculo`; `type VinculoResponsable = "padre" | "madre" | "tutor" | "propio"` en `alumnos/alumno.entity.ts`; `Cambios<T>` en `core/ports.ts`: `{ [K in keyof T]?: undefined extends T[K] ? T[K] | null : T[K] }`.

- [ ] **Step 1: Respaldar la base** (tiene datos reales): `docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/antes-3d-$(date +%F).dump`; comprobar que el archivo no está vacío.
- [ ] **Step 2: Editar `schema.prisma`:** `Alumno.dni String? @unique`, `Alumno.fechaNacimiento DateTime?`, `Alumno.vinculoResponsable VinculoPadre?`, `Padre.dni String? @unique`, quitar `Padre.vinculo`, agregar `propio` al enum `VinculoPadre` (se reutiliza ese enum de base de datos), agregar `datos_incompletos` al enum `TipoNotificacion`.
- [ ] **Step 3: Crear la migración con `pnpm prisma migrate dev --create-only`** y completar el SQL a mano en este orden: `ALTER TYPE "VinculoPadre" ADD VALUE 'propio'`; `ALTER TYPE "TipoNotificacion" ADD VALUE 'datos_incompletos'`; relajar los `NOT NULL`; `ALTER TABLE "Alumno" ADD COLUMN "vinculoResponsable" "VinculoPadre"`; `UPDATE "Alumno" a SET "vinculoResponsable" = p."vinculo" FROM "Padre" p WHERE a."padreId" = p."id"` (el backfill no usa el valor `propio`, así que puede ir en la misma migración que `ADD VALUE`); `ALTER TABLE "Padre" DROP COLUMN "vinculo"`. Aplicar con `pnpm prisma migrate dev` y `pnpm prisma:generate`.
- [ ] **Step 4: Adaptar el código al modelo:** entidades (arriba), `aEntidad` de los dos repositorios Prisma, el esquema de importación `crearPadreSinCuentaSchema` (sin `vinculo`), `padre.service.ts` (`crearPadre`/`crearPadreSinCuenta` ya no reciben ni guardan vínculo; `actualizarPadre` ya no lo cambia), `seed.ts` y `datos-prueba-2026.ts` (el vínculo va en cada `Alumno.vinculoResponsable`), y los scripts de la batería. Dejar que `pnpm typecheck` marque lo que falte (búsquedas por `dni`, `fechaNacimiento` o `vinculo` en `reportes/`, `documentos/`, etc.).
- [ ] **Step 5: Verificar:** `pnpm typecheck && pnpm build` limpios; consulta SQL: `select count(*) from "Alumno" where "padreId" is not null and "vinculoResponsable" is null` → `0`; los 147 alumnos y 3 padres reales siguen ahí; `pnpm exec tsx scripts/_faltantes.ts` y `_criterios.ts` siguen dando todo igual (regresión).
- [ ] **Step 6: Commit** — "Modelo: vínculo en el alumno, DNI y fecha de nacimiento opcionales, aviso de datos incompletos".

### Task 3: Esquemas de validación en todos los módulos

**Files:**
- Modify: todos los `server/src/modules/*/*.schema.ts` listados por `ls server/src/modules/*/*.schema.ts` (alumnos, asistencia, calificaciones, chats, ciclos, configuraciones, cuotas, cursos, documentos, observaciones, padres, profesores, usuarios)
- Create: `server/scripts/_3d-validacion-http.ts` (no versionado)

**Interfaces:**
- Consumes: Task 1 (`textoRequerido`, `opcional`, `borrable`, `dniSchema`, `celularSchema`, `emailSchema`, `fechaNacimientoSchema`).
- Produces: `crearPadreSchema` con `nombre`, `apellido`, `telefono` obligatorios y `dni`, `email`, `direccion`, `password` opcionales; `actualizarAlumnoSchema` / `actualizarPadreSchema` / `actualizarProfesorSchema` / `actualizarCursoSchema` con los campos borrables aceptando `null`; todos con `.strict()` (un campo desconocido es 400). `nuevoAlumnoSchema` se rehace en la Tarea 5.

- [ ] **Step 1: Escribir `_3d-validacion-http.ts`** (falla): con las cuentas del mundo de prueba, mandar a los endpoints existentes y comprobar el **código HTTP y el campo** del error. Casos: nombre `"   "` → 400 en `nombre`; `dni:"12A"` → 400 en `dni`; `telefono:"hola"` → 400 en `telefono`; `email:"x"` → 400; `fechaNacimiento` futura y `"1800-01-01"` → 400; curso con horario `18:00`→`17:00` → 400 en `horarios`; dos horarios que se pisan el mismo día → 400; `cupo:0` y `cupo:51` → 400; mensaje de chat de 2001 caracteres → 400; evaluación con fecha a dos años → 400; asistencia con fecha de mañana → 400; cuerpos `null`, `[]`, `{"nombre":5}`, `{"x":1}` en cada POST/PATCH → siempre 400 (nunca 500); PATCH con `{"nombre":null}` → 400 y con `{"direccion":null}` → 200.
- [ ] **Step 2: Reescribir cada esquema** aplicando las tablas de las Global Constraints (nombre y apellido `textoRequerido(..., 60)`, dirección `textoOpcional(150)` / `borrable`, etc.). Los esquemas de creación usan `opcional(...)`; los de edición usan `borrable(...)` en los campos borrables y `.optional()` sin `null` en los obligatorios. Reglas que cruzan campos van con `.superRefine` (horarios: fin posterior al inicio y sin pisarse por día; en la misma función de `curso.schema.ts`). Fechas de evaluación y asistencia: comparar contra `hoyISOEnArgentina()`. Los esquemas de contraseña, token y ciclo quedan como están.
- [ ] **Step 3: Correr** `pnpm exec tsx scripts/_3d-validacion-http.ts` con la API levantada (`pnpm dev` en otra terminal) → cada línea con real igual a esperado. `pnpm typecheck` limpio.
- [ ] **Step 4: Commit** — "Validación: una regla por tipo de dato en todos los esquemas del servidor".

### Task 4: Escrituras parciales y DNI editable

**Files:**
- Modify: `server/src/modules/{alumnos,padres,profesores,cursos}/*.repository.ts` y `*.repository.prisma.ts`; los cuatro `*.service.ts`; `server/src/modules/usuarios` solo si algún camino reescribe fichas
- Create: `server/scripts/_3d-parcial.ts` (no versionado)

**Interfaces:**
- Produces, en cada repositorio de `Alumno`, `Padre`, `Profesor` y `Curso`: `actualizarParcial(id: string, cambios: Cambios<Entidad>, tx?: unknown): Promise<Entidad>` (Prisma ignora `undefined`, `null` borra; un id inexistente lanza `EntityNotFoundError`); en `AlumnoRepository` y `PadreRepository`: `bloquear(id: string, tx?: unknown): Promise<void>` (`SELECT … FOR UPDATE` por `$queryRaw`).

- [ ] **Step 1: Escribir `_3d-parcial.ts`** (falla): sobre un alumno y un responsable de prueba por HTTP — (a) `PATCH {direccion:"A"}` y `PATCH {telefono:"351 555-1234"}` lanzados **a la vez** 20 veces: al final están las dos y el teléfono quedó `+5493515551234`; (b) `PATCH {direccion:null}` deja `direccion` en `null` y `{direccion:"   "}` también; (c) `PATCH {dni:"12.345.678"}` guarda `12345678`; repetirlo en otro alumno → 409 `Ya existe un alumno con el DNI 12345678`; igual para el responsable (`Ya existe un responsable con el DNI …`); (d) un alumno con teléfono viejo inválido (`UPDATE` directo a `"2622-54555P"`) acepta `PATCH {direccion:"B"}` → 200 y el teléfono sigue igual; (e) `PATCH {nombre:null}` → 400; (f) curso: `PATCH {cupo:30}` concurrente con `PATCH {aula:"3"}` conserva los dos; (g) la acción publicada sigue siendo `baja`/`reactivacion`/`cambio-curso`/`edicion` según corresponda y la inscripción del ciclo activo sigue el cambio de curso.
- [ ] **Step 2: Implementar `actualizarParcial` y `bloquear`** en los repositorios; el método `update` completo queda solo donde otro código lo use. Cambiar los cuatro `actualizar*` para construir `cambios` **solo con las claves presentes** en el pedido (no `datos.x ?? actual.x`), conservando la lógica de cuenta, estado, inscripción y anuncios existente. Verificar duplicados de DNI contra otra fila antes de escribir. `actualizarPadre` publica siempre dentro de la transacción.
- [ ] **Step 3: Correr** `_3d-parcial.ts` → todo igual a lo esperado; `_cambios-publicados.ts` (43 verificaciones) y `_ficha-pendiente.ts` siguen bien; `pnpm typecheck`.
- [ ] **Step 4: Commit** — "Edición parcial: las escrituras tocan solo las columnas recibidas; DNI editable".

### Task 5: Responsable del alumno: inscripción atómica, propio, ficha existente, cambio de responsable

**Files:**
- Modify: `server/src/modules/alumnos/{alumno.schema,alumno.service,alumno.controller,alumno.routes}.ts`, `server/src/modules/padres/padre.service.ts` (+ `padre.schema.ts`), `server/src/container.ts` (`AlumnoService` y `PadreService` se inyectan el repositorio del otro), `server/src/modules/alumnos/alumno.service.ts` (`listarPorPadreConCurso` ya devuelve `vinculoResponsable`)
- Create: `server/scripts/_3d-responsable.ts` (no versionado)

**Interfaces:**
- Produces: en `alumno.schema.ts`, `responsableSchema = z.discriminatedUnion("tipo", [...])` con `{ tipo:"existente", padreId, vinculo: "padre"|"madre"|"tutor" }`, `{ tipo:"nuevo", vinculo, datos:{ nombre, apellido, telefono, dni?, email?, direccion?, password? } }`, `{ tipo:"propio", telefono, email?, password? }`; `type ResponsableInput = z.infer<typeof responsableSchema>`; `nuevoAlumnoSchema` = `nombre`, `apellido`, `cursoId` (obligatorios) + `dni?`, `fechaNacimiento?`, `direccion?`, `telefono?`, `email?`, `foto?`, `observacionesMedicas?` + `responsable`.
- Produces: `AlumnoService.inscribirAlumno(datos: NuevoAlumnoInput): Promise<Alumno & { invitacion: EstadoInvitacion | null }>` — una sola transacción; la invitación sale después de confirmar (como en el sub 2). `AlumnoService.asignarResponsable(id: string, responsable: ResponsableInput): Promise<Alumno>` y ruta `PUT /api/alumnos/:id/responsable` (admin, secretario). Sin `password` y con email: cuenta pendiente + invitación; sin email: sin cuenta.
- Reglas: `propio` con DNI de una ficha existente reutiliza esa ficha, que manda: el nombre y apellido del alumno salen de la ficha, y teléfono, email y DNI escritos solo completan lo que la ficha no tenía; una ficha tiene a lo sumo un alumno `propio` (si ya tiene, 409); `propio` con fecha de nacimiento que da menos de 18 años → 400 en `fechaNacimiento`; el descuento por hermanos se calcula como hoy al inscribir y **no** se recalcula al cambiar de responsable. Sincronización `propio`: al editar `nombre`, `apellido` o `dni` del alumno se actualiza su ficha, y al editar esos campos en la ficha se actualiza su alumno `propio`, en la misma transacción, bloqueando primero el alumno (`bloquear`) y después la ficha. Dejar de ser `propio` (por `asignarResponsable`) corta la sincronización. `crearPadre` (alta desde Usuarios) pide `nombre`, `apellido`, `telefono`; con `email` crea cuenta (contraseña o invitación), sin email crea la ficha sin cuenta; sin vínculo ni alumno.

- [ ] **Step 1: Escribir `_3d-responsable.ts`** (falla) con estas comprobaciones por HTTP: inscribir menor con responsable `nuevo` mínimo → 201, alumno con `vinculoResponsable`, ficha sin DNI ni email, sin cuenta; con `email` → cuenta `pendiente` y `invitacion` presente; inscribir con `curso` inexistente → 4xx y **no queda ninguna ficha** `prueba-tmp-av` nueva (atomicidad); reintentar el mismo pedido fallido no duplica fichas; dos responsables nuevos sin DNI en la misma base no chocan entre sí; inscribir adulto `propio` → ficha con los datos del alumno y vínculo `propio`; `propio` con el DNI de una mamá ya registrada → reutiliza su ficha (mismo `padreId`), no pisa su teléfono ya cargado, completa su email vacío; un segundo `propio` sobre la misma ficha → 409; `propio` con fecha de hace 10 años → 400; `PATCH` de nombre del alumno `propio` se refleja en la ficha y al revés (también para la mamá con dos alumnos: cambia en ambos lados); `PUT /responsable` asigna a un alumno sin responsable, cambia vínculo y pasa a `propio`; al dejar de ser `propio` los nombres dejan de sincronizarse; `GET /api/alumnos/mios` trae `vinculoResponsable` y, para la mamá, sus dos cursadas.
- [ ] **Step 2: Implementar** esquemas, servicio, controlador y ruta; ajustar `container.ts`. La búsqueda de ficha existente es por DNI normalizado.
- [ ] **Step 3: Correr** `_3d-responsable.ts` y la regresión (`_cambios-publicados.ts`, `_invitaciones.ts`, `_activacion.ts`, `_minors-sub2.ts`) → todo igual a lo esperado; `pnpm typecheck`.
- [ ] **Step 4: Commit** — "Responsable del alumno: inscripción atómica, alumno propio, ficha existente y cambio de responsable".

### Task 6: Datos incompletos en el server (criterio, endpoint y aviso)

**Files:**
- Create: `server/src/modules/alumnos/alumno.incompleto.ts`
- Modify: `alumno.repository.ts` / `alumno.repository.prisma.ts`, `alumno.controller.ts`, `alumno.routes.ts`, `notificacion.tipos.ts`, `notificacion.criterios.prisma.ts`, `notificacion.suscripciones.ts`, `notificacion.entity.ts` (`RecursoAviso` con `{ tipo: "datos-incompletos" }`)
- Create: `server/scripts/_3d-incompletos.ts` (no versionado), `server/tests/incompleto.test.ts`

**Interfaces:**
- Produces: `type DatoFaltante = "dni" | "fechaNacimiento" | "responsable" | "vinculo" | "responsableDni" | "responsableTelefono" | "responsableEmail"`; `datosFaltantes(alumno: Pick<Alumno, "dni" | "fechaNacimiento" | "padreId" | "vinculoResponsable">, responsable: Pick<Padre, "dni" | "telefono" | "email"> | null): DatoFaltante[]` (orden fijo como el tipo; sin `padreId` → `responsable` y nada de los `responsable*`; con `propio`, el DNI se informa solo como `dni`); `AlumnoRepository.findIncompletos(tx?: unknown): Promise<{ alumnoId: string; nombre: string; faltan: DatoFaltante[] }[]>` (alumno activo e inscripto en el ciclo activo, como `findFaltantes`); `GET /api/alumnos/incompletos` (admin, secretario) → `{ [alumnoId]: DatoFaltante[] }`.

- [ ] **Step 1: Escribir los tests.** `server/tests/incompleto.test.ts` (falla): `datosFaltantes` con alumno completo → `[]`; sin DNI ni fecha → `["dni","fechaNacimiento"]`; sin `padreId` → `["responsable"]` (+ lo propio del alumno); con padre y sin `vinculoResponsable` → incluye `"vinculo"`; con responsable sin teléfono ni email → `["responsableTelefono","responsableEmail"]`; vínculo `propio` con la ficha sin DNI → no incluye `"responsableDni"`. `_3d-incompletos.ts` (HTTP): `GET /incompletos` lista solo alumnos activos del ciclo activo; completar el email del responsable por PATCH saca ese ítem; el aviso `datos_incompletos` aparece para admin y secretario con texto `Hay N alumnos con datos incompletos` (singular `Hay 1 alumno con datos incompletos`), sube de nivel cuando N crece, queda resuelto cuando N llega a 0, no le llega a padres ni profesores, y se puede apagar en preferencias (`PATCH /api/notificaciones/preferencias/datos_incompletos`).
- [ ] **Step 2: Implementar** el criterio puro, `findIncompletos`, la ruta, el tipo de aviso (`grupo:"staff"`, `clase:"estado"`, etiqueta `Datos incompletos de los alumnos`, clave `datos-incompletos`, tono `warning`, recurso `{ tipo:"datos-incompletos" }`) y las suscripciones: `alumnos.cambiaron` suma `datos_incompletos` a lo que sincroniza, y se suscribe también a `datos.cambiaron` para sincronizar `datos_incompletos` cuando `dato` es `"padres"` o `"alumnos"` (dentro de la transacción).
- [ ] **Step 3: Correr** `pnpm test` y `_3d-incompletos.ts`, y la regresión de avisos (`_criterios.ts`, `_avisos-servicio.ts`, `_suscripciones.ts`, `_reconciliar.ts`) → todo igual a lo esperado.
- [ ] **Step 4: Commit** — "Datos incompletos: criterio único, endpoint y aviso para administración y secretaría".

### Task 7: Client — validación en las pantallas, diferencias y errores por campo

**Files:**
- Create: `client/src/core/lib/diferencias.ts`, `client/src/core/lib/erroresDeCampo.ts`
- Create: `server/tests/diferencias.test.ts`
- Modify: `client/src/core/lib/apiClient.ts` solo si `ApiError` no expone `details`

**Interfaces:**
- Produces: `cambiosParaEnviar<T extends Record<string, unknown>>(valores: T, base: T, borrables: readonly (keyof T)[]): Partial<Record<keyof T, unknown>>` — incluye solo las claves cuyo valor recortado difiere de `base`; texto vacío → `null` si la clave es borrable, si no se omite; `fechaNacimiento` y similares siguen siendo texto `AAAA-MM-DD`. `hayCambios(cambios): boolean`. `erroresDeCampo(error: unknown): { campos: Record<string, string>; general: string | null }` — reparte `ApiError.details` por campo y manda los 409 de DNI al campo `dni`.

- [ ] **Step 1: Test `diferencias.test.ts`** (falla): sin cambios → `{}`; solo se manda el campo tocado; `"  Ana "` contra `"Ana"` → `{}` (recortado); `""` en borrable → `null`; `""` en obligatorio → no aparece; `erroresDeCampo` con `details:{telefono:["…"]}` → `campos.telefono` con el mensaje, y con un 409 `Ya existe un alumno con el DNI` → `campos.dni`.
- [ ] **Step 2: Implementar** las dos funciones (puras, rutas relativas) y el soporte de `details` en `ApiError` si hace falta.
- [ ] **Step 3: Correr** `cd server && pnpm test` → pasa; `cd client && pnpm typecheck`.
- [ ] **Step 4: Commit** — "Client: diferencias para editar solo lo que cambió y errores repartidos por campo".

### Task 8: "Mientras editabas, X cambió…"

**Files:**
- Create: `client/src/core/formularios/reconciliar.ts`, `client/src/core/formularios/useFormularioAlDia.ts`, `client/src/core/formularios/AvisoDeCambioAjeno.tsx`
- Create: `server/tests/reconciliar.test.ts`

**Interfaces:**
- Consumes: `ultimoCambioAjeno(dato)` y `CambioAjeno.ids/por/en` de `core/tiempoReal/cambiosEnVivo.ts`.
- Produces: `reconciliar<T extends Record<string, unknown>>(entrada: { valores: T; base: T; servidor: T }): { valores: T; base: T; actualizados: (keyof T)[] }` — un campo está **sin tocar** si `valores[k]` es igual a `base[k]`; los sin tocar toman el valor del servidor si cambió y se listan en `actualizados`; los tocados se conservan; `base` pasa a ser `servidor`. Comparación por igualdad profunda (`JSON.stringify` alcanza). `useFormularioAlDia<T>(opciones: { dato: string; claveDeId: string; id: string; servidor: T | undefined; etiquetas: Record<keyof T, string>; valores: T; aplicar: (parcial: Partial<T>) => void }): { base: T | undefined; aviso: string | null; descartarAviso(): void }` — al cambiar `servidor`, si el último cambio ajeno de `dato` incluye `id` en `ids[claveDeId]`, reconcilia, llama a `aplicar` con lo actualizado y arma `Mientras editabas, <nombre|el sistema> cambió: <lista con "y">.`; si no se actualizó ningún campo, `aviso` es `null`. `<AvisoDeCambioAjeno aviso onCerrar />` lo muestra fijo dentro del formulario.

- [ ] **Step 1: Test `reconciliar.test.ts`** (falla): campo sin tocar cambia en el servidor → toma el nuevo y figura en `actualizados`; campo tocado que también cambió el otro → conserva lo escrito y no figura; campo tocado que el otro no cambió → igual; el usuario escribe y vuelve al valor original → cuenta como sin tocar; `base` nuevo = `servidor`; sin diferencias → `actualizados` vacío.
- [ ] **Step 2: Implementar** `reconciliar` (puro, rutas relativas) y el hook, que además lleva el resaltado breve de los campos actualizados con `useResaltado`/la clase que ya usa el 3c (decisión de implementación).
- [ ] **Step 3: Correr** `pnpm test` y `cd client && pnpm typecheck && pnpm lint`.
- [ ] **Step 4: Commit** — "Client: aviso 'Mientras editabas…' y reconciliación de campos sin tocar".

### Task 9: Client — alta con lo mínimo (inscripción y selector de responsable)

**Files:**
- Create: `client/src/features/padres/fichasParecidas.ts`, `client/src/features/padres/components/SelectorDeResponsable.tsx`
- Create: `server/tests/fichas-parecidas.test.ts`
- Modify: `client/src/features/alumnos/pages/InscribirAlumnoPage.tsx`, `client/src/features/alumnos/{types.ts,hooks/useInscribirAlumno.ts,alumnoService.ts}`, `client/src/features/padres/{types.ts,hooks/useCrearPadre.ts}`, `client/src/features/auth/types.ts` (`ROL_LABELS.padre` → "Responsable"), `client/src/features/usuarios/pages/UsuariosPage.tsx`

**Interfaces:**
- Produces: `fichasParecidas(nuevo: { nombre: string; apellido: string }, existentes: Padre[]): Padre[]` — iguales tras quitar tildes, mayúsculas y espacios de más en nombre **y** apellido, o uno contenido en el otro (`María`/`María José`); usa `normalizarTexto` por ruta relativa. `ResponsableElegido` (tipo del client, igual a `responsableSchema` del server). `<SelectorDeResponsable valor onCambio padres modoDeAcceso />`: buscar existente, cargar uno nuevo (nombre, apellido, teléfono obligatorios; DNI, email opcionales; "¿Cómo accede?" solo con email), o "es responsable de sí mismo" (solo adultos); al elegir "nuevo" con coincidencias de `fichasParecidas`, muestra `Ya hay una ficha parecida: <nombre> · DNI <…> · <celular>. ¿Es la misma persona?` con dos botones (**Usar esa ficha** / **Es otra persona**) y **no deja continuar sin elegir**; `VINCULO_LABELS` suma `propio: "El propio alumno"`.

- [ ] **Step 1: Test `fichas-parecidas.test.ts`** (falla): `María Gómez` vs `maria gomez ` → coincide; `María` vs `María José` (mismo apellido) → coincide; `Ana Gómez` vs `Ana Pérez` → no; `José Luis Pérez` vs `jose perez` → coincide por contención; lista vacía → `[]`.
- [ ] **Step 2: Implementar `fichasParecidas`** y los tipos nuevos del client (`Alumno.dni?`, `fechaNacimiento?`, `vinculoResponsable?`; `Padre.dni?` sin `vinculo`; `NuevoAlumnoInput` con `responsable`).
- [ ] **Step 3: Reescribir `InscribirAlumnoPage.tsx`:** mínimo del paso 1 = nombre, apellido y celular propio si es adulto; el DNI, la fecha, la dirección y lo demás son opcionales y se validan con los esquemas de la Tarea 1 (calcular `esAdulto` por nivel de curso `adults_*` o por edad si hay fecha; la casilla "es responsable de sí mismo" aparece solo para adultos y se desmarca sola si la fecha da menos de 18); el paso del responsable usa `SelectorDeResponsable`; la confirmación es **un solo** `useInscribirAlumno` que manda `responsable`; el aviso de invitación no enviada se conserva. Mostrar los errores del servidor con `erroresDeCampo` al lado del campo.
- [ ] **Step 4: Textos:** buscar con `grep -rniE "padre|madre|tutor" client/src --include=*.tsx --include=*.ts` los textos **visibles** (no identificadores de código) y cambiar "Padre/Tutor", "Tutor" y similares por "Responsable" en el wizard, el listado y el legajo de alumnos, el panel de Usuarios y `ROL_LABELS` (`padre` → "Responsable"); el texto de la familia ("Mis hijos"…) lo adapta la Tarea 13; `UsuariosPage` crea responsables con `nombre`, `apellido`, `telefono` y email opcional, sin vínculo; si no hay email, no pide "¿Cómo accede?".
- [ ] **Step 5: Verificar:** `pnpm test`; `cd client && pnpm typecheck && pnpm lint`; recorrido en el navegador (Playwright, fuera del repo) con datos `prueba-tmp-av`: inscribir menor con lo mínimo, adulto `propio`, ficha parecida (aparece la pregunta y bloquea hasta elegir), error de DNI repetido en el campo del DNI.
- [ ] **Step 6: Commit** — "Inscripción con lo mínimo: responsable nuevo, existente o propio, con ayuda contra fichas duplicadas".

### Task 10: Client — legajo: editar solo lo que cambió, "Mientras editabas" y cambiar de responsable

**Files:**
- Modify: `client/src/features/alumnos/pages/AlumnoDetailPage.tsx`, `client/src/features/alumnos/{hooks/useActualizarAlumno.ts,hooks/useAsignarResponsable.ts (nuevo),alumnoService.ts}`, `client/src/features/padres/hooks/useActualizarPadre.ts`

**Interfaces:**
- Consumes: Tareas 1, 7, 8, 9 (`cambiosParaEnviar`, `erroresDeCampo`, `useFormularioAlDia`, `SelectorDeResponsable`).
- Produces: `useAsignarResponsable()` → mutación `PUT /api/alumnos/:id/responsable` con `ResponsableElegido`.

- [ ] **Step 1: Rehacer el modal "Editar datos"** con los campos del alumno (`nombre`, `apellido`, **DNI**, **fecha de nacimiento**, dirección, teléfono propio, email, observaciones médicas) y de su responsable (`nombre`, `apellido`, **DNI**, dirección, teléfono, email; el vínculo ya no se edita acá). Mantener `base` con el último valor conocido del servidor; guardar manda **solo** `cambiosParaEnviar(...)` del alumno y del responsable (dos pedidos solo si hay cambios en cada uno; sin cambios, no se llama y se avisa "No hay cambios"). Las validaciones del client corren **solo sobre los campos modificados**. Conectar `useFormularioAlDia` para el alumno (`dato:"alumnos"`, `claveDeId:"alumnoIds"`) y el responsable (`dato:"padres"`, `claveDeId:"padreIds"`) con una tabla de etiquetas en castellano, y mostrar `AvisoDeCambioAjeno`. Errores por campo con `erroresDeCampo`. Si el alumno es `propio`, nombre, apellido y DNI de la ficha se muestran juntos y se aclara que son los mismos.
- [ ] **Step 2: "Cambiar responsable"**: botón junto a "Datos del responsable" que abre un modal con `SelectorDeResponsable` (incluida la opción "propio" y la ayuda de fichas parecidas) y guarda con `useAsignarResponsable`; un alumno sin responsable muestra "Asignar responsable".
- [ ] **Step 3: Verificar:** `cd client && pnpm typecheck && pnpm lint`; Playwright con datos de prueba: editar solo el teléfono y comprobar en la red que el `PATCH` lleva únicamente `telefono`; vaciar la dirección manda `null`; un alumno de prueba con teléfono inválido guardado a mano se edita en otro campo sin error (Review Focus 1); con otra sesión de administración cambiando la dirección mientras el modal está abierto, el campo se actualiza y aparece `Mientras editabas, <nombre> cambió: dirección.`, y si se cambia el mismo campo que se está editando no aparece nada y se conserva lo escrito.
- [ ] **Step 4: Commit** — "Legajo: edición parcial, aviso de cambios ajenos y cambio de responsable".

### Task 11: Client — curso, profesor, configuración y alta de profesor con el mismo criterio

**Files:**
- Modify: `client/src/features/cursos/pages/CursosAdminPage.tsx`, `client/src/features/profesores/pages/ProfesoresAdminPage.tsx`, `client/src/features/dashboard/pages/ConfiguracionPage.tsx`, esquemas zod de esas pantallas y de `features/usuarios/pages/UsuariosPage.tsx` (profesor, secretario, administrador), `features/calificaciones` (nueva evaluación), `features/observaciones`, `features/chats` (largo del mensaje), `features/cuotas` (notas del pago)

- [ ] **Step 1: Cursos y profesores:** el modal de edición manda `cambiosParaEnviar` (horarios cuenta como un solo campo, se manda entero si cambió), usa `useFormularioAlDia` (`dato:"cursos"`/`"profesores"`, `claveDeId:"cursoIds"`/`"profesorIds"`) con sus etiquetas y valida solo lo modificado; la creación valida todo con los esquemas de la Tarea 1 y los topes de las Global Constraints (cupo 1–50, horarios sin pisarse, teléfono de profesor opcional con formato).
- [ ] **Step 2: Configuración:** conectar el valor de la cuota a `useFormularioAlDia` (`dato:"configuracion"`) reemplazando la lógica propia de `ultimoGuardado` del 3c, manteniendo su comportamiento (ya probado por `e2e-3c-configuracion`).
- [ ] **Step 3: Resto de formularios:** aplicar los esquemas y topes a nueva evaluación, categoría, observación, mensaje de chat, notas del cobro y los datos de cuenta; todos con mensajes en castellano al lado del campo.
- [ ] **Step 4: Verificar:** `cd client && pnpm typecheck && pnpm lint`; Playwright: editar solo el cupo de un curso de prueba (el `PATCH` lleva solo `cupo`), mensaje de chat de 2001 caracteres bloqueado en pantalla con su mensaje, y regresión del 3c de Configuración.
- [ ] **Step 5: Commit** — "Curso, profesor y configuración: edición parcial, aviso de cambios ajenos y validación".

### Task 12: Client — datos incompletos (marca, filtro, cartel y aviso)

**Files:**
- Create: `client/src/features/alumnos/hooks/useAlumnosIncompletos.ts`, `client/src/features/alumnos/datosFaltantes.ts` (etiquetas)
- Modify: `client/src/features/alumnos/pages/AlumnosListPage.tsx`, `AlumnoDetailPage.tsx`, `client/src/features/notificaciones/{types.ts,rutas.ts}`, `client/src/features/alumnos/alumnoService.ts`

**Interfaces:**
- Produces: `useAlumnosIncompletos()` (clave `["alumnos","incompletos"]`, `GET /api/alumnos/incompletos` → `Record<string, DatoFaltante[]>`); `ETIQUETA_FALTANTE: Record<DatoFaltante, string>` (`dni`→"DNI", `fechaNacimiento`→"Fecha de nacimiento", `responsable`→"Responsable", `vinculo`→"Vínculo con el responsable", `responsableDni`→"DNI del responsable", `responsableTelefono`→"Celular del responsable", `responsableEmail`→"Email del responsable"); `rutaDeAviso` para `{ tipo:"datos-incompletos" }` → `/alumnos?ciclo=activo&datos=incompletos`.

- [ ] **Step 1: Listado:** marca `Datos incompletos` en la fila (escritorio y tarjeta móvil) con el detalle de lo que falta en el `title`; filtro `datos` (`todos` / `incompletos`) en la dirección con `elegir`, reiniciando la página, que trae puesto el enlace del aviso; el teléfono de contacto de la fila es el del responsable con su vínculo (`Madre`, `Padre`, `Tutor/a`, `Propio`) y `—` si no hay.
- [ ] **Step 2: Legajo:** cartel con la lista de lo que falta y un botón que abre "Editar datos" (o "Asignar responsable" si falta el responsable). `DNI` y `fecha de nacimiento` ausentes se muestran como "Sin cargar" en vez de romper (`formatDni`, `calcularEdad` aceptan `undefined`; corregir también `GlobalSearch` y cualquier uso que `typecheck` marque).
- [ ] **Step 3: Aviso:** agregar el tipo y el recurso a los tipos del client y la ruta; las preferencias de Mi cuenta lo muestran solas (vienen del server).
- [ ] **Step 4: Verificar:** `cd client && pnpm typecheck && pnpm lint`; Playwright con datos de prueba: un alumno sin responsable figura incompleto, aparece en el filtro, el aviso de la campana lleva a la lista filtrada, y completar lo que falta lo saca de la lista y resuelve el aviso al instante con otra pestaña abierta (señales del 3c).
- [ ] **Step 5: Commit** — "Datos incompletos: marca, filtro, cartel en el legajo y aviso en la campana".

### Task 13: Client — el panel del responsable para padres y adultos

**Files:**
- Create: `client/src/features/alumnos/modoDelPanel.ts`
- Create: `server/tests/modo-del-panel.test.ts`
- Modify: `client/src/core/components/layout/nav.ts` (`navPorRol(rol, modo?)`), `AppLayout.tsx`, `client/src/features/alumnos/pages/ParentDashboardPage.tsx`, `client/src/features/alumnos/hooks/useMisHijos.ts` (opción `enabled`), `client/src/core/components/layout/pageTitles.ts`

**Interfaces:**
- Produces: `modoDelPanel(cursadas: { vinculoResponsable?: VinculoResponsable }[]): "hijos" | "propio" | "mixto"` (`"propio"` si todas son propias y hay al menos una; `"mixto"` si hay propias y de otros; si no, `"hijos"`, también con lista vacía); `etiquetasDelPanel(modo): { menu: Record<"resumen"|"notas"|"asistencia"|"cuotas"|"documentacion"|"chat", string>; titulo: string }` con la tabla del spec (hijos: "Mis hijos", "Calificaciones", "Asistencia", "Cuotas", "Documentación", "Mensajes"; propio: "Mi cursada", "Mis notas", "Mi asistencia", "Mis cuotas", "Mi documentación", "Chat con el instituto"; mixto: "Cursadas" con los demás como hijos); `navPorRol("padre", modo)` arma el menú con esas etiquetas.

- [ ] **Step 1: Test `modo-del-panel.test.ts`** (falla): lista vacía → `"hijos"`; `[madre]` → `"hijos"`; `[propio]` → `"propio"`; `[propio, madre]` → `"mixto"`; `etiquetasDelPanel("propio").menu.resumen === "Mi cursada"`; `etiquetasDelPanel("mixto").menu.resumen === "Cursadas"`.
- [ ] **Step 2: Implementar `modoDelPanel` y `etiquetasDelPanel`** (puras, rutas relativas) y conectar: `AppLayout` pide `useMisHijos({ enabled: rol === "padre" })` y pasa el modo a `navPorRol`; `ParentDashboardPage` muestra el selector solo si hay más de una cursada, con `Yo` para la propia en modo `mixto`, y el encabezado `Mi cursada · <nivel>` cuando corresponde; con cero cursadas se conserva el mensaje existente. Cambiar los textos "hijo/hijos" del panel que correspondan al modo.
- [ ] **Step 3: Verificar:** `pnpm test`; `cd client && pnpm typecheck && pnpm lint`; Playwright con cuentas de prueba: padre con hijos (menú actual), adulto solo (menú "Mi cursada…", sin selector, ve notas, asistencia, cuotas, documentación y puede autorizar su imagen), mamá con hijo y ella misma (selector `Yo` + hijo), responsable sin alumnos (mensaje, sin error), y que ninguna de las cuentas ve datos de otra (privacidad: abrir `?hijo=<id ajeno>` cae en una cursada propia).
- [ ] **Step 4: Commit** — "Panel del responsable: textos y selector para adultos que cursan".

### Task 14: Verificación final y documentación

**Files:**
- Modify: `CLAUDE.md` (secciones nuevas o ajustadas: validación y `pnpm test`, modelo de responsable y vínculo en el alumno, datos incompletos y su aviso, edición parcial y `actualizarParcial`, "Mientras editabas", panel del responsable; ajustar la tabla de la API: `GET /api/alumnos/incompletos`, `PUT /api/alumnos/:id/responsable`, cuerpo de `POST /api/alumnos`, `POST /api/padres` sin vínculo)

- [ ] **Step 1: Batería completa** (servidor y navegador, como en el 3c): `pnpm typecheck && pnpm build` en las dos carpetas, `pnpm test`, `pnpm lint`, todos los `server/scripts/_*.ts` de la batería (incluidos los de esta rama) y los recorridos de Playwright de los subproyectos 3b y 3c más los de las Tareas 9 a 13 → cada línea con real igual a esperado, sin fallos.
- [ ] **Step 2: Línea base de datos:** 147 alumnos y 3 padres reales sin cambios en sus datos, `valorCuota` en `null`, ningún registro `prueba-tmp*` suelto, el login de `p6@prueba.babylon.test` anda.
- [ ] **Step 3: Documentar en `CLAUDE.md`** lo listado arriba y commit — "Documentar el subproyecto 3d".
- [ ] **Step 4:** pasar a `superpowers:requesting-code-review` sobre toda la rama y, con la revisión resuelta, `superpowers:finishing-a-development-branch`.
