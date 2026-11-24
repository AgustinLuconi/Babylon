# Clase sin dictar ("sin clases" por curso y día) — diseño

## Para qué
Hoy, si una clase no se da por un imprevisto (el profesor no puede ir, un corte de luz, etc.), el sistema no tiene cómo decirlo: queda un día sin asistencia que parece un olvido, el aviso "falta tomar asistencia" salta, y no hay forma de aclarar que no fue culpa de nadie. El pedido: al registrar la asistencia de una clase, el profesor puede marcar **"sin clases"**. Ese día **no cuenta como falta ni como presente** para ningún alumno, no afecta los porcentajes ni las rachas de faltas, y la clase queda registrada como **no dada**. La **familia lo ve** en el calendario de asistencia de su hijo **sin el motivo** (el motivo es solo para el equipo del instituto).

## Metas
- El profesor del curso marca una clase como "sin clases" desde la pantalla de asistencia, con un motivo opcional, y puede quitar la marca.
- Esa clase no suma asistencia ni faltas a nadie: ni en los porcentajes (reportes y paneles), ni en la racha de faltas seguidas de las automatizaciones.
- No se puede tomar asistencia de un día marcado, ni marcar un día que ya tiene asistencia guardada (nunca se esconden datos).
- El aviso "falta tomar asistencia" no aparece para una clase marcada.
- Los calendarios muestran el día como "Sin clases": el profesor, el legajo (administración y secretaría, con el motivo) y la familia (sin motivo).

## No metas
- Una marca por alumno (la clase no se dio para todo el curso o no se dio).
- Reemplazar las pausas del calendario del ciclo (feriados y receso: las carga el administrador por adelantado y valen para todo el instituto; esto es de un solo curso y suele ser un imprevisto del momento).
- Avisar a las familias con una notificación (solo lo ven en el calendario), recuperar la clase, o que afecte las cuotas.
- Que lo marque administración o secretaría (solo el profesor del curso, como la asistencia).

## Anti-metas
- Que un día marcado cambie un porcentaje, una racha o una alerta ya existente: los reportes y la racha cuentan filas de asistencia y esta marca no es una fila de asistencia.
- Que la familia vea el motivo.

## Enfoques considerados
- **A (elegido): un registro propio por curso y día** (`ClaseSinDictar`). Es un hecho de la clase, no de cada alumno: no cuenta en nada de lo que hoy cuenta asistencia, sin tocar esas cuentas, y un alumno inscripto después no queda con un hueco.
- **B (descartado): un estado nuevo `sin_clases` en cada fila de asistencia.** Habría que excluirlo en cada lugar que cuenta (reportes, panel de la familia, racha, legajo) y rellenar a mano a los alumnos que se inscriben después; un olvido en un solo lugar lo cuenta como falta o como presente.

## Diseño

### Datos
- Entidad secundaria `ClaseSinDictar` en el módulo `asistencia/` (sin repositorio propio: métodos extra de `AsistenciaRepository`): `id`, `cursoId` (FK RESTRICT), `fecha` (día calendario, medianoche UTC como `Asistencia.fecha`), `motivo` (opcional, hasta 200 caracteres), `registradaPor` (id de la cuenta, sin FK como `Pago.registradoPor`) y `creadaEn`. `@@unique([cursoId, fecha])`. Una migración, con respaldo `pg_dump -Fc` antes.

