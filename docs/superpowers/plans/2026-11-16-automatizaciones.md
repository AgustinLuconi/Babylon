# Automatizaciones (alertas por deuda e inasistencias) — plan de implementación

> **Para quien ejecute:** usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans. Los pasos usan casillas (`- [ ]`).

**Objetivo:** dos reglas automáticas (alumno con dos cuotas vencidas o más; alumno con tres inasistencias sin justificar seguidas) con alertas en la campana del equipo del instituto, un panel "Automatizaciones" en Configuración (interruptor, número, alumnos en alerta, historial) y una casilla "Justificada" en la asistencia.

**Arquitectura:** un módulo propio `modules/automatizaciones/` con un catálogo de reglas en código, su configuración (`Automatizacion`) y un registro permanente de alertas (`AlertaAutomatica`, la fuente de verdad de qué alertas están abiertas). Una regla se revisa **entera** con un bloqueo por regla, dentro de la transacción del cambio que la afecta (por anuncios), al cambiar su número o interruptor, y a las 03:00. El módulo publica `alertas.cambiaron`; `notificaciones/` se suscribe y sincroniza tipos de aviso de estado nuevos que leen las alertas abiertas. Los módulos de cuotas, asistencia y alumnos no conocen a automatizaciones.

**Tecnologías:** Express 5, Prisma 6, PostgreSQL 18, zod, `tsx --test`; client React 19 + TanStack Query + Tailwind 4. Server y client no comparten código.

**Spec:** `docs/superpowers/specs/2026-11-16-automatizaciones-design.md` (leerla primero: manda ante cualquier duda).

## Restricciones globales

- Feature-first: lógica nueva en `modules/automatizaciones/` (entity, schema, repository + prisma, service, controller, routes, eventos); `core/` no recibe lógica de negocio. Nunca carpetas `domain/`, `data/`, `presentation/`.
- Services reciben dependencias por constructor; `container.ts` es el único lugar que instancia repositorios y services. Todo cambio con `tx` pasado a cada llamada al repositorio dentro de `runInTransaction`; anuncios (`anuncios.publicar`) dentro de la transacción y con `tx`.
- Errores solo de `core/errors.ts`. Toda hora o "hoy" con `core/fechas.ts`; en el client, `hoyLocalISO()`.
- Los módulos `cuotas`, `asistencia` y `alumnos` **no importan** nada de `automatizaciones`: se enteran por anuncios. `notificaciones` solo conoce los ids de regla como texto.
- Migraciones con respaldo previo: `docker exec babylon-postgres pg_dump -U babylon -Fc babylon > ~/respaldos-babylon/<nombre>.dump`. Migraciones de este plan: `Asistencia.justificada`; tablas `Automatizacion` y `AlertaAutomatica` (+ índice único parcial hecho a mano en el SQL); tres valores nuevos de `TipoNotificacion`.
- Pruebas con datos `prueba-tmp-av` (`server/scripts/_mundo-avisos.ts`); **nunca tocar datos reales, ni dejar `Configuracion.valorCuota` distinto de null, ni cambiar los ciclos reales**; los scripts nuevos se versionan con `git add -f`. La batería completa en verde antes de fusionar.
- Rama de trabajo: `automatizaciones`. Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. **Nada de fusionar ni subir sin pedido explícito del usuario.**
- Comandos: server `cd server && pnpm typecheck && pnpm test`; scripts `cd server && pnpm exec tsx scripts/_x.ts | python3 ../pruebas/bin/chequear.py` (esperado `N bien, 0 mal`; los "HTTP" piden `bash pruebas/bin/api.sh start` antes y `stop` después); client `cd client && pnpm typecheck && pnpm lint && pnpm build`. Node con `source ~/.nvm/nvm.sh && nvm use`.

## Foco de la revisión

Casos que el spec implica y que ninguna tarea cubriría sin pedirlo; cada uno tiene su prueba en la tarea indicada:

1. Revisar dos veces la misma situación no duplica alertas ni avisos, y un aviso leído no vuelve a "no leído" salvo que el nivel suba (Tareas 4 y 5).
2. Una ausencia justificada corta la racha, y la racha es por (alumno, curso) (Tarea 2).
3. Apagar una regla cierra sus alertas abiertas y volver a prenderla abre filas **nuevas** (Tarea 4).
4. Activar otro ciclo (pase de año) cierra con `ya-no-corresponde` las alertas que quedan fuera (Tarea 4).
5. Reasignar el profesor de un curso con la alerta abierta pasa el aviso al profesor nuevo y lo saca del anterior (Tarea 5).
6. Dos revisiones simultáneas de la misma regla no dejan dos alertas abiertas iguales (índice único parcial, Tarea 4).

## Estructura de archivos

Server (`server/src/modules/automatizaciones/`): `automatizacion.entity.ts` (tipos y catálogo `REGLAS`), `automatizacion.racha.ts` y `automatizacion.reconciliar.ts` (puras), `automatizacion.repository.ts` y `.prisma.ts`, `automatizacion.evaluadores.prisma.ts` (las consultas de cada regla), `automatizacion.service.ts`, `automatizacion.eventos.ts`, `automatizacion.suscripciones.ts`, `automatizacion.scheduler.ts`, `automatizacion.schema.ts`, `automatizacion.controller.ts`, `automatizacion.routes.ts`. Modificados: `asistencia/*`, `notificaciones/{entity,tipos,criterios.prisma,suscripciones}`, `cambios/*`, `eventos.ts`, `container.ts`, `server.ts`, `prisma/schema.prisma`.
Client: `features/asistencia/*` (casilla, calendario, etiquetas), `features/automatizaciones/` (types, service, hooks, `components/{PanelAutomatizaciones,TarjetaDeRegla,HistorialDeAlertas}.tsx`), `features/dashboard/pages/ConfiguracionPage.tsx`, `features/notificaciones/types.ts`, `features/cambios/*`.

---

### Task 1: Asistencia — casilla "Justificada" en el servidor

**Archivos:** modificar `server/prisma/schema.prisma` (`Asistencia.justificada Boolean @default(false)`) y crear la migración `…_asistencia_justificada` (respaldo antes); modificar `asistencia.entity.ts`, `asistencia.schema.ts`, `asistencia.service.ts`, `asistencia.repository.prisma.ts` (`aEntidad`); crear `server/scripts/_asistencia-justificada.ts`.

**Interfaces:** produce `Asistencia.justificada: boolean`; `registrarAsistenciaMasivaSchema` acepta por registro `justificada?: boolean`.

- [ ] **Paso 1: escribir `_asistencia-justificada.ts`** (mundo de prueba; `container.asistenciaService` + HTTP con la cuenta del profesor). Comprobaciones: guardar `ausente` con `justificada: true` y motivo → queda guardado `justificada=true`; `justificada: true` sin motivo, o solo con espacios → 400; `justificada: true` con estado `presente` o `tarde` → 400; `ausente` sin `justificada` → `false`; volver a guardar la misma fecha cambiando a `presente` deja `justificada=false` (se actualiza, no se duplica); los registros viejos (creados por Prisma sin el campo) leen `justificada=false`.
- [ ] **Paso 2: correrlo y ver que falla** (el campo no existe).
- [ ] **Paso 3: migración y código.** `justificada` en la entidad y en `aEntidad`; en el esquema de cada registro, `.superRefine`: si `justificada` es `true`, el estado debe ser `ausente` y el `motivo` (ya recortado por `textoOpcional`) no puede estar vacío (mensajes claros por campo); en `registrarAsistenciaMasiva`, tanto al crear como al actualizar, guardar `justificada: registro.estado === "ausente" && registro.justificada === true`.
- [ ] **Paso 4: correr** el script (`N bien, 0 mal`), `pnpm typecheck`, `pnpm test`. **Commit** `Asistencia: casilla justificada (servidor)` (con `git add -f` del script).

### Task 2: Asistencia — casilla en la pantalla, calendario y etiquetas

