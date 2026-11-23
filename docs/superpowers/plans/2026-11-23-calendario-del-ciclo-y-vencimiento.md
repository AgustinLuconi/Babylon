# Calendario del ciclo lectivo y día de vencimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada ciclo lectivo guarda su inicio, su fin y sus pausas (receso de invierno, feriados); el sistema los usa para generar cuotas y para aceptar asistencia, y el día de vencimiento de las cuotas se elige en Configuración → "Cuota mensual".

**Architecture:** Reglas puras de calendario en `server/src/modules/ciclos/ciclo.calendario.ts` (trabajan con días `AAAA-MM-DD`, no con instantes) con una copia idéntica en el client; `Ciclo` suma `inicio`/`fin` **opcionales** (null = calendario por defecto, 1/3 al 30/11) y una entidad secundaria `PausaDelCiclo` gestionada por `CicloRepository`; la guarda `VerificadorDeCiclo` suma `verificarDiaDeClases`; `Configuracion` suma `diaVencimiento`. Toda escritura publica `datos.cambiaron` dentro de su transacción.

**Tech Stack:** Express 5, Prisma 6, PostgreSQL 18, Zod, `tsx --test`; React 19, TanStack Query, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-23-calendario-del-ciclo-y-vencimiento-design.md`

**Rama:** `calendario-del-ciclo` (desde `main`).

## Global Constraints

- Node/pnpm: antes de cualquier comando `source ~/.nvm/nvm.sh && nvm use`. Server: `pnpm typecheck`, `pnpm test`. Client: `pnpm typecheck`, `pnpm lint`.
- Feature-first: nada de carpetas `domain/`, `data/`, `presentation/`. El service recibe repositorios por constructor, lanza errores de `core/errors.ts` (nunca códigos HTTP), `container.ts` es el único lugar que instancia repositorios. Todo método de repositorio acepta `tx?: unknown` al final y el service lo reenvía a **cada** llamada dentro de `runInTransaction`.
- Server y client no comparten código: la regla pura se escribe dos veces (mismos nombres) y una tabla de casos única (`server/tests/casos-calendario.ts`) corre contra las dos copias. El módulo del client no puede usar el alias `@/` (se importa por ruta relativa desde `server/tests/`).
- Fechas calendario: en base `@db.Date` (igual que `Asistencia.fecha`; comprobar en `schema.prisma`), en el código de reglas siempre cadenas `AAAA-MM-DD`; "hoy" siempre con `hoyISOEnArgentina()`/`fechaHoraEnArgentina()` de `core/fechas.ts`, nunca `toISOString()` sobre "ahora".
- Defaults sin cambios de comportamiento: sin fechas cargadas rige 1/3–30/11 del año del ciclo, sin pausas, vencimiento día 10. **`Configuracion.valorCuota` queda en null al terminar de probar.**
- Mensajes de error al usuario en español rioplatense; textos exactos de esta tabla:
  - "La fecha de inicio no puede ser posterior a la de fin"
  - "Las fechas tienen que estar dentro del año {anio}"
  - `La pausa "{nombre}" quedaría fuera del ciclo`
  - "La pausa tiene que terminar el mismo día o después de empezar"
  - "La pausa tiene que estar dentro del ciclo lectivo"
  - `La pausa se superpone con "{nombre}"`
  - "Ese día no hay clases: {motivo}" (motivo: "Fuera del ciclo lectivo" o el nombre de la pausa)
  - día de vencimiento: entero de 1 a 28, "El día de vencimiento tiene que estar entre 1 y 28".
- Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Antes de la migración, respaldo `pg_dump -Fc` en `~/respaldos-babylon/`. Los scripts nuevos `server/scripts/_*.ts` se versionan con `git add -f`.

## Review Focus

- Un ciclo sin fechas (columnas null) debe comportarse como 1/3–30/11: los ~20 scripts que crean ciclos solo con `anio` no se tocan y el importador de datos reales sigue funcionando (Task 2, Task 3).
- Los límites son inclusivos: inicio, fin y los extremos de una pausa son días con/sin clases según la regla; julio con receso del 20 al 31 **sí** genera cuota; un mes cubierto entero por una pausa no (Task 1, Task 5).
- La asistencia se valida contra el calendario del ciclo **del curso**, no del ciclo activo: un curso de un ciclo viejo usa el calendario de su ciclo (Task 4).
- Cambiar `inicio`/`fin` que deje una pausa afuera se rechaza nombrando la pausa; lo ya guardado (asistencia, cuotas) no se toca nunca (Task 3, Task 4).
- Editar pausas toma `FOR UPDATE` del ciclo y espera a una asistencia que ya verificó el ciclo (`FOR SHARE`); un ciclo bloqueado rechaza todas las rutas nuevas (Task 3).

---

### Task 1: Reglas puras del calendario (server) y tabla de casos

**Files:**
- Create: `server/src/modules/ciclos/ciclo.calendario.ts`
- Create: `server/tests/casos-calendario.ts`
- Create: `server/tests/calendario-ciclo.test.ts`
- Modify: `server/src/modules/cuotas/cuota.calendario.ts` (`vencimientoDelMes` recibe el día)

**Interfaces:**
- Consumes: `fechaHoraEnArgentina` de `server/src/core/fechas.ts`.
- Produces (en `ciclo.calendario.ts`):
  ```ts
  export interface PausaDeCalendario { desde: string; hasta: string; nombre: string }   // días AAAA-MM-DD
  export interface CalendarioDelCiclo { anio: number; inicio: string; fin: string; pausas: PausaDeCalendario[] }
  export function calendarioPorDefecto(anio: number): CalendarioDelCiclo            // 1/3 al 30/11, sin pausas
  export function motivoSinClases(fecha: string, calendario: CalendarioDelCiclo): string | null
  export function esMesLectivo(mes: number, calendario: CalendarioDelCiclo): boolean
  export function validarFechasDelCiclo(calendario: CalendarioDelCiclo): string | null   // mensaje o null
  export function validarPausa(calendario: CalendarioDelCiclo, nueva: PausaDeCalendario, otras: PausaDeCalendario[]): string | null
  ```
  y en `cuota.calendario.ts`: `vencimientoDelMes(mes: number, anio: number, hoy: Date, diaVencimiento: number): Date`.

- [ ] **Step 1: Write the failing tests.** `casos-calendario.ts` exporta `CALENDARIO_C` (`anio: 2026, inicio: "2026-03-16", fin: "2026-11-27"`, pausas `{desde:"2026-07-20",hasta:"2026-07-31",nombre:"Receso de invierno"}` y `{desde:"2026-07-09",hasta:"2026-07-09",nombre:"Día de la Independencia"}`), `CALENDARIO_D` (`2026`, 1/3–30/11, pausa `2026-08-01`..`2026-08-31` "Vacaciones") y las tablas `CASOS_MOTIVO: [fecha, esperado][]` y `CASOS_MES: [calendario, mes, esperado][]`. `calendario-ciclo.test.ts` (`describe`/`test` de `node:test`) afirma:
  - `motivoSinClases` sobre C: `2026-03-15`→`"Fuera del ciclo lectivo"`, `2026-03-16`→`null`, `2026-11-27`→`null`, `2026-11-28`→`"Fuera del ciclo lectivo"`, `2026-01-20`→`"Fuera del ciclo lectivo"`, `2026-07-09`→`"Día de la Independencia"`, `2026-07-20` y `2026-07-31`→`"Receso de invierno"`, `2026-08-03`→`null`.
  - `esMesLectivo` sobre C: marzo `true`, febrero `false`, enero `false`, julio `true`, noviembre `true`, diciembre `false`; sobre D: agosto `false`, julio `true`.
  - `calendarioPorDefecto(2026)` = inicio `2026-03-01`, fin `2026-11-30`, pausas `[]`.
  - `validarFechasDelCiclo`: inicio > fin → "La fecha de inicio no puede ser posterior a la de fin"; inicio `2025-12-31` en año 2026 → "Las fechas tienen que estar dentro del año 2026"; una pausa fuera de `[inicio, fin]` → `La pausa "Vacaciones" quedaría fuera del ciclo`; C válido → `null`.
  - `validarPausa`: `desde > hasta` → "La pausa tiene que terminar el mismo día o después de empezar"; fuera de C → "La pausa tiene que estar dentro del ciclo lectivo"; superpuesta con el receso → `La pausa se superpone con "Receso de invierno"`; `2026-08-10..2026-08-10` válida → `null`.
  - `vencimientoDelMes(3, 2026, new Date("2026-03-05T15:00:00Z"), 10)` = `2026-03-10T00:00:00.000Z`; con hoy `2026-03-15T15:00:00Z`: día 10 → `2026-03-31`, día 20 → `2026-03-20`; mes futuro `(4, 2026, hoy 2026-03-15)` con día 10 → `2026-04-10`; hoy `2026-03-08` con día 5 → `2026-03-31`.
- [ ] **Step 2: Run to verify RED.** `cd server && pnpm exec tsx --test tests/calendario-ciclo.test.ts`. Expected: FALLA (módulo no existe / `vencimientoDelMes` con cuatro argumentos devuelve otra cosa).
- [ ] **Step 3: Implement `ciclo.calendario.ts` as specified.** Todo con comparación de cadenas `AAAA-MM-DD`; `esMesLectivo` recorre los días del mes (`anio` del calendario) y devuelve `true` si algún día tiene `motivoSinClases === null`; `validarPausa` chequea en este orden: orden de fechas, dentro del ciclo, superposición (rangos que se tocan, extremos incluidos). En `cuota.calendario.ts`, `vencimientoDelMes` usa el 4.º parámetro en lugar de `DIA_VENCIMIENTO` (la constante y el resto del archivo quedan hasta el Task 5).
- [ ] **Step 4: Run to verify GREEN.** `pnpm exec tsx --test tests/calendario-ciclo.test.ts` y `pnpm typecheck`. Expected: PASS y typecheck con **un** error esperado en `cuota.service.ts` (llama con tres argumentos): corregirlo ya pasando `10` como cuarto argumento provisoriamente.
- [ ] **Step 5: Commit** `git add -f server/tests/casos-calendario.ts server/tests/calendario-ciclo.test.ts server/src/modules/ciclos/ciclo.calendario.ts server/src/modules/cuotas && git commit -m "Calendario del ciclo: reglas puras y tabla de casos"`.

---

### Task 2: Datos — migración, entidad y repositorio

**Files:**
- Modify: `server/prisma/schema.prisma`, `server/src/modules/ciclos/ciclo.entity.ts`, `ciclo.repository.ts`, `ciclo.repository.prisma.ts`, `ciclo.service.ts` (literal de `crearCiclo`), `paseDeAnio.service.ts:152` (literal del ciclo nuevo), `server/src/modules/configuraciones/configuracion.entity.ts`
- Create: `server/prisma/migrations/<fecha>_calendario_del_ciclo/migration.sql` (generada), `server/scripts/_ciclo-calendario-datos.ts`

**Interfaces:**
- Consumes: Task 1 (`calendarioPorDefecto` no se usa acá; solo tipos).
- Produces:
  ```ts
  // ciclo.entity.ts
  export interface Ciclo { id: string; anio: number; activo: boolean; bloqueado: boolean; inicio: Date | null; fin: Date | null }
  export type TipoDePausa = "receso" | "feriado" | "otro";
  export interface PausaDelCiclo { id: string; cicloId: string; desde: Date; hasta: Date; nombre: string; tipo: TipoDePausa }
  // ciclo.repository.ts (todos con tx?: unknown al final)
  findPausasByCicloId(cicloId: string): Promise<PausaDelCiclo[]>        // ordenadas por desde
  findPausaById(id: string): Promise<PausaDelCiclo | null>
  crearPausa(pausa: PausaDelCiclo): Promise<PausaDelCiclo>
  actualizarPausa(id: string, datos: Partial<Pick<PausaDelCiclo, "desde" | "hasta" | "nombre" | "tipo">>): Promise<PausaDelCiclo>
  eliminarPausa(id: string): Promise<void>
  // configuracion.entity.ts
  export interface Configuracion { id: string; valorCuota: number | null; diaVencimiento: number }
  ```

- [ ] **Step 1: Write the failing script `_ciclo-calendario-datos.ts`** (formato `ok("etiqueta", real, esperado)` de `scripts/_check.ts`, con `try/finally` que borra lo creado y `prisma.$disconnect(); process.exit(0)`), usando `PrismaCicloRepository` real sobre un ciclo `prueba-tmp-cal-ciclo` (año 2095): un ciclo creado sin fechas vuelve con `inicio`/`fin` `null`; `crearPausa` + `findPausasByCicloId` devuelve las pausas ordenadas por `desde`; `actualizarPausa` cambia nombre; `eliminarPausa` la quita; `bloquearParaLectura` devuelve `inicio` y `fin`; borrar un ciclo con pausas falla (RESTRICT); `Configuracion.diaVencimiento` es 10 por defecto. Expected antes de implementar: FALLA (métodos inexistentes).
- [ ] **Step 2: Respaldo y migración.** `mkdir -p ~/respaldos-babylon && docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/antes-calendario-del-ciclo-$(date +%F).dump`. En `schema.prisma`: `Ciclo.inicio DateTime? @db.Date`, `Ciclo.fin DateTime? @db.Date`, `Ciclo.pausas PausaDelCiclo[]`; `enum TipoPausa { receso feriado otro }`; `model PausaDelCiclo { id String @id; cicloId String; ciclo Ciclo @relation(fields:[cicloId], references:[id], onDelete: Restrict); desde DateTime @db.Date; hasta DateTime @db.Date; nombre String; tipo TipoPausa; @@index([cicloId]) }`; `Configuracion.diaVencimiento Int @default(10)`. Generar con `pnpm exec prisma migrate dev --create-only --name calendario_del_ciclo`, **editar el SQL** para agregar `ALTER TABLE "Ciclo" ADD CONSTRAINT "Ciclo_fechas_check" CHECK (("inicio" IS NULL) = ("fin" IS NULL) AND ("inicio" IS NULL OR "inicio" <= "fin"))` y `ALTER TABLE "PausaDelCiclo" ADD CONSTRAINT "PausaDelCiclo_orden_check" CHECK ("desde" <= "hasta")`, aplicar con `pnpm exec prisma migrate dev` y `pnpm prisma:generate`.
- [ ] **Step 3: Implement.** Entidades según Interfaces; `PrismaCicloRepository`: los métodos nuevos, y `bloquearParaLectura` selecciona también `inicio, fin`; `crearCiclo` y `paseDeAnio.service.ts` agregan `inicio: null, fin: null` al literal; `PrismaConfiguracionRepository.obtener` ya devuelve el default de la columna.
- [ ] **Step 4: Verify.** `pnpm exec tsx scripts/_ciclo-calendario-datos.ts | python3 ../pruebas/bin/chequear.py` → "0 mal"; `pnpm typecheck` limpio; `pnpm test` verde.
- [ ] **Step 5: Commit** (`git add -f server/scripts/_ciclo-calendario-datos.ts` + migración + código).

---

### Task 3: Servicio y API de ciclos (fechas y pausas) + guarda del día de clases

**Files:**
- Modify: `ciclo.schema.ts`, `ciclo.service.ts`, `ciclo.controller.ts`, `ciclo.routes.ts`, `ciclo.guarda.ts`, `server/src/container.ts`, `server/scripts/_ciclo-bloqueado.ts`
- Create: `server/scripts/_ciclo-calendario-servicio.ts`

**Interfaces:**
- Consumes: Task 1 (`calendarioDelCiclo` helper se **agrega acá**, ver abajo, `validarFechasDelCiclo`, `validarPausa`, `motivoSinClases`), Task 2 (entidades y repositorio).
- Produces:
  ```ts
  // ciclo.calendario.ts (agregar)
  export function calendarioDelCiclo(ciclo: { anio: number; inicio: Date | null; fin: Date | null }, pausas?: { desde: Date; hasta: Date; nombre: string }[]): CalendarioDelCiclo
  // ciclo.entity.ts (agregar)
  export interface CicloConCalendario extends Omit<Ciclo, "inicio" | "fin"> { inicio: Date; fin: Date; pausas: PausaDelCiclo[] }
  // CicloService
  listarCiclos(): Promise<CicloConCalendario[]>       // inicio/fin resueltos (nunca null)
  editarFechas(id: string, datos: { inicio: string; fin: string }): Promise<CicloConCalendario>
  agregarPausa(cicloId: string, datos: { desde: string; hasta: string; nombre: string; tipo: TipoDePausa }): Promise<PausaDelCiclo>
  editarPausa(cicloId: string, pausaId: string, datos: Partial<{ desde: string; hasta: string; nombre: string; tipo: TipoDePausa }>): Promise<PausaDelCiclo>
  eliminarPausa(cicloId: string, pausaId: string): Promise<void>
  // VerificadorDeCiclo (agregar)
  verificarDiaDeClases(cursoId: string, fecha: string, tx?: unknown): Promise<void>   // ValidationError("Ese día no hay clases: …")
  ```
  Rutas (solo `admin`): `PATCH /api/ciclos/:id/fechas`, `POST /api/ciclos/:id/pausas`, `PATCH /api/ciclos/:id/pausas/:pausaId`, `DELETE /api/ciclos/:id/pausas/:pausaId`.

- [ ] **Step 1: Write the failing script `_ciclo-calendario-servicio.ts`** (servicio real vía `container`, ciclo `prueba-tmp-cal-ciclo-svc` año 2096 con un curso y alumno de `_mundo-avisos`). Afirmaciones: `editarFechas` con inicio>fin rechaza con el mensaje exacto; agregar una pausa fuera del ciclo, con `hasta<desde` o superpuesta rechaza con sus mensajes; una pausa válida se guarda y `listarCiclos` la trae; `editarFechas` que deja una pausa afuera → `La pausa "X" quedaría fuera del ciclo` y no cambia nada; `eliminarPausa` de una pausa de **otro** ciclo → 404; con el ciclo bloqueado (`UPDATE "Ciclo" SET bloqueado=true`) las cuatro operaciones dan 409 con el mensaje de bloqueo; `listarCiclos` de un ciclo sin fechas devuelve `inicio` `2096-03-01` y `fin` `2096-11-30`; cada operación exitosa publica `datos.cambiaron` (`ciclos`, `edicion`) — verificarlo con el patrón de captura de anuncios de `_cambios-publicados.ts`; `verificarDiaDeClases` (guarda real del container) lanza `Ese día no hay clases: Fuera del ciclo lectivo` / `…: <nombre de la pausa>` y no lanza en un día con clases. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** `calendarioDelCiclo` convierte `Date`→`AAAA-MM-DD` (`toISOString().slice(0,10)`; nulls → `calendarioPorDefecto(anio)`). Schemas Zod `.strict()` en `ciclo.schema.ts` con `fechaCalendario(...)` de `core/validacion.ts` para fechas (mensajes en español), `nombre` con `textoRequerido("El nombre", 80)`, `tipo` enum. `CicloService` recibe como último parámetro `verificador: VerificadorDeCiclo = cicloSiempreAbierto()`; cada operación nueva corre en `runInTransaction`: `cicloRepo.bloquear(id, tx)` (FOR UPDATE) → `verificador.verificarCicloAbierto(id, tx)` → leer ciclo y pausas con `tx` → validar con las reglas puras (`ValidationError` con el mensaje devuelto) → escribir → `anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "edicion", ids: { cicloIds: [id] } }, tx)`. `editarPausa`/`eliminarPausa` verifican que la pausa pertenezca al ciclo (`EntityNotFoundError("Pausa", id)` si no). `crearVerificadorDeCiclo` implementa `verificarDiaDeClases` (curso → `cicloRepo.findById` + `findPausasByCicloId` con el mismo `tx` → `motivoSinClases`); `cicloSiempreAbierto()` lo agrega como no-op. `container.ts`: pasar `verificadorDeCiclo` a `CicloService`. Controller y rutas siguiendo el estilo existente (`String(req.params.id)`, `201` en alta, `204` en baja).
- [ ] **Step 3: Clasificar las rutas nuevas** en `server/scripts/_ciclo-bloqueado.ts`: agregar a `RECHAZADAS` las cuatro (cuerpos válidos para el ciclo de la prueba, `bloqueado: [409]`, `desbloqueado: [200]`/`[201]`/`[204]` según corresponda; el `DELETE` necesita una pausa creada de antemano en el contexto).
- [ ] **Step 4: Verify.** Los dos scripts con `| python3 ../pruebas/bin/chequear.py` ("0 mal"; `_ciclo-bloqueado` con `pruebas/bin/api.sh start` primero), `pnpm typecheck`, `pnpm test`.
- [ ] **Step 5: Commit.**

---

### Task 4: Asistencia, avisos y asistente respetan el calendario

**Files:**
- Modify: `server/src/modules/asistencia/asistencia.service.ts`, `server/src/modules/notificaciones/notificacion.criterios.prisma.ts` (`asistenciaPendiente`, `cicloPorCerrar`), `server/src/modules/ciclos/paseDeAnio.service.ts` (`advertenciaAnioEnCurso`), scripts que toman asistencia: `_cambios-publicados`, `_asistencia-justificada`, `_automatizacion-servicio`, `_3d-validacion-http`, `_ciclo-guardas-servicios`, `_ciclo-bloqueado`, `_automatizacion-bloqueos`, `pruebas/recorridos/e2e-ciclos.js`, `pruebas/recorridos/e2e-3c-padre.js`
- Create: `server/scripts/_ciclo-calendario-asistencia.ts`

**Interfaces:**
- Consumes: Task 3 (`verificarDiaDeClases`, `calendarioDelCiclo`, `motivoSinClases`).
- Produces: comportamiento (sin firmas nuevas).

- [ ] **Step 1: Write the failing script `_ciclo-calendario-asistencia.ts`** sobre el mundo de avisos: guardar asistencia (servicio real) en un día fuera del ciclo (`2026-01-20`) → `ValidationError` "Ese día no hay clases: Fuera del ciclo lectivo"; en una pausa agregada con `editarPausa` del servicio → "…: <nombre>"; en un día con clases (`2026-03-20`) → guarda; un **curso de un ciclo viejo** (ciclo 2097 con fechas propias) valida contra **su** calendario aunque el activo sea otro; `asistencia_pendiente` no genera aviso para un día dentro de una pausa pero sí para el mismo día sin pausa; `ciclo_por_cerrar` aparece cuando hoy es posterior al `fin` del ciclo activo (probar con `fin` cargado el día anterior y con `fin` futuro) y no antes. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** `registrarAsistenciaMasiva`: después de `verificarCicloDelCurso`, `await this.verificador.verificarDiaDeClases(datos.cursoId, datos.fecha.toISOString().slice(0, 10), tx)`. `asistenciaPendiente`: cargar el ciclo activo con sus pausas (`ciclo.findFirst({ where: { activo: true }, include: { pausas: true } })`, `[]` si no hay), armar `calendarioDelCiclo(...)` y reemplazar `esMesLectivo(dia.getUTCMonth()+1)` por `motivoSinClases(fecha, calendario) !== null → continue`; quitar el import viejo de `cuota.calendario`. `cicloPorCerrar`: `if (hoyISOEnArgentina(ahora) <= calendarioDelCiclo(ciclo).fin) return []`. `paseDeAnio.service.ts`: `advertenciaAnioEnCurso: hoyISOEnArgentina() <= calendarioDelCiclo(origen).fin`. El texto de `ciclo_por_cerrar` no cambia.
- [ ] **Step 3: Arreglar las pruebas existentes que toman asistencia** (corren contra el calendario real): en las que usan el ciclo activo 2026 reemplazar las fechas fuera del calendario por días de marzo a noviembre no futuros (por ejemplo `2026-01-20` → `2026-03-20`, `2026-01-24` → `2026-03-24`); en las que usan un ciclo de año inventado (2099…), crear ese ciclo con `inicio: new Date("2000-01-01"), fin: new Date("2099-12-31")` para que "hoy" caiga dentro. Los recorridos e2e que guardan asistencia "de hoy" dependen de que hoy esté dentro de marzo–noviembre: anotar en `pruebas/README.md` que fuera de esas fechas esperan un 400 de "no hay clases".
- [ ] **Step 4: Verify.** Correr cada script modificado con `chequear.py` (los de HTTP con `api.sh start`), más `_ciclo-calendario-asistencia`, `_aviso-ciclo-por-cerrar`, `_pase-de-anio`, `_avisos-servicio`; `pnpm typecheck`; `pnpm test`.
- [ ] **Step 5: Commit.**

---

### Task 5: Cuotas — meses lectivos del calendario y día de vencimiento

**Files:**
- Modify: `server/src/modules/configuraciones/{configuracion.entity.ts (ya hecho), configuracion.schema.ts, configuracion.service.ts, configuracion.repository.ts, configuracion.repository.prisma.ts}`, `server/src/modules/cuotas/cuota.service.ts`, `server/src/modules/cuotas/cuota.calendario.ts`
- Create: `server/scripts/_cuota-calendario.ts`

**Interfaces:**
- Consumes: Task 1 (`esMesLectivo(mes, calendario)`, `vencimientoDelMes` con 4 argumentos), Task 2 (`Configuracion.diaVencimiento`, `findPausasByCicloId`).
- Produces:
  ```ts
  // configuracion.schema.ts: { valorCuota?: number; diaVencimiento?: number } .strict(), al menos uno (si no: "No hay nada para guardar"); diaVencimiento entero 1..28 con el mensaje de la tabla
  // ConfiguracionRepository
  actualizarParcial(id: string, cambios: Cambios<Configuracion>, tx?: unknown): Promise<Configuracion>
  ```

- [ ] **Step 1: Write the failing script `_cuota-calendario.ts`** (servicio real, `valorCuota` de prueba que se vuelve a null en el `finally`, ciclo activo con fechas y pausas de prueba restauradas al final): con receso 20–31/7, `generarCuotasDelMes(2026-07-15)` **crea** cuotas de julio; con una pausa que cubre todo agosto no crea cuotas de agosto; en enero y diciembre no crea; con `diaVencimiento` 5 la cuota de abril vence el 5/4 y la creada el día 15 de su propio mes vence a fin de mes; `PATCH` de configuración con `diaVencimiento: 0` y `29` rechaza con el mensaje, con `{}` rechaza con "No hay nada para guardar", y editar solo `diaVencimiento` no pisa `valorCuota`; una cuota ya generada no cambia su vencimiento al cambiar el día. Expected antes de implementar: FALLA.
- [ ] **Step 2: Implement.** `contextoDeGeneracion`: obtener primero el ciclo activo (mantener "año del ciclo = año actual y no bloqueado"), luego `findPausasByCicloId(ciclo.id, tx)`, `esMesLectivo(mes, calendarioDelCiclo(ciclo, pausas))`, y `const { valorCuota, diaVencimiento } = await configuracionRepo.obtener(tx)`; `vencimiento: vencimientoDelMes(mes, anio, hoy, diaVencimiento)`. `ConfiguracionService.actualizar` usa `actualizarParcial` con `soloPresentes` (patrón de `core/cambios.ts`) y publica el mismo `datos.cambiaron`. Eliminar de `cuota.calendario.ts` `MES_INICIO_CICLO`, `MES_FIN_CICLO`, `DIA_VENCIMIENTO`, el `esMesLectivo` viejo y el `10` provisorio del Task 1; buscar usos restantes con `grep -rn "cuota.calendario" server/src server/scripts server/tests` y actualizarlos; actualizar los comentarios de `cuota.service.ts` que dicen "marzo a noviembre" y "día 10".
- [ ] **Step 3: Verify.** `_cuota-calendario`, `_ciclo-calendario-servicio`, y los scripts de cuotas existentes que corra la batería (`grep -l cuota server/scripts/_*.ts` y correr los de generación); `pnpm typecheck`; `pnpm test`. Confirmar `valorCuota` null: `docker exec babylon-postgres psql -U babylon -d babylon -tAc 'select "valorCuota","diaVencimiento" from "Configuracion"'` → `|10`.
- [ ] **Step 4: Commit.**

---

### Task 6: Client — tipos, copia de las reglas y servicios

**Files:**
- Create: `client/src/features/ciclos/calendario.ts`, `server/tests/calendario-ciclo-cliente.test.ts`, `client/src/features/ciclos/hooks/{useEditarFechasDelCiclo,useGuardarPausa,useEliminarPausa}.ts`
- Modify: `client/src/features/ciclos/types.ts`, `cicloService.ts`, `client/src/features/configuracion/{types.ts,configuracionService.ts,hooks/useActualizarConfiguracion.ts}`, `client/src/features/cambios/mensajes.ts`

**Interfaces:**
- Consumes: la API del Task 3 y Task 5 (JSON: fechas `"AAAA-MM-DDT00:00:00.000Z"`).
- Produces:
  ```ts
  // calendario.ts: mismas funciones y nombres que ciclo.calendario.ts del server (días AAAA-MM-DD), más:
  export function calendarioDelCiclo(ciclo: Ciclo): CalendarioDelCiclo   // slice(0,10) de inicio, fin y de cada pausa
  // types.ts
  export type TipoDePausa = "receso" | "feriado" | "otro";
  export interface PausaDelCiclo { id: string; cicloId: string; desde: string; hasta: string; nombre: string; tipo: TipoDePausa }
  export interface Ciclo { id; anio; activo; bloqueado; inicio: string; fin: string; pausas: PausaDelCiclo[] }
  // cicloService: editarFechas(id, {inicio, fin}), guardarPausa, eliminarPausa; configuracion: actualizar(datos: { valorCuota?: number; diaVencimiento?: number })
  ```

- [ ] **Step 1: Write the failing test `calendario-ciclo-cliente.test.ts`** que importa `../../client/src/features/ciclos/calendario` y corre `CASOS_MOTIVO` y `CASOS_MES` de `casos-calendario.ts` contra la copia del client **y** contra la del server (mismo patrón que `historial-cursos-cliente.test.ts`), más `validarFechasDelCiclo`/`validarPausa` con los mismos mensajes. Expected: FALLA (no existe el módulo).
- [ ] **Step 2: Implement** `calendario.ts` (copia literal de las reglas puras, sin imports con alias), los tipos, los métodos del servicio, los tres hooks (invalidan `["ciclos"]`; `useGuardarPausa` recibe `{ cicloId, pausaId?, datos }`) y `useActualizarConfiguracion` con el nuevo parámetro; en `mensajes.ts` agregar el mensaje de `ciclos/edicion` siguiendo el estilo de las entradas existentes ("cambió las fechas o pausas de un ciclo"). Actualizar los usos de `configuracionService.actualizar(valorCuota)` a `actualizar({ valorCuota })`.
- [ ] **Step 3: Verify.** `cd server && pnpm test` (verde), `cd ../client && pnpm typecheck && pnpm lint` (los errores de `ConfiguracionPage` por el cambio de firma se arreglan en el Task 7: aceptar solo esos).
- [ ] **Step 4: Commit.**

---

### Task 7: Client — pantallas

**Files:**
- Create: `client/src/features/ciclos/components/PanelCalendarioDeCiclos.tsx`, `client/src/features/ciclos/components/ModalDePausa.tsx`
- Modify: `client/src/features/dashboard/pages/ConfiguracionPage.tsx`, `client/src/features/asistencia/pages/AsistenciaProfesorPage.tsx`

**Interfaces:**
- Consumes: Task 6 (hooks, tipos, `calendario.ts`), `Panel`, `Modal` (con `sinGuardar`), `Input`, `Select`, `Button` de `core/components/ui/`, `useSinGuardar`, `useFormularioAlDia`.
- Produces: componentes; sin firmas para otros tasks.

- [ ] **Step 1: `PanelCalendarioDeCiclos`** (`<Panel title="Inicio y fin de cada ciclo lectivo">`, se agrega en `ConfiguracionPage` después del panel "Ciclos lectivos"): una tarjeta por ciclo (más nuevo primero) con `Input type="date"` de inicio y fin, botón "Guardar fechas" (deshabilitado sin cambios), lista de pausas (nombre, rango `dd/mm` o fecha única, tipo, lápiz y papelera con confirmación en `Modal`) y "Agregar pausa"; un ciclo bloqueado se muestra en solo lectura con el badge "Bloqueado". Errores del servidor con `ApiError.message` debajo del control; texto de ayuda "Sin clases en estas fechas: no se toma asistencia. Las cuotas se generan en los meses que tienen clases." `ModalDePausa`: nombre, tipo (Receso de invierno / Feriado / Otro), desde y hasta (para "Feriado" se oculta "hasta" y vale igual que "desde"); valida en pantalla con `validarPausa` de `calendario.ts` antes de enviar. Usar `useSinGuardar` en las fechas y `sinGuardar` en el modal.
- [ ] **Step 2: "Cuota mensual"** en `ConfiguracionPage`: segundo campo numérico "Día de vencimiento" (min 1, max 28) junto al monto, incluido en `useFormularioAlDia` (`servidor`, `etiquetas: "el día de vencimiento"`, `valores`, `aplicar`) y en `useSinGuardar`; "Guardar" envía solo lo modificado (`cambiosParaEnviar`) y se deshabilita sin cambios o con valores inválidos; actualizar el texto de ayuda (quitar "de marzo a noviembre" y "vence el día 10": "…genera solo la cuota de cada mes con clases del ciclo activo; vence el día {diaVencimiento}…").
- [ ] **Step 3: Asistencia del profesor:** con `useCiclos()` y el `cicloId` del curso elegido, calcular `motivoSinClases(fecha, calendarioDelCiclo(ciclo))`; si no es `null`, mostrar bajo el encabezado un aviso "Ese día no hay clases: {motivo}" y agregar `|| sinClases` a la condición `disabled` del botón de guardar (línea ~430).
- [ ] **Step 4: Verify.** `pnpm typecheck && pnpm lint && pnpm build` en el client. Verificación visual con `pruebas/bin/api.sh start && pruebas/bin/client.sh start` y una captura Playwright de Configuración (apartado nuevo, campo de vencimiento) y de Asistencia en un día fuera del ciclo; deshacer lo cargado (el ciclo real 2026 debe quedar sin fechas ni pausas propias: `inicio`/`fin` null) y `valorCuota` null.
- [ ] **Step 5: Commit.**

---

### Task 8: Recorrido de navegador, batería y documentación

**Files:**
- Create: `pruebas/recorridos/e2e-calendario-ciclo.js`
- Modify: `pruebas/bin/bateria.sh`, `pruebas/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: batería actualizada.

