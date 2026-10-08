# Sesión persistente, notificaciones por rol y recuperación de contraseña

Fecha: 2026-10-06 · Estado: aprobado (límites de login/IP ajustados el 2026-10-06)

## Contexto y objetivo

El prototipo muestra tres elementos que hoy no tienen una función real detrás: el
checkbox "Mantener sesión iniciada", el link "¿Olvidaste tu contraseña?" y la campana
de notificaciones (que ya existe para Admin/Secretario, pero está vacía para Profesor y
Padre). El objetivo es construir la funcionalidad real de cada uno, sin UI decorativa.

Situación actual relevante:

- El JWT dura 8 h (`JWT_EXPIRES_IN`) y el client lo guarda siempre en `localStorage`.
  Cuando vence, el client no se entera: la pantalla sigue "logueada" y los pedidos fallan.
- `authMiddleware` solo verifica la firma y la expiración del token: **no revisa si la
  cuenta sigue activa**. Una cuenta desactivada conserva el acceso hasta que vence su token.
- El server no envía correos de ningún tipo.
- La campana (`NotificationBell.tsx`) deriva sus avisos en el client a partir de
  `/api/reportes/dashboard`, que solo pueden leer Admin y Secretario.

Se construye en tres entregas independientes, en este orden: **(1) sesión**,
**(2) campana**, **(3) recuperación de contraseña**. Cada una se puede commitear y
probar por separado.

## Entrega 1 — Mantener sesión iniciada

### Comportamiento

- El login suma un checkbox **"Mantener sesión iniciada"** (desmarcado por defecto).
  - **Desmarcado**: token de **8 h**, guardado en `sessionStorage` → la sesión termina al
    cerrar el navegador o a las 8 h, lo que ocurra primero. Pensado para la computadora
    compartida de secretaría.
  - **Marcado**: token de **30 días**, guardado en `localStorage`.
- En el flujo multi-rol (`requiereSeleccionRol`), el valor del checkbox viaja también en
  el segundo pedido, junto con `rolElegido`.
- Si cualquier pedido autenticado responde **401**, el client cierra la sesión y navega a
  `/login` mostrando "Tu sesión venció, ingresá de nuevo". El 401 del propio login
  (credenciales incorrectas) **no** dispara esto.

### Server

- `POST /api/auth/login` acepta `recordarme?: boolean` (default `false`).
- Config: `JWT_EXPIRES_IN` (default `8h`) se mantiene para la sesión corta; se agrega
  `JWT_EXPIRES_IN_RECORDAR` (default `30d`).
- `Usuario` gana `sesionesValidasDesde DateTime?` (migración aditiva, `null` para las
  cuentas existentes).
- Se marca `sesionesValidasDesde` también al **desactivar** una cuenta (ver más abajo): reactivarla no revive las sesiones viejas.
- **Validación de sesión en cada pedido**: además de verificar el JWT, `authMiddleware`
  busca la cuenta (una consulta por clave primaria) y responde 401 si:
  - la cuenta no existe o está `inactivo`, o
  - el token se emitió (`iat`) antes de `sesionesValidasDesde`.

  Así, desactivar una cuenta o cambiar su contraseña corta todas sus sesiones abiertas
  de inmediato, sin importar si duraban 30 días.
- `core/` no puede depender de `modules/`: el middleware recibe la consulta como una
  función inyectada. `core/ports.ts` declara la interfaz
  `ValidadorDeSesion = (usuarioId) => Promise<{ activo: boolean; sesionesValidasDesde: Date | null } | null>`,
  `container.ts` la implementa con `UsuarioRepository` y la registra al arrancar
  (`configurarValidadorDeSesion(...)`), de modo que las ~14 rutas que ya importan
  `authMiddleware` no cambian.

### Client

- `sessionStore`: un `StateStorage` propio para el `persist` de Zustand que lee de
  `localStorage` o `sessionStorage` (el que tenga la sesión) y escribe en el que indique
  el flag `recordarme` elegido al iniciar sesión. `cerrarSesion` limpia ambos.
- `apiClient`: ante un 401 en una ruta distinta de `/api/auth/login`, llama a
  `cerrarSesion()` y redirige a `/login?motivo=sesion-vencida`. `LoginPage` muestra el
  aviso cuando ve ese parámetro.

