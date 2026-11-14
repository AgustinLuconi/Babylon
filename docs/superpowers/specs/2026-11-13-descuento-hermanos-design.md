# Descuento por hermanos que se recalcula — diseño

Fecha: 2026-11-13. Estado: borrador para revisión del usuario.

## Por qué

Hoy el descuento del 10% por hermanos se calcula **una sola vez**, al inscribir (`AlumnoService.inscribirAlumno`: si el responsable ya tiene al menos un alumno activo, el nuevo lo recibe) y queda guardado en `Alumno.aplicaDescuentoHermanos` (y copiado en `Inscripcion.aplicaDescuentoHermanos`). Después nada lo corrige. Casos que hoy quedan mal:

- Dos hermanos, uno se da de baja: el que queda sigue con descuento aunque ya no tiene hermano activo.
- El primero se da de baja y vuelve: el segundo nunca recupera/pierde nada según corresponda.
- Se cambia el responsable de un alumno (`asignarResponsable`, `PUT /api/alumnos/:id/responsable`): el descuento ya calculado se queda con el alumno, aunque cambió de familia.
- Si el primer hermano se da de baja, el siguiente debería pasar a pagar completo, y hoy nada lo corrige.
- Un adulto responsable de sí mismo (`vinculoResponsable = "propio"`) que estudia solo no debe tener descuento; si estudia con un hijo del que es responsable, sí (dos alumnos de la misma ficha).

## Objetivo

El descuento por hermanos siempre refleja la situación actual de cada familia. Cuando cambia, rige para las cuotas que se generen **a partir de ese momento** (las ya generadas no se tocan) y las personas involucradas se enteran.

## Regla única

Entre los alumnos **activos** (`estado = "activo"`) de un mismo responsable (`Alumno.padreId`), paga completo el que tiene la `fechaInscripcion` más antigua (desempate por `id`, decisión del diseñador: solo para que sea determinista) y todos los demás tienen 10% de descuento. Con un solo alumno activo: sin descuento. Los alumnos `inactivo` o `egresado` no cuentan ni reciben el descuento.

Efecto: siempre paga completo exactamente un hermano activo; el orden depende de la inscripción, no de quién se fue o volvió. Si el primero se da de baja, el siguiente pasa a ser el primero (paga completo). Si el primero vuelve, recupera su lugar y el que estaba pasa a tener descuento.

Es una **función pura** (lista de alumnos del responsable → conjunto de ids con descuento), sin Prisma ni Express, en el módulo de alumnos, con tabla de casos en `server/tests/`.

## Cuándo se recalcula

Cada vez que cambia la composición activa de una familia, dentro de **la misma transacción** que el cambio:

1. **Baja** de un alumno (`actualizarAlumno` con `estado` de `activo` a otro valor).
2. **Reactivación** (`estado` de otro valor a `activo`).
3. **Cambio de responsable** (`asignarResponsable`, también pasar a o dejar de ser `propio`): se recalculan **las dos familias**, la que deja al alumno y la que lo recibe.
4. **Inscripción** (`inscribirAlumno`): se reemplaza la regla propia de hoy por la regla única, así hay un solo criterio. Una inscripción nueva puede cambiar el descuento de otro alumno de la familia solo si el nuevo es más antiguo que los demás, lo que no ocurre porque su fecha es la más reciente; igual se llama al mismo cálculo para no tener dos caminos.

Concurrencia: se respeta el orden de bloqueos ya establecido (cuenta → alumno → ficha de responsable). Cuando el recálculo toca dos fichas se bloquean en orden de `id` para que dos operaciones simultáneas no se traben entre sí.

## Qué pasa con las cuotas

**Decisión del usuario (2026-11-13): las cuotas ya generadas no cambian nunca**, ni pendientes, ni vencidas, ni pagadas. El descuento nuevo (o su ausencia) rige solo para las cuotas que se generen después del cambio. Esto reemplaza una decisión anterior de la conversación (corregir las pendientes).

- La generación mensual (`CuotaService.nuevaCuota`, la cuota inicial y la tarea de las 03:00) ya lee `Alumno.aplicaDescuentoHermanos`, que queda al día; no hay cambios de código en cuotas. Ejemplo: si Ana se da de baja con la cuota de noviembre de Bruno ya generada con descuento, esa cuota queda con descuento; la de diciembre nace completa.
- Consecuencia a tener presente: el cambio se nota en las cuotas del mes siguiente (o las que no estén generadas todavía), no en la del mes en curso.
- No hay reajuste de montos, ni método nuevo en `CuotaService`/`CuotaRepository`, ni riesgo de pisar un cobro simultáneo.

## Qué se guarda

- `Alumno.aplicaDescuentoHermanos` se actualiza para cada alumno de las familias afectadas.
- `Inscripcion.aplicaDescuentoHermanos` del **ciclo activo** se actualiza igual (decisión del diseñador: las inscripciones de ciclos anteriores son historia y no se tocan).
- Se usa `actualizarParcial` (solo el campo que cambia), como el resto de las ediciones.

## Avisos

