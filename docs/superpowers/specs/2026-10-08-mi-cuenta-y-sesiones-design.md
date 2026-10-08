# Mi cuenta y sesiones por dispositivo (subproyecto 1 de 4)

Fecha: 2026-10-08 · Estado: diseño aprobado en conversación, pendiente de revisión escrita

## Contexto y objetivo

Este es el primero de cuatro subproyectos que se construyen en orden, cada uno con su propio diseño, plan e
implementación:

1. **Mi cuenta y sesiones por dispositivo** (este documento).
2. Invitación y verificación de email.
3. Notificaciones: historial real y preferencias.
4. Autenticación en dos pasos (2FA).

Fuera de alcance de los cuatro, por decisión explícita: editar el nombre o el email y cambiar el email con
verificación.

Situación actual (rama `main`):

- Las sesiones se controlan con un contador (`Usuario.versionSesion`): el token lleva `v` y solo vale mientras
  coincida con el de la cuenta. Sirve para cortar *todas* las sesiones de una cuenta, pero no permite ver ni cerrar
  una sesión puntual.
- "Cerrar sesión" solo borra el token del navegador (`useAuth().logout`): el token sigue valiendo en el servidor
  hasta vencer.
- No existe una pantalla donde la persona vea sus datos, cambie su contraseña estando logueada o controle sus
  sesiones.

**Cambio respecto de una decisión anterior.** Antes se había elegido dejar las sesiones como estaban (contador).
Ver y cerrar sesiones por dispositivo requiere una tabla de sesiones. El costo por pedido no cambia (una consulta
por clave primaria, ~2–3 ms medidos) y la tabla **reemplaza** al contador (`versionSesion` se elimina).

## Modelo de datos

Tabla nueva `Sesion` (entidad secundaria del módulo `usuarios/`):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String (UUID) | Es el `sid` que lleva el token. |
| `usuarioId` | String | FK a `Usuario`, `ON DELETE CASCADE`. |
| `dispositivo` | String | Texto legible deducido del navegador, p. ej. "Chrome en Windows". |
| `ip` | String? | `req.ip` (requiere `TRUST_PROXY` bien configurado detrás de un proxy). |
| `creadaEn` | DateTime | Inicio de sesión. |
| `ultimoUsoEn` | DateTime | Ver "Último uso". |
| `expiraEn` | DateTime | Igual al vencimiento del token (8 h, o 30 días con "mantener sesión"). |
| `cerradaEn` | DateTime? | Se completa al cerrar la sesión (logout, otra sesión, cambio de contraseña, desactivación). |

Índice en `(usuarioId, cerradaEn, expiraEn)`.

`Usuario.versionSesion` se elimina (migración que borra la columna). Los tokens emitidos antes de este cambio no
llevan `sid` y dejan de valer: todos tendrán que iniciar sesión otra vez. Hoy solo existen cuentas de prueba.

## Token y validación por pedido

- El token lleva `{ sub, rol, sid }` y conserva su `exp` (igual a `expiraEn`). Se elimina el claim `v`.
- `ValidadorDeSesion` (puerto de `core/ports.ts`, inyectado con `configurarValidadorDeSesion` como hoy) pasa de
  `(usuarioId) => estado` a `(sesionId, usuarioId) => Promise<boolean>`. La implementación hace **una** consulta:
  existe una `Sesion` con ese `id` y ese `usuarioId`, sin `cerradaEn`, con `expiraEn` en el futuro, y su usuario está
  `activo`.
- Un token sin `sid`, o cuyo `sub` no coincide con el dueño de la sesión, responde 401.
- `req.auth` suma `sesionId` (`{ sub, rol, sesionId }`) para que los controllers sepan cuál es "esta sesión".

## Operaciones

Todas en el módulo `usuarios/` (`/api/auth`), autenticadas salvo el login:

