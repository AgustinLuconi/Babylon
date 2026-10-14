# Invitación y verificación de email — Diseño

**Fecha:** 2026-10-09 · **Subproyecto 2 de 4** (1: Mi cuenta y sesiones ✔ · 2: este · 3: historial y preferencias de notificaciones · 4: autenticación en dos pasos)

## Objetivo

Que nadie tenga que inventar ni dictar contraseñas para dar acceso al sistema. Al dar de alta una cuenta, el instituto envía una **invitación por email** y la persona elige su propia contraseña; quien no puede recibir el correo en ese momento puede recibir una contraseña asignada en persona, y verifica su email después. Además, los padres y profesores **ya cargados sin cuenta** (los importados del ciclo 2025) pueden ser invitados desde una pestaña nueva en Usuarios, de a uno o en lote.

**Éxito:** el admin puede dar acceso a los padres reales desde una sola pantalla, filtrando y enviando muchas invitaciones a la vez; cada persona activa su cuenta sola con el enlace; y el sistema distingue con claridad quién no tiene cuenta, quién tiene la invitación pendiente, a quién se le venció y quién ya entró.

## Decisiones tomadas con el usuario

- Invitación por email **por defecto** en toda alta; el enlace vale **7 días**; la persona elige su contraseña; no puede iniciar sesión hasta activarla.
- Alternativa **"Asignar contraseña ahora"** (la ven admin y secretario): la cuenta nace activa con el email **sin verificar**; se verifica desde Mi cuenta con un enlace de **24 horas**.
- Activar una invitación o recuperar la contraseña con éxito marca el email como verificado.
- "¿Olvidaste tu contraseña?" sobre una cuenta con invitación pendiente **reenvía la invitación**.
- Los padres y profesores ya cargados sin cuenta **se pueden invitar**. El botón vive **solo en una pestaña "Pendientes" dentro de Usuarios** (solo admin), con filtros y envío individual o en lote; **todo envío pide confirmación**.
- Etiquetas visibles: **"Sin cuenta"**, **"Pendiente de aceptación"**, **"Invitación vencida"** (con el botón Reenviar resaltado), "Activa", "Inactiva".
- **Enfoque elegido:** la cuenta se crea al invitar, en estado *pendiente*; las tablas de enlaces se unifican en una sola con tipo.
- El email sigue siendo el nombre de usuario: **toda cuenta necesita email**. Entrar con DNI queda fuera de alcance.
- Las 12 cuentas existentes quedan con el email **sin verificar**.
- Los mensajes sobre el largo de la contraseña hablan de **caracteres**, no de bytes.

## Estados de acceso

La cuenta (`Usuario.estado`) suma el valor **`pendiente`**: creada por una invitación y todavía no activada. No puede iniciar sesión ni tiene contraseña utilizable (se guarda el hash de un valor aleatorio que nadie conoce, porque `passwordHash` no admite nulo).

La etiqueta que ve el admin se **calcula**, no se guarda:

| Etiqueta | Condición |
|---|---|
| Sin cuenta | Padre o Profesor con `usuarioId` nulo (los profesores inactivos no se listan ni se pueden invitar) |
| Pendiente de aceptación | Cuenta `pendiente` cuyo último enlace de invitación sin usar todavía no venció |
| Invitación vencida | Cuenta `pendiente` sin ningún enlace de invitación vigente |
| Activa / Inactiva | Como hoy |

`Usuario.emailVerificadoEn` (fecha, nula = sin verificar) registra la verificación.

La etiqueta refleja el enlace, no la entrega del correo: si el envío falló, la fila figura igual como "Pendiente de aceptación"; el admin se entera por el resumen del envío y puede reenviar.

## Pestaña "Pendientes" (Usuarios, solo admin)

`UsuariosPage` pasa a tener dos pestañas:
- **Cuentas:** la tabla actual, solo con cuentas activas e inactivas (las pendientes ya no aparecen acá).
- **Pendientes:** todas las personas que todavía no aceptaron: padres y profesores **sin cuenta**, y cuentas **pendientes** de cualquier rol (con invitación vigente o vencida).

Cada fila muestra nombre, email (o "—"), rol, etiqueta y, si hay invitación, "enviada el DD/MM · vence el DD/MM" (o "venció el DD/MM").

- **Filtros:** rol (padre, profesor, secretario, administrador), etiqueta (sin cuenta, pendiente de aceptación, invitación vencida) y buscador por nombre o email.
- **Selección:** casilla por fila y "marcar todas las visibles".
- **Acciones por fila:**
  - *Invitar* (sin cuenta). Deshabilitado con explicación si no tiene email (*"Cargá un email para poder invitar"*, el email del padre se carga en el legajo del alumno) o si su email ya pertenece a otra cuenta (*"Email repetido: ya pertenece a otra cuenta"*).
  - *Reenviar invitación* (pendiente o vencida; resaltado cuando está vencida).
  - *Cancelar invitación* (pendiente o vencida): borra la cuenta pendiente y la persona vuelve a "Sin cuenta". Sirve para corregir un email mal cargado.
