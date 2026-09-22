# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

Babylon es un sistema de gestión académica para un instituto de inglés real (Babylon English Institute, ~130 alumnos, 5 profesores), y a la vez el Proyecto Final de Carrera de Agustín Luconi (Práctica Profesional III). Cuatro roles con acceso estrictamente diferenciado: **Administrador** (acceso total), **Secretario** (legajos, cuotas/pagos, observaciones), **Profesor** (solo sus propios cursos), **Padre/Madre/Tutor** (solo lectura de sus propios hijos, privacidad absoluta entre alumnos).

Es un monorepo con `server/` (API) y `client/` (SPA) totalmente independientes — no hay código compartido entre ambos.

## Comandos

**Toolchain (desde 2026-09-21):** Node **24 LTS** (`.nvmrc` en la raíz → `nvm use`; los `package.json` declaran `engines`) y **pnpm 11** (`packageManager` en cada `package.json`), con un `pnpm-lock.yaml` por proyecto (`client/` y `server/` siguen siendo independientes, no hay workspace). pnpm bloquea por seguridad los scripts de instalación de las dependencias: los permitidos están en `client/pnpm-workspace.yaml` (`esbuild`) y `server/pnpm-workspace.yaml` (`@prisma/client`, `@prisma/engines`, `bcrypt`, `esbuild`, `prisma`). Si al agregar una dependencia nativa `pnpm install` falla con `ERR_PNPM_IGNORED_BUILDS`, agregarla ahí con `true`. El campo `pnpm` de `package.json` ya no se lee en pnpm 11.

**TypeScript 6 (desde 2026-09-22; antes 5.9; NO se llegó a la 7)**: TS 7 es la reescritura nativa del compilador en Go ("tsgo") — se probó (typecheck, build y el server/client reales funcionan bien con TS 7.0.2) pero **`typescript-eslint` la rechaza explícitamente** (`Error: typescript-eslint does not support TS 7.0`, falla dura, no warning) — `pnpm lint` deja de andar por completo. Se quedó en TS 6.0.3, la última versión "clásica" (mismo motor de tipos que la 5.x) y la última con la que el ecosistema de lint funciona. Retomar la 7 cuando `typescript-eslint` la soporte. Dos opciones de tsconfig quedaron removidas en ambas versiones (6 y 7): `baseUrl` (TS5102, ya no se lee — alcanza con `paths` solo, Vite resuelve el alias `@/*` por su cuenta vía `resolve.alias` en `vite.config.ts`, no depende de esto) y `moduleResolution: "Node"`/`node10` (TS5108, eliminado — el server no declara `moduleResolution` explícito, TS lo infiere de `module: "CommonJS"`).

**Tailwind CSS 4 (desde 2026-09-21; antes 3.4)**: no hay `tailwind.config.ts` ni `postcss.config.js` — la configuración vive en `client/src/index.css` (`@import 'tailwindcss'`, bloque `@theme`) y Tailwind entra por el plugin `@tailwindcss/vite` (`vite.config.ts`). Se migró con `@tailwindcss/upgrade` y se verificó comparando 39 capturas antes/después (36 idénticas al píxel; el resto, diferencias menores explicadas). Particularidades de v4 que ya causaron regresiones y hay que recordar: (1) `!` de importante va al final (`mb-0!`) y **anula el `margin-bottom` que `space-y-*` aplica** — no ponerlo en elementos dentro de un `space-y-*`; (2) `space-y-*` ahora usa `margin-bottom` sobre los hijos que no son el último, así que **se suma** a un `mt-*` del hijo (en v3 lo pisaba) y cuenta hijos ocultos por CSS (`md:hidden`); (3) el interlineado de `text-sm`, etc. ya no es fijo: se restauraron los valores de v3 en `@theme` (`--text-*--line-height`) para que las tablas no cambien de alto; (4) `rounded` → `rounded-sm`, `shadow-sm` → `shadow-xs`, `outline-none` → `outline-hidden`; (5) CSS propio sin capa (`.input`, `.label`, `.btn-*`…) le gana a las utilidades de Tailwind (que están en `@layer`) salvo que estas usen `!`. `tailwind-merge` es 3.x (entiende los nombres de v4). Requiere Safari 16.4+/Chrome 111+/Firefox 128+.

### server/ (API)
```bash
pnpm dev              # levanta la API con recarga en caliente (tsx watch)
pnpm typecheck        # tsc --noEmit
pnpm build            # compila a dist/
pnpm prisma:generate  # regenerar el cliente de Prisma tras tocar schema.prisma
pnpm prisma:migrate   # crear/aplicar una migración
pnpm prisma:studio    # explorador visual de la base de datos
pnpm prisma:seed      # datos de desarrollo (admin/secretario/profesor/padre + curso/alumno/cuota de ejemplo)
```
No hay test runner configurado todavía (ni Jest ni Vitest) — si se agrega, actualizar esta sección.

### client/ (SPA)
```bash
pnpm dev         # servidor de desarrollo de Vite (puerto 5173)
pnpm typecheck   # tsc -b --noEmit
pnpm lint        # ESLint (flat config en eslint.config.js)
pnpm build       # typecheck + build de producción
```

### Infraestructura
```bash
docker compose up -d   # levanta únicamente PostgreSQL (server y client corren con pnpm dev, no en Docker)
```
**PostgreSQL 18 (desde 2026-09-21; antes 16)**: la imagen es `postgres:18-alpine`. En la 18 los datos viven en `/var/lib/postgresql/18/docker`, así que el volumen se monta en `/var/lib/postgresql` (no en `.../data` como en la 16) y se usa un volumen nuevo, `babylon_postgres18_data`. Un cambio de versión **mayor** no puede reutilizar el volumen anterior: se hace con `pg_dump -Fc` + `pg_restore --no-owner` (así se migró). El volumen viejo de la 16 (`babylon_postgres_data`) se dejó sin tocar como marcha atrás: para volver, restaurar `image`/volumen en `docker-compose.yml` y `docker compose up -d`. Los respaldos con datos reales viven **fuera del repo** (`~/respaldos-babylon/`).

Cada proyecto tiene su `.env.example` — copiarlo a `.env` antes de correr `pnpm dev`. **El contenedor mapea el puerto 5433 del host (no el 5432 estándar)** porque la máquina de desarrollo original tenía una instalación nativa de PostgreSQL ocupando el 5432 — `DATABASE_URL` en `.env`/`.env.example` ya apunta a 5433. Si tu máquina no tiene ese conflicto, podés cambiar ambos a 5432 sin problema, pero mantené `docker-compose.yml` y `DATABASE_URL` coordinados entre sí.

## Arquitectura — regla central: 100% feature-first

**Nunca crear carpetas de nivel superior `domain/`, `data/` o `presentation/`.** La organización es por feature de negocio, no por capa técnica:

- **`core/`** (en ambos proyectos) contiene *solo* lo transversal a todos los módulos: interfaces genéricas, errores de dominio, middlewares, conexión a la base de datos, utilidades sin estado. Nunca lógica de negocio de un módulo específico.
- **`modules/`** (server) / **`features/`** (client): una carpeta por feature de negocio. Cada carpeta trae **todas** sus capas juntas en archivos separados, no en subcarpetas por tipo.

### Anatomía de un módulo de server (ej. `modules/alumnos/`)

| Archivo | Responsabilidad | Regla estricta |
|---|---|---|
| `*.entity.ts` | Entidad pura | Jamás importa Express, Prisma, ni ninguna librería externa — solo tipos de `core/ports.ts` si corresponde (ej. `Rol`) |
| `*.schema.ts` | Validación con Zod | Define el input de cada caso de uso |
| `*.repository.ts` | Puerto (interfaz) | Extiende `Repository<T, ID>` de `core/ports.ts` |
| `*.repository.prisma.ts` | Adaptador real | Implementa el puerto con Prisma (`PrismaClient` inyectado por constructor). Todos los métodos aceptan un `tx?: unknown` opcional al final — ver "UnitOfWork" para por qué |
| `*.service.ts` | Casos de uso / reglas de negocio | Recibe el repositorio **por constructor** (inyección de dependencias), nunca lo instancia. Lanza errores de `core/errors.ts`, nunca códigos HTTP |
| `*.controller.ts` | Única capa que conoce HTTP | Traduce request/response; los errores de dominio los traduce el `errorHandler` central, no el controller |
| `*.routes.ts` | Definición de rutas Express del módulo | |

`container.ts` (en `server/src/`, no dentro de ningún módulo) es el **único** lugar donde se decide qué implementación de repositorio recibe cada service. Ningún otro archivo debe instanciar un repositorio directamente. **Los `*.repository.fake.ts` (adaptador en memoria) se usaron desde FASE 2 hasta la migración a Prisma (2026-08-01) y ya no existen** — se eliminaron junto con `FakeUnitOfWork` en cuanto quedaron sin ningún consumidor (mismo criterio de "no dejar código muerto" ya aplicado antes con el endpoint individual de asistencia). Si en algún momento se agrega un test runner y hacen falta test doubles, se reescribirían desde cero con ese propósito explícito, no resucitando los viejos.

### Convención de nombres de módulo/entidad

La carpeta del módulo lleva el **plural de la entidad principal (agregado raíz)**, no un nombre genérico de la feature. Las entidades secundarias viven en el mismo módulo con su propio nombre:

- `cuotas/` → principal `Cuota`, secundaria `Pago`
- `cursos/` → principal `Curso`, secundaria `Horario`
- `calificaciones/` → principal `Calificacion`, secundarias `Evaluacion` y `NotaCierre`
- `chats/` → principal `Chat`, secundaria `Mensaje`
- `observaciones/` → principal `Observacion`, secundaria `CategoriaPersonalizada`

Las entidades secundarias normalmente no tienen su propio `*.repository.ts` — se gestionan a través de métodos extra en el repositorio de la entidad principal (ej. `CuotaRepository.registrarPago(pago)`).

**`CategoriaPersonalizada` (scoping por curso, mismo comportamiento que `Evaluacion`)**: además de las 4 categorías predefinidas (`academico`, `comportamiento`, `felicitacion`, `administrativo`), un profesor puede crear categorías propias para un curso puntual (`POST /api/observaciones/categorias`, ownership validado por `verificarDuenoDelCurso`). `Observacion.categoria` es `string` (no un enum) porque guarda tanto el literal predefinido como el `id` de una `CategoriaPersonalizada`; `ObservacionService.crearObservacion` valida que, si no es una de las 4 predefinidas, exista una `CategoriaPersonalizada` con ese `id` cuyo `cursoId` coincida con el curso del alumno — si no, `ValidationError` (400). La categoría creada por un profesor **no se comparte** con otros cursos ni otros profesores.

### Errores de dominio (`core/errors.ts`)

`DomainError` es abstracta; toda subclase declara su propio `statusCode`. El `errorHandler` central (`core/middlewares/errorHandler.ts`) traduce cualquier `DomainError` a HTTP automáticamente — los controllers solo hacen `throw`, nunca `res.status(...)` para errores de negocio, y ni siquiera necesitan `try/catch`: **Express 5** reenvía nativamente a `next(err)` cuando un handler async rechaza una promesa (`express-async-errors`, que hacía esto en Express 4, se sacó en la migración a Express 5 — dejó de funcionar porque parcheaba un archivo interno, `express/lib/router/layer`, que cambió de lugar en la v5; el paquete además quedó redundante).

| Clase | HTTP | Cuándo |
|---|---|---|
| `EntityNotFoundError` | 404 | El recurso no existe |
| `ConflictError` | 409 | Estado inconsistente (DNI duplicado, cuota ya pagada, autorización ya aceptada) |
| `ValidationError` | 400 | Input inválido más allá de lo que ya cubre Zod |
| `AuthenticationError` | 401 | Credenciales inválidas (login) |
| `AuthorizationError` | 403 | El usuario autenticado no es dueño del recurso (profesor sobre un curso ajeno, padre sobre un alumno ajeno) |

### Autenticación y roles

`Rol` (`"admin" | "secretario" | "profesor" | "padre"`) vive en `core/ports.ts`, no en `modules/usuarios` — `core/` no puede depender de `modules/*`, pero `authMiddleware.ts` (transversal) necesita ese tipo para tipar `req.auth.rol`.

- `authMiddleware` verifica el JWT y agrega `req.auth = { sub, rol }`.
- `requireRole(...roles)` es un guard de nivel de ruta para chequeos de rol genéricos.
- Los chequeos de **propiedad sobre un recurso específico** (¿es este profesor dueño de este curso puntual?, ¿es este padre dueño de este alumno puntual?) van **dentro del service**, no en middleware, porque dependen de datos — lanzan `AuthorizationError`.

### Cuentas con más de un rol (ej. dueño del instituto que también dicta clases)

`Usuario.roles: Rol[]` (plural) — una cuenta puede tener habilitado más de un rol. El **JWT sigue llevando un solo rol activo por sesión** (`{ sub, rol }`, singular) — este es el punto clave de la decisión: `requireRole`, todos los controllers, y el `Rol` del client **no cambiaron nada**, porque lo único que varía es cómo se llega a tener ese rol único en el token.