**Archivos:** modificar `client/src/features/asistencia/types.ts`, `asistenciaService.ts`, `pages/AsistenciaProfesorPage.tsx`, `components/AttendanceCalendar.tsx`; `ParentDashboardPage.tsx` y `AlumnoDetailPage.tsx` si muestran el estado como texto (`grep ESTADO_ASISTENCIA_LABELS`); crear `server/tests/asistencia-justificada-cliente.test.ts`.

**Interfaces:** produce en `features/asistencia/types.ts` `Asistencia.justificada: boolean`, `RegistroDeAsistencia.justificada?: boolean` y `etiquetaDeAsistencia(r: { estado: EstadoAsistencia; justificada: boolean }): string` (pura; `"Ausente (justificada)"` solo si estado es `ausente` y `justificada`; si no, la etiqueta de siempre).

- [ ] **Paso 1: escribir la prueba pura** `asistencia-justificada-cliente.test.ts` (importa por ruta relativa): `etiquetaDeAsistencia` para ausente justificada, ausente sin justificar, presente y tarde.
- [ ] **Paso 2: correr y ver que falla.**
- [ ] **Paso 3: implementar** `etiquetaDeAsistencia`; en `AsistenciaProfesorPage` un estado `justificadas: Record<string, boolean>` con `justificadaEfectiva(alumnoId)` (lo tocado, o lo guardado, o `false`), la casilla "Justificada" dentro del bloque de "Ausente" (donde hoy aparece el motivo), el motivo **obligatorio** con la casilla tildada (mensaje en el campo y botón de guardar deshabilitado), la casilla incluida en la detección de cambios sin guardar y en el envío (`justificada` solo si el estado es ausente); en `AttendanceCalendar`, el día de una ausencia justificada se ve distinto (inicial `J`, color atenuado) con `title="Ausente (justificada)"`, y la leyenda lo explica; los textos de estado del legajo y del panel de la familia usan `etiquetaDeAsistencia`.
- [ ] **Paso 4: verificar** `pnpm test` (server), `cd client && pnpm typecheck && pnpm lint && pnpm build`; **commit** `Asistencia: casilla justificada en la pantalla y el calendario`.

### Task 3: Lógica pura — racha de inasistencias, reconciliación de alertas y textos

**Archivos:** crear `automatizacion.racha.ts`, `automatizacion.reconciliar.ts`, `notificaciones/notificacion.alertas.ts` (textos) y los tests `server/tests/racha-inasistencias.test.ts`, `alertas-reconciliar.test.ts`, `alertas-textos.test.ts`.

**Interfaces — produce:**
```ts
// automatizacion.racha.ts
export function rachaDeInasistencias(registros: { fecha: Date; estado: "presente" | "tarde" | "ausente"; justificada: boolean }[]): number; // desde el registro más nuevo, cuántos seguidos son ausente y no justificada (ordena por fecha desc internamente)
// automatizacion.reconciliar.ts
export type ReglaId = "deuda_cuotas" | "inasistencias_seguidas";
export type MotivoCierre = "resuelta" | "regla-apagada" | "cambio-de-numero" | "ya-no-corresponde";
export interface AlertaEsperada { alumnoId: string; cursoId: string | null; nivel: number }
export interface AlertaAbierta { id: string; alumnoId: string; cursoId: string | null; nivel: number }
export const claveDeAlerta = (a: { alumnoId: string; cursoId: string | null }) => string; // `${alumnoId}|${cursoId ?? ""}`
export function reconciliarAlertas(i: { abiertas: AlertaAbierta[]; esperadas: AlertaEsperada[]; poblacion: Set<string>; causa: "revision" | "regla-apagada" | "cambio-de-numero"; nuevoId: () => string }): {
  abrir: (AlertaEsperada & { id: string })[]; actualizar: { id: string; nivel: number }[]; cerrar: { id: string; motivo: MotivoCierre }[];
};
// notificacion.alertas.ts
export function textoDeAlertaDeDeuda(alumno: string, cuotas: number): string;       // "{alumno} debe {n} cuotas vencidas"
export function textoDeAlertaDeFaltas(alumno: string, faltas: number, curso: string): string; // "{alumno} tiene {n} inasistencias seguidas en {curso}"
```
Reglas de `reconciliarAlertas`: lo esperado que no está abierto se abre; lo abierto y esperado se actualiza solo si cambió el nivel; lo abierto y no esperado se cierra con motivo `regla-apagada` o `cambio-de-numero` si la causa es esa, y si la causa es `revision`, `resuelta` cuando su clave está en `poblacion` y `ya-no-corresponde` cuando no.

