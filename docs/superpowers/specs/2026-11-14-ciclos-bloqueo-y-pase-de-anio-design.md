# Ciclos: bloqueo, pase de año e inscripción solo en el ciclo activo — diseño

Fecha: 2026-11-14. Estado: completo, pendiente de aprobación del usuario.

## Por qué

Hoy un año lectivo (ciclo) no tiene fin: un alumno, un curso o una nota de un año terminado se pueden seguir editando, los cursos hay que crearlos de cero cada año, los alumnos hay que pasarlos de curso uno por uno (cambiando el curso desde su legajo), y al inscribir a un alumno nuevo se puede elegir un curso de cualquier año. Estado real de la base al escribir esto (datos reales, sin contar los de prueba): 145 alumnos en cursos de 2025 y 3 en cursos de 2026; hay 71 alumnos reales "activos", de los cuales 68 solo tienen inscripción 2025; el ciclo activo es **2027** y no tiene cursos; un alumno real (Valentino Rodríguez) quedó inscripto en el ciclo 2027 con un curso de 2025, resultado de poder elegir cualquier curso al inscribir. Con eso, los paneles que miran "alumnos activos inscriptos en el ciclo activo" (documentación pendiente, datos incompletos) y la generación de cuotas casi no tienen a quién mirar.

Se quiere: (1) poder **bloquear un ciclo** terminado para que su historia quede intacta; (2) un **asistente "Pasar de año"** que copie los cursos al ciclo siguiente y pase a los alumnos a su curso nuevo sin hacerlo uno por uno; (3) que **inscribir o cambiar de curso solo permita cursos del ciclo activo**.

## Objetivos

- Un ciclo bloqueado no admite ninguna escritura de lo que le pertenece, hecha por nadie (tampoco el administrador, que primero desbloquea).
- Pasar de año con un asistente guiado, con vista previa, todo o nada.
- No se puede inscribir a un alumno ni cambiarlo de curso a un curso que no es del ciclo activo.

## No objetivos / anti-objetivos

- No hay bloqueo automático por fecha ni cierre automático del año; el asistente tampoco se dispara solo (solo hay un aviso que recuerda hacerlo).
- No se decide el curso siguiente con una regla fija: los nombres de los cursos reales son libres ("A1 (Niños 7-8 años)", "Taller de niños — Lunes y Miércoles", "PreB2 (Avanzados)") y el campo `nivel` es grueso; **lo decide el administrador en el asistente**. Anti-objetivo: alumnos colocados mal en silencio.
- El bloqueo no debe impedir cobrar deudas viejas (ver "Cuotas").
- No hay "deshacer" del asistente una vez confirmado (la vista previa es la protección; corregir después es manual).
- No se agrega historial de quién bloqueó ni cuándo (solo el estado actual).
- No se corrigen automáticamente los datos reales raros que ya existen (ver "Datos existentes").

## Reglas del bloqueo

**Estado:** columna nueva `Ciclo.bloqueado Boolean` (por defecto `false`). Un solo lugar guarda el estado, igual que `Ciclo.activo` y `Alumno.estado`.

**Quién:** solo el administrador, con dos acciones: `PATCH /api/ciclos/:id/bloquear` y `PATCH /api/ciclos/:id/desbloquear` (admin únicamente).

**Reglas de coherencia** (decisiones del diseñador, para confirmar):
- No se puede **bloquear el ciclo activo** (409): evita quedarse sin poder inscribir por error. Para cerrar un año se activa primero el siguiente.
- No se puede **activar un ciclo bloqueado** (409): primero se desbloquea.
- Bloquear un ciclo ya bloqueado (o desbloquear uno que no lo está) no hace nada y responde bien.

**Qué se bloquea** (todo lo que pertenece al ciclo; lo resuelve cada operación consultando a qué ciclo pertenece lo que va a escribir, nunca el ciclo activo):

| Qué se escribe | De dónde sale su ciclo |
|---|---|
| Curso (crear, editar, cambiar estado) | `Curso.cicloId` |
| Inscripción (crear, cambiar de curso) | `Inscripcion.cicloId` |
| Horarios, asistencia, evaluaciones y su publicación, notas de cierre y su publicación, categorías personalizadas | por el curso |
| Calificaciones (cargar notas) | por la evaluación y su curso |
| Cuota (crear: generación mensual y cuota inicial) | el año de la cuota contra `Ciclo.anio` |