- **Acciones en lote:** "Invitar seleccionados (N)" y "Reenviar seleccionados (N)". Solo cuentan las filas seleccionadas a las que la acción aplica.
- **Confirmación en todo envío y en cancelar:** modal *"¿Enviar invitación a María Gómez (maria@correo.com)?"*, en lote *"¿Enviar 40 invitaciones?"* con la lista de nombres, y *"¿Cancelar la invitación de …? Se borra la cuenta pendiente."* Botones Cancelar / Confirmar.
- **Resultado:** resumen *"38 enviadas · 2 no se pudieron enviar"* con el motivo de cada falla (sin email, email repetido, ya tiene cuenta, ya activada, esperá un minuto para reenviar, no se pudo enviar el correo).

**Dato práctico del arranque:** la planilla de 2025 no traía el email de la mayoría de los padres, así que esas filas aparecen con "Invitar" deshabilitado hasta que se cargue su email en el legajo del alumno.

## Altas de cuentas nuevas

En los tres lugares de alta, el campo de contraseña se reemplaza por **"¿Cómo accede?"**:

| Pantalla | Opciones |
|---|---|
| Usuarios → "Crear usuario" (admin, cualquier rol) | Enviar invitación por email (por defecto) · Asignar contraseña ahora |
| Inscribir alumno → padre nuevo (admin y secretario) | Enviar invitación por email (por defecto) · Asignar contraseña ahora |
| Profesores → nuevo profesor (admin) | Enviar invitación por email (por defecto) · Asignar contraseña ahora |

- **Invitación:** email obligatorio, sin contraseña. Se crea la cuenta `pendiente` y se envía el correo **después** de guardar. Si el envío falla, el alta igual queda hecha y se muestra *"La cuenta quedó creada pero no se pudo enviar el correo; reenviala desde Usuarios → Pendientes."*
- **Asignar contraseña ahora:** como hoy; la cuenta nace `activa` con `emailVerificadoEn` nulo.

En el server, las altas existentes (`POST /api/padres`, `POST /api/profesores`, `POST /api/auth/secretarios`, `POST /api/auth/administradores`) dejan de exigir `password`: **si viene, es "asignar ahora"; si no viene, es invitación.** (Corrección al revisar el código: la pantalla Profesores hoy **no** permite crear un profesor sin cuenta —exige contraseña—; los profesores sin cuenta vienen solo del importador. Por eso no hay opción "Sin acceso por ahora".)

## Activación (la persona invitada)

- **Correo:** asunto *"Te invitamos a Babylon English Institute"*, saludo con el nombre, botón **Activar mi cuenta** con `APP_URL/activar-cuenta?token=…`, y la aclaración *"El enlace vence el DD/MM y sirve una sola vez"*. Mismo estilo que el de recuperación.
- **Pantalla `/activar-cuenta`** (pública, armazón `AuthLayout`): quita el token de la barra (`history.replaceState`), consulta a quién pertenece y muestra *"Hola María, elegí tu contraseña"* con el email de la cuenta; pide contraseña y repetición (reglas de siempre). Al guardar lleva a `/login?motivo=cuenta-activada` con el aviso *"Cuenta activada. Ingresá con tu email y contraseña."* No inicia la sesión sola.
- **Enlace vencido, usado o inválido:** mensaje único *"El enlace no es válido o ya venció."* más *"Ingresá tu email en '¿Olvidaste tu contraseña?' y te enviamos una invitación nueva."* con el enlace a esa pantalla.
- Al activar, dentro de una transacción con el bloqueo de la cuenta: el enlace debe ser de tipo invitación, vigente y sin usar (marcado atómico); la cuenta debe seguir `pendiente`; se guarda la contraseña, `estado = activo`, `emailVerificadoEn = ahora`, y se anulan los demás enlaces de invitación. Si la cuenta ya no está pendiente, mismo mensaje único (400).

## Verificación de email