## Entrega 2 — Campana de notificaciones por rol

### Criterio

No existe un campo "leído" en ningún modelo, y no se agrega. La campana muestra
**avisos derivados del estado actual** (algo pendiente o vencido que hay que atender),
no un historial de eventos. El punto rojo aparece mientras haya al menos un aviso; no
hay contador de "no leídas". Cada aviso lleva a la pantalla donde se resuelve.

### Server — módulo `notificaciones/` (sin entidad propia)

Mismo criterio que `reportes/`: composición de lectura sobre otros módulos, así que el
service consulta Prisma directo. Un solo endpoint:

`GET /api/notificaciones` — todos los roles autenticados. Devuelve
`{ id, tono: "danger" | "warning" | "info", texto, ruta }[]`, ya filtrado y
ordenado (danger → warning → info), con un máximo de 10 avisos. "Hoy" y las ventanas de
días se calculan en hora de Argentina (`core/fechas.ts`).

| Rol | Avisos |
|---|---|
| Admin / Secretario | Cuotas vencidas (las 5 más atrasadas, una por cuota); alumnos con autorización de imagen pendiente (un aviso con el total); próximas evaluaciones (hasta 3). Es exactamente lo que hoy muestra la campana, movido al server. |
| Profesor (solo sus cursos) | Clase de hoy cuyo horario ya empezó y sin asistencia registrada para esa fecha (`warning`); evaluaciones en `borrador` con al menos una nota cargada (`info`, "lista para publicar"); notas de cierre en `borrador` (`info`, un aviso por curso y período). |
| Padre (solo sus hijos) | Cuota `vencida` (`danger`, una por cuota); cuota `pendiente` que vence en ≤5 días (`warning`); documentación pendiente (`warning`); calificación o nota de cierre **publicada** en los últimos 7 días (`info`); observación recibida en los últimos 7 días (`info`). |

Para las novedades del padre, `Evaluacion` y `NotaCierre` ganan `publicadaEn DateTime?`, que se completa al publicar; lo publicado antes de este cambio no genera aviso.

Las reglas de privacidad existentes se mantienen: el padre nunca ve nada en `borrador`
ni de alumnos ajenos; el profesor solo ve sus propios cursos.

### Client

`NotificationBell.tsx` deja de derivar avisos de `useResumenDashboard` y consume
`useNotificaciones()` (`GET /api/notificaciones`, TanStack Query, refresco al enfocar la
ventana y cada 5 minutos). Se renderiza para los cuatro roles. Estado vacío:
"No hay nada pendiente".

## Entrega 3 — Recuperación de contraseña por correo

### Flujo

1. En el login, el link **"¿Olvidaste tu contraseña?"** lleva a `/olvide-contrasena`.
2. El usuario escribe su email. La pantalla responde **siempre lo mismo**: "Si el email
   está registrado, te enviamos un enlace para restablecer la contraseña. Revisá también
   la carpeta de spam." Exista o no la cuenta (no se revela qué correos están registrados).
3. Si la cuenta existe y está activa, se envía un correo con un enlace a
   `/restablecer-contrasena?token=…`.
4. En esa pantalla se elige la contraseña nueva (y se repite). Al guardar: se cambia la
   contraseña, el enlace queda usado, todas las sesiones abiertas se cortan (Entrega 1) y
   se redirige al login con "Contraseña actualizada, ya podés ingresar".

### Token

- 32 bytes aleatorios (`crypto.randomBytes`), en base64url, en el enlace.
- En la base se guarda **solo su hash SHA-256**, nunca el token. Quien lea la base no
  puede usar un enlace.
- Vence a la **1 hora**; es de **un solo uso**.
- Pedir un enlace nuevo **invalida los anteriores** de esa cuenta.
- Tabla nueva `TokenRecuperacion { id, usuarioId, hash (unique), creadoEn, expiraEn, usadoEn? }`.
- Contraseña nueva: mínimo 8 caracteres (igual que en el alta de cuentas) y máximo 72
  (límite de bcrypt).
