# Cuentas administradas por el administrador — Plan de implementación

> **Para quien ejecute:** usar superpowers:executing-plans (ejecución nativa, en esta sesión) o superpowers:subagent-driven-development. Los pasos usan casillas `- [ ]`.

**Goal:** que solo el administrador cree y modifique cuentas, contraseñas y roles, y eliminar todo el envío de correos y lo que dependía de él.

**Architecture:** se borra primero lo que sobra del servidor (correo, invitaciones, recuperación, verificación, cambio de contraseña propio, estado `pendiente`, `TokenCuenta`) con una migración con guardas; después se agregan tres operaciones del administrador en `usuarios/` (crear cuenta, editar cuenta, listar "Sin cuenta") apoyadas en el patrón de transacción + bloqueo de cuenta que ya existe; por último se rehace el cliente (pantalla Usuarios, Mi cuenta, ingreso, altas) y se adaptan las pruebas.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod, node:test y scripts `server/scripts/_*.ts`, React 19 + TanStack Query + react-hook-form, Playwright (recorridos en `pruebas/`).

**Spec:** `docs/superpowers/specs/2026-11-11-cuentas-por-administrador-design.md` (leerlo antes de empezar: es la autoridad ante cualquier duda de este plan).

## Global Constraints

- Rama: `cuentas-por-administrador`. Commits terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Arquitectura feature-first de `CLAUDE.md`: nada de carpetas `domain/`/`data/`/`presentation/`; los services reciben repositorios por constructor; `tx` hasta cada llamada al repositorio dentro de `runInTransaction`; anuncios publicados dentro de la transacción.
- Reglas de validación en `server/src/core/validacion.ts` (y su copia del client donde ya existe). Contraseñas: `passwordNueva` (mínimo 8, máximo 72 bytes). Esquemas de creación y edición `.strict()`.
- Los cambios en `Usuario` usan `actualizarParcial` (nunca reescribir la fila).
- Lo que se borra se borra del todo: sin código comentado, sin variables de entorno huérfanas, sin dependencias sin uso.
- **Datos reales intactos** (148 alumnos reales, 3 padres, profesores reales y las 18 cuentas existentes). Antes de migrar: `pg_dump -Fc` a `~/respaldos-babylon/antes-cuentas-admin-2026-11-11.dump`. Pruebas solo con el mundo `prueba-tmp-av` (`server/scripts/_mundo-avisos.ts`). `Configuracion.valorCuota` queda `null` al terminar.
- Los tipos duplicados entre server y client (`Rol`, `Usuario`) se replican a mano.
- Cada tarea termina con `pnpm typecheck` (server y/o client) en verde y un commit. La batería completa (`pruebas/bin/bateria.sh`) corre en la Tarea 6; las tareas 1–5 verifican con typecheck, `pnpm test` y los scripts nuevos o los que tocan lo cambiado (los scripts viejos que prueban lo eliminado se borran o adaptan en la Tarea 6).

## Review Focus

Entradas o condiciones que el spec implica y que ninguna prueba obvia cubriría; cada una tiene su prueba en la tarea que se indica.

1. Las 18 cuentas existentes siguen entrando después de migrar (hash, estado y roles intactos) — Tarea 1.
2. Dos pedidos simultáneos de "Crear cuenta" con el mismo email: uno crea o vincula y el otro no duplica (bloqueo `email:<email>`) — Tarea 2.
3. Dos fichas con el mismo email de contacto: la segunda cuenta no se crea sola; "Crear cuenta" intenta vincular y falla con un mensaje claro si la cuenta ya tiene ficha de ese tipo — Tarea 2.
4. Quitar `profesor` o `padre` desvincula la ficha pero conserva sus cursos/alumnos, cierra las sesiones y deja los avisos de ese rol resueltos — Tarea 3.
5. Un administrador no puede quedarse sin el rol `admin`, ni desactivarse, ni dejar al sistema sin ningún administrador activo; al editarse a sí mismo conserva su sesión — Tarea 3.
6. Contraseña de más de 72 bytes (la ñ y las tildes cuentan doble) y contraseña de 8 caracteres vacía de espacios: se rechazan — Tareas 2 y 3.

---

### Tarea 1: Servidor — sin correo, invitaciones, recuperación, verificación ni cambio de contraseña propio

