# Avisos guardados y en tiempo real — Diseño (subproyecto 3a)

**Fecha:** 2026-10-15 · **Subproyecto 3 de 4**, etapa **3a** (1: Mi cuenta y sesiones ✔ · 2: invitación y verificación de email ✔ · 3: notificaciones → **3a: avisos guardados, preferencias y tiempo real** · 3b: chat en vivo · 3c: pantallas que se actualizan solas · 4: autenticación en dos pasos)

## Objetivo

Que la campana deje de ser una foto del momento y pase a ser un **historial real**: cada aviso se guarda para su destinatario, tiene "leído", queda abierto mientras la situación siga y **llega al instante**, sin recargar la página. Cada persona elige qué tipos de aviso quiere ver. La misma conexión abierta sirve para **cerrar al instante** una sesión que se cerró desde otro lado.

**Éxito:**
- Cuando un profesor publica una nota, al padre le aparece el aviso en la campana en el momento, con el número de no leídos actualizado.
- Al tocar un aviso, la pantalla abre exactamente lo que señala (ese curso en ese día, ese hijo, esa evaluación).
- El número de un aviso agrupado coincide siempre con lo que muestra la lista filtrada.
- Ningún aviso se pierde aunque el servidor se caiga justo después de una operación.

## Decisiones tomadas con el usuario

- **Preferencias = qué tipos de aviso aparecen en la campana.** No hay avisos por email.
- **Enfoque 2:** cada módulo genera los avisos en el momento en que pasa algo, a través de un **tablero de anuncios** interno (Forma B), más una **revisión nocturna** como red de seguridad.
- **Tiempo real con SSE** (no WebSockets): el servidor manda y el navegador solo recibe. Se descartó "escribiendo…" y "en línea" en el chat, que eran lo único que justificaba WebSockets.
- **La conexión se abre con `fetch` y el token en el encabezado `Authorization`**, no con `EventSource` (no admite encabezados) ni con el token en la dirección (quedaría en registros e historial). Se evaluaron el "pase de un solo uso" (dos pedidos, sin ventaja) y la cookie protegida (más segura, pero cambia el inicio de sesión de todo el sistema: queda como posible subproyecto propio, junto con el 2FA).
- **La reconexión se programa a mano**: espera creciente con margen al azar, no reintenta ante un rechazo de sesión y distingue "se cortó la red" de "te cerraron la sesión".
- **Una sola conexión por sesión** aunque haya varias pestañas, coordinada **por sesión** (no por navegador): dos cuentas abiertas en el mismo navegador nunca comparten avisos.
- **Los avisos se guardan dentro de la misma transacción** que la operación que los origina; el envío en tiempo real ocurre **después** de confirmar.
- **Avisos agrupados para administración y secretaría** (opción A): "Hay N cuotas vencidas" y "Hay N alumnos con documentación pendiente". Para padres y profesores, individuales.
- **Criterio único de documentación pendiente**: alumno activo del ciclo activo al que le falta cualquiera de los 3 documentos (no tener fila también es pendiente). Lo usan el aviso, el número del panel de la secretaria, el filtro nuevo y el aviso del padre.
- **El aviso guarda de qué recurso trata, no una dirección**: la dirección se arma al tocarlo, según el rol.
- **Filtros en la dirección de la página**: tanda 1 en esta etapa (las pantallas a las que llevan los avisos); tanda 2 en una etapa corta posterior.
- Criterios nuevos: evaluación próxima **7 días antes**; asistencia sin tomar **abierta hasta que se tome, cierre solo a los 7 días**; un **único aviso por cuota** que pasa de "por vencer" a "vencida".

## Tipos de aviso