- [ ] **Paso 1: escribir los tests** con las tablas: racha (tres ausentes sin justificar → 3; ausente, justificada, ausente, ausente → 1 contando desde el más nuevo; presente en el medio corta; `tarde` corta; sin registros → 0; entran desordenados); reconciliar (abre, actualiza solo con nivel distinto, no toca lo igual, los cuatro motivos, clave distinta por curso para el mismo alumno, un esperado ya abierto no se duplica); textos (singular "1 cuota vencida" / "1 inasistencia seguida", plural, nombres con tildes).
- [ ] **Paso 2: `pnpm test` y ver que fallan** (módulos inexistentes).
- [ ] **Paso 3: implementar** las tres piezas puras (sin Prisma ni Express).
- [ ] **Paso 4: `pnpm test`** en verde; **commit** `Automatizaciones: lógica pura (racha, reconciliación de alertas, textos)`.

### Task 4: El módulo — datos, reglas y revisión (alertas funcionando de punta a punta)

**Archivos:** modificar `schema.prisma` (modelos `Automatizacion`, `AlertaAutomatica`) y crear la migración `…_automatizaciones` (respaldo antes; `prisma migrate dev --create-only`, **agregar a mano** al SQL `CREATE UNIQUE INDEX "AlertaAutomatica_abierta_key" ON "AlertaAutomatica" ("regla", "alumnoId", COALESCE("cursoId", '')) WHERE "resueltaEn" IS NULL;`); crear `automatizacion.entity.ts`, `.repository.ts`, `.repository.prisma.ts`, `.evaluadores.prisma.ts`, `.service.ts`, `.eventos.ts`, `.suscripciones.ts`, `.scheduler.ts`; modificar `src/eventos.ts`, `container.ts`, `server.ts`, `server/scripts/_mundo-avisos.ts` (`limpiarMundo` borra `AlertaAutomatica` de los alumnos y cursos de prueba antes de borrarlos) y `pruebas/bin/bateria.sh`; crear `_automatizacion-reglas.ts` y `_automatizacion-servicio.ts`.