**Files:**
- Delete: `server/src/core/adapters/SmtpMailer.ts`, `server/src/core/adapters/ConsoleMailer.ts`, `server/src/modules/usuarios/{correoHtml,correoInvitacion,correoRecuperacion,correoVerificacion,enlaces}.ts`, `invitacion.{controller,routes,schema,service}.ts`, `tokenCuenta.entity.ts`, `usuario.errors.ts` (si solo tenía `PasswordActualIncorrectaError`).
- Modify: `server/src/core/ports.ts` (quitar `Mailer`), `core/config.ts` (quitar `SMTP_*`, `MAIL_FROM`, `APP_URL` y el chequeo de producción), `core/middlewares/limitesDePedidos.ts` (quedan solo los límites de login), `container.ts`, `server.ts`, `server/package.json` (`pnpm remove nodemailer @types/nodemailer`), `.env.example`, `prisma/schema.prisma`, `prisma/seed.ts`, `modules/usuarios/usuario.{entity,repository,repository.prisma,schema,service,controller,routes,eventos}.ts`, `modules/padres/padre.{schema,service}.ts`, `modules/profesores/profesor.{schema,service}.ts`, `modules/alumnos/alumno.{schema,service}.ts`, `modules/cambios/cambio.entity.ts` (acciones `invitacion`).
- Create: `server/prisma/migrations/20261112130000_sin_correo_ni_invitaciones/migration.sql`.
- Test: `server/scripts/_sin-correo.ts`.

**Interfaces:**
- Produces: `Usuario` sin `emailVerificadoEn`; `EstadoUsuario = "activo" | "inactivo"`; `UsuarioService` con constructor `(usuarioRepo, sesionRepo, profesorRepo, unitOfWork, anuncios?)` (sin `mailer` ni `invitaciones`); `PadreService.crearFichaEnTransaccion(datos: DatosDeFichaInput, tx): Promise<{ padre: Padre }>` y `ProfesorService.crearFichaEnTransaccion(datos: CrearProfesorInput, tx): Promise<{ profesor: Profesor }>` (solo ficha, sin cuenta ni contraseña); `GET /api/auth/yo` → `{ id, nombre, email, rol }`; `POST /api/auth/secretarios|administradores` con `password` obligatorio (`passwordNueva`) → 201 con el usuario sin hash.
- Las rutas `olvide-contrasena`, `restablecer-contrasena`, `verificar-email`, `enviar-verificacion`, `cambiar-contrasena`, `activar-cuenta` (+ `consultar`), `invitaciones` (+ `reenviar`, `DELETE`) y `pendientes` dejan de existir (404).

