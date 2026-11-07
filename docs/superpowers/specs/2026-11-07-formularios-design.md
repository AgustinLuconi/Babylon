# Formularios: datos incompletos, edición parcial y validación — Diseño (subproyecto 3d)

**Fecha:** 2026-11-07 · **Subproyecto 3, etapa 3d** (3a: avisos guardados y en tiempo real ✔ · 3b: chat en vivo ✔ · 3c: pantallas al día ✔ · 3d: este · después: editar y borrar mensajes del chat · tanda 2 de filtros en la dirección · sesiones separadas en la misma compu · 4: autenticación en dos pasos)

## Por qué

Hoy el sistema pide todo de golpe y controla poco:

- **Exige todo para empezar.** Para inscribir a un alumno hay que tener su DNI, su fecha de nacimiento y un padre con DNI y email. Los datos del instituto llegan de todos lados (una ficha en papel, un llamado, un WhatsApp) y casi siempre falta algo. O no se carga a nadie, o se carga basura para poder avanzar.
- **Deja pasar datos inválidos.** El servidor acepta un nombre de puros espacios, un DNI con letras, un teléfono que dice "hola", una fecha de nacimiento del año 1800, un horario que termina antes de empezar, textos de cualquier largo.
- **Editar manda la ficha entera.** Dos personas que corrigen campos distintos del mismo alumno se pisan. Y hoy no se puede corregir el DNI de un alumno ni de un padre después de creado.
- **Un alumno adulto no tiene padre.** Los cursos de adultos (B1, B2) y las personas que estudian y además son madre de otro alumno no encajan en un modelo donde todo alumno cuelga de un "padre".

## Qué quiere el usuario (sus palabras y decisiones)

- **Al editar se manda solo lo que cambió.** Al crear se exige lo obligatorio, salvo las reglas que ya permiten saltear campos. La razón: rendimiento y no pisar cambios ajenos.
- **Se puede cargar con datos incompletos y completar después.** "Salen un poco de todos lados, debería estar la posibilidad de completar formularios sin todos los campos, por ejemplo el de un alumno donde haya algún dato faltante que se completa posteriormente."
- **Lo mínimo para inscribir a un alumno:** nombre, apellido, curso y que se pueda asociar a un responsable.
- **Lo mínimo para crear un padre:** nombre, apellido, teléfono y que se asocie a su hijo. El teléfono es obligatorio para que el instituto siempre tenga cómo comunicarse.
- **Aviso de lo incompleto:** una marca en el listado, un filtro "datos incompletos" y un aviso en la campana, como la documentación pendiente.
- **"Mientras editabas, X cambió…":** si otra persona cambia el mismo registro mientras se lo edita, los campos que no se tocaron se actualizan solos y un aviso lo explica. Si cambió el mismo campo que se está editando no se marca ningún conflicto: se guarda lo que escribió quien edita.
- **Revisar la validación de todos los campos.** Que no se acepten datos nulos o inválidos: espacios, DNI, teléfono, fechas, largos máximos, y poder borrar un dato opcional.
- **Solo DNI argentino.** No hay alumnos ni padres con pasaporte u otro documento.
- **Los teléfonos son celulares de WhatsApp.**
- **Los datos viejos no se convierten.** Los datos del 2025 se van a borrar para empezar de cero con una base nueva; eso es una decisión aparte, para cuando el usuario lo diga. Este subproyecto no migra ni arregla datos viejos.
- **Alumnos adultos: responsables de sí mismos, en la misma pantalla del padre.** El adulto entra al mismo panel que los padres y ve su trayectoria. No hay una pantalla aparte: se adaptan los textos.

## Objetivos

1. Se puede inscribir a un alumno y crear a su responsable con lo mínimo; lo que falta se ve y se completa después.
2. Todo campo que se guarda pasó por una validación clara en castellano, igual en la pantalla y en el servidor.
3. Editar guarda únicamente los campos modificados; dos ediciones de campos distintos nunca se pisan.
4. Quien edita se entera, sin perder lo que escribió, de que otra persona cambió el registro.
5. Un alumno adulto puede inscribirse y entrar a su propio panel; una persona puede ser responsable de otro alumno y de sí misma con una sola ficha y una sola cuenta.

