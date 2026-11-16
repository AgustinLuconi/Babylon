# Automatizaciones: alertas por deuda e inasistencias, con panel de configuración e historial — diseño

Fecha: 2026-11-16. Estado: borrador para revisión del usuario.

## Por qué

El cliente (el instituto) pidió dos alertas automáticas: que se avise cuando **un alumno adeuda dos cuotas o más** y cuando **un alumno tiene tres inasistencias seguidas**. Hoy el sistema solo muestra un aviso agrupado de cuotas vencidas ("Hay N cuotas vencidas") y avisos de asistencia sin tomar; nadie se entera de un alumno puntual que se está atrasando o faltando. El usuario además quiere que las automatizaciones sean algo **útil y profesional**, no un par de números fijos en el código, y que el módulo pueda crecer después (mensajes por WhatsApp, reportes y archivos estadísticos, integración con IA).

## Objetivos

- Dos reglas funcionando: **deuda** (alumno con dos o más cuotas vencidas) e **inasistencias** (tres ausencias sin justificar seguidas).
- Las alertas les llegan al **equipo del instituto dentro del sistema** (campana): deuda → administración y secretaría; inasistencias → administración, secretaría y el profesor del curso del alumno.
- Un **panel "Automatizaciones"** (solo administración) en Configuración: cada regla con su interruptor, su número editable, cuántos alumnos están en alerta ahora, la última revisión y un historial.
- Un **módulo propio `automatizaciones/`** con un catálogo de reglas, su configuración y su registro de alertas; el aviso de la campana es la primera "acción" de una regla, y las siguientes (WhatsApp, reportes, IA) se suman sin tocar las reglas.
- La asistencia gana una **casilla "Justificada"** que exige el motivo.

## No objetivos / anti-objetivos

- No se envía nada fuera del sistema (ni WhatsApp ni correo): queda preparado, no construido.
- No hay alertas para las familias.
- No hay números distintos por curso o por alumno: un número por regla para todo el instituto.
- No se agregan por ahora las demás reglas posibles (resumen mensual, baja asistencia, evaluación sin notas, alumno en riesgo): se eligen después.
- No hay opción para que las ausencias justificadas cuenten (decisión del usuario: la justificada **corta la racha**).
- **Anti-objetivo: ruido.** Una alerta que sigue en pie no genera un aviso nuevo en cada revisión: una alerta abierta es una sola, y un aviso leído solo vuelve a "no leído" si el nivel sube (una cuota más, una falta más).
- No se corrigen ni reinterpretan las asistencias que ya existen.

## Las dos reglas

**Deuda (`deuda_cuotas`).** Para cada alumno **activo e inscripto en el ciclo activo**, cuenta sus cuotas en estado `vencida` (la "deuda" del sistema son solo las vencidas, igual que en reportes). Hay alerta cuando el conteo es **mayor o igual al número configurado** (por defecto 2). El nivel de la alerta es la cantidad de cuotas vencidas (sube con la tercera, cuarta…). Se resuelve sola cuando el conteo baja del número (por ejemplo, al pagar).

**Inasistencias seguidas (`inasistencias_seguidas`).** Para cada alumno activo y su curso del ciclo activo, toma los registros de asistencia del alumno en ese curso, de la fecha más nueva a la más vieja, y cuenta cuántos seguidos, desde el más nuevo, son **ausente y no justificada** (la racha). Hay alerta cuando la racha es **mayor o igual al número configurado** (por defecto 3). El nivel es la longitud de la racha. Un registro "presente", "tarde" o una ausencia **justificada** corta la racha; con menos registros que el número no hay alerta. No hay calendario de feriados: se miden las clases con registro, no los días del calendario. Se resuelve sola cuando entra un registro que corta la racha.

**Casilla "Justificada" (asistencia).**
- `Asistencia.justificada` (booleano, por defecto `false`). Solo tiene sentido con estado `ausente`; con "presente" o "tarde" se guarda `false`.
- Si `justificada` es `true`, el `motivo` es **obligatorio** (con texto, sin contar espacios). El servidor lo exige (400) y la pantalla también.
- En la pantalla del profesor, al marcar "Ausente" aparece la casilla; al tildarla, el campo de motivo (que hoy ya aparece con "Ausente") pasa a ser obligatorio y se bloquea guardar sin él.
- Los registros que ya existen quedan como no justificados, aunque tengan un motivo escrito (decisión del diseñador: no sé cuáles eran justificadas de verdad).
- El calendario del legajo y el panel de la familia muestran "Ausente (justificada)".