- [ ] **Step 1: Escribir `_sin-correo.ts` (debe fallar).** Comprueba por HTTP, con el mundo `prueba-tmp-av`: cada ruta eliminada responde 404; `POST /api/auth/secretarios` sin `password` → 400 y con `password` de 7 caracteres → 400; con `password` válida → 201 y la cuenta puede iniciar sesión; `GET /api/auth/yo` no trae `emailVerificado`; `POST /api/padres` con `password` → 400 (campo desconocido) y sin él → 201 sin `usuarioId`; `POST /api/profesores` con `password` → 400 y sin él → 201 sin cuenta; `POST /api/alumnos` con `responsable.nuevo.datos.password` o `responsable.propio.password` → 400. Imprime `etiqueta: real (esperado X)` como los demás scripts.
- [ ] **Step 2: Correrlo y ver que falla** (`cd server && pnpm exec tsx scripts/_sin-correo.ts | python3 ../pruebas/bin/chequear.py` con la API levantada con `bash pruebas/bin/api.sh start`): esperado, falla por las rutas que todavía existen y por los campos que todavía se aceptan.
- [ ] **Step 3: Respaldo y migración.** `pg_dump -Fc` a `~/respaldos-babylon/antes-cuentas-admin-2026-11-11.dump`. Escribir `migration.sql` con: una guarda `DO $$` que falla si existe algún `Usuario` con `estado = 'pendiente'`; `DROP TABLE "TokenCuenta"`; `DROP TYPE "TipoTokenCuenta"`; `ALTER TABLE "Usuario" DROP COLUMN "emailVerificadoEn"`; y recrear `EstadoUsuario` sin `pendiente` (patrón Postgres: crear tipo nuevo, `ALTER COLUMN ... TYPE ... USING estado::text::"EstadoUsuarioNuevo"`, borrar el viejo, renombrar). Actualizar `schema.prisma` en el mismo sentido (quitar `tokens`, `emailVerificadoEn`, `pendiente`, `TokenCuenta`, `TipoTokenCuenta`). `pnpm exec prisma migrate deploy` + `prisma generate`. Probar la guarda restaurando el respaldo en una base temporal (`tmp_guarda`) con un `Usuario` en `pendiente` insertado: debe frenar; sin él, migrar.
- [ ] **Step 4: Borrar los archivos y el cableado** de "Files" y todo lo que quede sin uso (`pnpm typecheck` marca lo que falta). `UsuarioService`: quitar `solicitarRecuperacion`, `restablecerContrasena`, `enviarVerificacion`, `verificarEmail`, `cambiarContrasena`, `enviarEnlaceDeRecuperacion`, `yo.emailVerificado`, el estado `pendiente` en `listarUsuarios` y `cambiarEstado`; `crearSecretario`/`crearAdministrador` pasan a exigir contraseña y crean la cuenta activa en una transacción con los anuncios `cuenta.cambio` y `datos.cambiaron`. `PadreService`/`ProfesorService`/`AlumnoService.resolverResponsable`: quitar cuenta, contraseña e invitación al crear fichas (la ficha guarda `email` solo como contacto); `actualizarPadre` y `actualizarProfesor` pierden el caso "cuenta pendiente" (la sincronización de email con la cuenta se hace en la Tarea 3). Esquemas: quitar `password` y los `refine` asociados (`sinContrasenaSinEmail`).
- [ ] **Step 5: Verificar.** `pnpm typecheck`, `pnpm build`, `pnpm test` (la tabla de casos de validación que mencione `password` de ficha se ajusta) y `_sin-correo.ts` en verde. Comprobar que las 18 cuentas existentes siguen igual: `select count(*), count(*) filter (where estado = 'activo') from "Usuario"` = 18 y 15, e iniciar sesión con una cuenta de prueba por HTTP.
- [ ] **Step 6: Commit** `git add -A server && git commit -m "Servidor: sin correo, invitaciones, recuperación ni verificación de email"`.

### Tarea 2: Servidor — crear cuenta, lista "Sin cuenta" y búsqueda por email

**Files:**
- Modify: `server/src/modules/usuarios/usuario.{schema,service,controller,routes}.ts`, `usuario.repository.ts` y `.prisma.ts` (si hace falta), `modules/padres/padre.repository*.ts` y `profesores/profesor.repository*.ts` (lectura de fichas sin cuenta), `container.ts` (el `UsuarioService` recibe también `padreRepo`, `padreService`, `profesorService`).
- Test: `server/scripts/_cuentas-crear.ts`.

**Interfaces:**
- Produces, en `UsuarioService`:
  - `listarSinCuenta(): Promise<FilaSinCuenta[]>` con `FilaSinCuenta = { clave: "padre:<id>"|"profesor:<id>"; tipo: "padre"|"profesor"; fichaId: string; nombre: string; email: string | null }` — responsables sin `usuarioId` y profesores **activos** sin `usuarioId`, ordenados por nombre (es la población que hoy usa la pestaña Pendientes).
  - `buscarPorEmail(email: string): Promise<{ id: string; nombre: string; roles: Rol[] } | null>`.
  - `crearCuenta(datos: CrearCuentaInput): Promise<{ usuario: UsuarioSinPassword; vinculada: boolean }>`.