- La pantalla de restablecer quita el token de la barra de direcciones apenas lo lee
  (`history.replaceState`) y la página declara `Referrer-Policy: no-referrer`, para que
  el token no quede en el historial ni se filtre a otros sitios.
- Respuestas de `POST /api/auth/restablecer-contrasena`: token inexistente, vencido o ya
  usado → 400 con un único mensaje "El enlace no es válido o ya venció. Pedí uno nuevo."

### Límites de pedidos (rate limiting)

Dos capas, porque protegen cosas distintas:

| Qué | Dónde | Límite | Por qué |
|---|---|---|---|
| Pedidos de enlace por **cuenta** | Service, contando filas de `TokenRecuperacion` | máx. **3 por hora** y al menos **60 s** entre uno y otro | Que nadie pueda llenar de correos la casilla de otra persona. Vive en la base, así que sobrevive a reinicios. Si se supera, **no se envía** el correo pero la respuesta es la misma (no revela nada). |
| Pedidos a `olvide-contrasena` por **IP** | Middleware (`express-rate-limit`) | **5 cada 15 min** | Frenar a quien prueba muchos emails distintos. Responde 429 "Demasiados intentos, probá de nuevo en unos minutos". |
| Pedidos a `restablecer-contrasena` por **IP** | Middleware | **5 cada 15 min** | Frenar la adivinación de tokens (de por sí inviable con 32 bytes). |
| **Login fallido** por **IP + email** | Middleware | **5 cada 15 min** | Fuerza bruta contra una cuenta concreta. La clave combina IP y email (normalizado a minúsculas), así que un padre que se equivoca no bloquea a otro que comparte su red. |
| **Login fallido** por **IP** (cualquier email) | Middleware | **20 cada 15 min** | Techo general contra quien prueba muchas cuentas desde una IP. Es más alto que el anterior porque muchos usuarios legítimos pueden compartir una IP (wifi del instituto, datos móviles detrás de CGNAT). |

En los dos límites de login, **los intentos exitosos no cuentan** (`skipSuccessfulRequests`).

Detalles:

- Los límites por IP se guardan en memoria del proceso: alcanza con un solo servidor
  (el caso de este proyecto). Si algún día hubiera varias instancias, habría que pasarlos
  a un almacén compartido; queda anotado.
- Detrás de un proxy o plataforma de despliegue, la IP real llega en `X-Forwarded-For`.
  Se agrega la variable `TRUST_PROXY` (default `false`) que activa
  `app.set("trust proxy", …)`; sin ella, todos los usuarios compartirían la IP del proxy
  y se bloquearían entre sí.
- Dependencia nueva: `express-rate-limit`.

### Envío de correos

- `core/ports.ts` declara el puerto `Mailer { enviar(mensaje: { para, asunto, texto, html }): Promise<void> }`.
- Dos adaptadores en `core/adapters/`:
  - `SmtpMailer` (con `nodemailer`): funciona con cualquier SMTP — Gmail del instituto
    (con "contraseña de aplicación"), Resend, Brevo, el del hosting, etc.
  - `ConsoleMailer`: escribe el correo y el enlace en la consola del server. Es el de
    desarrollo.
- `container.ts` elige: si está configurado `SMTP_HOST`, usa `SmtpMailer`; si no,
  `ConsoleMailer`. **En `NODE_ENV=production` el server se niega a arrancar sin
  `SMTP_*` configurado**, para que nunca se crea que se mandan correos cuando no se mandan.
- Variables nuevas (`config.ts` + `.env.example`): `SMTP_HOST`, `SMTP_PORT` (587),
  `SMTP_SECURE` (`false` para 587/STARTTLS, `true` para 465), `SMTP_USER`, `SMTP_PASS`,
  `MAIL_FROM` (ej. `"Babylon English Institute <no-reply@…>"`), y `APP_URL` (base de los
  enlaces; default `CORS_ORIGIN`).
- **El correo se envía sin esperar la respuesta del SMTP** (en segundo plano): la API
  responde en el mismo tiempo exista o no la cuenta, así el tiempo de respuesta tampoco
  revela qué correos están registrados. Si el envío falla, se registra en el log del
  server con el email de destino; no hay reintentos ni cola (a esta escala, el usuario
  puede volver a pedirlo).