| Rol | Tipo (`TipoNotificacion`) | Clase | Clave (uno por…) | Se abre / se crea | Se resuelve |
|---|---|---|---|---|---|
| Admin y secretaría | `cuotas_vencidas` | Estado (agrupado) | cuenta | Hay al menos 1 cuota `vencida` (mismo criterio que la pestaña Vencidas de Cuotas) | No queda ninguna |
| | `documentacion_pendiente` | Estado (agrupado) | cuenta | Al menos 1 alumno con documentación pendiente (criterio único) | No queda ninguno |
| | `evaluacion_proxima` | Estado | evaluación | Evaluación de un curso del ciclo activo con fecha entre hoy y hoy + 7 días | Pasa la fecha |
| Profesor | `asistencia_pendiente` | Estado | curso + fecha | Clase de un curso propio, activo y del ciclo activo, que ya empezó (hora de Argentina) y no tiene asistencia ese día; se miran los últimos 7 días | Se toma la asistencia, o pasaron 7 días |
| | `notas_sin_publicar` | Estado | evaluación | Evaluación propia en `borrador` con al menos una nota cargada | Se publica |
| | `cierre_sin_publicar` | Estado | curso + período | Notas de cierre en `borrador` de un curso propio | No queda ninguna en borrador |
| Padre | `cuota` | Estado | cuota | Cuota de un hijo activo `pendiente` que vence en 5 días o menos (amarillo), o `vencida` (rojo) | Se paga |
| | `documentacion_hijo` | Estado | hijo | El hijo tiene documentación pendiente (criterio único) | Se completan los 3 documentos |
| | `nota_publicada` | Evento | evaluación + hijo | Se publica una evaluación con nota del hijo, o se le carga una nota a una evaluación ya publicada | — |
| | `cierre_publicado` | Evento | nota de cierre + momento de publicación | Se publica la nota de cierre (si vuelve a borrador y se republica, avisa otra vez) | — |
| | `observacion_nueva` | Evento | observación | Se registra una observación sobre el hijo | — |

Los textos y colores son los de hoy (`notificacion.service.ts`). Los agrupados dicen "Hay N cuotas vencidas" y "Hay N alumnos con documentación pendiente".

**Reglas de vida:**
- **Estado:** hay a lo sumo una fila por clave. Si la situación vuelve a darse después de resuelta, se **reabre la misma fila** (`resueltaEn` y `leidaEn` vuelven a vacío). Si cambia lo que dice (la cuota pasa a vencida, el número del agrupado **sube**), se actualizan el texto y el color y vuelve a **no leído**. Si el número del agrupado **baja**, solo se actualiza el texto.
- **Evento:** se crea una vez. Si llega de nuevo con la misma clave, se ignora.
- **Destinatarios:** solo cuentas `activa` (no `pendiente` ni `inactivo`), por rol. Padre: la cuenta vinculada al `Padre`. Profesor: la cuenta vinculada al `Profesor`. Una cuenta con varios roles tiene avisos separados por rol.
- **Preferencias:** si el destinatario apagó ese tipo para ese rol, el aviso no se crea.

## Arquitectura

### Tablero de anuncios (`core/eventos.ts`)

Pieza genérica, sin lógica de negocio. Cada módulo declara sus anuncios en `<modulo>.eventos.ts` (nombre y datos) y los publica desde su service. Los suscriptores se conectan en `container.ts`.

- `publicar(evento, tx)` se llama **dentro** de la transacción de la operación.
- Hay dos tipos de suscriptor:
  - **Dentro de la transacción:** corre en el momento, con el mismo `tx`. Si falla, la operación entera se deshace. Lo usan los avisos.
  - **Después de confirmar:** corre solo si la transacción se confirma. Si se deshace, se descarta. Si falla, se registra en el log y no afecta a nada. Lo usa el envío en tiempo real.
- `PrismaUnitOfWork` guarda los pendientes de "después de confirmar" de cada transacción y los ejecuta al terminar `$transaction`.
- Las operaciones que publican y hoy no usan transacción pasan a usarla: `publicarEvaluacion`, `crearEvaluacion`, `cargarNotaCierre`, `publicarNotaCierre`, `crearObservacion`, las de documentos y `marcarVencidas`.

### Avisos (`modules/notificaciones/`, ahora con entidad)

- `notificacion.entity.ts`, `notificacion.repository(.prisma).ts`, `notificacion.service.ts`, controller y routes.
- **Criterio en un solo lugar por tipo:**
  - Cada tipo de estado tiene una función de **sincronización** que calcula qué avisos tienen que estar abiertos en todo el instituto y abre, actualiza o resuelve las filas. Se sincroniza siempre el tipo completo (con el volumen del instituto son pocas consultas), bloqueando el tipo dentro de la transacción (`pg_advisory_xact_lock`) para que dos operaciones simultáneas no choquen.
  - Los anuncios de los módulos **no repiten ese cálculo**: solo piden sincronizar los tipos afectados, dentro de la transacción.
  - La revisión nocturna llama a las mismas funciones.