## No objetivos

- **Convertir, limpiar o borrar datos existentes.** Los registros viejos se muestran tal como están; borrar el ciclo 2025 es otra decisión.
- **Renombrar `Padre` en el código** (módulo `padres/`, tablas, rol `padre`, rutas). Solo cambian los textos que ve la gente ("Responsable").
- **Un rol nuevo "alumno"**, o cuentas de alumno sin responsable.
- **Documentos que no sean DNI argentino**, teléfonos fijos o extranjeros.
- **Unificar fichas duplicadas** de una misma persona (ver "Limitaciones conocidas").
- **Cambiar contraseñas, cuentas, sesiones o invitaciones**: lo de los subproyectos 1 y 2 sigue igual.
- **Un número de "datos incompletos" en los paneles de administración** (no fue pedido; el aviso de la campana y el filtro alcanzan).

## Diseño

### 1. Qué se acepta en cada campo

Una sola regla por tipo de dato, escrita **dos veces** (server en `core/validacion.ts`, client en `core/lib/validacion.ts`; no se comparte código entre ambos proyectos) y comprobada contra la **misma tabla de casos** en los dos lados, para que no se desalineen.

| Tipo | Regla |
|---|---|
| **Textos** (nombres, direcciones, observaciones, mensajes…) | Se sacan los espacios del principio y del final. Un texto de puros espacios cuenta como vacío: si es obligatorio se rechaza; si es opcional queda "sin dato". |
| **Largos máximos** (mi propuesta) | Nombre y apellido: 60. Dirección: 150. Observaciones médicas y texto de una observación docente: 1000. Mensaje del chat: 2000. Nombre de curso, evaluación o categoría: 80. Aula: 30. Los que ya tienen tope (notas, observaciones de 200) lo conservan. |
| **DNI** | Solo argentino. Se escribe con o sin puntos; se guarda solo con los dígitos; tiene que tener 7 u 8. |
| **Teléfono** | Celular argentino escrito como lo escribe la gente: `351 555-1234`, `0351 15 555 1234`, `+54 9 351 5551234`, `(011) 15-5555-1234`. Se guarda siempre igual, como `+549` seguido de los 10 dígitos (código de área + número); la pantalla lo muestra agrupado y legible. Lo que no puede ser un celular argentino se rechaza con un mensaje que lo explica. Rige para todo teléfono (alumno, responsable, profesor). |
| **Email** | Sin espacios y en minúsculas (como ya pasa con las cuentas), con formato válido. Rige también para el email del alumno, del padre y del profesor. |
| **Fecha de nacimiento** | Una fecha real del calendario; la edad al día de hoy (hora de Argentina) tiene que estar entre 2 y 100 años. |
| **Otras fechas** | Fecha real del calendario siempre. La de una evaluación: entre un año atrás y un año adelante. La de asistencia: no futura. La de un pago: no futura (ya está). *(Si hoy alguna ya se controla, se conserva.)* |
| **Cupo de un curso** | Entero de 1 a 50. |
| **Horarios de un curso** | La hora de fin es posterior a la de inicio, y dos horarios del mismo día no se pisan. |
| **Valor de la cuota** | Se conserva la regla actual (mayor a cero, hasta 10.000.000). |
| **Contraseñas** | Sin cambios. |

**Alcance de la revisión:** todos los esquemas del servidor (`server/src/modules/*/*.schema.ts`) y todos los esquemas y formularios del client. Ningún campo que se guarda queda sin revisar; lo que no figura en esta tabla se revisa con el mismo criterio (recortar, tope de largo, formato). Ningún dato raro puede producir un error 500: siempre un 400 con el campo y el motivo.

### 2. Datos que pueden faltar

Cambios al modelo (todas las columnas nuevas o relajadas admiten vacío para que los datos existentes no se toquen):

