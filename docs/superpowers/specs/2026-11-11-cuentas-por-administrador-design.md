# Cuentas administradas por el administrador (sin correo)

## Intención

Hoy cada persona puede crear su propia cuenta (la invitación por correo), cambiar su contraseña, recuperarla por correo y
verificar su email. El instituto decidió que **solo el administrador** gestiona las credenciales: él asigna y modifica las
contraseñas y los datos de acceso de todos. Por eso se **elimina todo el envío de correos** y todo lo que dependía de él, y
se reorganiza el alta de cuentas alrededor de una persona: el administrador.

Quien lo usa: el administrador (único que toca cuentas), la secretaría (sigue dando de alta responsables y alumnos, pero ya
no crea accesos) y las familias y profesores (entran con lo que el administrador les dio y no pueden cambiarlo).

## Decisiones del usuario (tal cual las tomó)

1. Se quita **todo** el envío de correos, "por ahora": servidor de correo, adaptadores, variables de entorno y enlaces.
2. **Solo el administrador crea cuentas y contraseñas**; las escribe él (sin botón "Generar contraseña", al menos 8 caracteres).
3. Secretaría sigue dando de alta responsables y alumnos **sin cuenta**; el email que cargue es un dato de contacto. Se sacan
   de la inscripción las opciones de contraseña e invitación.
4. La pestaña "Pendientes" de Usuarios pasa a llamarse **"Sin cuenta"** y lista a los responsables y profesores que todavía
   no tienen cuenta, cada uno con un botón **"Crear cuenta"** (email y contraseña). El formulario **trae el email de la ficha
   ya completado** (el de la inscripción) si lo hay; si no, queda vacío.
5. Las cuentas que ya existen no cambian.
6. La tabla de Cuentas tiene un botón de edición (lápiz por fila). El administrador puede cambiar **nombre, email,
   contraseña y roles**. La contraseña es opcional al editar (vacía = no se toca). Cambiarla **cierra todas las sesiones
   abiertas** de esa persona. Activar/desactivar sigue siendo el interruptor de hoy.
7. Roles: **administrador y secretario** se agregan o quitan libremente; **padre y profesor** están atados a una ficha: se
   ven pero no se agregan ni quitan desde la edición (se vinculan al crear la cuenta desde "Sin cuenta"). La cuenta siempre
   conserva al menos un rol. Un administrador no puede quitarse a sí mismo el rol de administrador.
8. Se elimina la opción de cambiar la propia contraseña en "Mi cuenta": ninguna persona toca su contraseña ni su email.

## Objetivos

- El administrador crea la cuenta de un responsable o profesor en dos pasos: "Sin cuenta" → "Crear cuenta" (email
  autocompletado + contraseña).
- El administrador edita nombre, email, contraseña y roles de cualquier cuenta desde la tabla de Cuentas.
- No queda código, tabla, variable de entorno, ruta ni pantalla de: correo, invitaciones, activación, recuperación,
  verificación de email ni cambio de contraseña propio.
- Todo lo demás sigue funcionando igual (sesiones por dispositivo, inicio de sesión con varios roles, límites de intentos de
  inicio de sesión, avisos, chat).

## No-objetivos y anti-objetivos

- No hay recuperación ni cambio de contraseña por parte de la persona (ni por otro camino): quien olvida su contraseña se la
  pide al administrador. La pantalla de ingreso lo dice en un texto, no con un enlace.
- No se fuerza cambiar la contraseña en el primer ingreso (nadie puede cambiarla).
- No hay generador de contraseñas.
- No se toca el modelo de sesiones ni "Mantener sesión iniciada" (otro proyecto aparte).
- Anti-objetivo: dejar variables `SMTP_*`, `APP_URL`, `MAIL_FROM`, la dependencia `nodemailer` o pantallas muertas.
  Anti-objetivo: que el server deje de arrancar en producción por faltar una variable de correo.
- Anti-objetivo: tocar o perder datos reales (148 alumnos, padres reales, profesores reales, cuentas existentes).

## Restricciones

- La arquitectura feature-first, los errores de dominio, `UnitOfWork` con `tx` hasta el repositorio y los anuncios dentro de la
  transacción (ver `CLAUDE.md`) se respetan. Las reglas de validación se escriben una vez por tipo de dato (`core/validacion.ts`).
- Las cuentas existentes se conservan tal cual. Hoy hay 18 (15 activas y 3 inactivas) y ninguna pendiente.
- Migraciones de base de datos con respaldo previo (`pg_dump -Fc` a `~/respaldos-babylon/`) y **guardas** que frenen la
  migración si quedara algo que se perdería (cuentas `pendiente`).
