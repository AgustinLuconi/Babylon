# Chat en vivo, "Visto" y aviso de mensaje nuevo (subproyecto 3b) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el chat entre cada familia y el instituto llegue al instante, muestre "Visto" debajo del último mensaje cuando el otro lado lo leyó, avise los mensajes sin leer en la campana y en el menú, y permita que el instituto inicie una conversación.

**Architecture:**
- Cada `Mensaje` guarda `vistoEn`. La bandeja del instituto es compartida: cualquier cuenta de administración o secretaría que lee la conversación marca leídos los mensajes de la familia.
- El módulo `chats/` publica `chat.mensaje` y `chat.leido` en el tablero del 3a, dentro de la transacción.
- Los avisos los sincronizan dos tipos de estado nuevos, uno por lado.
- La señal en vivo `chat` (solo el `chatId`) sale después de confirmar, hacia el padre de esa conversación y hacia todas las conexiones de administración y secretaría.
- En el navegador, la conversación se marca leída solo si está abierta **y** la pestaña está visible.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4; React 19, TanStack Query, React Router 7. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-16-chat-en-vivo-design.md`

## Global Constraints

- **Lo del 3a sigue vigente:**
  - arquitectura feature-first;
  - `tx` en cada llamada al repositorio dentro de una transacción;
  - publicar los anuncios **dentro** de la transacción y pasando `tx`;
  - señales en vivo **sin datos personales** (solo `{ chatId }`).
- **"Del instituto"** es `rolEmisor` admin o secretario; **"de la familia"** es `rolEmisor` padre. Leer como instituto marca solo los mensajes de la familia y viceversa.
- **Regla del "Visto":**
  - cada mensaje muestra solo su hora (`HH:MM`);
  - "Visto · HH:MM" va **solo** debajo del último mensaje de la conversación, si es de quien mira y tiene `vistoEn`.
- **Textos exactos:**
  - aviso del instituto: `"<N> mensaje nuevo|mensajes nuevos de <nombre> <apellido>"`;
  - aviso del padre: `"<N> mensaje nuevo|mensajes nuevos del instituto"`;
  - nota de padre sin cuenta: "Todavía no entró al sistema: va a ver la conversación cuando entre.";
  - preferencias: "Mensajes nuevos de familias" y "Mensajes nuevos del instituto".
- **Los mensajes existentes quedan vistos** en la migración (`vistoEn = fecha`).
- **Pruebas:** como en el 3a.
  - scripts `server/scripts/_*.ts`, que no se commitean, y Playwright en `$SCRATCH`, pasados por `chequear.py`;
  - todo con prefijo `prueba-tmp-av`, borrado al final;
  - no se tocan las conversaciones reales;
  - cada script que sincroniza termina con `limpiarMundo` + `sincronizarTodo` (`tsx scripts/_mundo-avisos.ts sincronizar`).

`$SCRATCH` es `/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad`. Todos los comandos de `server/` y `client/` corren con Node 24 (`bash $SCRATCH/en.sh server|client "<comando>"`).

## Review Focus

1. **Dos personas del instituto abren la misma conversación a la vez**, o una la abre mientras llega un mensaje nuevo. Ningún mensaje queda marcado leído sin que alguien lo haya tenido en pantalla: "leído" lleva `hasta`, la hora del último mensaje que se ve. Además, el aviso no queda abierto con todo leído (Task 1, Task 2 y Task 6).
2. **Una pestaña del chat en segundo plano**, o en el celular con la lista de conversaciones a la vista, no marca leído cuando llega un mensaje. Al volver a la conversación, sí (Task 6 y Task 7).
3. **Un padre que manda el `chatId` de otra familia** en `leido`, `mensajes` o cualquier ruta recibe 403, y nunca recibe la señal `chat` de otra familia (Task 2 y Task 4).
4. **Iniciar dos veces la conversación con la misma familia**, incluso a la vez desde dos pantallas, no crea dos conversaciones (Task 2).
5. **El "Visto" cuando el último mensaje es del otro**, cuando la conversación está vacía y cuando el último mensaje propio todavía no fue visto: en esos tres casos no se muestra nada (Task 6).

---

## Estructura de archivos

**Server:**
- **Crear:**
  - `prisma/migrations/20261016120000_chat_visto/migration.sql`;
  - `src/modules/chats/chat.eventos.ts`, `src/modules/chats/chat.tiempoReal.ts`.
- **Modificar:**
  - `prisma/schema.prisma`;
  - `src/modules/chats/{mensaje.entity,chat.entity,chat.repository,chat.repository.prisma,chat.service,chat.schema,chat.controller,chat.routes}.ts`;
  - `src/modules/notificaciones/{notificacion.entity,notificacion.tipos,notificacion.criterios.prisma,notificacion.suscripciones,notificacion.schema}.ts`;
  - `src/core/ports.ts`, `src/core/adapters/CanalEnMemoria.ts`, `src/eventos.ts`, `src/container.ts`.

**Client:**
- **Crear:**
  - `src/features/chats/visto.ts`;
  - `src/features/chats/hooks/{useChatsNoLeidos,useMarcarLeido,useIniciarConversacion,useMarcarLeidoSiMira}.ts`;
  - `src/features/chats/components/{BurbujaMensaje,NuevaConversacion}.tsx`;
  - `src/core/components/layout/ContadorChats.tsx`.
- **Modificar:**
  - `src/features/chats/{types,chatService}.ts`;
  - `src/features/chats/hooks/{useChats,useMiChat,useEnviarMensaje}.ts`;
  - `src/features/chats/pages/{ChatPage,ChatsAdminPage}.tsx`;
  - `src/core/components/layout/{nav.ts,AppLayout.tsx}`, `src/core/tiempoReal/TiempoReal.tsx`;
  - `src/features/notificaciones/{types,rutas}.ts`.

**Docs:** `CLAUDE.md`, memoria `proyecto_babylon_pendientes_futuros.md`.

---

### Task 0: Herramientas de prueba (en `$SCRATCH`, no se commitean)

El scratchpad se borra entre sesiones. Esta tarea recrea las herramientas del 3a (ya con sus correcciones) y suma los chats al mundo de prueba.

**Files:**
- Create: `$SCRATCH/{chequear.py,lib.sh,reiniciar-api.sh,iniciar-client.sh,e2e.sh,en.sh,bloques.py}`
- Modify (prueba, no se commitea): `server/scripts/_mundo-avisos.ts`

- [ ] **Step 1: Crear las herramientas**

`$SCRATCH/chequear.py`:

```python
#!/usr/bin/env python3
# Lee la salida de una prueba por stdin. Cada línea "etiqueta: real (esperado X)" se compara. La etiqueta y el valor
# pueden tener ": " adentro: la línea está bien si lo anterior a " (esperado X)" termina en ": X". Una línea con un
# error de JavaScript cuenta como falla, y una corrida sin ningún chequeo también. Sale con 1 si hubo fallas.
import re, sys

patron = re.compile(r"^(.*) \(esperado (.*)\)$")
error = re.compile(r"\b\w*Error\b|UnhandledPromiseRejection")
bien = mal = 0
for linea in sys.stdin:
    linea = linea.rstrip("\n")
    m = patron.match(linea)
    if m:
        if m.group(1).endswith(": " + m.group(2)) or (m.group(2) == "" and m.group(1).endswith(":")):
            bien += 1
        else:
            mal += 1
            print("FALLA ", linea)
    elif error.search(linea):
        mal += 1
        print("ERROR ", linea)
if bien + mal == 0:
    mal = 1
    print("ERROR  la prueba no imprimió ningún chequeo")
print(f"{bien} bien, {mal} mal")
sys.exit(1 if mal else 0)
```

`$SCRATCH/lib.sh`:

```bash
# Funciones para las pruebas de la API. Uso: source $SCRATCH/lib.sh
API=http://localhost:4000
q() { docker exec babylon-postgres psql -U babylon -d babylon -tAc "$1"; }
login() { curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"${3:+,\"rolElegido\":\"$3\"}}" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).token??''))"; }
code() { curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API$2" ${3:+-H "Authorization: Bearer $3"} -H 'Content-Type: application/json' ${4:+-d "$4"}; }
http() { curl -s -X "$1" "$API$2" ${3:+-H "Authorization: Bearer $3"} -H 'Content-Type: application/json' ${4:+-d "$4"}; }
js() { node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const d=JSON.parse(s||'null');console.log($1)})"; }
ok() { echo "$1: $2 (esperado $3)"; }
```

`$SCRATCH/reiniciar-api.sh` y `$SCRATCH/iniciar-client.sh`: idénticos a los de la Task 0 de `docs/superpowers/plans/2026-10-15-avisos-en-tiempo-real.md` (copiarlos de ese plan, Step 3).

`$SCRATCH/e2e.sh`:

```bash
#!/usr/bin/env bash
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
NODE_PATH=/home/agustin/.npm/_npx/e41f203b7505f1fb/node_modules node "$@"
```

`$SCRATCH/en.sh`:

```bash
#!/usr/bin/env bash
# en.sh server|client COMANDO… — corre el comando en ese proyecto con Node 24 y pnpm cargados.
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/$1" || exit 1
shift
eval "$@"
```

`$SCRATCH/bloques.py` (extrae los bloques de código de un brief):

```python
#!/usr/bin/env python3
# bloques.py BRIEF            → lista los bloques de código (índice, lenguaje, primera línea)
# bloques.py BRIEF N DESTINO  → escribe el bloque N en DESTINO (crea carpetas)
import os, re, sys
texto = open(sys.argv[1]).read()
bloques = []
for m in re.finditer(r"^( *)```(\w*)\n(.*?)^\1```", texto, re.M | re.S):
    sangria = len(m.group(1))
    cuerpo = "\n".join(l[sangria:] if l.startswith(" " * sangria) else l for l in m.group(3).split("\n"))
    bloques.append((m.group(2), cuerpo))
if len(sys.argv) == 2:
    for i, (lang, c) in enumerate(bloques):
        print(i, lang, c.split("\n")[0][:110])
else:
    lang, c = bloques[int(sys.argv[2])]
    os.makedirs(os.path.dirname(sys.argv[3]) or ".", exist_ok=True)
    open(sys.argv[3], "w").write(c)
    print("escrito", sys.argv[3], len(c.splitlines()), "líneas")
```

Las capturas de pantalla se guardan **siempre en `$SCRATCH`**, nunca en `client/src`. En la sesión anterior, una ruta que llegó como `undefined` terminó guardando capturas dentro del repositorio.

- [ ] **Step 2: Que el mundo de prueba borre también sus chats**

En `server/scripts/_mundo-avisos.ts`, dentro de `limpiarMundo`, justo antes de `await prisma.padre.deleteMany(...)`:

```ts
  await prisma.mensaje.deleteMany({ where: { chat: { padreId: { startsWith: P } } } });
  await prisma.chat.deleteMany({ where: { padreId: { startsWith: P } } });
