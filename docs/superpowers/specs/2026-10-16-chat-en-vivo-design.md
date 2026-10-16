# Chat en vivo, "Visto" y aviso de mensaje nuevo — Diseño (subproyecto 3b)

**Fecha:** 2026-10-16 · **Subproyecto 3, etapa 3b** (3a: avisos guardados y en tiempo real ✔ · 3b: este · 3c: pantallas que se actualizan solas · 4: autenticación en dos pasos)

## Objetivo

Que el chat entre cada familia y el instituto funcione como una mensajería de verdad:
- los mensajes llegan **al instante** por la conexión en vivo del 3a;
- cada lado sabe si el otro **leyó** lo que mandó ("Visto");
- quien no está mirando el chat se entera por un **aviso en la campana** y por un **número en el menú**;
- el instituto puede **iniciar** una conversación con una familia que nunca escribió.

**Éxito:**
- Un padre escribe y a la secretaria le aparece al instante en la lista de conversaciones (arriba de todo, con su número de no leídos) y en la campana.
- Cuando ella abre la conversación, al padre le aparece "Visto" al instante, y el aviso se resuelve para todo el equipo.
- Cuando ella responde, el padre lo ve al instante y recibe el aviso.
- La secretaria puede escribirle primero a una familia, por ejemplo para avisarle de una cuota vencida.

## Decisiones tomadas con el usuario

- **Bandeja compartida del instituto** (como el WhatsApp de un comercio): si cualquier persona de administración o secretaría abre la conversación, cuenta como leída **para todo el instituto**. El padre ve "Visto" y el aviso "mensaje nuevo" se resuelve para todo el equipo.
- **Regla del "Visto":**
  - cada mensaje muestra **solo su hora de envío**;
  - "Visto · HH:MM" aparece en **un solo lugar: debajo del último mensaje de la conversación**, y solo si ese mensaje es tuyo y el otro lado ya lo leyó;
  - cuando el otro responde, el último mensaje deja de ser tuyo y el "Visto" desaparece;
  - cuando volvés a escribir, reaparece debajo de ese mensaje en cuanto el otro lo lee.
  - Vale igual para los dos lados.
- **Cómo se guarda:** cada mensaje registra cuándo fue visto (`vistoEn`). Descartado: una marca de "leído hasta" por conversación.
- **Aviso "mensaje nuevo"**: agrupado por conversación ("3 mensajes nuevos de María Gómez" / "2 mensajes nuevos del instituto"); vuelve a no leído si llegan más; se resuelve al leer la conversación; **nunca le llega a quien escribe**.
- **Se marca leído solo si alguien está mirando:** con la conversación abierta **y la pestaña visible**. Una pestaña en segundo plano no marca nada.
- **Se incluye** que el instituto inicie una conversación.
- **Quedan pendientes para más adelante** (anotados en la memoria del proyecto):
  - adjuntos: proyecto propio junto con Documentación, porque hoy no hay almacenamiento de archivos;
  - editar y borrar mensajes;
  - avisos por email de mensajes sin leer.
- Descartados en el 3a: "escribiendo…" y "en línea".

## Lo que ve cada uno

**Padre (pantalla Mensajes, `/chat`):**
- Su conversación con el instituto. Cada mensaje con su hora; el "Visto" con la regla de arriba.
- Un mensaje del instituto aparece al instante, sin recargar.
- **Al abrir la pantalla** (con la pestaña visible), todo lo que mandó el instituto queda leído. El instituto ve "Visto" al instante y el aviso se resuelve.
- En la campana: "2 mensajes nuevos del instituto", mientras tenga mensajes sin leer.
- En el menú lateral, "Mensajes" muestra un número con los mensajes sin leer.