- Servidor y cliente no comparten código: lo que cambie en un tipo (`Usuario`, `Rol`) se replica a mano.
- Las pruebas versionadas (`pruebas/`, `server/scripts/_*.ts`, `pnpm test`) se actualizan: se borran las de funciones que
  dejan de existir y se agregan las nuevas, y la batería (`pruebas/bin/bateria.sh`) tiene que pasar completa.

## El cómo que decidió el usuario

Todo lo de la sección "Decisiones del usuario". Lo que sigue son llamadas mías para completar el diseño; se marcan *(mi
decisión)* para que se puedan corregir.

### Qué se elimina

- **Servidor:** puerto `Mailer` y adaptadores `SmtpMailer`/`ConsoleMailer`; la dependencia `nodemailer`; las variables
  `SMTP_*`, `MAIL_FROM` y `APP_URL` (`JWT_EXPIRES_IN_RECORDAR` no se toca: es de "Mantener sesión iniciada"); las plantillas de
  correo (`correo*.ts`, `enlaces.ts`); `InvitacionService`, su controlador, rutas y esquemas; la tabla `TokenCuenta` y el enum
  `TipoTokenCuenta`; `Usuario.emailVerificadoEn`; el estado de cuenta `pendiente` (queda `activo`/`inactivo`); las rutas
  `olvide-contrasena`, `restablecer-contrasena`, `verificar-email`, `enviar-verificacion`, `cambiar-contrasena`,
  `activar-cuenta` (y su `consultar`), `invitaciones` (y `reenviar`/cancelar) y `pendientes`; los límites de pedidos de esas
  rutas (queda el de inicio de sesión); `PasswordActualIncorrectaError`; la tarea que limpiaba tokens si existe; el requisito de
  `SMTP_*` y `APP_URL` al arrancar en producción. `GET /api/auth/yo` deja de devolver `emailVerificado`.