`UsuarioService.autenticar` devuelve una unión discriminada por `requiereSeleccionRol`:
- Si `usuario.roles.length === 1`: sesión completa de una (`{ requiereSeleccionRol: false, token, usuario }`), como siempre.
- Si tiene más de uno y el body de `POST /api/auth/login` no manda `rolElegido`: devuelve `{ requiereSeleccionRol: true, rolesDisponibles: Rol[] }` — **sin token todavía**.
- El client vuelve a llamar al mismo endpoint con las mismas credenciales + `rolElegido` (no hace falta un token intermedio ni estado en el server entre los dos pasos — es stateless). Si `rolElegido` no está en `usuario.roles`, `ValidationError` (400).

`LoginPage.tsx` maneja el flujo en dos pasos: guarda las credenciales en estado local tras el primer submit, y si la respuesta pide selección de rol, muestra un botón por cada rol disponible (`ROL_LABELS` en `features/auth/types.ts`, reusado también en `AppLayout`) que reenvía las mismas credenciales + el rol elegido.

`container.ts` siembra a Silvana Linares con `roles: ["admin", "profesor"]` (además de su `Padre`/`Profesor` real correspondiente) como ejemplo de cuenta multi-rol para probar el flujo.

### UnitOfWork (operaciones atómicas multi-registro)

`UnitOfWork<TContext>` (`core/ports.ts`) es genérico — no sabe nada de Prisma. `PrismaUnitOfWork` (`core/adapters/`) lo implementa con `Prisma.TransactionClient` real (`this.prisma.$transaction(work)`). Se usa para operaciones que tocan múltiples registros a la vez: `CuotaService.registrarPago` (pagar varias cuotas), `PadreService.crearPadre`/`ProfesorService.crearProfesor` (alta de Usuario + entidad), `AsistenciaService.registrarAsistenciaMasiva` y `CalificacionService.cargarCalificaciones` (cargar notas de toda una nómina en una sola operación "todo o nada" — esta última además valida que cada `alumnoId` pertenezca a la nómina del curso de la evaluación, `ValidationError` si no). **`CalificacionService.cargarNotaCierre` no usa `UnitOfWork`** a propósito: es un upsert por alumno sin conflicto posible (nunca "ya existe, rechazar"), así que el client hace un `POST` independiente por alumno (`Promise.all`) sin necesidad de atomicidad — la diferencia con asistencia/calificaciones es que ahí SÍ hay un caso de conflicto real (ya registrado) que amerita todo-o-nada. **No existe un `registrarAsistencia` individual** — existió brevemente (uno de los 5 casos de uso críticos originales de FASE 2) pero se eliminó al agregar la versión masiva porque quedó sin ningún consumidor y sin ninguna capacidad que la masiva (con un array de un solo registro) no cubriera ya — evitar mantener dos caminos para el mismo caso de uso sin una razón de negocio real detrás.

**Cómo el `tx` llega hasta el repositorio (clave para que la atomicidad sea real, no solo de intención)**: `Repository<T, ID>` (`core/ports.ts`) declara un parámetro extra `tx?: unknown` en los 5 métodos genéricos, y cada `*.repository.ts` propio hace lo mismo en sus finders/writers a medida (`findByAlumnoId(id, tx?)`, `registrarPago(pago, tx?)`, etc.). Es `unknown` **a propósito** — el puerto no puede importar `Prisma.TransactionClient` (rompería que server/módulos no dependan del adaptador concreto). Cada service que usa `unitOfWork.runInTransaction(async (tx) => { ... })` reenvía ese `tx` a **todas** las llamadas al repositorio dentro del callback (lecturas incluidas, no solo escrituras — necesario para que las verificaciones de conflicto vean el estado dentro de la misma transacción). `PrismaXxxRepository` internamente hace `(tx as Prisma.TransactionClient | undefined) ?? this.prisma` para usar la transacción activa si la hay, o el cliente normal si no. Este patrón se agregó recién al migrar a Prisma real (2026-08-01) — antes, con Fake, nadie pasaba `tx` a ningún lado porque no hacía falta (no había transacción real detrás); si se agrega un nuevo flujo con `UnitOfWork`, **no alcanza con envolver el código en `runInTransaction`** — hay que acordarse de pasar `tx` a cada llamada al repositorio dentro del callback, o la "transacción" no protegerá nada de verdad.

**Verificado que el rollback es real** (no solo estructurado para serlo): con dos alumnos en un curso, se mandó un `POST /api/asistencia/masiva` con `registros: [alumnoNuevo, alumnoConAsistenciaYaRegistrada]` — el segundo dispara `ConflictError` (409), y se confirmó con una consulta directa a Postgres que el primero **tampoco** quedó guardado (`SELECT COUNT(*) FROM "Asistencia"` no cambió). Con la Fake anterior esto no se podía garantizar (quedaba documentado como limitación conocida); con Prisma + `$transaction` ya es una garantía real del motor de base de datos, no una intención del código.

### Reglas de negocio transversales (viven en el `service`, no en el frontend)

- Descuento del 10% a partir del segundo hijo del mismo padre: `Alumno.aplicaDescuentoHermanos` se calcula en `InscribirAlumno` contando hermanos activos con el mismo `padreId`.
- Autorización de imagen: solo el padre dueño del alumno, una sola vez (`DocumentoService.autorizarImagen`); revocarla o pasarla a manual es exclusivo de Admin/Secretario.
- Un profesor solo opera sobre sus propios cursos (`AsistenciaService.registrarAsistenciaMasiva` valida `curso.profesorId`).
- Un padre solo ve datos de sus propios hijos.
- Calificaciones/notas de cierre en estado "borrador" nunca visibles para el rol Padre.

### Patrón `Crear<Padre|Profesor>`: alta de Usuario + entidad en una transacción

`PadreService.crearPadre` y `ProfesorService.crearProfesor` crean el `Usuario` (con password hasheada) y la entidad (`Padre`/`Profesor`) vinculada por `usuarioId`, ambos dentro de `unitOfWork.runInTransaction(...)` — es el mismo patrón que `CuotaService.registrarPago`, reutilizado para altas que tocan dos repositorios a la vez. Cada uno valida que el email no esté usado (`UsuarioRepository.findByEmail`) y que el DNI no esté duplicado antes de crear nada.

`AsistenciaController` y `DocumentoController` ya **no** usan `req.auth.sub` directamente como `profesorId`/`padreId` (esa simplificación de FASE 3/4 quedó resuelta en FASE 5): ahora llaman a `ProfesorService.buscarPorUsuarioId` / `PadreService.buscarPorUsuarioId` para resolver la entidad real antes de invocar el service correspondiente.

### Alta de Secretario: por qué no tiene módulo propio