- **Mi cuenta** muestra, si `emailVerificadoEn` es nulo, el aviso *"Tu email no está verificado"* con el botón **Enviar enlace de verificación**. Al enviarlo: *"Te enviamos un enlace a maria@correo.com. Vence en 24 horas."* Mientras no verifique, nada se bloquea.
- **Correo:** asunto *"Verificá tu email — Babylon English Institute"*, botón **Verificar mi email**, `APP_URL/verificar-email?token=…`, vence en 24 horas, un solo uso.
- **Pantalla `/verificar-email`** (pública, `AuthLayout`): quita el token de la barra y lo confirma. Éxito: *"Listo, tu email quedó verificado."* con enlace a Mi cuenta (o al login si no hay sesión). Error: mismo mensaje único de enlace inválido, y *"Pedí uno nuevo desde Mi cuenta."*
- **Límites del envío:** como la recuperación, máximo 3 por hora y 1 minuto entre pedidos por cuenta; al superarlo responde 429 *"Ya te enviamos un enlace hace poco, probá de nuevo en unos minutos"*. Si ya está verificado: 400 *"Tu email ya está verificado"*. Pedir uno nuevo anula los anteriores de verificación.
- **Recuperar la contraseña con éxito** también deja `emailVerificadoEn = ahora` si estaba nulo.

## Interacción con lo que ya existe

- **Login:** una cuenta `pendiente` responde lo mismo que una inexistente o inactiva (*"Email o contraseña incorrectos"*, mismo tiempo de respuesta); no revela que la cuenta existe. Nunca se crea una sesión para una cuenta pendiente (el validador de sesión ya exige `activo`).
- **"¿Olvidaste tu contraseña?":** misma respuesta siempre. Si la cuenta está `activa`, sigue el flujo actual; si está **`pendiente`**, se envía **una invitación nueva** (anula la anterior) con los mismos límites por cuenta (3 por hora, 1 minuto entre pedidos) y por IP; si está `inactiva` o no existe, no se envía nada. Todo en segundo plano, como hoy.
- **`PATCH /api/auth/usuarios/:id/estado`** sobre una cuenta `pendiente`: 400 *"La cuenta todavía no fue activada"* (se gestiona desde Pendientes).
- **`GET /api/auth/usuarios`** ya no incluye las cuentas pendientes.
- **Reenviar:** anula los enlaces de invitación anteriores; espera mínima de **1 minuto** entre envíos a la misma cuenta (si no, el resultado de esa fila es "esperá un minuto para reenviar").
- **Cancelar invitación:** solo para cuentas `pendiente` (si ya se activó: 409 *"La cuenta ya fue activada"*). En una transacción con el bloqueo de la cuenta, desvincula el Padre/Profesor (`usuarioId = null`) y borra la cuenta; sus enlaces y sesiones se borran en cascada.
- **Carreras:** invitar, reenviar, cancelar y activar toman el bloqueo de la cuenta (`bloquearCuenta`), igual que los flujos del subproyecto 1. Dos invitaciones simultáneas a la misma persona sin cuenta: la segunda encuentra el `usuarioId` ya puesto ("ya tiene cuenta"), y la restricción única de `Usuario.email` frena las de email repetido ("email repetido").

## Datos

**`Usuario`:** `estado` admite `pendiente` (valor nuevo del enum `EstadoUsuario`); nuevo campo `emailVerificadoEn DateTime?`. Las 12 cuentas existentes quedan con `emailVerificadoEn` nulo.

**`TokenRecuperacion` → `TokenCuenta`** (renombre de tabla, mismos datos) con columna nueva `tipo` (enum `TipoTokenCuenta`: `recuperacion`, `invitacion`, `verificacion_email`); las filas existentes quedan como `recuperacion`. Vigencias: recuperación 1 hora, invitación 7 días, verificación 24 horas. Se sigue guardando solo el SHA-256 del enlace. Índice `(usuarioId, tipo, creadoEn)`.

Las migraciones se escriben a mano (renombres con `ALTER TABLE … RENAME`, enum con `ALTER TYPE … ADD VALUE`) y se aplican con `migrate deploy`, como en los subproyectos anteriores.

## API (bajo `/api/auth`)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /pendientes` | admin | Filas de la pestaña Pendientes con la etiqueta calculada, fechas de envío/vencimiento, y marcas `sinEmail` / `emailEnUso` |
| `POST /invitaciones` | admin | `{ padreIds?: string[], profesorIds?: string[] }` (máx. 100 en total) → crea la cuenta pendiente y envía la invitación a cada uno; responde `{ resultados: [{ id, nombre, resultado: "enviada" \| "no-enviada", motivo? }] }` |
| `POST /invitaciones/reenviar` | admin | `{ usuarioIds: string[] }` (máx. 100) → mismo formato de resultados |
| `DELETE /invitaciones/:usuarioId` | admin | Cancela la invitación (204; 404 si no existe; 409 si ya está activa) |
| `POST /activar-cuenta/consultar` | público | `{ token }` → `{ nombre, email }` para el saludo; 400 con el mensaje único si no sirve |
| `POST /activar-cuenta` | público | `{ token, password }` → 204; 400 con el mensaje único |
| `POST /enviar-verificacion` | autenticado | Envía el enlace de verificación (204; 400 si ya verificado; 429 por límite) |
| `POST /verificar-email` | público | `{ token }` → 204; 400 con el mensaje único |
| `GET /yo` | autenticado | `{ id, nombre, email, rol, emailVerificado }` (la usa el aviso de Mi cuenta) |