### Reglas (en `AsistenciaService`, dentro de una transacción, con el ciclo del curso verificado y abierto)
- **Marcar** (`marcarSinClases(cursoId, fecha, motivo, profesorId)`): solo el profesor dueño del curso; la fecha no puede ser futura (misma regla que la asistencia); tiene que ser un día con clases del calendario del ciclo del curso (en un feriado o pausa ya se sabe que no hay clases); si ya hay asistencia guardada de ese curso ese día, 409 "Ese día ya tiene asistencia guardada: no se puede marcar como sin clases"; si ya estaba marcado, solo actualiza el motivo.
- **Quitar** (`quitarSinClases(cursoId, fecha, profesorId)`): solo el profesor dueño; si no estaba marcado, no hace nada.
- **Tomar asistencia** (`registrarAsistenciaMasiva`): si el día está marcado, 409 "Esa clase está marcada como sin clases: quitá la marca para tomar asistencia".
- Ambas escrituras publican, dentro de la transacción, `asistencia.registrada` (para que se revisen los avisos) y `datos.cambiaron` (dato `asistencia`, acción `sin-clases`, con los ids del curso y de sus alumnos para que las pantallas de las familias se actualicen solas, recortados como el resto).

### Lecturas (el motivo solo para el equipo)
- `GET /api/asistencia/cursos/:cursoId/sin-clases` (admin, secretario, profesor dueño del curso): `{ fecha, motivo }[]`.
- `GET /api/asistencia/alumnos/:alumnoId/sin-clases` (admin, secretario, profesor y padre solo de su propio hijo, igual que `…/alumnos/:alumnoId`): `{ cursoId, fecha, motivo? }[]` de los cursos en los que el alumno está o estuvo inscripto; **a la familia el servidor no le manda el motivo** (se quita en el service, no en la pantalla).

### Efectos
- **Avisos:** el criterio de `asistencia_pendiente` (`notificacion.criterios.prisma.ts`) saltea las clases marcadas.
- **Racha, reportes, paneles:** no cambian (no hay filas de asistencia ese día).
- **Ciclo bloqueado:** las dos escrituras nuevas se rechazan como el resto de la asistencia (se clasifican en `_ciclo-bloqueado.ts`).

### Pantallas
- **Asistencia del profesor:** en una clase sin asistencia guardada, botón "Marcar sin clases" (un modal con el motivo opcional); una clase marcada muestra "Clase sin dar" con su motivo, el botón "Quitar marca", y no se puede guardar asistencia; en la lista de clases, la marcada se distingue como "Sin clases".
- **`AttendanceCalendar`** (legajo y panel de la familia): recibe también los días sin clases y los dibuja como "Sin clases" con su leyenda; en el legajo el detalle muestra el motivo, en el panel de la familia nunca. La lista de días del panel de la familia suma filas "Sin clases".

### Pruebas
- Con base de datos (`server/scripts/_asistencia-sin-clases.ts`): marcar y quitar; no se puede marcar con asistencia guardada ni tomar asistencia en un día marcado; solo el profesor dueño (otro profesor 403); no se puede marcar un día futuro ni uno sin clases del calendario; tres faltas con una clase marcada en el medio siguen siendo una racha de tres; el porcentaje de asistencia no cambia; el aviso de asistencia pendiente la saltea; la familia recibe la lista **sin motivo** y solo de su hijo (otro hijo 403); el ciclo bloqueado rechaza ambas escrituras (más las dos rutas nuevas en `_ciclo-bloqueado.ts`).
- Recorrido de navegador: el profesor marca y quita desde la pantalla; la familia ve "Sin clases" en el calendario sin el motivo; el legajo lo muestra con el motivo.
- Se actualizan la batería, `pruebas/README.md` y el CLAUDE.md.

## Lo que queda al implementador
Nombres exactos de archivos, componentes y textos de ayuda siguiendo las convenciones del proyecto; cómo calcular los alumnos destinatarios de la señal en vivo reusando lo que ya hace `cambio.destinatarios.prisma.ts` para la asistencia.

## Decisiones mías para revisar
- Solo el profesor del curso marca y quita (no administración ni secretaría).
- Un día con asistencia ya guardada no se puede marcar (primero habría que borrar esa asistencia, que hoy no se puede: queda como está); un día marcado no admite asistencia hasta quitar la marca.
- Motivo opcional, hasta 200 caracteres.
- La familia ve "Sin clases" en el calendario y en la lista de días, sin motivo y sin notificación.