A diferencia de `Padre` (`dni`, `telefono`, `vinculo`) y `Profesor` (`dni`, `telefono`), **`Secretario` no tiene ningún campo propio que no esté ya en `Usuario`** (`nombre`, `email`, `password`) — por eso no existe `modules/secretarios/` ni una entidad `Secretario`: crear un módulo completo (entity+schema+repository+service+controller+routes) para no guardar ningún dato adicional sería ceremonial sin necesidad real. El alta vive directo en `UsuarioService.crearSecretario`/`UsuarioController` (montados en `/api/auth`, igual que `login`, porque ese es el módulo que ya posee `Usuario`), simplemente creando un `Usuario` con `roles: ["secretario"]`. `crearSecretario`/`crearAdministrador`/`listarUsuarios` devuelven `Omit<Usuario, "passwordHash">` — nunca se expone el hash por la API.

### Panel de Usuarios (Admin): una sola tabla de cuentas

`UsuariosPage` (client) es **una única tabla con todas las cuentas** (`GET /api/auth/usuarios`: nombre, email, etiqueta(s) de rol, interruptor de estado, fecha de alta), igual que `AdminUsers` del prototipo — una cuenta multi-rol muestra una etiqueta por cada rol. El botón "Crear usuario" abre un único modal con selector de rol; según el rol elegido pide un subconjunto distinto de campos y delega en el endpoint que ya existía para ese rol (`POST /api/padres`, `POST /api/profesores`, `POST /api/auth/secretarios`) o en el nuevo `POST /api/auth/administradores`. El interruptor de estado llama a `PATCH /api/auth/usuarios/:id/estado`; la cuenta propia queda deshabilitada. **No se copió del prototipo** la asignación de cursos (profesor) ni de hijos (padre) desde este modal: un curso requiere profesor y los hijos se vinculan al inscribir al alumno, así que se hacen desde Cursos / Inscribir alumno.

## API (rutas montadas en `server.ts`)

| Método y ruta | Rol requerido | Caso de uso |
|---|---|---|
| `POST /api/auth/login` | público | `AutenticarUsuario` |
| `POST /api/auth/secretarios` | admin | `UsuarioService.crearSecretario` — sin entidad propia (ver nota abajo), devuelve el `Usuario` sin `passwordHash` |
| `POST /api/auth/administradores` | admin | Alta de administrador — mismo criterio que Secretario (sin entidad propia, solo `Usuario` con `roles: ["admin"]`) |
| `GET /api/auth/usuarios` | admin | Todas las cuentas (sin `passwordHash`), ordenadas por fecha de alta — alimenta la tabla única de `UsuariosPage` |
| `PATCH /api/auth/usuarios/:id/estado` | admin | Activa/desactiva una cuenta. Una cuenta inactiva no puede loguearse. Si es la de un profesor, sincroniza `Profesor.estado` en la misma transacción. Un admin no puede desactivar su propia cuenta (`ValidationError`) |
| `GET /api/padres` | admin, secretario | Listado |
| `POST /api/padres` | admin, secretario | `CrearPadre` |
| `GET /api/profesores` | admin | Listado |
| `POST /api/profesores` | admin | `CrearProfesor` |
| `PATCH /api/profesores/:id` | admin | Edición parcial de la ficha + `estado` (`activo`/`inactivo`). Si el profesor tiene cuenta, nombre/email/estado se sincronizan con su `Usuario` en la misma transacción — un profesor inactivo no puede iniciar sesión |
| `GET /api/alumnos` | admin, secretario | Listado (agregado en FASE 4 para la pantalla de alumnos del client) |
| `GET /api/alumnos/mios` | padre | Los propios hijos del padre autenticado, enriquecidos con `cursoNombre`/`cursoNivel`/`profesorNombre` (`AlumnoService.listarPorPadreConCurso`) — el rol padre no tiene acceso a `/api/cursos` ni `/api/profesores` (son admin/secretario/profesor), así que ese join se resuelve en el service y se devuelve embebido, en vez de abrir esos endpoints a un rol que solo debe ver lo suyo |
| `POST /api/alumnos` | admin, secretario | `InscribirAlumno` |
| `GET /api/cursos` | admin, secretario, profesor | Listado — profesor ve solo los propios (`listarPorProfesor`), el resto ve todos |
| `POST /api/cursos` | admin | `CrearCurso` (acepta `horarios[]` opcional en el mismo body) |
| `GET /api/cursos/:id/alumnos` | admin, secretario, profesor | Nómina del curso (agregado junto con el client de Profesor) — profesor solo la de sus propios cursos (`AlumnoService.listarPorCurso` valida dueño) |
| `POST /api/asistencia/masiva` | profesor | `RegistrarAsistenciaMasiva` — toda la nómina de un curso en una sola operación atómica vía `UnitOfWork` (no existe endpoint individual: se eliminó, ver más abajo) |
| `GET /api/cuotas/alumnos/:alumnoId` | admin, secretario, padre | Listado — padre solo de su propio hijo (mismo patrón `Solicitante` que `asistencia`/`calificaciones`) |
| `GET /api/cuotas` | admin, secretario | Todas las cuotas del instituto (`CuotasPage` admin, join client-side con alumnos/cursos) |
| `GET /api/cuotas/pagos` | admin, secretario | Todos los pagos (para historial "pagada el 10/07 · Efectivo" y KPI "cobrado este mes") |
| `POST /api/cuotas/pagos` | admin, secretario | `RegistrarPago` |
| `POST /api/documentos/autorizacion-imagen` | padre | `AutorizarImagen` — una sola vez, `ConflictError` (409) si ya estaba autorizada |
| `GET /api/documentos/alumnos/:alumnoId/autorizacion-imagen` | admin, secretario, padre | Estado actual (`Documento \| null`) — padre solo de su propio hijo |
| `GET /api/calificaciones/cursos/:cursoId/evaluaciones` | admin, secretario, profesor | Listado — profesor solo las de sus propios cursos |
| `POST /api/calificaciones/evaluaciones` | profesor | `CrearEvaluacion` (nace en estado `borrador`) |
| `PATCH /api/calificaciones/evaluaciones/:id/publicar` | profesor | Publica la evaluación (recién ahí la ve el padre) |
| `GET /api/calificaciones/evaluaciones/:id/calificaciones` | admin, secretario, profesor | Listado de notas ya cargadas para una evaluación (prellenar el formulario de carga) |
| `POST /api/calificaciones/evaluaciones/:id/calificaciones` | profesor | Carga notas en bloque para varios alumnos — atómico vía `UnitOfWork`, valida que cada alumno pertenezca a la nómina del curso |
| `POST /api/calificaciones/notas-cierre` | profesor | `CargarNotaCierre` (upsert por alumno+curso+periodo, nace en `borrador`) |
| `PATCH /api/calificaciones/notas-cierre/:id/publicar` | profesor | Publica la nota de cierre |
| `GET /api/calificaciones/alumnos/:alumnoId` \| `.../notas-cierre` | admin, secretario, profesor, padre | Listado — padre nunca ve nada en `borrador` ni de un alumno ajeno. La primera devuelve `Calificacion` enriquecida con `evaluacionNombre`/`evaluacionTipo`/`evaluacionFecha`/`evaluacionPeriodo` (join hecho en el service, no en el cliente) |
| `GET /api/calificaciones/cursos/:cursoId/notas-cierre?periodo=` | admin, secretario, profesor | Notas de cierre de **todo un curso** para un período (vs. la de un alumno individual) — usada por la pantalla de Profesor para prellenar/mostrar el estado de publicación de toda la nómina a la vez |
| `GET /api/cursos/horarios` | admin, secretario, profesor | Todos los `Horario[]` del instituto (sin filtrar por curso) — join client-side por `cursoId`, mismo patrón que `/api/cuotas/pagos` |
| `PATCH /api/cursos/:id` | admin | Edición parcial de curso (cualquier subconjunto de campos incl. `estado` y reemplazo de `horarios[]`) — usada tanto para el modal "Editar curso" como para el toggle rápido de estado activo/inactivo en la tabla |
| `GET /api/reportes/dashboard` | admin, secretario | Agregados reales para los 4 dashboards de KPIs: alumnos activos, % cuotas al día, % asistencia, cuotas vencidas (detalle), próximas evaluaciones, composición por nivel, actividad reciente, cuotas pendientes, cobrado hoy, alumnos con documentación pendiente. Sin entidad propia — `ReporteService` consulta Prisma directo (ver nota `reportes` más abajo) |
| `GET /api/reportes/alumnos` | admin, secretario | Fila por alumno con promedio+nota de cierre por período, asistencia %, cuotas pagas/pendientes/vencidas, deuda y monto pagado total — alimenta las 3 pestañas de `ReportesPage` (Cierre académico / Anual / Financiero) |
| `POST /api/observaciones` | admin, secretario, profesor | `CrearObservacion` — `categoria` acepta las 4 predefinidas o el `id` de una `CategoriaPersonalizada` del curso del alumno |
| `GET /api/observaciones/alumnos/:alumnoId` | admin, secretario, profesor, padre | Listado — padre solo su propio hijo |
| `POST /api/observaciones/categorias` | profesor | `CrearCategoriaPersonalizada` — validada por `verificarDuenoDelCurso` |
| `GET /api/observaciones/cursos/:cursoId/categorias` | admin, secretario, profesor | Listado de categorías personalizadas de ese curso |
| `GET /api/chats` | admin, secretario | Listado de todas las conversaciones |
| `GET /api/chats/mio` | padre | Obtiene (o crea si es la primera vez) la conversación del padre autenticado |
| `GET`/`POST /api/chats/:id/mensajes` | admin, secretario, padre | Leer/enviar — padre solo en su propia conversación; profesor sin acceso |