```

- [ ] **Step 3: Probar**

```bash
chmod +x $SCRATCH/*.sh
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/iniciar-client.sh
source $SCRATCH/lib.sh; ok "salud" "$(code GET /health)" 200 | python3 $SCRATCH/chequear.py
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts borrar"
```
Expected: `API lista`, `1 bien, 0 mal`, `mundo de prueba: crear` y `mundo de prueba: borrar`.

---

### Task 1: Datos y repositorio del chat

**Files:**
- Modify: `server/prisma/schema.prisma`; Create: `server/prisma/migrations/20261016120000_chat_visto/migration.sql`
- Modify: `server/src/modules/chats/mensaje.entity.ts`, `chat.entity.ts`, `chat.repository.ts`, `chat.repository.prisma.ts`
- Test: `server/scripts/_chat-repo.ts`

**Interfaces:**
- Produces:
  - `Mensaje.vistoEn: Date | null`;
  - `type Lector = "instituto" | "familia"`;
  - `interface ResumenChat { chatId; padreId; padreNombre; hijos: string[]; ultimoMensaje: { texto; fecha: Date; delInstituto: boolean } | null; noLeidos: number; creadoEn: Date }`;
  - `ChatRepository`:
    - `marcarVistos(chatId, lector, ahora, hasta?: Date, tx?): Promise<number>` (`hasta`: solo los mensajes con `fecha <= hasta`);
    - `contarNoVistos(chatId, lector, tx?): Promise<number>`;
    - `contarConversacionesConNoVistos(tx?): Promise<number>`;
    - `findResumenes(tx?): Promise<ResumenChat[]>`.
  - `TipoNotificacion` de Prisma suma `mensajes_familia` y `mensajes_instituto` (los usa la Task 3).

- [ ] **Step 1: Escribir la prueba que falla**

`server/scripts/_chat-repo.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaChatRepository(prisma);
let n = 0;
const mensaje = (chatId: string, rolEmisor: "padre" | "secretario", emisorId: string, fecha: string) =>
  prisma.mensaje.create({ data: { id: `${P}-m${++n}`, chatId, emisorId, rolEmisor, texto: `msg ${n}`, fecha: new Date(fecha) } });

(async () => {
  const m = await crearMundo(prisma);
  const chat = await prisma.chat.create({ data: { id: `${P}-chat1`, padreId: m.padreId, creadoEn: new Date("2026-10-01T10:00:00Z") } });
  const vacio = await prisma.chat.create({ data: { id: `${P}-chat2`, padreId: m.padreAjenoId, creadoEn: new Date("2026-10-02T10:00:00Z") } });

  // La migración dejó vistos los mensajes que ya existían
  ok("mensajes viejos sin ver", await prisma.mensaje.count({ where: { vistoEn: null, chat: { padreId: { not: { startsWith: P } } } } }), 0);

  await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:00:00Z");
  await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:01:00Z");
  ok("el instituto tiene 2 sin ver", await repo.contarNoVistos(chat.id, "instituto"), 2);
  ok("la familia no tiene nada sin ver", await repo.contarNoVistos(chat.id, "familia"), 0);
  ok("conversaciones con algo sin ver", await repo.contarConversacionesConNoVistos(), 1);

  const resumenes = (await repo.findResumenes()).filter((r) => r.chatId.startsWith(P));
  ok("resumen: primero la que tiene mensajes", resumenes.map((r) => r.chatId).join(), `${P}-chat1,${P}-chat2`);
  ok("resumen: no leídos", resumenes[0].noLeidos, 2);
  ok("resumen: último mensaje", `${resumenes[0].ultimoMensaje?.texto} ${resumenes[0].ultimoMensaje?.delInstituto}`, "msg 2 false");
  ok("resumen: nombre del padre", resumenes[0].padreNombre, "Pruebaav padre");
  ok("resumen: hijos", resumenes[0].hijos.sort().join(" · "), "Lunaav Pruebaav · Tomasav Pruebaav");
  ok("resumen: la vacía sin último mensaje", resumenes[1].ultimoMensaje, null);

  const ahora = new Date("2026-10-10T10:05:00Z");
  ok("la familia lee: no marca los suyos", await repo.marcarVistos(chat.id, "familia", ahora), 0);
  // El segundo mensaje llegó después de lo que estaba en pantalla: no se marca
  ok("solo hasta lo que se vio", await repo.marcarVistos(chat.id, "instituto", ahora, new Date("2026-10-10T10:00:30Z")), 1);
  ok("el instituto lee el resto", await repo.marcarVistos(chat.id, "instituto", ahora), 1);
  ok("ya no queda nada sin ver", await repo.contarNoVistos(chat.id, "instituto"), 0);
  ok("leer de nuevo no marca nada", await repo.marcarVistos(chat.id, "instituto", ahora), 0);
  await mensaje(chat.id, "secretario", m.admin, "2026-10-10T10:06:00Z");
  ok("la familia tiene 1 sin ver", await repo.contarNoVistos(chat.id, "familia"), 1);
  ok("los mensajes traen vistoEn", (await repo.findMensajesByChatId(chat.id))[0].vistoEn?.toISOString(), ahora.toISOString());
  void vacio;

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_chat-repo.ts 2>&1 | python3 $SCRATCH/chequear.py"`
Expected: FAIL (`repo.contarNoVistos is not a function`, o la columna `vistoEn` no existe).

- [ ] **Step 2: Schema y migración**

En `server/prisma/schema.prisma`:
- En `model Mensaje`, debajo de `fecha DateTime`:
  ```prisma
    // Cuándo lo vio el otro lado (nulo = todavía no). La bandeja del instituto es compartida: lo marca cualquier cuenta
    // de administración o secretaría que lee la conversación.
    vistoEn   DateTime?
  ```
  y, antes de la llave que cierra el modelo, `@@index([chatId, rolEmisor, vistoEn])`.
- En `enum TipoNotificacion`, agregar al final `mensajes_familia` y `mensajes_instituto`.

```bash
cd server && mkdir -p prisma/migrations/20261016120000_chat_visto
pnpm exec prisma format >/dev/null
pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261016120000_chat_visto/migration.sql
cat prisma/migrations/20261016120000_chat_visto/migration.sql
```
Expected: dos `ALTER TYPE "TipoNotificacion" ADD VALUE`, un `ALTER TABLE "Mensaje" ADD COLUMN "vistoEn"` y un `CREATE INDEX`. **Nada más**: si aparece otra cosa, parar y avisar.

Agregar al final del archivo de la migración:

```sql

-- Los mensajes que ya existían quedan vistos: no generan avisos de mensajes viejos.
UPDATE "Mensaje" SET "vistoEn" = "fecha" WHERE "vistoEn" IS NULL;
```

```bash
pnpm exec prisma migrate deploy && pnpm prisma:generate && pnpm exec prisma migrate status
```
Expected: `Database schema is up to date!`

- [ ] **Step 3: Entidades y puerto**

`mensaje.entity.ts`: sumar a `Mensaje`:

```ts
  // Cuándo lo vio el otro lado (null = todavía no).
  vistoEn: Date | null;
```

y al final del archivo:

```ts
// Quién lee una conversación: el instituto (cualquier cuenta de administración o secretaría, bandeja compartida) o la
// familia. Leer marca solo los mensajes del otro lado.
export type Lector = "instituto" | "familia";
```

`chat.entity.ts`: agregar

```ts
// Una conversación vista desde la lista del instituto.
export interface ResumenChat {
  chatId: string;
  padreId: string;
  padreNombre: string;
  hijos: string[];
  ultimoMensaje: { texto: string; fecha: Date; delInstituto: boolean } | null;
  // Mensajes de la familia que el instituto todavía no vio.
  noLeidos: number;
  creadoEn: Date;
}
```

`chat.repository.ts`: importar `ResumenChat` y `Lector` y sumar al puerto:

```ts
  // Marca vistos (con `ahora`) los mensajes del otro lado que el lector todavía no vio, solo hasta `hasta` (el último
  // que tenía en pantalla), así uno que llegó en ese mismo instante no queda leído sin verse. Devuelve cuántos marcó.
  marcarVistos(chatId: string, lector: Lector, ahora: Date, hasta?: Date, tx?: unknown): Promise<number>;
  contarNoVistos(chatId: string, lector: Lector, tx?: unknown): Promise<number>;
  // Conversaciones con mensajes de la familia sin ver (el número del menú del instituto).
  contarConversacionesConNoVistos(tx?: unknown): Promise<number>;
  // Para la lista del instituto: por el último mensaje, las que no tienen mensajes al final.
  findResumenes(tx?: unknown): Promise<ResumenChat[]>;
```

- [ ] **Step 4: Adaptador**

En `chat.repository.prisma.ts`:
- Importar `type ResumenChat` desde `./chat.entity` y `type Lector` desde `./mensaje.entity`.
- Después de `aMensaje`:

```ts
// Los mensajes "del otro lado" según quién lee: el instituto lee los de la familia y la familia los del instituto.
const delOtroLado = (lector: Lector): Prisma.MensajeWhereInput =>
  lector === "instituto" ? { rolEmisor: "padre" } : { rolEmisor: { in: ["admin", "secretario"] } };
```

- Métodos nuevos en la clase:

```ts
  async marcarVistos(chatId: string, lector: Lector, ahora: Date, hasta?: Date, tx?: unknown): Promise<number> {
    const { count } = await this.client(tx).mensaje.updateMany({
      where: { chatId, vistoEn: null, ...delOtroLado(lector), ...(hasta ? { fecha: { lte: hasta } } : {}) },
      data: { vistoEn: ahora },
    });
    return count;
  }

  async contarNoVistos(chatId: string, lector: Lector, tx?: unknown): Promise<number> {
    return this.client(tx).mensaje.count({ where: { chatId, vistoEn: null, ...delOtroLado(lector) } });
  }

  async contarConversacionesConNoVistos(tx?: unknown): Promise<number> {
    return this.client(tx).chat.count({ where: { mensajes: { some: { vistoEn: null, ...delOtroLado("instituto") } } } });
  }

  async findResumenes(tx?: unknown): Promise<ResumenChat[]> {
    const db = this.client(tx);
    const [chats, sinVer] = await Promise.all([
      db.chat.findMany({
        include: {
          padre: { select: { nombre: true, apellido: true, alumnos: { select: { nombre: true, apellido: true } } } },
          mensajes: { orderBy: { fecha: "desc" }, take: 1 },
        },
      }),
      db.mensaje.groupBy({ by: ["chatId"], where: { vistoEn: null, ...delOtroLado("instituto") }, _count: { _all: true } }),
    ]);
    const noLeidos = new Map(sinVer.map((g) => [g.chatId, g._count._all]));
    const resumenes: ResumenChat[] = chats.map((c) => {
      const ultimo = c.mensajes[0];
      return {
        chatId: c.id,
        padreId: c.padreId,
        padreNombre: `${c.padre.nombre} ${c.padre.apellido}`,
        hijos: c.padre.alumnos.map((a) => `${a.nombre} ${a.apellido}`),
        ultimoMensaje: ultimo ? { texto: ultimo.texto, fecha: ultimo.fecha, delInstituto: ultimo.rolEmisor !== "padre" } : null,
        noLeidos: noLeidos.get(c.id) ?? 0,
        creadoEn: c.creadoEn,
      };
    });
    // Por el último mensaje (el más reciente primero); las conversaciones sin mensajes van al final, por su creación.
    return resumenes.sort((a, b) => {
      if (a.ultimoMensaje && b.ultimoMensaje) return b.ultimoMensaje.fecha.getTime() - a.ultimoMensaje.fecha.getTime();
      if (a.ultimoMensaje) return -1;
      if (b.ultimoMensaje) return 1;
      return b.creadoEn.getTime() - a.creadoEn.getTime();
    });
  }
```

- [ ] **Step 5: Correr la prueba y el typecheck**

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_chat-repo.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm typecheck"`
Expected: `18 bien, 0 mal` y typecheck limpio.

Si el typecheck marca un `Mensaje` armado sin `vistoEn` (por ejemplo, en `chat.service.ts`, `enviarMensaje`), agregar `vistoEn: null` en ese objeto.

- [ ] **Step 6: Commit**

```bash
git add server/prisma server/src/modules/chats
git commit -m "Chat: cada mensaje guarda cuándo lo vio el otro lado; resumen de conversaciones y conteo de no leídos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Servicio y API del chat

**Files:**
- Create: `server/src/modules/chats/chat.eventos.ts`
- Modify: `server/src/modules/chats/chat.service.ts`, `chat.schema.ts`, `chat.controller.ts`, `chat.routes.ts`; `server/src/eventos.ts`; `server/src/container.ts`
- Test: `server/scripts/_chat-servicio.ts`, `$SCRATCH/chat-api.sh`

**Interfaces:**
- Consumes: Task 1; `Publicador`, `sinAnuncios`, `UnitOfWork`.
- Produces:
  - `EventosChats { "chat.mensaje" | "chat.leido": { chatId; padreId; usuarioIdPadre: string | null } }`;
  - `ChatService(chatRepo, usuarioRepo, padreRepo, unitOfWork, anuncios = sinAnuncios())` con:
    - `listarResumenes()`, `miConversacion(padreId)`;
    - `iniciarConversacion(padreId): Promise<Chat & { cuentaActiva: boolean }>`;
    - `marcarLeido(chatId, lector, padreIdSolicitante?, hasta?: Date)`;
    - `noLeidos(lector, padreId?): Promise<{ conversaciones: number } | { mensajes: number }>`;
    - `listarMensajes` y `enviarMensaje` como hoy.
  - API:
    - `GET /api/chats` (resúmenes);
    - `POST /api/chats` `{ padreId }` → 200 con `{ …chat, cuentaActiva }` (404 si el padre no existe);
    - `GET /api/chats/mio` → `{ …chat, noLeidos }`;
    - `GET /api/chats/no-leidos`;
    - `POST /api/chats/:id/leido` `{ hasta? }` (ISO del último mensaje en pantalla) → 204 (403 si un padre usa una conversación ajena).

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_chat-servicio.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ChatService } from "../src/modules/chats/chat.service";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const anuncios: string[] = [];
tablero.alPublicarse("chat.mensaje", async (d) => void anuncios.push(`mensaje ${d.usuarioIdPadre}`));
tablero.alPublicarse("chat.leido", async (d) => void anuncios.push(`leido ${d.usuarioIdPadre}`));
const servicio = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, tablero);
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);

(async () => {
  const m = await crearMundo(prisma);
  const mio = await servicio.miConversacion(m.padreId);
  ok("el padre abre su conversación sin nada sin leer", mio.noLeidos, 0);

  anuncios.length = 0;
  await servicio.enviarMensaje(mio.id, "Hola", m.padre, "padre", m.padreId);
  ok("enviar anuncia con la cuenta del padre", anuncios.join(), `mensaje ${m.padre}`);
  ok("el instituto tiene una conversación sin leer", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":1}');

  anuncios.length = 0;
  await servicio.marcarLeido(mio.id, "instituto");
  ok("leer anuncia", anuncios.join(), `leido ${m.padre}`);
  anuncios.length = 0;
  await servicio.marcarLeido(mio.id, "instituto");
  ok("leer sin nada pendiente no anuncia", anuncios.length, 0);
  ok("ya no queda nada sin leer", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":0}');

  await servicio.enviarMensaje(mio.id, "Respuesta", m.admin, "secretario");
  ok("el padre tiene un mensaje sin leer", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":1}');
  ok("y lo ve en su conversación", (await servicio.miConversacion(m.padreId)).noLeidos, 1);
  ok("un padre no puede marcar otra conversación", await rechazo(servicio.marcarLeido(mio.id, "familia", m.padreAjenoId)), "AuthorizationError");
  await servicio.marcarLeido(mio.id, "familia", m.padreId);
  ok("el padre lee", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":0}');

  const iniciada = await servicio.iniciarConversacion(m.padreAjenoId);
  ok("iniciar: con cuenta activa", iniciada.cuentaActiva, true);
  const otraVez = await Promise.all([servicio.iniciarConversacion(m.padreAjenoId), servicio.iniciarConversacion(m.padreAjenoId)]);
  ok("iniciar dos veces a la vez: la misma conversación", otraVez.every((c) => c.id === iniciada.id) ? "sí" : "no", "sí");
  ok("una sola conversación por familia", await prisma.chat.count({ where: { padreId: m.padreAjenoId } }), 1);
  ok("iniciar con un padre inexistente", await rechazo(servicio.iniciarConversacion("no-existe")), "EntityNotFoundError");
  await prisma.padre.create({ data: { id: `${P}-sincuenta`, nombre: "Pruebaav", apellido: "Sincuenta", dni: "99400050", vinculo: "madre" } });
  ok("iniciar con un padre sin cuenta", (await servicio.iniciarConversacion(`${P}-sincuenta`)).cuentaActiva, false);

  const resumen = (await servicio.listarResumenes()).find((r) => r.chatId === mio.id);
  ok("el resumen trae la última respuesta del instituto", `${resumen?.ultimoMensaje?.texto} ${resumen?.ultimoMensaje?.delInstituto}`, "Respuesta true");

  // Todo o nada: si guardar el aviso falla, el mensaje tampoco queda guardado
  const roto = new TableroDeAnuncios<EventosDelSistema>();
  roto.alPublicarse("chat.mensaje", async () => {
    throw new Error("falla simulada del aviso");
  });
  const conAvisoRoto = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, roto);
  const antes = await prisma.mensaje.count({ where: { chatId: mio.id } });
  await conAvisoRoto.enviarMensaje(mio.id, "No debería quedar", m.padre, "padre", m.padreId).catch(() => {});
  ok("si el aviso falla, el mensaje no queda", await prisma.mensaje.count({ where: { chatId: mio.id } }), antes);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { padreId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

`$SCRATCH/chat-api.sh`:

```bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
S=/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad
bash $S/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null"
A=$(login prueba-tmp-av-admin@prueba.babylon.test prueba1234)
PA=$(login prueba-tmp-av-padre@prueba.babylon.test prueba1234)
AJ=$(login prueba-tmp-av-ajeno@prueba.babylon.test prueba1234)
PR=$(login prueba-tmp-av-profe@prueba.babylon.test prueba1234)
C=$(http GET /api/chats/mio $PA | js d.id)
ok "mío: sin nada sin leer" "$(http GET /api/chats/mio $PA | js d.noLeidos)" 0
ok "el padre escribe" "$(code POST /api/chats/$C/mensajes $PA '{"texto":"Hola"}')" 201
ok "resumen del instituto" "$(http GET /api/chats $A | js "(()=>{const r=d.find(x=>x.chatId==='$C');return r.noLeidos+' '+r.padreNombre+' '+r.ultimoMensaje.delInstituto})()")" "1 Pruebaav padre false"
ok "número del menú del instituto" "$(http GET /api/chats/no-leidos $A | js d.conversaciones)" 1
ok "otro padre no puede marcarla" "$(code POST /api/chats/$C/leido $AJ)" 403
ok "un profesor no tiene chat" "$(code GET /api/chats/no-leidos $PR)" 403
ok "el instituto la lee" "$(code POST /api/chats/$C/leido $A)" 204
ok "queda vista" "$(http GET /api/chats/$C/mensajes $PA | js 'd[0].vistoEn!==null')" true
ok "número del menú en cero" "$(http GET /api/chats/no-leidos $A | js d.conversaciones)" 0
ok "el instituto responde" "$(code POST /api/chats/$C/mensajes $A '{"texto":"Hola, ¿en qué te ayudamos?"}')" 201
ok "número del menú del padre" "$(http GET /api/chats/no-leidos $PA | js d.mensajes)" 1
ok "el padre la lee" "$(code POST /api/chats/$C/leido $PA)" 204
ok "y queda en cero" "$(http GET /api/chats/no-leidos $PA | js d.mensajes)" 0
ok "iniciar conversación" "$(http POST /api/chats $A '{"padreId":"prueba-tmp-av-ajeno"}' | js d.cuentaActiva)" true
ok "iniciar con un padre inexistente" "$(code POST /api/chats $A '{"padreId":"no-existe"}')" 404
ok "un padre no puede iniciar" "$(code POST /api/chats $PA '{"padreId":"prueba-tmp-av-ajeno"}')" 403
ok "iniciar sin padreId" "$(code POST /api/chats $A '{}')" 400
ok "leído con una fecha inválida" "$(code POST /api/chats/$C/leido $A '{"hasta":"cualquier cosa"}')" 400
bash $S/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null"
```

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_chat-servicio.ts 2>&1 | python3 $SCRATCH/chequear.py"`
Expected: FAIL (no existe `miConversacion`, y el constructor no recibe `padreRepo`).

- [ ] **Step 2: Anuncios del chat**

`server/src/modules/chats/chat.eventos.ts`:

```ts
export interface EventosChats {
  // Un mensaje nuevo o una conversación leída: cambian los avisos y llega una señal en vivo a los dos lados.
  "chat.mensaje": { chatId: string; padreId: string; usuarioIdPadre: string | null };
  "chat.leido": { chatId: string; padreId: string; usuarioIdPadre: string | null };
}
```

En `server/src/eventos.ts`: `import type { EventosChats } from "./modules/chats/chat.eventos";` y sumar `EventosChats &` a `EventosDelSistema`.

- [ ] **Step 3: El servicio**

Reemplazar `server/src/modules/chats/chat.service.ts`:

```ts
import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError } from "../../core/errors";
import { sinAnuncios } from "../../core/eventos";
import type { Publicador, UnitOfWork } from "../../core/ports";
import type { PadreRepository } from "../padres/padre.repository";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Chat, ResumenChat } from "./chat.entity";
import type { EventosChats } from "./chat.eventos";
import type { ChatRepository } from "./chat.repository";
import type { Lector, Mensaje, RolEmisorMensaje } from "./mensaje.entity";

export interface MensajeConEmisor extends Mensaje {
  emisorNombre: string;
}

// Un chat por familia, con el instituto. La bandeja del instituto es compartida: lo que lee cualquier cuenta de
// administración o secretaría queda leído para todos. Enviar y leer anuncian el cambio dentro de la transacción (los
// avisos se guardan con la operación y la señal en vivo sale al confirmar).
export class ChatService {
  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly padreRepo: PadreRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosChats> = sinAnuncios(),
  ) {}

  async listarResumenes(): Promise<ResumenChat[]> {
    return this.chatRepo.findResumenes();
  }

  // El padre abre su conversación (se crea la primera vez), con cuántos mensajes del instituto no vio.
  async miConversacion(padreId: string): Promise<Chat & { noLeidos: number }> {
    const chat = await this.obtenerOCrear(padreId);
    return { ...chat, noLeidos: await this.chatRepo.contarNoVistos(chat.id, "familia") };
  }

  // El instituto abre (o crea) la conversación con una familia. `cuentaActiva` avisa si el padre ya puede leerla.
  async iniciarConversacion(padreId: string): Promise<Chat & { cuentaActiva: boolean }> {
    const padre = await this.padreRepo.findById(padreId);
    if (!padre) {
      throw new EntityNotFoundError("Padre", padreId);
    }
    const chat = await this.obtenerOCrear(padreId);
    const cuenta = padre.usuarioId ? await this.usuarioRepo.findById(padre.usuarioId) : null;
    return { ...chat, cuentaActiva: cuenta?.estado === "activo" };
  }

  // Devuelve cada mensaje con el nombre de quien lo escribió (no solo su rol),
  // para mostrarle al padre "Secretaría — Lucía Peralta" en vez de un rol pelado.
  async listarMensajes(chatId: string, padreIdSolicitante?: string): Promise<MensajeConEmisor[]> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const mensajes = await this.chatRepo.findMensajesByChatId(chat.id);
    const nombresPorEmisor = new Map<string, string>();
    const enriquecidos: MensajeConEmisor[] = [];
    for (const m of mensajes) {
      if (!nombresPorEmisor.has(m.emisorId)) {
        const emisor = await this.usuarioRepo.findById(m.emisorId);
        nombresPorEmisor.set(m.emisorId, emisor?.nombre ?? "Instituto");
      }
      enriquecidos.push({ ...m, emisorNombre: nombresPorEmisor.get(m.emisorId)! });
    }
    return enriquecidos;
  }

  async enviarMensaje(
    chatId: string,
    texto: string,
    emisorId: string,
    rolEmisor: RolEmisorMensaje,
    padreIdSolicitante?: string,
  ): Promise<Mensaje> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    const mensaje: Mensaje = { id: randomUUID(), chatId, emisorId, rolEmisor, texto, fecha: new Date(), vistoEn: null };
    return this.unitOfWork.runInTransaction(async (tx) => {
      const guardado = await this.chatRepo.agregarMensaje(mensaje, tx);
      await this.anuncios.publicar("chat.mensaje", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
      return guardado;
    });
  }

  // Marca leídos los mensajes del otro lado, hasta el último que quien lee tenía en pantalla (`hasta`). Si no había
  // nada sin ver, no hace nada (ni anuncia).
  async marcarLeido(chatId: string, lector: Lector, padreIdSolicitante?: string, hasta?: Date): Promise<void> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const marcados = await this.chatRepo.marcarVistos(chatId, lector, new Date(), hasta, tx);
      if (marcados > 0) await this.anuncios.publicar("chat.leido", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
    });
  }

  // El número del menú: conversaciones con mensajes de familias sin ver (instituto) o mensajes del instituto sin ver (padre).
  async noLeidos(lector: Lector, padreId?: string): Promise<{ conversaciones: number } | { mensajes: number }> {
    if (lector === "instituto") return { conversaciones: await this.chatRepo.contarConversacionesConNoVistos() };
    const chat = padreId ? await this.chatRepo.findByPadreId(padreId) : null;
    return { mensajes: chat ? await this.chatRepo.contarNoVistos(chat.id, "familia") : 0 };
  }

  // Una conversación por familia: si dos pedidos la crean a la vez, el segundo choca con la clave única y se queda con
  // la que creó el primero.
  private async obtenerOCrear(padreId: string): Promise<Chat> {
    const existente = await this.chatRepo.findByPadreId(padreId);
    if (existente) return existente;
    try {
      return await this.chatRepo.create({ id: randomUUID(), padreId, creadoEn: new Date() });
    } catch (error) {
      const creada = await this.chatRepo.findByPadreId(padreId);
      if (creada) return creada;
      throw error;
    }
  }

  private async cuentaDelPadre(padreId: string): Promise<string | null> {
    return (await this.padreRepo.findById(padreId))?.usuarioId ?? null;
  }

  private async verificarAccesoAlChat(chatId: string, padreIdSolicitante?: string): Promise<Chat> {
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      throw new EntityNotFoundError("Chat", chatId);
    }
    if (padreIdSolicitante !== undefined && chat.padreId !== padreIdSolicitante) {
      throw new AuthorizationError("Un padre solo puede acceder a su propia conversación");
    }
    return chat;
  }
}
```

Si `Padre` (entidad) no tiene `usuarioId` como `string | null | undefined`, ajustar `cuentaDelPadre` con `?? null`; ya está contemplado.

- [ ] **Step 4: Schema, controller y rutas**

`chat.schema.ts`: agregar

```ts
export const iniciarConversacionSchema = z.object({ padreId: z.string().min(1) });
// `hasta`: la hora del último mensaje que quien lee tenía en pantalla (lo que llegó después no se marca).
export const marcarLeidoSchema = z.object({ hasta: z.coerce.date().optional() });
```

Reemplazar `chat.controller.ts`:

```ts
import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { enviarMensajeSchema, iniciarConversacionSchema, marcarLeidoSchema } from "./chat.schema";
import type { ChatService } from "./chat.service";
import type { Lector, RolEmisorMensaje } from "./mensaje.entity";

export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly padreService: PadreService,
  ) {}

  private async resolverPadreIdSiCorresponde(req: Request): Promise<string | undefined> {
    if (req.auth!.rol !== "padre") {
      return undefined;
    }
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    return padre.id;
  }

  // Quien lee: el padre es "familia"; administración y secretaría son "instituto" (bandeja compartida).
  private lector(req: Request): Lector {
    return req.auth!.rol === "padre" ? "familia" : "instituto";
  }

  listar = async (_req: Request, res: Response) => {
    res.status(200).json(await this.chatService.listarResumenes());
  };

  iniciar = async (req: Request, res: Response) => {
    const { padreId } = iniciarConversacionSchema.parse(req.body);
    res.status(200).json(await this.chatService.iniciarConversacion(padreId));
  };

  miChat = async (req: Request, res: Response) => {
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    res.status(200).json(await this.chatService.miConversacion(padre.id));
  };

  noLeidos = async (req: Request, res: Response) => {
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    res.status(200).json(await this.chatService.noLeidos(this.lector(req), padreId));
  };

  listarMensajes = async (req: Request, res: Response) => {
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    const mensajes = await this.chatService.listarMensajes(String(req.params.id), padreId);
    res.status(200).json(mensajes);
  };

  enviarMensaje = async (req: Request, res: Response) => {
    const datos = enviarMensajeSchema.parse(req.body);
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    // requireRole("admin", "secretario", "padre") en la ruta ya garantiza que
    // el rol autenticado es uno de estos tres (profesor no llega hasta acá).
    const rolEmisor = req.auth!.rol as RolEmisorMensaje;
    const mensaje = await this.chatService.enviarMensaje(String(req.params.id), datos.texto, req.auth!.sub, rolEmisor, padreId);
    res.status(201).json(mensaje);
  };

  marcarLeido = async (req: Request, res: Response) => {
    // Sin cuerpo, Express 5 deja `req.body` en undefined.
    const { hasta } = marcarLeidoSchema.parse(req.body ?? {});
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    await this.chatService.marcarLeido(String(req.params.id), this.lector(req), padreId, hasta);
    res.status(204).end();
  };
}
```

Reemplazar el cuerpo de `chatRoutes` en `chat.routes.ts`:

```ts
  const router = Router();
  const participantes = requireRole("admin", "secretario", "padre");
  const instituto = requireRole("admin", "secretario");

  router.get("/", authMiddleware, instituto, controller.listar);
  router.post("/", authMiddleware, instituto, controller.iniciar);
  router.get("/mio", authMiddleware, requireRole("padre"), controller.miChat);
  router.get("/no-leidos", authMiddleware, participantes, controller.noLeidos);
  router.get("/:id/mensajes", authMiddleware, participantes, controller.listarMensajes);
  router.post("/:id/mensajes", authMiddleware, participantes, controller.enviarMensaje);
  router.post("/:id/leido", authMiddleware, participantes, controller.marcarLeido);

  return router;
```

En `container.ts`: `const chatService = new ChatService(chatRepository, usuarioRepository, padreRepository, unitOfWork, tablero);`.

- [ ] **Step 5: Correr las pruebas**

```bash
bash $SCRATCH/en.sh server "pnpm typecheck && pnpm exec tsx scripts/_chat-servicio.ts 2>&1 | python3 $SCRATCH/chequear.py"
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/chat-api.sh | python3 $SCRATCH/chequear.py
```
Expected: typecheck limpio; `18 bien, 0 mal`; `18 bien, 0 mal`.

- [ ] **Step 6: Commit**

```bash
git add server/src
git commit -m "Chat: resumen de conversaciones, marcar leído (bandeja compartida), no leídos e iniciar conversación; enviar y leer anuncian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Avisos de mensajes nuevos

**Files:**
- Modify: `server/src/modules/notificaciones/notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.criterios.prisma.ts`, `notificacion.suscripciones.ts`, `notificacion.schema.ts`
- Test: `server/scripts/_avisos-chat.ts`; Modify (prueba): `server/scripts/_suscripciones.ts`

**Interfaces:**
- Consumes: anuncios `chat.mensaje` y `chat.leido` (Task 2); `Mensaje.vistoEn` (Task 1).
- Produces:
  - `TipoEstado` suma `"mensajes_familia" | "mensajes_instituto"`;
  - `RecursoAviso` suma `{ tipo: "chat"; chatId: string }`;
  - clave `mensajes:<chatId>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_avisos-chat.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { CanalEnVivo } from "../src/core/ports";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ChatService } from "../src/modules/chats/chat.service";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { suscribirAvisos } from "../src/modules/notificaciones/notificacion.suscripciones";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const canal: CanalEnVivo = { registrar: () => () => {}, enviarA: () => {}, enviarARoles: () => {}, conectado: () => false, revisarSesiones: async () => {} };
const avisos = new NotificacionService(new PrismaNotificacionRepository(prisma), new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma)), canal, uow);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
suscribirAvisos(tablero, avisos);
const chats = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, tablero);
const aviso = (usuarioId: string, rol: string, clave: string) => prisma.notificacion.findFirst({ where: { usuarioId, rol: rol as never, clave } });

(async () => {
  const m = await crearMundo(prisma);
  const chat = await chats.miConversacion(m.padreId);
  const clave = `mensajes:${chat.id}`;

  await chats.enviarMensaje(chat.id, "Hola", m.padre, "padre", m.padreId);
  await chats.enviarMensaje(chat.id, "¿Mañana hay clase?", m.padre, "padre", m.padreId);
  const delAdmin = await aviso(m.admin, "admin", clave);
  ok("al instituto le llega el aviso agrupado", delAdmin?.texto, "2 mensajes nuevos de Pruebaav padre");
  ok("con el nivel", delAdmin?.nivel, 2);
  ok("lleva a la conversación", JSON.stringify(delAdmin?.recurso), JSON.stringify({ tipo: "chat", chatId: chat.id }));
  ok("también a la otra cuenta de administración", (await aviso(m.multi, "admin", clave)) ? "sí" : "no", "sí");
  ok("a quien escribió no le llega", (await aviso(m.padre, "padre", clave)) ? "sí" : "no", "no");

  await prisma.notificacion.updateMany({ where: { clave, usuarioId: m.admin }, data: { leidaEn: new Date() } });
  await chats.enviarMensaje(chat.id, "¿Me responden?", m.padre, "padre", m.padreId);
  const masAdmin = await aviso(m.admin, "admin", clave);
  ok("llega otro: el número sube", masAdmin?.texto, "3 mensajes nuevos de Pruebaav padre");
  ok("y vuelve a no leído", masAdmin?.leidaEn, null);

  await chats.marcarLeido(chat.id, "instituto");
  ok("leída por el instituto: se resuelve para el admin", (await aviso(m.admin, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");
  ok("y para la otra cuenta (bandeja compartida)", (await aviso(m.multi, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");

  await chats.enviarMensaje(chat.id, "Sí, normal", m.admin, "secretario");
  ok("al padre le llega el aviso", (await aviso(m.padre, "padre", clave))?.texto, "1 mensaje nuevo del instituto");
  ok("al instituto no le llega su propio mensaje", (await aviso(m.admin, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");
  await chats.marcarLeido(chat.id, "familia", m.padreId);
  ok("el padre lee: se resuelve", (await aviso(m.padre, "padre", clave))?.resueltaEn !== null ? "sí" : "no", "sí");

  // Un padre sin cuenta activa no recibe avisos; al activarla, aparece lo que ya le escribieron
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "pendiente" } });
  const delAjeno = await chats.iniciarConversacion(m.padreAjenoId);
  await chats.enviarMensaje(delAjeno.id, "Le escribimos por la cuota", m.admin, "secretario");
  ok("sin cuenta activa: sin aviso", (await aviso(m.ajeno, "padre", `mensajes:${delAjeno.id}`)) ? "sí" : "no", "no");
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });
  await uow.runInTransaction((tx) => tablero.publicar("cuenta.cambio", { usuarioId: m.ajeno }, tx));
  ok("al activarla: aparece el aviso", (await aviso(m.ajeno, "padre", `mensajes:${delAjeno.id}`))?.texto, "1 mensaje nuevo del instituto");

  await limpiarMundo(prisma);
  await avisos.sincronizarTodo();
  ok("limpieza", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

En `server/scripts/_suscripciones.ts`:
- en `TODOS`, agregar `mensajes_familia,mensajes_instituto` en su lugar alfabético (después de `evaluacion_proxima`);
- antes del último `prueba(...)`, agregar:
  ```ts
    await prueba("chat.mensaje", { chatId: "c1", padreId: "p1", usuarioIdPadre: "u1" }, "sync mensajes_familia,mensajes_instituto");
    await prueba("chat.leido", { chatId: "c1", padreId: "p1", usuarioIdPadre: "u1" }, "sync mensajes_familia,mensajes_instituto");
  ```

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_avisos-chat.ts 2>&1 | python3 $SCRATCH/chequear.py; pnpm exec tsx scripts/_suscripciones.ts 2>&1 | python3 $SCRATCH/chequear.py"`
Expected: FAIL en los dos (no hay avisos de chat y las suscripciones no existen).

- [ ] **Step 2: Tipos, catálogo y schema**

`notificacion.entity.ts`:
- `TipoEstado` suma `| "mensajes_familia" | "mensajes_instituto"`;
- `RecursoAviso` suma `| { tipo: "chat"; chatId: string }`.

`notificacion.tipos.ts`, en `TIPOS`:

```ts
  mensajes_familia: { grupo: "staff", clase: "estado", etiqueta: "Mensajes nuevos de familias" },
  mensajes_instituto: { grupo: "padre", clase: "estado", etiqueta: "Mensajes nuevos del instituto" },
```

`notificacion.schema.ts`: agregar `"mensajes_familia"` y `"mensajes_instituto"` a `tipoNotificacionSchema`.

- [ ] **Step 3: Criterios**

En `notificacion.criterios.prisma.ts`, en el `switch` de `esperados`:

```ts
      case "mensajes_familia":
        return this.mensajesDeFamilias(tx);
      case "mensajes_instituto":
        return this.mensajesDelInstituto(tx);
```

y los dos métodos, en una sección nueva "── Chat ──":

```ts
  // ── Chat ─────────────────────────────────────────────────────────────────
  // Bandeja compartida: un aviso por conversación con mensajes de la familia sin ver, para cada cuenta del instituto.
  private async mensajesDeFamilias(tx?: unknown): Promise<AvisoEsperado[]> {
    const grupos = await this.db(tx).mensaje.groupBy({ by: ["chatId"], where: { rolEmisor: "padre", vistoEn: null }, _count: { _all: true } });
    if (grupos.length === 0) return [];
    const chats = await this.db(tx).chat.findMany({
      where: { id: { in: grupos.map((g) => g.chatId) } },
      select: { id: true, padre: { select: { nombre: true, apellido: true } } },
    });
    const nombre = new Map(chats.map((c) => [c.id, `${c.padre.nombre} ${c.padre.apellido}`]));
    const staff = await this.staff(tx);
    return grupos.flatMap((g) =>
      staff.map((d) =>
        aviso({
          ...d,
          tipo: "mensajes_familia",
          clave: `mensajes:${g.chatId}`,
          tono: "info",
          texto: `${cantidad(g._count._all, "mensaje nuevo", "mensajes nuevos")} de ${nombre.get(g.chatId)}`,
          recurso: { tipo: "chat", chatId: g.chatId },
          nivel: g._count._all,
        }),
      ),
    );
  }

  // Un aviso para el padre de cada conversación con mensajes del instituto sin ver (solo cuentas activas).
  private async mensajesDelInstituto(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDePadres(tx);
    const grupos = await this.db(tx).mensaje.groupBy({
      by: ["chatId"],
      where: { rolEmisor: { in: ["admin", "secretario"] }, vistoEn: null, chat: { padreId: { in: [...cuentas.keys()] } } },
      _count: { _all: true },
    });
    if (grupos.length === 0) return [];
    const chats = await this.db(tx).chat.findMany({ where: { id: { in: grupos.map((g) => g.chatId) } }, select: { id: true, padreId: true } });
    const padreDe = new Map(chats.map((c) => [c.id, c.padreId]));
    return grupos.map((g) =>
      aviso({
        usuarioId: cuentas.get(padreDe.get(g.chatId) as string) as string,
        rol: "padre",
        tipo: "mensajes_instituto",
        clave: `mensajes:${g.chatId}`,
        tono: "info",
        texto: `${cantidad(g._count._all, "mensaje nuevo", "mensajes nuevos")} del instituto`,
        recurso: { tipo: "chat", chatId: g.chatId },
        nivel: g._count._all,
      }),
    );
  }
```

- [ ] **Step 4: Suscripciones**

En `notificacion.suscripciones.ts`, antes del cierre de la función:

```ts
  tablero.alPublicarse("chat.mensaje", sincronizar(["mensajes_familia", "mensajes_instituto"]));
  tablero.alPublicarse("chat.leido", sincronizar(["mensajes_familia", "mensajes_instituto"]));
```

- [ ] **Step 5: Correr las pruebas**

```bash
bash $SCRATCH/en.sh server "pnpm typecheck && pnpm exec tsx scripts/_avisos-chat.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm exec tsx scripts/_suscripciones.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm exec tsx scripts/_criterios.ts 2>&1 | python3 $SCRATCH/chequear.py"
```
Expected: `15 bien, 0 mal` en `_avisos-chat`. En `_suscripciones`, 0 mal y dos chequeos más que antes de esta tarea. En `_criterios`, 0 mal y la misma cantidad que antes (regresión). Anotar los números de los dos scripts del 3a antes del Step 1.

- [ ] **Step 6: Commit**

```bash
git add server/src
git commit -m "Avisos de mensajes nuevos del chat: agrupados por conversación, se resuelven al leer y nunca le llegan a quien escribe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Señal en vivo del chat

**Files:**
- Modify: `server/src/core/ports.ts`, `server/src/core/adapters/CanalEnMemoria.ts`, `server/src/container.ts`
- Create: `server/src/modules/chats/chat.tiempoReal.ts`
- Test: `server/scripts/_chat-en-vivo.ts`; Modify (prueba): `server/scripts/_canal.ts`

**Interfaces:**
- Produces:
  - `CanalEnVivo.enviarARoles(roles: Rol[], senal: SenalEnVivo): void`;
  - la señal `chat` con `{ chatId }`;
  - `suscribirChatEnVivo(tablero, canal)`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `server/scripts/_canal.ts`, antes del final de la función principal:

```ts
  canal.enviarARoles(["admin", "secretario"], { tipo: "chat", datos: { chatId: "c1" } });
  ok("a todos los de esos roles", reemplazo.recibidas.at(-1), 'chat {"chatId":"c1"}');
  ok("no a otros roles", otra.recibidas.length, 0);
```

`server/scripts/_chat-en-vivo.ts`, con la misma estructura y las mismas funciones `login`, `pedir`, `abrir` y `si` de `_tiempo-real.ts` (copiarlas de ese script, que está en `server/scripts/`):

```ts
(async () => {
  const m = await crearMundo(prisma);
  const padreTk = await login("padre");
  const adminTk = await login("admin");
  const padre = abrir(padreTk);
  const admin = abrir(adminTk);
  const ajeno = abrir(await login("ajeno"));
  const profe = abrir(await login("profe"));
  await esperar(600);
  const chatId = ((await (await pedir("GET", "/api/chats/mio", padreTk)).json()) as { id: string }).id;
  await pedir("POST", `/api/chats/${chatId}/mensajes`, padreTk, { texto: "Mensaje secreto" });
  await esperar(500);
  ok("el instituto recibe la señal", si(admin.texto().includes(`event: chat\ndata: {"chatId":"${chatId}"}`)), "sí");
  ok("el padre también (otra pestaña suya se actualiza)", si(padre.texto().includes("event: chat")), "sí");
  ok("otra familia no", si(ajeno.texto().includes("event: chat")), "no");
  ok("un profesor no", si(profe.texto().includes("event: chat")), "no");
  ok("la señal no lleva el texto", si(admin.texto().includes("Mensaje secreto")), "no");
  const antes = padre.texto().split("event: chat").length;
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await esperar(500);
  ok("al leer el instituto, el padre recibe la señal (aparece el Visto)", padre.texto().split("event: chat").length, antes + 1);
  const despues = padre.texto().split("event: chat").length;
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await esperar(500);
  ok("leer sin nada pendiente no manda señal", padre.texto().split("event: chat").length, despues);
  [padre, admin, ajeno, profe].forEach((c) => c.cortar());
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { padreId: { startsWith: "prueba-tmp-av" } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

Run: `bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_canal.ts 2>&1 | python3 $SCRATCH/chequear.py; pnpm exec tsx scripts/_chat-en-vivo.ts 2>&1 | python3 $SCRATCH/chequear.py"`
Expected: FAIL (`canal.enviarARoles is not a function`; no llega ninguna señal `chat`).

- [ ] **Step 2: El canal manda a todos los de unos roles**

En `core/ports.ts`, en `CanalEnVivo`, después de `enviarA`:

```ts
  // A todas las conexiones con alguno de esos roles (por ejemplo, la bandeja compartida del instituto).
  enviarARoles(roles: Rol[], senal: SenalEnVivo): void;
```

En `CanalEnMemoria.ts`:

```ts
  enviarARoles(roles: Rol[], senal: SenalEnVivo): void {
    for (const c of this.porSesion.values()) if (roles.includes(c.rol)) c.enviar(senal);
  }
```

- [ ] **Step 3: La señal del chat**

`server/src/modules/chats/chat.tiempoReal.ts`:

```ts
import type { TableroDeAnuncios } from "../../core/eventos";
import type { CanalEnVivo } from "../../core/ports";
import type { EventosDelSistema } from "../../eventos";
import type { EventosChats } from "./chat.eventos";

// Después de confirmar un mensaje o una lectura, avisa en vivo a los dos lados: a todo el instituto (bandeja compartida)
// y al padre de esa conversación. Solo el identificador de la conversación: la pantalla vuelve a pedir lo que cambió.
export function suscribirChatEnVivo(tablero: TableroDeAnuncios<EventosDelSistema>, canal: CanalEnVivo): void {
  const avisar = ({ chatId, usuarioIdPadre }: EventosChats["chat.mensaje"]) => {
    const senal = { tipo: "chat", datos: { chatId } };
    canal.enviarARoles(["admin", "secretario"], senal);
    if (usuarioIdPadre) canal.enviarA(usuarioIdPadre, "padre", senal);
  };
  tablero.alConfirmarse("chat.mensaje", avisar);
  tablero.alConfirmarse("chat.leido", avisar);
}
```

En `container.ts`: `import { suscribirChatEnVivo } from "./modules/chats/chat.tiempoReal";` y, después de la suscripción de `sesiones.cerradas`, `suscribirChatEnVivo(tablero, canalEnVivo);`.

- [ ] **Step 4: Correr las pruebas**

```bash
bash $SCRATCH/en.sh server "pnpm typecheck && pnpm exec tsx scripts/_canal.ts 2>&1 | python3 $SCRATCH/chequear.py"
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_chat-en-vivo.ts 2>&1 | python3 $SCRATCH/chequear.py"
```
Expected: `_canal` con 0 mal y dos chequeos más que antes de esta tarea; `_chat-en-vivo` con `8 bien, 0 mal`.

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "Señal en vivo del chat: llega al instituto y al padre de la conversación al enviar y al leer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client — datos del chat, señal en vivo, números del menú y enlaces de los avisos

**Files:**
- Modify: `client/src/features/chats/types.ts`, `chatService.ts`, `hooks/useChats.ts`, `hooks/useMiChat.ts`, `hooks/useEnviarMensaje.ts`
- Create: `client/src/features/chats/hooks/{useChatsNoLeidos,useMarcarLeido,useIniciarConversacion}.ts`, `client/src/core/components/layout/ContadorChats.tsx`
- Modify: `client/src/core/tiempoReal/TiempoReal.tsx`, `client/src/core/components/layout/{nav.ts,AppLayout.tsx}`, `client/src/features/notificaciones/{types,rutas}.ts`
- Test: `$SCRATCH/e2e-chat-menu.js`

**Interfaces:**
- Produces:
  - tipos `Mensaje.vistoEn: string | null`, `ResumenChat`, `ChatConNoLeidos`, `ConversacionIniciada`, `NoLeidosChat`;
  - `chatService.{listarResumenes, miChat, noLeidos, marcarLeido, iniciar, listarMensajes, enviarMensaje}`;
  - hooks `useChats()` (key `["chats", "resumenes"]`), `useMiChat()` (`["chats", "mio"]`), `useChatsNoLeidos(habilitado)` (`["chats", "no-leidos"]`), `useMarcarLeido()` y `useIniciarConversacion()`;
  - `NavItem.contador?: "chats"`;
  - el recurso de aviso `chat` → `/chats?conversacion=<id>` (instituto) o `/chat` (padre).

- [ ] **Step 1: Escribir el recorrido que falla**

`$SCRATCH/e2e-chat-menu.js` (antes: `_mundo-avisos.ts crear`):

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const email = (q) => `prueba-tmp-av-${q}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const contadorMenu = (p, etiqueta) => p.locator(`nav a:has-text("${etiqueta}") [data-contador-menu]`).textContent({ timeout: 1500 }).catch(() => "ninguno");

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await navegador.newPage();
  await entrar(admin, "admin");
  await admin.waitForTimeout(1200);
  ok("sin mensajes, el menú no muestra número", await contadorMenu(admin, "Chats"), "ninguno");
  const padreTk = await loginApi("padre");
  const chatId = (await (await pedir("GET", "/api/chats/mio", padreTk)).json()).id;
  await pedir("POST", `/api/chats/${chatId}/mensajes`, padreTk, { texto: "Hola" });
  await admin.waitForTimeout(1500);
  ok("llega un mensaje: el menú del instituto se actualiza solo", await contadorMenu(admin, "Chats"), "1");
  await admin.click('button[aria-label^="Notificaciones"]');
  await admin.click('[data-notificacion]:has-text("mensaje nuevo de Pruebaav padre")');
  await admin.waitForURL(/\/chats/);
  ok("el aviso lleva a la conversación", new URL(admin.url()).searchParams.get("conversacion"), chatId);

  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.waitForTimeout(1200);
  const adminTk = await loginApi("admin");
  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "Hola, ¿en qué te ayudamos?" });
  await padre.waitForTimeout(1500);
  ok("llega una respuesta: el menú del padre se actualiza solo", await contadorMenu(padre, "Mensajes"), "1");
  await navegador.close();
})();
```

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null" && bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-menu.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no hay `[data-contador-menu]`).

- [ ] **Step 2: Tipos, servicio y hooks**

Reemplazar `features/chats/types.ts`:

```ts
import type { Rol } from "@/features/auth/types";

export interface Chat {
  id: string;
  padreId: string;
  creadoEn: string;
}

// La conversación del padre, con los mensajes del instituto que todavía no vio.
export interface ChatConNoLeidos extends Chat {
  noLeidos: number;
}

// Lo que devuelve "Nueva conversación": si el padre todavía no tiene cuenta activa, va a verla cuando entre.
export interface ConversacionIniciada extends Chat {
  cuentaActiva: boolean;
}

// Una conversación vista desde la lista del instituto.
export interface ResumenChat {
  chatId: string;
  padreId: string;
  padreNombre: string;
  hijos: string[];
  ultimoMensaje: { texto: string; fecha: string; delInstituto: boolean } | null;
  noLeidos: number;
  creadoEn: string;
}

// El número del menú: conversaciones (instituto) o mensajes (padre) sin leer.
export interface NoLeidosChat {
  conversaciones?: number;
  mensajes?: number;
}

export interface Mensaje {
  id: string;
  chatId: string;
  emisorId: string;
  rolEmisor: Rol;
  texto: string;
  fecha: string;
  // Cuándo lo vio el otro lado (null = todavía no).
  vistoEn: string | null;
  // Solo viene al listar los mensajes de una conversación.
  emisorNombre?: string;
}

export interface EnviarMensajeInput {
  texto: string;
}
```

Reemplazar `features/chats/chatService.ts`:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { ChatConNoLeidos, ConversacionIniciada, EnviarMensajeInput, Mensaje, NoLeidosChat, ResumenChat } from "./types";

export const chatService = {
  listarResumenes: () => apiClient.get<ResumenChat[]>("/api/chats"),
  miChat: () => apiClient.get<ChatConNoLeidos>("/api/chats/mio"),
  noLeidos: () => apiClient.get<NoLeidosChat>("/api/chats/no-leidos"),
  iniciar: (padreId: string) => apiClient.post<ConversacionIniciada>("/api/chats", { padreId }),
  listarMensajes: (chatId: string) => apiClient.get<Mensaje[]>(`/api/chats/${chatId}/mensajes`),
  enviarMensaje: (chatId: string, datos: EnviarMensajeInput) => apiClient.post<Mensaje>(`/api/chats/${chatId}/mensajes`, datos),
  // `hasta`: la fecha del último mensaje en pantalla; lo que llegó después no se marca.
  marcarLeido: ({ chatId, hasta }: { chatId: string; hasta: string }) => apiClient.post<void>(`/api/chats/${chatId}/leido`, { hasta }),
};
```

`hooks/useChats.ts`: `queryKey: ["chats", "resumenes"]`, `queryFn: chatService.listarResumenes`. `hooks/useMiChat.ts`: igual que hoy (key `["chats", "mio"]`).

`hooks/useEnviarMensaje.ts`, en `onSuccess`, además de invalidar `["mensajes", chatId]`:

```ts
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
```

`hooks/useChatsNoLeidos.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

// El número del menú lateral; se actualiza con la señal en vivo `chat` (core/tiempoReal).
export function useChatsNoLeidos(habilitado: boolean) {
  return useQuery({ queryKey: ["chats", "no-leidos"], queryFn: chatService.noLeidos, enabled: habilitado });
}
```

`hooks/useMarcarLeido.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useMarcarLeido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.marcarLeido,
    onSettled: (_r, _e, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
    },
  });
}
```

`hooks/useIniciarConversacion.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useIniciarConversacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.iniciar,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}
```

- [ ] **Step 3: La señal en vivo y el número del menú**

En `core/tiempoReal/TiempoReal.tsx`, dentro de `alSenal`, antes del `else if (senal.tipo === "sesion-cerrada")`:

```ts
      } else if (senal.tipo === "chat") {
        // Un mensaje nuevo o una lectura: la lista, el número del menú y esa conversación se vuelven a pedir.
        const chatId = (senal.datos as { chatId?: unknown } | null)?.chatId;
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
        if (typeof chatId === "string") void queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
```

En `core/components/layout/nav.ts`:
- `NavItem` suma `// Número a mostrar al lado (mensajes sin leer). \n  contador?: "chats";`;
- a los ítems `{ to: "/chats", … }` (los dos) y `{ to: "/chat", … }`, sumarles `contador: "chats"`.

`core/components/layout/ContadorChats.tsx`:

```tsx
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useChatsNoLeidos } from "@/features/chats/hooks/useChatsNoLeidos";

// Número del menú lateral: conversaciones con mensajes sin leer (instituto) o mensajes sin leer (padre).
export function ContadorChats() {
  const { usuario } = useAuth();
  const habilitado = usuario?.rol === "admin" || usuario?.rol === "secretario" || usuario?.rol === "padre";
  const { data } = useChatsNoLeidos(habilitado);
  const n = (usuario?.rol === "padre" ? data?.mensajes : data?.conversaciones) ?? 0;
  if (n === 0) return null;
  return (
    <span
      data-contador-menu
      className="min-w-4 rounded-full px-1.5 text-center text-[10px] font-semibold leading-4 text-white"
      style={{ background: "var(--danger)" }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
```

En `AppLayout.tsx`: importar `ContadorChats` y, dentro del `NavLink`, después de `<span className="flex-1">{item.label}</span>`, agregar `{item.contador === "chats" && <ContadorChats />}`.

- [ ] **Step 4: El aviso del chat lleva a la conversación**

En `features/notificaciones/types.ts`: sumar `| "mensajes_familia" | "mensajes_instituto"` a `TipoNotificacion` y `| { tipo: "chat"; chatId: string }` a `RecursoAviso`.

En `features/notificaciones/rutas.ts`, en el `switch`:

```ts
    case "chat":
      return rol === "padre" ? "/chat" : conFiltros("/chats", { conversacion: recurso.chatId });
```

- [ ] **Step 5: Verificar**

```bash
bash $SCRATCH/en.sh client "pnpm typecheck && pnpm lint"
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null" && bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-menu.js 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null"
```
Expected: limpios (los 2 avisos de lint de siempre); `4 bien, 0 mal`. `ChatsAdminPage` todavía no lee `?conversacion=`: la Task 7 lo agrega. La prueba "lleva a la conversación" mira solo la dirección.

Si `ChatsAdminPage` no compila por el cambio de `useChats`, alcanza con dejarla compilando con lo mínimo (por ejemplo, usar `ResumenChat` en lugar de `Chat`); la reescritura completa es la Task 7.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Client del chat: resúmenes, no leídos, señal en vivo, número en el menú y aviso que lleva a la conversación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client — regla del "Visto" y leer solo si alguien mira (pantalla del padre)

**Files:**
- Create: `client/src/features/chats/visto.ts`, `client/src/features/chats/hooks/useMarcarLeidoSiMira.ts`, `client/src/features/chats/components/BurbujaMensaje.tsx`
- Modify: `client/src/features/chats/pages/ChatPage.tsx`
- Test: `server/scripts/_visto.ts`, `$SCRATCH/e2e-chat-visto.js`

**Interfaces:**
- Produces:
  - `vistoDelUltimo(mensajes: Mensaje[], soyInstituto: boolean): string | null`;
  - `hayNoLeidos(mensajes, soyInstituto): boolean`;
  - `useMarcarLeidoSiMira(chatId: string | undefined, mensajes: Mensaje[], soyInstituto: boolean): void`;
  - `<BurbujaMensaje mensaje mio etiqueta? visto? />` (la reutiliza la Task 7).

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_visto.ts` (la regla es TypeScript puro):

```ts
import { hayNoLeidos, vistoDelUltimo } from "../../client/src/features/chats/visto";
import type { Mensaje } from "../../client/src/features/chats/types";
import { ok } from "./_check";

const m = (rolEmisor: "padre" | "secretario", vistoEn: string | null): Mensaje => ({ id: "x", chatId: "c", emisorId: "e", rolEmisor, texto: "t", fecha: "2026-10-16T10:00:00Z", vistoEn });
ok("conversación vacía: nada", vistoDelUltimo([], false), null);
ok("mi último sin ver: nada", vistoDelUltimo([m("padre", null)], false), null);
ok("mi último visto: la hora", vistoDelUltimo([m("padre", "2026-10-16T10:15:00Z")], false), "2026-10-16T10:15:00Z");
ok("el último es del otro: nada", vistoDelUltimo([m("padre", "2026-10-16T10:15:00Z"), m("secretario", null)], false), null);
ok("vuelvo a escribir y lo ven: en el nuevo", vistoDelUltimo([m("padre", "x"), m("secretario", "y"), m("padre", "z")], false), "z");
ok("del lado del instituto", vistoDelUltimo([m("padre", null), m("secretario", "w")], true), "w");
ok("hay no leídos del otro lado", hayNoLeidos([m("secretario", null)], false), true);
ok("los míos sin ver no cuentan", hayNoLeidos([m("padre", null)], false), false);
```

`$SCRATCH/e2e-chat-visto.js` (antes: `_mundo-avisos.ts crear`):

```js
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const visto = (p) => p.locator("[data-visto]").allTextContents();
const ocultar = (p, oculta) =>
  p.evaluate((o) => {
    Object.defineProperty(document, "visibilityState", { value: o ? "hidden" : "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, oculta);

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/chat`);
  await padre.waitForTimeout(1200);
  await padre.fill('input[placeholder^="Escribí"]', "¿Mañana hay clase?");
  await padre.keyboard.press("Enter");
  await padre.waitForTimeout(800);
  ok("1: mi mensaje, sin leer: sin Visto", (await visto(padre)).length, 0);
  ok("cada mensaje muestra su hora", (await padre.locator("[data-hora]").first().textContent()).trim().match(/^\d{2}:\d{2}$/) ? "sí" : "no", "sí");

  const adminTk = await loginApi("admin");
  const chatId = (await (await pedir("GET", "/api/chats/mio", await loginApi("padre"))).json()).id;
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await padre.waitForTimeout(1500);
  ok("2: el instituto lo lee: aparece el Visto al instante", (await visto(padre)).join().startsWith("Visto · ") ? "sí" : "no", "sí");

  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "Sí, normal" });
  await padre.waitForTimeout(1500);
  ok("3: el instituto responde: el Visto desaparece", (await visto(padre)).length, 0);
  ok("la respuesta llega sola y la pantalla abierta la marca leída", q(`select count(*) from "Mensaje" where "chatId"='${chatId}' and "rolEmisor"='secretario' and "vistoEn" is null`), "0");

  await padre.fill('input[placeholder^="Escribí"]', "Gracias");
  await padre.keyboard.press("Enter");
  await padre.waitForTimeout(800);
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await padre.waitForTimeout(1500);
  ok("4: vuelvo a escribir y lo leen: el Visto aparece en el nuevo", await padre.locator('[data-mensaje]:last-child [data-visto]').count(), 1);

  await ocultar(padre, true);
  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "Con la pestaña oculta" });
  await padre.waitForTimeout(1500);
  ok("pestaña en segundo plano: no se marca leído", q(`select count(*) from "Mensaje" where "chatId"='${chatId}' and "vistoEn" is null and texto='Con la pestaña oculta'`), "1");
  await ocultar(padre, false);
  await padre.waitForTimeout(1500);
  ok("al volver a la pestaña: queda leído", q(`select count(*) from "Mensaje" where "chatId"='${chatId}' and "vistoEn" is null and texto='Con la pestaña oculta'`), "0");
  await navegador.close();
})();
```

Run: `bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_visto.ts 2>&1 | python3 $SCRATCH/chequear.py"`
Expected: FAIL (no existe `visto.ts`).

- [ ] **Step 2: La regla del "Visto"**

`client/src/features/chats/visto.ts`:

```ts
import type { Mensaje } from "./types";

const esDelInstituto = (m: Mensaje) => m.rolEmisor !== "padre";

// "Visto" va en un solo lugar: debajo del último mensaje de la conversación, si es de quien mira y el otro lado ya lo
// vio. Devuelve la hora en que se vio (ISO) o null. Cuando el otro responde, el último deja de ser propio y no hay Visto.
export function vistoDelUltimo(mensajes: Mensaje[], soyInstituto: boolean): string | null {
  const ultimo = mensajes.at(-1);
  if (!ultimo || esDelInstituto(ultimo) !== soyInstituto) return null;
  return ultimo.vistoEn;
}

// ¿Hay mensajes del otro lado que quien mira todavía no vio?
export function hayNoLeidos(mensajes: Mensaje[], soyInstituto: boolean): boolean {
  return mensajes.some((m) => esDelInstituto(m) !== soyInstituto && m.vistoEn === null);
}
```

- [ ] **Step 3: Leer solo si alguien mira**

`client/src/features/chats/hooks/useMarcarLeidoSiMira.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import type { Mensaje } from "../types";
import { hayNoLeidos } from "../visto";
import { useMarcarLeido } from "./useMarcarLeido";

// Marca leída la conversación solo si está en pantalla (quien la usa la monta solo cuando se ve), la pestaña está
// visible y hay algo del otro lado sin ver. Marca hasta el último mensaje mostrado: lo que llegue después se marca
// cuando aparezca. Una pestaña en segundo plano no marca nada; cuando vuelve a estar visible, recién ahí.
export function useMarcarLeidoSiMira(chatId: string | undefined, mensajes: Mensaje[], soyInstituto: boolean): void {
  const { mutate } = useMarcarLeido();
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  // Lo último que se pidió marcar: evita repetir el pedido mientras la lista vuelve a cargarse.
  const pedido = useRef<string | null>(null);

  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  const pendiente = hayNoLeidos(mensajes, soyInstituto);
  const hasta = mensajes.at(-1)?.fecha;
  useEffect(() => {
    if (!chatId || !hasta || !pendiente || !visible) return;
    const clave = `${chatId}|${hasta}`;
    if (pedido.current === clave) return;
    pedido.current = clave;
    // Si falla, se puede volver a intentar con la próxima carga de la lista.
    mutate(
      { chatId, hasta },
      {
        onError: () => {
          pedido.current = null;
        },
      },
    );
  }, [chatId, hasta, pendiente, visible, mutate]);
}
```

- [ ] **Step 4: La burbuja del mensaje (compartida)**

`client/src/features/chats/components/BurbujaMensaje.tsx`:

```tsx
import type { Mensaje } from "../types";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

// Un mensaje con su hora de envío. `visto` (la hora en que se vio) solo lo recibe el último mensaje propio ya leído.
export function BurbujaMensaje({ mensaje, mio, etiqueta, visto }: { mensaje: Mensaje; mio: boolean; etiqueta?: string; visto?: string | null }) {
  return (
    <div data-mensaje className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[78%] px-3 py-2.5"
        style={{
          borderRadius: mio ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
          background: mio ? "var(--brand)" : "var(--bg-muted)",
          color: mio ? "#fff" : "var(--text)",
        }}
      >
        {etiqueta && <p className="mb-1 text-[10.5px] font-semibold text-muted-foreground">{etiqueta}</p>}
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{mensaje.texto}</p>
        <p data-hora className="mt-1 text-right text-[10px]" style={{ opacity: mio ? 0.75 : 0.55 }}>
          {hora(mensaje.fecha)}
        </p>
      </div>
      {visto && (
        <p data-visto className="mt-1 text-[10.5px] text-muted-foreground">
          Visto · {hora(visto)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: La pantalla del padre**

En `features/chats/pages/ChatPage.tsx`:
- Imports nuevos: `import { BurbujaMensaje } from "../components/BurbujaMensaje";`, `import { useMarcarLeidoSiMira } from "../hooks/useMarcarLeidoSiMira";`, `import { vistoDelUltimo } from "../visto";`.
- Después de `const enviarMensaje = …`:
  ```ts
    const lista = mensajes ?? [];
    const visto = vistoDelUltimo(lista, false);
    useMarcarLeidoSiMira(chat?.id, lista, false);
  ```
- Reemplazar el `{mensajes?.map((m) => { … })}` por:
  ```tsx
          {lista.map((m, i) => {
            const mio = m.rolEmisor === "padre";
            const etiqueta = mio ? undefined : `${m.rolEmisor === "admin" ? "Dirección" : "Secretaría"}${m.emisorNombre ? ` — ${m.emisorNombre}` : ""}`;
            return <BurbujaMensaje key={m.id} mensaje={m} mio={mio} etiqueta={etiqueta} visto={i === lista.length - 1 ? visto : null} />;
          })}
  ```

- [ ] **Step 6: Verificar**

```bash
bash $SCRATCH/en.sh client "pnpm typecheck && pnpm lint"
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_visto.ts 2>&1 | python3 $SCRATCH/chequear.py"
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null" && bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-visto.js 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null"
```
Expected: limpios; `8 bien, 0 mal`; `8 bien, 0 mal`.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "Chat del padre: \"Visto\" debajo del último mensaje propio leído y leer solo con la pestaña visible

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Client — pantalla Chats del instituto

**Files:**
- Create: `client/src/features/chats/components/NuevaConversacion.tsx`
- Replace: `client/src/features/chats/pages/ChatsAdminPage.tsx`
- Test: `$SCRATCH/e2e-chat-instituto.js`

**Interfaces:**
- Consumes: `useChats`, `useMensajes`, `useEnviarMensaje`, `useIniciarConversacion`, `usePadres`, `useFiltrosDeUrl`, `BurbujaMensaje`, `vistoDelUltimo`, `hayNoLeidos`, `useMarcarLeidoSiMira`.
- Produces: `/chats?conversacion=<chatId>`; los atributos `[data-conversacion]` y `[data-no-leidos]` de la lista; el botón "Nueva conversación".

- [ ] **Step 1: Escribir el recorrido que falla**

`$SCRATCH/e2e-chat-instituto.js` (antes: `_mundo-avisos.ts crear`, y crear el padre sin cuenta con `q "insert into \"Padre\"(id,nombre,apellido,dni,vinculo) values ('prueba-tmp-av-sincuenta','Pruebaav','Sincuenta','99400050','madre')"`):

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const adminTk = await loginApi("admin");
  // Dos conversaciones: la del ajeno (iniciada por el instituto) y la del padre (que escribe después)
  const ajeno = (await (await pedir("POST", "/api/chats", adminTk, { padreId: "prueba-tmp-av-ajeno" })).json()).id;
  await pedir("POST", `/api/chats/${ajeno}/mensajes`, adminTk, { texto: "Hola, le escribimos del instituto" });
  const p = await navegador.newPage({ viewport: { width: 1280, height: 860 } });
  await entrar(p, "admin");
  await p.goto(`${BASE}/chats?conversacion=${ajeno}`);
  await p.waitForSelector("[data-conversacion]");
  const padreTk = await loginApi("padre");
  const delPadre = (await (await pedir("GET", "/api/chats/mio", padreTk)).json()).id;
  await pedir("POST", `/api/chats/${delPadre}/mensajes`, padreTk, { texto: "Una consulta" });
  await pedir("POST", `/api/chats/${delPadre}/mensajes`, padreTk, { texto: "¿Me responden?" });
  await p.waitForTimeout(1500);
  const primera = p.locator("[data-conversacion]").first();
  ok("un mensaje nuevo sube la conversación al tope, sola", await primera.getAttribute("data-conversacion"), delPadre);
  ok("con su número de no leídos", await primera.locator("[data-no-leidos]").textContent(), "2");
  ok("la conversación abierta es la de la dirección", await p.locator("[data-conversacion-abierta]").getAttribute("data-conversacion-abierta"), ajeno);

  await primera.click();
  await p.waitForTimeout(1500);
  ok("abrirla la marca leída: se va el número", await p.locator(`[data-conversacion="${delPadre}"] [data-no-leidos]`).count(), 0);
  ok("y queda en la dirección", new URL(p.url()).searchParams.get("conversacion"), delPadre);
  await p.reload();
  await p.waitForSelector("[data-conversacion-abierta]");
  ok("al recargar sigue abierta", await p.locator("[data-conversacion-abierta]").getAttribute("data-conversacion-abierta"), delPadre);

  await p.fill('input[placeholder^="Escribir un mensaje"]', "Hola, ¿en qué te ayudamos?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(800);
  ok("sin leer todavía: sin Visto", await p.locator("[data-visto]").count(), 0);
  await pedir("POST", `/api/chats/${delPadre}/leido`, padreTk);
  await p.waitForTimeout(1500);
  ok("el padre lo lee: aparece el Visto", await p.locator("[data-visto]").count(), 1);

  // Nueva conversación con un padre sin cuenta
  await p.click('button:has-text("Nueva conversación")');
  await p.fill('input[placeholder^="Buscar por nombre"]', "Sincuenta");
  await p.click('[data-padre-opcion]:has-text("Sincuenta")');
  await p.waitForTimeout(1000);
  ok("se abre la conversación nueva", (await p.locator("[data-conversacion-abierta] >> text=Pruebaav Sincuenta").count()) > 0 ? "sí" : "no", "sí");
  ok("aclara que todavía no entró", await p.locator("text=Todavía no entró al sistema: va a ver la conversación cuando entre.").count(), 1);
  ok("el texto buscado no va a la dirección", p.url().includes("Sincuenta") ? "sí" : "no", "no");

  await p.setViewportSize({ width: 390, height: 800 });
  await p.goto(`${BASE}/chats`);
  await p.waitForSelector("[data-conversacion]");
  ok("celular: sin desborde", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await pedir("POST", `/api/chats/${delPadre}/mensajes`, padreTk, { texto: "Desde el celular no lo ve nadie" });
  await p.waitForTimeout(1500);
  ok("celular con la lista a la vista: no se abre sola ni se marca leída", await p.locator(`[data-conversacion="${delPadre}"] [data-no-leidos]`).textContent(), "1");
  await navegador.close();
})();
```

Run: `bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-instituto.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no hay `[data-conversacion]`).

- [ ] **Step 2: "Nueva conversación"**

`client/src/features/chats/components/NuevaConversacion.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { normalizarTexto } from "@/core/lib/utils";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { useIniciarConversacion } from "../hooks/useIniciarConversacion";
import type { ConversacionIniciada } from "../types";

// Busca un padre o madre (por nombre, apellido o DNI) y abre su conversación, creándola si no existía. El texto
// buscado no va a la dirección: son nombres y DNI.
export function NuevaConversacion({ onCerrar, onAbierta }: { onCerrar: () => void; onAbierta: (c: ConversacionIniciada) => void }) {
  const { data: padres } = usePadres();
  const iniciar = useIniciarConversacion();
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return [];
    return (padres ?? [])
      .filter((p) => normalizarTexto(`${p.nombre} ${p.apellido} ${p.dni}`).includes(termino))
      .slice(0, 8);
  }, [padres, busqueda]);

  return (
    <Modal title="Nueva conversación" onClose={onCerrar}>
      <Input autoFocus placeholder="Buscar por nombre, apellido o DNI…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="space-y-1">
        {resultados.map((p) => (
          <button
            key={p.id}
            data-padre-opcion
            disabled={iniciar.isPending}
            onClick={() => iniciar.mutate(p.id, { onSuccess: onAbierta })}
            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[13px] hover:bg-accent"
          >
            <span>
              {p.nombre} {p.apellido}
            </span>
            <span className="text-[11.5px] text-muted-foreground">DNI {p.dni}</span>
          </button>
        ))}
        {busqueda.trim() && resultados.length === 0 && <p className="px-3 py-2 text-[12.5px] text-muted-foreground">No hay coincidencias.</p>}
        {iniciar.isError && (
          <p role="alert" className="px-3 py-2 text-[12.5px] text-destructive">
            No se pudo abrir la conversación. Probá de nuevo.
          </p>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Reescribir `ChatsAdminPage`**

Reemplazar `client/src/features/chats/pages/ChatsAdminPage.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, MessageSquarePlus, Send } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { ApiError } from "@/core/lib/apiClient";
import { NuevaConversacion } from "../components/NuevaConversacion";
import { BurbujaMensaje } from "../components/BurbujaMensaje";
import { useChats } from "../hooks/useChats";
import { useEnviarMensaje } from "../hooks/useEnviarMensaje";
import { useMarcarLeidoSiMira } from "../hooks/useMarcarLeidoSiMira";
import { useMensajes } from "../hooks/useMensajes";
import { vistoDelUltimo } from "../visto";

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

// Bandeja compartida del instituto: conversaciones ordenadas por el último mensaje, con sus no leídos. La conversación
// abierta queda en la dirección (?conversacion=), así el aviso de la campana lleva directo a ella. No se abre ninguna
// sola: abrir una la marca leída, y eso tiene que ser una decisión de quien mira.
export default function ChatsAdminPage() {
  const { data: resumenes } = useChats();
  const { leer, escribir } = useFiltrosDeUrl();
  const pedida = leer("conversacion");
  // Un valor viejo o ajeno en la dirección no abre nada.
  const seleccionada = resumenes?.find((r) => r.chatId === pedida);
  const selectedId = seleccionada?.chatId;
  const abrir = (chatId: string | null) => escribir({ conversacion: chatId });

  const [nueva, setNueva] = useState(false);
  const [sinCuenta, setSinCuenta] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: mensajes } = useMensajes(selectedId);
  const lista = mensajes ?? [];
  const enviarMensaje = useEnviarMensaje(selectedId);
  const [texto, setTexto] = useState("");
  const visto = vistoDelUltimo(lista, true);
  // En el celular la lista y la conversación no entran lado a lado: con una conversación abierta se ve solo ella, y
  // "volver" la cierra (sale de la dirección). Así una conversación oculta detrás de la lista nunca se marca leída.
  useMarcarLeidoSiMira(selectedId, lista, true);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lista.length, selectedId]);

  const onEnviar = () => {
    if (!texto.trim()) return;
    enviarMensaje.mutate(texto.trim(), { onSuccess: () => setTexto("") });
  };

  return (
    <div className="card-hl flex overflow-hidden" style={{ height: "calc(100vh - 168px)", minHeight: 460 }}>
      <div
        className={`${seleccionada ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col md:w-[290px]`}
        style={{ borderRight: "1px solid var(--border-hex)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-hex)" }}>
          <div>
            <h3 className="text-[13px] font-semibold">Conversaciones</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {resumenes?.length ?? 0} {resumenes?.length === 1 ? "familia" : "familias"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNueva(true)}>
            <MessageSquarePlus size={14} /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {resumenes?.map((r) => (
            <div
              key={r.chatId}
              data-conversacion={r.chatId}
              onClick={() => {
                abrir(r.chatId);
                setSinCuenta(null);
              }}
              className="flex cursor-pointer items-start gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border-hex)", background: selectedId === r.chatId ? "var(--bg-subtle)" : "transparent" }}
            >
              <Avatar name={r.padreNombre} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-[12.5px] ${r.noLeidos > 0 ? "font-semibold" : "font-medium"}`}>{r.padreNombre}</p>
                  {r.ultimoMensaje && <span className="shrink-0 text-[10px] text-muted-foreground">{fechaCorta(r.ultimoMensaje.fecha)}</span>}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{r.hijos.join(" · ") || "—"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                    {r.ultimoMensaje ? `${r.ultimoMensaje.delInstituto ? "Vos: " : ""}${r.ultimoMensaje.texto}` : "Sin mensajes todavía"}
                  </p>
                  {r.noLeidos > 0 && (
                    <span
                      data-no-leidos
                      className="min-w-4 shrink-0 rounded-full px-1.5 text-center text-[10px] font-semibold leading-4 text-white"
                      style={{ background: "var(--danger)" }}
                    >
                      {r.noLeidos}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {resumenes?.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin conversaciones.</p>}
        </div>
      </div>

      {seleccionada ? (
        <div data-conversacion-abierta={seleccionada.chatId} className="flex min-w-0 w-full flex-1 flex-col">
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-hex)" }}>
            <button onClick={() => abrir(null)} aria-label="Volver a las conversaciones" className="-ml-1 rounded p-1 text-muted-foreground md:hidden">
              <ChevronLeft size={18} />
            </button>
            <Avatar name={seleccionada.padreNombre} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{seleccionada.padreNombre}</p>
              <p className="truncate text-[11px] text-muted-foreground">{seleccionada.hijos.join(" · ") || "—"}</p>
            </div>
          </div>
          {sinCuenta === seleccionada.chatId && (
            <p className="px-4 py-2 text-[12px]" style={{ background: "var(--warning-soft)", borderBottom: "1px solid var(--border-hex)" }}>
              Todavía no entró al sistema: va a ver la conversación cuando entre.
            </p>
          )}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ background: "var(--bg-subtle)" }}>
            {lista.length === 0 && <p className="py-8 text-center text-[12.5px] text-muted-foreground">Todavía no hay mensajes con esta familia.</p>}
            {lista.map((m, i) => {
              const mio = m.rolEmisor !== "padre";
              return (
                <BurbujaMensaje
                  key={m.id}
                  mensaje={m}
                  mio={mio}
                  etiqueta={mio ? undefined : seleccionada.padreNombre}
                  visto={i === lista.length - 1 ? visto : null}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-hex)" }}>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onEnviar();
                }
              }}
              placeholder="Escribir un mensaje…"
              className="flex-1"
            />
            <Button size="icon" onClick={onEnviar} disabled={enviarMensaje.isPending || !texto.trim()}>
              <Send size={14} />
            </Button>
          </div>
          {enviarMensaje.isError && (
            <p className="px-4 pb-2 text-sm text-destructive">
              {enviarMensaje.error instanceof ApiError ? enviarMensaje.error.message : "No se pudo enviar el mensaje"}
            </p>
          )}
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center text-muted-foreground md:flex">
          <p className="text-[13px]">Seleccioná una conversación</p>
        </div>
      )}

      {nueva && (
        <NuevaConversacion
          onCerrar={() => setNueva(false)}
          onAbierta={(c) => {
            setNueva(false);
            abrir(c.id);
            setSinCuenta(c.cuentaActiva ? null : c.id);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

```bash
bash $SCRATCH/en.sh client "pnpm typecheck && pnpm lint"
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null"; source $SCRATCH/lib.sh; q "insert into \"Padre\"(id,nombre,apellido,dni,vinculo) values ('prueba-tmp-av-sincuenta','Pruebaav','Sincuenta','99400050','madre')" >/dev/null
bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-instituto.js 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null"
```
Expected: limpios; `13 bien, 0 mal`. Sacar una captura (en `$SCRATCH`) de `/chats` en escritorio para revisar cómo se ve.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "Chats del instituto: lista con no leídos ordenada por el último mensaje, conversación en la dirección, \"Visto\" y Nueva conversación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentación y batería completa

**Files:**
- Modify: `CLAUDE.md`; memoria `proyecto_babylon_pendientes_futuros.md` y `MEMORY.md`

- [ ] **Step 1: `CLAUDE.md`**

1. **Nueva subsección "Chat en vivo (subproyecto 3b)"**, dentro de "Avisos guardados y en tiempo real":
   - bandeja compartida del instituto;
   - `Mensaje.vistoEn` y el `Lector` (`instituto`/`familia`);
   - la regla del "Visto" (`features/chats/visto.ts`) y marcar leído solo con la pestaña visible (`useMarcarLeidoSiMira`);
   - los anuncios `chat.mensaje`/`chat.leido`;
   - los avisos `mensajes_familia`/`mensajes_instituto`;
   - la señal `chat` (`chat.tiempoReal.ts`, `CanalEnVivo.enviarARoles`);
   - los números del menú (`ContadorChats`, `NavItem.contador`);
   - "Nueva conversación" (`obtenerOCrear` resiste dos pedidos a la vez);
   - `?conversacion=` en `/chats`;
   - lo pendiente: adjuntos, editar y borrar, y los emails.
2. **En la tabla de API:** reemplazar las filas de `/api/chats` por las nuevas (`GET /`, `POST /`, `GET /mio`, `GET /no-leidos`, `GET`/`POST /:id/mensajes`, `POST /:id/leido`).
3. **En "Pasada de fidelidad"**, la frase "Sin badge de no-leídos: no existe ningún campo 'leído' en `Mensaje`" pasa a decir que desde el 3b existe `vistoEn` y la lista muestra los no leídos.

- [ ] **Step 2: Batería completa**

```bash
cd server && bash $SCRATCH/en.sh server "pnpm typecheck && pnpm build" && bash $SCRATCH/en.sh client "pnpm typecheck && pnpm lint && pnpm build"
for s in _chat-repo _chat-servicio _avisos-chat _suscripciones _visto _canal _tablero _reconciliar _faltantes _criterios _avisos-servicio _lector-sse _resolver-lote _preferencia-bloqueo _historial-cursor; do echo "== $s: $(bash $SCRATCH/en.sh server "pnpm exec tsx scripts/$s.ts" 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"; done
bash $SCRATCH/reiniciar-api.sh
echo "== chat-api: $(bash $SCRATCH/chat-api.sh | python3 $SCRATCH/chequear.py | tail -1)"
echo "== _chat-en-vivo: $(bash $SCRATCH/en.sh server 'pnpm exec tsx scripts/_chat-en-vivo.ts' 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"
echo "== _tiempo-real: $(bash $SCRATCH/en.sh server 'pnpm exec tsx scripts/_tiempo-real.ts' 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"
for s in _sesiones _carrera-login _minors-sub2 _ficha-pendiente _invitaciones _activacion; do echo "== $s: $(bash $SCRATCH/en.sh server "pnpm exec tsx scripts/$s.ts" 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"; done
bash $SCRATCH/iniciar-client.sh
for e in e2e-chat-menu e2e-chat-visto; do bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null"; echo "== $e: $(bash $SCRATCH/e2e.sh $SCRATCH/$e.js 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"; done
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null"; source $SCRATCH/lib.sh; q "insert into \"Padre\"(id,nombre,apellido,dni,vinculo) values ('prueba-tmp-av-sincuenta','Pruebaav','Sincuenta','99400050','madre')" >/dev/null
echo "== e2e-chat-instituto: $(bash $SCRATCH/e2e.sh $SCRATCH/e2e-chat-instituto.js 2>&1 | python3 $SCRATCH/chequear.py | tail -1)"
bash $SCRATCH/en.sh server "pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null"
```
Expected: todo `N bien, 0 mal`; typecheck, lint y build limpios. Los recorridos del 3a en navegador (`e2e-campana`, `e2e-tiempo-real`, …) ya no están en el scratchpad: si se quieren correr, copiarlos de `docs/superpowers/plans/2026-10-15-avisos-en-tiempo-real.md`.

- [ ] **Step 3: Nada de prueba quedó en la base**

```bash
source $SCRATCH/lib.sh
{ ok "usuarios de prueba" "$(q "select count(*) from \"Usuario\" where id like 'prueba-tmp-%' or email like 'prueba-tmp-%'")" 0
  ok "chats de prueba" "$(q "select count(*) from \"Chat\" where \"padreId\" like 'prueba-tmp-%'")" 0
  ok "padres de prueba" "$(q "select count(*) from \"Padre\" where id like 'prueba-tmp-%'")" 0
  ok "mensajes reales sin tocar" "$(q "select count(*) from \"Mensaje\" m join \"Chat\" c on c.id=m.\"chatId\" where c.\"padreId\" not like 'prueba-%'")" "$(q "select count(*) from \"Mensaje\" m join \"Chat\" c on c.id=m.\"chatId\" where c.\"padreId\" not like 'prueba-%'")"
  ok "p6 intacta" "$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"p6@prueba.babylon.test","password":"prueba1234"}')" 200; } | python3 $SCRATCH/chequear.py
```
Expected: `5 bien, 0 mal`. Antes de empezar la Task 1, anotar cuántos mensajes reales hay (`select count(*) from "Mensaje" m join "Chat" c on c.id=m."chatId" where c."padreId" not like 'prueba-%'`) y comparar con ese número.

- [ ] **Step 4: Memoria**

En `proyecto_babylon_pendientes_futuros.md`: el 3b queda hecho (en rama, falta fusionar). Siguen el 3c, la tanda 2 de filtros, las sesiones separadas en la misma compu, los pendientes del chat (adjuntos, editar y borrar, emails) y el 2FA. Actualizar la línea de `MEMORY.md`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Documentar el chat en vivo, el \"Visto\" y los avisos de mensajes nuevos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