- Los eventos (`nota_publicada`, `cierre_publicado`, `observacion_nueva`) se crean directo desde su anuncio.
- **Criterio único de documentación** en `modules/documentos/` (función pura de documentos faltantes por alumno). Lo usan `notificaciones`, `reportes` (número del panel) y el endpoint nuevo de faltantes. Se eliminan las tres copias actuales.

**Qué anuncia cada módulo:**

| Módulo | Anuncio | Efecto en avisos |
|---|---|---|
| cuotas | cuotas vencidas (`marcarVencidas`), pago registrado, cuotas generadas | sincroniza `cuota` de esos alumnos y `cuotas_vencidas` |
| calificaciones | evaluación creada; evaluación publicada; notas cargadas; nota de cierre cargada; nota de cierre publicada | sincroniza `evaluacion_proxima`, `notas_sin_publicar`, `cierre_sin_publicar`; crea `nota_publicada` y `cierre_publicado` |
| asistencia | asistencia registrada | sincroniza `asistencia_pendiente` de ese curso |
| observaciones | observación creada | crea `observacion_nueva` |
| documentos | documento cargado, imagen autorizada, autorización manual, autorización revocada | sincroniza `documentacion_hijo` y `documentacion_pendiente` |
| alumnos | alumno inscripto; alumno modificado (estado, curso, padre) | sincroniza los avisos de estado de ese alumno y los agrupados |
| cursos / ciclos | curso modificado (horarios, profesor, estado); cambio de ciclo activo | sincroniza los avisos de ese curso / todo |
| usuarios | cuenta activada, reactivada o con un rol nuevo | sincroniza los avisos de esa cuenta |
| usuarios | sesiones cerradas (con ids y motivo) | corta esas conexiones en tiempo real (ver más abajo) |

**Tareas periódicas:**
- **Cada 15 minutos:** sincroniza `asistencia_pendiente`. Es la única que depende de la hora del día. Nueva función `programarTareaPeriodica` en `core/`, con el mismo manejo de errores que `programarTareaDiaria`.
- **03:00 y al arrancar** (`programarTareaDiaria`):
  - sincronización completa de todos los tipos de estado (incluye "por vencer", los 7 días de evaluaciones y el cierre a los 7 días de la asistencia);
  - limpieza: se borran los avisos con más de 30 días desde su última actualización, salvo los de estado abiertos.
  - Correrla dos veces seguidas no cambia nada la segunda vez.

### Tiempo real

**Servidor:**
- **Pieza intercambiable** (puerto en `core/ports.ts`, adaptador en memoria en `core/adapters/`): registra las conexiones abiertas y permite mandar una señal a una cuenta + rol o cortar sesiones. Si algún día hay varios servidores, se cambia el adaptador (por ejemplo, por uno con LISTEN/NOTIFY de PostgreSQL) sin tocar el resto.
- **`GET /api/tiempo-real`** (autenticado, con el mismo `authMiddleware` y la misma validación de sesión):
  - responde `text/event-stream` con `Cache-Control: no-cache, no-transform` y `X-Accel-Buffering: no`, para que ningún proxy acumule los mensajes;
  - manda un latido cada **25 s**;
  - **una conexión por sesión**: si se abre otra desde la misma sesión, la anterior se cierra;
  - límite de aperturas por sesión (**10 por minuto**, después 429).
- **Corte de la conexión:**
  - al vencer el token (`expiraEn`), con el motivo `vencida`;
  - cuando el tablero anuncia que se cerró esa sesión;
  - como red de seguridad, cada **5 minutos** se vuelve a validar la sesión.
- **Qué viaja: solo señales, nunca datos personales.**
  - `notificaciones` con `{ noLeidas }`: la pantalla vuelve a pedir la campana.
  - `sesion-cerrada` con `{ motivo }`.
  - El formato admite señales nuevas para 3b y 3c.
- **Destinatario:** la señal de avisos va a las conexiones de esa cuenta **con ese rol**. Silvana como profesora no recibe señales de sus avisos de administradora.

