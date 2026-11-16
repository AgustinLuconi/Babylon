# Automatizaciones: reglas extra (alumno en riesgo y evaluación sin notas) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar las reglas `alumno_en_riesgo` y `evaluacion_sin_notas` al módulo `automatizaciones/`, con sus avisos en la campana y sus tarjetas en el panel.

**Architecture:** Mismo mecanismo que `deuda_cuotas` e `inasistencias_seguidas`: el catálogo `REGLAS`, un evaluador por regla, alertas reconciliadas (`reconciliarAlertas`), avisos de estado leídos de las alertas abiertas. Novedad: el sujeto de una alerta puede ser una **evaluación** (`AlertaAutomatica.evaluacionId`, `alumnoId` pasa a opcional) y una regla puede no tener número (`conNumero: false`).

**Tech Stack:** Express 5, Prisma 6, PostgreSQL 18, TypeScript 6, React 19, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-17-automatizaciones-reglas-extra-design.md`

## Global Constraints

- Node con `source ~/.nvm/nvm.sh && nvm use`; `pnpm` (no npm). Server: `pnpm typecheck`, `pnpm test`; client: `pnpm typecheck`, `pnpm lint`.
- Respaldo `pg_dump -Fc` a `~/respaldos-babylon/` antes de la migración. Nunca tocar datos reales: las pruebas usan `_mundo-avisos.ts` (prefijo `prueba-tmp-av`) y deshacen lo que abren o cierran sobre alumnos reales, como los scripts existentes.
- Todo "hoy" en hora de Argentina (`core/fechas.ts`: `inicioDeHoyUtc`, `fechaHoraEnArgentina`); nunca `toISOString()` ni `getDate()` locales.
- Las reglas nuevas nacen **activadas**. `valorCuota` queda en null.
- Orden de bloqueos: las reglas se revisan siempre en el orden del catálogo `REGLA_IDS` (deuda, inasistencias, evaluación sin notas, **riesgo al final**), y `suscribirAutomatizaciones` se registra antes que `suscribirAvisos`.
- Server y client no comparten código: los tipos nuevos se repiten en `client/src/features/automatizaciones/types.ts` y `client/src/features/notificaciones/types.ts`.
- Los scripts `server/scripts/_*.ts` imprimen `etiqueta: real (esperado X)`, se agregan con `git add -f` y a `pruebas/bin/bateria.sh`. Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No fusionar ni subir sin pedido del usuario.

## Review Focus

- Alertas viejas (deuda/faltas) y su índice único tras la migración: no deben duplicarse ni perderse (test: reconciliar dos veces y contar filas).
- Riesgo evaluado con una sola de las dos alertas, o con una de las reglas base apagada: no se abre / se cierra.
- Evaluación sin notas: la nota cargada en una evaluación de un curso que se reasigna de profesor; evaluación de un curso inactivo o de otro ciclo (no se alerta); evaluación de hoy o de hace N−1 días (no).
- Lo que ve cada rol: la familia nunca recibe estos avisos; el profesor solo los de sus cursos; riesgo no llega a profesores.
- Deadlock: `alumnos.cambiaron` revisa todas las reglas en una sola operación a la vez que una carga de notas (`_automatizacion-bloqueos`).

---

### Task 1: Núcleo — sujeto de la alerta, catálogo y migración

**Files:**
- Modify: `server/prisma/schema.prisma` (modelo `AlertaAutomatica`, relación en `Evaluacion`)
- Create: migración `server/prisma/migrations/<fecha>_alertas_sujeto_evaluacion/migration.sql` (con el índice parcial escrito a mano)
- Modify: `server/src/modules/automatizaciones/automatizacion.reconciliar.ts`, `automatizacion.entity.ts`, `automatizacion.repository.prisma.ts`, `automatizacion.repository.ts`
- Test: `server/tests/alertas-reconciliar.test.ts`

**Interfaces:**
- Produces: `ReglaId = "deuda_cuotas" | "inasistencias_seguidas" | "evaluacion_sin_notas" | "alumno_en_riesgo"`; `REGLA_IDS` en ese orden. `AlertaEsperada`, `AlertaAbierta`, `AlertaAutomatica`: `alumnoId: string | null`, `evaluacionId: string | null` (nuevo), `cursoId: string | null`. `claveDeAlerta({alumnoId, cursoId, evaluacionId})` → `` `${alumnoId ?? ""}|${cursoId ?? ""}|${evaluacionId ?? ""}` `` (los evaluadores existentes pasan `evaluacionId: null`). `DefinicionDeRegla.conNumero: boolean` (true en las dos viejas). Entradas nuevas de `REGLAS`: `evaluacion_sin_notas` (nombre "Evaluación sin notas", por defecto 7, rango 1–30, unidad "días sin notas", `conNumero: true`) y `alumno_en_riesgo` (nombre "Alumno en riesgo", `umbralPorDefecto/Minimo/Maximo` 1, unidad "alertas", `conNumero: false`). `AlertaConNombres` suma `evaluacionNombre: string | null` y `alumnoNombre: string | null`.

- [ ] **Step 1: Test que falla** — en `alertas-reconciliar.test.ts`: (a) dos esperadas con mismo curso y distinta `evaluacionId` abren dos alertas; (b) una esperada con `alumnoId: null, evaluacionId: "e1"` y la misma abierta no abre ni actualiza nada; (c) abierta con `evaluacionId` que ya no se espera se cierra `ya-no-corresponde` si su clave no está en la población y `resuelta` si sí. Correr `pnpm test` → falla (tipos/`claveDeAlerta`).
- [ ] **Step 2: Respaldo y migración** — `pg_dump -Fc` a `~/respaldos-babylon/antes-reglas-extra-<fecha>.dump`. En `schema.prisma`: `alumnoId String?`, `evaluacionId String?`, relación `evaluacion Evaluacion?` (con su lado en `Evaluacion`), `@@index([evaluacionId])`. `pnpm prisma:migrate --create-only`, y editar el SQL: agregar `CHECK (("alumnoId" IS NOT NULL) <> ("evaluacionId" IS NOT NULL))` y reemplazar el índice único parcial `AlertaAutomatica_abierta_key` por uno sobre `(regla, COALESCE("alumnoId",''), COALESCE("cursoId",''), COALESCE("evaluacionId",''))` `WHERE "resueltaEn" IS NULL`. Aplicar; `pnpm prisma:generate`.
- [ ] **Step 3: Implementar** los tipos, `claveDeAlerta`, `REGLA_IDS`, `REGLAS` y `conNumero` indicados; el repositorio Prisma mapea `evaluacionId` y el historial incluye `evaluacion: { select: { nombre: true } }` y `alumno` opcional. Los evaluadores existentes y `alumnosConDeuda`/faltas siguen compilando (alumno no nulo para ellas: afirmarlo donde se lee).
- [ ] **Step 4: Verificar** — `pnpm typecheck && pnpm test` (verde); `psql`: filas viejas de `AlertaAutomatica` intactas (mismo conteo que antes de migrar) y el índice nuevo existe.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Automatizaciones: el sujeto de una alerta puede ser una evaluación"`.