| Método y ruta | Qué hace |
|---|---|
| `POST /login` (existente) | Crea la `Sesion` (dispositivo e IP del pedido) y firma el token con su `sid`. |
| `POST /logout` | Cierra la sesión actual (`cerradaEn = ahora`). 204. |
| `GET /sesiones` | Marca la sesión actual como usada (`ultimoUsoEn = ahora`) y devuelve las sesiones **activas** de la cuenta (no cerradas ni vencidas), más recientes primero, con `actual: true` en la propia. |
| `DELETE /sesiones/:id` | Cierra otra sesión de la misma cuenta. 404 si no existe, no es de la cuenta o ya estaba cerrada; 400 si es la sesión actual ("usá Cerrar sesión"). |
| `POST /sesiones/cerrar-otras` | Cierra todas las demás sesiones activas de la cuenta; devuelve cuántas. |
| `POST /cambiar-contrasena` | Cuerpo `{ passwordActual, passwordNueva }`. Verifica la actual (bcrypt), exige que la nueva sea distinta y cumpla `passwordNueva` (mín. 8 caracteres, máx. 72 bytes), guarda el hash y **cierra las demás sesiones** (la actual sigue abierta, sin emitir un token nuevo). 204. |

Reglas que cambian en flujos existentes (todo con una sola operación `cerrarSesiones(usuarioId, { excepto? })`):

- `restablecerContrasena` (recuperación por correo): cierra **todas** las sesiones de la cuenta.
- Desactivar una cuenta (`UsuarioService.cambiarEstado`, o `estado: "inactivo"` desde la ficha del profesor): cierra
  **todas** sus sesiones. Reactivarla no las revive; hay que iniciar sesión de nuevo.
- Sustituye a `actualizarParcial(..., { invalidarSesiones })`: esa opción y `versionSesion` desaparecen.

Límite de intentos de `cambiar-contrasena`: 5 fallos cada 15 minutos por cuenta (clave = id del usuario; los
cambios exitosos no cuentan), para que nadie con una sesión robada pueda adivinar la contraseña actual. Responde 429
con el mismo mensaje que los demás límites.

## Último uso

`ultimoUsoEn` **no** se actualiza en cada pedido. Se registra solo en dos momentos:

1. Al iniciar sesión (vale `creadaEn`).
2. Cada vez que la persona abre la sección "Sesiones activas" de "Mi cuenta" (`GET /sesiones`), para la sesión desde
   la que la abre.

Consecuencia que se acepta a propósito: el "último uso" de *otra* sesión muestra la última vez que ese dispositivo
inició sesión o abrió esa pantalla, no su actividad real. Para no engañar a quien lo lee, la pantalla lo dice
("El último uso se registra al iniciar sesión y cada vez que se abre esta pantalla en ese dispositivo"). La consulta
del client no se vuelve a pedir al volver a enfocar la ventana (`refetchOnWindowFocus: false`), así solo se registra al
entrar a la pantalla.

## Retención

Las sesiones vencidas o cerradas **se conservan** como historial de accesos de cada cuenta activa; "Mi cuenta" solo
muestra las activas. La tarea diaria de las 03:00 borra únicamente las sesiones, vencidas o cerradas hace más de 30
días, de **cuentas desactivadas** (`estado = inactivo`). Las filas de cuentas activas crecen (orden de cientos por día
a la escala del instituto, unas decenas de MB por año); si algún día molestara, se agrega una política de depuración.

La tarea diaria deja de ser exclusiva de las cuotas: el temporizador de las 03:00 hora Argentina (`cuota.scheduler.ts`)
se extrae a una utilidad genérica (`core/tareaDiaria.ts`, que conserva `msHastaProximaCorrida`) y la usan tanto el
mantenimiento de cuotas como la depuración de sesiones, cada una con su manejo de errores.

## Dispositivo e IP

- `dispositivo` se deduce del encabezado `User-Agent` con una función propia, pura y de pocas líneas
  (`core/dispositivo.ts`, sin dependencias nuevas): navegador (Chrome, Edge, Firefox, Safari, Opera, otro) y sistema
  (Windows, macOS, Linux, Android, iOS, otro) → "Chrome en Windows"; si no se reconoce nada, "Dispositivo desconocido".