- `Alumno.dni`, `Alumno.fechaNacimiento` y `Padre.dni` pasan a admitir vacío. Siguen siendo únicos cuando están (dos fichas sin DNI no chocan).
- **El vínculo pasa del padre al alumno.** Hoy `Padre.vinculo` (madre, padre, tutor) vive en la ficha del padre, pero el vínculo es una relación con cada alumno: la misma persona puede ser madre de uno y "propio" de otro. Nueva columna `Alumno.vinculoResponsable` con los valores `padre`, `madre`, `tutor`, `propio`; se rellena desde el vínculo actual del padre de cada alumno y después se elimina `Padre.vinculo`. Un alumno con responsable siempre tiene vínculo.
- `Alumno.telefono` se conserva como "teléfono del propio alumno" (opcional, mismas reglas). El teléfono de contacto del instituto es el del responsable.
- `Padre.email` y `Padre.telefono` ya admitían vacío; el teléfono sigue siendo obligatorio **al crear** (ver 3), pero los datos existentes pueden no tenerlo.

**Regla de los campos que se pueden borrar:** lo que se puede "completar después" se puede volver a vaciar (DNI, fecha de nacimiento, email, dirección, observaciones, foto, teléfono del alumno, DNI/email/dirección del responsable); vaciarlo lo deja "sin dato" y, si es de los que tiene que haber, el alumno vuelve a figurar como incompleto. Lo obligatorio al crear **no se puede vaciar**: nombre, apellido, curso del alumno, teléfono y vínculo del responsable. *(Mi llamada.)*

### 3. Alta con lo mínimo

**La inscripción es un solo pedido.** Crea, si hace falta, al responsable y al alumno juntos, todo o nada. Hoy el client crea primero al padre y después al alumno; con el DNI opcional, un fallo a mitad de camino y un reintento dejarían fichas de padre repetidas, así que tiene que ser atómico.

**Alumno menor**
- Mínimo: nombre, apellido, curso y un responsable con su vínculo (madre, padre o tutor).
- El responsable puede ser **uno existente** (se busca por nombre, apellido o DNI, como hoy) o **uno nuevo**. Mínimo del nuevo: nombre, apellido y teléfono. Su DNI y su email son opcionales.
- Todo lo demás del alumno (DNI, fecha de nacimiento, dirección, email, teléfono propio, observaciones) es opcional.

**Alumno adulto**
- Se marca "es responsable de sí mismo". Mínimo: nombre, apellido, curso y su celular.
- El sistema crea su ficha de responsable con sus mismos datos (nombre, apellido, DNI, celular, email) y el vínculo `propio`; no se cargan dos veces.
- Si ya existe una ficha de responsable con ese DNI (por ejemplo una mamá que ya figura por su hijo), se **reutiliza** esa ficha en vez de crear otra, y **la ficha existente manda**: la pantalla muestra la ficha encontrada y avisa que se usarán sus datos; el nombre y el apellido del alumno salen de la ficha; el celular o el email que se hayan escrito solo completan lo que la ficha no tenía, nunca pisan lo que ya tiene. *(Mi llamada.)*
- Con un DNI desconocido se crea una ficha nueva. No hay búsqueda automática por nombre: sigue valiendo buscar antes de crear, como hoy (ver "Limitaciones conocidas"). *(Mi llamada.)*
- Si la fecha de nacimiento está cargada y la persona es menor de 18, no puede ser responsable de sí misma. Sin fecha, se permite. *(Mi llamada.)*

**Una persona, un nombre.** Cuando el vínculo es `propio`, el nombre, el apellido y el DNI del alumno y de su ficha de responsable son los mismos: cambiarlos en una ficha los cambia en la otra, dentro de la misma transacción. El celular y el email son del responsable. Una ficha tiene como máximo **un** alumno `propio` (una persona no es alumna dos veces), así que la sincronización es siempre entre dos filas; se toman los bloqueos en un orden fijo (primero el alumno, después la ficha) para que dos cambios simultáneos no se traben entre sí. *(Mi llamada.)*