- Esquema: `crearCuentaSchema` (`.strict()`): `{ email: emailSchema; password: passwordNueva.optional(); nombre: textoRequerido("El nombre", 60).optional(); roles: z.array(rolSchema).min(1) sin repetidos; padre?: FichaRef; profesor?: FichaRef }` con `FichaRef = { fichaId: string } | { nueva: DatosDeFichaInput }` para padre y `{ fichaId } | { nueva: CrearProfesorInput }` para profesor. Reglas del esquema: `padre` presente ⇔ `roles` incluye `padre` (igual con `profesor`); `nombre` obligatorio si `roles` no incluye `padre` ni `profesor`.
- Rutas (solo `admin`): `GET /api/auth/sin-cuenta`, `GET /api/auth/usuarios/por-email?email=`, `POST /api/auth/cuentas` → 201 con `{ usuario, vinculada }`.
- Reglas de `crearCuenta` (una transacción; `usuarioRepo.bloquearCuenta(\`email:${email}\`, tx)` primero): si el email **no** pertenece a una cuenta, exige `password` (400 si falta), crea el `Usuario` activo con `roles`, `nombre` = `nombre` dado o el de la ficha (responsable primero); si **ya** pertenece a una cuenta, `vinculada = true`, **no** toca su contraseña ni su nombre (ignora `password`) y le agrega solo los roles pedidos que no tenía; 409 si pide `padre` y la cuenta ya tiene ficha de responsable, ídem `profesor`, o si la ficha ya tiene cuenta, o si pide un rol que la cuenta ya tenía. Cada ficha vinculada (`padreRepo/profesorRepo.vincularUsuario`) pasa a tener el email de la cuenta (`actualizarParcial`). Una ficha `nueva` se crea con `PadreService/ProfesorService.crearFichaEnTransaccion`. Anuncia `cuenta.cambio` y `datos.cambiaron` (`usuarios` alta o edición; `padres`/`profesores` edición).

- [ ] **Step 1: Escribir `_cuentas-crear.ts` (debe fallar).** Casos HTTP con el mundo de prueba: lista "Sin cuenta" trae los responsables y profesores activos sin cuenta (y no los inactivos ni los que ya tienen) con el email de la ficha; crear cuenta para un responsable con `{ roles: ["padre"], padre: { fichaId }, email, password }` → 201, el `Usuario` está activo, tiene la ficha vinculada y la ficha toma el email; el nuevo usuario inicia sesión; email ya usado por otra cuenta sin ficha de ese tipo → 201 con `vinculada: true`, misma contraseña de antes (la nueva se ignora) y rol agregado; email de una cuenta que ya tiene responsable pidiendo otro `padre` → 409; sin `password` y sin cuenta previa → 400; `password` de 7 caracteres, de 73 bytes ("ñ" × 37) y de 8 espacios → 400; `nombre` ausente con solo `admin` → 400; ficha `nueva` de profesor con cuenta en un solo pedido (ficha y cuenta se crean; si falla una, no queda ninguna: forzarlo con email repetido de otra cuenta que ya tiene profesor); `roles` con `padre` pero sin `padre` → 400; secretario y admin sin ficha → 201; **dos pedidos simultáneos con el mismo email nuevo (8 a la vez)** → exactamente una cuenta con ese email y los demás 201 vinculando o 409 sin duplicar; `GET por-email` devuelve la cuenta o `null`; todo lo anterior con un token que no es de admin → 403.
- [ ] **Step 2: Correrlo y ver que falla** (las rutas no existen).
- [ ] **Step 3: Implementar** lo de "Interfaces" y "Reglas". Nombrar los errores con mensajes claros: "Ese email ya tiene cuenta" no es error (es vinculación); "Esa cuenta ya tiene un responsable vinculado", "Esa ficha ya tiene cuenta".
- [ ] **Step 4: Correrlo y ver que pasa**; `pnpm typecheck` y `pnpm test`.
- [ ] **Step 5: Commit** `Servidor: crear cuenta del administrador, lista "Sin cuenta" y búsqueda por email`.

### Tarea 3: Servidor — editar cuenta (nombre, email, contraseña y roles) y emparejar el email con la ficha

**Files:**
- Modify: `usuario.{schema,service,controller,routes}.ts`, `modules/padres/padre.service.ts` y `modules/profesores/profesor.service.ts` (el email de la ficha se propaga a la cuenta), `padre.schema.ts` si hace falta.
- Test: `server/scripts/_cuentas-editar.ts`.

