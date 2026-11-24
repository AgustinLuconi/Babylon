# Calendario del ciclo lectivo y día de vencimiento — diseño

## Para qué
Hoy el sistema no sabe cuándo hay clases. Las cuotas usan "marzo a noviembre" escrito en el código y la asistencia se puede guardar en cualquier fecha no futura (también en enero, en un feriado o en el receso de invierno). El pedido del usuario (a partir de lo que dijo el cliente): que el administrador cargue **cuándo empieza y termina cada ciclo, y sus pausas** (receso de invierno y feriados), y que el sistema use ese calendario para las cuotas y la asistencia. Además, que el **día de vencimiento de las cuotas** se pueda elegir en "Cuota mensual" en vez de estar fijo en el día 10.

Es una prueba: el usuario dijo "probemos, si no me gusta lo cambio". Conviene que sea simple de quitar o ajustar.

## Metas
- Un administrador carga por ciclo: inicio, fin y una lista de pausas (rango de fechas con nombre; un feriado es una pausa de un solo día).
- Fuera del ciclo o dentro de una pausa no se guarda asistencia (el servidor rechaza con un mensaje claro) y la pantalla del profesor lo avisa.
- Las cuotas se generan en los meses del ciclo que tienen **al menos un día de clases**. Una pausa no anula un mes: **julio se cobra completo aunque haya receso** (decisión del usuario).
- El aviso "asistencia sin tomar" usa el calendario real (hoy usa marzo a noviembre).
- "Día de vencimiento" editable en Configuración → Cuota mensual (1 a 28, por defecto 10).

## No metas
- Traer feriados automáticamente de un servicio externo (se puede sumar después como un botón "Cargar feriados nacionales").
- Calendario distinto por curso, días de la semana con clase (los horarios de cada curso ya existen y no se tocan), clases de recuperación en feriado, cuotas proporcionales.
- Cambiar cuotas ya generadas: el vencimiento y el calendario rigen para lo que se genere después, igual que hoy el valor de la cuota.

## Anti-metas
- Que algo cambie sin que el administrador cargue nada: los ciclos existentes quedan con el calendario de hoy (1 de marzo al 30 de noviembre, sin pausas) y el día de vencimiento en 10. Hasta que se cargue algo, el sistema se comporta igual que ahora.

## Enfoques considerados
- **A (elegido): pausas cargadas a mano**, una lista por ciclo. Simple, bajo control del administrador, sin dependencias externas.
- **B: feriados desde un servicio externo.** Ahorra carga pero agrega una dependencia, y los feriados puente cambian por decreto. Queda como mejora posterior.
- Para el vencimiento: un campo global en `Configuracion` (elegido; hoy el valor de la cuota ya es global) frente a uno por ciclo (descartado: el instituto cobra igual todo el año y la pantalla "Cuota mensual" ya es global).

## Diseño

### Datos
- `Ciclo` suma `inicio` y `fin` (fechas calendario, medianoche UTC como el resto), obligatorios. Ambos deben caer dentro del año del ciclo y `inicio <= fin`. Migración: los ciclos existentes reciben `1/3/<año>` y `30/11/<año>`. Los ciclos nuevos (crear ciclo, pase de año) nacen con ese mismo valor por defecto y se editan después.
- Nueva entidad secundaria `PausaDelCiclo` (módulo `ciclos/`, sin repositorio propio: se gestiona con métodos extra de `CicloRepository`): `id`, `cicloId` (FK, RESTRICT), `desde`, `hasta`, `nombre`, `tipo` (`receso` | `feriado` | `otro`). Reglas: dentro de `[inicio, fin]` del ciclo, `desde <= hasta`, sin superponerse con otra pausa del mismo ciclo, nombre de hasta 80 caracteres.
- `Configuracion` suma `diaVencimiento Int @default(10)`, de 1 a 28.
- Una migración, con respaldo `pg_dump -Fc` previo. Si cambia `inicio`/`fin` y una pausa queda afuera, el cambio se rechaza con un mensaje que nombra la pausa.

### Reglas puras (`ciclos/ciclo.calendario.ts`, con tabla de casos en `server/tests/`)
- `motivoSinClases(fecha, ciclo)`: `null` si hay clases; si no, "Fuera del ciclo lectivo" o el nombre de la pausa.
- `esMesLectivo(mes, ciclo)`: existe al menos un día de `[inicio, fin]` en ese mes que no esté dentro de una pausa. Reemplaza al `esMesLectivo(mes)` fijo de `cuotas/cuota.calendario.ts` (que se elimina junto con `MES_INICIO_CICLO` y `MES_FIN_CICLO`).
- `vencimientoDelMes(mes, anio, hoy, diaVencimiento)`: la regla actual con el día como parámetro (si se genera después de ese día en su propio mes, vence el último día del mes).
- El client tiene una copia (`features/ciclos/calendario.ts`) probada con la misma tabla, como el resto de las reglas duplicadas.