## Cuándo se revisan las reglas

Una regla se revisa **entera** (todos los alumnos), con un bloqueo por regla para que dos revisiones simultáneas no choquen (mismo patrón que los avisos de estado):
- cuando cambian los datos de los que depende: cuotas (`cuotas.cambiaron`: pago, vencimiento, generación), asistencia (`asistencia.registrada`) y alumnos (`alumnos.cambiaron`: baja, reactivación, cambio de curso), dentro de la transacción de la operación;
- cuando se activa otro ciclo (`ciclo.activado`: cambia quiénes están inscriptos en el ciclo activo, por ejemplo con el pase de año);
- cuando el administrador **cambia el número o el interruptor** de la regla;
- una vez por día a las 03:00 (y al arrancar el servidor) como red de seguridad.

## Corregir una asistencia ya guardada

No hace falta construir una edición: guardar de nuevo la asistencia de un curso y una fecha **actualiza** los registros que ya existen (`registrarAsistenciaMasiva` hace "crear o actualizar" por alumno, curso y fecha) y vuelve a publicar `asistencia.registrada`. Así un profesor puede tildar "Justificada" después, o corregir una falta mal marcada, y la alerta se recalcula sola.

## Qué guarda el módulo

- **Configuración por regla** (`Automatizacion`: regla, `activa`, `umbral`, última revisión). El catálogo de reglas vive en el código (nombre, descripción, número por defecto y rango permitido: deuda de 1 a 12, inasistencias de 2 a 10); la fila de la base se crea la primera vez que se lee, como `Configuracion`.
- **Registro de alertas** (`AlertaAutomatica`): una fila por alerta, con la regla, el alumno, el curso (en inasistencias), el nivel actual, cuándo se abrió, cuándo se resolvió y por qué (`resuelta`, `regla-apagada`, `cambio-de-numero`). Es **permanente** (decisión del diseñador): sirve de historial en el panel y de estadística. Es la fuente de verdad de "qué alertas están abiertas ahora".
- Apagar una regla cierra sus alertas abiertas; cambiar el número las recalcula en el momento (las que ya no corresponden se resuelven con el motivo `cambio-de-numero`). Volver a prenderla las vuelve a abrir si siguen valiendo.

## La acción "aviso" y los destinatarios

El módulo decide cuándo hay una alerta; los avisos de la campana salen del motor que ya existe (`notificaciones/`), con tipos de **estado** nuevos que leen las alertas abiertas:
- `alumno_con_deuda` (grupo staff: administración y secretaría): "{Alumno} debe {n} cuotas vencidas", tono `danger`.
- `alumno_con_faltas` (grupo staff): "{Alumno} tiene {n} inasistencias seguidas en {Curso}", tono `warning`.
- `alumno_con_faltas_profesor` (grupo profesor, solo al profesor del curso): el mismo texto.
- Los avisos se vuelven a sincronizar también con `cursos.cambiaron`, para que el aviso al profesor pase al profesor nuevo (y salga del anterior) si el curso se reasigna con la alerta abierta.
- Cada aviso guarda el recurso (el alumno) y lleva al legajo; el nivel de la alerta es el nivel del aviso. Solo cuentas activas, como los demás avisos. Cada persona puede apagar el tipo para sí en "Mi cuenta" (se agregan a las preferencias de su rol).
- El módulo de automatizaciones publica un anuncio cuando cambian sus alertas, y el de notificaciones se suscribe y sincroniza los tipos afectados (los módulos no se conocen entre sí). También publica `datos.cambiaron` con un dato nuevo `automatizaciones` (solo administración) para que el panel se actualice en vivo.

## El panel "Automatizaciones" (Configuración, solo administración)

Una tarjeta por regla con: nombre y descripción, interruptor, campo del número (con su rango y validación), "N alumnos en alerta ahora", "última revisión", y "Ver historial": las últimas alertas (alumno, curso, nivel, abierta, resuelta y motivo), cada alumno con enlace a su legajo. Rutas `GET /api/automatizaciones`, `PATCH /api/automatizaciones/:regla` (`{ activa?, umbral? }`) y `GET /api/automatizaciones/:regla/alertas` (historial, de a páginas), todas solo `admin`. Como las demás pantallas, usa filtros en la dirección donde corresponde y avisa si hay algo sin guardar.

## Restricciones