Lo que **no** pertenece a un ciclo y sigue editable: los datos de la persona (alumno: nombre, DNI, contacto, observaciones médicas, estado; responsable; documentos; chats; observaciones; cuentas). Decisión del diseñador: un alumno existe a lo largo de varios ciclos.

**Cuotas — decisión del usuario (opción B):** con el ciclo de ese año bloqueado, **cobrar una cuota pendiente o vencida sigue permitido** (se registra el pago y la cuota pasa a pagada); no se pueden crear cuotas de ese año ni cambiar montos. Marcar una cuota como vencida al pasar el día (tarea de las 03:00) sigue funcionando: es el paso del tiempo y no una edición (decisión del diseñador).

**Las lecturas nunca se bloquean.**

**Cómo se hace cumplir (decisión del usuario: opción A):** una **única función de entrada**, `verificarCicloAbierto(cicloId, tx)`, en el módulo `ciclos/` (la entrega `container.ts` a los services que escriben cosas de un ciclo, por constructor). Lee `Ciclo.bloqueado` dentro de la transacción de la operación y, si está bloqueado, lanza un error de dominio con el mensaje "El ciclo {año} está bloqueado. Pedile al administrador que lo desbloquee." (status 409 salvo que el implementador elija otro y lo documente). Cada operación de escritura de la tabla de arriba la llama antes de escribir. No hay copia en memoria ni consulta en las lecturas.

Como la función no frena nada sola, el diseño incluye una **prueba de la batería** (`server/scripts/_ciclo-bloqueado.ts`): con un ciclo de prueba bloqueado, intenta cada ruta de escritura de la API que toca algo de un ciclo y exige que todas respondan con el rechazo, salvo el cobro de una cuota pendiente/vencida; y una segunda parte que comprueba que, con el ciclo desbloqueado, las mismas operaciones funcionan. Una operación nueva que olvide la llamada hace fallar la batería.

**Pantalla:** el listado de ciclos ya está en el client; se le agrega `bloqueado`. En Configuración → Ciclos lectivos: etiqueta "Bloqueado" y botones "Bloquear"/"Desbloquear" (solo admin, con confirmación). Las pantallas muestran el rechazo del servidor con su mensaje; el aviso previo (cartel o botón deshabilitado) queda a criterio del implementador, empezando por las pantallas de Cursos, Asistencia y Calificaciones.

## Inscribir y cambiar de curso solo en el ciclo activo

- `inscribirAlumno` rechaza (400, mensaje claro) un curso cuyo `cicloId` no sea el del ciclo activo, y también si no hay ciclo activo; además aplica `verificarCicloAbierto`.
- `actualizarAlumno` con `cursoId` aplica las mismas dos reglas al curso de destino. Hoy el curso del alumno cambia el curso actual y la inscripción del ciclo activo.
- Los selectores de curso del client (inscribir alumno, editar datos del legajo) muestran solo cursos del ciclo activo.

## Asistente "Pasar de año" (solo administrador)

Dos pedidos, ambos solo del administrador: una **vista previa** que no escribe nada y la **confirmación** que aplica todo en una sola transacción, todo o nada.

Pasos en pantalla (decisión del usuario: opción A, aprobada con un esquema):

1. **Ciclos:** origen (de dónde) y destino (existente o nuevo).
2. **Cursos:** lista de cursos del origen con casilla "copiar" (marcados los que tienen alumnos activos inscriptos). Se copian con nombre, nivel, profesor, aula, cupo y horarios; nacen con estado `activo`; después se editan como cualquier curso. Si el destino ya tiene un curso con ese nombre, se reutiliza en lugar de duplicar (decisión del diseñador).
3. **Alumnos:** por cada curso de origen: "sus N alumnos pasan a: [curso del destino | Egresan | No continúan]". Se puede abrir la lista y cambiar a un alumno solo (el que repite, el que egresa). Cada curso de origen con alumnos activos exige una decisión antes de confirmar.
4. **Revisión:** resumen ("68 alumnos pasan, 5 egresan, 2 no continúan; 14 cursos copiados") y confirmar.
5. **Cierre (opcional):** casillas "activar el ciclo nuevo" y "bloquear el ciclo viejo". Si se eligen, en la misma transacción se activa el destino y después se bloquea el origen (así se respeta que no se bloquea el activo).