**Interfaces:**
- Produces: `UsuarioService.actualizarCuenta(id: string, datos: ActualizarCuentaInput, actor: { usuarioId: string; sesionId: string }): Promise<UsuarioSinPassword>`; `actualizarCuentaSchema` (`.strict()`): `{ nombre?: textoRequerido(…, 60); email?: emailSchema; password?: passwordNueva; roles?: Rol[] (min 1, sin repetidos); padre?: FichaRef; profesor?: FichaRef }` (`FichaRef` como en la Tarea 2: se usa para los roles `padre`/`profesor` que se **agregan**); ruta `PATCH /api/auth/usuarios/:id` (solo `admin`).
- Reglas (una transacción con `bloquearCuenta(id, tx)`; solo se escribe lo que vino):
  - `email`: único (409); en una cuenta con ficha(s) se actualiza también el email de cada ficha. Y al revés: `PadreService.actualizarPadre` y `ProfesorService.actualizarProfesor`, si la ficha tiene cuenta y cambian el `email`, cambian también el de la cuenta (409 si lo usa otra cuenta, sin cambiar ninguno).
  - `nombre`: en una cuenta con ficha de padre o profesor se rechaza (400, "El nombre se cambia desde la ficha"); en una sin ficha se actualiza.
  - `password`: `bcrypt` (10 rondas), cierra todas las sesiones de la cuenta (`sesionRepo.cerrarTodas(id, ahora, exceptoSesionId?, tx)`) y publica `sesiones.cerradas` con motivo `contrasena-cambiada`; si el actor se edita a sí mismo, `exceptoSesionId = actor.sesionId`.
  - `roles`: el resultado debe tener al menos un rol (400); `admin`/`secretario` se agregan o quitan; agregar `padre`/`profesor` exige `FichaRef` correspondiente y vincula (reglas de la Tarea 2); quitarlo desvincula la ficha (`usuarioId = null`; la ficha, sus alumnos y sus cursos no se tocan); un administrador no puede quitarse a sí mismo `admin` (400); no se puede dejar al sistema sin ningún administrador activo (400). Si cambian los roles se cierran todas las sesiones de la cuenta (salvo la del actor si es él mismo) con un motivo nuevo `roles-cambiados` (agregarlo a `MotivoCierre` en `core/ports.ts` y al texto del client) y se publica `cuenta.cambio` (los avisos de esa cuenta se recalculan: los del rol quitado quedan resueltos).
  - Publica `datos.cambiaron` (`usuarios` edición; `padres`/`profesores` edición si se vinculó o desvinculó una ficha).

- [ ] **Step 1: Escribir `_cuentas-editar.ts` (debe fallar).** Casos HTTP: cambiar email (y la ficha del padre toma el nuevo); email repetido → 409 y nada cambia; cambiar el email de la ficha de un responsable con cuenta (por `PATCH /api/padres/:id`) cambia también el de la cuenta, y con email de otra cuenta → 409 sin cambiar ninguno; ídem profesor; nombre de una cuenta de padre → 400, de una de secretario → 200; cambiar la contraseña: la sesión abierta de esa cuenta deja de valer (`GET /api/auth/yo` con su token → 401), puede entrar con la nueva y no con la vieja; contraseña de 7 caracteres, de 73 bytes y de 8 espacios → 400; sin `password` no se toca el hash ni se cierran sesiones; el admin se cambia su propia contraseña y su sesión sigue valiendo mientras las demás se cierran; agregar `secretario` a un admin → 200 con dos roles, y el inicio de sesión pide elegir rol; quitar `admin` a sí mismo → 400; quitar el último rol → 400; dejar sin administrador activo → 400; agregar `profesor` a un admin con una ficha sin cuenta → vincula (el profesor aparece con `usuarioId`) y la ficha toma el email; agregar `profesor` sin `FichaRef` → 400; quitar `profesor` a una cuenta con curso → la ficha queda sin `usuarioId` y el curso sigue siendo suyo, y la cuenta sin `profesor` en `roles`; cambiar roles cierra sus sesiones; `password` + `roles` + `email` en un solo pedido es atómico (forzar un 409 de email y comprobar que ni la contraseña ni los roles cambiaron); un campo desconocido → 400; no admin → 403; id inexistente → 404.
- [ ] **Step 2: Correrlo y ver que falla.**
- [ ] **Step 3: Implementar** según "Reglas".
- [ ] **Step 4: Correrlo y ver que pasa**; `pnpm typecheck`, `pnpm test`, y volver a correr `_cuentas-crear.ts`.
- [ ] **Step 5: Commit** `Servidor: el administrador edita nombre, email, contraseña y roles de una cuenta`.

