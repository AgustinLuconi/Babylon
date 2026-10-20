# Pantallas al día y aviso de versión nueva — Diseño (subproyecto 3c)

**Fecha:** 2026-10-20 · **Subproyecto 3, etapa 3c** (3a: avisos guardados y en tiempo real ✔ · 3b: chat en vivo ✔ · 3c: este · 3d: formularios · después: editar y borrar mensajes del chat · 4: autenticación en dos pasos)

## Por qué

Hoy cada pantalla muestra lo que había cuando se abrió. Si otra persona cambia algo, la pantalla sigue con datos viejos hasta que se recarga o se navega. Algunos ejemplos:
- el administrador mira las cuotas vencidas mientras la secretaria cobra una;
- el padre mira las notas de su hijo mientras el profesor publica una nueva;
- el profesor carga notas mientras la secretaria inscribe un alumno en su curso.

Además, cuando se publique una versión nueva del sistema, quien lo tenga abierto seguirá usando la versión vieja (horas, si no recarga), con riesgo de errores.

## Qué quiere el usuario (sus palabras y decisiones)

- **Todas las pantallas al día en todo momento.** Ninguna desincronizada ni mostrando información que no sea la actual.
- **Cuando algo cambia, se resalta y aparece un mensaje que dice qué pasó y quién lo hizo.** Es la opción "C" de los bocetos. Ejemplo: "Lucía cobró la cuota de octubre de Tomás Rodríguez". El mensaje es chico, abajo a la derecha, y se va solo a los pocos segundos.
- **Si cambia la nómina mientras el profesor escribe** (carga notas o asistencia y la secretaria inscribe o da de baja un alumno de su curso):
  - lo tipeado no se pierde;
  - el alumno nuevo aparece con su casillero vacío y el que se fue desaparece;
  - un aviso explica qué pasó, para que el profesor lo entienda.
- **Las observaciones muestran quién las escribió y con qué rol**, para distinguir si es del profesor, de secretaría o de administración.
- **Aviso de versión nueva:**
  - deja terminar lo que se está haciendo;
  - recomienda guardar todo antes de recargar, para no perder datos;
  - después exige recargar antes de cualquier otra cosa.
- **Protección de lo que no se guardó, en todo el sistema.** Hoy, irse de una pantalla con algo escrito lo pierde sin avisar. Desde el 3c, salir de una pantalla con algo sin guardar pregunta antes "Tenés cambios sin guardar. ¿Salir igual?". Vale con versión nueva y sin ella.

## Objetivos

1. Toda pantalla que muestra un dato se actualiza sola cuando ese dato cambia, sin recargar, para todos los roles.
2. Lo que cambió se resalta brevemente y un mensaje dice qué pasó y quién lo hizo.
3. Lo que alguien está escribiendo y todavía no guardó nunca se pierde por una actualización.
4. Las observaciones muestran autor y rol en las tres pantallas donde aparecen.
5. Quien tiene abierta una versión vieja del sistema se entera y recarga sin perder datos.
6. Ninguna salida de una pantalla descarta en silencio algo escrito y no guardado.

## No objetivos (van en otros subproyectos)

- **Formularios de edición** (subproyecto 3d):
  - mandar solo lo que cambió;
  - el aviso "mientras editabas, X cambió…" dentro de un formulario abierto;
  - la revisión de la validación de todos los campos.

  En el 3c, un formulario de edición abierto **no se toca** (ver "Lo que alguien está escribiendo").
- Editar y borrar mensajes del chat (después del 3d).
- Varios servidores: la conexión en vivo sigue siendo en memoria, un solo servidor, como en el 3a y el 3b.
- "Escribiendo…" y "en línea" (descartados en el 3a).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que una actualización borre o cambie algo que el usuario estaba escribiendo.
- Que una señal en vivo lleve datos de alumnos o familias. La regla del 3a sigue vigente: las señales no llevan datos personales.
- Que alguien reciba una señal o un mensaje sobre datos que no puede ver:
  - un padre, sobre otra familia;
  - un profesor, sobre un curso ajeno;
  - secretaría, sobre algo exclusivo del administrador.
- Que el aviso de versión nueva recargue la página por su cuenta mientras hay algo sin guardar.
- Que el sistema se vuelva lento: con ~130 alumnos, que cada cambio haga recargar pantallas enteras a todo el mundo.

## Lo que ve cada uno

**Mensaje de cambio (opción C):**
- El dato que cambió se resalta un par de segundos.
  - Lo que entra a una lista aparece resaltado.
  - Lo que sale se desvanece despacio en vez de desaparecer de golpe.
  - Los números que cambiaron se iluminan.