---

### Task 2: Evaluadores y servicio de las dos reglas

**Files:**
- Modify: `server/src/modules/automatizaciones/automatizacion.entity.ts` (puerto), `automatizacion.evaluadores.prisma.ts`, `automatizacion.service.ts`, `automatizacion.suscripciones.ts`, `automatizacion.schema.ts`
- Create: `server/src/modules/automatizaciones/automatizacion.sinNotas.ts` (función pura)
- Test: `server/tests/evaluacion-sin-notas.test.ts`; script `server/scripts/_automatizacion-reglas-extra.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `EvaluadorDeRegla.evaluar(umbral: number, tx?: unknown, ahora?: Date): Promise<EvaluacionDeRegla>`. `evaluacionSinNotas(evaluacion: { fecha: Date; notas: number }, hoy: Date, dias: number): boolean` (pura: `notas === 0` y `fecha <= hoy − dias días`, con `hoy` = inicio del día en UTC de Argentina). `AutomatizacionService.evaluar` revisa las reglas en el orden de `REGLA_IDS` (reemplaza el `.sort()` alfabético) y le pasa `ahora` a cada evaluador. `ReglaConEstado.conNumero: boolean`. El `PATCH` con `umbral` sobre una regla `conNumero: false` → `ValidationError` 400 ("Esta regla no tiene número").

- [ ] **Step 1: Test puro que falla** — `evaluacion-sin-notas.test.ts`: tabla con `dias = 7` y `hoy = 2026-11-17`: fecha 2026-11-10 sin notas → true; 2026-11-11 → false (hace 6); 2026-11-10 con 1 nota → false; fecha futura → false.
- [ ] **Step 2: Script que falla** (`_automatizacion-reglas-extra.ts`, con `crearMundo/limpiarMundo`; alumno con una alerta de deuda y otra de faltas abiertas): (a) riesgo se abre con ambas, nivel 1, `evaluacionId` null; (b) cerrar solo la de deuda cierra riesgo (`resuelta`); (c) apagar `deuda_cuotas` cierra riesgo; (d) evaluación de curso activo con fecha de hace 8 días y 0 notas abre `evaluacion_sin_notas` (`alumnoId` null, `cursoId` del curso, `evaluacionId`); cargar una nota la cierra `resuelta`; (e) evaluación de hace 6 días no alerta; (f) curso inactivo o ciclo no activo no alerta; (g) revisar dos veces no duplica; (h) cambiar el número de 7 a 3 abre una de hace 4 días; (i) `actualizar("alumno_en_riesgo", {umbral: 2})` → `ValidationError`. Correr → falla.
- [ ] **Step 3: Implementar** — `evaluacionSinNotas` pura. Evaluador `evaluacion_sin_notas`: evaluaciones con `curso: { activo: true, ciclo activo }`, contando `calificaciones`; esperadas = las que cumplen la función pura; población = todas las evaluaciones consideradas (así "resuelta" vs "ya-no-corresponde" funciona). Evaluador `alumno_en_riesgo`: lee `alertaAutomatica` abiertas de deuda e inasistencias con el `tx`; esperadas = alumnos (con `alumnoId` no nulo) presentes en ambas, nivel 1, `cursoId: null`; población = alumnos activos inscriptos en el ciclo activo. Suscripciones: `alertas.cambiaron` → si `reglaIds` incluye deuda o inasistencias, `servicio.evaluar(["alumno_en_riesgo"], tx)`; `calificaciones.cargadas`, `evaluacion.creada` y `cursos.cambiaron` → `["evaluacion_sin_notas"]` (`alumnos.cambiaron` y `ciclo.activado` ya revisan `REGLA_IDS`). Schema/servicio: rechazo del número en reglas sin número; `conEstado` devuelve `conNumero`.
- [ ] **Step 4: Verificar** — `pnpm test` y el script nuevo: todo "0 mal"; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `git add -A && git add -f server/scripts/_automatizacion-reglas-extra.ts && git commit -m "Automatizaciones: reglas alumno en riesgo y evaluación sin notas"`.

---

### Task 3: Avisos de la campana

**Files:**
- Modify: `server/src/modules/notificaciones/notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.alertas.ts`, `notificacion.criterios.prisma.ts`, `notificacion.suscripciones.ts`; `server/scripts/_mundo-avisos.ts` (`limpiarMundo`)
- Test: `server/tests/alertas-textos.test.ts`; script `server/scripts/_automatizacion-avisos-extra.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `TipoEstado` suma `alumno_en_riesgo`, `evaluacion_sin_notas` (grupo `staff` los dos) y `evaluacion_sin_notas_profesor` (grupo `profesor`), todos clase `estado`, con etiquetas "Alumnos en riesgo", "Evaluaciones sin notas" y "Evaluaciones sin notas en mis cursos". `textoDeAlertaDeRiesgo(alumno: string): string` → `"<alumno> tiene deuda e inasistencias seguidas"`; `textoDeEvaluacionSinNotas(evaluacion: string, curso: string, fecha: string): string` → `"<evaluación> (<curso>) del <dd/mm> todavía no tiene notas"`. `TIPOS_POR_REGLA`: `alumno_en_riesgo → ["alumno_en_riesgo"]`, `evaluacion_sin_notas → ["evaluacion_sin_notas","evaluacion_sin_notas_profesor"]`; y `cursos.cambiaron` también sincroniza `evaluacion_sin_notas_profesor`.