**Administración y secretaría (pantalla Chats, `/chats`):**
- **Lista de conversaciones** con nombre de la familia, hijos, último mensaje, su hora y **el número de no leídos**, ordenada por el mensaje más reciente. Un mensaje nuevo sube esa conversación al tope al instante.
- **Al abrir una conversación** (con la pestaña visible), los mensajes del padre quedan leídos para todo el instituto.
- **La conversación abierta queda en la dirección** (`/chats?conversacion=<id>`). Así el aviso lleva a esa conversación y recargar no la pierde.
- En la campana: un aviso por familia, "3 mensajes nuevos de María Gómez", que vuelve a no leído si llegan más.
- En el menú lateral, "Chats" muestra cuántas conversaciones tienen mensajes sin leer.
- **Botón "Nueva conversación":**
  - abre un buscador de padres y madres por nombre, apellido o DNI (el texto buscado no va a la dirección);
  - al elegir uno, se abre su conversación, que se crea si no existía;
  - si esa persona todavía no tiene cuenta activa, se aclara: "Todavía no entró al sistema: va a ver la conversación cuando entre".

## Datos

- **`Mensaje.vistoEn`** (fecha, nula = sin ver por el otro lado). "Del instituto" = `rolEmisor` admin o secretario; "de la familia" = `rolEmisor` padre.
- Índice para contar rápido los no leídos de una conversación por lado.
- Migración nueva. **Los mensajes existentes quedan como vistos** (`vistoEn = fecha`), para que no aparezcan avisos de mensajes viejos.