**Interfaces:**
- `automatizacion.entity.ts`: reexporta `ReglaId` y `MotivoCierre`; `ConfigDeRegla { regla; activa; umbral; ultimaRevisionEn: Date | null }`; `AlertaAutomatica { id; regla; alumnoId; cursoId: string | null; nivel; abiertaEn: Date; resueltaEn: Date | null; motivoCierre: MotivoCierre | null }`; el catálogo `REGLAS: Record<ReglaId, { id; nombre; descripcion; umbralPorDefecto; umbralMinimo; umbralMaximo; unidad }>` con deuda (por defecto 2, rango 1–12, "cuotas vencidas") e inasistencias (por defecto 3, rango 2–10, "inasistencias seguidas").
- `AutomatizacionRepository`: `obtenerConfig(regla, tx?)` (la crea con los valores por defecto del catálogo si no existe, como `Configuracion.obtener`), `actualizarConfig(regla, cambios: Partial<Pick<ConfigDeRegla, "activa" | "umbral" | "ultimaRevisionEn">>, tx?)`, `bloquearRegla(regla, tx?)` (`pg_advisory_xact_lock(hashtextextended('automatizacion:<regla>', 0))`), `findAbiertas(regla, tx?)`, `contarAbiertas(regla, tx?)`, `crearAlertas(alertas, tx?)`, `actualizarNivel(id, nivel, tx?)`, `cerrarAlertas(cierres: { id: string; motivo: MotivoCierre }[], ahora: Date, tx?)`.
- `EvaluadorDeRegla { evaluar(umbral: number, tx?: unknown): Promise<{ esperadas: AlertaEsperada[]; poblacion: Set<string> }> }` y `PrismaEvaluadoresDeReglas` con uno por regla. **Deuda:** alumnos `activo` con `Inscripcion` en el ciclo activo, con al menos `umbral` cuotas `vencida` → `nivel` = cantidad, `cursoId: null`; `poblacion` = todos esos alumnos. **Inasistencias:** pares (alumno `activo`, curso de su inscripción del ciclo activo); por cada par, `rachaDeInasistencias` de sus registros de ese curso; alerta si la racha ≥ `umbral` (`nivel` = racha); `poblacion` = todos los pares.
- `AutomatizacionService` (constructor: `repo`, `evaluadores`, `unitOfWork`, `anuncios: Publicador<EventosAutomatizaciones & EventosCambios> = sinAnuncios()`): `evaluar(reglas: ReglaId[], tx: unknown, causa: "revision" | "regla-apagada" | "cambio-de-numero" = "revision", ahora = new Date()): Promise<void>` — por cada regla: bloquea, lee la configuración, si está apagada espera `[]` con causa `regla-apagada`, si no evalúa; reconcilia con las abiertas, persiste, guarda `ultimaRevisionEn` y, si hubo cambios, publica `alertas.cambiaron { reglaIds }` y `datos.cambiaron { dato: "automatizaciones", accion: "estado" }` (ambos con `tx`); `evaluarTodas(ahora?)` (una transacción por regla, para el scheduler).
- `automatizacion.eventos.ts`: `EventosAutomatizaciones { "alertas.cambiaron": { reglaIds: ReglaId[] } }`, sumado a `EventosDelSistema`; `TipoDato` suma `"automatizaciones"` en `cambios/cambio.entity.ts` (server y client) y en `cambio.destinatarios.prisma.ts` solo recibe `admin` (como `usuarios`).
- Suscripciones (`suscribirAutomatizaciones(tablero, servicio)`, dentro de la transacción): `cuotas.cambiaron` → `["deuda_cuotas"]`; `asistencia.registrada` → `["inasistencias_seguidas"]`; `alumnos.cambiaron` y `ciclo.activado` → las dos. `iniciarAutomatizaciones(servicio)` en `automatizacion.scheduler.ts` (`programarTareaDiaria("automatizaciones", () => servicio.evaluarTodas())`), arrancado desde `server.ts`.
- `container.ts` expone `automatizacionService`.

- [ ] **Paso 1: escribir `_automatizacion-reglas.ts`** (evaluadores contra la base con el mundo de prueba): deuda con 1, 2 y 3 cuotas vencidas (las pendientes y pagadas no cuentan; alumno inactivo o sin inscripción en el ciclo activo no entra; `umbral` distinto cambia el resultado); inasistencias con racha de 2, 3 y 4 (justificada y presente cortan; curso de otro ciclo o de otra inscripción no cuenta; menos registros que el número no alerta).
- [ ] **Paso 2: escribir `_automatizacion-servicio.ts`** (servicio real, `container.automatizacionService` y SQL de verificación): una revisión abre las alertas esperadas con `abiertaEn`; **revisar dos veces no duplica nada** (Foco 1); subir el nivel actualiza la misma fila; resolver cierra con `resuelta`; apagar la regla cierra todo con `regla-apagada` y volver a prenderla abre filas **nuevas** (Foco 3); cambiar el número cierra con `cambio-de-numero`; dar de baja al alumno o `ciclo.activado` de otro ciclo cierra con `ya-no-corresponde` (Foco 4, forzar el cambio de ciclo con SQL y restaurar el activo real al terminar); **dos `evaluar` en paralelo** de la misma regla terminan con una sola alerta abierta (Foco 6); disparar los anuncios reales (`cuotas.cambiaron`, `asistencia.registrada`) por la API revisa la regla; publica `datos.cambiaron` de `automatizaciones`.
- [ ] **Paso 3: correr los dos y ver que fallan.**
- [ ] **Paso 4: migración y código.** Respaldo, `prisma migrate dev --create-only --name automatizaciones`, editar el SQL con el índice parcial, aplicar y `prisma:generate`; implementar entidad, repositorio, evaluadores, servicio, eventos, suscripciones y scheduler; cablear en `container.ts` (después de `suscribirAvisos`) y `server.ts`; actualizar `limpiarMundo`.
- [ ] **Paso 5: correr** los dos scripts (`N bien, 0 mal`), `pnpm typecheck`, `pnpm test`; agregarlos a `bateria.sh` (lista sin HTTP). **Commit** `Automatizaciones: módulo con reglas, alertas y revisión`.