- [ ] **Step 1: Recorrido `e2e-calendario-ciclo.js`** (mismo estilo y utilidades que `e2e-automatizaciones.js`, salida `etiqueta: real (esperado X)`): el administrador entra a Configuración, abre el apartado, carga un feriado y un receso en un ciclo de prueba (`prueba-tmp-…`, nunca el real), ve el error de superposición, edita y borra una pausa, cambia el día de vencimiento y recarga viendo el valor guardado; el profesor elige una fecha dentro de la pausa y ve el aviso con el botón de guardar deshabilitado. Limpia todo lo creado.
- [ ] **Step 2: Batería.** En `bateria.sh` agregar a la lista de scripts de servidor `_ciclo-calendario-datos _ciclo-calendario-servicio _ciclo-calendario-asistencia _cuota-calendario`; `e2e-*.js` se recoge solo por el comodín.
- [ ] **Step 3: Documentación.** `CLAUDE.md`: reemplazar en "Cuotas: generación automática…" las frases "marzo a noviembre" y "día 10" por la regla del calendario y `diaVencimiento`; agregar una sección "Calendario del ciclo (inicio, fin y pausas)" (modelo con `inicio`/`fin` null = por defecto, `PausaDelCiclo`, regla del mes lectivo, `verificarDiaDeClases`, rutas, ciclos bloqueados, que cambiar el calendario no toca cuotas ni asistencia ya guardadas, y la limitación "las pruebas que toman asistencia de hoy necesitan que hoy esté dentro del calendario"); actualizar `ciclo_por_cerrar` ("desde el día siguiente al fin del ciclo activo") y la tabla de la API con las cuatro rutas y `PATCH /api/configuracion` con `diaVencimiento`. `pruebas/README.md`: los scripts y el recorrido nuevos.
- [ ] **Step 4: Verify con la batería completa.** `bash pruebas/bin/bateria.sh > pruebas/bin/bateria.log 2>&1`; leer el log: todos los bloques "0 mal", unit tests sin fallas, y la línea final `BASE:` con `valorCuota` en `null` (`…/null/activo`). Si falla un bloque, corregir la causa (no la expectativa) y repetir.
- [ ] **Step 5: Commit.**