## API (módulo `chats/`)

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /api/chats` | admin, secretario | **Cambia:** un resumen por conversación con `padreNombre`, `hijos`, `ultimoMensaje` (`texto`, `fecha`, `delInstituto`) y `noLeidos` (mensajes de la familia sin ver), ordenado por el último mensaje. Las conversaciones sin mensajes van al final. Reemplaza el pedido de mensajes de cada conversación que hoy hace la pantalla. |
| `POST /api/chats` | admin, secretario | **Nuevo:** `{ padreId }` abre (o crea) la conversación con esa familia. Devuelve la conversación con un dato que dice si el padre tiene cuenta activa. 404 si el padre no existe. |
| `GET /api/chats/mio` | padre | **Cambia:** suma `noLeidos` (mensajes del instituto sin ver). |
| `GET /api/chats/:id/mensajes` | admin, secretario, padre | **Cambia:** cada mensaje incluye `vistoEn`. |
| `POST /api/chats/:id/mensajes` | admin, secretario, padre | Igual que hoy, pero dentro de una transacción con su anuncio (todo o nada con el aviso). |
| `POST /api/chats/:id/leido` | admin, secretario, padre | **Nuevo:** pone la hora actual en `vistoEn` a los mensajes **del otro lado** que estaban sin ver (el instituto marca los de la familia; el padre, los del instituto). 204. Un padre solo puede hacerlo en su conversación (403). Si no había nada sin ver, no hace nada ni anuncia. |
| `GET /api/chats/no-leidos` | admin, secretario, padre | **Nuevo:** el número del menú lateral: para el instituto, `{ conversaciones }` con mensajes de familias sin ver; para el padre, `{ mensajes }` del instituto sin ver. |

La privacidad se mantiene: un padre nunca puede leer, marcar ni enterarse de otra conversación.

## Anuncios, avisos y tiempo real (lo construido en el 3a)

**Anuncios del módulo `chats/`** (`chat.eventos.ts`), publicados dentro de la transacción de la operación:
- `"chat.mensaje"` y `"chat.leido"`, los dos con `{ chatId, padreId }`.

**Dos tipos de aviso nuevos, de estado**, con criterio en `notificacion.criterios.prisma.ts`:

| Tipo | Para | Clave | Texto | Nivel | Lleva a |
|---|---|---|---|---|---|
| `mensajes_familia` | admin y secretaría (cada cuenta activa) | `mensajes:<chatId>` | "N mensaje(s) nuevo(s) de <nombre y apellido del padre>" | N (sube → vuelve a no leído) | `/chats?conversacion=<chatId>` |
| `mensajes_instituto` | el padre de esa conversación (cuenta activa) | `mensajes:<chatId>` | "N mensaje(s) nuevo(s) del instituto" | N | `/chat` |

- **Sincronización:** los dos anuncios piden sincronizar ambos tipos. Como son de estado, al quedar todo leído el aviso se resuelve solo, y como cuentan solo los mensajes del otro lado, nunca le llegan a quien escribe.
- **Preferencias:** cada uno se puede apagar en Mi cuenta.
- **Revisión nocturna y cuentas:** los dos tipos se suman al catálogo, así que entran en la revisión de las 03:00 y en la sincronización al activar o reactivar una cuenta. Un padre sin cuenta que la activa recibe el aviso de lo que ya le escribieron.
- **Recurso nuevo `{ tipo: "chat", chatId }`**, con su dirección por rol en `features/notificaciones/rutas.ts`.

**Señal en vivo nueva, `chat`, con `{ chatId }`** (solo el identificador, nunca el texto):
- Sale **después de confirmar** cada `chat.mensaje` y `chat.leido`.
- La reciben la cuenta del padre de esa conversación (rol padre) **y todas las conexiones de administración y secretaría**.
- El canal suma `enviarARoles(roles, senal)` para mandar a todas las conexiones de esos roles.

**En el navegador:** `<TiempoReal />` suma la señal `chat`, que invalida la conversación (`["mensajes", chatId]`), la lista (`["chats"]`) y el número del menú (`["chats", "no-leidos"]`). La campana se actualiza con la señal `notificaciones` de siempre.

## Marcar leído solo si alguien mira

La pantalla de la conversación llama a `POST /api/chats/:id/leido` cuando se cumplen las tres cosas:
1. la conversación está abierta;
2. `document.visibilityState === "visible"`;
3. hay mensajes del otro lado sin ver.

Se vuelve a comprobar cuando llegan mensajes nuevos y cuando la pestaña vuelve a ser visible (`visibilitychange`). Con la pestaña en segundo plano no se marca nada.

## Pruebas

Método de siempre: scripts `server/scripts/_*.ts` (no se commitean), pruebas de la API con curl y recorridos de Playwright, con datos `prueba-tmp-` que se borran al final. No se tocan las conversaciones reales.

- **Privacidad:**
  - un padre no puede leer, marcar leída ni iniciar otra conversación, ni recibir su señal `chat`;
  - un profesor no tiene acceso al chat (como hoy).
- **Regla del "Visto"**, en los cuatro casos:
  1. sin respuesta;
  2. leído;
  3. respondido (desaparece);
  4. vuelto a escribir y leído (reaparece en el mensaje nuevo).

  Se prueba de los dos lados.
- **Bandeja compartida:** la secretaria abre la conversación y el aviso se resuelve también para la cuenta de administración. El padre ve "Visto".
- **Quien escribe nunca recibe el aviso de su propio mensaje**, de ningún lado.
- **Números:**
  - `noLeidos` de cada conversación sube y vuelve a cero;
  - el número del menú coincide con las conversaciones o mensajes sin ver;
  - el aviso vuelve a no leído solo cuando el número sube;
  - la lista queda ordenada por el último mensaje.
- **Todo o nada:** si guardar el aviso falla, el mensaje no queda guardado.
- **Iniciar conversación:**
  - con un padre sin conversación se crea una;
  - con uno que ya tenía, se abre la misma (no se duplica);
  - un padre inexistente → 404;
  - un padre sin cuenta recibe el aviso al activarla.
- **Migración:** los mensajes viejos quedan vistos y no generan avisos.
- **Navegador, con dos ventanas (padre y secretaria):**
  - el mensaje aparece al instante del otro lado;
  - el "Visto" aparece y desaparece al instante según la regla;
  - el número del menú y de la lista cambian solos;
  - una pestaña en segundo plano no marca leído hasta volver a ella;
  - el aviso de la campana lleva a la conversación correcta;
  - en el celular, sin desborde horizontal.
- **Regresión:** las baterías del 3a, 1 y 2; `typecheck`, `lint` y `build` en los dos proyectos.

## Fuera de alcance

- Adjuntos, editar y borrar mensajes, y avisos por email (pendientes, anotados en la memoria del proyecto).
- "Escribiendo…" y "en línea" (descartados).
- Conversaciones entre profesores y familias (el chat sigue siendo solo con administración y secretaría).
- Varios servidores (la conexión en vivo sigue siendo en memoria, como en el 3a).