### Tarea 4: Cliente — quitar lo que sobra (páginas públicas, Mi cuenta, ingreso y altas)

**Files:**
- Delete: `client/src/features/auth/pages/{ActivarCuentaPage,OlvideContrasenaPage,RestablecerContrasenaPage,VerificarEmailPage}.tsx`, `features/cuenta/components/{CambiarContrasena,EmailSinVerificar}.tsx`, `features/cuenta/hooks/{useCambiarContrasena,useEnviarVerificacion}.ts`, `features/usuarios/components/{ModoDeAcceso,PendientesTab}.tsx`, `features/usuarios/hooks/{useInvitar,useReenviarInvitacion,useCancelarInvitacion,usePendientes,accesos}.ts`.
- Modify: `core/routes/AppRoutes.tsx`, `features/auth/{authService,types}.ts`, `features/auth/pages/LoginPage.tsx`, `features/cuenta/{pages/MiCuentaPage.tsx,cuentaService.ts,types.ts}`, `features/padres/components/SelectorDeResponsable.tsx`, `features/padres/types.ts`, `features/alumnos/{pages/InscribirAlumnoPage.tsx,types.ts}`, `features/profesores/{pages/ProfesoresAdminPage.tsx,types.ts}`, `features/secretarios/types.ts`, `features/usuarios/{alta.ts,types.ts,usuarioService.ts}`, `features/cambios/{claves,mensajes,types}.ts`.
- Test: `pnpm typecheck` + `pnpm lint` + recorrido de la Tarea 6.

**Interfaces:**
- Consumes: el servidor de las tareas 1–3 (sin las rutas eliminadas).
- Produces: pantallas públicas solo `/login`; `LoginPage` sin el enlace "¿Olvidaste tu contraseña?" y con el texto "Si olvidaste tu contraseña, pedísela a la administración del instituto" (conserva "Mantener sesión iniciada"); `MiCuentaPage` con datos de la sesión, sesiones activas y preferencias de notificaciones, más la línea "Para cambiar tu contraseña o tu email, pedíselo a la administración."; inscripción y alta de profesor sin campos de contraseña ni "¿Cómo accede?"; el email de la ficha queda como "Email de contacto (opcional)".

- [ ] **Step 1: Borrar y desenganchar** lo listado; quitar de `claves.ts` la clave `["pendientes"]` (queda `["sin-cuenta"]` para la Tarea 5) y el motivo de cierre y las acciones de cambio que ya no existen en `mensajes.ts`/`types.ts`; agregar el texto del motivo `roles-cambiados` ("Tus permisos cambiaron: ingresá de nuevo").
- [ ] **Step 2: Verificar** `pnpm typecheck` y `pnpm lint` en `client/` (solo las 2 advertencias de siempre). Abrir `/login` y comprobar a mano que las cuatro rutas eliminadas dan 404/redirigen a `/login`.
- [ ] **Step 3: Commit** `Cliente: se quitan recuperación, activación, verificación y cambio de contraseña propio`.

### Tarea 5: Cliente — Usuarios: "Sin cuenta", "Crear cuenta", "Crear usuario" para cualquier rol y edición

**Files:**
- Create: `client/src/features/usuarios/components/{SinCuentaTab,CrearCuentaModal,EditarCuentaModal,SelectorDeFicha}.tsx`, `features/usuarios/hooks/{useSinCuenta,useCrearCuenta,useActualizarCuenta,useCuentaPorEmail}.ts`.
- Modify: `features/usuarios/pages/UsuariosPage.tsx` (pestañas Cuentas y "Sin cuenta"; botón "Crear usuario" abre `CrearCuentaModal` sin ficha preseleccionada; lápiz por fila abre `EditarCuentaModal`), `features/usuarios/{types.ts,usuarioService.ts}`, `features/usuarios/components/EtiquetaRol.tsx`, `features/cambios/claves.ts`, `core/components/layout/pageTitles.ts` si el subtítulo de Usuarios menciona invitaciones.
- Test: `pnpm typecheck`, `pnpm lint` y el recorrido `e2e-cuentas-admin` de la Tarea 6.