**Asignar o cambiar el responsable de un alumno ya inscripto.** Desde el legajo se puede asignar un responsable a un alumno que no tiene ninguno, cambiar de responsable y cambiar el vínculo (incluido pasar a `propio` o dejar de serlo). Es el mismo selector de responsable de la inscripción (uno existente, uno nuevo o "es responsable de sí mismo"), con las mismas reglas, y se guarda de forma atómica. Al dejar de ser `propio`, termina la sincronización de nombre, apellido y DNI; la ficha anterior queda como estaba. Sin esto, "responsable" no se podría completar después. *(Mi llamada.)*

**Crear un padre desde Usuarios** pasa a exigir nombre, apellido y teléfono; el email, el DNI y la dirección son opcionales; no se pide vínculo (se define al asociarlo a un alumno). Con email se crea la cuenta como hoy (invitación o contraseña); sin email se crea la ficha sin cuenta, como la del importador. Esa alta, hecha desde Usuarios, puede dejar a un responsable sin ningún alumno todavía, igual que hoy: los alumnos se asocian al inscribir. *(Mi llamada: se conserva el comportamiento actual.)* Profesores, secretarios y administradores siguen exigiendo lo de hoy; el teléfono del profesor sigue siendo opcional y su formato se controla cuando se carga.

**Cuentas en la inscripción.** El pedido único de inscripción trae también el modo de acceso ("¿Cómo accede?": invitación o contraseña) para un responsable nuevo y para un adulto `propio` que tenga email; la invitación sale **después de confirmar**, como en el subproyecto 2, y si el correo falla el alta queda hecha. Un responsable o un adulto sin email no tiene cuenta, y por lo tanto no tiene panel, hasta que se le cargue el email y se lo invite.

**Otros comportamientos que no cambian:** el descuento por hermanos se calcula por responsable (un adulto solo no lo tiene; una mamá que estudia junto a su hijo sí, porque son dos alumnos del mismo responsable); la autorización de imagen la firma el responsable desde su panel (un adulto, la suya); la cuota del mes se genera al inscribir como hoy.

### 4. Datos incompletos

Un criterio único (función pura, en el módulo de alumnos, con el mismo formato que `documento.faltantes.ts`) que, para cada alumno, dice qué le falta:

`dni` · `fechaNacimiento` · `responsable` (no tiene ninguno) · `vinculo` (tiene responsable pero no el vínculo) · `responsableDni` · `responsableTelefono` · `responsableEmail`

No incluye el curso: la población exige una inscripción en el ciclo activo y toda inscripción tiene curso. Cuando el vínculo es `propio`, el DNI se informa una sola vez (como `dni`), no también como `responsableDni`. La población es la misma que la de documentación pendiente: alumno activo e inscripto en el ciclo activo. Lo usan todos los lugares siguientes:

- **Marca** "Datos incompletos" en el listado de alumnos, con el detalle de lo que falta; y un cartel en el legajo que lista lo que falta con acceso directo a editar.
- **Filtro** "Datos incompletos" en el listado de alumnos, en la dirección (`?datos=incompletos`), siguiendo las reglas de filtros en la dirección.
- **Aviso en la campana** para administración y secretaría: tipo de estado nuevo `datos_incompletos`, agrupado ("N alumnos con datos incompletos"), con enlace a la lista ya filtrada. Se resuelve solo cuando no queda ninguno, se actualiza al instante cuando se completa algo, aparece en las preferencias de avisos de Mi cuenta y funciona con la misma maquinaria de sincronización que los demás avisos de estado.
- **No** se avisa nada a las familias por esto.

### 5. Editar: solo lo que cambió

- **En el client:** cada formulario de edición compara lo que muestra con el último valor que conoce del servidor y manda únicamente los campos distintos. Sin cambios, "Guardar" no hace nada y lo dice. Un campo que se vacía se manda como `null`.
- **En el servidor:** el PATCH distingue "no vino" (no se toca) de `null` (se borra, solo en los campos borrables); un `null` en un campo obligatorio es un 400. **Las escrituras tocan solo las columnas recibidas** (hoy hay repositorios que reescriben la fila entera); así dos ediciones de campos distintos nunca se pisan. El DNI de alumnos y padres se vuelve editable; un DNI repetido responde 409 con el mensaje "Ya existe un alumno / responsable con ese DNI".
- **Efecto buscado en los datos viejos:** como solo se manda lo modificado, guardar un cambio en un alumno antiguo no vuelve a validar sus datos viejos que no se tocaron (por ejemplo un teléfono con una letra al final). Las validaciones del client también se aplican **solo a los campos modificados** al editar; al crear, a todos.
- Rige para todos los formularios de edición: legajo del alumno (alumno y responsable), curso, profesor y valor de la cuota.

