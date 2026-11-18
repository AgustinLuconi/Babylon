# Automatizaciones: dos reglas extra — diseño

## Para qué
Sumar dos reglas al módulo `automatizaciones/` (ya hecho: deuda e inasistencias seguidas) con el mismo mecanismo de alertas, avisos en la campana y panel de Configuración. Son para el equipo del instituto; el cliente solo pidió las dos primeras reglas, estas las eligió el usuario de una lista de ideas. "Baja asistencia en el mes" se evaluó y se dejó afuera a propósito: el porcentaje ya se ve en Reportes, el panel de administración y la pantalla del profesor, y "inasistencias seguidas" cubre lo más grave; se retoma si el cliente la pide.

Metas: que el equipo vea antes a los alumnos con problemas y que un profesor no deje evaluaciones sin cargar. No metas: reportes mensuales (van aparte), WhatsApp o IA (después), reglas para las familias.

## Las dos reglas
1. **`alumno_en_riesgo`** — el alumno tiene **a la vez** una alerta abierta de `deuda_cuotas` y una de `inasistencias_seguidas`. No tiene número propio: usa los de esas dos reglas. Se calcula leyendo las alertas abiertas (no vuelve a mirar cuotas ni asistencia). Si se apaga una de las dos reglas, sus alertas se cierran y la de riesgo también. Es **adicional**: las dos alertas individuales siguen existiendo. Nivel 1. Aviso `alumno_en_riesgo` (administración y secretaría).
2. **`evaluacion_sin_notas`** — una evaluación del ciclo activo, de un curso activo, cuya fecha pasó hace **N días o más** (por defecto 7, rango 1 a 30, hora de Argentina) y que tiene **cero notas cargadas** (borrador o publicada, da igual). Se cierra (`resuelta`) al cargarse cualquier nota. Una por evaluación, no por alumno. Nivel 1 fijo (si subiera con los días, el aviso volvería a "no leído" todas las noches). Avisos `evaluacion_sin_notas` (administración y secretaría) y `evaluacion_sin_notas_profesor` (el profesor **actual** del curso, que lo lleva a Calificaciones del curso).

Mis decisiones (marcadas para que las puedas cambiar): riesgo adicional y no sustituto; "sin notas" significa ninguna nota (no "faltan algunas"); nivel fijo en la evaluación.

## Enfoque elegido (A)
El registro de alertas hoy guarda siempre un alumno. Para "evaluación sin notas" se **amplía el sujeto**: `AlertaAutomatica.alumnoId` pasa a ser opcional y se suma `evaluacionId` opcional (con restricción: exactamente uno de los dos). Descartado (B): una alerta por alumno sin nota (20 alertas por la misma evaluación).

## Cambios de fondo
- **Base**: una migración (con respaldo `pg_dump -Fc` antes): `alumnoId` nullable, `evaluacionId` con clave foránea a `Evaluacion`, restricción de un solo sujeto, y el índice único parcial de alertas abiertas reescrito con `COALESCE(alumnoId,'')`, `COALESCE(cursoId,'')`, `COALESCE(evaluacionId,'')`. Las filas existentes no cambian.
- **Reglas**: `ReglaId` suma las dos; `claveDeAlerta` incluye la evaluación; `AlertaEsperada/Abierta` llevan `alumnoId | null` y `evaluacionId | null`; `reconciliarAlertas` no cambia de lógica. El catálogo `REGLAS` admite una regla **sin número** (`alumno_en_riesgo`): el panel oculta el campo.
- **Cuándo se revisan** (todo dentro de la transacción de la operación, como hoy): riesgo, al publicarse `alertas.cambiaron` de deuda o inasistencias (después de ellas); sin notas, con `calificaciones.cargadas`, `evaluacion.creada`, `cursos.cambiaron`, `alumnos.cambiaron` y `ciclo.activado`, y por el paso del tiempo con la revisión de las 03:00 y al arrancar.
- **Orden de bloqueos** (la lección de la revisión anterior): primero las reglas base (deuda, inasistencias), después riesgo, y los avisos siempre después de las reglas. `suscribirAutomatizaciones` se registra antes de `suscribirAvisos`.
- **Avisos**: tres tipos de estado nuevos en el catálogo (`alumno_en_riesgo`, `evaluacion_sin_notas`, `evaluacion_sin_notas_profesor`), leyendo las alertas abiertas; textos en `notificacion.alertas.ts`; recurso del aviso sin direcciones (el client la arma). El del alumno en riesgo lleva al legajo; el de evaluación, a Calificaciones del curso.
- **Panel**: dos tarjetas más (la de riesgo sin campo de número); el historial muestra el sujeto (alumno o evaluación) y el curso. Señales en vivo: ya existe `datos.cambiaron` `automatizaciones`.
- **Reglas de privacidad**: las alertas de un alumno nunca llegan a una familia ni a un profesor ajeno al curso; la de riesgo no llega a profesores.

## Pruebas y límites
Mismo estilo que lo existente: funciones puras con tabla de casos (`pnpm test`: regla de evaluación sin notas con fechas, cruce de riesgo), scripts `_automatizacion-*` contra la base (reglas, avisos, bloqueos con las reglas nuevas) y un recorrido de navegador del panel con las tarjetas nuevas. Las reglas nacen **activadas**.

Límites conocidos: la evaluación sin notas no distingue feriados (cuenta días corridos); el nivel fijo de las dos reglas no se edita desde el panel.