**Interfaces:**
- Consumes: `GET /api/auth/sin-cuenta`, `GET /api/auth/usuarios/por-email?email=`, `POST /api/auth/cuentas`, `PATCH /api/auth/usuarios/:id`, `PATCH /api/auth/usuarios/:id/estado` y `GET /api/auth/usuarios` (ya existe).
- Produces:
  - `CrearCuentaModal({ ficha?: FilaSinCuenta; onCerrar })`: con `ficha`, trae el **email de la ficha autocompletado** (editable) y el rol fijo; sin `ficha`, "Crear usuario": selector de uno o varios roles (admin, secretario, padre, profesor) y, para padre o profesor, `SelectorDeFicha` (elegir una ficha sin cuenta de la lista, o "Nueva ficha" con los datos mínimos que piden hoy las altas: responsable → nombre, apellido, celular; profesor → nombre, apellido, DNI, email). Campos: email, contraseña (con ojito, mínimo 8, máximo 72 bytes, sin botón de generar), nombre (solo si no hay ficha). Al escribir un email que ya es de una cuenta (consulta con `useCuentaPorEmail`, con demora de 300 ms) muestra el aviso "Ese email ya tiene cuenta (nombre): se le va a agregar el rol de …; su contraseña no cambia" y oculta el campo de contraseña. Errores del servidor repartidos con `erroresDeCampo`/`mensajeDeError`.
  - `EditarCuentaModal({ usuario; onCerrar })`: nombre (solo lectura en cuentas de padre/profesor, con la leyenda "se cambia desde la ficha"), email, contraseña nueva opcional (vacía = no se toca, con ojito), roles con casillas (admin y secretario libres; padre y profesor: al marcarlos aparece `SelectorDeFicha`; al desmarcarlos, confirmación "dejará de ver a sus hijos" / "dejará de tener sus cursos a cargo"). Manda solo lo que cambió (`cambiosParaEnviar`), usa `useFormularioAlDia` y `useSinGuardar`. Si el admin se edita a sí mismo, `admin` no se puede desmarcar.
  - `SinCuentaTab`: tabla con nombre, tipo (Responsable/Profesor), email de la ficha o "sin email", y botón "Crear cuenta"; buscador (texto fuera de la dirección); `?pestana=sin-cuenta` en la dirección como las otras pestañas (patrón ARIA actual).

- [ ] **Step 1: Escribir los hooks y tipos** (`FilaSinCuenta`, `CrearCuentaInput`, `ActualizarCuentaInput`, `CuentaPorEmail`) copiando la forma de los del servidor.
- [ ] **Step 2: Construir `SelectorDeFicha`, `CrearCuentaModal`, `EditarCuentaModal` y `SinCuentaTab`** siguiendo el diseño visual de `UsuariosPage` y los componentes de `core/components/ui/`.
- [ ] **Step 3: Enganchar en `UsuariosPage`** (pestañas, lápiz, botón "Crear usuario"); invalidar `["usuarios"]`, `["sin-cuenta"]`, `["padres"]` y `["profesores"]` al crear o editar.
- [ ] **Step 4: Verificar** `pnpm typecheck` y `pnpm lint`; abrir la pantalla con el servidor y Vite levantados y recorrerla a mano con el mundo de prueba.
- [ ] **Step 5: Commit** `Cliente: Usuarios con "Sin cuenta", Crear cuenta, Crear usuario y edición de cuentas`.

### Tarea 6: Pruebas — adaptar, borrar y agregar; batería completa

**Files:**
- Delete (prueban funciones eliminadas): `server/scripts/_invitaciones.ts`, `_activacion.ts`, `_token-cuenta.ts`, `_ficha-pendiente.ts`, `_verificar-mailer.ts`, `_menores.ts` si solo prueba recuperación, y cualquiera que quede sin objeto tras `pnpm typecheck`.
- Modify: `server/scripts/{_mundo-avisos,_sesiones,_carrera-login,_minors-sub2,_3d-responsable,_3d-validacion-http,_cambios-publicados,_tablero,_depuracion,_sesion-repo,_uso}.ts` (los que crean cuentas con `emailVerificadoEn`, `pendiente`, invitaciones o `password` de ficha), `pruebas/recorridos/e2e-3d-panel.js` y cualquier recorrido que use la recuperación o la activación, `server/tests/*.test.ts` si mencionan `password` de ficha, `pruebas/bin/bateria.sh` (lista de scripts), `pruebas/README.md`.
- Create: `pruebas/recorridos/e2e-cuentas-admin.js`.