### 6. "Mientras editabas, X cambió…"

Vale para los mismos formularios de edición. Se apoya en lo del 3c (la consulta del registro ya se vuelve a pedir sola cuando otra persona lo cambia):

- Un campo está **tocado** si lo que hay en el formulario es distinto del último valor del servidor que el formulario conoce; si no, está **sin tocar**.
- Cuando el registro cambia en el servidor por otra persona: los campos **sin tocar** se actualizan solos (con el resaltado breve de siempre); los **tocados** conservan lo que escribió quien edita, sin ningún marcado de conflicto; lo mandado al guardar se compara contra el valor nuevo del servidor.
- Un aviso **fijo dentro del formulario** dice quién y qué: "Mientras editabas, Lucía cambió: teléfono y dirección." Nombra solo los campos que se actualizaron solos. Los nombres de los campos salen de una tabla de etiquetas por formulario; el autor sale de lo que ya registra el 3c.
- Si no hubo ningún campo actualizado (cambió solo algo que quien edita también estaba tocando), no aparece nada.
- **Cómo se sabe qué campos cambiaron:** la señal del 3c trae el dato, los ids y el autor, no los campos; el formulario compara el registro vuelto a pedir contra el último valor del servidor que conocía. Si varias personas cambian cosas en la misma ventana de tiempo, cada vez se compara contra el valor más reciente y el aviso nombra a la última persona que hizo un cambio ajeno sobre ese registro. Si el cambio lo hizo el sistema (sin autor), el aviso dice "el sistema".
- Esto es un mecanismo genérico en `core/` que cada formulario usa; no se programa formulario por formulario.

### 7. El panel del responsable (padres y adultos)

Es **la misma pantalla** (`ParentDashboardPage`); solo se adaptan textos y el selector, según las cursadas de la cuenta (`GET /api/alumnos/mios` pasa a devolver el vínculo de cada una):

| | Padre con hijos | Adulto solo | Adulto que también es responsable de otros |
|---|---|---|---|
| Menú | "Mis hijos", "Calificaciones", "Asistencia", "Cuotas", "Documentación", "Chat" | "Mi cursada", "Mis notas", "Mi asistencia", "Mis cuotas", "Mi documentación", "Chat con el instituto" | "Cursadas", "Calificaciones"… como el padre |
| Selector de arriba | nombres de los hijos | no aparece | "Yo" + nombres de los hijos |
| Encabezado | "Tomás · Teens A2" | "Mi cursada · Adults B1" | según quién esté elegido |
| Resto | igual | igual | igual |

La privacidad no cambia: cada cuenta ve solo a los alumnos de los que es responsable (incluido ella misma). En todas las pantallas del instituto el texto "Padre/Tutor" pasa a "Responsable" y el rol `padre` se muestra como "Responsable".

### 8. Errores

Cada error sale en castellano y aparece **al lado del campo** que lo causó, también cuando lo detecta el servidor y no la pantalla (el servidor ya responde 400 con el detalle por campo; el client lo reparte entre los campos). Un 409 por DNI repetido aparece en el campo del DNI. Un error que no es de un campo se muestra arriba del formulario.

## Datos existentes