El rol se valida con `requireRole` a nivel de ruta; la propiedad sobre el recurso puntual (¿es tu curso?, ¿es tu hijo?) se valida dentro del service y devuelve `AuthorizationError` (403). El `errorHandler` también traduce `ZodError` (validación de body) a 400 automáticamente.

**Listados con alcance distinto según el rol** (ej. `GET /api/cursos`): cuando varios roles comparten una misma ruta pero cada uno debe ver un subconjunto distinto (profesor → solo sus cursos; admin/secretario → todos), la rama por rol vive en el **controller** (`if (req.auth!.rol === "profesor") { ... }`), no en el service ni en middleware — el service expone métodos separados (`listarCursos()` vs `listarPorProfesor(id)`) y el controller decide cuál llamar según `req.auth`. Mismo patrón a reutilizar en `calificaciones` (borrador oculto a Padre) y `chats` (padre ve solo su conversación).

`container.ts` siembra 4 usuarios de desarrollo (uno por rol, cada uno con su `Padre`/`Profesor` real vinculado por `usuarioId` cuando corresponde) más un curso/alumno/cuota de ejemplo, para poder probar la API sin depender de un flujo de onboarding real: `admin@babylon.test` / `secretario@babylon.test` / `profesor@babylon.test` / `padre@babylon.test`, todos con contraseña `"<rol>1234"`. Esto se reemplaza por `prisma/seed.ts` cuando los repositorios pasen a ser Prisma.

## Client — piezas base (FASE 4)

- **UI**: los componentes de `core/components/ui/` (`button`, `input`, `label`, `card`, `table`, `badge`, `select`, `avatar`) están escritos a mano siguiendo el patrón estándar de shadcn/ui (CVA + `cn()`), **no generados por el CLI** — el CLI (`pnpm dlx shadcn@latest`) se cuelga en este entorno de desarrollo (sin acceso de red confiable para su registro). Si en el futuro el CLI funciona, se puede usar para agregar componentes nuevos; los ya escritos a mano son compatibles con su formato.
- **Sesión**: `core/store/sessionStore.ts` (Zustand + `persist` en localStorage, key `babylon-session`) guarda `{ token, usuario }`. `core/lib/apiClient.ts` es un wrapper de `fetch` (`get`/`post`/`patch`) que agrega el header `Authorization` automáticamente desde el store y traduce respuestas de error del backend a `ApiError`.
- **Rutas**: `core/routes/AppRoutes.tsx` + `ProtectedRoute.tsx` (redirige a `/login` si no hay sesión, o a `/dashboard` si el rol no está en `rolesPermitidos`). `core/components/layout/AppLayout.tsx` es el shell autenticado (sidebar + header, ver "Sistema de diseño" más abajo) que envuelve las rutas protegidas.
- **`Rol`/`Usuario` están duplicados entre server y client** (`server/src/core/ports.ts` vs `client/src/features/auth/types.ts`) — es intencional: server y client no comparten código (ver arriba), así que cualquier cambio a la forma de estos tipos hay que replicarlo a mano en los dos lados.
- **Dashboard por rol**: `features/dashboard/pages/DashboardPage.tsx` elige qué renderizar según `usuario.rol`. Solo `admin` y `secretario` tienen una pantalla de "resumen" propia (`AdminDashboard`/`SecretarioDashboard`, con contenido real); `profesor` y `padre` no la tienen — ni en el prototipo ni acá — así que `DashboardPage` los redirige directo a su primera pantalla real (`/cursos` y `/mis-hijos` respectivamente, ver "Pasada de fidelidad completa" más abajo).
- **`AlumnoService` depende de `CursoRepository`** (además de `AlumnoRepository`) para `listarPorCurso(cursoId, profesorId?)` — cuando `profesorId` viene informado (lo llama un profesor), valida que sea dueño del curso antes de devolver la nómina; si no viene (lo llama admin/secretario), no valida nada. Mismo patrón de "parámetro opcional = viene de un profesor" que ya se usaba en otros services.
- **`useTomarAsistencia` (client) llama a `POST /api/asistencia/masiva`, un único POST atómico** — no dispara un request por alumno. `CursoDetailPage` muestra un solo mensaje de éxito/error para toda la nómina (ver nota sobre `AsistenciaService.registrarAsistenciaMasiva` en la sección de `UnitOfWork`).
- **`features/padres/` no estaba en el scaffolding original de FASE 0** (quedó afuera de la lista de features del client por un descuido) — se creó recién al construir el flujo de Secretario, con la misma estructura que el resto (`types.ts`, `padreService.ts`, `hooks/`).
- **`core/components/ui/select.tsx`**: un `<select>` nativo estilado igual que el resto de los componentes ui (sin Radix) — alcanza para los desplegables simples del proyecto (vínculo del padre, método de pago, nivel de curso) sin sumar una dependencia nueva.
- **Patrón "crear entidad relacionada embebida en el mismo formulario"**: `InscribirAlumnoPage.tsx` usa **dos** instancias de `useForm` (una para el alumno, otra para el padre nuevo) dentro de un único `<form>` — si el usuario elige "Cargar nuevo" padre en vez de buscar uno existente, al enviar el formulario del alumno se valida y crea primero el padre (`padreForm.trigger()` + `crearPadre.mutateAsync(...)`), y recién con ese `padreId` se llama a `inscribirAlumno`. Mismo patrón a reutilizar en cualquier otro flujo donde haga falta crear una entidad relacionada al vuelo (ej. crear un curso nuevo desde el mismo formulario de otra pantalla).