**Interfaces:**
- Produces: `e2e-cuentas-admin` con 3 navegadores: (1) el administrador abre Usuarios → "Sin cuenta", pulsa "Crear cuenta" de un responsable del mundo con email cargado y comprueba que el **email viene autocompletado**, escribe la contraseña y crea; la fila desaparece de "Sin cuenta" y aparece en Cuentas; (2) la familia entra con esa contraseña en otra pestaña y ve su panel; (3) el administrador abre el lápiz de esa cuenta, cambia la contraseña: la sesión de la familia se cierra sola (llega a `/login`) y puede entrar con la nueva; agrega el rol `secretario` y comprueba que el ingreso pide elegir rol; quita `padre` con la confirmación y la ficha vuelve a "Sin cuenta"; "Crear usuario" crea un secretario y un profesor con ficha nueva; el email de una cuenta existente muestra el aviso de vinculación; `/olvide-contrasena` y las otras rutas eliminadas no muestran nada de recuperación; "Mi cuenta" no tiene cambio de contraseña. Un script `_sin-datos-reales.ts` no hace falta: la línea `BASE:` de la batería lo cubre.

- [ ] **Step 1: Borrar y adaptar** los scripts de la lista hasta que `pnpm exec tsx` de cada uno corra sin errores de import o de campos inexistentes (`grep -rn "emailVerificadoEn\|pendiente\|invitacion\|passwordHash.*hash\|Mailer" server/scripts pruebas` no debe devolver nada de lo eliminado).
- [ ] **Step 2: Escribir `e2e-cuentas-admin.js`** (selectores precisos: el buscador de la barra superior no es el de la pantalla; afirmar el id en la URL de cada `PATCH`/`POST`; solo sobre registros `prueba-tmp-av`).
- [ ] **Step 3: Agregar** `_sin-correo`, `_cuentas-crear` y `_cuentas-editar` a `bateria.sh` y quitar los borrados; actualizar `pruebas/README.md` (tabla de recorridos).
- [ ] **Step 4: Correr la batería completa** (`bash pruebas/bin/bateria.sh > /tmp/bateria-cuentas.log 2>&1`), en segundo plano, sin tocar archivos mientras corre. Esperado: ninguna línea "FALLA", todas "N bien, 0 mal", y `BASE: 3/148/0/null/inactivo`. Corregir lo que falle y repetir.
- [ ] **Step 5: Commit** `Pruebas: se adaptan a las cuentas administradas y se agregan las nuevas`.

### Tarea 7: Documentación

**Files:**
- Modify: `CLAUDE.md` (secciones de autenticación y roles → invitaciones y verificación, "Recuperación de contraseña y envío de correos", "Panel de Usuarios (Admin)", tabla de la API, "Alta de Secretario", la parte de `Padre`/`Profesor` que hablaba de invitaciones, `SmtpMailer`, variables de entorno, "Mi cuenta"), `server/.env.example`, `docs/superpowers/specs/…` (sin cambios), memoria del proyecto (`proyecto_babylon_pendientes_futuros.md`).

- [ ] **Step 1: Reescribir** las secciones de `CLAUDE.md` para que describan lo que existe ahora (cuentas administradas por el administrador, "Sin cuenta", `POST /api/auth/cuentas`, `PATCH /api/auth/usuarios/:id`, reglas de roles y vinculación de fichas, sin correo) y borrar lo que ya no existe. Dejar anotado como pendiente: recuperación de contraseña por el administrador es el único camino, y volver a agregar correo sería un proyecto nuevo.
- [ ] **Step 2: Verificar** que `grep -n -i "invitaci\|SMTP\|Mailer\|verificar-email\|olvide-contrasena\|restablecer\|APP_URL" CLAUDE.md server/.env.example` no devuelva menciones vigentes (solo históricas explícitas si se dejan).
- [ ] **Step 3: Actualizar la memoria** del proyecto y hacer el commit final `Documentación: cuentas administradas por el administrador`.