### Task 5: Los avisos de la campana

**Archivos:** modificar `schema.prisma` (tres valores de `TipoNotificacion`: `alumno_con_deuda`, `alumno_con_faltas`, `alumno_con_faltas_profesor`) y crear la migración `…_avisos_automatizaciones` (respaldo antes); `notificaciones/notificacion.entity.ts` (`TipoEstado`), `notificacion.tipos.ts` (`TIPOS`), `notificacion.criterios.prisma.ts`, `notificacion.suscripciones.ts`; `client/src/features/notificaciones/types.ts`; `server/scripts/_mundo-avisos.ts` (limpieza de avisos huérfanos); `_suscripciones.ts` y los scripts que cuentan tipos por rol; crear `server/scripts/_automatizacion-avisos.ts`.

**Interfaces:** produce los tipos de estado `alumno_con_deuda` (grupo `staff`, etiqueta "Alumnos con deuda"), `alumno_con_faltas` (grupo `staff`, "Alumnos con inasistencias seguidas") y `alumno_con_faltas_profesor` (grupo `profesor`, "Alumnos con inasistencias seguidas en mis cursos"); los criterios leen las `AlertaAutomatica` abiertas (lectura cruzada sobre Prisma, como los demás criterios) y arman: clave `alerta:{regla}:{alumnoId}[:{cursoId}]`, `nivel` = el de la alerta, deuda tono `danger` y faltas tono `warning`, textos de `notificacion.alertas.ts`; recurso `{ tipo: "alumno", alumnoId }` para administración y secretaría y `{ tipo: "asistencia", cursoId, fecha }` (fecha de la última ausencia del par, AAAA-MM-DD) para el profesor; el profesor destinatario es el **actual** del curso (cuenta activa).

- [ ] **Paso 1: escribir `_automatizacion-avisos.ts`** (mundo de prueba, criterios y `NotificacionService` reales; alertas abiertas creadas con el servicio de la Tarea 4): deuda llega a administración y secretaría y no a profesor ni familia; faltas llega a administración, secretaría y al **profesor del curso** (con su recurso hacia asistencia) y no a otro profesor; texto y nivel correctos; **sincronizar dos veces no duplica ni cambia un aviso leído**, y si el nivel sube vuelve a "no leído" (Foco 1); al resolver la alerta el aviso se resuelve; **reasignar el profesor del curso** (SQL + `cursos.cambiaron`) mueve el aviso al profesor nuevo y lo saca del anterior (Foco 5); las preferencias de cada rol listan sus tipos nuevos y apagar uno no genera avisos para esa cuenta; la limpieza deja 0 avisos huérfanos.
- [ ] **Paso 2: correrlo y ver que falla.**
- [ ] **Paso 3: migración y código.** Respaldo y migración del enum; entidad y catálogo; criterios (tres casos nuevos en `esperados`); suscripciones: `alertas.cambiaron` → sincronizar los tipos de cada regla (`deuda_cuotas` → `alumno_con_deuda`; `inasistencias_seguidas` → `alumno_con_faltas` y `alumno_con_faltas_profesor`) y `cursos.cambiaron` suma `alumno_con_faltas_profesor`; tipos del client; `limpiarMundo` borra también los avisos de estos tipos cuyo alumno ya no existe (`split_part(clave, ':', 3) NOT IN (SELECT id FROM "Alumno")`, como ya hace con los de descuento); ajustar las expectativas de `_suscripciones` y de los scripts que cuentan tipos por rol.
- [ ] **Paso 4: correr** el script nuevo, `_suscripciones`, `_avisos-servicio`, `_criterios`, `_preferencia-bloqueo`, `pnpm typecheck`, `pnpm test`; agregarlo a `bateria.sh`. **Commit** `Automatizaciones: avisos de la campana`.