- Abajo a la derecha aparece un mensaje chico con **quién** y **qué**, que se va solo. Ejemplos (textos de muestra; el constructor los ajusta por caso):
  - "Lucía cobró la cuota de octubre de Tomás Rodríguez"
  - "Martín publicó la nota de Writing"
  - "Lucía inscribió a Juan Pérez en Kids 2"
- Reglas:
  - **No se le muestra a quien hizo el cambio** (a la misma cuenta). Sus otras pestañas o dispositivos sí se actualizan, pero sin mensaje.
  - **Varios cambios juntos van en un solo mensaje.** Por ejemplo: "Martín publicó las notas de cierre de 28 alumnos".
  - **Solo habla de lo que se ve en la pantalla abierta.** Lo demás ya lo cubre la campana de avisos.

**Profesor con la nómina cambiando mientras escribe** (asistencia, notas de una evaluación, notas de cierre):
- Lo tipeado de cada alumno se conserva.
- Un alumno que entra al curso aparece con su casillero vacío; uno que sale desaparece de la lista. Lo que se había tipeado para él ya no se manda.
- Un aviso fijo en la pantalla (no un mensaje que se va solo) explica qué pasó, hasta que el profesor lo cierra. Ejemplos: "Lucía inscribió a Juan Pérez en este curso", "Ana Gómez ya no está en este curso".

**Observaciones:** autor y rol, por ejemplo "Lucía Peralta · Secretaría", en:
- el legajo del alumno (administración y secretaría), que hoy muestra solo el nombre;
- la pantalla del padre, que hoy muestra "— Nombre";
- la pantalla de observaciones del profesor, que hoy no muestra quién la escribió (el círculo con iniciales muestra al alumno).

Los datos ya existen: `emisorRol` y `emisorNombre`.

**Aviso de versión nueva** (aprobado sobre el boceto):
1. **Franja amarilla arriba, sin bloquear:** "Hay una versión nueva del sistema. Guardá lo que estés haciendo y después recargá la página para evitar errores", con un botón "Recargar ahora". Se puede terminar lo que se estaba haciendo.
2. **Al guardar algo con éxito** (un cobro, notas, una edición), aparece un cartel que bloquea la pantalla: "Recargá para seguir. Hay una versión nueva del sistema. Para seguir usándolo sin errores, recargá la página. Tu [cobro] quedó guardado." Tiene un solo botón, "Recargar".
3. **Al ir a otra pantalla,** la página se recarga sola en lugar de navegar. Si hay algo sin guardar, antes pregunta lo mismo que siempre ("Tenés cambios sin guardar. ¿Salir igual?"). Si se cancela, se queda en la pantalla con lo escrito y la franja.
4. Mientras se queda en la misma pantalla sin guardar, solo la franja.

**Cambios sin guardar** (en todo el sistema, haya versión nueva o no):
- **Qué cuenta como "sin guardar":**
  - un formulario de alta o edición (modal o pantalla) con algo distinto de cómo se abrió;
  - las pantallas de carga del profesor (asistencia, notas de una evaluación, notas de cierre) con algo tipeado y no guardado;
  - un mensaje del chat escrito y no enviado.
- **Cuándo pregunta "Tenés cambios sin guardar. ¿Salir igual?":** en toda salida de la pantalla.
  - Menú lateral.
  - Enlaces de la campana y de la propia pantalla.
  - El botón "atrás" del navegador.
  - Cerrar un modal con la cruz o haciendo clic afuera.
  - Recargar o cerrar la pestaña (con el aviso propio del navegador, que no deja poner texto).
- Al guardar con éxito, deja de contar como sin guardar.

## Cómo funciona (lo decidido)

- **Se reutiliza la conexión en vivo del 3a** (`GET /api/tiempo-real`, `CanalEnVivo`, tablero de anuncios) y el mismo patrón que el chat del 3b:
  - los services publican un anuncio dentro de la transacción;
  - **después de confirmar**, sale una señal corta a quienes pueden ver ese dato;
  - el navegador vuelve a pedir solo lo que corresponde.
- **La señal no lleva datos personales de alumnos ni familias:** solo qué tipo de dato cambió, los identificadores afectados, qué acción fue y quién la hizo. "Quién" es el nombre y el rol de la cuenta que hizo el cambio; el usuario pidió verlo, y son las mismas personas que ya firman mensajes del chat.
  - El texto del mensaje lo arma el navegador con lo que ya tiene en pantalla: el nombre del alumno lo saca de la lista que ya está mostrando.
- **Destinatarios por permiso, igual que las rutas de la API:**
  - administración y secretaría reciben lo que sus pantallas pueden mostrar (lo exclusivo del administrador, solo el administrador);
  - el profesor, solo lo de sus cursos y sus alumnos;
  - el padre, solo lo de sus hijos y su conversación.