- [ ] **Step 1: Test que falla** — textos en `alertas-textos.test.ts`; script: (a) riesgo → un aviso `alumno_en_riesgo` por cuenta de administración/secretaría activa, tono `danger`, recurso `{tipo:"alumno", alumnoId}`; (b) evaluación sin notas → aviso a staff y al profesor **actual** del curso (recurso `{tipo:"evaluacion", cursoId, evaluacionId}`, nivel 1); otro profesor y la familia no reciben nada; (c) reasignar el curso mueve el aviso al profesor nuevo; (d) cargar una nota resuelve el aviso; (e) nadie de la familia recibe ninguno de los tres tipos; (f) apagar la preferencia del tipo borra los avisos y encenderla los vuelve a crear.
- [ ] **Step 2: Implementar** — `alertasAbiertas` pasa a aceptar cualquier `ReglaId` e incluye `evaluacion` (nombre, fecha, cursoId) además de alumno y curso; los tres criterios nuevos (`alumnosEnRiesgo`, `evaluacionesSinNotas`, `evaluacionesSinNotasParaProfesores`) siguen el patrón de `alumnosConDeuda`/`alumnosConFaltasParaProfesores`; claves `alerta:alumno_en_riesgo:<alumnoId>` y `alerta:evaluacion_sin_notas:<evaluacionId>`; `esperados()` despacha los tipos nuevos. `limpiarMundo` borra los avisos de estos tres tipos de alumnos/evaluaciones de prueba.
- [ ] **Step 3: Verificar** — `pnpm test`, `pnpm typecheck` y el script: "0 mal".
- [ ] **Step 4: Commit** — `git add -A && git add -f server/scripts/_automatizacion-avisos-extra.ts && git commit -m "Automatizaciones: avisos de las reglas extra"`.