**Reglas** (decisiones del diseñador salvo indicación):
- Origen y destino deben ser distintos y ninguno puede estar bloqueado (el usuario aprobó "no se puede pasar de año con un ciclo bloqueado como origen o destino").
- **Quiénes entran:** alumnos con `Estado = activo` que tienen inscripción en un curso del ciclo de origen.
- **Pasan:** se crea su `Inscripcion` en el destino (curso elegido, fecha de hoy, marca de descuento actual) y su curso actual (`Alumno.cursoId`) pasa a ser el nuevo. La inscripción vieja queda intacta como historial.
- **Egresan:** `estado = egresado`, sin curso nuevo. **No continúan:** `estado = inactivo`, sin curso nuevo. Esos cambios de estado reutilizan el recálculo del descuento por hermanos; para una operación masiva **no se generan avisos de descuento** (decisión del diseñador, igual que la revisión única del descuento) pero sí las señales normales para que las pantallas se actualicen.
- **Repetible:** un alumno ya inscripto en el destino se saltea; un curso ya copiado se reutiliza.
- **No toca cuotas:** las del ciclo nuevo las genera la tarea mensual de siempre (solo si el año del ciclo activo coincide con el año actual).
- **Plazo:** la transacción debe admitir ~150 alumnos (el timeout de `PrismaUnitOfWork` es de 20 s); si hiciera falta se ajusta de forma acotada.
- Cada cambio se anuncia como las demás escrituras (`datos.cambiaron`), dentro de la transacción.

## Cuándo se corre el asistente (decisión del usuario: opción A, con aviso)

- **Siempre a mano:** el administrador abre "Pasar de año" cuando termina el año. El sistema nunca lo corre solo, ni por fecha ni al bloquear un ciclo (bloquear no puede ser el disparador: el asistente rechaza un origen bloqueado). El último paso del asistente (activar el ciclo nuevo y bloquear el viejo) es el "cierre del año": una sola acción guiada.
- **Aviso en la campana (solo administrador):** tipo de aviso **de estado** nuevo, `ciclo_por_cerrar`: "El ciclo 2026 terminó. Falta pasar de año: pasá a los alumnos y activá el ciclo nuevo." Lleva a la pantalla del asistente. Reglas (decisiones del diseñador):
  - Aparece cuando la fecha de hoy (hora de Argentina, `core/fechas.ts`) es el **1 de diciembre o posterior del año del ciclo activo** y ese ciclo sigue siendo el activo y no está bloqueado. El año lectivo va de marzo a noviembre.
  - Se resuelve solo cuando deja de cumplirse: se activa otro ciclo (con el último paso del asistente o a mano) o el ciclo se bloquea.
  - Se sincroniza con la revisión diaria de las 03:00 y con los anuncios de activar y bloquear un ciclo, igual que los demás avisos de estado; tiene preferencia apagable en "Mi cuenta".
  - Requiere sumar el valor al enum `TipoNotificacion` (migración, con respaldo previo) y al catálogo `notificacion.tipos.ts`. El aviso guarda el recurso (el ciclo), nunca una dirección: el client arma la ruta.

## Lista de alumnos de un curso: sale de las inscripciones (decisión del usuario: opción B)

Hoy la nómina de un curso se arma con `Alumno.cursoId` (el curso actual), así que al pasar de año los cursos viejos quedarían vacíos. **Se cambia para que salga de las inscripciones**: la nómina de un curso son los alumnos con una `Inscripcion` en ese curso. Un curso de 2025 sigue mostrando para siempre a quienes cursaron en él; pasar de año solo agrega una inscripción nueva.

- El cambio se concentra en `PrismaAlumnoRepository.findByCursoId`, que es el único lugar que arma la nómina; también lo usa la validación de nómina al cargar notas (`CalificacionService`), que queda alineada.
- `Alumno.cursoId` sigue existiendo como "curso actual" (el legajo y el panel del responsable); este cambio no lo elimina.
- Antes de construir, una consulta de **solo lectura** sobre los datos reales lista los alumnos con curso actual sin inscripción en ese curso (caso conocido: Valentino Rodríguez, que dejaría de aparecer en la lista de su curso hasta corregirlo). No se corrige nada sin autorización del usuario.

## Decisiones del diseñador (para que el usuario las revise)

Surgieron de la revisión del documento por un constructor; ninguna cambia lo que el usuario decidió:

1. **Cuándo correr el asistente:** a fin de año. Con la lista de cada curso saliendo de las inscripciones, correrlo antes no vacía ningún curso; lo que cambia de inmediato es el curso actual que muestran el legajo y el panel del responsable. Si el año de origen no terminó, el paso de revisión lo avisa.
2. **A qué inscripción sigue el asistente:** la del ciclo de origen. Si `Alumno.cursoId` no coincide con esa inscripción, la vista previa lo muestra como aviso sin bloquear. Un alumno ya inscripto en el destino con otro curso se saltea y se muestra como "ya inscripto en {curso}".
3. **Cuota de un año sin ciclo:** si el año de la cuota no tiene `Ciclo`, la escritura se permite (`Ciclo.anio` es único, no hay ambigüedad).
4. **Baja o reactivación de un alumno cuyo curso actual es de un ciclo bloqueado:** se permite (el estado es dato de la persona). La verificación aplica al ciclo del curso de destino y a la inscripción del ciclo activo, no al curso anterior.
5. **Curso del mismo nombre ya existente en el destino:** se reutiliza tal cual, sin sobrescribirlo.
6. **Curso con alumnos activos sin decisión:** el servidor rechaza la confirmación (400) listando los cursos. Los que egresan o no continúan conservan en `Alumno.cursoId` su último curso (no se pone en null).

## Datos existentes

La base real tiene hoy el ciclo 2027 activo sin cursos y el caso de Valentino Rodríguez (inscripción 2027 en un curso de 2025). **El diseño no los corrige solo**: se arreglan con las propias herramientas nuevas (activar el ciclo que corresponda, pasar a los alumnos con el asistente) y con autorización explícita del usuario sobre datos reales. Nunca se bloquea ningún ciclo real durante la implementación ni las pruebas; las pruebas usan ciclos de prueba (año 2099, como ya hacen otras) y los limpian.

## Restricciones

- Arquitectura feature-first: la función de entrada y el asistente viven en `modules/ciclos/`; `core/` no recibe lógica de negocio. Todo cambio con `tx` pasado a cada llamada y anuncios dentro de la transacción.
- Server y client no comparten código; las reglas que se repiten se escriben dos veces con los mismos nombres y se prueban con la misma tabla.
- Migración de la columna `Ciclo.bloqueado` con respaldo `pg_dump -Fc` previo en `~/respaldos-babylon/`.
- Los scripts de datos de prueba y de importación que escriban en un ciclo bloqueado quedan frenados (hay que desbloquear antes): es lo buscado.
- Toda la batería en verde antes de fusionar; nunca fusionar ni subir sin pedido explícito.

## Enfoques considerados

**Cómo hacer cumplir el bloqueo.**
- **A (elegida por el usuario):** una única función de entrada que cada escritura llama, más la prueba de la batería que recorre todas las rutas. Encaja con el estilo del proyecto (reglas en los services, errores claros); su riesgo es una operación nueva sin la llamada, que la prueba detecta.
- **B:** candado en la base de datos (triggers que rechazan la escritura, con el error traducido a un mensaje claro). Garantía más fuerte y sin posibilidad de olvido, pero la regla queda fuera del código y el proyecto no usa ninguna otra pieza así. Se puede sumar después como red de seguridad sin deshacer la A.
- **Automática en la conexión de Prisma:** una sola revisión que intercepta toda escritura sobre las tablas de ciclo. En código y sin olvidos posibles, pero más técnica (resolver el ciclo de cada registro por cadenas de relaciones, consultas extra por escritura) y sin cubrir consultas directas.

**Cómo se decide el curso siguiente de cada alumno.**
- **A (elegida por el usuario):** asistente guiado con vista previa y excepciones por alumno.
- **B:** regla fija automática por nivel (descartada: los cursos reales tienen nombres libres y la regla colocaría alumnos mal sin avisar).
- **C:** solo copiar cursos y seguir reinscribiendo uno por uno (no resuelve el problema).

**Cuándo se corre el asistente.**
- **A (elegida por el usuario):** manual, con un aviso en la campana al terminar el año.
- **B:** disparado al bloquear el ciclo (descartada: se contradice con que el origen no puede estar bloqueado; invertido es igual a la A).
- **C:** automático por fecha (descartada: las decisiones por curso y por alumno son de una persona).

## Partes que quedan al implementador

- Nombres de funciones, archivos, rutas y clases de error; el código HTTP exacto del rechazo (409 propuesto).
- Estructura exacta de los dos pedidos del asistente y de la vista previa.
- Dónde vive el asistente en la pantalla (sugerencia: una pantalla propia accesible desde Configuración → Ciclos).
- Qué pantallas muestran cartel o deshabilitan botones ante un ciclo bloqueado, más allá del mensaje del servidor.
- Cómo se arma la lista de rutas de escritura que recorre la prueba de la batería (derivarla del router o mantener una tabla que otra prueba compare contra las rutas reales).
- Ajustes puntuales de transacción y de rendimiento del asistente.