- No se convierten. El DNI, la fecha y el padre de los alumnos viejos se ven como están; los que no cumplan las reglas nuevas solo se revalidan si alguien los edita.
- La migración rellena `Alumno.vinculoResponsable` desde el vínculo del padre de cada alumno que ya tiene padre (hoy 3 de los 147 alumnos reales; como `Padre.vinculo` era obligatorio, todos los que tienen padre quedan con vínculo). La columna sigue admitiendo vacío en la base (los alumnos sin padre no tienen vínculo); el servicio exige el vínculo siempre que haya responsable. `Alumno.cursoId` también sigue admitiendo vacío en la base (hay alumnos viejos sin curso); el servicio lo exige para toda inscripción nueva.
- El ciclo activo hoy es el 2027, y los alumnos reales del 2025 no están inscriptos en él, así que el aviso de "datos incompletos" no los va a contar mientras ese ciclo siga activo. Aparecerán si alguna vez se activa el ciclo en el que están.
- Los scripts de prueba y `datos-prueba-2026.ts` que crean padres con vínculo se actualizan al modelo nuevo.

## Cómo se verifica

- **Validadores:** una tabla de casos (válidos, inválidos, borde) para cada regla, corrida contra la copia del server y la del client.
- **Servidor por HTTP, con datos `prueba-`:** altas mínimas (menor y adulto, responsable nuevo y existente, atómicas: si falla el alumno no queda el responsable), `PATCH` parcial con `null`, dos `PATCH` simultáneos de campos distintos que no se pisan, el criterio de datos incompletos, el aviso agrupado y su resolución, la sincronización nombre/apellido/DNI entre alumno y responsable `propio`, `GET /api/alumnos/mios` con vínculo.
- **Navegador (Playwright):** inscribir con lo mínimo, la marca y el filtro, editar solo un campo y comprobar que sale solo ese campo, el aviso "Mientras editabas…" con otro usuario cambiando campos distintos y el mismo, el panel de un adulto solo y el de un adulto con hijo, los errores al lado del campo.
- **Datos reales intactos:** las pruebas de edición se hacen sobre registros `prueba-`, nunca sobre alumnos reales.

## Llamadas mías (para que las revises)

1. El vínculo pasa a ser del alumno, no del padre (hace falta para que una persona sea "madre" de uno y "propia" de otro).
2. Lo obligatorio al crear no se puede vaciar después; lo "completar después" sí.
3. Un menor de 18 con fecha cargada no puede ser responsable de sí mismo.
4. Nombre, apellido y DNI se mantienen iguales entre el alumno y su ficha de responsable `propio`.
5. La población de "datos incompletos" es la misma que la de documentación pendiente (alumno activo del ciclo activo).
6. El rol `padre` se muestra como "Responsable" en las pantallas; en el código no se renombra nada.
7. Los topes de largo, el cupo de 1 a 50, el rango de 1 año para la fecha de evaluación y la no superposición de horarios.
8. El aviso "Mientras editabas…" nombra solo los campos que se actualizaron solos.
9. El teléfono se guarda como `+549` y los 10 dígitos; el DNI como dígitos puros.
10. El responsable de un alumno ya inscripto se puede asignar o cambiar desde el legajo, con el mismo selector de la inscripción.
11. Al reutilizar una ficha por DNI, manda la ficha existente: lo escrito solo completa lo que le faltaba.
12. Una ficha tiene como máximo un alumno `propio`.
13. No hay búsqueda automática por nombre para detectar fichas duplicadas de adultos sin DNI.
14. Un responsable creado desde Usuarios puede quedar sin alumnos, como hoy.
15. El criterio de datos incompletos no incluye el curso e incluye un ítem `vinculo`.

## Limitaciones conocidas

- **Fichas duplicadas:** si una persona se carga primero sin DNI y después se intenta cargar de nuevo con DNI cuando ya existe otra ficha igual, el sistema avisa del DNI repetido pero no hay una herramienta para unificar las dos fichas.
- **Los datos viejos** con formatos que no cumplen (teléfonos con letras, fichas sin padre) siguen como están hasta que se corrijan a mano o se borren.

## Lo que queda a criterio de quien construya

El algoritmo exacto para entender los formatos de celular, la forma concreta del pedido de inscripción, las etiquetas de campos para el aviso "Mientras editabas…", cómo se organizan los archivos de validación y la migración, y la redacción final de los mensajes de error.