- `ip` es `req.ip`. Es un dato personal: solo se muestra al dueño de la cuenta.

## Client

- **Ruta** `/mi-cuenta` para los cuatro roles (dentro de `ProtectedRoute` sin restricción de rol), página
  `features/cuenta/pages/MiCuentaPage.tsx`, con entrada en `pageTitles.ts` ("Mi cuenta", "Datos, contraseña y sesiones").
- **Acceso**: el bloque de nombre + rol al pie del menú lateral (y del menú móvil) pasa a ser un enlace a `/mi-cuenta`.
- **Secciones**:
  1. *Datos*: nombre, email y rol, en solo lectura (salen de la sesión del client; sin endpoint nuevo).
  2. *Cambiar contraseña*: contraseña actual, nueva y repetir (validación por bytes, igual que el resto); al guardar,
     aviso "Contraseña actualizada. Se cerraron tus otras sesiones." Un error de contraseña actual incorrecta no cierra
     la sesión (es un 400, no un 401).
  3. *Sesiones activas*: tabla con dispositivo, IP, inicio, último uso y la etiqueta "Esta sesión"; botón "Cerrar" en
     cada una de las demás, y "Cerrar todas las demás" cuando hay más de una. Debajo, la nota sobre el último uso.
- **Logout**: `useAuth().logout` llama a `POST /api/auth/logout` (si falla, igual cierra localmente) y después vacía la
  caché y navega al login, como hoy.
- **Una sesión cerrada desde otro dispositivo**: su próximo pedido responde 401 y el client ya la lleva al login con el
  aviso "Tu sesión venció" (comportamiento existente).

## Pruebas

No hay test runner; se verifica como en el resto del proyecto (curl, `tsx`, Playwright) y los scripts no se
commitean. Casos:

- **Sesiones**: el login crea la fila con dispositivo e IP; un token con una sesión cerrada, vencida, inexistente, de
  otra cuenta o sin `sid` da 401; un token firmado con otro `sub` pero un `sid` ajeno da 401; `logout` cierra la sesión
  y ese mismo token pasa a dar 401; desactivar la cuenta cierra todas y reactivarla no las revive; la recuperación de
  contraseña cierra todas; cambiar la contraseña desde "Mi cuenta" cierra las demás y la propia sigue funcionando.
- **Operaciones**: `GET /sesiones` solo lista las activas y marca `actual`; `DELETE` de una sesión ajena (de otra
  cuenta) da 404 y de la actual da 400; `cerrar-otras` devuelve la cantidad correcta; contraseña actual incorrecta →
  400 y cuenta para el límite (el 6.º intento en 15 min da 429); nueva igual a la actual → 400; 72 bytes.
- **Último uso**: queda igual tras varios pedidos comunes, cambia al pedir `GET /sesiones` y no cambia al volver a
  enfocar la ventana.
- **Retención**: la tarea borra sesiones viejas (cerradas o vencidas hace más de 30 días) de una cuenta desactivada y
  **no** las de una cuenta activa; no toca sesiones activas.
- **Rendimiento**: la verificación por pedido sigue en el orden de unos pocos ms (se mide igual que antes).
- **Interfaz** (dos contextos de navegador = dos dispositivos): iniciar sesión en ambos, verlos en la lista, cerrar el
  segundo desde el primero y comprobar que el segundo termina en el login con el aviso; cambiar la contraseña desde uno
  y comprobar que el otro cae; logout real; capturas a 1440 y 390 px sin desborde.
- **Sin regresiones**: la batería de verificaciones ya existente (sesión, campana, recuperación, límites del login,
  caché entre usuarios) vuelve a pasar adaptada al nuevo modelo.

## Fuera de alcance

- Editar nombre o email; cambiar el email con verificación.
- Mostrar el historial de accesos (la tabla lo conserva, pero no hay pantalla).
- Geolocalización por IP, alertas por inicio de sesión desde un dispositivo nuevo, límite de sesiones simultáneas.
- Verificación de email, notificaciones y 2FA: subproyectos 2, 3 y 4.
