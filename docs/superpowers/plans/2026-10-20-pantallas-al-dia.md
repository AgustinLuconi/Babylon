# Pantallas al día, aviso de versión nueva y cambios sin guardar (subproyecto 3c) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda pantalla se actualice sola cuando otra persona cambia un dato que muestra, con un resaltado breve y un mensaje "quién hizo qué"; que el profesor no pierda lo tipeado si cambia su nómina; que las observaciones muestren autor y rol; que una versión nueva se avise sin perder datos; y que ninguna salida de una pantalla descarte en silencio lo no guardado.

**Architecture:**
- **Server.**
  - Cada escritura publica, dentro de su transacción, un anuncio nuevo `datos.cambiaron` (qué dato, qué acción, qué ids).
  - Quién la hizo sale de un `AsyncLocalStorage` que llena `authMiddleware`; las tareas automáticas no tienen autor ("el sistema").
  - Un módulo nuevo `modules/cambios/` resuelve, después de confirmar, quiénes pueden ver ese dato y les manda la señal `cambio` por el canal en vivo del 3a.
- **Client.**
  - La señal invalida solo las consultas afectadas. TanStack vuelve a pedir solo las que están en pantalla.
  - Un feature `features/cambios/` arma el mensaje (con los nombres que ya están en caché) y lo muestra.
  - Hooks de `core/` resaltan valores y filas.
  - El ruteo pasa a router de datos para usar `useBlocker`.
  - `core/sinGuardar/` y `core/version/` resuelven la protección y el aviso de versión.