Cuando el descuento de un alumno **cambia por una de las causas de arriba** (no por la revisión única, ver más abajo) se anuncia dentro de la transacción (patrón `anuncios.publicar(...)`) y se generan avisos de **evento** (una vez por clave; la clave incluye el momento del cambio para que un cambio posterior vuelva a avisar):

- **Administración y secretaría:** "Bruno Pérez pasó a pagar la cuota completa porque Ana Pérez se dio de baja" (o la causa que corresponda: reactivación, cambio de responsable).
- **Responsable de esa familia, si tiene cuenta activa** (rol `padre`): mismo contenido pero, por la regla de privacidad entre familias, **nunca nombra a un alumno que no es de esa familia**: si la causa es un hermano que cambió de responsable, el texto dice "ya no tiene hermanos activos a tu cargo". Una ficha sin cuenta no recibe aviso.
- Los tipos nuevos van al catálogo (`notificacion.tipos.ts`), uno por grupo (staff y padre), con preferencia apagable como los demás. Cada aviso guarda el recurso (el alumno), nunca una dirección.
- Además, `datos.cambiaron` de `alumnos` se publica como siempre para que las pantallas se actualicen solas (los ids del responsable viejo y del nuevo, para las dos familias). Las cuotas no cambian, así que no hay señal de `cuotas`.
- El texto del aviso aclara cuándo se nota: "…desde la próxima cuota que se genere" (decisión del diseñador, para que nadie espere ver cambiar la cuota ya emitida).

## Qué se ve

En el legajo del alumno (admin/secretario): "Descuento por hermanos: sí/no" y, si es sí, con qué alumno se comparte (el que paga completo). Sin historial más allá de los avisos. (Decisión del diseñador: el padre no tiene esta línea; se entera por el aviso y por el monto de la cuota.)

## Lo que ya existe: revisión única

Un script `server/scripts/revisar-descuentos-hermanos.ts` en dos pasos:

1. `mostrar`: solo lista, sin modificar nada, qué cambiaría ("Bruno Pérez: pasa de 10% a completo"; solo cambia la marca del alumno, no hay cuotas que corregir).
2. `aplicar`: ejecuta esos cambios. **Solo se corre cuando el usuario lo autoriza después de leer la lista y con un respaldo `pg_dump -Fc` previo en `~/respaldos-babylon/`.** Aplica la misma regla única, solo sobre la marca del alumno (y la de su inscripción del ciclo activo); no toca ninguna cuota. No genera avisos (es una corrección masiva, no un evento que le pase a una familia; decisión del diseñador).

Nunca se ejecuta `aplicar` en ninguna prueba ni durante la implementación: las pruebas usan datos `prueba-tmp-*` y la base real no se toca. El usuario decide cuándo correrlo.

## Fuera de alcance

- Valores de descuento distintos del 10% o por curso/nivel.
- Historial detallado de por qué un alumno tuvo o dejó de tener el descuento (solo los avisos).
- Recalcular o corregir **cualquier cuota ya generada** (pendiente, vencida o pagada).
- Texto legal de autorización de imagen para adultos (pendiente aparte).
- Unificar fichas de responsable duplicadas.

## Decisiones del diseñador (a confirmar por el usuario al leer)

Surgieron de la revisión del documento; ninguna cambia lo que el usuario decidió, solo cierran huecos:

1. **Población:** "alumno activo" a secas (`Alumno.estado = "activo"`), igual que la regla de hoy en `inscribirAlumno`; no se exige estar inscripto en el ciclo activo.
2. **Orden de antigüedad:** se usa `Alumno.fechaInscripcion`, que no cambia al dar de baja ni al reactivar (por eso quien vuelve recupera su lugar).
3. **`Inscripcion` del ciclo activo:** si el alumno no tiene fila ahí, se omite en silencio (no se crea ni falla); lo que manda es `Alumno.aplicaDescuentoHermanos`.
4. **Cuotas:** ver "Qué pasa con las cuotas": ninguna cuota ya generada cambia, para nadie (decisión posterior del usuario). Un alumno reactivado también ve recalculada su marca y la usan las cuotas que se generen desde ahí.
5. **Avisos:** uno por **alumno cuyo descuento cambia** (no agrupado por familia). Al responsable se le avisa por los alumnos que son de su familia en ese momento. En un cambio de responsable, la familia que recibe al alumno ve "<alumno> ahora tiene descuento por hermanos" o "ahora paga la cuota completa", y la que lo deja ve el aviso solo por sus alumnos que cambian, sin nombrar al que se fue.
6. **Adulto `propio` con hijo:** recibe un aviso por cada alumno suyo cuyo descuento cambia; el texto usa el nombre del alumno aunque sea él mismo.
7. **Cobro simultáneo:** deja de ser un tema, porque ningún monto de cuota ya generada cambia.

## Partes que quedan al implementador

- Nombres de las funciones y archivos (sugerencia: `alumno.hermanos.ts` con `alumnosConDescuento(alumnos)`; `AlumnoService.recalcularDescuentoDeFamilia(padreId, tx, causa)`).
- Nombres y textos exactos de los tipos de aviso, respetando lo de arriba.
- Cómo se recoge "con quién se comparte" para el legajo (campo calculado en el listado o endpoint propio).
- La prueba de punta a punta con la batería existente (`server/scripts/_*.ts` y un recorrido de navegador).