### Regla de diseño: mismo permiso de backend, distinta puerta de entrada en la UI

`POST /api/padres` acepta tanto `admin` como `secretario` (ver tabla de API arriba), pero **eso no significa que ambos vean la misma pantalla**. Es una decisión de UI, no de permisos:

- **Admin** ve un panel general de "Usuarios" (coincide con que el spec original lista "usuarios" dentro del acceso total de Administrador) para gestionar cualquier tipo de cuenta — padres, profesores, secretarios.
- **Secretario** no tiene acceso a ese panel general. Ve la opción de "crear padre/tutor" **embebida dentro del flujo de inscribir un alumno** (si el padre todavía no existe al inscribir, hay un sub-formulario ahí mismo) — coherente con que su alcance es "legajos de alumnos", no gestión de usuarios en general.

Mismo endpoint, mismo `PadreService.crearPadre` por debajo — la diferencia es exclusivamente desde qué pantalla cada rol llega a usarlo. Tenerlo en cuenta al construir el client de `padres` y el panel de Admin: **no exponer un panel de "Usuarios" genérico para el rol Secretario.**

## Sistema de diseño (2026-07-31, portado de `referencia-prototipo/`)

El cliente pasó de un tema shadcn genérico (azul) a la identidad visual real del instituto: `referencia-prototipo/` (en la raíz del repo, fuera de `server/`/`client/`) contiene un prototipo estático (React+Babel por CDN, sin build) con el diseño que el cliente real aprobó — sidebar oscuro verde institucional, hairline borders, esquinas afiladas, tipografía Inter Tight. **Esa carpeta es solo referencia de diseño, no se ejecuta ni se importa desde el client real** (no tiene TypeScript, no tiene build, y sus datos son mock). Ojo: ese prototipo no puede abrirse en este sandbox (usa CDNs externos — React/Babel/Tailwind/Google Fonts/lucide por `unpkg.com` — y acá no hay salida a internet), así que la fidelidad se logró leyendo el código fuente (`babylon-tokens.css`, `babylon-layout.jsx`, etc.), no renderizándolo.