### Task 6: API del panel (listar, cambiar, historial)

**Archivos:** crear `automatizacion.schema.ts`, `automatizacion.controller.ts`, `automatizacion.routes.ts`; modificar `automatizacion.service.ts`, el repositorio (`historial`), `container.ts`, `server.ts`, `server/scripts/_ciclo-bloqueado.ts` (agregar `"/api/automatizaciones"` a `MODULOS_SIN_CICLO`) y `bateria.sh`; crear `server/scripts/_automatizacion-http.ts`.

**Interfaces — produce:** `AutomatizacionService.listar(): Promise<ReglaConEstado[]>` con `ReglaConEstado { id; nombre; descripcion; unidad; umbralMinimo; umbralMaximo; activa; umbral; enAlerta: number; ultimaRevisionEn: Date | null }`; `actualizar(regla: ReglaId, cambios: { activa?: boolean; umbral?: number }): Promise<ReglaConEstado>` (en una transacción: valida el rango, guarda, y revisa con causa `regla-apagada` si se apaga, `cambio-de-numero` si cambia el número, `revision` si se enciende; publica `datos.cambiaron` de `automatizaciones`); `historial(regla: ReglaId, pagina: number): Promise<{ alertas: AlertaDelHistorial[]; total: number; porPagina: number }>` con `AlertaDelHistorial { id; alumnoId; alumnoNombre; cursoNombre: string | null; nivel; abiertaEn; resueltaEn: Date | null; motivoCierre: MotivoCierre | null }` (más nuevas primero, 20 por página). Rutas, todas solo `admin`: `GET /api/automatizaciones`, `PATCH /api/automatizaciones/:regla` (`{ activa?, umbral? }`, `.strict()`, al menos un campo), `GET /api/automatizaciones/:regla/alertas?pagina=`. Regla desconocida → 404; umbral fuera de rango o no entero → 400.

- [ ] **Paso 1: escribir `_automatizacion-http.ts`** (API con las cuentas del mundo): administración lista las dos reglas con sus valores por defecto; secretaría, profesor y familia reciben 403 en las tres rutas; apagar una regla con alertas abiertas deja `enAlerta` en 0 y el historial muestra esas alertas cerradas con `regla-apagada`; prenderla de nuevo vuelve a abrir; cambiar el número de 2 a 3 con alumnos de 2 cuotas cierra con `cambio-de-numero`; umbral fuera de rango (`0`, `13`, `1.5`, texto) → 400; regla inexistente → 404; cuerpo vacío o campo desconocido → 400; el historial pagina y trae nombre del alumno y del curso.
- [ ] **Paso 2: correrlo y ver que falla.**
- [ ] **Paso 3: implementar** servicio, esquema, controller y rutas; cablear.
- [ ] **Paso 4: correr** el script (`N bien, 0 mal`), la barrida `_ciclo-bloqueado` (debe seguir en verde: las rutas nuevas están clasificadas), `pnpm typecheck`, `pnpm test`; agregarlo a `bateria.sh` (lista HTTP). **Commit** `Automatizaciones: API del panel`.

### Task 7: Pantalla — panel "Automatizaciones" en Configuración