- **Cliente:** páginas `ActivarCuentaPage`, `OlvideContrasenaPage`, `RestablecerContrasenaPage`, `VerificarEmailPage` y sus rutas;
  el enlace "¿Olvidaste tu contraseña?" de `LoginPage` (se reemplaza por el texto "Si olvidaste tu contraseña, pedísela a la
  administración del instituto"); en "Mi cuenta", `CambiarContrasena` y `EmailSinVerificar`; en Usuarios, `PendientesTab`,
  `ModoDeAcceso` y los hooks de invitar/reenviar/cancelar; en la inscripción, los campos de contraseña e invitación.
- **Datos:** la migración borra `TokenCuenta`, `Usuario.emailVerificadoEn` y el valor `pendiente` del enum. **Guarda:** si hubiera
  alguna cuenta `pendiente`, la migración se detiene.

### Alta de cuentas

- `POST /api/padres`, `POST /api/profesores` y la inscripción (`responsable` nuevo o propio) **no crean cuentas**: crean la
  ficha. El email es un dato de contacto opcional en el responsable y obligatorio en el profesor *(mi decisión: se mantiene
  como hoy)*. Se quitan `password` y la invitación de esos pedidos.
- **Nueva lista "Sin cuenta"** (`GET /api/auth/sin-cuenta`, admin): los responsables y profesores activos que no tienen
  cuenta, con el mismo criterio de población que usa hoy la pestaña Pendientes, y por fila: tipo, id, nombre y el email de
  la ficha (si hay).
- **Nueva operación "Crear cuenta"** (`POST /api/auth/cuentas`, solo admin): recibe `{ tipo: "padre" | "profesor", fichaId,
  email, password }`; crea el `Usuario` (activo, con rol `padre` o `profesor`, nombre tomado de la ficha, contraseña con
  `passwordNueva`) y lo vincula a la ficha en una sola transacción. Rechaza un email ya usado (409) y una ficha que ya tiene
  cuenta (409). *(Mi decisión:)* el email de la ficha pasa a ser el de la cuenta (si la ficha no lo tenía o era otro, se
  actualiza), para que no queden distintos.
- **Secretario y administrador** (cuentas sin ficha): `POST /api/auth/secretarios` y `/administradores` exigen `password`.
  *(Mi decisión:)* el modal "Crear usuario" de Usuarios queda solo para esos dos roles; padres y profesores se crean desde
  "Sin cuenta" (la ficha se da de alta en Inscribir alumno / Profesores).

### Edición de cuentas

- `PATCH /api/auth/usuarios/:id` (solo admin, esquema estricto): `nombre`, `email`, `password`, `roles`, todos opcionales.
  Escribe solo lo que vino (ver `actualizarParcial`).
- Email: único (409 si ya existe). En cuentas de padre o profesor se actualiza también el email de su ficha. *(Mi decisión:)*
  el nombre de una cuenta de padre o profesor **no se edita acá** (se ve de solo lectura): se cambia en su ficha, que ya lo
  sincroniza con la cuenta; el nombre de una cuenta de secretario o administrador sí se edita acá.
- Contraseña: `passwordNueva` (mínimo 8, máximo 72 bytes). Al cambiarla se cierran todas las sesiones de esa cuenta
  (`sesiones.cerradas` con motivo `contrasena-cambiada`). *(Mi decisión:)* si el administrador se edita a sí mismo, queda
  abierta la sesión desde la que lo hace y se cierran las demás.
- Roles: `admin` y `secretario` se agregan o quitan libremente; `padre` y `profesor` no se pueden agregar ni quitar (si el pedido
  los cambia, 400); la cuenta no puede quedar sin roles (400); un administrador no puede quitarse a sí mismo `admin` (400).
  *(Mi decisión:)* si cambian los roles de una cuenta, se cierran todas sus sesiones (la persona vuelve a entrar y elige entre
  los roles que le quedan); si es el propio administrador, se conserva la sesión actual.
- La interfaz: un lápiz en cada fila de la tabla de Cuentas abre un modal con esos campos; contraseña vacía = no se cambia.
  Mientras se edita, rige "Mientras editabas, X cambió…" y la protección de cambios sin guardar como en las demás ediciones.
- Desactivar/activar sigue en `PATCH /api/auth/usuarios/:id/estado` sin cambios.

### Mi cuenta e ingreso

- "Mi cuenta" conserva los datos de la sesión, las sesiones activas y las preferencias de notificaciones; pierde el cambio de
  contraseña y la verificación de email. *(Mi decisión:)* una línea explica "Para cambiar tu contraseña o tu email, pedíselo a
  la administración."
- La pantalla de ingreso conserva el casillero "Mantener sesión iniciada" (otro proyecto lo reemplaza) y gana el texto de
  ayuda para quien olvidó su contraseña.

### Pruebas y documentación

- Se borran los scripts que prueban lo eliminado (invitaciones, activación, tokens de cuenta, ficha pendiente, verificación del
  correo, recuperación) y se adaptan los que los usan de paso (`_mundo-avisos`, `_sesiones`, `_carrera-login`, `_menores`,
  `_minors-sub2`, `_3d-responsable`, `_3d-validacion-http`, el recorrido `e2e-3d-panel`). Se agregan scripts HTTP de crear cuenta,
  editar cuenta y reglas de roles, y un recorrido de navegador del administrador (Sin cuenta → Crear cuenta con email
  autocompletado → editar nombre/email/contraseña/roles) y de la familia ingresando con la contraseña asignada.
- `CLAUDE.md` se reescribe donde hablaba de invitaciones, recuperación, verificación, correo y cambio de contraseña (secciones
  de autenticación, "Recuperación de contraseña y envío de correos", panel de Usuarios y tabla de la API).

### Llamadas que cierran la revisión del diseño *(mi decisión todas)*

- **El email de una ficha con cuenta y el de la cuenta son el mismo.** Editar el email de la ficha (responsable o profesor)
  también cambia el de la cuenta, y editar el de la cuenta cambia el de la ficha. Si ya lo usa otra cuenta, 409 y no se cambia
  ninguno. Las 18 cuentas que hoy tienen un email distinto al de su ficha se emparejan la próxima vez que se edite alguno de
  los dos; no se toca nada de golpe.
- **Dos fichas pueden compartir un email de contacto** (hermanos de familias distintas, el mismo adulto): el email no es único
  en la ficha, solo en `Usuario`. Crear una cuenta con un email que ya usa otra cuenta es 409 con un mensaje claro.
- **Se conserva la regla "un responsable con cuenta no puede quedar sin email"** y el email del responsable `propio` sigue
  siendo opcional al inscribir (es un dato de contacto; la cuenta se crea después).
- **Desactivar es la única forma de retirar un acceso**: no hay "borrar cuenta" ni desvincular una ficha. Una cuenta no puede
  quedar sin roles, así que a quien solo tiene `admin` o `secretario` no se le quita el último: se la desactiva.

## Lo que queda al constructor

Nombres de archivos y de funciones, el texto exacto de los mensajes de error, la forma visual del modal de edición y de la
pestaña "Sin cuenta" (siguiendo el diseño actual), el orden de las migraciones y cómo migrar los scripts de prueba. Lo que se
borre debe borrarse del todo (sin dejar código comentado ni variables huérfanas).