**Decisión clave — "puente de tokens" en vez de reescribir cada página**: en lugar de tocar los ~30 archivos de página que ya usaban clases Tailwind tipo `bg-accent`/`text-muted-foreground`/`border`/`text-destructive`, se remapearon los **mismos nombres de variable CSS que ya consumía todo el client** (`--background`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--radius`, en `client/src/index.css`) a la paleta hex del prototipo convertida a HSL. Resultado: **todas las páginas ya construidas heredaron el nuevo look automáticamente**, sin editarlas una por una — mismo principio de apalancamiento que ya se usó para roles/errores, aplicado esta vez a estilos. Además de ese puente, `index.css` suma los tokens propios del prototipo en hex crudo (`--brand`, `--sidebar-bg`, `--success`/`--warning`/`--danger` + variantes `-soft`, `--level-*`) y sus clases utilitarias calcadas del original (`.btn-*`, `.card-hl`, `.status`, `.tag`, `.level-pill`, `.nav-link`, `.avatar`, `.tbl`, etc.) para componentes nuevos que sí necesiten fidelidad 1:1.

- **Tipografía**: Inter Tight (+ JetBrains Mono para números/datos) vía Google Fonts (`link` en `index.html`) — variable `--font-sans` en el bloque `@theme` de `client/src/index.css` y `index.css`. Como Google Fonts requiere red, en este sandbox (sin internet) el navegador cae al fallback `system-ui`; en producción con internet real carga Inter Tight normalmente. No es un bug, es una limitación del entorno de verificación.
- **`AppLayout.tsx`** se reescribió por completo: sidebar fijo verde institucional (`var(--sidebar-bg)`) con navegación agrupada por rol (`core/components/layout/nav.ts`, función `navPorRol(rol)` — un array de grupos con label + ítems `{to, label, icon}` de `lucide-react`), pie con avatar + nombre + rol + logout, y drawer móvil equivalente. **El header superior (2026-08-01) ya no es minimal**: `core/components/layout/pageTitles.ts` (`obtenerTituloPagina(pathname)`, match por prefijo de ruta más largo) muestra título+subtítulo real de la pantalla actual (mismo criterio que `SCREEN_TITLES` del prototipo, adaptado de screen-id a ruta de React Router), y `core/components/layout/GlobalSearch.tsx` agrega una búsqueda global **real** (no decorativa): busca alumnos por nombre/DNI usando `useAlumnos()` (ya cacheado por TanStack Query) y navega a `/alumnos/:id` al elegir un resultado — solo se renderiza para `admin`/`secretario` (únicos roles con acceso a ese endpoint y a esa pantalla). La campana de notificaciones del prototipo **sigue sin copiarse** porque no hay ningún sistema de notificaciones real detrás — a diferencia de la búsqueda, no hay forma barata de hacerla real, así que se mantiene afuera.
- **`Avatar` (`core/components/ui/avatar.tsx`, nuevo)**: cuadrado monocromo con iniciales del nombre (máx. 2 letras), variantes `tone="neutral"|"brand"` y `size="sm"|"md"|"lg"` — mismo patrón que el prototipo.
- **`Badge` (`core/components/ui/badge.tsx`)** ahora acepta, además de las variantes shadcn de siempre (`default`/`secondary`/`destructive`/`outline`, para tags simples tipo categoría de observación), 4 variantes nuevas que renderizan con la clase `.status` (punto + fondo suave + texto de color, en vez de relleno sólido): `success`/`warning`/`danger`/`neutral`. Se usan donde el badge representa un **estado real**, no una etiqueta: `AlumnosListPage` (activo/inactivo/egresado), `CuotasPage` (pagada/pendiente/vencida), `EvaluacionesPage` (publicada/borrador).
- **`Table` (`core/components/ui/table.tsx`)** se hizo más espaciada y con encabezados en mayúscula/tenues (`text-[10.5px] uppercase text-muted-foreground bg-muted/40`) para igualar la densidad del prototipo — cambio en un solo archivo, se propaga a todas las tablas del client.
- **`LoginPage.tsx`** rediseñado con el layout de dos paneles de `referencia-prototipo/Babylon Login.html`: panel izquierdo sólido verde institucional (`#0F3D2E`) con grilla sutil de fondo + isotipo + tagline, panel derecho blanco con el formulario (inputs con iconos `lucide-react`, toggle mostrar/ocultar contraseña). **No se copiaron** el checkbox "mantener sesión" ni el link "¿olvidaste tu contraseña?" del prototipo porque no existe ningún flujo real detrás (ninguna opción de sesión persistente configurable, ningún reset de contraseña) — mismo criterio que con el header: no UI decorativa sin función real.
- **Verificación**: como el prototipo no renderiza en este sandbox, la fidelidad se verificó comparando manualmente el código fuente del prototipo contra capturas Playwright reales del client — sin regresiones funcionales, `pnpm build` limpio.

## Pasada de fidelidad completa con el prototipo (2026-08-01)

A pedido explícito del usuario ("quiero que el proyecto real sea igual que en el prototipo… absolutamente todo"), se rehicieron **todas** las pantallas de los 4 roles pantalla por pantalla contra `referencia-prototipo/babylon-{admin,teacher,parent,chat}.jsx`, con la regla ya vigente de no inventar datos: cuando el prototipo mostraba un KPI o vista agregada que el backend no calculaba, se construyó el endpoint real correspondiente en vez de simularlo. Cambios de fondo (no solo visuales):

- **`modules/reportes/` (server, nuevo, sin entidad propia)**: igual criterio que "Alta de Secretario" — es una composición de lectura sobre otros módulos, no un agregado de dominio, así que `ReporteService` consulta Prisma directo en vez de pasar por cada repository. Dos métodos: `obtenerResumenDashboard()` (KPIs de `AdminDashboard`/`SecretarioDashboard`) y `listarReporteAlumnos()` (fila por alumno para las 3 pestañas de `ReportesPage`). Montado en `/api/reportes`, `admin`+`secretario` únicamente.
- **Layout de ancho completo**: `AppLayout.tsx` tenía `max-w-[1400px] mx-auto` en el contenedor principal, dejando franjas vacías en pantallas anchas — se quitó; el contenido ahora ocupa todo el ancho disponible en todas las pantallas.
- **Padre — restructurado a un único componente con tabs, no páginas separadas**: el prototipo (`ParentHome`) es en realidad **una sola pantalla con `tab` interno** (`home`/`grades`/`attendance`/`fees`/`docs`) que cambia según qué ítem de nav se clickeó — no una pantalla por hijo con sub-rutas. `features/alumnos/pages/ParentDashboardPage.tsx` reemplaza a los extintos `MisHijosPage`+`HijoDetailPage`: un solo componente, selector de hijo por segmented-control (si hay más de uno), header con 3 stats reales (promedio/asistencia/cuota actual) y tabs Resumen/Notas/Asistencia/Cuotas/Docs. `nav.ts` (`NAV_PADRE`) pasó de 2 ítems a 6 (`/mis-hijos`, `/mis-hijos/calificaciones`, `/mis-hijos/asistencia`, `/mis-hijos/cuotas`, `/mis-hijos/documentacion`, `/chat`), todas montadas sobre el mismo componente — `pathname` decide el tab inicial (`tabIdDesdeRuta` en el propio archivo). `DashboardPage` ahora redirige `padre`→`/mis-hijos` directo (no hay pantalla de "resumen" genérica para este rol, coincide con que el prototipo tampoco la tiene).
- **Profesor — mismo criterio, restructurado a 4 pantallas con selector de curso en vez de rutas por `:id`**: el prototipo tampoco navega a un curso por URL — cada pantalla (`TeacherAttendance`/`TeacherGrades`/`TeacherObservations`) tiene su propio `<select>` de curso arriba. Se eliminaron `CursoDetailPage`, `EvaluacionesPage`, `CargarNotasPage`, `NotasCierrePage` y `ObservacionesAlumnoPage`; reemplazados por `AsistenciaProfesorPage`, `CalificacionesProfesorPage` (con vista interna Evaluaciones/Notas de cierre) y `ObservacionesProfesorPage`, todas con selector de curso propio. `MisCursosPage` (Home) quedó como landing real con KPIs (comisiones a cargo, alumnos totales, próxima clase — calculada de verdad proyectando `Horario.diaSemana`+`horaInicio` al próximo día que corresponda) y panel de "Próximas clases". `nav.ts` (`NAV_PROFESOR`) pasó de 1 ítem a 4 (`/cursos`, `/asistencia`, `/calificaciones`, `/observaciones`), rutas ahora `rolesPermitidos={["profesor"]}` (antes compartían `/cursos` con admin/secretario sin necesidad real). `DashboardPage` redirige `profesor`→`/cursos`.
- **Asistencia de Profesor**: tarjetas por alumno con botones Presente/Tarde/Ausente (en vez del `<select>` viejo), conteo real de "ausencias en el mes" por alumno (`useQueries` sobre `GET /api/asistencia/alumnos/:id`, uno por alumno de la nómina — aceptable en un instituto de ~130 alumnos, cursos de ≤30). Sigue sin existir un selector de "clase anterior" con historial completo como el prototipo (`pastSessionsFor`) — se mantiene un `<input type="date">` libre en su lugar; es una reducción de alcance honesta, no fabricada.
- **Calificaciones de Profesor**: fusiona Evaluaciones (chips por evaluación, filtro por período, modal "Nueva evaluación", stats promedio/cargadas/≥7) y Notas de cierre (selector Julio/Noviembre, publicar con modal de confirmación) en una sola pantalla con toggle interno, igual que `TeacherGrades` del prototipo. Nuevo endpoint `GET /api/calificaciones/cursos/:cursoId/notas-cierre?periodo=` (`CalificacionRepository.findNotasCierreByCursoId`) para traer las notas de **toda la nómina** de una — antes solo existía "por alumno". El flujo de publicar guarda primero lo tipeado en pantalla y publica con los ids que devuelve ese guardado (no con `notasExistentes`, que podría estar desactualizado si el profesor no clickeó "Guardar" antes).
- **`CalificacionService.listarCalificacionesDeAlumno` ahora devuelve `CalificacionConEvaluacion`** (nota + `evaluacionNombre`/`evaluacionTipo`/`evaluacionFecha`/`evaluacionPeriodo`, resuelto en el service) en vez de la `Calificacion` pelada — la necesitaba tanto `ParentDashboardPage` como el tab "Académico" de `AlumnoDetailPage` (legajo de Admin) para mostrar qué evaluación es cada nota, no solo el número.
- **Cuotas — Admin/Secretario reconstruida por completo**: tabs Vencidas/Pendientes/Cobradas/Todas con contadores reales, 4 KPIs (cobrado este mes, deuda total, pendientes, tasa de cobranza), modal de cobro multi-cuota con búsqueda de alumno. Nuevos endpoints `GET /api/cuotas/pagos` (todos los pagos, para el historial "pagada el · método" y el KPI mensual) y **`GET /api/cuotas/alumnos/:alumnoId` ahora también acepta rol `padre`** (antes admin/secretario únicamente — el padre no podía ver ni siquiera sus propias cuotas; mismo patrón `Solicitante`/`verificarAccesoAlAlumno` que ya usaban `asistencia`/`calificaciones`/`observaciones`).
- **Cursos — Admin reconstruida por completo**: filtros (nombre/profesor, nivel, profesor), tabla con horarios y cupo real, modal de alta/edición compartido, toggle rápido de estado, vista "Ver alumnos" (nómina + cuota + asistencia, anidada en la misma página, sin ruta propia). Nuevos endpoints `PATCH /api/cursos/:id` (edición parcial, admin) y `GET /api/cursos/horarios` (todos los horarios, join client-side — antes los horarios se guardaban al crear un curso pero **nunca se leían de vuelta en ningún lado**, ni siquiera para el profesor).
- **Chats — unificados a una sola pantalla master-detail por rol** (antes `ChatsAdminPage` listaba y `ChatAdminDetailPage` (ruta separada) mostraba la conversación): `ChatsAdminPage.tsx` ahora es un layout de dos paneles en una sola página (lista de conversaciones a la izquierda con último mensaje y nombre de los hijos, conversación a la derecha), igual que `StaffChat` del prototipo. `ChatPage.tsx` (padre) rediseñado con burbujas alineadas por emisor. Sin badge de no-leídos: no existe ningún campo "leído" en `Mensaje`, y fue una decisión consciente no fabricarlo.
- **Bug recurrente encontrado dos veces — UTC vs. huso horario local**: el entorno corre en GMT-3; `new Date().toISOString().slice(0,10)` (o cualquier cómputo de "hoy" pasando por UTC) se corre un día hacia adelante en las últimas ~3 horas de cada día local. Apareció primero en `ReporteService` (una evaluación de "hoy" quedaba excluida de "Próximas evaluaciones", arreglado con `inicioDeHoyUtc()` — comparación en UTC consistente en ambos lados) y de nuevo en el client (`AsistenciaProfesorPage`/`CalificacionesProfesorPage` proponían "mañana" como fecha por defecto). Fix client-side centralizado en `core/lib/utils.ts` → `hoyLocalISO()` (arma el string `AAAA-MM-DD` a mano con `getFullYear()`/`getMonth()`/`getDate()` locales, nunca `toISOString()`) — **usar siempre esta función para "la fecha de hoy" en un `<input type="date">` o similar**, nunca `new Date().toISOString()`.

## Estado actual de implementación

- **Server: 11 módulos con lógica real** (entity + schema + repository/Prisma + service + controller + routes, montados en `server.ts`, verificados por HTTP): los 10 originales más `reportes` (sin entidad propia, ver arriba). **Persistencia: Prisma + PostgreSQL real** — no quedan repositorios Fake en el proyecto.
- **Client conectado a la API real y con fidelidad visual completa contra `referencia-prototipo/`** en los 4 roles: `auth`, `alumnos` (listado con filtros+paginación, `AlumnoDetailPage` legajo de 5 tabs, `InscribirAlumnoPage` wizard de 4 pasos, `ParentDashboardPage` unificado para el rol padre), `padres`/`profesores`/`secretarios` (listar/crear desde `UsuariosPage`), `cuotas` (`CuotasPage` admin con tabs+modal multi-cuota; reutilizado en el legajo de Admin y en `ParentDashboardPage`), `cursos` (`MisCursosPage` home de Profesor con KPIs reales; `CursosAdminPage` con filtros+edición+nómina anidada), `asistencia` (`AsistenciaProfesorPage`, tarjetas P/T/A), `calificaciones` (`CalificacionesProfesorPage` con vista Evaluaciones/Notas de cierre, reutilizado en legajo de Admin y `ParentDashboardPage`), `observaciones` (`ObservacionesProfesorPage`, selector de curso+alumno+categoría), `documentos` (autorización de imagen, embebida en legajo de Admin y `ParentDashboardPage`), `chats` (`ChatsAdminPage` master-detail unificado; `ChatPage` con burbujas para el padre). Dashboards de `admin` (KPIs+cuotas vencidas+próximas evaluaciones+composición por nivel+actividad reciente) y `secretario` (KPIs propios+cuotas vencidas urgentes) con datos 100% reales vía `/api/reportes/dashboard`; `ReportesPage` (admin, 3 pestañas + export CSV/PDF real) vía `/api/reportes/alumnos`.
- **Búsqueda global real** en el header (`GlobalSearch.tsx`, admin/secretario) y título+subtítulo de página (`pageTitles.ts`) en todas las pantallas — ver "Sistema de diseño" arriba.
- **Con esto los 4 dashboards de rol están completos y el plan "client de los módulos restantes" quedó cerrado.** `CursosAdminPage` y `UsuariosPage` son **admin-only** a propósito (no comparten ruta con Secretario): `GET /api/profesores` es admin-only en el backend, así que si Secretario pudiera llegar a esas pantallas se rompería al intentar resolver nombres de profesor — en vez de forzar ese permiso, se mantuvo el límite de rol de Secretario tal como estaba (legajos, cuotas, observaciones), sin ampliar su alcance sin que se pidiera. `/cursos` (profesor/secretario/admin, `MisCursosPage`) y `/cursos-todos` (admin, `CursosAdminPage`) son rutas separadas a propósito, para no colisionar con `/cursos/:id`. `UsuariosPage` no tiene edición ni baja de cuentas, solo alta + listado — no fue pedido.

Antes de asumir que un caso de uso "no está implementado", revisar el archivo — puede ser un stub vacío esperando la fase correspondiente, no un bug. Con el server completo, el client con los 4 dashboards de rol, el diseño visual portado y la migración a Prisma ya hecha, lo que queda del proyecto son los dos pedidos pospuestos por el usuario (importación de datos históricos, logos reales del instituto) y mejoras incrementales puntuales — ver memoria del proyecto para el detalle actualizado.