`activar-cuenta`, `activar-cuenta/consultar` y `verificar-email` tienen límite por IP de 5 cada 15 minutos (como `restablecer-contrasena`). El token viaja en el cuerpo (POST), nunca en la URL de la API.

## Organización del código

- **Server, módulo `usuarios/`** (dueño de `Usuario` y `TokenCuenta`):
  - `invitacion.service.ts` (nuevo): `crearCuentaInvitada` (la usan las altas), `invitar`, `reenviar`, `cancelar`, `listarPendientes`, `consultarInvitacion`, `activarCuenta`. Depende de `UsuarioRepository`, `PadreRepository`, `ProfesorRepository`, `UnitOfWork` y `Mailer`, inyectados por `container.ts`.
  - `UsuarioService`: verificación de email (`enviarVerificacion`, `verificarEmail`), `yo`, y los cambios en recuperación/login/estado.
  - Correos nuevos `correoInvitacion.ts` y `correoVerificacion.ts`, junto a `correoRecuperacion.ts`.
  - Los métodos de enlaces de `UsuarioRepository` pasan a ser genéricos con `tipo` (crear, buscar por hash, buscar desde una fecha, anular por cuenta y tipo, marcar usado).
- **`PadreService` y `ProfesorService`** reciben `InvitacionService` por constructor y lo usan cuando el alta no trae contraseña. No hay dependencias circulares: `InvitacionService` usa repositorios, no services.
- **El correo se envía después de confirmar la transacción**, nunca dentro; una falla de envío se informa en el resultado sin deshacer el alta.
- **Client:**
  - `features/usuarios/`: pestañas Cuentas/Pendientes, `PendientesTab`, modal de confirmación y resumen de resultados.
  - `features/auth/pages/`: `ActivarCuentaPage` y `VerificarEmailPage`.
  - `features/cuenta/`: componente `EmailSinVerificar`.
  - Selector compartido `ModoDeAcceso` (en `features/usuarios/components/`) usado por el modal de Usuarios, la inscripción y Profesores.
- **Mensaje del largo de la contraseña** (server `core/validacion.ts` y client `core/lib/validacion.ts`): *"La contraseña es demasiado larga: el máximo son 72 caracteres (las tildes y la ñ cuentan doble)"*. El límite real sigue midiéndose en bytes; solo cambia cómo se explica.

## Pruebas (antes de implementar cada parte; scripts y Playwright como en los subproyectos anteriores)

- Invitar a un padre sin cuenta: queda `pendiente`, vinculado, sale un correo con un enlace de 7 días; su fila pasa a "Pendiente de aceptación".
- Login de una cuenta pendiente: mismo mensaje y sin sesión.
- Activar: contraseña guardada, `activa`, email verificado, enlace de un solo uso; con el enlace vencido, usado o de otro tipo: 400 con el mensaje único.
- Vencimiento: pasados 7 días la etiqueta es "Invitación vencida"; reenviar crea un enlace nuevo y anula el viejo; reenviar antes de 1 minuto: "esperá un minuto".
- Cancelar: borra la cuenta pendiente y la persona vuelve a "Sin cuenta"; sobre una cuenta activa: 409.
- "¿Olvidaste tu contraseña?" con cuenta pendiente: se envía una invitación nueva (no un enlace de recuperación); respuesta idéntica en todos los casos.
- Recuperar la contraseña con éxito marca el email verificado.
- Verificación: enviar (y sus límites: 1 minuto, 3 por hora), verificar, ya verificado (400), enlace inválido.
- Invitación en lote con fallas parciales: sin email, email repetido, ya tiene cuenta; las demás se envían.
- Dos invitaciones simultáneas a la misma persona: una sola cuenta.
- Altas con y sin contraseña en los tres lugares.
- La migración conserva los enlaces de recuperación existentes (siguen sirviendo).
- E2E: pestaña Pendientes (filtros, selección, confirmación, resumen), pantalla de activación completa, verificación desde Mi cuenta, y la elección "¿Cómo accede?".

## Fuera de alcance

- Editar nombre o email de una cuenta, y cambiar el email con verificación.
- Entrar con DNI (cuentas sin ningún email).
- Invitar desde el legajo del alumno o desde la pantalla Profesores (decisión: solo desde Pendientes).
- Bloquear funciones a quien no verificó su email.
- Envío de correos en segundo plano con cola persistente: los lotes se envían durante el pedido, hasta 100 por vez.