---

### Task 4: Panel y campana en el navegador

**Files:**
- Modify: `client/src/features/automatizaciones/types.ts`, `components/TarjetaDeRegla.tsx`, `components/HistorialDeAlertas.tsx`; `client/src/features/notificaciones/types.ts`, `rutas.ts`; `client/src/features/cambios/mensajes.ts` (sin cambios si no hace falta)
- Test: `pruebas/recorridos/e2e-automatizaciones.js` (se extiende)

**Interfaces:**
- Consumes: Tasks 1–3 (la API devuelve `conNumero`, `alumnoId: string | null`, `alumnoNombre: string | null`, `evaluacionId`, `evaluacionNombre`).
- Produces: `ReglaId` del client con las 4 reglas; `ReglaConEstado.conNumero`; `AlertaDelHistorial` con `alumnoId/alumnoNombre` opcionales y `evaluacionId/evaluacionNombre`; `TipoNotificacion` con los 3 tipos nuevos.

- [ ] **Step 1: Recorrido que falla** — en `e2e-automatizaciones.js`: el panel muestra las 4 tarjetas; la de riesgo no tiene campo "Número"; la de evaluación sin notas muestra su rango "de 1 a 30"; con una evaluación vieja sin notas creada para la prueba (mundo de prueba), el historial de esa regla muestra el nombre de la evaluación y el curso, y no un enlace a alumno; la campana del profesor muestra el aviso. Correr `pruebas/bin/e2e.sh` → falla.
- [ ] **Step 2: Implementar** — `TarjetaDeRegla` oculta el campo y el botón "Guardar" si `!conNumero`; el historial muestra "Alumno/Evaluación" como sujeto (enlace al alumno solo si hay `alumnoId`); `rutaDeAviso` ya resuelve `evaluacion` y `alumno`: verificar que el aviso de staff por evaluación lleve a `/dashboard` (igual que `evaluacion_proxima`) y no rompa.
- [ ] **Step 3: Verificar** — `pnpm typecheck && pnpm lint` (sin errores nuevos) y `pruebas/bin/e2e.sh` del recorrido de automatizaciones, 5 corridas seguidas verdes.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Automatizaciones: panel y campana con las reglas extra"`.

---

### Task 5: Bloqueos, batería y documentación

**Files:**
- Modify: `server/scripts/_automatizacion-bloqueos.ts`, `pruebas/bin/bateria.sh`, `pruebas/README.md`, `CLAUDE.md` (sección "Automatizaciones…"), `server/scripts/datos-prueba-2026.ts` (`borrar` ya borra `AlertaAutomatica` por alumno: extender a las de evaluaciones `prueba-`)
- Test: `server/scripts/_automatizacion-bloqueos.ts`

**Interfaces:**
- Consumes: Tasks 1–4.

- [ ] **Step 1: Bloqueos que falla** — agregar a `_automatizacion-bloqueos.ts` el caso: en paralelo `alumnos.cambiaron` (revisa las 4 reglas) y `cargarCalificaciones` de una evaluación, 20 veces cada uno, sin errores de deadlock. Correr; si falla, el orden de `evaluar` no es el del catálogo: corregir en el servicio.
- [ ] **Step 2: Borrado de prueba que falla** — copiar la base a una temporal, crear una alerta de `evaluacion_sin_notas` sobre una evaluación `prueba-`, correr `datos-prueba-2026.ts borrar` → debe fallar por la clave foránea; extender el script para borrar esas alertas primero; verificar verde. (Sin tocar la base real.)
- [ ] **Step 3: Documentar y batería** — agregar los scripts nuevos a `bateria.sh` y `pruebas/README.md`; en `CLAUDE.md` describir las dos reglas, `conNumero`, el sujeto evaluación y el orden de revisión; actualizar la memoria `proyecto_babylon_automatizaciones.md`.
- [ ] **Step 4: Verificar todo** — `pruebas/bin/bateria.sh`: sin líneas "mal", 308+ pruebas unitarias, `BASE 3/148/0/null`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Automatizaciones: bloqueos, batería y documentación de las reglas extra"`.