**Cierre de sesión remoto:**
- El anuncio "sesiones cerradas" lleva la cuenta y el motivo. El canal vuelve a validar las conexiones abiertas de esa cuenta con el validador de `authMiddleware` y corta las que ya no valen (`cerrarTodas` no cambia).
- Todos los caminos que cierran sesiones anuncian "sesiones cerradas" con un motivo: cerrar sesión, cerrar otra sesión o las demás desde Mi cuenta, cambiar o recuperar la contraseña, desactivar la cuenta (por usuarios o por la ficha del profesor) y el tope de 10 sesiones.
- Motivos según el camino:
  - `cerrada-por-el-usuario`: cerrar sesión (llega a las otras pestañas de esa misma sesión);
  - `cerrada-desde-otro-dispositivo`: cerrar otra sesión o las demás desde Mi cuenta, y el tope de 10 sesiones;
  - `contrasena-cambiada`: cambiar o recuperar la contraseña;
  - `cuenta-desactivada`: desactivar la cuenta;
  - `vencida`: vencimiento del token.
- Todas las pestañas de esa sesión van al inicio de sesión con el mensaje correspondiente (`/login?motivo=…`). Lo escrito sin guardar se pierde, igual que hoy al vencer la sesión.

**Navegador** (`client/src/core/tiempoReal/`):
- **Conexión:** se abre con `fetch` y se lee la respuesta a medida que llega. Reconexión con espera creciente: 1 s, 2 s, 4 s… hasta 30 s, con margen al azar. Al reconectar, vuelve a pedir la campana.
- **Ante un 401:** no reintenta y sigue el mismo camino que `apiClient` (sesión vencida).
- **Ante `sesion-cerrada`:** cierra la sesión local y va a `/login?motivo=…`.
- **Coordinación de pestañas por sesión:**
  - la clave es el `sid` leído del token;
  - una pestaña "líder" por sesión, elegida con Web Locks (`navigator.locks`, nombre `babylon-tiempo-real:<sid>`), mantiene la conexión y reparte las señales por `BroadcastChannel` con el mismo nombre;
  - si se cierra la líder, otra toma el lugar sola;
  - una pestaña descarta todo lo que no sea de su sesión.
  - Ambas APIs existen en todos los navegadores que el sistema ya exige (Chrome 111+, Safari 16.4+, Firefox 128+).
- Se monta en `AppLayout` y funciona para los cuatro roles. La campana deja de consultar cada 5 minutos: se actualiza con las señales y al reconectar.

## Pantallas

### Campana (`NotificationBell`)
- **Número de no leídos:** cuenta los avisos sin leer y sin resolver; muestra "9+" a partir de 10. Reemplaza al punto rojo actual.
- **Lista (hasta 10):** primero los no leídos y después los de estado abiertos ya leídos, de más reciente a más antiguo. Un aviso de estado leído pero sin resolver sigue a la vista, sin sumar al número.
- **Al tocar un aviso:** se marca leído y la pantalla navega al recurso. **Abrir la campana no marca nada.**
- **Pie:** "Marcar todas como leídas" y "Ver todas" (lleva a `/notificaciones`).

### Página `/notificaciones` (todos los roles)
- Avisos de los últimos 30 días del rol actual, del más reciente al más antiguo, agrupados en Hoy / Ayer / fecha. De a 50, con "Cargar más".
- **Filtros en la dirección:** `?filtro=todas|no-leidas|pendientes` (pendientes = de estado sin resolver).
- **Cada fila:** color, texto, cuánto hace que se actualizó y la marca "Resuelto" si corresponde. Al tocarla, se marca leída y lleva al recurso.
- Botón "Marcar todas como leídas". Se suma a `pageTitles.ts`; no va en el menú (se llega desde la campana).

### Preferencias (Mi cuenta → sección "Notificaciones")
- Muestra los tipos del rol con el que se entró, con un nombre legible y un interruptor cada uno. Todos encendidos por defecto.
- Se guardan por cuenta + rol.
- **Al apagar un tipo:** se borran los avisos de ese tipo de esa cuenta y rol (también del historial) y dejan de crearse.
- **Al encender un tipo:** se sincroniza en el momento, así los de estado vigentes reaparecen. Los eventos que pasaron mientras estaba apagado no vuelven.

### Del recurso a la dirección (`features/notificaciones/rutas.ts`)

El aviso guarda `recurso` (tipo e identificadores). La dirección se arma al tocarlo, según el rol:

| Recurso | Admin / secretaría | Profesor | Padre |
|---|---|---|---|
| Cuotas vencidas (agrupado) | `/cuotas?pestana=vencidas` | — | — |
| Documentación pendiente (agrupado) | `/alumnos?ciclo=activo&documentacion=pendiente` | — | — |
| Evaluación (próxima) | `/reportes` | — | — |
| Asistencia (curso + fecha) | — | `/asistencia?curso=…&fecha=AAAA-MM-DD` | — |
| Evaluación (sin publicar) | — | `/calificaciones?curso=…&evaluacion=…` | — |
| Cierre (curso + período) | — | `/calificaciones?curso=…&vista=cierre&periodo=…` | — |
| Cuota (hijo) | — | — | `/mis-hijos/cuotas?hijo=…` |
| Documentación (hijo) | — | — | `/mis-hijos/documentacion?hijo=…` |
| Nota / cierre publicado (hijo) | — | — | `/mis-hijos/calificaciones?hijo=…` |
| Observación (hijo) | — | — | `/mis-hijos?hijo=…` |

### Filtros en la dirección — tanda 1
- **Pieza común** (`client/src/core/hooks/`): lee y escribe los parámetros de la dirección con un valor por defecto y una validación por parámetro. Cambiar un filtro **reemplaza** la entrada del historial (`replace`), así "atrás" lleva a la pantalla anterior.
- **Un valor inválido o viejo** (un curso que no existe o no es propio, un hijo ajeno) se ignora y se usa el valor por defecto. La dirección no da permisos: el servidor sigue validando como hoy.
- **No van en la dirección:** el texto del buscador (nombres y DNI de menores), lo escrito sin guardar (notas, asistencia marcada, formularios) ni las ventanas abiertas.
- **Pantallas de esta tanda:**
  - `AlumnosListPage`: ciclo, cuota, curso, documentación y página;
  - `CuotasPage`: pestaña;
  - `AsistenciaProfesorPage`: curso y fecha;
  - `CalificacionesProfesorPage`: curso, vista, evaluación y período;
  - `ParentDashboardPage`: hijo (la pestaña ya sale de la ruta).

### Documentación pendiente en Alumnos
- **Filtro nuevo "Documentación":** Todas · Con documentación pendiente · Falta formulario de inscripción · Falta copia de DNI · Falta autorización de imagen. Queda en la dirección (`documentacion=pendiente|formulario_inscripcion|copia_dni|autorizacion_imagen`).
- **En cada fila (y en la tarjeta en celular)** se ve qué falta, por ejemplo "Falta DNI, imagen".
- **Endpoint nuevo `GET /api/documentos/faltantes`** (admin, secretario): devuelve `{ [alumnoId]: TipoDocumento[] }` solo para los alumnos activos a los que les falta algo, con el criterio único.
- **El número del panel de la secretaria** (`documentacionPendienteCount` de `/api/reportes/dashboard`) pasa a usar el mismo criterio.

## Datos

- **`Notificacion`:**
  - para quién: `usuarioId` (borrado en cascada con la cuenta) y `rol`;
  - qué es: `tipo` (enum `TipoNotificacion`), `clase` (`estado` | `evento`), `clave`, `tono`, `texto`, `recurso` (JSON con el tipo de recurso y sus ids);
  - fechas: `creadaEn`, `actualizadaEn`, `leidaEn?`, `resueltaEn?`;
  - `@@unique([usuarioId, rol, clave])`, más índices para la campana (`usuarioId, rol, resueltaEn, leidaEn`) y para la limpieza (`actualizadaEn`).
- **`NotificacionDesactivada`:** `usuarioId` (en cascada), `rol`, `tipo`, con `@@id([usuarioId, rol, tipo])`. Que exista la fila quiere decir "apagado".
- Migración nueva. **No se cargan avisos con datos inventados:** la primera sincronización (al arrancar) crea los avisos de estado que correspondan a los datos reales. Los eventos empiezan a registrarse desde la puesta en marcha.