- Arquitectura feature-first (`modules/automatizaciones/` con entity, schema, repository, service, controller, routes; las reglas y sus criterios en archivos propios del módulo; lógica pura —racha de inasistencias, reconciliación de alertas— en funciones puras con tabla de casos en `server/tests/`). Todo con `tx` pasado a cada llamada al repositorio y anuncios dentro de la transacción.
- Los módulos de cuotas, asistencia y alumnos no importan nada de automatizaciones: se enteran por anuncios.
- Migraciones con respaldo `pg_dump -Fc` previo en `~/respaldos-babylon/`: `Asistencia.justificada`, las dos tablas nuevas, los tipos de aviso nuevos.
- La escritura de configuración y alertas no pertenece a un ciclo, así que no pasa por el bloqueo de ciclos (se clasifica en la barrida de rutas de escritura).
- Toda hora o "hoy" con `core/fechas.ts`; pruebas con datos `prueba-tmp-av` y sin tocar datos reales ni el valor de la cuota; la batería completa en verde antes de fusionar.
- Nunca fusionar ni subir sin pedido explícito del usuario.

## Enfoques considerados

- **A. Las reglas como tipos de aviso nuevos dentro de `notificaciones/`**, con una tabla de configuración y el historial enganchado al motor de avisos. Más rápido, pero queda pegado al modelo de avisos y habría que rehacerlo para sumar acciones que no sean avisos.
- **B (elegida por el usuario). Un módulo propio de Automatizaciones**: catálogo de reglas, configuración y registro propios; el aviso es solo la primera acción. Algo más de trabajo, pero es la base para WhatsApp, reportes e IA.

**Qué cuenta una ausencia justificada.** Se consideraron: (A, elegida) corta la racha; (B) se saltea sin sumar ni reiniciar; (C) cuenta igual. Y qué hacer con "justificada": (A) todas las ausencias cuentan, (B) las que tienen motivo no cuentan, (C, elegida) casilla propia que exige el motivo.

## Decisiones del diseñador (para que el usuario las revise)

Surgieron de la revisión del documento por un constructor; ninguna cambia lo que el usuario decidió:

1. **Población y curso de las inasistencias:** alumno `activo` con `Inscripcion` en el ciclo activo; la racha se mide **por (alumno, curso)** y el curso es el de esa inscripción. Si cambia de curso, la racha del curso nuevo empieza de cero y las faltas del curso anterior no cuentan. Un alumno sin inscripción en el ciclo activo no entra.
2. **Identidad de una alerta:** cada episodio es una fila nueva. Una alerta abierta es única por regla, alumno y curso (índice único parcial sobre las abiertas). Si se resuelve y más tarde el alumno vuelve a la situación, se abre **otra fila** (el historial no se mezcla). La clave del aviso es `{regla}:{alumno}[:{curso}]`, así el aviso resuelto se reabre con el motor de avisos de siempre.
3. **Motivos de cierre:** `resuelta` (la situación terminó), `regla-apagada`, `cambio-de-numero` y `ya-no-corresponde` (el alumno se dio de baja, dejó de estar inscripto en el ciclo activo o cambió de curso). Con el pase de año o al activar otro ciclo, la revisión cierra con `ya-no-corresponde` las alertas que quedan fuera, todas juntas.
4. **Aviso viejo de cuotas:** el aviso agrupado `cuotas_vencidas` ("Hay N cuotas vencidas") **sigue como está** y convive con el nuevo por alumno: uno es un resumen del total y el otro señala casos puntuales. No se toca nada del viejo.
5. **Quién ve qué:** el panel Automatizaciones y su historial son solo de administración, como el resto de Configuración. La secretaría recibe las alertas en la campana pero no ve el panel.
6. **Primer arranque:** las dos reglas nacen **activadas** (deuda en 2, inasistencias en 3). Los registros de asistencia viejos quedan como no justificados (ver arriba); como el curso que se mide es el de la inscripción del ciclo activo, y esos cursos acaban de empezar tras un pase de año, no se espera una avalancha de alertas inflada por asistencias viejas.

## Partes que quedan al implementador

- Nombres de archivos, funciones y tablas; el catálogo exacto de la regla (campos del tipo `Regla`).
- La estructura exacta de las tarjetas y del historial, y los textos de cada pantalla, respetando lo de arriba.
- Cómo se resuelve "el profesor del curso" y los avisos de cada rol dentro del motor de avisos existente.
- Si el historial pagina por fecha o por cantidad, y cuánto se muestra por defecto.
- Cómo se pasa de una alerta abierta a su aviso (una lectura directa del registro de alertas o un anuncio por cada cambio).