- Contenido: asunto "Restablecé tu contraseña — Babylon English Institute", versión en
  texto y en HTML simple, con el nombre de la persona, el botón/enlace, el aviso de que
  vence en 1 hora y "Si no pediste este cambio, ignorá este correo: tu contraseña sigue
  siendo la misma".
- Requisito de datos: cada cuenta necesita un email real para poder recuperar su
  contraseña. Hoy las cuentas son de prueba; al crear las reales hay que cargar emails
  verdaderos.

### Endpoints nuevos (públicos)

| Método y ruta | Body | Respuesta |
|---|---|---|
| `POST /api/auth/olvide-contrasena` | `{ email }` | 200 siempre (mensaje genérico); 429 si se supera el límite por IP |
| `POST /api/auth/restablecer-contrasena` | `{ token, password }` | 204; 400 si el token no es válido; 429 por IP |

Viven en el módulo `usuarios/` (dueño de `Usuario`), igual que `login`.

## Pruebas

No hay test runner configurado; se verifica como en el resto del proyecto:

- **Sesión**: login con y sin "mantener sesión" (expiración del token decodificado; dónde
  quedó guardado); cerrar el contexto del navegador sin "mantener" → pide login; token
  vencido → vuelve al login con el aviso; desactivar una cuenta con sesión abierta → el
  siguiente pedido da 401.
- **Campana**: con los datos de prueba del ciclo 2026, iniciar sesión con cada rol y
  comprobar que cada aviso corresponde a un dato real; padre nunca ve borradores ni
  hijos ajenos; profesor solo sus cursos.
- **Contraseña**: flujo completo con `ConsoleMailer` (enlace leído del log); enlace
  usado dos veces, vencido y con token inventado → 400; pedir dos enlaces → el primero
  deja de servir; las sesiones previas quedan cortadas; email inexistente → misma
  respuesta y mismo tiempo; límites por cuenta (4.º pedido en una hora no envía) y por IP
  (429); 6.º login fallido con el mismo email desde la misma IP → 429, y un login de otro email desde esa IP sigue funcionando; 21 fallidos con emails distintos → 429.
- Envío real por SMTP: queda para cuando el instituto defina la cuenta de correo.

## Fuera de alcance

- Historial de notificaciones, marcas de "leído", notificaciones push o por email.
- Cambiar la contraseña estando logueado (pantalla "Mi cuenta").
- Verificación de email al crear cuentas.
- Almacén compartido (Redis) para los límites por IP.

## Actualización (2026-10-07): revisión independiente y arreglos menores

- **Sesiones por versión, no por reloj**: `Usuario.versionSesion` (Int, default 0) reemplaza a `sesionesValidasDesde` (que dejaba pasar los tokens emitidos en el mismo segundo del cambio; donde este documento dice `sesionesValidasDesde` / `iat`, rige esto). El token lleva `v`; `authMiddleware` lo compara con la versión de la cuenta (ausente = 0). Se incrementa de forma atómica al cambiar la contraseña y al desactivar la cuenta.
- Los cambios sobre una cuenta usan `UsuarioRepository.actualizarParcial` (solo los campos que cambian), para que dos cambios simultáneos no se pisen.
- El login compara siempre contra un hash (de relleno si no hay cuenta), para que el tiempo no revele qué emails existen.
- La contraseña nueva se valida en **bytes** (máx. 72), no en caracteres.
- `APP_URL` es obligatoria y debe ser una URL válida en producción.
- Una nota de cierre que vuelve a borrador limpia `publicadaEn`, así al republicarla se avisa de nuevo.
- Emails de cuenta: guardados normalizados y buscados por igualdad exacta (nunca `ILIKE`).
- `TRUST_PROXY="true"` se rechaza (hay que indicar la cantidad de proxies delante).
- La caché de consultas del navegador se vacía al cerrar sesión y al iniciar otra.

## Actualización (2026-10-08): sesiones por dispositivo

Reemplaza a "Sesiones por versión" de la actualización anterior: `Usuario.versionSesion` se eliminó y el acceso pasó a la tabla `Sesion` (una por dispositivo; el token lleva `sid`). Ver `2026-10-08-mi-cuenta-y-sesiones-design.md`.