## API

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/notificaciones` | todos | Campana del rol actual: `{ noLeidas, avisos }` (hasta 10). **Cambia la forma de la respuesta actual.** |
| `GET /api/notificaciones/historial?filtro=&antes=` | todos | Página `/notificaciones`: 30 días, de a 50, con cursor |
| `POST /api/notificaciones/:id/leida` | todos | Marca leído un aviso propio (204; 404 si no es propio del rol actual) |
| `POST /api/notificaciones/leer-todas` | todos | Marca leídos todos los del rol actual → `{ marcadas }` |
| `GET /api/notificaciones/preferencias` | todos | Tipos del rol actual con `activa` |
| `PATCH /api/notificaciones/preferencias/:tipo` | todos | `{ activa }` → 204; 400 si el tipo no corresponde al rol |
| `GET /api/tiempo-real` | todos | Conexión SSE (ver Tiempo real) |
| `GET /api/documentos/faltantes` | admin, secretario | Documentos faltantes por alumno activo |

Todo aviso se busca siempre por `usuarioId` **y** `rol` de la sesión: nunca se puede leer ni marcar un aviso de otra cuenta ni de otro rol de la misma cuenta.

## Pruebas

Método de los subproyectos 1 y 2: scripts `server/scripts/_*.ts` contra la base con datos `prueba-`/`prueba-tmp-` que se limpian al final, pruebas de la API con curl y recorridos reales en el navegador con Playwright. Nunca se tocan los datos reales de 2025 ni se invita a personas reales. Cada parte se prueba antes de implementarla.

- **Privacidad:**
  - un padre solo recibe avisos de sus hijos y un profesor solo de sus cursos;
  - la cuenta multi-rol ve avisos distintos por rol;
  - `leida`/`historial` de otra cuenta o de otro rol → 404 o vacío.
- **Atomicidad:**
  - si guardar el aviso falla, la operación se deshace (se verifica con una consulta directa a la base);
  - si la operación se deshace, no sale ninguna señal en tiempo real.
- **Reglas de vida:**
  - la misma clave no duplica;
  - la cuota pasa de por vencer a vencida en la misma fila, que vuelve a no leído;
  - pagar la resuelve;
  - el agrupado vuelve a no leído solo cuando el número sube;
  - un evento repetido se ignora;
  - el cierre republicado avisa otra vez.
- **Números que coinciden:** el aviso de documentación coincide con `/alumnos?documentacion=pendiente`, y el de cuotas vencidas con la pestaña Vencidas.
- **El tiempo, con fechas simuladas:** asistencia pendiente con la clase empezada o no, cierre a los 7 días, evaluación a 7 días, cuota a 5 días, limpieza a los 30 días.
- **Revisión nocturna:** correrla dos veces seguidas no cambia nada; repara un aviso borrado a mano.
- **Preferencias:** al apagar, se borran y no se crean más; al encender, vuelven los de estado; un tipo de otro rol → 400.
- **Conexión:**
  - sin token, o con el token en la dirección → 401;
  - la conexión se corta al vencer el token y al cerrar la sesión por cada camino;
  - una sola conexión por sesión;
  - el límite de aperturas responde 429;
  - los latidos llegan;
  - la reconexión espera cada vez más;
  - ante un 401 no reintenta.
- **Pestañas:**
  - dos pestañas de la misma sesión comparten una conexión;
  - dos sesiones de cuentas distintas en el mismo navegador no se cruzan avisos;
  - al cerrar la pestaña líder, otra toma su lugar;
  - el cierre remoto lleva a todas las pestañas al inicio de sesión con el motivo correcto.
- **Direcciones:**
  - cada tipo de aviso abre exactamente su recurso;
  - un id inválido o ajeno vuelve al valor por defecto;
  - "atrás" lleva a la pantalla anterior;
  - el buscador no aparece en la dirección.
- **Regresión:** las baterías de los subproyectos 1 y 2, `pnpm typecheck`/`build`/`lint` en ambos proyectos, y vistas en celular sin desborde horizontal.

## Fuera de alcance

- **Chat en vivo, "visto" y aviso de mensaje nuevo** (etapa 3b). **Pantallas que se actualizan solas y aviso de versión nueva** (etapa 3c). **Filtros en la dirección en el resto de las pantallas** (tanda 2, etapa propia).
- Avisos por email o notificaciones al celular con la página cerrada (web push).
- **Varios servidores:** la pieza de tiempo real y los límites de pedidos quedan en memoria; el cambio de adaptador está previsto pero no se hace.
- Inicio de sesión con cookie protegida (posible subproyecto propio, junto con el 2FA).
- **Feriados:** el sistema no tiene calendario de feriados. Una clase de feriado genera el aviso de asistencia pendiente, que se puede marcar leído y se cierra solo a los 7 días.
- Descartar un aviso de estado sin resolverlo.