**Archivos:** crear `client/src/features/automatizaciones/{types.ts,automatizacionService.ts}`, `hooks/{useAutomatizaciones,useActualizarAutomatizacion,useAlertasDeRegla}.ts`, `components/{PanelAutomatizaciones,TarjetaDeRegla,HistorialDeAlertas}.tsx`; modificar `features/dashboard/pages/ConfiguracionPage.tsx` y `features/cambios/{types,claves,mensajes}.ts`.

**Interfaces:** consume la API de la Tarea 6 (copiar sus tipos a `types.ts` con los mismos nombres: `ReglaConEstado`, `AlertaDelHistorial`, `MotivoCierre`); `claves.ts` suma `automatizaciones: [["automatizaciones"]]` (el panel se actualiza solo con los cambios en vivo) y `mensajes.ts` no necesita texto para ese dato.

- [ ] **Paso 1: implementar** `PanelAutomatizaciones` como un `Panel title="Automatizaciones"` dentro de Configuración con una `TarjetaDeRegla` por regla: nombre y descripción, interruptor (`Interruptor` existente), campo numérico con su rango y la unidad, botón "Guardar" deshabilitado sin cambios y con el error del servidor si lo hay (`useSinGuardar` con lo escrito sin guardar), "N alumnos en alerta ahora", "Última revisión: …" (o "Todavía no se revisó"), y "Ver historial" que despliega `HistorialDeAlertas`: tabla paginada (alumno con enlace a `/alumnos/:id`, curso, nivel, abierta, resuelta, motivo en palabras: "Resuelta", "Regla apagada", "Cambio de número", "Ya no corresponde") y estado vacío "Todavía no hubo alertas".
- [ ] **Paso 2: verificar** `cd client && pnpm typecheck && pnpm lint && pnpm build`; **commit** `Automatizaciones: panel en Configuración`.

### Task 8: Recorrido de navegador, documentación y batería completa

**Archivos:** crear `pruebas/recorridos/e2e-automatizaciones.js`; modificar `CLAUDE.md` (sección nueva "Automatizaciones" y las rutas en la tabla de la API), `pruebas/README.md`.

- [ ] **Paso 1: escribir `e2e-automatizaciones.js`** (mismo estilo que `e2e-ciclos.js`; mundo de prueba): el profesor del curso marca tres clases seguidas "ausente" a un alumno desde la pantalla de asistencia y la administración ve el aviso "tiene 3 inasistencias seguidas" en la campana, que lleva al legajo; una ausencia **justificada** sin motivo no se puede guardar, con motivo se guarda y se ve "Ausente (justificada)" en el calendario del legajo y corta la racha; con cuotas vencidas por SQL, la campana muestra el aviso de deuda al llegar a dos; en Configuración la tarjeta cuenta los alumnos en alerta, al subir el número a 4 el aviso desaparece y el historial muestra la alerta cerrada con "Cambio de número"; el profesor ve su aviso de inasistencias y lleva a su pantalla de asistencia.
- [ ] **Paso 2: correrlo** con API y Vite levantados y el mundo creado (`bash pruebas/bin/e2e.sh ../pruebas/recorridos/e2e-automatizaciones.js | python3 ../pruebas/bin/chequear.py`; `N bien, 0 mal`).
- [ ] **Paso 3: documentar** en `CLAUDE.md`, en el estilo de las secciones existentes: el módulo, las dos reglas y sus definiciones, la casilla justificada, cuándo se revisa, la identidad y los motivos de cierre de las alertas, los tipos de aviso y a quién llegan, el panel y sus rutas, y que las acciones futuras (WhatsApp, reportes, IA) se suman en el módulo sin tocar las reglas.
- [ ] **Paso 4: batería completa** con respaldo previo: `bash pruebas/bin/bateria.sh > /tmp/bateria.log 2>&1`. Esperado: todos los bloques sin fallas y la línea final `BASE: 3/148/0/null`; cualquier falla se informa por nombre.
- [ ] **Paso 5: commit** `Automatizaciones: recorrido de navegador y documentación`. Avisar al usuario que la rama está lista para revisión; **no fusionar ni subir sin su orden**.