### Efectos
- **Asistencia** (`AsistenciaService.registrarAsistenciaMasiva`): dentro de la transacción, después de verificar que el ciclo del curso esté abierto, valida la fecha con `motivoSinClases`; si no hay clases, `ValidationError` (400) "Ese día no hay clases: <motivo>". Lo ya guardado antes no se toca.
- **Cuotas** (`CuotaService.contextoDeGeneracion`): lee primero el ciclo activo (se mantiene "su año es el actual y no está bloqueado"), después `esMesLectivo(mes, ciclo)` y el `diaVencimiento` de la configuración.
- **Avisos**: `asistencia_pendiente` usa `motivoSinClases` del ciclo activo en lugar de `esMesLectivo(mes)`. `ciclo_por_cerrar` aparece al pasar la fecha de **fin** del ciclo activo (antes, el 1 de diciembre), y la advertencia del asistente "Pasar de año" usa la misma fecha. Con el calendario por defecto el comportamiento es el mismo.
- **Ciclo bloqueado**: editar fechas y pausas es una escritura de lo que le pertenece al ciclo, así que se rechaza (usa `verificarCicloAbierto`). Se clasifica en `_ciclo-bloqueado.ts` como ruta rechazada.

### API (solo `admin`; lectura para quien ya lee ciclos)
- `GET /api/ciclos` pasa a devolver `inicio`, `fin` y `pausas[]` de cada ciclo (el profesor lo necesita para la pantalla de asistencia).
- `PATCH /api/ciclos/:id/fechas` `{ inicio, fin }`, `POST /api/ciclos/:id/pausas`, `PATCH` y `DELETE /api/ciclos/:id/pausas/:pausaId`. Cada escritura toma el bloqueo del ciclo, publica `datos.cambiaron` (dato `ciclos`) dentro de la transacción y refresca en vivo las pantallas abiertas.
- `PATCH /api/configuracion` acepta `diaVencimiento` (solo admin, entero 1–28, mismas reglas que `valorCuota`).

### Pantallas
- **Configuración → apartado nuevo "Inicio y fin de cada ciclo lectivo"**: una tarjeta por ciclo con inicio/fin editables y su lista de pausas (agregar, editar, borrar; un ciclo bloqueado se muestra en solo lectura).
- **Configuración → "Cuota mensual"**: campo "Día de vencimiento", con el texto de ayuda actualizado (hoy dice "vence el día 10").
- **Asistencia del profesor**: si la fecha elegida no tiene clases, un aviso con el motivo y el botón de guardar deshabilitado.
- Los formularios usan la protección de cambios sin guardar y el aviso "mientras editabas, X cambió" como el resto.

### Pruebas
- Pura: tabla de casos de `motivoSinClases`, `esMesLectivo` (incluye mes con inicio a mitad, mes totalmente dentro de una pausa y julio con receso) y `vencimientoDelMes` con día configurable; copia del client contra la misma tabla.
- Con base de datos (`server/scripts/_*.ts`): asistencia rechazada en feriado, en receso y fuera del ciclo; cuota de julio generada con receso; cuota no generada en enero; vencimiento con otro día; pausa fuera del ciclo rechazada; ciclo bloqueado rechaza editar fechas y pausas; la migración deja los ciclos existentes con el calendario de hoy.
- Recorrido de navegador del apartado nuevo y del campo de vencimiento. Se actualizan la batería, `pruebas/README.md` y el CLAUDE.md.

## Lo que queda al implementador
Nombres exactos de archivos y componentes siguiendo las convenciones del proyecto, y el orden de bloqueos al combinar la edición del ciclo con la generación de cuotas y el cambio de ciclo activo.

## Decisiones mías para revisar
- Pausas sin superposición; todo dentro del año del ciclo.
- Un mes sin ningún día de clases (por ejemplo, una pausa que lo cubre entero) no genera cuota; por lo demás, una pausa nunca anula un mes.
- `ciclo_por_cerrar` y la advertencia del asistente pasan a usar la fecha de fin del ciclo.
- El servidor rechaza la asistencia en días sin clases (no solo avisa), porque ese era el problema planteado; si resulta incómodo, se afloja a un aviso.