- **Cambios que hace el sistema solo** (la tarea de las 03:00 que marca cuotas vencidas o genera las del mes, por ejemplo) también actualizan las pantallas. "Quién" es "el sistema": "Se marcaron vencidas 4 cuotas".
- **Al reconectarse** (señal `listo`), el navegador vuelve a pedir los datos de la pantalla abierta, como ya hacen la campana y el chat. Lo que pasó con la conexión cortada no tuvo señal.

## Lo que alguien está escribiendo

- **Formularios de edición o alta abiertos** (modal "Editar alumno", "Nuevo curso", "Registrar cobro"…):
  - una actualización nunca cambia lo que tienen escrito;
  - la pantalla de fondo sí se actualiza;
  - el aviso dentro del formulario y "mandar solo lo que cambió" son del 3d.
- **Pantallas de carga del profesor** (asistencia, notas de una evaluación, notas de cierre): la nómina se actualiza como se describe arriba y lo tipeado se conserva por alumno.
- **Si el profesor pierde el curso mientras lo tiene abierto** (el administrador se lo asigna a otro profesor o lo desactiva): aviso fijo "Este curso ya no está a tu cargo", y guardar no se permite. El server ya lo rechaza con 403. *(Llamada mía: el usuario no lo pidió, pero es la consecuencia directa de "lo tipeado no se pierde sin que se entienda por qué".)*

## Restricciones

- Lo del 3a y el 3b sigue vigente:
  - arquitectura feature-first;
  - `tx` en cada llamada al repositorio dentro de una transacción;
  - publicar dentro de la transacción;
  - señales sin datos personales;
  - una conexión por sesión compartida entre pestañas;
  - la dirección no da permisos.
- La regla de oro de los permisos: **la señal nunca le dice a alguien algo que la API no le dejaría leer.** Si un dato no lo puede pedir, tampoco puede enterarse de que cambió.
- Sin dependencias nuevas salvo que haga falta y se justifique.
- Sin datos de prueba en datos reales: las pruebas usan el prefijo `prueba-tmp-` y se borran al final (como en el 3a y el 3b).

## Decisiones mías (para que el usuario las revise)

- **Volver a pedir la lista afectada entera,** no un registro suelto. Por ejemplo, un cobro hace que las pantallas de Cuotas abiertas vuelvan a pedir la lista de cuotas, unas 1.200 filas con ~130 alumnos. A esta escala son pedidos chicos (fracciones de segundo), y la alternativa (pedidos nuevos "de una sola fila" en cada módulo) agranda mucho el trabajo para casi ninguna diferencia. El límite sigue siendo el del anti-objetivo: solo las listas que el cambio afecta, solo en las pantallas abiertas que las muestran, y una sola vez por tanda de cambios. Si una pantalla llega a pesar, se optimiza esa en particular.
- **Si el profesor pierde el curso mientras lo tiene abierto,** aviso fijo y no se puede guardar (ver arriba).
- **"Quién" en la señal** es el nombre y el rol de la cuenta; los nombres de alumnos los arma el navegador con lo que ya muestra.
- **Cambios de las tareas automáticas** se firman como "el sistema".

## Lo que queda a criterio del constructor

- El catálogo exacto de "qué dato cambia con qué acción y a quién le llega". Tiene que cubrir **todas** las escrituras de la API y de las tareas automáticas.
  - Hoy ya hay anuncios para alumnos, cursos, evaluaciones, calificaciones, notas de cierre, asistencia, cuotas, documentos, observaciones, cuentas, ciclos y chat.
  - Faltan, como mínimo: altas y ediciones de padres y profesores, altas de secretarios y administradores, configuración (valor de la cuota), ciclos (alta y edición), categorías propias de observaciones, invitaciones (pestaña Pendientes de Usuarios) y la generación de cuotas.
- Cómo el navegador traduce cada señal en qué datos volver a pedir. Debe pedir solo lo afectado, no todo.
- Los textos finales de cada mensaje, y cómo agrupa varios cambios juntos.
- La animación del resaltado (sobria, con el sistema de diseño de siempre).
- Cómo se detecta una versión nueva. Hay que cubrir que cambie el client (la página) y que cambie el server.
  - Debería comprobarse al reconectarse la conexión en vivo (un despliegue la corta) y cada tanto.
  - Sin recargar nunca por su cuenta con algo sin guardar.
- Cómo registra cada pantalla que tiene algo sin guardar, y cómo se interceptan las salidas. La guía es React Router 7 (`useBlocker`) más `beforeunload`.
- Cómo se prueba "en todas las pantallas". Debe haber al menos una prueba en navegador por rol, con dos ventanas: una cambia y la otra ve el cambio, el resaltado y el mensaje con quién lo hizo.