**Tech Stack:** Express 5, Prisma 6, `node:async_hooks`; React 19, React Router 7 (data router), TanStack Query 5, Zustand. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-20-pantallas-al-dia-design.md`

## Global Constraints

- **Lo del 3a y el 3b sigue vigente:**
  - feature-first;
  - `tx` en toda llamada al repositorio dentro de una transacción;
  - **publicar dentro de la transacción**;
  - una conexión en vivo por sesión compartida entre pestañas;
  - la dirección no da permisos.
- **La señal `cambio` no lleva datos personales de alumnos ni familias:** solo `dato`, `accion`, ids y `por = { usuarioId, nombre, rol } | null`.
  - `nombre` es el de la cuenta que hizo el cambio (pedido por el usuario).
  - El nombre del alumno lo arma el navegador con lo que ya tiene.
- **Regla de oro de los permisos:** una señal nunca le dice a alguien algo que la API no le dejaría leer.
- **Textos fijos del spec:**
  - versión nueva: "Hay una versión nueva del sistema. Guardá lo que estés haciendo y después recargá la página para evitar errores." y el botón "Recargar ahora";
  - cartel: título "Recargá para seguir", texto "Hay una versión nueva del sistema. Para seguir usándolo sin errores, recargá la página.", botón "Recargar";
  - sin guardar: "Tenés cambios sin guardar. ¿Salir igual?", con los botones "Seguir editando" y "Salir sin guardar";
  - curso perdido: "Este curso ya no está a tu cargo".
- **Rol en el autor de una observación:** admin → "Administración", secretario → "Secretaría", profesor → "Docente". Formato "Nombre Apellido · Rol".
- **Pruebas:** como en el 3b.
  - Scripts `server/scripts/_*.ts` y Playwright en `$SCRATCH`, que no se commitean, pasados por `chequear.py`.
  - Datos con el prefijo `prueba-tmp-av`, borrados al final con `_mundo-avisos.ts borrar` y `sincronizar`.
  - Nunca tocar datos reales; anotar antes y comparar después el número de mensajes reales (2) y de pagos reales.

`$SCRATCH` = `/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad` (herramientas del 3b: `chequear.py`, `lib.sh`, `en.sh`, `e2e.sh`, `reiniciar-api.sh`, `iniciar-client.sh`, `bloques.py`; si no están, recrearlas como en la Task 0 del plan `2026-10-16-chat-en-vivo.md`).

## Review Focus

1. **Un padre o un profesor ajeno nunca recibe un `cambio`** de otra familia o de otro curso, ni siquiera de un alumno que fue de su curso y lo cambiaron. El profesor del curso anterior sí recibe esa baja; uno de un curso ajeno, no (Task 2).
2. **Nada borrador llega a las familias:** crear una evaluación, cargar notas de una evaluación sin publicar o cargar notas de cierre no manda señal a padres. Publicar, sí (Task 2).
3. **Las notas tipeadas por el profesor sobreviven a una actualización** de la lista de notas guardadas (hoy se pisan: `CalificacionesProfesorPage.tsx:112-121` y `:411-420`) (Task 7).
4. **Cambiar un filtro de la dirección con cambios sin guardar pregunta**, porque el curso o la fecha del profesor resetean lo tipeado. En cambio, con nada sin guardar no pregunta nada (Task 4).
5. **Muchos cambios juntos no inundan:** un lote de 28 notas publicadas da un solo mensaje, y 28 señales seguidas hacen una sola recarga por consulta (Task 5).

---

## Catálogo de cambios (decisión del plan; lo usan las Tasks 1, 2 y 5)

`TipoDato` y `AccionCambio` (iguales en server y client):

| `dato` | `accion` | ids | Le llega a |
|---|---|---|---|
| `cuotas` | `cobro`, `vencimiento`, `generacion` | `alumnoIds`, `cuotaIds` | admin, secretaría; padres de `alumnoIds` |
| `alumnos` | `inscripcion`, `edicion`, `cambio-curso`, `baja`, `reactivacion` | `alumnoIds`, `cursoIds` (anterior y actual) | admin, secretaría; padres de `alumnoIds`; profesores de `cursoIds` |
| `cursos` | `alta`, `edicion` | `cursoIds`, `profesorIds` (anterior y actual) | admin, secretaría; profesores de `profesorIds`; padres de alumnos activos del curso |
| `evaluaciones` | `alta`, `publicacion` | `cursoIds`, `evaluacionIds` | admin, secretaría, profesor del curso; padres de alumnos del curso **solo** si `publicacion` |
| `calificaciones` | `carga` | `cursoIds`, `evaluacionIds`, `alumnoIds` | admin, secretaría, profesor; padres de `alumnoIds` **solo** si la evaluación está publicada |
| `notas-cierre` | `carga`, `publicacion` | `cursoIds`, `alumnoIds` | admin, secretaría, profesor; padres de `alumnoIds` **solo** si `publicacion` |
| `asistencia` | `registro` | `cursoIds`, `alumnoIds` | admin, secretaría, profesor; padres de `alumnoIds` |
| `observaciones` | `alta` | `alumnoIds`, `observacionIds` | admin, secretaría; profesor del curso del alumno; padre del alumno |
| `categorias` | `alta` | `cursoIds` | admin, secretaría, profesor del curso |
| `documentos` | `carga`, `autorizacion`, `revocacion`, `manual` | `alumnoIds` | admin, secretaría; padre del alumno |
| `padres` | `alta`, `edicion` | `padreIds` | admin, secretaría |
| `profesores` | `alta`, `edicion` | `profesorIds` | admin, secretaría |
| `usuarios` | `alta`, `estado`, `invitacion` | `usuarioIds` | admin |
| `configuracion` | `edicion` | — | admin, secretaría |
| `ciclos` | `alta`, `activacion` | `cicloIds` | todos los roles |
| `sesiones` | `inicio`, `cierre` | `usuarioIds` | la propia cuenta, en todos sus roles (lista de sesiones de Mi cuenta; sin mensaje, porque `por` es la misma cuenta o `null`) |

Señal: `{ tipo: "cambio", datos: { dato, accion, ids, por } }`, con `ids: Partial<Record<"alumnoIds"|"cursoIds"|"cuotaIds"|"evaluacionIds"|"observacionIds"|"padreIds"|"profesorIds"|"usuarioIds"|"cicloIds", string[]>>` y `por: { usuarioId: string; nombre: string; rol: Rol } | null`.

---

### Task 1: Server — autor de cada pedido y difusión de `cambio`

**Files:**
- Create: `server/src/core/autoria.ts`, `server/src/modules/cambios/{cambio.entity.ts,cambio.eventos.ts,cambio.destinatarios.prisma.ts,cambio.difusion.ts}`
- Modify: `server/src/core/middlewares/authMiddleware.ts`, `server/src/eventos.ts`, `server/src/container.ts`, `server/scripts/_mundo-avisos.ts` (prueba: suma la cuenta `secre`, rol secretario)
- Test: `server/scripts/_autoria.ts`, `server/scripts/_cambios-destinatarios.ts`

**Interfaces:**
- Produces:
  - `core/autoria.ts`: `interface Autor { usuarioId: string; rol: Rol }`, `ejecutarComo<T>(autor: Autor, fn: () => T): T`, `autorActual(): Autor | null`;
  - `modules/cambios/cambio.entity.ts`: `TipoDato`, `AccionCambio`, `IdsDeCambio`, `CambioDeDatos = { dato; accion; ids: IdsDeCambio; visibleParaFamilias?: boolean }`, `SenalCambio = { dato; accion; ids; por: { usuarioId; nombre; rol } | null }`;
  - `EventosCambios = { "datos.cambiaron": CambioDeDatos }`;
  - `interface DestinatariosDeCambios { resolver(c: CambioDeDatos): Promise<{ roles: Rol[]; cuentas: { usuarioId: string; rol: Rol }[] }> }` con su adaptador Prisma;
  - `suscribirDifusionDeCambios(tablero, canal, destinatarios, buscarNombre: (usuarioId) => Promise<string>)`.
- Comportamiento:
  - `alPublicarse("datos.cambiaron")` captura `autorActual()` en el momento;
  - con `alConfirmar(tx, …)` resuelve destinatarios y manda la señal: `canal.enviarARoles(roles, s)` más `enviarA(usuarioId, rol, s)` por cuenta;
  - no manda nada si la transacción se deshace.

- [ ] **Step 1: Pruebas que fallan.**
  - `_autoria.ts`:
    - `autorActual()` es `null` afuera;
    - dentro de `ejecutarComo(a, …)` sigue siendo `a` después de dos `await` y de un `setTimeout`;
    - dos `ejecutarComo` en paralelo no se mezclan.
  - `_cambios-destinatarios.ts` (sobre el mundo de prueba, una fila por renglón del catálogo):
    - `cuotas`/`cobro` de `hijo1` → roles `[admin, secretario]` + cuenta del `padre`; **no** `ajeno`;
    - `alumnos`/`cambio-curso` con `cursoIds [curso, cursoMulti]` → cuentas `profe` y `multi` (como profesor) y el padre;
    - `evaluaciones`/`alta` → sin padres;
    - `evaluaciones`/`publicacion` → los padres del curso;
    - `calificaciones` con `visibleParaFamilias: false` → sin padres;
    - `observaciones` de `alumnoAjeno` → `multi` (profesor) + `ajeno`; **no** `profe` ni `padre`;
    - `usuarios` → solo `[admin]`;
    - `ciclos` → los 4 roles.
- [ ] **Step 2:** Correr las dos; fallan (no existen los módulos).
- [ ] **Step 3:** Implementar.
  - `authMiddleware` envuelve `next()` en `ejecutarComo({ usuarioId: payload.sub, rol: payload.rol }, next)`.
  - El adaptador resuelve con Prisma: padres por `alumno.padre.usuarioId` con cuenta `activo`; profesores por `curso.profesor.usuarioId` con cuenta `activo`.
  - `buscarNombre` lee `Usuario.nombre`.
  - Se conecta en `container.ts` junto a `suscribirChatEnVivo`.
- [ ] **Step 4:** `pnpm typecheck` y las dos pruebas → `N bien, 0 mal`.
- [ ] **Step 5:** Prueba en vivo `_cambios-en-vivo.ts` (copia `login/pedir/abrir/si` de `_chat-en-vivo.ts`).
  - Publica un `datos.cambiaron` dentro de `uow.runInTransaction` ejecutado `ejecutarComo(secre)`.
  - El admin recibe `event: cambio` con `"por":{"usuarioId":"prueba-tmp-av-secre","nombre":"Pruebaav secre","rol":"secretario"}`.
  - `ajeno` no recibe nada.
  - La señal no contiene "Tomasav".
  - Una transacción que falla no manda nada.
- [ ] **Step 6:** Commit "Cambios en vivo: autor de cada pedido y difusión de la señal `cambio` a quienes pueden ver el dato".

### Task 2: Server — publicar `datos.cambiaron` en todas las escrituras

**Files:**
- Modify (publicar dentro de la transacción; donde hoy no hay transacción, envolver con `unitOfWork.runInTransaction` y pasar `tx`):
  - `alumnos/alumno.service.ts` (`inscribirAlumno` → `inscripcion`; `actualizarAlumno` → `edicion`, `cambio-curso`, `baja` o `reactivacion` según qué cambió, con el `cursoId` anterior);
  - `cursos/curso.service.ts` (`alta`, `edicion` con el `profesorId` anterior);
  - `cuotas/cuota.service.ts` (`registrarPago` → `cobro` con `alumnoIds`/`cuotaIds`; `marcarVencidas` → `vencimiento`; `generarCuotasDelMes` y `generarCuotaInicial` → `generacion`);
  - `calificaciones/calificacion.service.ts` (`evaluaciones` alta y publicación; `calificaciones` carga con `visibleParaFamilias = evaluación publicada`; `notas-cierre` carga y publicación);
  - `asistencia/asistencia.service.ts`;
  - `observaciones/observacion.service.ts` (observación y categoría);
  - `documentos/documento.service.ts`;
  - `padres/padre.service.ts` (`crearPadre`, `crearPadreSinCuenta`, `actualizarPadre`);
  - `profesores/profesor.service.ts` (las tres altas y la edición);
  - `usuarios/usuario.service.ts` (`crearSecretario`, `crearAdministrador`, `cambiarEstado`) y `usuarios/invitacion.service.ts` (`invitar`, `reenviar`, `cancelar`, `activarCuenta` → `usuarios`/`invitacion`);
  - `configuraciones/configuracion.service.ts`;
  - `ciclos/ciclo.service.ts` (`crearCiclo`, `marcarActivo`);
  - `usuarios/usuario.service.ts` también publica `sesiones`: `inicio` al crear la sesión del login, y `cierre` en cada camino que hoy publica `sesiones.cerradas`.
- Test: `server/scripts/_cambios-publicados.ts`

**Interfaces:**
- Consumes: `EventosCambios`, `CambioDeDatos` (Task 1). Cada service suma `Publicador<EventosCambios>` a su tipo de `anuncios` (el tablero ya se le pasa).

- [ ] **Step 1: Prueba que falla.**
  - Con un tablero propio que registra cada `datos.cambiaron` (y un `PrismaUnitOfWork` real), llamar a cada caso de uso sobre el mundo de prueba.
  - Comprobar `dato/accion/ids` según el catálogo. Una línea por caso de uso, incluidos:
    - el `cambio-curso` con los dos cursos;
    - `calificaciones` sobre una evaluación borrador → `visibleParaFamilias: false`.
  - Una operación que falla (cobrar una cuota ya pagada → 409) no deja ningún cambio confirmado.
- [ ] **Step 2:** Correr; falla.
- [ ] **Step 3:** Implementar en cada service.
- [ ] **Step 4:** La prueba → `0 mal`. Regresión: `_avisos-servicio`, `_suscripciones`, `_avisos-chat`, `_chat-servicio`, `_invitaciones`, `_activacion`, `_carrera-login` → `0 mal`.
- [ ] **Step 5:** Commit "Cambios en vivo: todas las escrituras anuncian qué dato cambió".

### Task 3: Server — versión del servidor en la señal `listo`

**Files:**
- Create: `server/src/core/version.ts`
- Modify: `server/src/core/tiempoReal.ts` (línea 51), `server/package.json` (`build` escribe `dist/version.json` con la fecha y hora de compilación)
- Test: `server/scripts/_version.ts`

**Interfaces:** `VERSION_SERVIDOR: string`:
- `process.env.APP_VERSION` si está;
- si no, el `version` de `dist/version.json` si existe;
- si no, `"desarrollo"`.

`listo` pasa a llevar `datos: { version }`.

- [ ] **Step 1:** La prueba abre la conexión en vivo dos veces, con la API levantada con `APP_VERSION=prueba-1` y después `prueba-2`, y lee `event: listo\ndata: {"version":"prueba-1"}` y `"prueba-2"`. Falla.
- [ ] **Step 2:** Implementar; `pnpm build` deja `dist/version.json`.
- [ ] **Step 3:** La prueba pasa; `_tiempo-real` sigue en `0 mal`.
- [ ] **Step 4:** Commit "Versión del servidor en la señal listo".

### Task 4: Client — router de datos y protección de cambios sin guardar

**Files:**
- Modify:
  - `client/src/App.tsx` (`createBrowserRouter(createRoutesFromElements(rutas))` + `RouterProvider`);
  - `client/src/core/routes/AppRoutes.tsx` (exporta `rutas`, el mismo árbol de `<Route>`);
  - `client/src/core/components/ui/modal.tsx` (prop `sinGuardar?: boolean`: la cruz pregunta antes de cerrar).
- Create: `client/src/core/sinGuardar/{sinGuardar.ts,ConfirmarSalida.tsx,ProteccionSinGuardar.tsx}`
- Modify, para registrar cada formulario o pantalla:
  - `ProfesoresAdminPage`, `CursosAdminPage` y `UsuariosPage` (con `formState.isDirty` del formulario);
  - `AlumnoDetailPage` (modales "Nueva observación" y "Editar datos");
  - `CuotasPage` (modal "Registrar pago" con alumno o cuotas elegidos);
  - `InscribirAlumnoPage`;
  - `ConfiguracionPage` (valor de la cuota distinto del guardado);
  - `CambiarContrasena`;
  - `AsistenciaProfesorPage` (algún estado marcado sin guardar);
  - `CalificacionesProfesorPage` (notas u observaciones distintas de las guardadas; modal "Nueva evaluación");
  - `ObservacionesProfesorPage` (texto escrito);
  - `ChatPage` y `ChatsAdminPage` (borrador).
- Test: `$SCRATCH/e2e-3c-sin-guardar.js`

**Interfaces:**
- `useSinGuardar(activo: boolean): void` registra mientras `activo`;
- `hayCambiosSinGuardar(): boolean`;
- `confirmarSalida(): Promise<boolean>` muestra el cartel y resuelve `true` con "Salir sin guardar";
- `<ProteccionSinGuardar />`, en `AppLayout`:
  - usa `useBlocker` para **cualquier** cambio de dirección (ruta o `?…`) cuando `hayCambiosSinGuardar()`;
  - usa `beforeunload` cuando hay algo sin guardar.
- Al guardar con éxito, el formulario deja de estar sin guardar (cada página lo resuelve con su propio estado).

- [ ] **Step 1: Recorrido que falla.**
  - Profesor con asistencia marcada y sin guardar toca el menú "Calificaciones" → aparece "Tenés cambios sin guardar. ¿Salir igual?".
  - "Seguir editando" → sigue en `/asistencia` con lo marcado.
  - "Salir sin guardar" → navega.
  - Cambiar el curso (filtro de la dirección) con lo marcado → pregunta.
  - Sin nada marcado → navega sin preguntar.
  - Admin con "Editar datos" de un alumno con un cambio → la cruz pregunta.
  - Recargar con algo sin guardar → el navegador pide confirmación (`page.on("dialog")` de tipo `beforeunload`).
  - Chat con borrador → cambiar de conversación pregunta.
- [ ] **Step 2:** Correr; falla.
- [ ] **Step 3:** Implementar la infraestructura y registrar cada formulario de la lista.
- [ ] **Step 4:** El recorrido pasa; todos los e2e del 3b siguen pasando (el router cambió); `pnpm typecheck && pnpm lint && pnpm build` limpios.
- [ ] **Step 5:** Commit "Cambios sin guardar: preguntar antes de salir de una pantalla, en todo el sistema".

### Task 5: Client — cambios en vivo: qué se vuelve a pedir y el mensaje "quién hizo qué"

**Files:**
- Create:
  - `client/src/core/tiempoReal/senales.ts` (`emitirSenal(s)`, `escucharSenal(tipo, fn): () => void`);
  - `client/src/core/tiempoReal/cambiosEnVivo.ts` (store: último cambio ajeno por `dato`, con `por` e ids; `huboCambioAjenoReciente(datos, ms = 3000)`);
  - `client/src/features/cambios/{types.ts,claves.ts,mensajes.ts,nombres.ts,CambiosEnVivo.tsx,MensajesDeCambios.tsx}`.
- Modify: `client/src/core/tiempoReal/TiempoReal.tsx` (reenvía `cambio` con `emitirSenal`), `client/src/core/components/layout/AppLayout.tsx` (monta `<CambiosEnVivo />` y `<MensajesDeCambios />`)
- Test: `server/scripts/_cambios-claves.ts`, `server/scripts/_cambios-mensajes.ts` (TypeScript puro del client, como `_visto.ts`), `$SCRATCH/e2e-3c-staff.js`

**Interfaces:**
- `clavesAfectadas(c: SenalCambio): QueryKey[] | "todo"` devuelve prefijos de consulta:

  | `dato` | prefijos |
  |---|---|
  | `cuotas` | `["cuotas"]`, `["reportes"]` |
  | `alumnos` | `["alumnos"]`, `["cursos"]`, `["cuotas"]`, `["documentos"]`, `["reportes"]` |
  | `cursos` | `["cursos"]`, `["alumnos"]`, `["reportes"]` |
  | `evaluaciones` | `["evaluaciones"]`, `["calificaciones"]`, `["reportes"]` |
  | `calificaciones` | `["calificaciones"]`, `["reportes"]` |
  | `notas-cierre` | `["calificaciones"]`, `["notasCierre"]`, `["reportes"]` |
  | `asistencia` | `["asistencia"]`, `["reportes"]` |
  | `observaciones` | `["observaciones"]` |
  | `categorias` | `["categoriasPersonalizadas"]` |
  | `documentos` | `["documentos"]`, `["autorizacionImagen"]`, `["reportes"]` |
  | `padres` | `["padres"]`, `["pendientes"]`, `["alumnos"]` |
  | `profesores` | `["profesores"]`, `["pendientes"]`, `["cursos"]` |
  | `usuarios` | `["usuarios"]`, `["pendientes"]` |
  | `configuracion` | `["configuracion"]` |
  | `ciclos` | `"todo"` |
  | `sesiones` | `["sesiones"]` |

- `textoDelCambio(c: SenalCambio, nombres: { alumno(id): string | null; mesDeCuota(id): string | null }, cantidad: number): string`.
  - "Quién" es la primera palabra de `por.nombre`; `por: null` es "el sistema", que se escribe de forma impersonal ("Se …").
  - Textos:

    | Caso | Texto |
    |---|---|
    | cobro de 1 cuota | "{Quién} cobró la cuota de {mes} de {alumno}" |
    | cobro de n cuotas | "{Quién} cobró {n} cuotas" |
    | vencimiento | "Se marcaron vencidas {n} cuotas" |
    | inscripción | "{Quién} inscribió a {alumno}" |
    | cambio de curso | "{Quién} cambió de curso a {alumno}" |
    | baja | "{Quién} dio de baja a {alumno}" |
    | publicación de evaluación | "{Quién} publicó una evaluación" |
    | carga de calificaciones | "{Quién} cargó notas" |
    | publicación de notas de cierre | "{Quién} publicó las notas de cierre de {n} alumnos" |
    | registro de asistencia | "{Quién} tomó asistencia" |
    | alta de observación | "{Quién} escribió una observación sobre {alumno}" |

  - Sin nombre del alumno en caché, el texto va sin él: "{Quién} cobró una cuota".
  - Los demás casos siguen el mismo molde.
- `<CambiosEnVivo />`:
  - por cada `cambio`, junta las claves y las invalida **una sola vez cada 300 ms** (agrupa ráfagas);
  - si `por?.usuarioId !==` la cuenta propia, registra el cambio ajeno y encola el mensaje;
  - los mensajes iguales (`dato`, `accion`, `por`) que llegan dentro de 1 s se juntan en uno con la cantidad sumada.
- `<MensajesDeCambios />` va abajo a la derecha (`data-mensaje-cambio`), dura 5 s y muestra hasta 3 a la vez.
- **Al reconectarse** (`listo` que no sea el primero de la página), `<CambiosEnVivo />` vuelve a pedir todas las consultas activas (`queryClient.invalidateQueries()`, que en TanStack solo recarga lo que está en pantalla): lo que pasó con la conexión cortada no tuvo señal.

- [ ] **Step 1: Pruebas que fallan.**
  - `_cambios-claves.ts`: cada fila de la tabla.
  - `_cambios-mensajes.ts`: los textos de la tabla, más `por: null` y el caso sin nombre.
  - `e2e-3c-staff.js`, con dos ventanas (admin en `/cuotas?pestana=vencidas`, secretaria) y una cuota vencida de `hijo1`:
    - la secretaria la cobra;
    - en el admin, la fila de Tomasav sale de la lista sin recargar;
    - aparece `[data-mensaje-cambio]` con "Pruebaav cobró la cuota de {mes} de Tomasav Pruebaav";
    - la secretaria **no** ve el mensaje.
- [ ] **Step 2:** Correr; fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Las tres pasan.
  - Regresión: `e2e-chat-menu`, `e2e-chat-visto`, `e2e-chat-instituto` y `e2e-chat-detalles` en `0 mal`.
  - Agregar al recorrido:
    - un lote de 5 cobros seguidos da **un** mensaje "Pruebaav cobró 5 cuotas" y una sola recarga de `/api/cuotas` (contar pedidos con `page.on("request")`);
    - con la conexión en vivo bloqueada (`page.route("**/api/tiempo-real", abort)` + reiniciar la API, como en `e2e-chat-revision.js`), un cobro no llega; al desbloquear y reconectarse, la lista se actualiza;
    - en Mi cuenta, iniciar sesión con la misma cuenta desde otro contexto del navegador suma la sesión a la lista sin recargar.
- [ ] **Step 5:** Commit "Cambios en vivo en el navegador: se vuelve a pedir solo lo afectado y un mensaje dice quién hizo qué".

### Task 6: Client — resaltado de lo que cambió en todas las pantallas

**Files:**
- Create: `client/src/core/hooks/{useResaltado.ts,useListaConSalidas.ts}`; clases `.cambio-resaltado`, `.fila-entrando`, `.fila-saliendo` en `client/src/index.css`, con animación sobria (fondo `--warning-soft` que se apaga en 2,5 s; la salida se desvanece en 1,5 s).
- Modify:
  - **Números y estados:** `AdminDashboard`, `SecretarioDashboard`, los KPIs de `CuotasPage` y `ReportesPage`, la cabecera de stats de `ParentDashboardPage` y los KPIs de `MisCursosPage`.
  - **Filas de listas:**
    - las tablas de `CuotasPage`, `AlumnosListPage`, `CursosAdminPage`, `UsuariosPage` (Cuentas), `PendientesTab` y `ProfesoresAdminPage`;
    - las pestañas del legajo (`AlumnoDetailPage`) y de `ParentDashboardPage`;
    - la nómina de `AsistenciaProfesorPage` y de `CalificacionesProfesorPage`;
    - la lista de `ObservacionesProfesorPage`.
- Test: `$SCRATCH/e2e-3c-resaltado.js`

**Interfaces:**
- `useResaltado(valor: unknown, datos: TipoDato[]): boolean`. Vale `true` durante 2,5 s cuando `valor` cambia y `huboCambioAjenoReciente(datos)`. Si el que cambió el valor es uno mismo, o es la primera carga, no resalta.
- `useListaConSalidas<T>(items: T[], clave: (t: T) => string, datos: TipoDato[]): { item: T; estado: "normal" | "entrando" | "saliendo" }[]`. Mantiene 1,5 s las filas que salieron, con el estado `saliendo`, solo si fue un cambio ajeno.

- [ ] **Step 1: Recorrido que falla, con dos ventanas.**
  - Admin en el panel: tras un cobro de la secretaria, el número "cobrado hoy" tiene `.cambio-resaltado`.
  - En `/cuotas?pestana=vencidas`, la fila que sale tiene `.fila-saliendo` y a los 2 s ya no está.
  - Padre en `/mis-hijos/calificaciones`: tras publicar el profesor una evaluación con nota, la fila nueva tiene `.fila-entrando`.
  - Un cobro hecho por el mismo admin no resalta nada en su propia ventana.
- [ ] **Step 2:** Correr; falla.
- [ ] **Step 3:** Implementar los hooks y aplicarlos en la lista de archivos.
- [ ] **Step 4:** Pasa; captura de `/cuotas` (en `$SCRATCH`) con una fila saliendo, para revisar que se ve sobrio.
- [ ] **Step 5:** Commit "Resaltado breve de lo que cambió en todas las pantallas".

### Task 7: Client — el profesor no pierde lo tipeado y entiende qué pasó

**Files:**
- Create: `client/src/features/cursos/hooks/{useAvisosDeNomina.ts,useCursoPerdido.ts}`, `client/src/features/cursos/components/AvisosDeNomina.tsx`
- Modify: `client/src/features/calificaciones/pages/CalificacionesProfesorPage.tsx` (las dos precargas, `:112-121` y `:411-420`), `client/src/features/asistencia/pages/AsistenciaProfesorPage.tsx`
- Test: `$SCRATCH/e2e-3c-profesor.js`

**Interfaces:**
- `useAvisosDeNomina(cursoId: string | undefined, alumnos: { id: string; nombre: string; apellido: string }[] | undefined): { avisos: { id: string; texto: string }[]; cerrar(id: string): void }`.
  - Compara la nómina anterior con la nueva **del mismo curso**. Al cambiar de curso, reinicia sin avisos.
  - Textos: "{Quién} inscribió a {Nombre Apellido} en este curso" (entra) y "{Nombre Apellido} ya no está en este curso" (sale).
  - "Quién" sale del último cambio ajeno de `alumnos` (Task 5).
- `useCursoPerdido(cursoId, cursos): boolean` vale `true` si el curso estaba en "mis cursos" y dejó de estar.
- **Precarga sin pisar:**
  - las notas guardadas se cargan al cambiar de evaluación o período, o en la primera carga;
  - cuando la lista se vuelve a pedir, solo se completan los alumnos que el profesor **no tocó**;
  - lo que se manda al guardar sale de la nómina actual: un alumno que se fue no se manda.

- [ ] **Step 1: Recorrido que falla.**
  - Profesor en `/calificaciones` con 2 notas tipeadas sin guardar.
  - La secretaria (por API) inscribe un alumno nuevo en el curso y da de baja a `hijo2`.
  - Siguen las 2 notas tipeadas (la de `hijo2` desaparece con su fila).
  - Aparece una fila nueva vacía.
  - Aparecen los avisos fijos "Pruebaav inscribió a … en este curso" y "Lunaav Pruebaav ya no está en este curso".
  - Guardar manda solo los alumnos actuales: verificar con una consulta que no hay nota de `hijo2`.
  - El admin le asigna el curso a `multi`: aparece "Este curso ya no está a tu cargo" y el botón de guardar queda deshabilitado.
  - Lo mismo en `/asistencia`.
  - Una actualización de la lista de notas guardadas (simulada con `listo`, reiniciando la API) no pisa lo tipeado.
- [ ] **Step 2:** Correr; falla.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Pasa.
- [ ] **Step 5:** Commit "Profesor: lo tipeado sobrevive a los cambios de nómina, con avisos de qué pasó y del curso perdido".

### Task 8: Client — autor y rol en las observaciones

**Files:**
- Create: `client/src/features/observaciones/autor.ts`
- Modify: `client/src/features/alumnos/pages/AlumnoDetailPage.tsx` (~`:765`), `client/src/features/alumnos/pages/ParentDashboardPage.tsx` (~`:342`), `client/src/features/observaciones/pages/ObservacionesProfesorPage.tsx` (~`:231`, el círculo con iniciales pasa a ser del autor)
- Test: `server/scripts/_autor-observacion.ts`, más un chequeo en `e2e-3c-profesor.js`

**Interfaces:** `etiquetaDeAutor(nombre: string, rol: Rol): string`. Ejemplos: `etiquetaDeAutor("Lucía Peralta", "secretario")` → "Lucía Peralta · Secretaría"; admin → "· Administración"; profesor → "· Docente".

- [ ] **Step 1:** Pruebas que fallan.
  - La función, con los tres roles.
  - En el navegador: una observación escrita por la secretaria se ve como "Pruebaav secre · Secretaría" en las tres pantallas.
- [ ] **Step 2:** Correr; fallan.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Pasan.
- [ ] **Step 5:** Commit "Observaciones: se ve quién la escribió y con qué rol".

### Task 9: Client — aviso de versión nueva

**Files:**
- Create: `client/src/core/version/{version.ts,FranjaVersionNueva.tsx,CartelRecargar.tsx}`
- Modify:
  - `client/vite.config.ts` (`define: { __VERSION_CLIENT__ }` con la fecha y hora del build, o `"desarrollo"` con `vite` en desarrollo; escribe `version.json` en `dist` al compilar y lo sirve en desarrollo);
  - `client/src/App.tsx` (`new QueryClient({ mutationCache: new MutationCache({ onSuccess: alGuardarConExito }) })`);
  - `client/src/core/tiempoReal/TiempoReal.tsx` (`listo` → `comprobarVersion(datos.version)`);
  - `client/src/core/components/layout/AppLayout.tsx`;
  - `client/src/core/sinGuardar/ProteccionSinGuardar.tsx` (con versión nueva, navegar recarga: `window.location.assign(destino)` después de la confirmación de cambios sin guardar).
- Test: `$SCRATCH/e2e-3c-version.js`

**Interfaces:**
- store `useVersion`: `estado: "al-dia" | "nueva"`, `bloqueo: boolean`;
- `comprobarVersion(versionServidor?: string): Promise<void>`:
  - la primera versión del servidor que ve es la de referencia;
  - pide `/version.json` sin caché y lo compara con `__VERSION_CLIENT__`;
  - cualquier diferencia pasa a `"nueva"`;
  - corre en cada `listo` y cada 10 minutos;
- `alGuardarConExito()`: con `"nueva"` → `bloqueo = true`;
- la franja y el cartel usan los textos de las Global Constraints. "Recargar" hace `window.location.reload()`.

- [ ] **Step 1: Recorrido que falla.**
  - Con `page.route("**/version.json")` que devuelve otra versión y un `listo` (reiniciando la API), aparece la franja.
  - La secretaria puede seguir completando el cobro.
  - Al registrar el cobro con éxito aparece el cartel "Recargá para seguir" y no se puede usar la pantalla.
  - "Recargar" recarga.
  - En otra corrida, con la franja visible y sin nada sin guardar, tocar "Alumnos" en el menú recarga en `/alumnos` (la página se carga de nuevo: `page.waitForEvent("load")`).
  - Con algo sin guardar, antes pregunta.
  - Con la API levantada con `APP_VERSION=prueba-2` después de `prueba-1` (sin tocar `version.json`), también aparece la franja.
- [ ] **Step 2:** Correr; falla.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Pasa.
- [ ] **Step 5:** Commit "Aviso de versión nueva: deja terminar, recomienda guardar y después exige recargar".

### Task 10: Pruebas por rol, documentación y batería completa

**Files:**
- Test: `$SCRATCH/e2e-3c-padre.js`, con dos ventanas: padre en `/mis-hijos/asistencia` y `/mis-hijos/cuotas`; el profesor toma asistencia y la secretaria cobra; el padre ve los dos cambios, el resaltado y los mensajes; `ajeno`, abierto en paralelo, no recibe nada.
- Modify: `CLAUDE.md` (sección nueva "Pantallas al día (subproyecto 3c)" bajo "Avisos guardados y en tiempo real", con el catálogo, `autoria`, `modules/cambios`, `features/cambios`, `sinGuardar`, `version`, el router de datos y la precarga del profesor; la señal `cambio` sumada a la lista de señales; la fila `listo { version }`); memoria `proyecto_babylon_pendientes_futuros.md` y `MEMORY.md`.

- [ ] **Step 1:** `e2e-3c-padre.js` → `0 mal`.
- [ ] **Step 2:** Batería completa:
  - server y client: `typecheck`, `lint` y `build`;
  - todos los scripts `_*.ts` del 3a, 3b y 3c;
  - `chat-api.sh`;
  - todos los e2e del 3b y del 3c.

  Todo en `0 mal`.
- [ ] **Step 3:** La base quedó limpia:
  - 0 usuarios, chats o padres `prueba-tmp-`;
  - 2 mensajes reales;
  - el mismo número de pagos reales que al empezar;
  - `p6` puede entrar.
- [ ] **Step 4:** Commit "Documentar pantallas al día, versión nueva y cambios sin guardar".
