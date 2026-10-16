# Avisos guardados y en tiempo real (subproyecto 3a) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La campana pasa a ser un historial real de avisos guardados por cuenta y rol, con "leído", preferencias por tipo y llegada al instante por una conexión SSE compartida entre pestañas, que también cierra al instante una sesión cerrada desde otro lado. Los avisos llevan a la pantalla exacta del recurso, con los filtros en la dirección.

**Architecture:** Un tablero de anuncios genérico (`core/eventos.ts`) recibe lo que publican los módulos dentro de sus transacciones. El módulo `notificaciones/` se suscribe: por cada anuncio, **sincroniza por completo** los tipos de aviso afectados (un criterio por tipo, calculado sobre todo el instituto, con un bloqueo por tipo) o crea los avisos de evento, todo dentro de la misma transacción. Después de confirmar, manda una señal por la pieza intercambiable `CanalEnVivo` (adaptador en memoria). La ruta SSE `/api/tiempo-real` mantiene una conexión por sesión. El navegador la abre con `fetch` y la comparte entre las pestañas de la misma sesión con Web Locks y `BroadcastChannel`.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4; React 19, TanStack Query, React Router 7, Tailwind 4. Node 24 + pnpm 11. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md`

**Dos precisiones respecto del spec**, decididas al planificar (se actualiza el spec en la Task 1):
1. **Sincronización por tipo completo, no por "alcance".** El spec habla de sincronizar "un alumno, un curso o una cuenta". El plan sincroniza siempre **todo el tipo**: con el volumen real (105 cuotas, 16 evaluaciones, 12 cuentas, ~145 alumnos) son pocas consultas, y así no hace falta calcular a qué filas existentes afecta cada alcance. Para que dos operaciones simultáneas no choquen, cada tipo se bloquea dentro de la transacción (`pg_advisory_xact_lock`).
2. **`cerrarTodas` no cambia.** En lugar de pasar los ids de las sesiones cerradas, el anuncio "sesiones cerradas" lleva la cuenta y el motivo. El canal vuelve a validar las conexiones abiertas de esa cuenta con el mismo validador de `authMiddleware` y corta las que ya no valen. Cubre todos los caminos sin tocar el repositorio de sesiones.

## Global Constraints

- **Arquitectura feature-first:**
  - `core/` no importa de `modules/`;
  - los repositorios aceptan `tx?: unknown` al final;
  - solo `container.ts` arma dependencias (más el catálogo de tipos `src/eventos.ts`, que solo tiene tipos);
  - los services lanzan errores de `core/errors.ts`;
  - toda escritura que publica un anuncio va dentro de `unitOfWork.runInTransaction`, pasando `tx` a **cada** llamada al repositorio **y** a `anuncios.publicar(…, tx)`.
- **Los avisos se guardan dentro de la transacción de la operación.** Las señales en tiempo real salen **después de confirmar** y **nunca llevan datos personales**: solo `{ noLeidas }` o `{ motivo }`.
- **Valores fijos:**
  - conexión: latido **25 s**, revalidación de la sesión **cada 5 min**, aperturas **10 por minuto por sesión** (después, 429);
  - reconexión: esperas de **1, 2, 4, 8, 16 y 30 s** (tope) más un azar de hasta 1 s;
  - campana: hasta **10** avisos, número "**9+**" desde 10;
  - historial: **30 días**, de a **50**; limpieza a los **30 días** desde la última actualización (salvo los de estado abiertos);
  - criterios: evaluación próxima entre hoy y hoy **+ 7 días**; asistencia pendiente en los **últimos 7 días** (hoy incluido, solo meses lectivos) con revisión **cada 15 min**; cuota por vencer con **5 días o menos**.
- **Textos de los motivos de cierre en el login (exactos):**
  - `cerrada-por-el-usuario` → "Cerraste la sesión en otra pestaña.";
  - `cerrada-desde-otro-dispositivo` → "Tu sesión se cerró desde otro dispositivo.";
  - `contrasena-cambiada` → "Tu contraseña cambió: ingresá con la nueva.";
  - `cuenta-desactivada` → "Tu cuenta fue desactivada. Consultá con el instituto.";
  - `vencida` se muestra como el `sesion-vencida` de hoy.
- **Destinatarios:** solo cuentas `activo`. Staff = admin o secretario. Profesor = cuenta vinculada a un `Profesor`. Padre = cuenta vinculada a un `Padre`. Una cuenta multi-rol tiene avisos por rol. Todo acceso a avisos filtra por `usuarioId` **y** `rol` de la sesión.
- **Pruebas:**
  - No hay test runner. Las pruebas son scripts `tsx` en `server/scripts/_*.ts` (excluidos de git por `.git/info/exclude`; **nunca se commitean**), scripts de shell y Playwright en `$SCRATCH`, cuya salida (`etiqueta: real (esperado X)`) se pasa por `python3 $SCRATCH/chequear.py`.
  - Toda fila de prueba lleva el prefijo `prueba-tmp-av` y se borra al terminar. **No se toca ningún dato real.**
  - Sincronizar escribe avisos también para las cuentas reales de staff: es lo mismo que hace el servidor al arrancar. Por eso cada script que sincroniza termina con `limpiarMundo` y `sincronizarTodo`, para dejar las cuentas reales como las dejaría el servidor.
  - Reiniciar la API con `bash $SCRATCH/reiniciar-api.sh` después de cada cambio del server.
- Textos de UI en español rioplatense.

`$SCRATCH` es `/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad`. Todos los comandos de `server/` se corren desde `server/` con `source ~/.nvm/nvm.sh && nvm use >/dev/null` antes.

## Review Focus

1. **Cuenta con dos roles (admin + profesor):** tiene avisos separados por rol. Marcar leído como administradora no toca los de profesora, y la señal en tiempo real llega solo a las sesiones con ese rol (Task 5 y Task 7).
2. **Dos operaciones simultáneas que sincronizan el mismo tipo** (dos pagos a la vez desde dos pantallas): ni se duplican filas ni falla por la clave única (Task 5).
3. **Una operación que se deshace a mitad de camino** (lote de pago con una cuota ya pagada): no queda ningún aviso y no sale ninguna señal (Task 6).
4. **Dos pestañas del mismo navegador con cuentas distintas** (una con "Mantener sesión iniciada" y otra sin): cada una recibe solo lo suyo y una no puede cerrar la otra (Task 9).
5. **Un enlace de aviso con un id que ya no existe o es ajeno** (curso de otro profesor, hijo de otro padre, evaluación borrada): la pantalla abre el valor por defecto sin error (Task 11 y Task 12).

---

## Estructura de archivos

**Server — crear:**
- `src/core/alConfirmar.ts`: tareas que corren al confirmarse la transacción.
- `src/core/eventos.ts`: `TableroDeAnuncios`, `sinAnuncios`.
- `src/core/adapters/CanalEnMemoria.ts`: conexiones abiertas, señales y cortes.
- `src/core/tiempoReal.ts`: ruta SSE.
- `src/eventos.ts`: `EventosDelSistema` (solo tipos).
- `src/modules/<modulo>/<modulo>.eventos.ts` para cuotas, calificaciones, asistencia, observaciones, documentos, alumnos, cursos, ciclos y usuarios.
- `src/modules/documentos/documento.faltantes.ts`: criterio único de documentación.
- `src/modules/notificaciones/`:
  - `notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.reconciliar.ts`;
  - `notificacion.criterios.ts`, `notificacion.criterios.prisma.ts`;
  - `notificacion.repository.ts`, `notificacion.repository.prisma.ts`;
  - `notificacion.schema.ts`, `notificacion.suscripciones.ts`, `notificacion.scheduler.ts`.
- Migración `prisma/migrations/20261015120000_avisos_guardados/migration.sql`.

**Server — modificar:**
- `prisma/schema.prisma`, `src/core/ports.ts`, `src/core/adapters/PrismaUnitOfWork.ts`, `src/core/tareaDiaria.ts`, `src/core/middlewares/authMiddleware.ts`, `src/core/middlewares/limitesDePedidos.ts`, `src/container.ts`, `src/server.ts`;
- `notificaciones/notificacion.{service,controller,routes}.ts`;
- `documentos/documento.{repository,repository.prisma,service,controller,routes}.ts`;
- `reportes/reporte.service.ts`;
- los services de cuotas, calificaciones, asistencia, observaciones, alumnos, cursos, ciclos, usuarios (`usuario.service.ts`, `invitacion.service.ts`), padres y profesores.

**Client — crear:**
- `src/core/hooks/useFiltrosDeUrl.ts`, `src/core/lib/token.ts`, `src/core/components/ui/interruptor.tsx`;
- `src/core/tiempoReal/{lectorSse.ts,conexion.ts,coordinador.ts,TiempoReal.tsx}`;
- `src/features/notificaciones/`:
  - `rutas.ts`, `pages/NotificacionesPage.tsx`;
  - `hooks/{useHistorialNotificaciones,useMarcarLeida,useLeerTodas,usePreferenciasNotificaciones,useCambiarPreferencia}.ts`;
- `src/features/cuenta/components/PreferenciasNotificaciones.tsx`;
- `src/features/documentos/hooks/useDocumentosFaltantes.ts`.

**Client — modificar:**
- `src/core/lib/apiClient.ts`, `src/core/components/layout/{AppLayout.tsx,NotificationBell.tsx,pageTitles.ts}`, `src/core/routes/AppRoutes.tsx`;
- `src/features/notificaciones/{types.ts,notificacionService.ts,hooks/useNotificaciones.ts}`;
- `src/features/auth/pages/LoginPage.tsx`, `src/features/cuenta/pages/MiCuentaPage.tsx`, `src/features/usuarios/pages/UsuariosPage.tsx`;
- `src/features/documentos/{types.ts,documentoService.ts}`;
- las páginas `AlumnosListPage`, `CuotasPage`, `AsistenciaProfesorPage`, `CalificacionesProfesorPage` y `ParentDashboardPage`.

**Docs:** `CLAUDE.md`, el spec (las dos precisiones), memoria `proyecto_babylon_pendientes_futuros.md`.

---

### Task 0: Herramientas de prueba (en `$SCRATCH`, no se commitean)

El scratchpad se borra entre sesiones: esta tarea vuelve a crear las herramientas que usan todas las pruebas.

**Files:**
- Create: `$SCRATCH/chequear.py`, `$SCRATCH/lib.sh`, `$SCRATCH/reiniciar-api.sh`, `$SCRATCH/iniciar-client.sh`, `$SCRATCH/e2e.sh`

- [ ] **Step 1: Crear `chequear.py`**

```python
#!/usr/bin/env python3
# Lee la salida de una prueba por stdin. Cada línea "etiqueta: real (esperado X)" se compara: si difieren es una falla.
# Una línea con un error de JavaScript (Error, TypeError, …) también cuenta como falla. Sale con 1 si hubo fallas.
import re, sys

patron = re.compile(r"^(.*?): (.*) \(esperado (.*)\)$")
error = re.compile(r"\b(Error|TypeError|ReferenceError|SyntaxError|PrismaClient\w*Error)\b|UnhandledPromiseRejection")
bien = mal = 0
for linea in sys.stdin:
    linea = linea.rstrip("\n")
    m = patron.match(linea)
    if m:
        if m.group(2) == m.group(3):
            bien += 1
        else:
            mal += 1
            print("FALLA ", linea)
    elif error.search(linea):
        mal += 1
        print("ERROR ", linea)
print(f"{bien} bien, {mal} mal")
sys.exit(1 if mal else 0)
```

- [ ] **Step 2: Crear `lib.sh`**

```bash
# Funciones para las pruebas de la API. Uso: source $SCRATCH/lib.sh
API=http://localhost:4000
q() { docker exec babylon-postgres psql -U babylon -d babylon -tAc "$1"; }
# login EMAIL CONTRASEÑA [ROL] → token
login() { curl -s -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"${3:+,\"rolElegido\":\"$3\"}}" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).token??''))"; }
# code MÉTODO RUTA [TOKEN] [JSON] → código HTTP
code() { curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API$2" ${3:+-H "Authorization: Bearer $3"} -H 'Content-Type: application/json' ${4:+-d "$4"}; }
# http MÉTODO RUTA [TOKEN] [JSON] → cuerpo
http() { curl -s -X "$1" "$API$2" ${3:+-H "Authorization: Bearer $3"} -H 'Content-Type: application/json' ${4:+-d "$4"}; }
# js 'EXPRESIÓN' → evalúa sobre el JSON de stdin (variable d)
js() { node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const d=JSON.parse(s||'null');console.log($1)})"; }
ok() { echo "$1: $2 (esperado $3)"; }
```

- [ ] **Step 3: Crear `reiniciar-api.sh` e `iniciar-client.sh`**

Los dos matan por el puerto, **nunca con `pkill -f`**, que se mata a sí mismo. La API se levanta sin `watch`, así el proceso que escucha el puerto es el único que hay que matar.

```bash
#!/usr/bin/env bash
# reiniciar-api.sh — reinicia la API en el puerto 4000 y espera /health. También reinicia los límites en memoria.
S=/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" || exit 1
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
for pid in $(lsof -ti tcp:4000 -sTCP:LISTEN); do kill "$pid"; done
for i in $(seq 1 20); do lsof -ti tcp:4000 -sTCP:LISTEN >/dev/null || break; sleep 0.25; done
nohup pnpm exec tsx src/server.ts > "$S/server.log" 2>&1 &
for i in $(seq 1 60); do curl -sf http://localhost:4000/health >/dev/null && { echo "API lista"; exit 0; }; sleep 0.5; done
echo "La API no arrancó:"; tail -30 "$S/server.log"; exit 1
```

```bash
#!/usr/bin/env bash
# iniciar-client.sh — levanta Vite en el 5173 si no está corriendo.
S=/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad
lsof -ti tcp:5173 -sTCP:LISTEN >/dev/null && { echo "client ya corriendo"; exit 0; }
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/client" || exit 1
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
nohup pnpm exec vite --port 5173 --strictPort > "$S/client.log" 2>&1 &
for i in $(seq 1 60); do curl -sf http://localhost:5173 >/dev/null && { echo "client listo"; exit 0; }; sleep 0.5; done
echo "El client no arrancó:"; tail -30 "$S/client.log"; exit 1
```

- [ ] **Step 4: Crear `e2e.sh`**

```bash
#!/usr/bin/env bash
# e2e.sh ARCHIVO.js — corre un recorrido de Playwright (los scripts usan chromium con /usr/bin/google-chrome).
source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
NODE_PATH=/home/agustin/.npm/_npx/e41f203b7505f1fb/node_modules node "$1"
```

Todos los recorridos empiezan así:

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
// const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
```

- [ ] **Step 5: Probar las herramientas**

```bash
chmod +x $SCRATCH/*.sh
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/iniciar-client.sh
source $SCRATCH/lib.sh; ok "salud" "$(code GET /health)" 200 | python3 $SCRATCH/chequear.py
```
Expected: `API lista`, `client listo` (o `client ya corriendo`), `1 bien, 0 mal`.

Después de cada recorrido de Playwright, comprobar que no quedaron procesos colgados además de la API y Vite: `lsof -ti tcp:4000,5173 -sTCP:LISTEN` debe mostrar solo dos PID.

---

### Task 1: Tablero de anuncios y "al confirmar"

**Files:**
- Create: `server/src/core/alConfirmar.ts`, `server/src/core/eventos.ts`
- Modify: `server/src/core/ports.ts`, `server/src/core/adapters/PrismaUnitOfWork.ts`, `docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md`
- Test: `server/scripts/_tablero.ts`

**Interfaces:**
- Produces:
  - `interface Publicador<M> { publicar<K extends keyof M & string>(nombre: K, datos: M[K], tx?: unknown): Promise<void> }` (en `core/ports.ts`);
  - `class TableroDeAnuncios<M> implements Publicador<M>`, con `alPublicarse(nombre, (datos, tx) => Promise<void>)` y `alConfirmarse(nombre, (datos) => void | Promise<void>)`;
  - `sinAnuncios<M>(): Publicador<M>`;
  - `alConfirmar(tx: unknown, tarea: () => void | Promise<void>): void` y `abrirRegistro(tx: object): Tarea[]` (en `core/alConfirmar.ts`).

- [ ] **Step 1: Escribir la prueba que falla**

`server/scripts/_tablero.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import { ok } from "./_check";

interface Eventos {
  "prueba.hecha": { id: string };
}
const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const P = "prueba-tmp-av-tab";
const esperar = () => new Promise((r) => setTimeout(r, 80));
const crearUsuario = (tx: unknown, id: string) =>
  ((tx as PrismaClient | undefined) ?? prisma).usuario.create({
    data: { id, nombre: "Prueba", email: `${id}@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() },
  });
const existe = async (id: string) => ((await prisma.usuario.count({ where: { id } })) === 1 ? "sí" : "no");
const corrio = (lista: string[], id: string) => (lista.includes(id) ? "sí" : "no");

(async () => {
  await prisma.usuario.deleteMany({ where: { id: { startsWith: P } } });
  const tablero = new TableroDeAnuncios<Eventos>();
  const despues: string[] = [];
  let fallarDentro = false;
  tablero.alPublicarse("prueba.hecha", async ({ id }, tx) => {
    await crearUsuario(tx, `${id}-dentro`);
    if (fallarDentro) throw new Error("falla adentro (simulada)");
  });
  tablero.alConfirmarse("prueba.hecha", ({ id }) => {
    despues.push(id);
  });

  // 1) Todo bien: lo de adentro se guarda con la operación y lo de después corre recién al confirmar
  let antes = "";
  await uow.runInTransaction(async (tx) => {
    await crearUsuario(tx, `${P}-1`);
    await tablero.publicar("prueba.hecha", { id: `${P}-1` }, tx);
    await esperar();
    antes = corrio(despues, `${P}-1`);
  });
  await esperar();
  ok("1: 'después' antes de confirmar", antes, "no");
  ok("1: 'después' al confirmar", corrio(despues, `${P}-1`), "sí");
  ok("1: se guardó lo de adentro", await existe(`${P}-1-dentro`), "sí");

  // 2) Falla adentro: se deshace la operación entera y 'después' no corre
  fallarDentro = true;
  const r2 = await uow
    .runInTransaction(async (tx) => {
      await crearUsuario(tx, `${P}-2`);
      await tablero.publicar("prueba.hecha", { id: `${P}-2` }, tx);
    })
    .then(() => "ok", (e: Error) => e.message);
  fallarDentro = false;
  await esperar();
  ok("2: la operación falla", r2, "falla adentro (simulada)");
  ok("2: la fila de la operación no quedó", await existe(`${P}-2`), "no");
  ok("2: 'después' no corrió", corrio(despues, `${P}-2`), "no");

  // 3) La operación falla después de publicar: lo de adentro se deshace y 'después' se descarta
  const r3 = await uow
    .runInTransaction(async (tx) => {
      await tablero.publicar("prueba.hecha", { id: `${P}-3` }, tx);
      throw new Error("falla posterior");
    })
    .then(() => "ok", (e: Error) => e.message);
  await esperar();
  ok("3: la operación falla", r3, "falla posterior");
  ok("3: lo de adentro se deshizo", await existe(`${P}-3-dentro`), "no");
  ok("3: 'después' no corrió", corrio(despues, `${P}-3`), "no");

  // 4) Sin transacción todo corre en el momento
  await tablero.publicar("prueba.hecha", { id: `${P}-4` });
  await esperar();
  ok("4: adentro corrió sin transacción", await existe(`${P}-4-dentro`), "sí");
  ok("4: 'después' corrió sin transacción", corrio(despues, `${P}-4`), "sí");

  // 5) Un 'después' que falla no afecta a la operación ni a los demás
  const original = console.error;
  const errores: string[] = [];
  console.error = (...a: unknown[]) => void errores.push(a.map(String).join(" "));
  tablero.alConfirmarse("prueba.hecha", () => {
    throw new Error("señal caída (simulada)");
  });
  const r5 = await uow.runInTransaction(async (tx) => {
    await tablero.publicar("prueba.hecha", { id: `${P}-5` }, tx);
    return "listo";
  });
  await esperar();
  console.error = original;
  ok("5: la operación termina bien", r5, "listo");
  ok("5: el otro 'después' corrió", corrio(despues, `${P}-5`), "sí");
  ok("5: la falla quedó en el log", errores.some((e) => e.includes("[alConfirmar]")) ? "sí" : "no", "sí");

  await prisma.usuario.deleteMany({ where: { id: { startsWith: P } } });
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `cd server && pnpm exec tsx scripts/_tablero.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL. No existe el módulo `../src/core/eventos` (error de import → `ERROR`).

- [ ] **Step 3: Agregar `Publicador` a `core/ports.ts`**

Al final de `server/src/core/ports.ts`:

```ts
// Anuncios entre módulos (ver core/eventos.ts). `M` es el mapa nombre → datos de los anuncios que publica un módulo.
// `tx` es la transacción en curso: lo que se suscribe "dentro" corre en ella; sin `tx`, todo corre en el momento.
export interface Publicador<M> {
  publicar<K extends keyof M & string>(nombre: K, datos: M[K], tx?: unknown): Promise<void>;
}
```

- [ ] **Step 4: Crear `core/alConfirmar.ts`**

```ts
// Tareas que tienen que correr recién cuando una transacción se confirma (por ejemplo, mandar una señal en tiempo
// real). PrismaUnitOfWork abre un registro por transacción y, al confirmarse, corre lo pendiente; si se deshace, lo
// descarta. Sin transacción (`tx` undefined o una que no se registró), la tarea corre en el momento.
export type Tarea = () => void | Promise<void>;

const pendientes = new WeakMap<object, Tarea[]>();

export function abrirRegistro(tx: object): Tarea[] {
  const lista: Tarea[] = [];
  pendientes.set(tx, lista);
  return lista;
}

export function alConfirmar(tx: unknown, tarea: Tarea): void {
  const lista = typeof tx === "object" && tx !== null ? pendientes.get(tx) : undefined;
  if (lista) lista.push(tarea);
  else correrSinFallar(tarea);
}

// Nunca afecta a quien la programó: un error solo queda en el log.
export function correrSinFallar(tarea: Tarea): void {
  Promise.resolve()
    .then(tarea)
    .catch((error) => console.error("[alConfirmar] falló una tarea:", error));
}
```

- [ ] **Step 5: Registrar la transacción en `PrismaUnitOfWork`**

Reemplazar el contenido de `server/src/core/adapters/PrismaUnitOfWork.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { abrirRegistro, correrSinFallar, type Tarea } from "../alConfirmar";
import type { UnitOfWork } from "../ports";

export type PrismaTransactionClient = Prisma.TransactionClient;

export class PrismaUnitOfWork implements UnitOfWork<PrismaTransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  // Lo que se programó con alConfirmar(tx, …) corre solo si la transacción se confirma.
  async runInTransaction<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    let alConfirmarse: Tarea[] = [];
    const resultado = await this.prisma.$transaction((tx: PrismaTransactionClient) => {
      alConfirmarse = abrirRegistro(tx);
      return work(tx);
    });
    for (const tarea of alConfirmarse) correrSinFallar(tarea);
    return resultado;
  }
}
```

- [ ] **Step 6: Crear `core/eventos.ts`**

```ts
import { alConfirmar } from "./alConfirmar";
import type { Publicador } from "./ports";

type Dentro<D> = (datos: D, tx: unknown) => Promise<void>;
type Despues<D> = (datos: D) => void | Promise<void>;

// Tablero de anuncios: los módulos publican lo que pasó y otros se suscriben, sin conocerse entre sí (container.ts
// conecta las suscripciones). Hay dos momentos:
// - dentro de la transacción (`alPublicarse`): corre en el acto, con el mismo `tx`; si falla, la operación entera se
//   deshace. Para lo que tiene que guardarse junto con la operación (los avisos).
// - después de confirmar (`alConfirmarse`): corre solo si la transacción se confirma; si falla, queda en el log.
export class TableroDeAnuncios<M> implements Publicador<M> {
  private readonly dentro = new Map<string, Dentro<never>[]>();
  private readonly despues = new Map<string, Despues<never>[]>();

  alPublicarse<K extends keyof M & string>(nombre: K, suscriptor: Dentro<M[K]>): void {
    this.dentro.set(nombre, [...(this.dentro.get(nombre) ?? []), suscriptor as Dentro<never>]);
  }

  alConfirmarse<K extends keyof M & string>(nombre: K, suscriptor: Despues<M[K]>): void {
    this.despues.set(nombre, [...(this.despues.get(nombre) ?? []), suscriptor as Despues<never>]);
  }

  async publicar<K extends keyof M & string>(nombre: K, datos: M[K], tx?: unknown): Promise<void> {
    for (const suscriptor of this.dentro.get(nombre) ?? []) await (suscriptor as Dentro<M[K]>)(datos, tx);
    for (const suscriptor of this.despues.get(nombre) ?? []) alConfirmar(tx, () => (suscriptor as Despues<M[K]>)(datos));
  }
}

// Para los services construidos sin tablero (scripts de prueba viejos): publicar no hace nada.
export function sinAnuncios<M>(): Publicador<M> {
  return { publicar: async () => {} };
}
```

- [ ] **Step 7: Correr la prueba y el typecheck**

Run: `cd server && pnpm exec tsx scripts/_tablero.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm typecheck`
Expected: `15 bien, 0 mal` y typecheck sin errores.

- [ ] **Step 8: Anotar las dos precisiones en el spec**

En `docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md`:
- **En "Avisos" → "Criterio en un solo lugar por tipo":** reemplazar el texto sobre el alcance por: "Cada tipo de estado tiene una función de **sincronización** que calcula qué avisos tienen que estar abiertos en todo el instituto y abre, actualiza o resuelve las filas. Se sincroniza siempre el tipo completo (con el volumen del instituto son pocas consultas), bloqueando el tipo dentro de la transacción (`pg_advisory_xact_lock`) para que dos operaciones simultáneas no choquen. Los anuncios solo piden sincronizar los tipos afectados."
- **En "Cierre de sesión remoto":** reemplazar la viñeta de `cerrarTodas` por: "El anuncio 'sesiones cerradas' lleva la cuenta y el motivo. El canal vuelve a validar las conexiones abiertas de esa cuenta con el validador de `authMiddleware` y corta las que ya no valen (`cerrarTodas` no cambia)."

- [ ] **Step 9: Commit**

```bash
git add server/src/core/alConfirmar.ts server/src/core/eventos.ts server/src/core/ports.ts server/src/core/adapters/PrismaUnitOfWork.ts docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md
git commit -m "Tablero de anuncios entre módulos y tareas al confirmar la transacción

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Datos de los avisos y sus reglas de vida

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20261015120000_avisos_guardados/migration.sql`
- Create: `server/src/modules/notificaciones/notificacion.entity.ts`, `notificacion.tipos.ts`, `notificacion.reconciliar.ts`
- Test: `server/scripts/_reconciliar.ts`

**Interfaces:**
- Produces (`notificacion.entity.ts`):
  - `TipoNotificacion`, `TipoEstado`, `TipoEvento`, `ClaseNotificacion`, `TonoNotificacion`, `RecursoAviso`;
  - `Notificacion { id; usuarioId; rol: Rol; tipo; clase; clave; tono; texto; recurso: RecursoAviso; nivel: number; creadaEn: Date; actualizadaEn: Date; leidaEn: Date | null; resueltaEn: Date | null }`;
  - `AvisoEsperado { usuarioId; rol; tipo; clave; tono; texto; recurso; nivel }`;
  - `Destinatario { usuarioId: string; rol: Rol }`.
- Produces (`notificacion.tipos.ts`): `TIPOS: Record<TipoNotificacion, { grupo: "staff" | "profesor" | "padre"; clase; etiqueta: string }>`, `TIPOS_ESTADO: TipoEstado[]`, `tiposDelRol(rol: Rol): TipoNotificacion[]`.
- Produces (`notificacion.reconciliar.ts`): `reconciliar(existentes: Notificacion[], esperados: AvisoEsperado[], ahora: Date, nuevoId: () => string): { crear: Notificacion[]; actualizar: { id: string; datos: Partial<Notificacion> }[]; afectados: Destinatario[] }`.

- [ ] **Step 1: Escribir la prueba que falla**

`server/scripts/_reconciliar.ts` (reglas puras, sin base de datos):

```ts
import type { AvisoEsperado, Notificacion } from "../src/modules/notificaciones/notificacion.entity";
import { reconciliar, type CambiosDeAvisos } from "../src/modules/notificaciones/notificacion.reconciliar";
import { ok } from "./_check";

const AHORA = new Date("2026-10-15T15:00:00Z");
const ANTES = new Date("2026-10-10T15:00:00Z");
let n = 0;
const id = () => `nuevo${++n}`;
const esperado = (clave: string, extra: Partial<AvisoEsperado> = {}): AvisoEsperado => ({
  usuarioId: "u1",
  rol: "padre",
  tipo: "cuota",
  clave,
  tono: "warning",
  texto: `texto ${clave}`,
  recurso: { tipo: "cuota", alumnoId: "a1", cuotaId: clave },
  nivel: 1,
  ...extra,
});
const fila = (clave: string, extra: Partial<Notificacion> = {}): Notificacion => ({
  ...esperado(clave),
  id: `f-${clave}`,
  clase: "estado",
  creadaEn: ANTES,
  actualizadaEn: ANTES,
  leidaEn: ANTES,
  resueltaEn: null,
  ...extra,
});
const r = (existentes: Notificacion[], esperados: AvisoEsperado[]) => reconciliar(existentes, esperados, AHORA, id);
const cambio = (res: CambiosDeAvisos, idFila: string) => res.actualizar.find((a) => a.id === idFila)?.datos ?? {};
const tocaLeida = (datos: Partial<Notificacion>) => ("leidaEn" in datos ? "toca leidaEn" : "no toca");

let x = r([], [esperado("c1")]);
ok("1: crea el aviso nuevo", x.crear.length, 1);
ok("1: nace sin leer", x.crear[0].leidaEn, null);
ok("1: es de estado", x.crear[0].clase, "estado");
ok("1: un afectado", x.afectados.length, 1);

// El recurso guardado vuelve de la base con otro orden de claves (jsonb): no cuenta como cambio.
x = r([fila("c1", { recurso: { cuotaId: "c1", alumnoId: "a1", tipo: "cuota" } })], [esperado("c1")]);
ok("2: igual no crea", x.crear.length, 0);
ok("2: igual no actualiza", x.actualizar.length, 0);
ok("2: igual no afecta a nadie", x.afectados.length, 0);

x = r([fila("c1")], [esperado("c1", { texto: "otro" })]);
ok("3: actualiza el texto", cambio(x, "f-c1").texto, "otro");
ok("3: sigue leído", tocaLeida(cambio(x, "f-c1")), "no toca");
ok("3: cambia la fecha", cambio(x, "f-c1").actualizadaEn?.toISOString(), AHORA.toISOString());

x = r([fila("c1")], [esperado("c1", { nivel: 2, tono: "danger" })]);
ok("4: el nivel sube y vuelve a no leído", cambio(x, "f-c1").leidaEn, null);
ok("4: cambia el tono", cambio(x, "f-c1").tono, "danger");

x = r([fila("c1", { nivel: 5 })], [esperado("c1", { nivel: 3 })]);
ok("5: el nivel baja y sigue leído", tocaLeida(cambio(x, "f-c1")), "no toca");
ok("5: guarda el nivel nuevo", cambio(x, "f-c1").nivel, 3);

x = r([fila("c1", { resueltaEn: ANTES })], [esperado("c1")]);
ok("6: reabre", cambio(x, "f-c1").resueltaEn, null);
ok("6: reabierto queda sin leer", cambio(x, "f-c1").leidaEn, null);
ok("6: no crea otra fila", x.crear.length, 0);

x = r([fila("c1")], []);
ok("7: resuelve lo que ya no se espera", cambio(x, "f-c1").resueltaEn?.toISOString(), AHORA.toISOString());
ok("7: afecta a su cuenta", x.afectados.length, 1);

x = r([fila("c1", { resueltaEn: ANTES })], []);
ok("8: lo ya resuelto no se toca", x.actualizar.length, 0);

x = r([fila("c1")], [esperado("c1"), esperado("c1", { usuarioId: "u2" }), esperado("c1", { rol: "admin" })]);
ok("9: misma clave en otra cuenta u otro rol es otro aviso", x.crear.length, 2);

x = r([fila("c1"), fila("c2")], [esperado("c3")]);
ok("10: un afectado por cuenta y rol", x.afectados.length, 1);
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `cd server && pnpm exec tsx scripts/_reconciliar.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no existe `notificacion.reconciliar`).

- [ ] **Step 3: Agregar los modelos al schema**

En `server/prisma/schema.prisma`, dentro de `model Usuario`, debajo de `sesiones Sesion[]`:

```prisma
  notificaciones             Notificacion[]
  notificacionesDesactivadas NotificacionDesactivada[]
```

Y al final del archivo:

```prisma
enum TipoNotificacion {
  cuotas_vencidas
  documentacion_pendiente
  evaluacion_proxima
  asistencia_pendiente
  notas_sin_publicar
  cierre_sin_publicar
  cuota
  documentacion_hijo
  nota_publicada
  cierre_publicado
  observacion_nueva
}

enum ClaseNotificacion {
  estado
  evento
}

enum TonoNotificacion {
  danger
  warning
  info
}

// Aviso de la campana, guardado para una cuenta en uno de sus roles. Los de "estado" quedan abiertos mientras la
// situación siga (resueltaEn nulo); los de "evento" ocurren una vez. `clave` identifica de qué trata (una cuota, una
// evaluación, "cuotas vencidas"…): hay a lo sumo una fila por cuenta, rol y clave. `recurso` dice a qué lleva (la
// pantalla la arma el client según el rol). `nivel` sube cuando el aviso se agrava y lo vuelve a marcar no leído.
model Notificacion {
  id            String            @id
  usuarioId     String
  rol           Rol
  tipo          TipoNotificacion
  clase         ClaseNotificacion
  clave         String
  tono          TonoNotificacion
  texto         String
  recurso       Json
  nivel         Int               @default(0)
  creadaEn      DateTime
  actualizadaEn DateTime
  leidaEn       DateTime?
  resueltaEn    DateTime?

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@unique([usuarioId, rol, clave])
  @@index([usuarioId, rol, resueltaEn, leidaEn])
  @@index([tipo])
  @@index([actualizadaEn])
}

// Tipos de aviso que una cuenta apagó para uno de sus roles: que exista la fila quiere decir "apagado".
model NotificacionDesactivada {
  usuarioId String
  rol       Rol
  tipo      TipoNotificacion

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@id([usuarioId, rol, tipo])
}
```

- [ ] **Step 4: Generar la migración sin tocar los datos**

La migración se genera **comparando la base real con el schema**: así no hay riesgo de que Prisma proponga reiniciar la base.

```bash
cd server
mkdir -p prisma/migrations/20261015120000_avisos_guardados
pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261015120000_avisos_guardados/migration.sql
cat prisma/migrations/20261015120000_avisos_guardados/migration.sql
```
Expected: solo `CREATE TYPE` ×3, `CREATE TABLE "Notificacion"` y `"NotificacionDesactivada"`, sus índices y las dos `FOREIGN KEY ... ON DELETE CASCADE`. **Si aparece cualquier otra cosa (un `ALTER` o un `DROP` sobre tablas existentes), parar y avisar: la base tiene diferencias con el historial de migraciones y no hay que tocarla.**

```bash
pnpm exec prisma migrate deploy && pnpm prisma:generate && pnpm exec prisma migrate status
```
Expected: `Database schema is up to date!`

- [ ] **Step 5: Crear `notificacion.entity.ts`**

```ts
import type { Rol } from "../../core/ports";

export type TipoEstado =
  | "cuotas_vencidas"
  | "documentacion_pendiente"
  | "evaluacion_proxima"
  | "asistencia_pendiente"
  | "notas_sin_publicar"
  | "cierre_sin_publicar"
  | "cuota"
  | "documentacion_hijo";
export type TipoEvento = "nota_publicada" | "cierre_publicado" | "observacion_nueva";
export type TipoNotificacion = TipoEstado | TipoEvento;
export type ClaseNotificacion = "estado" | "evento";
export type TonoNotificacion = "danger" | "warning" | "info";

// A qué lleva el aviso. La dirección no se guarda: la arma el client según el rol (features/notificaciones/rutas.ts).
export type RecursoAviso =
  | { tipo: "cuotas-vencidas" }
  | { tipo: "documentacion-pendiente" }
  | { tipo: "evaluacion"; cursoId: string; evaluacionId: string }
  | { tipo: "asistencia"; cursoId: string; fecha: string }
  | { tipo: "cierre"; cursoId: string; periodo: string }
  | { tipo: "cuota"; alumnoId: string; cuotaId: string }
  | { tipo: "documentacion"; alumnoId: string }
  | { tipo: "calificaciones"; alumnoId: string }
  | { tipo: "hijo"; alumnoId: string };

export interface Destinatario {
  usuarioId: string;
  rol: Rol;
}

// Lo que un criterio dice que tiene que existir para una cuenta y rol.
export interface AvisoEsperado extends Destinatario {
  tipo: TipoNotificacion;
  clave: string;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  nivel: number;
}

export interface Notificacion extends AvisoEsperado {
  id: string;
  clase: ClaseNotificacion;
  creadaEn: Date;
  actualizadaEn: Date;
  leidaEn: Date | null;
  resueltaEn: Date | null;
}
```

- [ ] **Step 6: Crear `notificacion.tipos.ts`**

```ts
import type { Rol } from "../../core/ports";
import type { ClaseNotificacion, TipoEstado, TipoNotificacion } from "./notificacion.entity";

type Grupo = "staff" | "profesor" | "padre";

// Catálogo de tipos de aviso: a qué rol le llegan, si son de estado o de evento y cómo se llaman en las preferencias.
export const TIPOS: Record<TipoNotificacion, { grupo: Grupo; clase: ClaseNotificacion; etiqueta: string }> = {
  cuotas_vencidas: { grupo: "staff", clase: "estado", etiqueta: "Cuotas vencidas" },
  documentacion_pendiente: { grupo: "staff", clase: "estado", etiqueta: "Documentación pendiente de los alumnos" },
  evaluacion_proxima: { grupo: "staff", clase: "estado", etiqueta: "Evaluaciones de la próxima semana" },
  asistencia_pendiente: { grupo: "profesor", clase: "estado", etiqueta: "Asistencia sin tomar" },
  notas_sin_publicar: { grupo: "profesor", clase: "estado", etiqueta: "Evaluaciones con notas sin publicar" },
  cierre_sin_publicar: { grupo: "profesor", clase: "estado", etiqueta: "Notas de cierre sin publicar" },
  cuota: { grupo: "padre", clase: "estado", etiqueta: "Cuotas por vencer y vencidas" },
  documentacion_hijo: { grupo: "padre", clase: "estado", etiqueta: "Documentación pendiente" },
  nota_publicada: { grupo: "padre", clase: "evento", etiqueta: "Notas nuevas" },
  cierre_publicado: { grupo: "padre", clase: "evento", etiqueta: "Notas de cierre publicadas" },
  observacion_nueva: { grupo: "padre", clase: "evento", etiqueta: "Observaciones nuevas" },
};

const todos = Object.keys(TIPOS) as TipoNotificacion[];

export const TIPOS_ESTADO = todos.filter((t) => TIPOS[t].clase === "estado") as TipoEstado[];

export function tiposDelRol(rol: Rol): TipoNotificacion[] {
  const grupo: Grupo = rol === "admin" || rol === "secretario" ? "staff" : rol;
  return todos.filter((t) => TIPOS[t].grupo === grupo);
}
```

- [ ] **Step 7: Crear `notificacion.reconciliar.ts`**

```ts
import type { AvisoEsperado, Destinatario, Notificacion, RecursoAviso } from "./notificacion.entity";

export interface CambiosDeAvisos {
  crear: Notificacion[];
  actualizar: { id: string; datos: Partial<Notificacion> }[];
  // Cuentas (con su rol) cuya campana cambió: reciben una señal en tiempo real.
  afectados: Destinatario[];
}

const llave = (x: { usuarioId: string; rol: string; clave: string }) => `${x.usuarioId}|${x.rol}|${x.clave}`;
// El recurso vuelve de la base (jsonb) con las claves en otro orden: se compara ordenado.
const canonico = (r: RecursoAviso) =>
  JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));

// Reglas de vida de los avisos de estado (puras: no leen ni escriben nada):
// - lo esperado que no existe se crea, sin leer;
// - lo que existe se actualiza solo si cambió algo; si estaba resuelto se reabre, y si el nivel sube (la cuota pasa a
//   vencida, el número del agrupado crece) vuelve a "no leído";
// - lo abierto que ya no se espera se resuelve.
export function reconciliar(
  existentes: Notificacion[],
  esperados: AvisoEsperado[],
  ahora: Date,
  nuevoId: () => string,
): CambiosDeAvisos {
  const crear: Notificacion[] = [];
  const actualizar: CambiosDeAvisos["actualizar"] = [];
  const afectados = new Map<string, Destinatario>();
  const afectar = ({ usuarioId, rol }: Destinatario) => afectados.set(`${usuarioId}|${rol}`, { usuarioId, rol });
  const porLlave = new Map(existentes.map((n) => [llave(n), n]));
  const esperadas = new Set(esperados.map(llave));

  for (const e of esperados) {
    const n = porLlave.get(llave(e));
    if (!n) {
      crear.push({ ...e, id: nuevoId(), clase: "estado", creadaEn: ahora, actualizadaEn: ahora, leidaEn: null, resueltaEn: null });
      afectar(e);
      continue;
    }
    const reabre = n.resueltaEn !== null;
    const cambio =
      reabre || n.texto !== e.texto || n.tono !== e.tono || n.nivel !== e.nivel || canonico(n.recurso) !== canonico(e.recurso);
    if (!cambio) continue;
    const datos: Partial<Notificacion> = { texto: e.texto, tono: e.tono, nivel: e.nivel, recurso: e.recurso, actualizadaEn: ahora };
    if (reabre || e.nivel > n.nivel) Object.assign(datos, { leidaEn: null, resueltaEn: null });
    actualizar.push({ id: n.id, datos });
    afectar(n);
  }
  for (const n of existentes) {
    if (n.resueltaEn === null && !esperadas.has(llave(n))) {
      actualizar.push({ id: n.id, datos: { resueltaEn: ahora, actualizadaEn: ahora } });
      afectar(n);
    }
  }
  return { crear, actualizar, afectados: [...afectados.values()] };
}
```

- [ ] **Step 8: Correr la prueba y el typecheck**

Run: `cd server && pnpm exec tsx scripts/_reconciliar.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm typecheck`
Expected: `22 bien, 0 mal`, typecheck limpio.

- [ ] **Step 9: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/20261015120000_avisos_guardados server/src/modules/notificaciones/notificacion.entity.ts server/src/modules/notificaciones/notificacion.tipos.ts server/src/modules/notificaciones/notificacion.reconciliar.ts
git commit -m "Avisos guardados: tablas, catálogo de tipos y reglas de vida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Criterio único de documentación pendiente

**Files:**
- Create: `server/src/modules/documentos/documento.faltantes.ts`
- Modify: `documentos/documento.repository.ts`, `documento.repository.prisma.ts`, `documento.service.ts`, `documento.controller.ts`, `documento.routes.ts`; `reportes/reporte.service.ts`; `server/src/container.ts`
- Test: `server/scripts/_mundo-avisos.ts` (mundo de prueba que usan todas las tareas siguientes), `server/scripts/_faltantes.ts`, `$SCRATCH/faltantes.sh`

**Interfaces:**
- Produces:
  - `documentosFaltantes(docs: Pick<Documento, "tipo" | "estado">[]): TipoDocumento[]`;
  - `interface AlumnoConFaltantes { alumnoId: string; nombre: string; padreId: string | null; faltan: TipoDocumento[] }`;
  - `DocumentoRepository.findFaltantes(tx?: unknown): Promise<AlumnoConFaltantes[]>`;
  - `DocumentoService.listarFaltantes(): Promise<Record<string, TipoDocumento[]>>`;
  - `GET /api/documentos/faltantes` (admin, secretario);
  - `new ReporteService(prisma, documentoRepository)`.
- Produces (pruebas): `crearMundo(prisma): Promise<Mundo>`, `limpiarMundo(prisma)`, `P = "prueba-tmp-av"`, `CLAVE = "prueba1234"`, `email(quien)`. También se puede correr como `tsx scripts/_mundo-avisos.ts crear|borrar`.

- [ ] **Step 1: Crear el mundo de prueba**

`server/scripts/_mundo-avisos.ts`:

```ts
import { PrismaClient, type Rol } from "@prisma/client";
import bcrypt from "bcrypt";

// Mundo de prueba de los avisos, en el ciclo activo y con prefijo prueba-tmp-av en todo. limpiarMundo lo borra entero
// (las cuentas arrastran en cascada sus sesiones, enlaces y avisos).
export const P = "prueba-tmp-av";
export const CLAVE = "prueba1234";
export const email = (quien: string) => `${P}-${quien}@prueba.babylon.test`;

export interface Mundo {
  cicloId: string;
  admin: string; // cuenta admin
  profe: string; // cuenta profesor
  profesorId: string;
  cursoId: string; // del profe: clases martes y jueves 14:00
  padre: string; // cuenta padre
  padreId: string;
  hijo1: string; // hijos del padre, en el curso del profe
  hijo2: string;
  multi: string; // cuenta admin + profesor
  profesorMultiId: string;
  cursoMultiId: string;
  ajeno: string; // cuenta de otro padre
  padreAjenoId: string;
  alumnoAjeno: string; // hijo del ajeno, en el curso de multi
}

export async function limpiarMundo(prisma: PrismaClient): Promise<void> {
  const deAlumnos = { alumnoId: { startsWith: P } };
  const deCursos = { cursoId: { startsWith: P } };
  await prisma.pago.deleteMany({ where: { cuota: deAlumnos } });
  await prisma.cuota.deleteMany({ where: deAlumnos });
  await prisma.asistencia.deleteMany({ where: { OR: [deCursos, deAlumnos] } });
  await prisma.calificacion.deleteMany({ where: { OR: [{ evaluacion: deCursos }, deAlumnos] } });
  await prisma.evaluacion.deleteMany({ where: deCursos });
  await prisma.notaCierre.deleteMany({ where: { OR: [deCursos, deAlumnos] } });
  await prisma.observacion.deleteMany({ where: deAlumnos });
  await prisma.documento.deleteMany({ where: deAlumnos });
  await prisma.inscripcion.deleteMany({ where: { OR: [deAlumnos, deCursos] } });
  await prisma.alumno.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.categoriaPersonalizada.deleteMany({ where: deCursos });
  await prisma.horario.deleteMany({ where: deCursos });
  await prisma.curso.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.padre.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profesor.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { startsWith: P } }, { email: { startsWith: P } }] } });
}

export async function crearMundo(prisma: PrismaClient): Promise<Mundo> {
  await limpiarMundo(prisma);
  const ciclo = await prisma.ciclo.findFirstOrThrow({ where: { activo: true } });
  const passwordHash = await bcrypt.hash(CLAVE, 10);
  const ahora = new Date();
  const cuenta = (quien: string, roles: Rol[]) =>
    prisma.usuario.create({
      data: { id: `${P}-${quien}`, nombre: `Pruebaav ${quien}`, email: email(quien), passwordHash, roles, estado: "activo", fechaCreacion: ahora },
    });
  await cuenta("admin", ["admin"]);
  await cuenta("profe", ["profesor"]);
  await cuenta("padre", ["padre"]);
  await cuenta("ajeno", ["padre"]);
  await cuenta("multi", ["admin", "profesor"]);
  await prisma.profesor.create({ data: { id: `${P}-profe`, nombre: "Pruebaav", apellido: "Profe", usuarioId: `${P}-profe` } });
  await prisma.profesor.create({ data: { id: `${P}-multi`, nombre: "Pruebaav", apellido: "Multi", usuarioId: `${P}-multi` } });
  const curso = (id: string, nombre: string, profesorId: string) =>
    prisma.curso.create({ data: { id, nombre, nivel: "kids", profesorId, cicloId: ciclo.id, cupo: 30, estado: "activo" } });
  await curso(`${P}-curso`, "Pruebaav Kids", `${P}-profe`);
  await curso(`${P}-curso-multi`, "Pruebaav Multi", `${P}-multi`);
  for (const diaSemana of ["martes", "jueves"] as const) {
    await prisma.horario.create({ data: { id: `${P}-h-${diaSemana}`, cursoId: `${P}-curso`, diaSemana, horaInicio: "14:00", horaFin: "15:00" } });
  }
  const padre = (id: string, dni: string, usuarioId: string) =>
    prisma.padre.create({ data: { id, nombre: "Pruebaav", apellido: id.slice(P.length + 1), dni, vinculo: "madre", usuarioId } });
  await padre(`${P}-padre`, "99400001", `${P}-padre`);
  await padre(`${P}-ajeno`, "99400002", `${P}-ajeno`);
  const alumno = async (id: string, nombre: string, dni: string, padreId: string, cursoId: string) => {
    await prisma.alumno.create({
      data: { id, nombre, apellido: "Pruebaav", dni, fechaNacimiento: new Date("2015-01-01T00:00:00Z"), fechaInscripcion: ahora, estado: "activo", padreId, cursoId, aplicaDescuentoHermanos: false },
    });
    await prisma.inscripcion.create({ data: { id: `${id}-insc`, alumnoId: id, cursoId, cicloId: ciclo.id, fecha: ahora, aplicaDescuentoHermanos: false } });
  };
  await alumno(`${P}-hijo1`, "Tomasav", "99400011", `${P}-padre`, `${P}-curso`);
  await alumno(`${P}-hijo2`, "Lunaav", "99400012", `${P}-padre`, `${P}-curso`);
  await alumno(`${P}-alumno-ajeno`, "Ajenoav", "99400013", `${P}-ajeno`, `${P}-curso-multi`);
  return {
    cicloId: ciclo.id,
    admin: `${P}-admin`,
    profe: `${P}-profe`,
    profesorId: `${P}-profe`,
    cursoId: `${P}-curso`,
    padre: `${P}-padre`,
    padreId: `${P}-padre`,
    hijo1: `${P}-hijo1`,
    hijo2: `${P}-hijo2`,
    multi: `${P}-multi`,
    profesorMultiId: `${P}-multi`,
    cursoMultiId: `${P}-curso-multi`,
    ajeno: `${P}-ajeno`,
    padreAjenoId: `${P}-ajeno`,
    alumnoAjeno: `${P}-alumno-ajeno`,
  };
}

// Desde la consola: tsx scripts/_mundo-avisos.ts crear|borrar (para las pruebas de la API y del navegador).
if (require.main === module) {
  const prisma = new PrismaClient();
  const accion = process.argv[2];
  (accion === "crear" ? crearMundo(prisma) : limpiarMundo(prisma))
    .then(() => console.log(`mundo de prueba: ${accion === "crear" ? "creado" : "borrado"}`))
    .finally(() => prisma.$disconnect());
}
```

Run: `cd server && pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts borrar`
Expected: `mundo de prueba: creado` y `mundo de prueba: borrado`, sin errores.

- [ ] **Step 2: Escribir las pruebas que fallan**

`server/scripts/_faltantes.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaDocumentoRepository(prisma);
const faltan = async (alumnoId: string) =>
  (await repo.findFaltantes()).find((f) => f.alumnoId === alumnoId)?.faltan.join(",") ?? "nada";

(async () => {
  const m = await crearMundo(prisma);
  ok("sin ningún documento le faltan los tres", await faltan(m.hijo1), "formulario_inscripcion,copia_dni,autorizacion_imagen");
  await prisma.documento.create({ data: { id: `${P}-d1`, alumnoId: m.hijo1, tipo: "formulario_inscripcion", estado: "cargado" } });
  await prisma.documento.create({ data: { id: `${P}-d2`, alumnoId: m.hijo1, tipo: "autorizacion_imagen", estado: "revocado" } });
  ok("formulario cargado, imagen revocada", await faltan(m.hijo1), "copia_dni,autorizacion_imagen");
  await prisma.documento.create({ data: { id: `${P}-d3`, alumnoId: m.hijo1, tipo: "copia_dni", estado: "pendiente" } });
  ok("una fila 'pendiente' sigue faltando", await faltan(m.hijo1), "copia_dni,autorizacion_imagen");
  await prisma.documento.update({ where: { id: `${P}-d3` }, data: { estado: "cargado" } });
  await prisma.documento.update({ where: { id: `${P}-d2` }, data: { estado: "autorizado" } });
  ok("con todo completo no aparece", await faltan(m.hijo1), "nada");
  const hijo2 = (await repo.findFaltantes()).find((f) => f.alumnoId === m.hijo2);
  ok("trae el padre", hijo2?.padreId, m.padreId);
  ok("trae el nombre", hijo2?.nombre, "Lunaav");
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "inactivo" } });
  ok("un alumno inactivo no debe documentación", await faltan(m.hijo2), "nada");
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "activo" } });
  const otroCiclo = await prisma.ciclo.findFirst({ where: { activo: false } });
  if (otroCiclo) {
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: otroCiclo.id } });
    ok("inscripto solo en otro ciclo no debe documentación", await faltan(m.hijo2), "nada");
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: m.cicloId } });
  }
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.alumno.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

`$SCRATCH/faltantes.sh`:

```bash
source $SCRATCH/lib.sh
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null
A=$(login prueba-tmp-av-admin@prueba.babylon.test prueba1234)
PA=$(login prueba-tmp-av-padre@prueba.babylon.test prueba1234)
ok "faltantes como admin" "$(code GET /api/documentos/faltantes $A)" 200
ok "faltantes como padre" "$(code GET /api/documentos/faltantes $PA)" 403
ok "faltantes sin sesión" "$(code GET /api/documentos/faltantes)" 401
ok "al hijo2 le falta todo" "$(http GET /api/documentos/faltantes $A | js 'd["prueba-tmp-av-hijo2"].join(",")')" "formulario_inscripcion,copia_dni,autorizacion_imagen"
ok "el panel cuenta lo mismo que la lista" "$(http GET /api/reportes/dashboard $A | js d.documentacionPendienteCount)" "$(http GET /api/documentos/faltantes $A | js 'Object.keys(d).length')"
pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null
```

- [ ] **Step 3: Ver que fallan**

Run: `cd server && pnpm exec tsx scripts/_faltantes.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (`repo.findFaltantes is not a function`).

- [ ] **Step 4: Crear `documento.faltantes.ts`**

```ts
import type { Documento, TipoDocumento } from "./documento.entity";

export const TIPOS_DOCUMENTO: TipoDocumento[] = ["formulario_inscripcion", "copia_dni", "autorizacion_imagen"];

// Alumno que debe documentación (activo e inscripto en el ciclo activo) con lo que le falta.
export interface AlumnoConFaltantes {
  alumnoId: string;
  nombre: string;
  padreId: string | null;
  faltan: TipoDocumento[];
}

// Criterio único de documentación pendiente (avisos, panel de la secretaria y filtro de Alumnos): la autorización de
// imagen tiene que estar "autorizado" y el formulario y la copia del DNI "cargado"; no tener la fila también es pendiente.
export function documentosFaltantes(documentos: Pick<Documento, "tipo" | "estado">[]): TipoDocumento[] {
  const estadoDe = (tipo: TipoDocumento) => documentos.find((d) => d.tipo === tipo)?.estado;
  return TIPOS_DOCUMENTO.filter((tipo) =>
    tipo === "autorizacion_imagen" ? estadoDe(tipo) !== "autorizado" : estadoDe(tipo) !== "cargado",
  );
}
```

- [ ] **Step 5: Agregar `findFaltantes` al repositorio**

En `documento.repository.ts`, importar `import type { AlumnoConFaltantes } from "./documento.faltantes";` y sumar al puerto:

```ts
  // Alumnos que deben documentación (activos e inscriptos en el ciclo activo), solo los que tienen algo pendiente.
  findFaltantes(tx?: unknown): Promise<AlumnoConFaltantes[]>;
```

En `documento.repository.prisma.ts`, importar `import { documentosFaltantes, type AlumnoConFaltantes } from "./documento.faltantes";` y agregar a la clase:

```ts
  async findFaltantes(tx?: unknown): Promise<AlumnoConFaltantes[]> {
    const alumnos = await this.client(tx).alumno.findMany({
      where: { estado: "activo", inscripciones: { some: { ciclo: { activo: true } } } },
      select: { id: true, nombre: true, padreId: true, documentos: { select: { tipo: true, estado: true } } },
    });
    return alumnos
      .map((a) => ({ alumnoId: a.id, nombre: a.nombre, padreId: a.padreId, faltan: documentosFaltantes(a.documentos) }))
      .filter((a) => a.faltan.length > 0);
  }
```

- [ ] **Step 6: Service, controller y ruta**

En `documento.service.ts`, importar `TipoDocumento` desde `./documento.entity` y agregar:

```ts
  // Admin/Secretario: qué le falta a cada alumno que debe documentación (solo los que tienen algo pendiente).
  async listarFaltantes(): Promise<Record<string, TipoDocumento[]>> {
    return Object.fromEntries((await this.documentoRepo.findFaltantes()).map((a) => [a.alumnoId, a.faltan]));
  }
```

En `documento.controller.ts`:

```ts
  listarFaltantes = async (_req: Request, res: Response) => {
    res.status(200).json(await this.documentoService.listarFaltantes());
  };
```

En `documento.routes.ts`, como primera ruta:

```ts
  router.get("/faltantes", authMiddleware, requireRole("admin", "secretario"), controller.listarFaltantes);
```

- [ ] **Step 7: El número del panel usa el mismo criterio**

En `reportes/reporte.service.ts`:
- Importar `import type { DocumentoRepository } from "../documentos/documento.repository";`.
- Cambiar el constructor a:
  ```ts
    constructor(
      private readonly prisma: PrismaClient,
      private readonly documentoRepo: DocumentoRepository,
    ) {}
  ```
- En `obtenerResumenDashboard`: quitar `documentosImagen` del final de la desestructuración de `Promise.all` y quitar la última consulta del arreglo (`this.prisma.documento.findMany({ where: { tipo: "autorizacion_imagen", … } })`).
- Reemplazar
  ```ts
      const alumnosConImagenAutorizada = new Set(
        documentosImagen.filter((d) => d.estado === "autorizado").map((d) => d.alumnoId),
      );
      const documentacionPendienteCount = alumnos.filter((a) => !alumnosConImagenAutorizada.has(a.id)).length;
  ```
  por
  ```ts
      // Mismo criterio que los avisos y el filtro de Alumnos (documentos/documento.faltantes.ts): alumnos activos del
      // ciclo activo a los que les falta cualquiera de los tres documentos.
      const documentacionPendienteCount = (await this.documentoRepo.findFaltantes()).length;
  ```

En `container.ts`: `const reporteService = new ReporteService(prisma, documentoRepository);`

- [ ] **Step 8: Correr las pruebas**

```bash
cd server && pnpm typecheck && pnpm exec tsx scripts/_faltantes.ts 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/faltantes.sh | python3 $SCRATCH/chequear.py
```
Expected: `9 bien, 0 mal` (8 si no existe un ciclo inactivo) y `5 bien, 0 mal`.

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/documentos server/src/modules/reportes/reporte.service.ts server/src/container.ts
git commit -m "Criterio único de documentación pendiente: endpoint de faltantes y número del panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Criterios de cada tipo de aviso

**Files:**
- Create: `server/src/modules/notificaciones/notificacion.criterios.ts`, `notificacion.criterios.prisma.ts`
- Test: `server/scripts/_criterios.ts`

**Interfaces:**
- Consumes: `AvisoEsperado`, `Destinatario`, `TipoEstado` (Task 2); `DocumentoRepository.findFaltantes` (Task 3); `esMesLectivo(mes: number): boolean` (`cuotas/cuota.calendario.ts`); `fechaHoraEnArgentina`, `inicioDeHoyUtc` (`core/fechas.ts`).
- Produces: `interface CriteriosDeAvisos` y `class PrismaCriteriosDeAvisos(prisma: PrismaClient, documentoRepo: DocumentoRepository)` con:
  - `esperados(tipo: TipoEstado, ahora: Date, tx?): Promise<AvisoEsperado[]>`;
  - `notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx?): Promise<AvisoEsperado[]>`;
  - `cierrePublicado(notaCierreId: string, tx?): Promise<AvisoEsperado[]>`;
  - `observacionNueva(observacionId: string, tx?): Promise<AvisoEsperado[]>`.
- Claves (las usan las pruebas de las tareas siguientes):
  - `cuotas-vencidas`, `documentacion-pendiente`;
  - `evaluacion-proxima:<evaluacionId>`, `asistencia:<cursoId>:<AAAA-MM-DD>`, `notas-sin-publicar:<evaluacionId>`, `cierre-sin-publicar:<cursoId>:<periodo>`;
  - `cuota:<cuotaId>`, `documentacion:<alumnoId>`;
  - `nota:<evaluacionId>:<alumnoId>`, `cierre:<notaCierreId>:<publicadaEn en ms>`, `observacion:<observacionId>`.

- [ ] **Step 1: Escribir la prueba que falla**

`server/scripts/_criterios.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import type { AvisoEsperado, TipoEstado } from "../src/modules/notificaciones/notificacion.entity";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const documentoRepo = new PrismaDocumentoRepository(prisma);
const criterios = new PrismaCriteriosDeAvisos(prisma, documentoRepo);
const JUEVES_15 = new Date("2026-10-15T18:00:00Z"); // jueves 15/10, 15:00 en Argentina
const JUEVES_15_TEMPRANO = new Date("2026-10-15T16:00:00Z"); // 13:00: la clase de las 14 todavía no empezó
const JUEVES_22 = new Date("2026-10-22T18:00:00Z");
const JUEVES_3_DIC = new Date("2026-12-03T18:00:00Z");
const fecha = (dia: string) => new Date(`${dia}T00:00:00Z`);
const de = (lista: AvisoEsperado[], usuarioId: string, rol?: string) =>
  lista.filter((a) => a.usuarioId === usuarioId && (!rol || a.rol === rol));
const claves = (lista: AvisoEsperado[]) => lista.map((a) => a.clave).sort().join(" ");
const esperados = (tipo: TipoEstado, ahora = JUEVES_15) => criterios.esperados(tipo, ahora);

(async () => {
  const m = await crearMundo(prisma);
  const cuota = (id: string, alumnoId: string, mes: number, vence: string, estado: "pendiente" | "vencida") =>
    prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId, mes, anio: 2026, montoBase: 10000, descuento: 0, montoFinal: 10000, vencimiento: fecha(vence), estado } });
  await cuota("c-oct-h1", m.hijo1, 10, "2026-10-18", "pendiente");
  await cuota("c-sep-h2", m.hijo2, 9, "2026-09-10", "vencida");
  await cuota("c-nov-h2", m.hijo2, 11, "2026-11-10", "pendiente");
  await cuota("c-sep-aj", m.alumnoAjeno, 9, "2026-09-10", "vencida");
  for (const tipo of ["formulario_inscripcion", "copia_dni"] as const) {
    await prisma.documento.create({ data: { id: `${P}-doc-${tipo}`, alumnoId: m.hijo1, tipo, estado: "cargado" } });
  }
  await prisma.documento.create({ data: { id: `${P}-doc-img`, alumnoId: m.hijo1, tipo: "autorizacion_imagen", estado: "autorizado" } });
  const evaluacion = (id: string, cursoId: string, nombre: string, dia: string, estado: "borrador" | "publicada") =>
    prisma.evaluacion.create({ data: { id: `${P}-${id}`, cursoId, nombre, tipo: "examen", fecha: fecha(dia), periodo: "noviembre", escala: "numerica", estado } });
  await evaluacion("e1", m.cursoId, "Unit 1", "2026-10-20", "borrador");
  await evaluacion("e2", m.cursoId, "Unit 2", "2026-10-30", "publicada");
  await evaluacion("e3", m.cursoMultiId, "Unit 3", "2026-10-16", "borrador");
  await prisma.calificacion.create({ data: { id: `${P}-cal1`, evaluacionId: `${P}-e1`, alumnoId: m.hijo1, nota: "8" } });
  await prisma.calificacion.create({ data: { id: `${P}-cal3`, evaluacionId: `${P}-e3`, alumnoId: m.alumnoAjeno, nota: "7" } });
  await prisma.notaCierre.create({ data: { id: `${P}-nc1`, alumnoId: m.hijo2, cursoId: m.cursoId, periodo: "julio", nota: "9", estado: "borrador" } });
  await prisma.asistencia.create({ data: { id: `${P}-as1`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: fecha("2026-10-13"), estado: "presente" } });

  // Cuotas del padre
  const cuotas = await esperados("cuota");
  const delPadre = de(cuotas, m.padre);
  ok("cuota: el padre tiene dos avisos", delPadre.length, 2);
  const porVencer = delPadre.find((a) => a.clave === `cuota:${P}-c-oct-h1`);
  ok("cuota por vencer: texto", porVencer?.texto, "La cuota de Octubre 2026 de Tomasav vence el 18/10");
  ok("cuota por vencer: amarilla", porVencer?.tono, "warning");
  ok("cuota por vencer: nivel", porVencer?.nivel, 1);
  ok("cuota por vencer: lleva al hijo", porVencer?.recurso.tipo === "cuota" && porVencer.recurso.alumnoId, m.hijo1);
  const vencida = delPadre.find((a) => a.clave === `cuota:${P}-c-sep-h2`);
  ok("cuota vencida: texto", vencida?.texto, "Cuota de Septiembre 2026 de Lunaav vencida — $10.000");
  ok("cuota vencida: roja y nivel 2", `${vencida?.tono} ${vencida?.nivel}`, "danger 2");
  ok("cuota a más de 5 días: sin aviso", delPadre.some((a) => a.clave === `cuota:${P}-c-nov-h2`) ? "sí" : "no", "no");
  ok("cuota: el ajeno solo ve la de su hijo", claves(de(cuotas, m.ajeno)), `cuota:${P}-c-sep-aj`);

  // Agrupados de administración y documentación
  const totalVencidas = await prisma.cuota.count({ where: { estado: "vencida" } });
  const vencidas = await esperados("cuotas_vencidas");
  const grupo = de(vencidas, m.admin);
  ok("cuotas vencidas: un aviso por cuenta", grupo.length, 1);
  ok("cuotas vencidas: el número es el total", grupo[0]?.nivel, totalVencidas);
  ok("cuotas vencidas: texto", grupo[0]?.texto, `Hay ${totalVencidas} cuotas vencidas`);
  ok("cuotas vencidas: multi como admin", de(vencidas, m.multi, "admin").length, 1);
  ok("cuotas vencidas: multi como profesor no", de(vencidas, m.multi, "profesor").length, 0);
  ok("cuotas vencidas: el padre no", de(vencidas, m.padre).length, 0);
  const totalFaltantes = (await documentoRepo.findFaltantes()).length;
  ok("documentación pendiente: el número coincide con faltantes", de(await esperados("documentacion_pendiente"), m.admin)[0]?.nivel, totalFaltantes);
  const docsHijos = await esperados("documentacion_hijo");
  ok("documentación del hijo: solo el que debe", claves(de(docsHijos, m.padre)), `documentacion:${m.hijo2}`);
  ok("documentación del hijo: el ajeno la del suyo", claves(de(docsHijos, m.ajeno)), `documentacion:${m.alumnoAjeno}`);

  // Evaluaciones y notas de cierre
  const proximas = de(await esperados("evaluacion_proxima"), m.admin);
  ok("evaluación próxima: dentro de 7 días", claves(proximas), `evaluacion-proxima:${P}-e1 evaluacion-proxima:${P}-e3`);
  ok("evaluación próxima: texto", proximas.find((a) => a.clave.endsWith("-e1"))?.texto, "Evaluación próxima: Unit 1 — Pruebaav Kids (20/10)");
  const sinPublicar = await esperados("notas_sin_publicar");
  ok("notas sin publicar: el profe la suya", claves(de(sinPublicar, m.profe)), `notas-sin-publicar:${P}-e1`);
  ok("notas sin publicar: multi como profesor la suya", claves(de(sinPublicar, m.multi, "profesor")), `notas-sin-publicar:${P}-e3`);
  ok("notas sin publicar: multi como admin nada", de(sinPublicar, m.multi, "admin").length, 0);
  const cierre = de(await esperados("cierre_sin_publicar"), m.profe);
  ok("cierre sin publicar: clave", claves(cierre), `cierre-sin-publicar:${m.cursoId}:julio`);
  ok("cierre sin publicar: texto", cierre[0]?.texto, "Notas de cierre de Pruebaav Kids (1° Cierre) en borrador");

  // Asistencia: clases martes y jueves 14:00; la del martes 13 ya se tomó
  const hoy = de(await esperados("asistencia_pendiente"), m.profe);
  ok("asistencia: el jueves ya empezado", claves(hoy), `asistencia:${m.cursoId}:2026-10-15`);
  ok("asistencia: texto de hoy", hoy[0]?.texto, "Falta tomar asistencia de Pruebaav Kids (hoy 14:00)");
  ok("asistencia: antes de que empiece la clase", de(await esperados("asistencia_pendiente", JUEVES_15_TEMPRANO), m.profe).length, 0);
  const semanaSiguiente = de(await esperados("asistencia_pendiente", JUEVES_22), m.profe);
  ok("asistencia: a los 7 días deja de figurar", claves(semanaSiguiente), `asistencia:${m.cursoId}:2026-10-20 asistencia:${m.cursoId}:2026-10-22`);
  ok("asistencia: texto de otro día", semanaSiguiente.find((a) => a.clave.endsWith("10-20"))?.texto, "Falta tomar asistencia de Pruebaav Kids del 20/10");
  ok("asistencia: en diciembre no hay clases", de(await esperados("asistencia_pendiente", JUEVES_3_DIC), m.profe).length, 0);

  // Las cuentas que no pueden entrar no reciben avisos
  for (const estado of ["inactivo", "pendiente"] as const) {
    await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado } });
    ok(`cuenta ${estado}: sin avisos`, de(await esperados("cuota"), m.ajeno).length, 0);
  }
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });

  // Eventos
  ok("nota: en borrador no avisa", (await criterios.notasPublicadas(`${P}-e1`, null)).length, 0);
  await prisma.evaluacion.update({ where: { id: `${P}-e1` }, data: { estado: "publicada", publicadaEn: new Date() } });
  const notas = await criterios.notasPublicadas(`${P}-e1`, null);
  ok("nota publicada: al padre del alumno", notas.map((a) => `${a.usuarioId}|${a.clave}`).join(), `${m.padre}|nota:${P}-e1:${m.hijo1}`);
  ok("nota publicada: texto", notas[0]?.texto, "Nueva nota de Tomasav: Unit 1");
  ok("nota publicada: solo los alumnos pedidos", (await criterios.notasPublicadas(`${P}-e1`, [m.hijo2])).length, 0);
  const publicadaEn = new Date("2026-10-15T17:00:00Z");
  await prisma.notaCierre.update({ where: { id: `${P}-nc1` }, data: { estado: "publicada", publicadaEn } });
  const cierres = await criterios.cierrePublicado(`${P}-nc1`);
  ok("cierre publicado: la clave lleva el momento", cierres[0]?.clave, `cierre:${P}-nc1:${publicadaEn.getTime()}`);
  ok("cierre publicado: texto", cierres[0]?.texto, "Nota de cierre (1° Cierre) de Lunaav publicada");
  const obs = await prisma.observacion.create({
    data: { id: `${P}-obs1`, alumnoId: m.hijo1, emisorId: m.profe, emisorRol: "profesor", fecha: new Date(), texto: "x", categoria: "academico" },
  });
  const observaciones = await criterios.observacionNueva(obs.id);
  ok("observación: al padre", `${observaciones[0]?.usuarioId} ${observaciones[0]?.texto}`, `${m.padre} Nueva observación sobre Tomasav`);
  await prisma.alumno.update({ where: { id: m.hijo1 }, data: { estado: "inactivo" } });
  ok("observación de un alumno inactivo: sin aviso", (await criterios.observacionNueva(obs.id)).length, 0);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

- [ ] **Step 2: Ver que falla**

Run: `cd server && pnpm exec tsx scripts/_criterios.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no existe `notificacion.criterios.prisma`).

- [ ] **Step 3: Crear el puerto `notificacion.criterios.ts`**

```ts
import type { AvisoEsperado, TipoEstado } from "./notificacion.entity";

// De dónde sale cada aviso: qué avisos de estado tienen que estar abiertos ahora (en todo el instituto) y qué avisos
// crea cada evento. Es el único lugar con el criterio de cada tipo: los anuncios de los módulos solo piden "sincronizá
// este tipo", y la revisión nocturna llama a lo mismo.
export interface CriteriosDeAvisos {
  esperados(tipo: TipoEstado, ahora: Date, tx?: unknown): Promise<AvisoEsperado[]>;
  notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx?: unknown): Promise<AvisoEsperado[]>;
  cierrePublicado(notaCierreId: string, tx?: unknown): Promise<AvisoEsperado[]>;
  observacionNueva(observacionId: string, tx?: unknown): Promise<AvisoEsperado[]>;
}
```

- [ ] **Step 4: Crear el adaptador `notificacion.criterios.prisma.ts`**

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { fechaHoraEnArgentina, inicioDeHoyUtc } from "../../core/fechas";
import { esMesLectivo } from "../cuotas/cuota.calendario";
import type { DocumentoRepository } from "../documentos/documento.repository";
import type { CriteriosDeAvisos } from "./notificacion.criterios";
import type { AvisoEsperado, Destinatario, TipoEstado } from "./notificacion.entity";

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_CUOTA_POR_VENCER = 5;
const DIAS_EVALUACION_PROXIMA = 7;
const DIAS_ASISTENCIA = 7;
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PERIODOS: Record<string, string> = { julio: "1° Cierre", noviembre: "2° Cierre" };

const dos = (n: number) => String(n).padStart(2, "0");
const formatMonto = (monto: number) => `$${monto.toLocaleString("es-AR")}`;
// Las fechas calendario (vencimientos, evaluaciones, asistencia) se guardan a medianoche UTC.
const diaMes = (fecha: Date) => `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}`;
const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
// Tipa cada aviso armado dentro de un map (si no, "padre" se ensancharía a string).
const aviso = (a: AvisoEsperado): AvisoEsperado => a;

// Criterios de los avisos sobre Prisma. Como reportes/, es una lectura que cruza varios módulos, así que consulta
// Prisma directo; la documentación pendiente sale del criterio único de documentos/. Destinatarios: solo cuentas
// activas, por rol. Todo "hoy" es en hora de Argentina.
export class PrismaCriteriosDeAvisos implements CriteriosDeAvisos {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentoRepo: DocumentoRepository,
  ) {}

  private db(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  esperados(tipo: TipoEstado, ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    switch (tipo) {
      case "cuotas_vencidas":
        return this.cuotasVencidas(tx);
      case "documentacion_pendiente":
        return this.documentacionPendiente(tx);
      case "evaluacion_proxima":
        return this.evaluacionesProximas(ahora, tx);
      case "asistencia_pendiente":
        return this.asistenciaPendiente(ahora, tx);
      case "notas_sin_publicar":
        return this.notasSinPublicar(tx);
      case "cierre_sin_publicar":
        return this.cierresSinPublicar(tx);
      case "cuota":
        return this.cuotasDePadres(ahora, tx);
      case "documentacion_hijo":
        return this.documentacionDeHijos(tx);
    }
  }

  // ── Destinatarios ────────────────────────────────────────────────────────
  private async staff(tx?: unknown): Promise<Destinatario[]> {
    const cuentas = await this.db(tx).usuario.findMany({
      where: { estado: "activo", roles: { hasSome: ["admin", "secretario"] } },
      select: { id: true, roles: true },
    });
    return cuentas.flatMap((c) =>
      c.roles.filter((r) => r === "admin" || r === "secretario").map((rol) => ({ usuarioId: c.id, rol })),
    );
  }

  // profesorId → su cuenta (activa y con el rol profesor).
  private async cuentasDeProfesores(tx?: unknown): Promise<Map<string, string>> {
    const profesores = await this.db(tx).profesor.findMany({
      where: { usuario: { estado: "activo", roles: { has: "profesor" } } },
      select: { id: true, usuarioId: true },
    });
    return new Map(profesores.map((p) => [p.id, p.usuarioId as string]));
  }

  // padreId → su cuenta (activa y con el rol padre).
  private async cuentasDePadres(tx?: unknown): Promise<Map<string, string>> {
    const padres = await this.db(tx).padre.findMany({
      where: { usuario: { estado: "activo", roles: { has: "padre" } } },
      select: { id: true, usuarioId: true },
    });
    return new Map(padres.map((p) => [p.id, p.usuarioId as string]));
  }

  // ── Administración y secretaría ──────────────────────────────────────────
  // Mismo criterio que la pestaña Vencidas de Cuotas: todas las cuotas vencidas.
  private async cuotasVencidas(tx?: unknown): Promise<AvisoEsperado[]> {
    const n = await this.db(tx).cuota.count({ where: { estado: "vencida" } });
    if (n === 0) return [];
    const texto = `Hay ${cantidad(n, "cuota vencida", "cuotas vencidas")}`;
    return (await this.staff(tx)).map((d) =>
      aviso({ ...d, tipo: "cuotas_vencidas", clave: "cuotas-vencidas", tono: "danger", texto, recurso: { tipo: "cuotas-vencidas" }, nivel: n }),
    );
  }

  private async documentacionPendiente(tx?: unknown): Promise<AvisoEsperado[]> {
    const n = (await this.documentoRepo.findFaltantes(tx)).length;
    if (n === 0) return [];
    const texto = `Hay ${cantidad(n, "alumno", "alumnos")} con documentación pendiente`;
    return (await this.staff(tx)).map((d) =>
      aviso({ ...d, tipo: "documentacion_pendiente", clave: "documentacion-pendiente", tono: "warning", texto, recurso: { tipo: "documentacion-pendiente" }, nivel: n }),
    );
  }

  private async evaluacionesProximas(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const hoy = inicioDeHoyUtc(ahora);
    const evaluaciones = await this.db(tx).evaluacion.findMany({
      where: {
        fecha: { gte: hoy, lt: new Date(hoy.getTime() + (DIAS_EVALUACION_PROXIMA + 1) * DIA_MS) },
        curso: { estado: "activo", ciclo: { activo: true } },
      },
      include: { curso: { select: { nombre: true } } },
    });
    const staff = await this.staff(tx);
    return evaluaciones.flatMap((e) =>
      staff.map((d) =>
        aviso({
          ...d,
          tipo: "evaluacion_proxima",
          clave: `evaluacion-proxima:${e.id}`,
          tono: "info",
          texto: `Evaluación próxima: ${e.nombre} — ${e.curso.nombre} (${diaMes(e.fecha)})`,
          recurso: { tipo: "evaluacion", cursoId: e.cursoId, evaluacionId: e.id },
          nivel: 0,
        }),
      ),
    );
  }

  // ── Profesor ─────────────────────────────────────────────────────────────
  // Clases de los últimos 7 días (hoy incluido, solo si ya empezó) sin ninguna asistencia ese día, en meses lectivos.
  private async asistenciaPendiente(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    if (cuentas.size === 0) return [];
    const cursos = await this.db(tx).curso.findMany({
      where: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } },
      include: { horarios: true },
    });
    const hoy = inicioDeHoyUtc(ahora);
    const desde = new Date(hoy.getTime() - (DIAS_ASISTENCIA - 1) * DIA_MS);
    const tomadas = await this.db(tx).asistencia.groupBy({
      by: ["cursoId", "fecha"],
      where: { cursoId: { in: cursos.map((c) => c.id) }, fecha: { gte: desde, lt: new Date(hoy.getTime() + DIA_MS) } },
    });
    const conAsistencia = new Set(tomadas.map((t) => `${t.cursoId}|${t.fecha.toISOString().slice(0, 10)}`));
    const { hora, minuto } = fechaHoraEnArgentina(ahora);
    const ahoraHHMM = `${dos(hora)}:${dos(minuto)}`;

    const lista: AvisoEsperado[] = [];
    for (let atras = 0; atras < DIAS_ASISTENCIA; atras++) {
      const dia = new Date(hoy.getTime() - atras * DIA_MS);
      if (!esMesLectivo(dia.getUTCMonth() + 1)) continue;
      const fecha = dia.toISOString().slice(0, 10);
      const nombreDia = DIAS_SEMANA[dia.getUTCDay()];
      for (const curso of cursos) {
        const clases = curso.horarios
          .filter((h) => h.diaSemana === nombreDia && (atras > 0 || h.horaInicio <= ahoraHHMM))
          .map((h) => h.horaInicio)
          .sort();
        if (clases.length === 0 || conAsistencia.has(`${curso.id}|${fecha}`)) continue;
        lista.push(
          aviso({
            usuarioId: cuentas.get(curso.profesorId) as string,
            rol: "profesor",
            tipo: "asistencia_pendiente",
            clave: `asistencia:${curso.id}:${fecha}`,
            tono: "warning",
            texto: atras === 0 ? `Falta tomar asistencia de ${curso.nombre} (hoy ${clases[0]})` : `Falta tomar asistencia de ${curso.nombre} del ${diaMes(dia)}`,
            recurso: { tipo: "asistencia", cursoId: curso.id, fecha },
            nivel: 0,
          }),
        );
      }
    }
    return lista;
  }

  private async notasSinPublicar(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    const evaluaciones = await this.db(tx).evaluacion.findMany({
      where: {
        estado: "borrador",
        calificaciones: { some: {} },
        curso: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } },
      },
      include: { curso: { select: { nombre: true, profesorId: true } } },
    });
    return evaluaciones.map((e) =>
      aviso({
        usuarioId: cuentas.get(e.curso.profesorId) as string,
        rol: "profesor",
        tipo: "notas_sin_publicar",
        clave: `notas-sin-publicar:${e.id}`,
        tono: "info",
        texto: `"${e.nombre}" (${e.curso.nombre}) tiene notas cargadas y sigue sin publicar`,
        recurso: { tipo: "evaluacion", cursoId: e.cursoId, evaluacionId: e.id },
        nivel: 0,
      }),
    );
  }

  private async cierresSinPublicar(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    const borradores = await this.db(tx).notaCierre.findMany({
      where: { estado: "borrador", curso: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } } },
      distinct: ["cursoId", "periodo"],
      select: { cursoId: true, periodo: true, curso: { select: { nombre: true, profesorId: true } } },
    });
    return borradores.map((b) =>
      aviso({
        usuarioId: cuentas.get(b.curso.profesorId) as string,
        rol: "profesor",
        tipo: "cierre_sin_publicar",
        clave: `cierre-sin-publicar:${b.cursoId}:${b.periodo}`,
        tono: "info",
        texto: `Notas de cierre de ${b.curso.nombre} (${PERIODOS[b.periodo] ?? b.periodo}) en borrador`,
        recurso: { tipo: "cierre", cursoId: b.cursoId, periodo: b.periodo },
        nivel: 0,
      }),
    );
  }

  // ── Padre ────────────────────────────────────────────────────────────────
  // Una sola fila por cuota: "por vencer" (nivel 1) y "vencida" (nivel 2) son el mismo aviso que se agrava.
  private async cuotasDePadres(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDePadres(tx);
    const hoy = inicioDeHoyUtc(ahora);
    const cuotas = await this.db(tx).cuota.findMany({
      where: { estado: { in: ["vencida", "pendiente"] }, alumno: { estado: "activo", padreId: { in: [...cuentas.keys()] } } },
      include: { alumno: { select: { nombre: true, padreId: true } } },
    });
    const lista: AvisoEsperado[] = [];
    for (const c of cuotas) {
      const mes = `${MESES[c.mes - 1]} ${c.anio}`;
      const base = {
        usuarioId: cuentas.get(c.alumno.padreId as string) as string,
        rol: "padre" as const,
        tipo: "cuota" as const,
        clave: `cuota:${c.id}`,
        recurso: { tipo: "cuota" as const, alumnoId: c.alumnoId, cuotaId: c.id },
      };
      if (c.estado === "vencida") {
        lista.push({ ...base, tono: "danger", texto: `Cuota de ${mes} de ${c.alumno.nombre} vencida — ${formatMonto(c.montoFinal)}`, nivel: 2 });
        continue;
      }
      const dias = Math.round((c.vencimiento.getTime() - hoy.getTime()) / DIA_MS);
      if (dias >= 0 && dias <= DIAS_CUOTA_POR_VENCER) {
        lista.push({ ...base, tono: "warning", texto: `La cuota de ${mes} de ${c.alumno.nombre} vence el ${diaMes(c.vencimiento)}`, nivel: 1 });
      }
    }
    return lista;
  }

  private async documentacionDeHijos(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDePadres(tx);
    return (await this.documentoRepo.findFaltantes(tx))
      .filter((f) => f.padreId !== null && cuentas.has(f.padreId))
      .map((f) =>
        aviso({
          usuarioId: cuentas.get(f.padreId as string) as string,
          rol: "padre",
          tipo: "documentacion_hijo",
          clave: `documentacion:${f.alumnoId}`,
          tono: "warning",
          texto: `${f.nombre} tiene documentación pendiente`,
          recurso: { tipo: "documentacion", alumnoId: f.alumnoId },
          nivel: 0,
        }),
      );
  }

  // ── Eventos (solo publicado, solo hijos activos, solo cuentas activas) ──────
  async notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx?: unknown): Promise<AvisoEsperado[]> {
    const e = await this.db(tx).evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        calificaciones: {
          where: alumnoIds ? { alumnoId: { in: alumnoIds } } : undefined,
          include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
        },
      },
    });
    if (!e || e.estado !== "publicada") return [];
    const cuentas = await this.cuentasDePadres(tx);
    return e.calificaciones
      .filter((c) => c.alumno.estado === "activo" && c.alumno.padreId !== null && cuentas.has(c.alumno.padreId))
      .map((c) =>
        aviso({
          usuarioId: cuentas.get(c.alumno.padreId as string) as string,
          rol: "padre",
          tipo: "nota_publicada",
          clave: `nota:${e.id}:${c.alumnoId}`,
          tono: "info",
          texto: `Nueva nota de ${c.alumno.nombre}: ${e.nombre}`,
          recurso: { tipo: "calificaciones", alumnoId: c.alumnoId },
          nivel: 0,
        }),
      );
  }

  async cierrePublicado(notaCierreId: string, tx?: unknown): Promise<AvisoEsperado[]> {
    const n = await this.db(tx).notaCierre.findUnique({
      where: { id: notaCierreId },
      include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
    });
    if (!n || n.estado !== "publicada" || !n.publicadaEn || n.alumno.estado !== "activo" || !n.alumno.padreId) return [];
    const usuarioId = (await this.cuentasDePadres(tx)).get(n.alumno.padreId);
    if (!usuarioId) return [];
    return [
      aviso({
        usuarioId,
        rol: "padre",
        tipo: "cierre_publicado",
        // Con el momento de publicación: si vuelve a borrador y se republica, es un aviso nuevo.
        clave: `cierre:${n.id}:${n.publicadaEn.getTime()}`,
        tono: "info",
        texto: `Nota de cierre (${PERIODOS[n.periodo] ?? n.periodo}) de ${n.alumno.nombre} publicada`,
        recurso: { tipo: "calificaciones", alumnoId: n.alumnoId },
        nivel: 0,
      }),
    ];
  }

  async observacionNueva(observacionId: string, tx?: unknown): Promise<AvisoEsperado[]> {
    const o = await this.db(tx).observacion.findUnique({
      where: { id: observacionId },
      include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
    });
    if (!o || o.alumno.estado !== "activo" || !o.alumno.padreId) return [];
    const usuarioId = (await this.cuentasDePadres(tx)).get(o.alumno.padreId);
    if (!usuarioId) return [];
    return [
      aviso({
        usuarioId,
        rol: "padre",
        tipo: "observacion_nueva",
        clave: `observacion:${o.id}`,
        tono: "info",
        texto: `Nueva observación sobre ${o.alumno.nombre}`,
        recurso: { tipo: "hijo", alumnoId: o.alumnoId },
        nivel: 0,
      }),
    ];
  }
}
```

- [ ] **Step 5: Correr la prueba y el typecheck**

Run: `cd server && pnpm exec tsx scripts/_criterios.ts 2>&1 | python3 $SCRATCH/chequear.py && pnpm typecheck`
Expected: `42 bien, 0 mal`, typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/notificaciones/notificacion.criterios.ts server/src/modules/notificaciones/notificacion.criterios.prisma.ts
git commit -m "Criterios de cada tipo de aviso, con destinatarios activos por rol

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Servicio de avisos, canal en memoria y API de la campana

**Files:**
- Modify: `server/src/core/ports.ts` (tiempo real)
- Create: `server/src/core/adapters/CanalEnMemoria.ts`
- Create: `server/src/modules/notificaciones/notificacion.repository.ts`, `notificacion.repository.prisma.ts`, `notificacion.schema.ts`
- Replace: `server/src/modules/notificaciones/notificacion.service.ts`, `notificacion.controller.ts`, `notificacion.routes.ts`
- Modify: `server/src/container.ts`
- Test: `server/scripts/_canal.ts`, `server/scripts/_avisos-servicio.ts`, `$SCRATCH/avisos-api.sh`; Modify (prueba): `server/scripts/_mundo-avisos.ts` (acción `sincronizar`); borrar `server/scripts/_verificar-notificaciones.ts` (usa el servicio viejo)

Entre esta tarea y la Task 8, la campana del navegador queda rota: la respuesta de `GET /api/notificaciones` cambia de forma. La rama no se fusiona hasta el final.

**Interfaces:**
- Produces (`core/ports.ts`):
  - `type MotivoCierre = "cerrada-por-el-usuario" | "cerrada-desde-otro-dispositivo" | "contrasena-cambiada" | "cuenta-desactivada" | "vencida"`;
  - `interface SenalEnVivo { tipo: string; datos?: unknown }`;
  - `interface ConexionEnVivo { sesionId; usuarioId; rol: Rol; enviar(senal): void; cerrar(): void }`;
  - `interface CanalEnVivo { registrar(c): () => void; enviarA(usuarioId, rol, senal): void; conectado(usuarioId, rol): boolean; revisarSesiones(usuarioId, motivo): Promise<void> }`.
- Produces: `class CanalEnMemoria implements CanalEnVivo` (constructor `(validar: ValidadorDeSesion)`); al reemplazar la conexión de una sesión, la anterior recibe la señal `reemplazada` y se cierra.
- Produces (`NotificacionService(repo, criterios, canal, unitOfWork)`):
  - `sincronizar(tipos: TipoEstado[], tx: unknown, ahora?)`;
  - `notasPublicadas(evaluacionId, alumnoIds | null, tx)`, `cierrePublicado(notaCierreId, tx)`, `observacionNueva(observacionId, tx)`;
  - `sincronizarTodo(ahora?)`, `sincronizarAsistencia(ahora?)`, `limpiar(ahora?)`;
  - `campana(d): Promise<{ noLeidas: number; avisos: AvisoVista[] }>`;
  - `historial(d, filtro, despuesDe?, ahora?): Promise<{ avisos: AvisoVista[]; siguiente: string | null }>`;
  - `marcarLeida(d, id, ahora?)`, `leerTodas(d, ahora?): Promise<number>`;
  - `preferencias(d): Promise<{ tipo; etiqueta; activa }[]>`, `cambiarPreferencia(d, tipo, activa)`.
  - `AvisoVista = { id; tipo; tono; texto; recurso; leida: boolean; resuelta: boolean; fecha: Date }`.
- Produces (API, todos los roles autenticados):
  - `GET /api/notificaciones`, `GET /api/notificaciones/historial?filtro=todas|no-leidas|pendientes&despuesDe=<id>`;
  - `POST /api/notificaciones/:id/leida` (204/404), `POST /api/notificaciones/leer-todas` (`{ marcadas }`);
  - `GET /api/notificaciones/preferencias`, `PATCH /api/notificaciones/preferencias/:tipo` (`{ activa }` → 204; 400).
- Produces (`container`): `canalEnVivo`, `validadorDeSesion`, `notificacionService`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_canal.ts`:

```ts
import { CanalEnMemoria } from "../src/core/adapters/CanalEnMemoria";
import type { Rol, SenalEnVivo } from "../src/core/ports";
import { ok } from "./_check";

const validas = new Set(["s1", "s2", "s3"]);
const canal = new CanalEnMemoria(async (sesionId) => validas.has(sesionId));
const conectar = (sesionId: string, usuarioId: string, rol: Rol) => {
  const c = {
    sesionId,
    usuarioId,
    rol,
    recibidas: [] as string[],
    cerrada: false,
    enviar(s: SenalEnVivo) {
      c.recibidas.push(s.datos === undefined ? s.tipo : `${s.tipo} ${JSON.stringify(s.datos)}`);
    },
    cerrar() {
      c.cerrada = true;
      quitar();
    },
  };
  const quitar = canal.registrar(c);
  return c;
};

(async () => {
  const comoAdmin = conectar("s1", "u1", "admin");
  const comoProfesora = conectar("s2", "u1", "profesor");
  const otra = conectar("s3", "u2", "padre");
  canal.enviarA("u1", "admin", { tipo: "notificaciones", datos: { noLeidas: 3 } });
  ok("la señal llega a la cuenta en ese rol", comoAdmin.recibidas.join(), 'notificaciones {"noLeidas":3}');
  ok("no llega a la misma cuenta en otro rol", comoProfesora.recibidas.length, 0);
  ok("no llega a otra cuenta", otra.recibidas.length, 0);
  ok("conectado en ese rol", canal.conectado("u1", "admin") ? "sí" : "no", "sí");
  ok("no conectado en un rol sin conexión", canal.conectado("u2", "admin") ? "sí" : "no", "no");

  const reemplazo = conectar("s1", "u1", "admin");
  ok("la conexión anterior de la sesión se avisa", comoAdmin.recibidas.at(-1), "reemplazada");
  ok("y se cierra", comoAdmin.cerrada ? "sí" : "no", "sí");
  canal.enviarA("u1", "admin", { tipo: "notificaciones", datos: { noLeidas: 4 } });
  ok("las señales van a la nueva", reemplazo.recibidas.join(), 'notificaciones {"noLeidas":4}');
  ok("la anterior no recibe más", comoAdmin.recibidas.length, 2);

  validas.delete("s2");
  await canal.revisarSesiones("u1", "cerrada-desde-otro-dispositivo");
  ok("la sesión cerrada recibe el motivo", comoProfesora.recibidas.join(), 'sesion-cerrada {"motivo":"cerrada-desde-otro-dispositivo"}');
  ok("y se corta", comoProfesora.cerrada ? "sí" : "no", "sí");
  ok("la que sigue valiendo queda abierta", reemplazo.cerrada ? "sí" : "no", "no");
  ok("después del corte no figura conectada", canal.conectado("u1", "profesor") ? "sí" : "no", "no");
  ok("otra cuenta no se revisa", otra.cerrada ? "sí" : "no", "no");
})();
```

`server/scripts/_avisos-servicio.ts`:

```ts
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { CanalEnVivo, Rol, SenalEnVivo } from "../src/core/ports";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import type { TipoEstado } from "../src/modules/notificaciones/notificacion.entity";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

class CanalDePrueba implements CanalEnVivo {
  conectados = new Set<string>();
  senales: string[] = [];
  registrar() {
    return () => {};
  }
  enviarA(usuarioId: string, rol: Rol, s: SenalEnVivo) {
    this.senales.push(`${usuarioId}|${rol}|${(s.datos as { noLeidas: number }).noLeidas}`);
  }
  conectado(usuarioId: string, rol: Rol) {
    return this.conectados.has(`${usuarioId}|${rol}`);
  }
  async revisarSesiones() {}
}

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const canal = new CanalDePrueba();
const servicio = new NotificacionService(
  new PrismaNotificacionRepository(prisma),
  new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma)),
  canal,
  uow,
);
const AHORA = new Date("2026-10-15T18:00:00Z");
const esperar = () => new Promise((r) => setTimeout(r, 100));
const sync = (tipos: TipoEstado[]) => uow.runInTransaction((tx) => servicio.sincronizar(tipos, tx, AHORA));
const fila = (usuarioId: string, clave: string, rol?: Rol) =>
  prisma.notificacion.findFirst({ where: { usuarioId, clave, ...(rol ? { rol } : {}) } });
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
const cuota = (id: string, alumnoId: string, mes: number, vence: string, estado: "pendiente" | "vencida") =>
  prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId, mes, anio: 2026, montoBase: 10000, descuento: 0, montoFinal: 10000, vencimiento: new Date(`${vence}T00:00:00Z`), estado } });
const observacion = (alumnoId: string, autor: string) =>
  prisma.observacion.create({ data: { id: `${P}-obs-${randomUUID()}`, alumnoId, emisorId: autor, emisorRol: "profesor", fecha: new Date(), texto: "x", categoria: "academico" } });

(async () => {
  const m = await crearMundo(prisma);
  const padre = { usuarioId: m.padre, rol: "padre" as const };
  const admin = { usuarioId: m.admin, rol: "admin" as const };
  canal.conectados.add(`${m.padre}|padre`);

  // 1) Nace el aviso de la cuota por vencer y sale la señal después de confirmar
  await cuota("c1", m.hijo1, 10, "2026-10-18", "pendiente");
  await sync(["cuota"]);
  await esperar();
  const c1 = await fila(m.padre, `cuota:${P}-c1`);
  ok("1: aviso creado, sin leer", `${c1?.tono} ${c1?.leidaEn}`, "warning null");
  ok("1: señal al padre conectado", canal.senales.at(-1), `${m.padre}|padre|1`);

  // 2) Sincronizar de nuevo sin cambios no toca nada ni manda señales
  const senalesAntes = canal.senales.length;
  await sync(["cuota"]);
  await esperar();
  ok("2: misma fecha de actualización", (await fila(m.padre, `cuota:${P}-c1`))?.actualizadaEn.getTime(), c1?.actualizadaEn.getTime());
  ok("2: sin señales nuevas", canal.senales.length, senalesAntes);

  // 3) Marcar leída manda el número nuevo
  await servicio.marcarLeida(padre, c1!.id);
  ok("3: queda leída", (await fila(m.padre, `cuota:${P}-c1`))?.leidaEn !== null ? "sí" : "no", "sí");
  ok("3: señal con 0 sin leer", canal.senales.at(-1), `${m.padre}|padre|0`);

  // 4) Vence: misma fila, roja y otra vez sin leer
  await prisma.cuota.update({ where: { id: `${P}-c1` }, data: { estado: "vencida" } });
  await sync(["cuota"]);
  const c1v = await fila(m.padre, `cuota:${P}-c1`);
  ok("4: misma fila", c1v?.id, c1?.id);
  ok("4: roja y sin leer", `${c1v?.tono} ${c1v?.leidaEn}`, "danger null");

  // 5) Se paga: se resuelve, sale de la campana y queda en el historial
  await prisma.cuota.update({ where: { id: `${P}-c1` }, data: { estado: "pagada" } });
  await sync(["cuota"]);
  ok("5: resuelta", (await fila(m.padre, `cuota:${P}-c1`))?.resueltaEn !== null ? "sí" : "no", "sí");
  ok("5: fuera de la campana", (await servicio.campana(padre)).avisos.some((a) => a.id === c1?.id) ? "sí" : "no", "no");
  const enHistorial = (await servicio.historial(padre, "todas", undefined, AHORA)).avisos.find((a) => a.id === c1?.id);
  ok("5: en el historial, marcada resuelta", enHistorial?.resuelta ? "sí" : "no", "sí");

  // 6) Agrupado: vuelve a no leído solo cuando el número sube
  await sync(["cuotas_vencidas"]);
  const grupo = await fila(m.admin, "cuotas-vencidas");
  await servicio.marcarLeida(admin, grupo!.id);
  await cuota("c2", m.hijo2, 9, "2026-09-10", "vencida");
  await sync(["cuotas_vencidas"]);
  const grupoMas = await fila(m.admin, "cuotas-vencidas");
  ok("6: el número sube", grupoMas?.nivel, grupo!.nivel + 1);
  ok("6: vuelve a no leído", grupoMas?.leidaEn, null);
  await servicio.marcarLeida(admin, grupo!.id);
  await prisma.cuota.delete({ where: { id: `${P}-c2` } });
  await sync(["cuotas_vencidas"]);
  const grupoMenos = await fila(m.admin, "cuotas-vencidas");
  ok("6: el número baja", grupoMenos?.nivel, grupo!.nivel);
  ok("6: sigue leído", grupoMenos?.leidaEn !== null ? "sí" : "no", "sí");

  // 7) Preferencias
  const prefs = await servicio.preferencias(padre);
  ok("7: el padre ve sus 5 tipos, encendidos", `${prefs.length} ${prefs.every((p) => p.activa)}`, "5 true");
  await cuota("c3", m.hijo2, 10, "2026-10-17", "pendiente");
  await sync(["cuota"]);
  await servicio.cambiarPreferencia(padre, "cuota", false);
  ok("7: apagar borra los avisos del tipo", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "cuota" } }), 0);
  await sync(["cuota"]);
  ok("7: apagado no se vuelven a crear", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "cuota" } }), 0);
  await servicio.cambiarPreferencia(padre, "cuota", true);
  ok("7: al encender vuelven los vigentes", (await fila(m.padre, `cuota:${P}-c3`)) ? "sí" : "no", "sí");
  ok("7: un tipo de otro rol se rechaza", await rechazo(servicio.cambiarPreferencia(padre, "cuotas_vencidas", false)), "ValidationError");

  // 8) Cuenta con dos roles: avisos y lecturas separados
  await prisma.evaluacion.create({ data: { id: `${P}-e3`, cursoId: m.cursoMultiId, nombre: "Unit 3", tipo: "examen", fecha: new Date("2026-11-20T00:00:00Z"), periodo: "noviembre", escala: "numerica", estado: "borrador" } });
  await prisma.calificacion.create({ data: { id: `${P}-cal3`, evaluacionId: `${P}-e3`, alumnoId: m.alumnoAjeno, nota: "7" } });
  await sync(["cuotas_vencidas", "notas_sin_publicar"]);
  const comoAdmin = await fila(m.multi, "cuotas-vencidas", "admin");
  const comoProfesora = await fila(m.multi, `notas-sin-publicar:${P}-e3`, "profesor");
  ok("8: tiene su aviso como admin", comoAdmin ? "sí" : "no", "sí");
  ok("8: y otro como profesora", comoProfesora ? "sí" : "no", "sí");
  ok("8: no puede marcar el de admin desde el rol profesor", await rechazo(servicio.marcarLeida({ usuarioId: m.multi, rol: "profesor" }, comoAdmin!.id)), "EntityNotFoundError");
  await servicio.marcarLeida({ usuarioId: m.multi, rol: "admin" }, comoAdmin!.id);
  ok("8: el de profesora sigue sin leer", (await fila(m.multi, `notas-sin-publicar:${P}-e3`, "profesor"))?.leidaEn, null);
  ok("8: otra cuenta no puede marcarlo", await rechazo(servicio.marcarLeida(padre, comoProfesora!.id)), "EntityNotFoundError");

  // 9) Eventos: una sola vez, y nada si la operación se deshace
  const o1 = await observacion(m.hijo1, m.profe);
  await uow.runInTransaction((tx) => servicio.observacionNueva(o1.id, tx));
  await uow.runInTransaction((tx) => servicio.observacionNueva(o1.id, tx));
  ok("9: una sola fila por evento", await prisma.notificacion.count({ where: { clave: `observacion:${o1.id}` } }), 1);
  const o2 = await observacion(m.hijo1, m.profe);
  const antesDeDeshacer = canal.senales.length;
  await uow.runInTransaction(async (tx) => {
    await servicio.observacionNueva(o2.id, tx);
    throw new Error("se deshace");
  }).catch(() => {});
  await esperar();
  ok("9: deshecha no deja aviso", await prisma.notificacion.count({ where: { clave: `observacion:${o2.id}` } }), 0);
  ok("9: deshecha no manda señal", canal.senales.length, antesDeDeshacer);

  // 10) Dos sincronizaciones a la vez del mismo tipo no chocan
  await prisma.notificacion.deleteMany({ where: { clave: "cuotas-vencidas", usuarioId: { startsWith: P } } });
  const simultaneas = await Promise.all([sync(["cuotas_vencidas"]), sync(["cuotas_vencidas"])].map(rechazo));
  ok("10: las dos terminan bien", simultaneas.join(), "ok,ok");
  ok("10: una sola fila", await prisma.notificacion.count({ where: { clave: "cuotas-vencidas", usuarioId: m.admin } }), 1);

  // 11) Campana: hasta 10, primero los no leídos; historial de a 50 con cursor
  for (let i = 0; i < 55; i++) {
    const o = await observacion(m.hijo2, m.profe);
    await uow.runInTransaction((tx) => servicio.observacionNueva(o.id, tx));
  }
  const campana = await servicio.campana(padre);
  ok("11: la campana muestra 10", campana.avisos.length, 10);
  ok("11: el número cuenta todos los no leídos", campana.noLeidas, await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "padre", leidaEn: null, resueltaEn: null } }));
  ok("11: primero los no leídos", campana.avisos.every((a) => !a.leida) ? "sí" : "no", "sí");
  const pagina1 = await servicio.historial(padre, "todas");
  ok("11: primera página de 50", pagina1.avisos.length, 50);
  const pagina2 = await servicio.historial(padre, "todas", pagina1.siguiente!);
  ok("11: la segunda trae el resto", pagina1.avisos.length + pagina2.avisos.length, await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "padre" } }));
  ok("11: sin repetidos", new Set([...pagina1.avisos, ...pagina2.avisos].map((a) => a.id)).size, pagina1.avisos.length + pagina2.avisos.length);
  ok("11: la última página no tiene siguiente", pagina2.siguiente, null);
  const pendientes = await servicio.historial(padre, "pendientes", undefined, AHORA);
  ok("11: 'pendientes' solo trae estado abierto", pendientes.avisos.every((a) => !a.resuelta && a.tipo === "cuota") ? "sí" : "no", "sí");

  // 12) Leer todas
  ok("12: marca todas", (await servicio.leerTodas(padre)) > 50 ? "sí" : "no", "sí");
  ok("12: queda en cero", (await servicio.campana(padre)).noLeidas, 0);

  // 13) Limpieza a los 30 días: se van los eventos y los resueltos viejos; los de estado abiertos se quedan
  const viejo = new Date(AHORA.getTime() - 31 * 24 * 60 * 60 * 1000);
  await prisma.notificacion.update({ where: { id: c1!.id }, data: { actualizadaEn: viejo } }); // resuelta
  await prisma.notificacion.updateMany({ where: { clave: `observacion:${o1.id}` }, data: { actualizadaEn: viejo } });
  await prisma.notificacion.updateMany({ where: { clave: `cuota:${P}-c3` }, data: { actualizadaEn: viejo } }); // abierta
  await servicio.limpiar(AHORA);
  ok("13: el resuelto viejo se borra", (await fila(m.padre, `cuota:${P}-c1`)) ? "sigue" : "borrado", "borrado");
  ok("13: el evento viejo se borra", (await fila(m.padre, `observacion:${o1.id}`)) ? "sigue" : "borrado", "borrado");
  ok("13: el de estado abierto se queda", (await fila(m.padre, `cuota:${P}-c3`)) ? "sigue" : "borrado", "sigue");

  await limpiarMundo(prisma);
  await servicio.sincronizarTodo();
  ok("limpieza", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
```

`$SCRATCH/avisos-api.sh`:

```bash
source $SCRATCH/lib.sh
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null
q "insert into \"Cuota\"(id,\"alumnoId\",mes,anio,\"montoBase\",descuento,\"montoFinal\",vencimiento,estado) values ('prueba-tmp-av-c1','prueba-tmp-av-hijo1',9,2026,1000,0,1000,'2026-09-10','vencida')" >/dev/null
pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
A=$(login prueba-tmp-av-admin@prueba.babylon.test prueba1234)
PA=$(login prueba-tmp-av-padre@prueba.babylon.test prueba1234)
ok "campana: forma" "$(http GET /api/notificaciones $PA | js 'typeof d.noLeidas + " " + Array.isArray(d.avisos)')" "number true"
ok "campana: la cuota y la documentación de los dos hijos" "$(http GET /api/notificaciones $PA | js 'd.avisos.map(a=>a.recurso.tipo).sort().join()')" "cuota,documentacion,documentacion"
ok "campana sin sesión" "$(code GET /api/notificaciones)" 401
ID=$(http GET /api/notificaciones $PA | js 'd.avisos[0].id')
ok "marcar leída un aviso ajeno" "$(code POST /api/notificaciones/$ID/leida $A)" 404
ok "marcar leída el propio" "$(code POST /api/notificaciones/$ID/leida $PA)" 204
ok "el número baja" "$(http GET /api/notificaciones $PA | js d.noLeidas)" 2
ok "leer todas" "$(http POST /api/notificaciones/leer-todas $PA | js d.marcadas)" 2
ok "historial con filtro inválido" "$(code GET '/api/notificaciones/historial?filtro=cualquiera' $PA)" 400
ok "historial pendientes" "$(http GET '/api/notificaciones/historial?filtro=pendientes' $PA | js 'd.avisos.length + " " + d.siguiente')" "3 null"
ok "preferencias del padre" "$(http GET /api/notificaciones/preferencias $PA | js 'd.map(p=>p.tipo).join()')" "cuota,documentacion_hijo,nota_publicada,cierre_publicado,observacion_nueva"
ok "preferencias del admin" "$(http GET /api/notificaciones/preferencias $A | js d.length)" 3
ok "apagar un tipo de otro rol" "$(code PATCH /api/notificaciones/preferencias/cuotas_vencidas $PA '{"activa":false}')" 400
ok "apagar un tipo inexistente" "$(code PATCH /api/notificaciones/preferencias/nada $PA '{"activa":false}')" 400
ok "apagar sin cuerpo" "$(code PATCH /api/notificaciones/preferencias/cuota $PA '{}')" 400
ok "apagar la cuota" "$(code PATCH /api/notificaciones/preferencias/cuota $PA '{"activa":false}')" 204
ok "la cuota ya no está" "$(http GET /api/notificaciones $PA | js 'd.avisos.some(a=>a.tipo==="cuota")')" false
ok "figura apagada" "$(http GET /api/notificaciones/preferencias $PA | js 'd.find(p=>p.tipo==="cuota").activa')" false
pnpm exec tsx scripts/_mundo-avisos.ts borrar >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
```

El padre del mundo tiene 2 hijos sin documentos (2 avisos `documentacion`) y la cuota vencida de `hijo1`. Los tres nacen en la misma revisión, con la misma fecha, así que la prueba compara el conjunto ordenado y no el orden de la campana.

- [ ] **Step 2: Ver que fallan**

Run: `cd server && pnpm exec tsx scripts/_canal.ts 2>&1 | python3 $SCRATCH/chequear.py; pnpm exec tsx scripts/_avisos-servicio.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL en los dos (faltan los módulos).

- [ ] **Step 3: Tipos de tiempo real en `core/ports.ts`**

Agregar al final:

```ts
// ── Tiempo real (ver core/tiempoReal.ts y core/adapters/CanalEnMemoria.ts) ──
export type MotivoCierre =
  | "cerrada-por-el-usuario"
  | "cerrada-desde-otro-dispositivo"
  | "contrasena-cambiada"
  | "cuenta-desactivada"
  | "vencida";

// Lo que viaja por la conexión abierta: qué cambió, nunca datos personales (la pantalla vuelve a pedir lo que necesita).
export interface SenalEnVivo {
  tipo: string;
  datos?: unknown;
}

export interface ConexionEnVivo {
  sesionId: string;
  usuarioId: string;
  rol: Rol;
  enviar(senal: SenalEnVivo): void;
  cerrar(): void;
}

// Pieza intercambiable: hoy en memoria (un solo servidor); con varios servidores, otro adaptador (por ejemplo, con
// LISTEN/NOTIFY de PostgreSQL) sin tocar el resto.
export interface CanalEnVivo {
  // Registra la conexión de una sesión (si ya tenía una, la reemplaza). Devuelve cómo darla de baja.
  registrar(conexion: ConexionEnVivo): () => void;
  enviarA(usuarioId: string, rol: Rol, senal: SenalEnVivo): void;
  conectado(usuarioId: string, rol: Rol): boolean;
  // Vuelve a validar las conexiones de la cuenta y corta, avisando el motivo, las de sesiones que ya no valen.
  revisarSesiones(usuarioId: string, motivo: MotivoCierre): Promise<void>;
}
```

- [ ] **Step 4: Crear `core/adapters/CanalEnMemoria.ts`**

```ts
import type { CanalEnVivo, ConexionEnVivo, MotivoCierre, Rol, SenalEnVivo, ValidadorDeSesion } from "../ports";

// Conexiones abiertas en la memoria de este proceso: una por sesión. Alcanza con un solo servidor.
export class CanalEnMemoria implements CanalEnVivo {
  private readonly porSesion = new Map<string, ConexionEnVivo>();

  constructor(private readonly validar: ValidadorDeSesion) {}

  registrar(conexion: ConexionEnVivo): () => void {
    const anterior = this.porSesion.get(conexion.sesionId);
    if (anterior) {
      anterior.enviar({ tipo: "reemplazada" });
      anterior.cerrar();
    }
    this.porSesion.set(conexion.sesionId, conexion);
    return () => {
      if (this.porSesion.get(conexion.sesionId) === conexion) this.porSesion.delete(conexion.sesionId);
    };
  }

  enviarA(usuarioId: string, rol: Rol, senal: SenalEnVivo): void {
    for (const c of this.porSesion.values()) if (c.usuarioId === usuarioId && c.rol === rol) c.enviar(senal);
  }

  conectado(usuarioId: string, rol: Rol): boolean {
    for (const c of this.porSesion.values()) if (c.usuarioId === usuarioId && c.rol === rol) return true;
    return false;
  }

  async revisarSesiones(usuarioId: string, motivo: MotivoCierre): Promise<void> {
    for (const c of [...this.porSesion.values()]) {
      if (c.usuarioId !== usuarioId || (await this.validar(c.sesionId, c.usuarioId))) continue;
      c.enviar({ tipo: "sesion-cerrada", datos: { motivo } });
      c.cerrar();
    }
  }
}
```

- [ ] **Step 5: Crear el puerto `notificacion.repository.ts`**

```ts
import type { Repository } from "../../core/ports";
import type { Destinatario, Notificacion, TipoNotificacion } from "./notificacion.entity";

export type FiltroHistorial = "todas" | "no-leidas" | "pendientes";

export interface OpcionesHistorial {
  desde: Date;
  filtro: FiltroHistorial;
  despuesDe?: string;
  limite: number;
}

export interface NotificacionRepository extends Repository<Notificacion> {
  // Bloquea esos tipos hasta el final de la transacción (en orden, para que dos transacciones no se traben).
  bloquearTipos(tipos: TipoNotificacion[], tx: unknown): Promise<void>;
  findPorTipo(tipo: TipoNotificacion, tx?: unknown): Promise<Notificacion[]>;
  crearVarias(avisos: Notificacion[], tx?: unknown): Promise<void>;
  actualizarParcial(id: string, datos: Partial<Notificacion>, tx?: unknown): Promise<void>;
  // Crea las que no existen (misma cuenta, rol y clave) y devuelve a quiénes se les creó algo.
  crearEventos(avisos: Notificacion[], tx?: unknown): Promise<Destinatario[]>;
  findDesactivadas(tipo: TipoNotificacion, tx?: unknown): Promise<Destinatario[]>;
  findDesactivadasDe(d: Destinatario, tx?: unknown): Promise<TipoNotificacion[]>;
  // Apaga el tipo para esa cuenta y rol y borra sus avisos de ese tipo (también del historial).
  desactivar(d: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void>;
  activar(d: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void>;
  // Abiertos (de estado sin resolver, leídos o no) y eventos sin leer: primero los no leídos, después el más reciente.
  campana(d: Destinatario, limite: number): Promise<Notificacion[]>;
  contarNoLeidas(d: Destinatario): Promise<number>;
  historial(d: Destinatario, opciones: OpcionesHistorial): Promise<Notificacion[]>;
  // false si el aviso no existe o es de otra cuenta u otro rol.
  marcarLeida(id: string, d: Destinatario, ahora: Date): Promise<boolean>;
  marcarTodasLeidas(d: Destinatario, ahora: Date): Promise<number>;
  // Borra los avisos actualizados antes de `antesDe`, salvo los de estado abiertos.
  limpiar(antesDe: Date): Promise<number>;
}
```

- [ ] **Step 6: Crear el adaptador `notificacion.repository.prisma.ts`**

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Destinatario, Notificacion, RecursoAviso, TipoNotificacion } from "./notificacion.entity";
import type { NotificacionRepository, OpcionesHistorial } from "./notificacion.repository";

type Fila = Awaited<ReturnType<PrismaClient["notificacion"]["findUniqueOrThrow"]>>;

const aEntidad = (f: Fila): Notificacion => ({ ...f, recurso: f.recurso as unknown as RecursoAviso });
const aFila = (n: Notificacion): Prisma.NotificacionCreateManyInput => ({ ...n, recurso: n.recurso as unknown as Prisma.InputJsonValue });
const aCambios = ({ recurso, ...resto }: Partial<Notificacion>): Prisma.NotificacionUncheckedUpdateInput => ({
  ...resto,
  ...(recurso ? { recurso: recurso as unknown as Prisma.InputJsonValue } : {}),
});
const llave = (x: { usuarioId: string; rol: string; clave: string }) => `${x.usuarioId}|${x.rol}|${x.clave}`;

export class PrismaNotificacionRepository implements NotificacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Notificacion | null> {
    const f = await this.client(tx).notificacion.findUnique({ where: { id } });
    return f ? aEntidad(f) : null;
  }

  async findAll(tx?: unknown): Promise<Notificacion[]> {
    return (await this.client(tx).notificacion.findMany()).map(aEntidad);
  }

  async create(n: Notificacion, tx?: unknown): Promise<Notificacion> {
    return aEntidad(await this.client(tx).notificacion.create({ data: aFila(n) }));
  }

  async update(id: string, n: Notificacion, tx?: unknown): Promise<Notificacion> {
    return aEntidad(await this.client(tx).notificacion.update({ where: { id }, data: aCambios(n) }));
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    await this.client(tx).notificacion.delete({ where: { id } });
  }

  async bloquearTipos(tipos: TipoNotificacion[], tx: unknown): Promise<void> {
    for (const tipo of [...tipos].sort()) {
      await this.client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`avisos:${tipo}`}, 0))`;
    }
  }

  async findPorTipo(tipo: TipoNotificacion, tx?: unknown): Promise<Notificacion[]> {
    return (await this.client(tx).notificacion.findMany({ where: { tipo } })).map(aEntidad);
  }

  async crearVarias(avisos: Notificacion[], tx?: unknown): Promise<void> {
    if (avisos.length > 0) await this.client(tx).notificacion.createMany({ data: avisos.map(aFila) });
  }

  async actualizarParcial(id: string, datos: Partial<Notificacion>, tx?: unknown): Promise<void> {
    await this.client(tx).notificacion.update({ where: { id }, data: aCambios(datos) });
  }

  async crearEventos(avisos: Notificacion[], tx?: unknown): Promise<Destinatario[]> {
    if (avisos.length === 0) return [];
    const db = this.client(tx);
    const existentes = await db.notificacion.findMany({
      where: { OR: avisos.map(({ usuarioId, rol, clave }) => ({ usuarioId, rol, clave })) },
      select: { usuarioId: true, rol: true, clave: true },
    });
    const yaEstan = new Set(existentes.map(llave));
    const nuevos = avisos.filter((a) => !yaEstan.has(llave(a)));
    // skipDuplicates: si otra transacción creó el mismo evento a la vez, se ignora en lugar de fallar.
    await db.notificacion.createMany({ data: nuevos.map(aFila), skipDuplicates: true });
    return nuevos.map(({ usuarioId, rol }) => ({ usuarioId, rol }));
  }

  async findDesactivadas(tipo: TipoNotificacion, tx?: unknown): Promise<Destinatario[]> {
    return this.client(tx).notificacionDesactivada.findMany({ where: { tipo }, select: { usuarioId: true, rol: true } });
  }

  async findDesactivadasDe({ usuarioId, rol }: Destinatario, tx?: unknown): Promise<TipoNotificacion[]> {
    return (await this.client(tx).notificacionDesactivada.findMany({ where: { usuarioId, rol }, select: { tipo: true } })).map((f) => f.tipo);
  }

  async desactivar({ usuarioId, rol }: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void> {
    const db = this.client(tx);
    await db.notificacionDesactivada.createMany({ data: [{ usuarioId, rol, tipo }], skipDuplicates: true });
    await db.notificacion.deleteMany({ where: { usuarioId, rol, tipo } });
  }

  async activar({ usuarioId, rol }: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void> {
    await this.client(tx).notificacionDesactivada.deleteMany({ where: { usuarioId, rol, tipo } });
  }

  async campana({ usuarioId, rol }: Destinatario, limite: number): Promise<Notificacion[]> {
    const filas = await this.prisma.notificacion.findMany({
      where: { usuarioId, rol, resueltaEn: null, OR: [{ leidaEn: null }, { clase: "estado" }] },
      orderBy: [{ leidaEn: { sort: "asc", nulls: "first" } }, { actualizadaEn: "desc" }, { id: "desc" }],
      take: limite,
    });
    return filas.map(aEntidad);
  }

  async contarNoLeidas({ usuarioId, rol }: Destinatario): Promise<number> {
    return this.prisma.notificacion.count({ where: { usuarioId, rol, leidaEn: null, resueltaEn: null } });
  }

  async historial({ usuarioId, rol }: Destinatario, { desde, filtro, despuesDe, limite }: OpcionesHistorial): Promise<Notificacion[]> {
    const porFiltro: Prisma.NotificacionWhereInput =
      filtro === "no-leidas" ? { leidaEn: null, resueltaEn: null } : filtro === "pendientes" ? { clase: "estado", resueltaEn: null } : {};
    const filas = await this.prisma.notificacion.findMany({
      where: { usuarioId, rol, actualizadaEn: { gte: desde }, ...porFiltro },
      orderBy: [{ actualizadaEn: "desc" }, { id: "desc" }],
      take: limite,
      ...(despuesDe ? { cursor: { id: despuesDe }, skip: 1 } : {}),
    });
    return filas.map(aEntidad);
  }

  async marcarLeida(id: string, { usuarioId, rol }: Destinatario, ahora: Date): Promise<boolean> {
    const fila = await this.prisma.notificacion.findFirst({ where: { id, usuarioId, rol }, select: { leidaEn: true } });
    if (!fila) return false;
    if (!fila.leidaEn) await this.prisma.notificacion.updateMany({ where: { id, leidaEn: null }, data: { leidaEn: ahora } });
    return true;
  }

  async marcarTodasLeidas({ usuarioId, rol }: Destinatario, ahora: Date): Promise<number> {
    const { count } = await this.prisma.notificacion.updateMany({ where: { usuarioId, rol, leidaEn: null }, data: { leidaEn: ahora } });
    return count;
  }

  async limpiar(antesDe: Date): Promise<number> {
    const { count } = await this.prisma.notificacion.deleteMany({
      where: { actualizadaEn: { lt: antesDe }, OR: [{ clase: "evento" }, { resueltaEn: { not: null } }] },
    });
    return count;
  }
}
```

- [ ] **Step 7: Reemplazar `notificacion.service.ts`**

```ts
import { randomUUID } from "node:crypto";
import { alConfirmar } from "../../core/alConfirmar";
import { EntityNotFoundError, ValidationError } from "../../core/errors";
import type { CanalEnVivo, UnitOfWork } from "../../core/ports";
import type { CriteriosDeAvisos } from "./notificacion.criterios";
import type {
  AvisoEsperado,
  Destinatario,
  Notificacion,
  RecursoAviso,
  TipoEstado,
  TipoNotificacion,
  TonoNotificacion,
} from "./notificacion.entity";
import { reconciliar } from "./notificacion.reconciliar";
import type { FiltroHistorial, NotificacionRepository } from "./notificacion.repository";
import { TIPOS, TIPOS_ESTADO, tiposDelRol } from "./notificacion.tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_CAMPANA = 10;
const POR_PAGINA = 50;
const DIAS_DE_HISTORIAL = 30;

export interface AvisoVista {
  id: string;
  tipo: TipoNotificacion;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  leida: boolean;
  resuelta: boolean;
  fecha: Date;
}

export interface Preferencia {
  tipo: TipoNotificacion;
  etiqueta: string;
  activa: boolean;
}

const llaveDe = (d: Destinatario) => `${d.usuarioId}|${d.rol}`;
const aVista = (n: Notificacion): AvisoVista => ({
  id: n.id,
  tipo: n.tipo,
  tono: n.tono,
  texto: n.texto,
  recurso: n.recurso,
  leida: n.leidaEn !== null,
  resuelta: n.resueltaEn !== null,
  fecha: n.actualizadaEn,
});

// Avisos guardados por cuenta y rol. Los de estado se sincronizan por tipo completo con su criterio
// (notificacion.criterios); los de evento se crean una vez. Todo se escribe dentro de la transacción de quien lo pide,
// y la señal en tiempo real sale recién después de confirmarla.
export class NotificacionService {
  constructor(
    private readonly repo: NotificacionRepository,
    private readonly criterios: CriteriosDeAvisos,
    private readonly canal: CanalEnVivo,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // Cada tipo queda bloqueado hasta el final de la transacción: dos operaciones que sincronizan el mismo tipo a la vez
  // van de a una (si no, las dos crearían la misma fila y una fallaría por la clave única).
  async sincronizar(tipos: TipoEstado[], tx: unknown, ahora: Date = new Date()): Promise<void> {
    const orden = [...new Set(tipos)].sort();
    await this.repo.bloquearTipos(orden, tx);
    const afectados: Destinatario[] = [];
    for (const tipo of orden) {
      const apagados = new Set((await this.repo.findDesactivadas(tipo, tx)).map(llaveDe));
      const esperados = (await this.criterios.esperados(tipo, ahora, tx)).filter((e) => !apagados.has(llaveDe(e)));
      const cambios = reconciliar(await this.repo.findPorTipo(tipo, tx), esperados, ahora, randomUUID);
      await this.repo.crearVarias(cambios.crear, tx);
      for (const { id, datos } of cambios.actualizar) await this.repo.actualizarParcial(id, datos, tx);
      afectados.push(...cambios.afectados);
    }
    this.avisarAlConfirmar(afectados, tx);
  }

  async notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.notasPublicadas(evaluacionId, alumnoIds, tx), tx);
  }

  async cierrePublicado(notaCierreId: string, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.cierrePublicado(notaCierreId, tx), tx);
  }

  async observacionNueva(observacionId: string, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.observacionNueva(observacionId, tx), tx);
  }

  // Revisión completa (al arrancar y a las 03:00): una transacción por tipo, para no tener bloqueos largos.
  async sincronizarTodo(ahora: Date = new Date()): Promise<void> {
    for (const tipo of TIPOS_ESTADO) await this.unitOfWork.runInTransaction((tx) => this.sincronizar([tipo], tx, ahora));
  }

  // Cada 15 minutos: la asistencia pendiente depende de la hora (una clase que acaba de empezar).
  async sincronizarAsistencia(ahora: Date = new Date()): Promise<void> {
    await this.unitOfWork.runInTransaction((tx) => this.sincronizar(["asistencia_pendiente"], tx, ahora));
  }

  async limpiar(ahora: Date = new Date()): Promise<number> {
    return this.repo.limpiar(new Date(ahora.getTime() - DIAS_DE_HISTORIAL * DIA_MS));
  }

  async campana(d: Destinatario): Promise<{ noLeidas: number; avisos: AvisoVista[] }> {
    const [avisos, noLeidas] = await Promise.all([this.repo.campana(d, MAX_CAMPANA), this.repo.contarNoLeidas(d)]);
    return { noLeidas, avisos: avisos.map(aVista) };
  }

  async historial(
    d: Destinatario,
    filtro: FiltroHistorial,
    despuesDe?: string,
    ahora: Date = new Date(),
  ): Promise<{ avisos: AvisoVista[]; siguiente: string | null }> {
    const desde = new Date(ahora.getTime() - DIAS_DE_HISTORIAL * DIA_MS);
    const avisos = await this.repo.historial(d, { desde, filtro, despuesDe, limite: POR_PAGINA });
    return { avisos: avisos.map(aVista), siguiente: avisos.length === POR_PAGINA ? avisos[avisos.length - 1].id : null };
  }

  async marcarLeida(d: Destinatario, id: string, ahora: Date = new Date()): Promise<void> {
    if (!(await this.repo.marcarLeida(id, d, ahora))) throw new EntityNotFoundError("Notificacion", id);
    await this.avisar([d]);
  }

  async leerTodas(d: Destinatario, ahora: Date = new Date()): Promise<number> {
    const marcadas = await this.repo.marcarTodasLeidas(d, ahora);
    await this.avisar([d]);
    return marcadas;
  }

  async preferencias(d: Destinatario): Promise<Preferencia[]> {
    const apagados = new Set(await this.repo.findDesactivadasDe(d));
    return tiposDelRol(d.rol).map((tipo) => ({ tipo, etiqueta: TIPOS[tipo].etiqueta, activa: !apagados.has(tipo) }));
  }

  // Apagar borra los avisos de ese tipo; encender sincroniza en el momento, así vuelven los de estado vigentes.
  async cambiarPreferencia(d: Destinatario, tipo: TipoNotificacion, activa: boolean): Promise<void> {
    if (!tiposDelRol(d.rol).includes(tipo)) throw new ValidationError("Ese tipo de aviso no corresponde a tu rol");
    await this.unitOfWork.runInTransaction(async (tx) => {
      if (!activa) {
        await this.repo.desactivar(d, tipo, tx);
        this.avisarAlConfirmar([d], tx);
        return;
      }
      await this.repo.activar(d, tipo, tx);
      if (TIPOS[tipo].clase === "estado") await this.sincronizar([tipo as TipoEstado], tx);
    });
  }

  // Avisos de evento: uno por clave (si ya existe se ignora), salvo para quien apagó ese tipo.
  private async registrarEventos(esperados: AvisoEsperado[], tx: unknown, ahora: Date = new Date()): Promise<void> {
    if (esperados.length === 0) return;
    const apagados = new Set<string>();
    for (const tipo of new Set(esperados.map((e) => e.tipo))) {
      for (const d of await this.repo.findDesactivadas(tipo, tx)) apagados.add(`${llaveDe(d)}|${tipo}`);
    }
    const nuevos: Notificacion[] = esperados
      .filter((e) => !apagados.has(`${llaveDe(e)}|${e.tipo}`))
      .map((e) => ({ ...e, id: randomUUID(), clase: "evento", creadaEn: ahora, actualizadaEn: ahora, leidaEn: null, resueltaEn: null }));
    this.avisarAlConfirmar(await this.repo.crearEventos(nuevos, tx), tx);
  }

  private avisarAlConfirmar(destinatarios: Destinatario[], tx: unknown): void {
    if (destinatarios.length > 0) alConfirmar(tx, () => this.avisar(destinatarios));
  }

  // Señal "tu campana cambió" a las conexiones abiertas de esa cuenta con ese rol: solo el número de no leídos.
  private async avisar(destinatarios: Destinatario[]): Promise<void> {
    const unicos = new Map(destinatarios.map((d) => [llaveDe(d), d]));
    for (const d of unicos.values()) {
      if (!this.canal.conectado(d.usuarioId, d.rol)) continue;
      this.canal.enviarA(d.usuarioId, d.rol, { tipo: "notificaciones", datos: { noLeidas: await this.repo.contarNoLeidas(d) } });
    }
  }
}
```

- [ ] **Step 8: Schema, controller y rutas**

`notificacion.schema.ts`:

```ts
import { z } from "zod";

export const tipoNotificacionSchema = z.enum([
  "cuotas_vencidas",
  "documentacion_pendiente",
  "evaluacion_proxima",
  "asistencia_pendiente",
  "notas_sin_publicar",
  "cierre_sin_publicar",
  "cuota",
  "documentacion_hijo",
  "nota_publicada",
  "cierre_publicado",
  "observacion_nueva",
]);

export const historialSchema = z.object({
  filtro: z.enum(["todas", "no-leidas", "pendientes"]).default("todas"),
  despuesDe: z.string().min(1).optional(),
});

export const preferenciaSchema = z.object({ activa: z.boolean() });
```

Reemplazar `notificacion.controller.ts`:

```ts
import type { Request, Response } from "express";
import type { Destinatario } from "./notificacion.entity";
import { historialSchema, preferenciaSchema, tipoNotificacionSchema } from "./notificacion.schema";
import type { NotificacionService } from "./notificacion.service";

// Cada pedido trabaja solo con los avisos de la cuenta y el rol de la sesión.
const destinatario = (req: Request): Destinatario => ({ usuarioId: req.auth!.sub, rol: req.auth!.rol });

export class NotificacionController {
  constructor(private readonly notificacionService: NotificacionService) {}

  campana = async (req: Request, res: Response) => {
    res.status(200).json(await this.notificacionService.campana(destinatario(req)));
  };

  historial = async (req: Request, res: Response) => {
    const { filtro, despuesDe } = historialSchema.parse(req.query);
    res.status(200).json(await this.notificacionService.historial(destinatario(req), filtro, despuesDe));
  };

  marcarLeida = async (req: Request, res: Response) => {
    await this.notificacionService.marcarLeida(destinatario(req), String(req.params.id));
    res.status(204).end();
  };

  leerTodas = async (req: Request, res: Response) => {
    res.status(200).json({ marcadas: await this.notificacionService.leerTodas(destinatario(req)) });
  };

  preferencias = async (req: Request, res: Response) => {
    res.status(200).json(await this.notificacionService.preferencias(destinatario(req)));
  };

  cambiarPreferencia = async (req: Request, res: Response) => {
    const tipo = tipoNotificacionSchema.parse(req.params.tipo);
    const { activa } = preferenciaSchema.parse(req.body);
    await this.notificacionService.cambiarPreferencia(destinatario(req), tipo, activa);
    res.status(204).end();
  };
}
```

Reemplazar `notificacion.routes.ts`:

```ts
import { Router } from "express";
import { authMiddleware } from "../../core/middlewares/authMiddleware";
import type { NotificacionController } from "./notificacion.controller";

// Todos los roles autenticados; cada uno trabaja solo con sus avisos (cuenta + rol de la sesión).
export function notificacionRoutes(controller: NotificacionController): Router {
  const router = Router();
  router.get("/", authMiddleware, controller.campana);
  router.get("/historial", authMiddleware, controller.historial);
  router.post("/leer-todas", authMiddleware, controller.leerTodas);
  router.post("/:id/leida", authMiddleware, controller.marcarLeida);
  router.get("/preferencias", authMiddleware, controller.preferencias);
  router.patch("/preferencias/:tipo", authMiddleware, controller.cambiarPreferencia);
  return router;
}
```

- [ ] **Step 9: Armar todo en `container.ts`**

- Imports nuevos: `CanalEnMemoria` (`./core/adapters/CanalEnMemoria`), `PrismaNotificacionRepository`, `PrismaCriteriosDeAvisos`.
- Reemplazar `configurarValidadorDeSesion(crearValidadorDeSesion(sesionRepository));` por:
  ```ts
  // El mismo validador sirve a authMiddleware y al canal en vivo (que vuelve a validar las conexiones abiertas).
  const validadorDeSesion = crearValidadorDeSesion(sesionRepository);
  configurarValidadorDeSesion(validadorDeSesion);
  const canalEnVivo = new CanalEnMemoria(validadorDeSesion);
  ```
- Reemplazar `const notificacionService = new NotificacionService(prisma);` por:
  ```ts
  const notificacionService = new NotificacionService(
    new PrismaNotificacionRepository(prisma),
    new PrismaCriteriosDeAvisos(prisma, documentoRepository),
    canalEnVivo,
    unitOfWork,
  );
  ```
- En el objeto `container`:
  - el controller pasa a ser `notificacionController: new NotificacionController(notificacionService)`;
  - sumar `canalEnVivo` y `validadorDeSesion`, con el comentario "Expuestos para la ruta en vivo (ver server.ts)";
  - el comentario de `notificacionService` pasa a "Expuesto para las tareas periódicas de avisos y para verificar con fechas fijas".

- [ ] **Step 10: Acción `sincronizar` en el mundo de prueba y borrar el script viejo**

En `server/scripts/_mundo-avisos.ts`, reemplazar el bloque `if (require.main === module) { … }` por:

```ts
// Desde la consola: tsx scripts/_mundo-avisos.ts crear|borrar|sincronizar (para las pruebas de la API y del navegador).
if (require.main === module) {
  const prisma = new PrismaClient();
  const accion = process.argv[2];
  const tarea =
    accion === "crear"
      ? crearMundo(prisma)
      : accion === "sincronizar"
        ? import("../src/container").then(({ container }) => container.notificacionService.sincronizarTodo())
        : limpiarMundo(prisma);
  tarea
    .then(() => console.log(`mundo de prueba: ${accion}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    // El container deja su propia conexión a la base abierta: se sale explícitamente.
    .finally(async () => {
      await prisma.$disconnect();
      process.exit();
    });
}
```

`rm server/scripts/_verificar-notificaciones.ts` (probaba el servicio viejo; el archivo no está en git).

- [ ] **Step 11: Correr las pruebas**

```bash
cd server && pnpm typecheck
pnpm exec tsx scripts/_canal.ts 2>&1 | python3 $SCRATCH/chequear.py
pnpm exec tsx scripts/_avisos-servicio.ts 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/avisos-api.sh | python3 $SCRATCH/chequear.py
```
Expected: typecheck limpio; `14 bien, 0 mal`; `43 bien, 0 mal`; `17 bien, 0 mal`.

- [ ] **Step 12: Commit**

```bash
git add server/src/core/ports.ts server/src/core/adapters/CanalEnMemoria.ts server/src/modules/notificaciones server/src/container.ts
git commit -m "Servicio de avisos guardados, canal en memoria y API de la campana, el historial y las preferencias

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Los módulos anuncian lo que pasa y los avisos se suscriben

**Files:**
- Create:
  - los catálogos de anuncios: `server/src/modules/cuotas/cuota.eventos.ts`, `calificaciones/calificacion.eventos.ts`, `asistencia/asistencia.eventos.ts`, `observaciones/observacion.eventos.ts`, `documentos/documento.eventos.ts`, `alumnos/alumno.eventos.ts`, `cursos/curso.eventos.ts`, `ciclos/ciclo.eventos.ts`, `usuarios/usuario.eventos.ts`;
  - `server/src/eventos.ts`;
  - `server/src/modules/notificaciones/notificacion.suscripciones.ts`, `notificacion.scheduler.ts`.
- Modify:
  - los services de cuotas, calificaciones, asistencia, observaciones, documentos, alumnos, cursos, ciclos, `usuarios/usuario.service.ts`, `usuarios/invitacion.service.ts`, `padres/padre.service.ts` y `profesores/profesor.service.ts`;
  - `server/src/core/tareaDiaria.ts`, `server/src/container.ts`, `server/src/server.ts`.
- Test: `server/scripts/_suscripciones.ts`, `$SCRATCH/anuncios.sh`

**Interfaces:**
- Consumes: `Publicador`, `TableroDeAnuncios`, `sinAnuncios` (Task 1); `NotificacionService.sincronizar / notasPublicadas / cierrePublicado / observacionNueva / sincronizarTodo / sincronizarAsistencia / limpiar` (Task 5).
- Produces (anuncios):
  - `"cuotas.cambiaron": { motivo: "pago" | "vencimiento" | "generacion" }`;
  - `"evaluacion.creada"` y `"evaluacion.publicada"`: `{ evaluacionId }`;
  - `"calificaciones.cargadas": { evaluacionId; alumnoIds: string[] }`;
  - `"cierre.cargado"` y `"cierre.publicado"`: `{ notaCierreId }`;
  - `"asistencia.registrada": { cursoId }`, `"observacion.creada": { observacionId }`;
  - `"documentos.cambiaron"` y `"alumnos.cambiaron"`: `{ alumnoId }`;
  - `"cursos.cambiaron": { cursoId }`, `"ciclo.activado": { cicloId }`;
  - `"cuenta.cambio": { usuarioId }` y `"sesiones.cerradas": { usuarioId; motivo: MotivoCierre }` (este último lo publica la Task 7).
- Produces: `type EventosDelSistema` (`src/eventos.ts`), `suscribirAvisos(tablero, avisos)`, `iniciarAvisosPeriodicos(avisos)`, `programarTareaPeriodica(nombre, cadaMs, tarea)`.
- Cada service nuevo o modificado recibe `anuncios: Publicador<EventosDeSuModulo> = sinAnuncios()` como **último** parámetro del constructor. `DocumentoService` y `ObservacionService` además reciben `unitOfWork: UnitOfWork` antes de `anuncios`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_suscripciones.ts` (qué revisa cada anuncio, con un servicio de avisos falso):

```ts
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import type { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { suscribirAvisos } from "../src/modules/notificaciones/notificacion.suscripciones";
import { ok } from "./_check";

const llamadas: string[] = [];
const falso = {
  sincronizar: async (tipos: string[]) => void llamadas.push(`sync ${[...tipos].sort().join(",")}`),
  notasPublicadas: async (id: string, alumnos: string[] | null) => void llamadas.push(`notas ${id} ${alumnos?.join("+") ?? "todas"}`),
  cierrePublicado: async (id: string) => void llamadas.push(`cierre ${id}`),
  observacionNueva: async (id: string) => void llamadas.push(`observacion ${id}`),
} as unknown as NotificacionService;
const tablero = new TableroDeAnuncios<EventosDelSistema>();
suscribirAvisos(tablero, falso);
const TODOS = "sync asistencia_pendiente,cierre_sin_publicar,cuota,cuotas_vencidas,documentacion_hijo,documentacion_pendiente,evaluacion_proxima,notas_sin_publicar";

const prueba = async <K extends keyof EventosDelSistema & string>(nombre: K, datos: EventosDelSistema[K], esperado: string) => {
  llamadas.length = 0;
  await tablero.publicar(nombre, datos);
  ok(nombre, llamadas.join(" / "), esperado);
};

(async () => {
  await prueba("cuotas.cambiaron", { motivo: "pago" }, "sync cuota,cuotas_vencidas");
  await prueba("alumnos.cambiaron", { alumnoId: "a1" }, "sync cuota,cuotas_vencidas,documentacion_hijo,documentacion_pendiente");
  await prueba("documentos.cambiaron", { alumnoId: "a1" }, "sync documentacion_hijo,documentacion_pendiente");
  await prueba("asistencia.registrada", { cursoId: "c1" }, "sync asistencia_pendiente");
  await prueba("cursos.cambiaron", { cursoId: "c1" }, "sync asistencia_pendiente,cierre_sin_publicar,evaluacion_proxima,notas_sin_publicar");
  await prueba("ciclo.activado", { cicloId: "x" }, TODOS);
  await prueba("cuenta.cambio", { usuarioId: "u1" }, TODOS);
  await prueba("evaluacion.creada", { evaluacionId: "e1" }, "sync evaluacion_proxima");
  await prueba("evaluacion.publicada", { evaluacionId: "e1" }, "sync notas_sin_publicar / notas e1 todas");
  await prueba("calificaciones.cargadas", { evaluacionId: "e1", alumnoIds: ["a1", "a2"] }, "sync notas_sin_publicar / notas e1 a1+a2");
  await prueba("cierre.cargado", { notaCierreId: "n1" }, "sync cierre_sin_publicar");
  await prueba("cierre.publicado", { notaCierreId: "n1" }, "sync cierre_sin_publicar / cierre n1");
  await prueba("observacion.creada", { observacionId: "o1" }, "observacion o1");
  await prueba("sesiones.cerradas", { usuarioId: "u1", motivo: "vencida" }, "");
})();
```

`$SCRATCH/anuncios.sh` (de punta a punta, contra la API real):

```bash
source $SCRATCH/lib.sh
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
M="pnpm exec tsx scripts/_mundo-avisos.ts"
$M crear >/dev/null && $M sincronizar >/dev/null
A=$(login prueba-tmp-av-admin@prueba.babylon.test prueba1234)
PR=$(login prueba-tmp-av-profe@prueba.babylon.test prueba1234)
PA=$(login prueba-tmp-av-padre@prueba.babylon.test prueba1234)
avisos() { http GET /api/notificaciones "$1" | js "$2"; }
H1=prueba-tmp-av-hijo1; H2=prueba-tmp-av-hijo2; CURSO=prueba-tmp-av-curso

# Evaluación: creada → próxima para administración; notas → aviso al profe; publicada → nota al padre
E=$(http POST /api/calificaciones/evaluaciones $PR "{\"cursoId\":\"$CURSO\",\"nombre\":\"Unit Av\",\"tipo\":\"examen\",\"fecha\":\"$(date -d '+3 day' +%F)\",\"periodo\":\"noviembre\",\"escala\":\"numerica\"}" | js d.id)
ok "evaluación creada: próxima para administración" "$(avisos $A "d.avisos.some(a=>a.recurso.evaluacionId==='$E')")" true
ok "cargar notas" "$(code POST /api/calificaciones/evaluaciones/$E/calificaciones $PR "{\"notas\":[{\"alumnoId\":\"$H1\",\"nota\":\"8\"}]}")" 201
ok "notas sin publicar: aviso al profe" "$(avisos $PR "d.avisos.some(a=>a.tipo==='notas_sin_publicar'&&a.recurso.evaluacionId==='$E')")" true
ok "en borrador el padre no se entera" "$(avisos $PA "d.avisos.some(a=>a.tipo==='nota_publicada')")" false
ok "publicar" "$(code PATCH /api/calificaciones/evaluaciones/$E/publicar $PR)" 200
ok "publicada: se resuelve el aviso del profe" "$(avisos $PR "d.avisos.some(a=>a.tipo==='notas_sin_publicar'&&a.recurso.evaluacionId==='$E')")" false
ok "publicada: al padre le llega la nota" "$(avisos $PA "d.avisos.filter(a=>a.tipo==='nota_publicada').map(a=>a.texto).join()")" "Nueva nota de Tomasav: Unit Av"
http POST /api/calificaciones/evaluaciones/$E/calificaciones $PR "{\"notas\":[{\"alumnoId\":\"$H2\",\"nota\":\"6\"}]}" >/dev/null
ok "nota cargada después de publicar también avisa" "$(avisos $PA "d.avisos.filter(a=>a.tipo==='nota_publicada').length")" 2

# Observación
ok "observación" "$(code POST /api/observaciones $PR "{\"alumnoId\":\"$H1\",\"texto\":\"Muy bien\",\"categoria\":\"felicitacion\"}")" 201
ok "observación: aviso al padre" "$(avisos $PA "d.avisos.some(a=>a.tipo==='observacion_nueva')")" true

# Asistencia (de hoy): queda registrada y no hay aviso pendiente para hoy
ok "asistencia" "$(code POST /api/asistencia/masiva $PR "{\"cursoId\":\"$CURSO\",\"fecha\":\"$(date +%F)\",\"registros\":[{\"alumnoId\":\"$H1\",\"estado\":\"presente\"},{\"alumnoId\":\"$H2\",\"estado\":\"presente\"}]}")" 201
ok "asistencia: nada pendiente para hoy" "$(avisos $PR "d.avisos.some(a=>a.tipo==='asistencia_pendiente'&&a.recurso.fecha==='$(date +%F)')")" false

# Documentación completa del hijo 2
for t in formulario_inscripcion copia_dni; do http PATCH /api/documentos/alumnos/$H2/cargar $A "{\"tipo\":\"$t\"}" >/dev/null; done
ok "autorización manual" "$(code PATCH /api/documentos/alumnos/$H2/autorizacion-imagen/manual $A)" 200
ok "documentación completa: se resuelve el aviso del padre" "$(avisos $PA "d.avisos.some(a=>a.tipo==='documentacion_hijo'&&a.recurso.alumnoId==='$H2')")" false
ESPERADO=$(http GET /api/documentos/faltantes $A | js 'Object.keys(d).length===0?"ninguno":`Hay ${Object.keys(d).length} ${Object.keys(d).length===1?"alumno":"alumnos"} con documentación pendiente`')
ok "el agrupado de administración coincide con la lista" "$(avisos $A "d.avisos.find(a=>a.tipo==='documentacion_pendiente')?.texto??'ninguno'")" "$ESPERADO"

# Cuotas: un lote que falla no deja nada; el pago resuelve el aviso
q "insert into \"Cuota\"(id,\"alumnoId\",mes,anio,\"montoBase\",descuento,\"montoFinal\",vencimiento,estado) values ('prueba-tmp-av-c1','$H1',9,2026,1000,0,1000,'2026-09-10','vencida'),('prueba-tmp-av-c2','$H1',8,2026,1000,0,1000,'2026-08-10','pagada')" >/dev/null
$M sincronizar >/dev/null
ok "cuota vencida avisada" "$(avisos $PA "d.avisos.some(a=>a.recurso.cuotaId==='prueba-tmp-av-c1')")" true
ok "lote con una cuota ya pagada" "$(code POST /api/cuotas/pagos $A '{"cuotaIds":["prueba-tmp-av-c1","prueba-tmp-av-c2"],"metodo":"efectivo"}')" 409
ok "el lote no dejó ningún pago" "$(q "select count(*) from \"Pago\" where \"cuotaId\"='prueba-tmp-av-c1'")" 0
ok "el aviso sigue abierto" "$(avisos $PA "d.avisos.some(a=>a.recurso.cuotaId==='prueba-tmp-av-c1')")" true
ok "pagar" "$(code POST /api/cuotas/pagos $A '{"cuotaIds":["prueba-tmp-av-c1"],"metodo":"efectivo"}')" 201
ok "pagada: el aviso del padre se resuelve" "$(avisos $PA "d.avisos.some(a=>a.recurso.cuotaId==='prueba-tmp-av-c1')")" false

# Inscripción: el hijo nuevo debe documentación
N=$(http POST /api/alumnos $A "{\"nombre\":\"Nuevoav\",\"apellido\":\"Pruebaav\",\"dni\":\"99400099\",\"fechaNacimiento\":\"2016-05-05\",\"padreId\":\"prueba-tmp-av-padre\",\"cursoId\":\"$CURSO\"}" | js d.id)
ok "inscripción: aviso de documentación del hijo nuevo" "$(avisos $PA "d.avisos.some(a=>a.tipo==='documentacion_hijo'&&a.recurso.alumnoId==='$N')")" true

# Cuenta desactivada y reactivada
ok "desactivar al padre" "$(code PATCH /api/auth/usuarios/prueba-tmp-av-padre/estado $A '{"estado":"inactivo"}')" 200
ok "desactivada: sin avisos abiertos" "$(q "select count(*) from \"Notificacion\" where \"usuarioId\"='prueba-tmp-av-padre' and clase='estado' and \"resueltaEn\" is null")" 0
ok "reactivar al padre" "$(code PATCH /api/auth/usuarios/prueba-tmp-av-padre/estado $A '{"estado":"activo"}')" 200
ok "reactivada: vuelven los avisos" "$(q "select count(*)>0 from \"Notificacion\" where \"usuarioId\"='prueba-tmp-av-padre' and clase='estado' and \"resueltaEn\" is null")" t

$M borrar >/dev/null && $M sincronizar >/dev/null
ok "limpieza" "$(q "select count(*) from \"Alumno\" where dni='99400099'")" 0
```

- [ ] **Step 2: Ver que fallan**

Run: `cd server && pnpm exec tsx scripts/_suscripciones.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no existen `src/eventos` ni `notificacion.suscripciones`).

- [ ] **Step 3: Que el mundo de prueba borre también los alumnos inscriptos por la API**

En `server/scripts/_mundo-avisos.ts`, al principio de `limpiarMundo`, reemplazar la línea `const deAlumnos = { alumnoId: { startsWith: P } };` por:

```ts
  // Los alumnos inscriptos por la API en las pruebas tienen un id al azar: se buscan también por su padre de prueba.
  const alumnoIds = (
    await prisma.alumno.findMany({ where: { OR: [{ id: { startsWith: P } }, { padreId: { startsWith: P } }] }, select: { id: true } })
  ).map((a) => a.id);
  const deAlumnos = { alumnoId: { in: alumnoIds } };
```

y la línea `await prisma.alumno.deleteMany({ where: { id: { startsWith: P } } });` por `await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } });`.

- [ ] **Step 4: Los catálogos de anuncios**

Un archivo por módulo, solo con tipos:

```ts
// cuotas/cuota.eventos.ts
export interface EventosCuotas {
  "cuotas.cambiaron": { motivo: "pago" | "vencimiento" | "generacion" };
}
```

```ts
// calificaciones/calificacion.eventos.ts
export interface EventosCalificaciones {
  "evaluacion.creada": { evaluacionId: string };
  "evaluacion.publicada": { evaluacionId: string };
  "calificaciones.cargadas": { evaluacionId: string; alumnoIds: string[] };
  "cierre.cargado": { notaCierreId: string };
  "cierre.publicado": { notaCierreId: string };
}
```

```ts
// asistencia/asistencia.eventos.ts
export interface EventosAsistencia {
  "asistencia.registrada": { cursoId: string };
}
```

```ts
// observaciones/observacion.eventos.ts
export interface EventosObservaciones {
  "observacion.creada": { observacionId: string };
}
```

```ts
// documentos/documento.eventos.ts
export interface EventosDocumentos {
  "documentos.cambiaron": { alumnoId: string };
}
```

```ts
// alumnos/alumno.eventos.ts
export interface EventosAlumnos {
  "alumnos.cambiaron": { alumnoId: string };
}
```

```ts
// cursos/curso.eventos.ts
export interface EventosCursos {
  "cursos.cambiaron": { cursoId: string };
}
```

```ts
// ciclos/ciclo.eventos.ts
export interface EventosCiclos {
  "ciclo.activado": { cicloId: string };
}
```

```ts
// usuarios/usuario.eventos.ts
import type { MotivoCierre } from "../../core/ports";

export interface EventosUsuarios {
  // La cuenta se activó, se reactivó o se desactivó: cambian los avisos que le corresponden.
  "cuenta.cambio": { usuarioId: string };
  // Se cerraron sesiones de la cuenta: se cortan al instante las conexiones en vivo que ya no valen.
  "sesiones.cerradas": { usuarioId: string; motivo: MotivoCierre };
}
```

`server/src/eventos.ts`:

```ts
import type { EventosAlumnos } from "./modules/alumnos/alumno.eventos";
import type { EventosAsistencia } from "./modules/asistencia/asistencia.eventos";
import type { EventosCalificaciones } from "./modules/calificaciones/calificacion.eventos";
import type { EventosCiclos } from "./modules/ciclos/ciclo.eventos";
import type { EventosCuotas } from "./modules/cuotas/cuota.eventos";
import type { EventosCursos } from "./modules/cursos/curso.eventos";
import type { EventosDocumentos } from "./modules/documentos/documento.eventos";
import type { EventosObservaciones } from "./modules/observaciones/observacion.eventos";
import type { EventosUsuarios } from "./modules/usuarios/usuario.eventos";

// Catálogo de todos los anuncios del sistema (solo tipos, al lado de container.ts, que arma el tablero con este mapa).
export type EventosDelSistema = EventosAlumnos &
  EventosAsistencia &
  EventosCalificaciones &
  EventosCiclos &
  EventosCuotas &
  EventosCursos &
  EventosDocumentos &
  EventosObservaciones &
  EventosUsuarios;
```

- [ ] **Step 5: Las suscripciones de los avisos**

`server/src/modules/notificaciones/notificacion.suscripciones.ts`:

```ts
import type { TableroDeAnuncios } from "../../core/eventos";
import type { EventosDelSistema } from "../../eventos";
import type { TipoEstado } from "./notificacion.entity";
import type { NotificacionService } from "./notificacion.service";
import { TIPOS_ESTADO } from "./notificacion.tipos";

// Qué avisos revisa cada anuncio. Todo corre dentro de la transacción de la operación: si guardar los avisos falla, la
// operación entera se deshace (y no sale ninguna señal).
export function suscribirAvisos(tablero: TableroDeAnuncios<EventosDelSistema>, avisos: NotificacionService): void {
  const sincronizar = (tipos: TipoEstado[]) => (_datos: unknown, tx: unknown) => avisos.sincronizar(tipos, tx);

  tablero.alPublicarse("cuotas.cambiaron", sincronizar(["cuota", "cuotas_vencidas"]));
  tablero.alPublicarse("alumnos.cambiaron", sincronizar(["cuota", "cuotas_vencidas", "documentacion_hijo", "documentacion_pendiente"]));
  tablero.alPublicarse("documentos.cambiaron", sincronizar(["documentacion_hijo", "documentacion_pendiente"]));
  tablero.alPublicarse("asistencia.registrada", sincronizar(["asistencia_pendiente"]));
  tablero.alPublicarse("cursos.cambiaron", sincronizar(["asistencia_pendiente", "evaluacion_proxima", "notas_sin_publicar", "cierre_sin_publicar"]));
  tablero.alPublicarse("ciclo.activado", sincronizar(TIPOS_ESTADO));
  tablero.alPublicarse("cuenta.cambio", sincronizar(TIPOS_ESTADO));
  tablero.alPublicarse("evaluacion.creada", sincronizar(["evaluacion_proxima"]));
  tablero.alPublicarse("evaluacion.publicada", async ({ evaluacionId }, tx) => {
    await avisos.sincronizar(["notas_sin_publicar"], tx);
    await avisos.notasPublicadas(evaluacionId, null, tx);
  });
  tablero.alPublicarse("calificaciones.cargadas", async ({ evaluacionId, alumnoIds }, tx) => {
    await avisos.sincronizar(["notas_sin_publicar"], tx);
    // Notas cargadas en una evaluación ya publicada: el padre también se entera (en borrador no se crea nada).
    await avisos.notasPublicadas(evaluacionId, alumnoIds, tx);
  });
  tablero.alPublicarse("cierre.cargado", sincronizar(["cierre_sin_publicar"]));
  tablero.alPublicarse("cierre.publicado", async ({ notaCierreId }, tx) => {
    await avisos.sincronizar(["cierre_sin_publicar"], tx);
    await avisos.cierrePublicado(notaCierreId, tx);
  });
  tablero.alPublicarse("observacion.creada", ({ observacionId }, tx) => avisos.observacionNueva(observacionId, tx));
}
```

- [ ] **Step 6: Cuotas anuncian**

En `cuotas/cuota.service.ts`:
- Imports: `import { sinAnuncios } from "../../core/eventos";`; cambiar `import type { Rol, UnitOfWork }` por `import type { Publicador, Rol, UnitOfWork }`; `import type { EventosCuotas } from "./cuota.eventos";`.
- Constructor: agregar como último parámetro `private readonly anuncios: Publicador<EventosCuotas> = sinAnuncios(),`.
- `registrarPago`: dentro de la transacción, justo antes de `return pagosRegistrados;`:
  ```ts
        await this.anuncios.publicar("cuotas.cambiaron", { motivo: "pago" }, tx);
  ```
- `generarCuotasDelMes`: antes de `return creadas;`:
  ```ts
        if (creadas > 0) await this.anuncios.publicar("cuotas.cambiaron", { motivo: "generacion" }, tx);
  ```
- Reemplazar `marcarVencidas`:
  ```ts
    // Pasa a "vencida" las cuotas pendientes cuyo vencimiento ya pasó.
    async marcarVencidas(hoy: Date = new Date()): Promise<number> {
      return this.unitOfWork.runInTransaction(async (tx) => {
        const vencidas = await this.cuotaRepo.marcarVencidas(inicioDeHoyUtc(hoy), tx);
        if (vencidas > 0) await this.anuncios.publicar("cuotas.cambiaron", { motivo: "vencimiento" }, tx);
        return vencidas;
      });
    }
  ```
  (`generarCuotaInicial` no anuncia: corre dentro de la inscripción, que anuncia `alumnos.cambiaron`.)

- [ ] **Step 7: Calificaciones anuncian**

En `calificaciones/calificacion.service.ts`:
- Imports: `sinAnuncios`; `Publicador` junto a `Rol, UnitOfWork`; `import type { EventosCalificaciones } from "./calificacion.eventos";`.
- Constructor: agregar `private readonly anuncios: Publicador<EventosCalificaciones> = sinAnuncios(),` al final.
- `crearEvaluacion`: reemplazar `return this.calificacionRepo.crearEvaluacion(evaluacion);` por
  ```ts
      return this.unitOfWork.runInTransaction(async (tx) => {
        const creada = await this.calificacionRepo.crearEvaluacion(evaluacion, tx);
        await this.anuncios.publicar("evaluacion.creada", { evaluacionId: creada.id }, tx);
        return creada;
      });
  ```
- `publicarEvaluacion`: reemplazar el `return this.calificacionRepo.actualizarEvaluacion(evaluacionId, { … });` por
  ```ts
      return this.unitOfWork.runInTransaction(async (tx) => {
        const publicada = await this.calificacionRepo.actualizarEvaluacion(
          evaluacionId,
          { ...evaluacion, estado: "publicada", publicadaEn: evaluacion.publicadaEn ?? new Date() },
          tx,
        );
        await this.anuncios.publicar("evaluacion.publicada", { evaluacionId }, tx);
        return publicada;
      });
  ```
- `cargarCalificaciones`: dentro de la transacción, antes de `return calificaciones;`:
  ```ts
        await this.anuncios.publicar("calificaciones.cargadas", { evaluacionId, alumnoIds: datos.notas.map((n) => n.alumnoId) }, tx);
  ```
- `cargarNotaCierre`: reemplazar `return this.calificacionRepo.guardarNotaCierre(notaCierre);` por
  ```ts
      return this.unitOfWork.runInTransaction(async (tx) => {
        const guardada = await this.calificacionRepo.guardarNotaCierre(notaCierre, tx);
        await this.anuncios.publicar("cierre.cargado", { notaCierreId: guardada.id }, tx);
        return guardada;
      });
  ```
- `publicarNotaCierre`: reemplazar el `return this.calificacionRepo.guardarNotaCierre({ … });` por
  ```ts
      return this.unitOfWork.runInTransaction(async (tx) => {
        const publicada = await this.calificacionRepo.guardarNotaCierre(
          { ...notaCierre, estado: "publicada", publicadaEn: notaCierre.publicadaEn ?? new Date() },
          tx,
        );
        await this.anuncios.publicar("cierre.publicado", { notaCierreId }, tx);
        return publicada;
      });
  ```

- [ ] **Step 8: Asistencia, observaciones y documentos anuncian**

`asistencia/asistencia.service.ts`:
- Imports: `sinAnuncios`, `Publicador`, `import type { EventosAsistencia } from "./asistencia.eventos";`.
- Constructor: `private readonly anuncios: Publicador<EventosAsistencia> = sinAnuncios(),` al final.
- En `registrarAsistenciaMasiva`, dentro de la transacción y antes de `return asistencias;`:
  ```ts
        await this.anuncios.publicar("asistencia.registrada", { cursoId: datos.cursoId }, tx);
  ```

`observaciones/observacion.service.ts`:
- Imports: `sinAnuncios`; `import type { Publicador, Rol, UnitOfWork } from "../../core/ports";`; `import type { EventosObservaciones } from "./observacion.eventos";`.
- Constructor: después de `usuarioRepo`, agregar
  ```ts
      private readonly unitOfWork: UnitOfWork,
      private readonly anuncios: Publicador<EventosObservaciones> = sinAnuncios(),
  ```
- En `crearObservacion`, reemplazar `return this.observacionRepo.create(observacion);` por
  ```ts
      return this.unitOfWork.runInTransaction(async (tx) => {
        const creada = await this.observacionRepo.create(observacion, tx);
        await this.anuncios.publicar("observacion.creada", { observacionId: creada.id }, tx);
        return creada;
      });
  ```

`documentos/documento.service.ts`:
- Imports: `sinAnuncios`; `import type { Publicador, UnitOfWork } from "../../core/ports";`; `import type { EventosDocumentos } from "./documento.eventos";`.
- Constructor:
  ```ts
    constructor(
      private readonly documentoRepo: DocumentoRepository,
      private readonly alumnoRepo: AlumnoRepository,
      private readonly unitOfWork: UnitOfWork,
      private readonly anuncios: Publicador<EventosDocumentos> = sinAnuncios(),
    ) {}

    // Toda escritura de un documento va en una transacción que anuncia el cambio (los avisos de documentación se
    // guardan junto con ella).
    private guardar(alumnoId: string, escribir: (tx: unknown) => Promise<Documento>): Promise<Documento> {
      return this.unitOfWork.runInTransaction(async (tx) => {
        const documento = await escribir(tx);
        await this.anuncios.publicar("documentos.cambiaron", { alumnoId }, tx);
        return documento;
      });
    }
  ```
- En `marcarCargado`, `autorizarImagen`, `marcarAutorizacionManual` y `revocarAutorizacion`, cada `return this.documentoRepo.update(X, Y);` pasa a `return this.guardar(ALUMNO, (tx) => this.documentoRepo.update(X, Y, tx));`, y cada `return this.documentoRepo.create(D);` pasa a `return this.guardar(ALUMNO, (tx) => this.documentoRepo.create(D, tx));`. `ALUMNO` es `alumnoId` en `marcarCargado`, `marcarAutorizacionManual` y `revocarAutorizacion`, y `datos.alumnoId` en `autorizarImagen`. Son 7 reemplazos en total: 2 por método salvo `revocarAutorizacion`, que tiene uno.

- [ ] **Step 9: Alumnos, cursos y ciclos anuncian**

`alumnos/alumno.service.ts`:
- Imports: `sinAnuncios`, `Publicador`, `import type { EventosAlumnos } from "./alumno.eventos";`.
- Constructor: `private readonly anuncios: Publicador<EventosAlumnos> = sinAnuncios(),` al final.
- `inscribirAlumno`: dentro de la transacción, antes de `return creado;`:
  ```ts
        await this.anuncios.publicar("alumnos.cambiaron", { alumnoId: creado.id }, tx);
  ```
- `actualizarAlumno`: dentro de la transacción, antes del `return` final (`return resultado;`):
  ```ts
        await this.anuncios.publicar("alumnos.cambiaron", { alumnoId: id }, tx);
  ```

`cursos/curso.service.ts`:
- Imports: `sinAnuncios`, `Publicador`, `import type { EventosCursos } from "./curso.eventos";`.
- Constructor: `private readonly anuncios: Publicador<EventosCursos> = sinAnuncios(),` al final.
- `crearCurso`: reemplazar desde `await this.cursoRepo.create(curso);` hasta el `return curso;` por
  ```ts
      // Atómico: el curso con sus horarios (antes podía quedar un curso sin horarios si fallaba a mitad de camino).
      return this.unitOfWork.runInTransaction(async (tx) => {
        await this.cursoRepo.create(curso, tx);
        for (const horario of datos.horarios) {
          await this.cursoRepo.agregarHorario({ id: randomUUID(), cursoId: curso.id, ...horario }, tx);
        }
        await this.anuncios.publicar("cursos.cambiaron", { cursoId: curso.id }, tx);
        return curso;
      });
  ```
- `actualizarCurso`: dentro de la transacción, antes de `return actualizado;`:
  ```ts
        await this.anuncios.publicar("cursos.cambiaron", { cursoId: id }, tx);
  ```

`ciclos/ciclo.service.ts`:
- Imports: `sinAnuncios`, `Publicador`, `import type { EventosCiclos } from "./ciclo.eventos";`.
- Constructor: `private readonly anuncios: Publicador<EventosCiclos> = sinAnuncios(),` al final.
- `marcarActivo`: reemplazar `return this.cicloRepo.update(id, { ...ciclo, activo: true }, tx);` por
  ```ts
        const activo = await this.cicloRepo.update(id, { ...ciclo, activo: true }, tx);
        await this.anuncios.publicar("ciclo.activado", { cicloId: id }, tx);
        return activo;
  ```

- [ ] **Step 10: Las cuentas anuncian sus cambios**

En los cuatro services de abajo: importar `sinAnuncios` y `Publicador`, importar `type EventosUsuarios` (desde `./usuario.eventos` en `usuarios/`, desde `../usuarios/usuario.eventos` en `padres/` y `profesores/`) y agregar al final del constructor `private readonly anuncios: Publicador<EventosUsuarios> = sinAnuncios(),`.

`usuarios/usuario.service.ts`:
- `crearUsuarioSimple`, rama con contraseña: reemplazar `await this.usuarioRepo.create(usuario);` por
  ```ts
      // Con contraseña la cuenta nace activa: ya le corresponden avisos.
      await this.unitOfWork.runInTransaction(async (tx) => {
        await this.usuarioRepo.create(usuario, tx);
        await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
      });
  ```
- `cambiarEstado`: dentro de la transacción, antes de `return resultado;`:
  ```ts
        await this.anuncios.publicar("cuenta.cambio", { usuarioId: id }, tx);
  ```

`usuarios/invitacion.service.ts`, `activarCuenta`: después de `await this.usuarioRepo.invalidarTokens(usuario.id, "invitacion", ahora, tx);`:

```ts
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
```

`padres/padre.service.ts`, `crearPadre`: reemplazar `return { padre: await this.padreRepo.create(padre, tx), cuenta };` por

```ts
      const creado = await this.padreRepo.create(padre, tx);
      // Con contraseña la cuenta nace activa: ya le corresponden avisos (con invitación, cuando la active).
      if (!cuenta) await this.anuncios.publicar("cuenta.cambio", { usuarioId }, tx);
      return { padre: creado, cuenta };
```

`profesores/profesor.service.ts`:
- `crearProfesor`: igual que en el padre, reemplazar `return { profesor: await this.profesorRepo.create(profesor, tx), cuenta };` por
  ```ts
      const creado = await this.profesorRepo.create(profesor, tx);
      if (!cuenta) await this.anuncios.publicar("cuenta.cambio", { usuarioId }, tx);
      return { profesor: creado, cuenta };
  ```
  Si la variable de la cuenta tiene otro nombre en ese método, usar el `id` del `Usuario` recién creado.
- `actualizarProfesor`, rama `else` (cuenta no pendiente): después de la línea que cierra las sesiones al desactivar:
  ```ts
            if (actualizado.estado !== profesor.estado) await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
  ```

- [ ] **Step 11: Tareas periódicas**

En `server/src/core/tareaDiaria.ts`, al final:

```ts
// Corre `tarea` cada `cadaMs`, sin correr al arrancar (la tarea diaria ya hace la revisión completa al levantar el
// servidor). Una corrida que falla se registra con su nombre y no impide las siguientes.
export function programarTareaPeriodica(nombre: string, cadaMs: number, tarea: () => Promise<void>): void {
  setInterval(() => {
    tarea().catch((error) => console.error(`[${nombre}] falló la tarea periódica:`, error));
  }, cadaMs).unref();
}
```

`server/src/modules/notificaciones/notificacion.scheduler.ts`:

```ts
import { programarTareaDiaria, programarTareaPeriodica } from "../../core/tareaDiaria";
import type { NotificacionService } from "./notificacion.service";

const QUINCE_MINUTOS = 15 * 60 * 1000;

// Red de seguridad de los avisos: al arrancar y a las 03:00, revisión completa de todos los tipos de estado (incluye lo
// que depende del calendario: cuotas por vencer, evaluaciones de la semana, asistencia de hace más de 7 días) y
// limpieza de los avisos de más de 30 días. Cada 15 minutos, la asistencia pendiente (una clase que acaba de empezar).
export function iniciarAvisosPeriodicos(avisos: NotificacionService): void {
  programarTareaDiaria("avisos", async () => {
    await avisos.sincronizarTodo();
    const borrados = await avisos.limpiar();
    if (borrados > 0) console.log(`[avisos] ${borrados} avisos de más de 30 días borrados`);
  });
  programarTareaPeriodica("asistencia-pendiente", QUINCE_MINUTOS, () => avisos.sincronizarAsistencia());
}
```

En `server/src/server.ts`: `import { iniciarAvisosPeriodicos } from "./modules/notificaciones/notificacion.scheduler";` y, dentro del callback de `app.listen`, después de `iniciarDepuracionDeSesiones(...)`: `iniciarAvisosPeriodicos(container.notificacionService);`.

- [ ] **Step 12: Conectar todo en `container.ts`**

- Imports: `import { TableroDeAnuncios } from "./core/eventos";`, `import type { EventosDelSistema } from "./eventos";`, `import { suscribirAvisos } from "./modules/notificaciones/notificacion.suscripciones";`.
- Después de `const unitOfWork = new PrismaUnitOfWork(prisma);`:
  ```ts
  // Tablero de anuncios entre módulos: los services publican lo que pasa y los avisos se suscriben (ver más abajo).
  const tablero = new TableroDeAnuncios<EventosDelSistema>();
  ```
- Pasar `tablero` como **último** argumento a: `InvitacionService`, `UsuarioService`, `CicloService`, `PadreService`, `ProfesorService`, `CuotaService`, `AlumnoService`, `CursoService`, `AsistenciaService` y `CalificacionService`.
- `DocumentoService` y `ObservacionService` reciben `unitOfWork, tablero` al final:
  - `new DocumentoService(documentoRepository, alumnoRepository, unitOfWork, tablero)`;
  - `new ObservacionService(observacionRepository, alumnoRepository, cursoRepository, usuarioRepository, unitOfWork, tablero)`.
- Después de crear `notificacionService`:
  ```ts
  suscribirAvisos(tablero, notificacionService);
  ```
- Buscar scripts que construyan `DocumentoService` u `ObservacionService` (`grep -ln "new DocumentoService\|new ObservacionService" server/scripts server/prisma`). Si hay alguno, agregarle `new PrismaUnitOfWork(prisma)` como tercer o quinto argumento, según corresponda.

- [ ] **Step 13: Correr las pruebas**

```bash
cd server && pnpm typecheck
pnpm exec tsx scripts/_suscripciones.ts 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/anuncios.sh | python3 $SCRATCH/chequear.py
grep -c "falló la tarea" $SCRATCH/server.log
```
Expected: typecheck limpio; `14 bien, 0 mal`; `27 bien, 0 mal`; `0` (la revisión de arranque corrió sin errores).

- [ ] **Step 14: Commit**

```bash
git add server/src
git commit -m "Los módulos anuncian lo que pasa y los avisos se guardan en la misma transacción; revisión nocturna y de asistencia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Conexión en vivo en el servidor y cierre de sesión al instante

**Files:**
- Create: `server/src/core/tiempoReal.ts`
- Modify: `server/src/core/middlewares/authMiddleware.ts`, `server/src/core/middlewares/limitesDePedidos.ts`, `server/src/server.ts`, `server/src/container.ts`, `server/src/modules/usuarios/usuario.service.ts`, `server/src/modules/profesores/profesor.service.ts`
- Test: `server/scripts/_tiempo-real.ts`

**Interfaces:**
- Consumes: `CanalEnVivo`, `MotivoCierre`, `SenalEnVivo`, `ValidadorDeSesion` (Task 5); el anuncio `"sesiones.cerradas"` (Task 6).
- Produces:
  - `AuthPayload.expiraEn: Date | null` (del `exp` del token);
  - `limiteTiempoReal` (10 por minuto por sesión);
  - `tiempoRealRoutes(canal, validar): Router`, montado en `GET /api/tiempo-real`.
- Formato de las señales: `event: <tipo>\ndata: <json>\n\n`. Tipos: `listo`, `notificaciones` (`{ noLeidas }`), `reemplazada`, `sesion-cerrada` (`{ motivo }`). Latido: la línea de comentario `: latido`.

- [ ] **Step 1: Escribir la prueba que falla**

`server/scripts/_tiempo-real.ts` (necesita la API corriendo):

```ts
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../src/core/config";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(quien: string, rolElegido?: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE, ...(rolElegido ? { rolElegido } : {}) }),
  });
  return ((await r.json()) as { token: string }).token;
}
const pedir = (metodo: string, ruta: string, token: string, cuerpo?: unknown) =>
  fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

interface Conexion {
  texto: () => string;
  codigo: () => number;
  tipo: () => string;
  cerrada: () => boolean;
  cortar: () => void;
}
// Abre la conexión en vivo y junta todo lo que llega.
function abrir(token?: string, ruta = "/api/tiempo-real"): Conexion {
  const trozos: string[] = [];
  let codigo = 0;
  let tipo = "";
  let cerrada = false;
  const control = new AbortController();
  fetch(`${API}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: control.signal })
    .then(async (res) => {
      codigo = res.status;
      tipo = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body) return;
      const decodificador = new TextDecoder();
      for await (const trozo of res.body) trozos.push(decodificador.decode(trozo, { stream: true }));
    })
    .catch(() => {})
    .finally(() => {
      cerrada = true;
    });
  return { texto: () => trozos.join(""), codigo: () => codigo, tipo: () => tipo, cerrada: () => cerrada, cortar: () => control.abort() };
}
const motivo = (c: Conexion) => /event: sesion-cerrada\ndata: (.*)\n/.exec(c.texto())?.[1] ?? "ninguno";
const sid = (token: string) => (jwt.decode(token) as { sid: string }).sid;
const si = (b: boolean) => (b ? "sí" : "no");

(async () => {
  const m = await crearMundo(prisma);

  // 1) Sin token, o con el token en la dirección: rechazada
  const padreToken = await login("padre");
  const sinToken = abrir();
  const enLaDireccion = abrir(undefined, `/api/tiempo-real?token=${padreToken}`);
  await esperar(500);
  ok("1: sin token", sinToken.codigo(), 401);
  ok("1: con el token en la dirección", enLaDireccion.codigo(), 401);

  // 2) Abre como SSE y avisa que está lista
  const padre = abrir(padreToken);
  await esperar(500);
  ok("2: abre", padre.codigo(), 200);
  ok("2: es SSE", padre.tipo(), "text/event-stream; charset=utf-8");
  ok("2: avisa que está lista", si(padre.texto().includes("event: listo")), "sí");

  // 3) Un aviso nuevo llega al instante y sin datos personales
  const profeToken = await login("profe");
  await pedir("POST", "/api/observaciones", profeToken, { alumnoId: m.hijo1, texto: "Muy bien", categoria: "felicitacion" });
  await esperar(500);
  ok("3: llega la señal", si(/event: notificaciones\ndata: \{"noLeidas":\d+\}/.test(padre.texto())), "sí");
  ok("3: sin nombres ni textos", padre.texto().includes("Tomasav") ? "con datos" : "sin datos", "sin datos");

  // 4) La cuenta con dos roles recibe solo en el rol del aviso
  const multiAdmin = abrir(await login("multi", "admin"));
  const multiProfe = abrir(await login("multi", "profesor"));
  await esperar(500);
  const enTresDias = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await pedir("POST", "/api/calificaciones/evaluaciones", profeToken, {
    cursoId: m.cursoId, nombre: "Unit Vivo", tipo: "examen", fecha: enTresDias, periodo: "noviembre", escala: "numerica",
  });
  await esperar(500);
  ok("4: le llega como admin", si(multiAdmin.texto().includes("event: notificaciones")), "sí");
  ok("4: no le llega como profesora", si(multiProfe.texto().includes("event: notificaciones")), "no");

  // 5) Una conexión por sesión
  const padreBis = abrir(padreToken);
  const abiertaEn = Date.now();
  await esperar(500);
  ok("5: la anterior se entera", si(padre.texto().includes("event: reemplazada")), "sí");
  ok("5: y se cierra", si(padre.cerrada()), "sí");
  ok("5: la nueva queda abierta", si(padreBis.cerrada()), "no");

  // 6) Hasta 10 aperturas por minuto por sesión
  const otraSesion = await login("padre");
  const aperturas: Conexion[] = [];
  for (let i = 0; i < 10; i++) {
    aperturas.push(abrir(otraSesion));
    await esperar(60);
  }
  await esperar(300);
  const once = abrir(otraSesion);
  await esperar(300);
  ok("6: la apertura 11 en un minuto", once.codigo(), 429);
  ok("6: no afecta a otra sesión", si(padreBis.cerrada()), "no");
  aperturas.forEach((c) => c.cortar());

  // 7) Cierres de sesión, cada uno con su motivo
  const s1 = await login("padre");
  const s2 = await login("padre");
  const s3 = await login("padre");
  const c1 = abrir(s1);
  const c2 = abrir(s2);
  const c3 = abrir(s3);
  await esperar(500);
  await pedir("DELETE", `/api/auth/sesiones/${sid(s2)}`, s1);
  await esperar(500);
  ok("7: cerrar otra sesión", motivo(c2), '{"motivo":"cerrada-desde-otro-dispositivo"}');
  ok("7: la que la cerró sigue abierta", si(c1.cerrada()), "no");
  await pedir("POST", "/api/auth/sesiones/cerrar-otras", s1);
  await esperar(500);
  ok("7: cerrar todas las demás", motivo(c3), '{"motivo":"cerrada-desde-otro-dispositivo"}');
  await pedir("POST", "/api/auth/logout", s1);
  await esperar(500);
  ok("7: cerrar sesión", motivo(c1), '{"motivo":"cerrada-por-el-usuario"}');
  const p1 = await login("profe");
  const p2 = await login("profe");
  const cp1 = abrir(p1);
  const cp2 = abrir(p2);
  await esperar(500);
  await pedir("POST", "/api/auth/cambiar-contrasena", p1, { passwordActual: CLAVE, passwordNueva: "otraClave2026" });
  await esperar(500);
  ok("7: cambiar la contraseña", motivo(cp2), '{"motivo":"contrasena-cambiada"}');
  ok("7: la sesión que la cambió sigue abierta", si(cp1.cerrada()), "no");
  const ajeno = abrir(await login("ajeno"));
  await esperar(500);
  await pedir("PATCH", `/api/auth/usuarios/${m.ajeno}/estado`, await login("admin"), { estado: "inactivo" });
  await esperar(500);
  ok("7: desactivar la cuenta", motivo(ajeno), '{"motivo":"cuenta-desactivada"}');
  const vieja = abrir(await login("admin"));
  await esperar(300);
  for (let i = 0; i < 10; i++) await login("admin");
  await esperar(500);
  ok("7: tope de 10 sesiones", motivo(vieja), '{"motivo":"cerrada-desde-otro-dispositivo"}');

  // 8) Al vencer el token se corta con "vencida" (un token de 3 segundos sobre una sesión real)
  const { sub, rol, sid: sesion } = jwt.decode(await login("multi", "admin")) as { sub: string; rol: string; sid: string };
  const corta = abrir(jwt.sign({ sub, rol, sid: sesion }, config.JWT_SECRET, { expiresIn: 3 }));
  await esperar(4000);
  ok("8: al vencer el token", motivo(corta), '{"motivo":"vencida"}');

  // 9) Latido cada 25 segundos
  await esperar(Math.max(0, 26_000 - (Date.now() - abiertaEn)));
  ok("9: latido", si(padreBis.texto().includes(": latido")), "sí");

  // 10) El navegador puede mandar el encabezado Authorization (consulta previa de CORS)
  const previa = await fetch(`${API}/api/tiempo-real`, {
    method: "OPTIONS",
    headers: { Origin: config.CORS_ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
  });
  ok("10: consulta previa de CORS", previa.status, 204);

  [padreBis, multiAdmin, multiProfe, cp1].forEach((c) => c.cortar());
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: "prueba-tmp-av" } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh && cd server && pnpm exec tsx scripts/_tiempo-real.ts 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (`2: abre: 404`, entre otras).

- [ ] **Step 3: `authMiddleware` deja el vencimiento del token**

En `core/middlewares/authMiddleware.ts`:
- `AuthPayload` suma:
  ```ts
    // Cuándo vence el token (claim `exp`): la conexión en vivo se corta en ese momento.
    expiraEn: Date | null;
  ```
- El tipo del payload pasa a `let payload: { sub: string; rol: Rol; sid?: string; exp?: number };`.
- La última asignación pasa a `req.auth = { sub: payload.sub, rol: payload.rol, sesionId: payload.sid, expiraEn: payload.exp ? new Date(payload.exp * 1000) : null };`.

Luego `grep -rn "req.auth = \|AuthPayload" server/src`: si en algún otro lugar se arma un `AuthPayload` a mano, agregarle `expiraEn: null`.

- [ ] **Step 4: Límite de aperturas**

En `core/middlewares/limitesDePedidos.ts`, al final:

```ts
// Aperturas de la conexión en vivo: 10 por minuto por sesión (va después de authMiddleware). Una pestaña que se
// reconecta sin parar no puede saturar al servidor.
export const limiteTiempoReal = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: responderDemasiados,
  keyGenerator: (req) => req.auth?.sesionId ?? ipKeyGenerator(req.ip ?? ""),
});
```

- [ ] **Step 5: Crear `core/tiempoReal.ts`**

```ts
import { Router, type Request, type Response } from "express";
import { authMiddleware } from "./middlewares/authMiddleware";
import { limiteTiempoReal } from "./middlewares/limitesDePedidos";
import type { CanalEnVivo, MotivoCierre, SenalEnVivo, ValidadorDeSesion } from "./ports";

const LATIDO_MS = 25 * 1000;
const REVALIDAR_MS = 5 * 60 * 1000;
// setTimeout no acepta esperas de más de ~24,8 días: más allá, la revalidación periódica detecta el vencimiento.
const ESPERA_MAXIMA_MS = 2_147_483_647;

// Conexión en vivo (SSE): el servidor manda señales y el navegador solo escucha. Una por sesión. Se abre con el mismo
// encabezado Authorization y la misma validación que el resto de la API, nunca con el token en la dirección (quedaría
// en los registros). Se corta al vencer el token, cuando se cierra la sesión (lo avisa el canal) y, como red de
// seguridad, si al revalidarla cada 5 minutos ya no vale.
export function tiempoRealRoutes(canal: CanalEnVivo, validar: ValidadorDeSesion): Router {
  const router = Router();
  router.get("/", authMiddleware, limiteTiempoReal, (req: Request, res: Response) => {
    const { sub: usuarioId, rol, sesionId, expiraEn } = req.auth!;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Que ningún proxy (nginx y similares) acumule los mensajes antes de mandarlos.
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let abierta = true;
    let latido: NodeJS.Timeout | undefined;
    let revision: NodeJS.Timeout | undefined;
    let vencimiento: NodeJS.Timeout | undefined;
    let quitar = () => {};
    const enviar = (senal: SenalEnVivo) => {
      if (abierta) res.write(`event: ${senal.tipo}\ndata: ${JSON.stringify(senal.datos ?? {})}\n\n`);
    };
    const cerrar = () => {
      if (!abierta) return;
      abierta = false;
      clearInterval(latido);
      clearInterval(revision);
      clearTimeout(vencimiento);
      quitar();
      res.end();
    };
    const cortar = (motivo: MotivoCierre) => {
      enviar({ tipo: "sesion-cerrada", datos: { motivo } });
      cerrar();
    };

    quitar = canal.registrar({ sesionId, usuarioId, rol, enviar, cerrar });
    enviar({ tipo: "listo" });
    latido = setInterval(() => {
      if (abierta) res.write(": latido\n\n");
    }, LATIDO_MS);
    revision = setInterval(() => {
      validar(sesionId, usuarioId).then(
        (valida) => {
          if (!valida) cortar("vencida");
        },
        () => {},
      );
    }, REVALIDAR_MS);
    if (expiraEn) {
      const espera = expiraEn.getTime() - Date.now();
      if (espera <= ESPERA_MAXIMA_MS) vencimiento = setTimeout(() => cortar("vencida"), Math.max(espera, 0));
    }
    req.on("close", cerrar);
  });
  return router;
}
```

- [ ] **Step 6: Montar la ruta y conectar los cierres de sesión**

En `server.ts`: `import { tiempoRealRoutes } from "./core/tiempoReal";` y, junto a las demás rutas:

```ts
app.use("/api/tiempo-real", tiempoRealRoutes(container.canalEnVivo, container.validadorDeSesion));
```

En `container.ts`, después de `suscribirAvisos(tablero, notificacionService);`:

```ts
// Sesiones cerradas por cualquier camino: después de confirmar, el canal corta las conexiones en vivo que ya no valen.
tablero.alConfirmarse("sesiones.cerradas", ({ usuarioId, motivo }) => canalEnVivo.revisarSesiones(usuarioId, motivo));
```

- [ ] **Step 7: Todos los caminos que cierran sesiones lo anuncian**

En `usuarios/usuario.service.ts` (el constructor ya recibe `anuncios` desde la Task 6):
- `autenticar`, dentro de `if (sobrantes > 0) { … }`, después del `for` que cierra las menos usadas:
  ```ts
          await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "cerrada-desde-otro-dispositivo" }, tx);
  ```
- `cambiarEstado`: reemplazar `if (estado === "inactivo") await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);` por
  ```ts
        if (estado === "inactivo") {
          await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);
          await this.anuncios.publicar("sesiones.cerradas", { usuarioId: id, motivo: "cuenta-desactivada" }, tx);
        }
  ```
- `cambiarContrasena`, después de `await this.sesionRepo.cerrarTodas(usuarioId, ahora, sesionActualId, tx);`:
  ```ts
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "contrasena-cambiada" }, tx);
  ```
- `cerrarSesion`:
  ```ts
    async cerrarSesion(sesionId: string, usuarioId: string): Promise<void> {
      await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
      await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-por-el-usuario" });
    }
  ```
- `cerrarSesionAjena`, después del `if (!cerrada) throw …`:
  ```ts
      await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-desde-otro-dispositivo" });
  ```
- `cerrarOtrasSesiones`:
  ```ts
    async cerrarOtrasSesiones(usuarioId: string, sesionActualId: string): Promise<number> {
      const cerradas = await this.sesionRepo.cerrarTodas(usuarioId, new Date(), sesionActualId);
      if (cerradas > 0) await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-desde-otro-dispositivo" });
      return cerradas;
    }
  ```
- `restablecerContrasena`, después de `await this.sesionRepo.cerrarTodas(usuario.id, ahora, undefined, tx);`:
  ```ts
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "contrasena-cambiada" }, tx);
  ```

En `profesores/profesor.service.ts`, `actualizarProfesor`: reemplazar `if (actualizado.estado === "inactivo") await this.sesionRepo.cerrarTodas(usuario.id, new Date(), undefined, tx);` por

```ts
            if (actualizado.estado === "inactivo") {
              await this.sesionRepo.cerrarTodas(usuario.id, new Date(), undefined, tx);
              await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "cuenta-desactivada" }, tx);
            }
```

- [ ] **Step 8: Correr las pruebas**

```bash
cd server && pnpm typecheck
bash $SCRATCH/reiniciar-api.sh && pnpm exec tsx scripts/_tiempo-real.ts 2>&1 | python3 $SCRATCH/chequear.py
pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
```
Expected: typecheck limpio; `26 bien, 0 mal` (tarda unos 35 segundos por el latido).

- [ ] **Step 9: Regresión de sesiones y del subproyecto 2**

Las baterías existentes siguen pasando con los services que ahora anuncian:

```bash
cd server && for s in _sesiones _carrera-login _minors-sub2 _ficha-pendiente _invitaciones _activacion; do echo "== $s"; pnpm exec tsx scripts/$s.ts 2>&1 | python3 $SCRATCH/chequear.py | tail -1; done
```
Expected: cada una `N bien, 0 mal`. Si alguna construye un service con argumentos posicionales que ya no coinciden, corregir el script (no el service).

- [ ] **Step 10: Commit**

```bash
git add server/src
git commit -m "Conexión en vivo (SSE) por sesión, con latido, vencimiento y cierre al instante por cualquier camino

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Client — campana con historial, página de avisos y del recurso a la pantalla

**Files:**
- Create:
  - `client/src/core/hooks/useFiltrosDeUrl.ts`;
  - `client/src/features/notificaciones/{rutas.ts,apariencia.ts,pages/NotificacionesPage.tsx}`;
  - `client/src/features/notificaciones/hooks/{useHistorialNotificaciones,useMarcarLeida,useLeerTodas}.ts`.
- Replace: `client/src/features/notificaciones/{types.ts,notificacionService.ts,hooks/useNotificaciones.ts}`, `client/src/core/components/layout/NotificationBell.tsx`
- Modify: `client/src/core/routes/AppRoutes.tsx`, `client/src/core/components/layout/pageTitles.ts`
- Test: `$SCRATCH/preparar-campana.sh`, `$SCRATCH/e2e-campana.js`

**Interfaces:**
- Consumes: la API de la Task 5.
- Produces:
  - `useFiltrosDeUrl(): { leer(nombre): string | null; escribir(cambios: Record<string, string | null | undefined>): void }` y `elegir<T>(valor, permitidos, porDefecto): T` (los usan las Tasks 11 y 12);
  - `rutaDeAviso(recurso: RecursoAviso, rol: Rol): string`;
  - los tipos `Aviso`, `Campana`, `FiltroHistorial`, `PaginaHistorial`, `Preferencia`, `TipoNotificacion`, `RecursoAviso`;
  - `notificacionService.{campana, historial, marcarLeida, leerTodas, preferencias, cambiarPreferencia}`;
  - query keys `["notificaciones"]` (campana) y `["notificaciones", "historial", filtro]`.
- **Corrección al spec:** la evaluación próxima lleva a administración y a secretaría a `/dashboard` (el panel muestra las próximas evaluaciones), no a `/reportes`, que es solo de admin: la secretaría terminaría rebotada. Se anota en el spec en la Task 13.

- [ ] **Step 1: Preparar los datos y escribir el recorrido que falla**

`$SCRATCH/preparar-campana.sh`: mundo, una cuota vencida del hijo 1 y 7 observaciones. Al padre le quedan 10 avisos sin leer (cuota, 2 de documentación y 7 observaciones).

```bash
source $SCRATCH/lib.sh
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
M="pnpm exec tsx scripts/_mundo-avisos.ts"
$M crear >/dev/null
q "insert into \"Cuota\"(id,\"alumnoId\",mes,anio,\"montoBase\",descuento,\"montoFinal\",vencimiento,estado) values ('prueba-tmp-av-c1','prueba-tmp-av-hijo1',9,2026,1000,0,1000,'2026-09-10','vencida')" >/dev/null
$M sincronizar >/dev/null
PR=$(login prueba-tmp-av-profe@prueba.babylon.test prueba1234)
for i in 1 2 3 4 5 6 7; do http POST /api/observaciones $PR "{\"alumnoId\":\"prueba-tmp-av-hijo2\",\"texto\":\"Obs $i\",\"categoria\":\"academico\"}" >/dev/null; done
echo listo
```

`$SCRATCH/e2e-campana.js`:

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const CLAVE = "prueba1234";
const email = (q) => `prueba-tmp-av-${q}@prueba.babylon.test`;

async function entrar(pagina, quien) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', email(quien));
  await pagina.fill('input[name="password"]', CLAVE);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const contador = (pagina) => pagina.locator("[data-contador]").textContent({ timeout: 3000 }).catch(() => "ninguno");

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const pagina = await navegador.newPage();
  await entrar(pagina, "padre");

  ok("número de no leídos", await contador(pagina), "9+");
  await pagina.click('button[aria-label^="Notificaciones"]');
  ok("la campana muestra 10", await pagina.locator("[data-notificacion]").count(), 10);
  ok("abrir la campana no marca nada", await contador(pagina), "9+");

  await pagina.click('[data-notificacion]:has-text("Cuota de Septiembre")');
  await pagina.waitForURL(/\/mis-hijos\/cuotas/);
  const url = new URL(pagina.url());
  ok("lleva a las cuotas del hijo", `${url.pathname}?${url.searchParams}`, "/mis-hijos/cuotas?hijo=prueba-tmp-av-hijo1");
  await pagina.waitForTimeout(800);
  ok("el aviso tocado queda leído", await contador(pagina), "9");

  await pagina.click('button[aria-label^="Notificaciones"]');
  ok("leído pero abierto sigue en la campana", await pagina.locator('[data-notificacion][data-leida="true"]:has-text("Cuota de Septiembre")').count(), 1);
  await pagina.click("text=Marcar todas como leídas");
  await pagina.waitForTimeout(800);
  ok("marcar todas deja el número en cero", await contador(pagina), "ninguno");

  await pagina.click("text=Ver todas");
  await pagina.waitForURL(/\/notificaciones/);
  ok("la página agrupa por día", await pagina.locator("h3:has-text('Hoy')").count(), 1);
  await pagina.click('button:has-text("Pendientes")');
  await pagina.waitForURL(/filtro=pendientes/);
  ok("pendientes: solo los de estado", await pagina.locator("[data-aviso]").count(), 3);
  await pagina.reload();
  ok("al recargar se mantiene el filtro", await pagina.locator('button[aria-pressed="true"]').textContent(), "Pendientes");

  // Pagar la cuota la deja "Resuelta" en el historial
  const admin = await navegador.newPage();
  await entrar(admin, "admin");
  const token = await admin.evaluate(() => JSON.parse(localStorage.getItem("babylon-session") ?? sessionStorage.getItem("babylon-session")).state.token);
  await fetch(`${API}/api/cuotas/pagos`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ cuotaIds: ["prueba-tmp-av-c1"], metodo: "efectivo" }) });
  await pagina.click('button:has-text("Todas")');
  await pagina.reload();
  ok("la cuota pagada figura resuelta", await pagina.locator('[data-aviso]:has-text("Cuota de Septiembre") >> text=Resuelto').count(), 1);

  // Administración: el agrupado lleva a la lista filtrada
  await admin.click('button[aria-label^="Notificaciones"]');
  await admin.click('[data-notificacion]:has-text("con documentación pendiente")');
  await admin.waitForURL(/\/alumnos/);
  ok("lleva a alumnos filtrados", new URL(admin.url()).search, "?ciclo=activo&documentacion=pendiente");

  // Celular: la página no se desborda
  await pagina.setViewportSize({ width: 390, height: 800 });
  await pagina.goto(`${BASE}/notificaciones`);
  await pagina.waitForSelector("[data-aviso]");
  ok("sin desborde en celular", await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  await navegador.close();
})();
```

Run: `bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/iniciar-client.sh && bash $SCRATCH/preparar-campana.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-campana.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (el contador no existe, la página `/notificaciones` tampoco).

- [ ] **Step 2: Tipos y servicio**

Reemplazar `features/notificaciones/types.ts`:

```ts
export type TipoNotificacion =
  | "cuotas_vencidas"
  | "documentacion_pendiente"
  | "evaluacion_proxima"
  | "asistencia_pendiente"
  | "notas_sin_publicar"
  | "cierre_sin_publicar"
  | "cuota"
  | "documentacion_hijo"
  | "nota_publicada"
  | "cierre_publicado"
  | "observacion_nueva";

export type TonoNotificacion = "danger" | "warning" | "info";

// A qué lleva el aviso (la dirección se arma con rutaDeAviso, según el rol).
export type RecursoAviso =
  | { tipo: "cuotas-vencidas" }
  | { tipo: "documentacion-pendiente" }
  | { tipo: "evaluacion"; cursoId: string; evaluacionId: string }
  | { tipo: "asistencia"; cursoId: string; fecha: string }
  | { tipo: "cierre"; cursoId: string; periodo: string }
  | { tipo: "cuota"; alumnoId: string; cuotaId: string }
  | { tipo: "documentacion"; alumnoId: string }
  | { tipo: "calificaciones"; alumnoId: string }
  | { tipo: "hijo"; alumnoId: string };

export interface Aviso {
  id: string;
  tipo: TipoNotificacion;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  leida: boolean;
  resuelta: boolean;
  // Última actualización (ISO).
  fecha: string;
}

export interface Campana {
  noLeidas: number;
  avisos: Aviso[];
}

export type FiltroHistorial = "todas" | "no-leidas" | "pendientes";

export interface PaginaHistorial {
  avisos: Aviso[];
  siguiente: string | null;
}

export interface Preferencia {
  tipo: TipoNotificacion;
  etiqueta: string;
  activa: boolean;
}
```

Reemplazar `features/notificaciones/notificacionService.ts`:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { Campana, FiltroHistorial, PaginaHistorial, Preferencia, TipoNotificacion } from "./types";

export const notificacionService = {
  campana: () => apiClient.get<Campana>("/api/notificaciones"),
  historial: (filtro: FiltroHistorial, despuesDe?: string) =>
    apiClient.get<PaginaHistorial>(
      `/api/notificaciones/historial?filtro=${filtro}${despuesDe ? `&despuesDe=${encodeURIComponent(despuesDe)}` : ""}`,
    ),
  marcarLeida: (id: string) => apiClient.post<void>(`/api/notificaciones/${encodeURIComponent(id)}/leida`),
  leerTodas: () => apiClient.post<{ marcadas: number }>("/api/notificaciones/leer-todas"),
  preferencias: () => apiClient.get<Preferencia[]>("/api/notificaciones/preferencias"),
  cambiarPreferencia: (tipo: TipoNotificacion, activa: boolean) =>
    apiClient.patch<void>(`/api/notificaciones/preferencias/${tipo}`, { activa }),
};
```

- [ ] **Step 3: Hooks**

`hooks/useNotificaciones.ts` (reemplazar):

```ts
import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

// La campana se actualiza sola con las señales en vivo (core/tiempoReal); al volver a la pestaña también se refresca.
export function useNotificaciones() {
  return useQuery({ queryKey: ["notificaciones"], queryFn: notificacionService.campana, refetchOnWindowFocus: true });
}
```

`hooks/useHistorialNotificaciones.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";
import type { FiltroHistorial } from "../types";

export function useHistorialNotificaciones(filtro: FiltroHistorial) {
  return useInfiniteQuery({
    queryKey: ["notificaciones", "historial", filtro],
    queryFn: ({ pageParam }) => notificacionService.historial(filtro, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.siguiente ?? undefined,
  });
}
```

`hooks/useMarcarLeida.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificacionService.marcarLeida,
    // Campana e historial (comparten el prefijo de la clave).
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}
```

`hooks/useLeerTodas.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function useLeerTodas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificacionService.leerTodas,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}
```

- [ ] **Step 4: Del recurso a la pantalla y apariencia compartida**

`features/notificaciones/rutas.ts`:

```ts
import type { Rol } from "@/features/auth/types";
import type { RecursoAviso } from "./types";

const conFiltros = (ruta: string, filtros: Record<string, string>) => `${ruta}?${new URLSearchParams(filtros)}`;

// Del recurso de un aviso a la pantalla donde se resuelve, según el rol. El aviso no guarda direcciones: si una
// pantalla cambia de ruta, se cambia acá y los avisos viejos siguen funcionando.
export function rutaDeAviso(recurso: RecursoAviso, rol: Rol): string {
  switch (recurso.tipo) {
    case "cuotas-vencidas":
      return conFiltros("/cuotas", { pestana: "vencidas" });
    case "documentacion-pendiente":
      return conFiltros("/alumnos", { ciclo: "activo", documentacion: "pendiente" });
    case "evaluacion":
      // Administración y secretaría ven las próximas evaluaciones en su panel.
      return rol === "profesor" ? conFiltros("/calificaciones", { curso: recurso.cursoId, evaluacion: recurso.evaluacionId }) : "/dashboard";
    case "asistencia":
      return conFiltros("/asistencia", { curso: recurso.cursoId, fecha: recurso.fecha });
    case "cierre":
      return conFiltros("/calificaciones", { curso: recurso.cursoId, vista: "cierre", periodo: recurso.periodo });
    case "cuota":
      return conFiltros("/mis-hijos/cuotas", { hijo: recurso.alumnoId });
    case "documentacion":
      return conFiltros("/mis-hijos/documentacion", { hijo: recurso.alumnoId });
    case "calificaciones":
      return conFiltros("/mis-hijos/calificaciones", { hijo: recurso.alumnoId });
    case "hijo":
      return conFiltros("/mis-hijos", { hijo: recurso.alumnoId });
  }
}
```

`features/notificaciones/apariencia.ts`:

```ts
import { AlertCircle, Clock, Info } from "lucide-react";
import type { TonoNotificacion } from "./types";

export const ICONO_TONO = { danger: AlertCircle, warning: Clock, info: Info } as const;
export const COLOR_TONO: Record<TonoNotificacion, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
};
```

- [ ] **Step 5: Filtros en la dirección (pieza común)**

`client/src/core/hooks/useFiltrosDeUrl.ts`:

```ts
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Filtros, pestañas y selecciones que viven en la dirección de la página (?curso=…&fecha=…): un enlace (el de un
// aviso, por ejemplo) los trae puestos, recargar los conserva y la dirección se puede compartir. Cambiar uno reemplaza
// la entrada del historial: "atrás" lleva a la pantalla anterior, no al filtro anterior.
// Nunca guardar acá lo que se está escribiendo sin guardar ni el texto de un buscador: nombres y DNI de alumnos (menores)
// terminarían en el historial del navegador y en los registros del servidor.
export function useFiltrosDeUrl() {
  const [params, setParams] = useSearchParams();
  const leer = useCallback((nombre: string) => params.get(nombre), [params]);
  const escribir = useCallback(
    (cambios: Record<string, string | null | undefined>) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales);
          for (const [nombre, valor] of Object.entries(cambios)) {
            if (valor === null || valor === undefined || valor === "") nuevos.delete(nombre);
            else nuevos.set(nombre, valor);
          }
          return nuevos;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { leer, escribir };
}

// Un valor de la dirección solo si es uno de los permitidos; si no (viejo, mal escrito o ajeno), el de por defecto.
export function elegir<T extends string>(valor: string | null, permitidos: readonly T[], porDefecto: T): T {
  return valor !== null && (permitidos as readonly string[]).includes(valor) ? (valor as T) : porDefecto;
}
```

- [ ] **Step 6: La campana**

Reemplazar `core/components/layout/NotificationBell.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { COLOR_TONO, ICONO_TONO } from "@/features/notificaciones/apariencia";
import { useLeerTodas } from "@/features/notificaciones/hooks/useLeerTodas";
import { useMarcarLeida } from "@/features/notificaciones/hooks/useMarcarLeida";
import { useNotificaciones } from "@/features/notificaciones/hooks/useNotificaciones";
import { rutaDeAviso } from "@/features/notificaciones/rutas";
import type { Aviso } from "@/features/notificaciones/types";

// Avisos guardados de la cuenta en el rol actual: el número cuenta los no leídos; la lista muestra primero los no
// leídos y después los de estado que siguen abiertos aunque ya se hayan leído. Abrir la campana no marca nada: se marca
// al tocar cada aviso (o con "Marcar todas como leídas").
export function NotificationBell() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { data } = useNotificaciones();
  const marcarLeida = useMarcarLeida();
  const leerTodas = useLeerTodas();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onTecla);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onTecla);
    };
  }, [abierto]);

  const avisos = data?.avisos ?? [];
  const noLeidas = data?.noLeidas ?? 0;

  const abrirAviso = (aviso: Aviso) => {
    if (!aviso.leida) marcarLeida.mutate(aviso.id);
    setAbierto(false);
    if (usuario) navigate(rutaDeAviso(aviso.recurso, usuario.rol));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-expanded={abierto}
        className="relative rounded p-2 text-muted-foreground transition-colors hover:bg-accent"
        title="Notificaciones"
      >
        <Bell size={17} />
        {noLeidas > 0 && (
          <span
            data-contador
            className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-white"
            style={{ background: "var(--danger)" }}
          >
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] overflow-hidden rounded border bg-background shadow-lg"
          style={{ borderColor: "var(--border-hex)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--border-hex)" }}>
            <p className="text-[13px] font-semibold">Notificaciones</p>
            {noLeidas > 0 && (
              <button
                onClick={() => leerTodas.mutate()}
                disabled={leerTodas.isPending}
                className="text-[12px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {avisos.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No hay nada pendiente.</p>
            )}
            {avisos.map((aviso) => {
              const Icono = ICONO_TONO[aviso.tono];
              return (
                <button
                  key={aviso.id}
                  data-notificacion
                  data-leida={aviso.leida}
                  onClick={() => abrirAviso(aviso)}
                  className="flex w-full items-start gap-2.5 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-accent"
                  style={{ borderColor: "var(--border-hex)", background: aviso.leida ? undefined : "var(--bg-muted)" }}
                >
                  <Icono size={14} className="mt-0.5 shrink-0" style={{ color: COLOR_TONO[aviso.tono] }} />
                  <span className={cn("flex-1 text-[12.5px] leading-relaxed", !aviso.leida && "font-medium")}>{aviso.texto}</span>
                  {!aviso.leida && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--danger-dot)" }}>
                      <span className="sr-only">Sin leer</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            to="/notificaciones"
            onClick={() => setAbierto(false)}
            className="block border-t px-4 py-2.5 text-center text-[12.5px] font-medium hover:bg-accent"
            style={{ borderColor: "var(--border-hex)" }}
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: La página `/notificaciones`**

`features/notificaciones/pages/NotificacionesPage.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { elegir, useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { cn, fechaLocalISO, formatFecha } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { COLOR_TONO, ICONO_TONO } from "../apariencia";
import { useHistorialNotificaciones } from "../hooks/useHistorialNotificaciones";
import { useLeerTodas } from "../hooks/useLeerTodas";
import { useMarcarLeida } from "../hooks/useMarcarLeida";
import { rutaDeAviso } from "../rutas";
import type { Aviso, FiltroHistorial } from "../types";

const FILTROS: { id: FiltroHistorial; etiqueta: string; vacio: string }[] = [
  { id: "todas", etiqueta: "Todas", vacio: "No hubo avisos en los últimos 30 días." },
  { id: "no-leidas", etiqueta: "No leídas", vacio: "No tenés avisos sin leer." },
  { id: "pendientes", etiqueta: "Pendientes", vacio: "No hay nada pendiente." },
];

const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

function etiquetaDelDia(fechaIso: string): string {
  const dia = fechaLocalISO(new Date(fechaIso));
  if (dia === fechaLocalISO(new Date())) return "Hoy";
  if (dia === fechaLocalISO(new Date(Date.now() - 24 * 60 * 60 * 1000))) return "Ayer";
  return formatFecha(dia);
}

function haceCuanto(fechaIso: string): string {
  const minutos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.floor(minutos / 60)} h`;
  return hora.format(new Date(fechaIso));
}

// Los avisos ya vienen del más reciente al más antiguo: se agrupan por día respetando ese orden.
function porDia(avisos: Aviso[]): { dia: string; avisos: Aviso[] }[] {
  const grupos: { dia: string; avisos: Aviso[] }[] = [];
  for (const aviso of avisos) {
    const dia = etiquetaDelDia(aviso.fecha);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.avisos.push(aviso);
    else grupos.push({ dia, avisos: [aviso] });
  }
  return grupos;
}

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { leer, escribir } = useFiltrosDeUrl();
  const filtro = elegir(leer("filtro"), FILTROS.map((f) => f.id), "todas");
  const historial = useHistorialNotificaciones(filtro);
  const marcarLeida = useMarcarLeida();
  const leerTodas = useLeerTodas();
  const avisos = historial.data?.pages.flatMap((p) => p.avisos) ?? [];

  const abrir = (aviso: Aviso) => {
    if (!aviso.leida) marcarLeida.mutate(aviso.id);
    if (usuario) navigate(rutaDeAviso(aviso.recurso, usuario.rol));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded p-1" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filtro === f.id}
              onClick={() => escribir({ filtro: f.id === "todas" ? null : f.id })}
              className="rounded px-3.5 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: filtro === f.id ? "var(--bg)" : "transparent",
                color: filtro === f.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: filtro === f.id ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={leerTodas.isPending} onClick={() => leerTodas.mutate()}>
          Marcar todas como leídas
        </Button>
      </div>

      {historial.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {historial.isError && (
        <p role="alert" className="text-[12.5px] text-destructive">
          No se pudieron cargar los avisos. Probá de nuevo en unos minutos.
        </p>
      )}
      {historial.isSuccess && avisos.length === 0 && (
        <p className="py-10 text-center text-[13px] text-muted-foreground">{FILTROS.find((f) => f.id === filtro)?.vacio}</p>
      )}

      {porDia(avisos).map((grupo) => (
        <Panel key={grupo.dia} title={grupo.dia}>
          <ul>
            {grupo.avisos.map((aviso) => {
              const Icono = ICONO_TONO[aviso.tono];
              return (
                <li key={aviso.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-hex)" }}>
                  <button
                    data-aviso
                    onClick={() => abrir(aviso)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent"
                    style={{ background: aviso.leida ? undefined : "var(--bg-muted)" }}
                  >
                    <Icono size={15} className="mt-0.5 shrink-0" style={{ color: COLOR_TONO[aviso.tono] }} />
                    <span className={cn("min-w-0 flex-1 break-words text-[13px] leading-relaxed", !aviso.leida && "font-medium")}>
                      {aviso.texto}
                    </span>
                    {aviso.resuelta && <Badge variant="neutral">Resuelto</Badge>}
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{haceCuanto(aviso.fecha)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}

      {historial.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={historial.isFetchingNextPage} onClick={() => void historial.fetchNextPage()}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Ruta y título**

En `core/routes/AppRoutes.tsx`: `import NotificacionesPage from "@/features/notificaciones/pages/NotificacionesPage";` y, debajo de la ruta `/mi-cuenta` (todos los roles): `<Route path="/notificaciones" element={<NotificacionesPage />} />`.

En `core/components/layout/pageTitles.ts`, en la lista: `{ prefijo: "/notificaciones", titulo: "Notificaciones", subtitulo: "Avisos de los últimos 30 días" },`.

- [ ] **Step 9: Verificar**

```bash
cd client && pnpm typecheck && pnpm lint
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/preparar-campana.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-campana.js 2>&1 | python3 $SCRATCH/chequear.py
cd ../server && pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
```
Expected: typecheck y lint limpios; `13 bien, 0 mal`.

- [ ] **Step 10: Commit**

```bash
git add client/src
git commit -m "Campana con historial real: número de no leídos, marcar leído, página de avisos y cada aviso lleva a su recurso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Client — conexión en vivo compartida entre pestañas

**Files:**
- Create: `client/src/core/lib/token.ts`, `client/src/core/tiempoReal/{lectorSse.ts,conexion.ts,coordinador.ts,TiempoReal.tsx}`
- Modify: `client/src/core/lib/apiClient.ts`, `client/src/core/components/layout/AppLayout.tsx`, `client/src/features/auth/pages/LoginPage.tsx`
- Test: `server/scripts/_lector-sse.ts`, `$SCRATCH/e2e-tiempo-real.js`

**Interfaces:**
- Consumes: `GET /api/tiempo-real` y sus señales (Task 7); la query key `["notificaciones"]` (Task 8).
- Produces:
  - `sidDelToken(token): string | null`;
  - `API_URL` e `irAlLogin(motivo: string): void` exportados por `apiClient.ts`;
  - `crearLectorSse(alSenal): (trozo: string) => void`, `interface SenalEnVivo { tipo: string; datos: unknown }`;
  - `conectarEnVivo(token, alSenal): () => void`;
  - `iniciarTiempoReal(sid, token, alSenal): () => void`, `avisarCierreLocal(sid): void`;
  - el componente `<TiempoReal />`.
- Señales del lado del navegador: las del servidor más `rechazo` (el servidor respondió 401 al abrir).

- [ ] **Step 1: Escribir las pruebas que fallan**

`server/scripts/_lector-sse.ts` (el lector es TypeScript puro, sin dependencias del navegador):

```ts
import { crearLectorSse, type SenalEnVivo } from "../../client/src/core/tiempoReal/lectorSse";
import { ok } from "./_check";

const recibidas: SenalEnVivo[] = [];
const leer = crearLectorSse((s) => recibidas.push(s));
leer("event: listo\ndata: {}\n\n");
ok("una señal completa", JSON.stringify(recibidas.at(-1)), '{"tipo":"listo","datos":{}}');
leer("event: notificaciones\nda");
ok("a medias no se entrega", recibidas.length, 1);
leer('ta: {"noLeidas":3}\n');
ok("sin la línea en blanco tampoco", recibidas.length, 1);
leer("\n");
ok("al completarse se entrega", JSON.stringify(recibidas.at(-1)), '{"tipo":"notificaciones","datos":{"noLeidas":3}}');
leer(": latido\n\n");
ok("el latido no es una señal", recibidas.length, 2);
leer("event: a\ndata: {}\n\nevent: b\ndata: {}\n\n");
ok("dos señales en un mismo trozo", recibidas.slice(-2).map((s) => s.tipo).join(), "a,b");
leer("data: texto\n\n");
ok("sin 'event' es 'message'", recibidas.at(-1)?.tipo, "message");
ok("datos que no son JSON quedan como texto", recibidas.at(-1)?.datos, "texto");
leer("event: c\r\ndata: {}\r\n\r\n");
ok("también con fin de línea \\r\\n", recibidas.at(-1)?.tipo, "c");
```

`$SCRATCH/e2e-tiempo-real.js`:

```js
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const S = "/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad";
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const CLAVE = "prueba1234";
const email = (q) => `prueba-tmp-av-${q}@prueba.babylon.test`;
const HIJO1 = "prueba-tmp-av-hijo1";

async function entrar(pagina, quien, recordar = false) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', email(quien));
  await pagina.fill('input[name="password"]', CLAVE);
  if (recordar) await pagina.check('input[name="recordarme"]');
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien, rolElegido) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE, ...(rolElegido ? { rolElegido } : {}) }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) =>
  fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const contador = (p) => p.locator("[data-contador]").textContent({ timeout: 1500 }).catch(() => "ninguno");
const observar = (profe, alumnoId) => pedir("POST", "/api/observaciones", profe, { alumnoId, texto: "En vivo", categoria: "academico" });

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  let profe = await loginApi("profe");

  // 1) La misma sesión en dos pestañas: una sola conexión, y las dos se actualizan solas
  const ctx = await navegador.newContext();
  let aperturas = 0;
  ctx.on("request", (r) => {
    if (r.url().endsWith("/api/tiempo-real")) aperturas++;
  });
  const t1 = await ctx.newPage();
  await entrar(t1, "padre", true);
  await t1.waitForTimeout(1500);
  const conUna = aperturas;
  ok("1: la primera pestaña abre la conexión", conUna >= 1 ? "sí" : "no", "sí");
  const t2 = await ctx.newPage();
  await t2.goto(`${BASE}/mis-hijos`);
  await t2.waitForTimeout(1500);
  ok("1: la segunda pestaña no abre otra", aperturas, conUna);
  await observar(profe, HIJO1);
  await t1.waitForTimeout(1500);
  ok("1: se actualiza sola la pestaña con la conexión", await contador(t1), "3");
  ok("1: y la otra pestaña", await contador(t2), "3");

  // 2) Si se cierra la pestaña que tiene la conexión, otra la toma
  const antesDeCerrar = aperturas;
  await t1.close();
  await t2.waitForTimeout(2000);
  ok("2: otra pestaña toma la conexión", aperturas, antesDeCerrar + 1);
  await observar(profe, HIJO1);
  await t2.waitForTimeout(1500);
  ok("2: y sigue recibiendo", await contador(t2), "4");

  // 3) Si se reinicia el servidor, se reconecta sola
  const antesDelReinicio = aperturas;
  execSync(`bash ${S}/reiniciar-api.sh`);
  await t2.waitForTimeout(8000);
  ok("3: se reconecta sola", aperturas > antesDelReinicio ? "sí" : "no", "sí");
  profe = await loginApi("profe");
  await observar(profe, HIJO1);
  await t2.waitForTimeout(1500);
  ok("3: después de reconectarse sigue recibiendo", await contador(t2), "5");

  // 4) Cerrar sesión en una pestaña saca también a la otra pestaña de la misma sesión
  const t3 = await ctx.newPage();
  await t3.goto(`${BASE}/mis-hijos`);
  await t3.waitForTimeout(1500);
  await t2.click('button[title="Cerrar sesión"]');
  await t3.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
  ok("4: la otra pestaña va al login con el motivo", new URL(t3.url()).search, "?motivo=cerrada-por-el-usuario");
  ok("4: y lo explica", await t3.locator("text=Cerraste la sesión en otra pestaña.").count(), 1);

  // 5) Dos cuentas distintas en el mismo navegador (sin "Mantener sesión iniciada"): cada una recibe lo suyo
  const ctx2 = await navegador.newContext();
  const deLaFamilia = await ctx2.newPage();
  await entrar(deLaFamilia, "padre");
  const ajena = await ctx2.newPage();
  await entrar(ajena, "ajeno");
  await ajena.waitForTimeout(1500);
  const ajenaAntes = await contador(ajena);
  const familiaAntes = await contador(deLaFamilia);
  await observar(profe, HIJO1);
  await deLaFamilia.waitForTimeout(1500);
  ok("5: le llega a la cuenta del aviso", (await contador(deLaFamilia)) !== familiaAntes ? "sí" : "no", "sí");
  ok("5: no le llega a la otra cuenta", await contador(ajena), ajenaAntes);
  await deLaFamilia.click('button[title="Cerrar sesión"]');
  await ajena.waitForTimeout(1500);
  ok("5: cerrar una no saca a la otra", new URL(ajena.url()).pathname.startsWith("/login") ? "salió" : "sigue", "sigue");

  // 6) Cerrar las demás sesiones desde otro dispositivo saca a esta pestaña al instante
  const ctx3 = await navegador.newContext();
  const lejos = await ctx3.newPage();
  await entrar(lejos, "padre");
  await lejos.waitForTimeout(1500);
  await pedir("POST", "/api/auth/sesiones/cerrar-otras", await loginApi("padre"));
  await lejos.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});
  ok("6: va al login con el motivo", new URL(lejos.url()).search, "?motivo=cerrada-desde-otro-dispositivo");
  ok("6: y lo explica", await lejos.locator("text=Tu sesión se cerró desde otro dispositivo.").count(), 1);

  await navegador.close();
})();
```

Antes del recorrido: `cd server && pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar`. Así el padre arranca con 2 avisos (la documentación de sus dos hijos).

Run:
```bash
cd server && pnpm exec tsx scripts/_lector-sse.ts 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/iniciar-client.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-tiempo-real.js 2>&1 | python3 $SCRATCH/chequear.py
```
Expected: FAIL (no existe el lector; el contador no cambia sin recargar).

- [ ] **Step 2: Leer el id de sesión del token**

`client/src/core/lib/token.ts`:

```ts
// Id de la sesión (claim `sid`) leído del token, sin verificarlo: eso lo hace el servidor. Sirve para coordinar las
// pestañas de una misma sesión. null si el token no tiene el formato esperado.
export function sidDelToken(token: string): string | null {
  try {
    const parte = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!parte) return null;
    const datos = JSON.parse(atob(parte + "=".repeat((4 - (parte.length % 4)) % 4))) as { sid?: unknown };
    return typeof datos.sid === "string" ? datos.sid : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: `apiClient` exporta la URL y la salida al login**

En `core/lib/apiClient.ts`:
- `const API_URL = import.meta.env.VITE_API_URL;` pasa a `export const API_URL = import.meta.env.VITE_API_URL;`.
- Agregar, después de `let redirigiendoAlLogin = false;`:
  ```ts
  // La sesión ya no vale (vencida o cerrada desde otro lado): se borra la sesión guardada sin tocar el estado en memoria
  // (si se llamara a cerrarSesion(), ProtectedRoute redirigiría a /login antes y se perdería el aviso) y se recarga en
  // el login con el motivo. Varias causas pueden llegar a la vez: se redirige una sola vez.
  export function irAlLogin(motivo: string): void {
    if (redirigiendoAlLogin) return;
    redirigiendoAlLogin = true;
    useSessionStore.persist.clearStorage();
    window.location.replace(`/login?motivo=${encodeURIComponent(motivo)}`);
  }
  ```
- En `request`, reemplazar el bloque
  ```ts
      if (res.status === 401 && token && esLaSesionActual && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/logout") && !redirigiendoAlLogin) {
        redirigiendoAlLogin = true;
        useSessionStore.persist.clearStorage();
        window.location.replace("/login?motivo=sesion-vencida");
      }
  ```
  por
  ```ts
      if (res.status === 401 && token && esLaSesionActual && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/logout")) {
        irAlLogin("sesion-vencida");
      }
  ```
  y acortar el comentario de arriba del bloque: lo que explicaba sobre `cerrarSesion()` ahora está en `irAlLogin`.

- [ ] **Step 4: El lector de señales**

`client/src/core/tiempoReal/lectorSse.ts`:

```ts
// Lo que llega por la conexión en vivo (el formato lo arma el servidor en core/tiempoReal.ts).
export interface SenalEnVivo {
  tipo: string;
  datos: unknown;
}

// Lector del formato SSE: recibe el texto a trozos (un trozo puede cortar una línea por la mitad) y entrega cada señal
// completa. Las líneas que empiezan con ":" (el latido) se ignoran. El servidor termina las líneas con "\n".
export function crearLectorSse(alSenal: (senal: SenalEnVivo) => void): (trozo: string) => void {
  let resto = "";
  let tipo = "message";
  let datos: string[] = [];
  return (trozo) => {
    resto += trozo;
    const lineas = resto.split(/\r\n|\n|\r/);
    resto = lineas.pop() ?? "";
    for (const linea of lineas) {
      if (linea === "") {
        if (datos.length > 0) {
          const texto = datos.join("\n");
          let valor: unknown = texto;
          try {
            valor = JSON.parse(texto);
          } catch {
            // texto plano
          }
          alSenal({ tipo, datos: valor });
        }
        tipo = "message";
        datos = [];
        continue;
      }
      if (linea.startsWith(":")) continue;
      const corte = linea.indexOf(":");
      const campo = corte === -1 ? linea : linea.slice(0, corte);
      const valor = corte === -1 ? "" : linea.slice(corte + 1).replace(/^ /, "");
      if (campo === "event") tipo = valor;
      else if (campo === "data") datos.push(valor);
    }
  };
}
```

- [ ] **Step 5: La conexión con reconexión**

`client/src/core/tiempoReal/conexion.ts`:

```ts
import { API_URL } from "@/core/lib/apiClient";
import { crearLectorSse, type SenalEnVivo } from "./lectorSse";

const ESPERAS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

// Abre la conexión en vivo con fetch y la mantiene. No usa EventSource: no deja mandar el encabezado Authorization, y
// poner el token en la dirección lo dejaría en los registros. Si se corta, la vuelve a abrir esperando cada vez más
// (1, 2, 4… hasta 30 s, más un azar de hasta 1 s para que todos no reintenten a la vez). No reintenta si el servidor
// rechaza la sesión (avisa con la señal "rechazo"), si la cerraron ("sesion-cerrada") o si la reemplazó otra conexión
// de la misma sesión ("reemplazada").
export function conectarEnVivo(token: string, alSenal: (senal: SenalEnVivo) => void): () => void {
  let terminada = false;
  let intento = 0;
  let control: AbortController | null = null;
  let espera: number | undefined;

  const recibir = (senal: SenalEnVivo) => {
    if (senal.tipo === "listo") intento = 0;
    if (senal.tipo === "sesion-cerrada" || senal.tipo === "reemplazada") terminada = true;
    alSenal(senal);
  };

  const reintentar = () => {
    if (terminada) return;
    const base = ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)];
    intento++;
    espera = window.setTimeout(() => void abrir(), base + Math.random() * 1000);
  };

  const abrir = async () => {
    if (terminada) return;
    control = new AbortController();
    try {
      const res = await fetch(`${API_URL}/api/tiempo-real`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store",
        signal: control.signal,
      });
      if (res.status === 401) {
        terminada = true;
        alSenal({ tipo: "rechazo", datos: {} });
        return;
      }
      if (res.ok && res.body) {
        const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
        const procesar = crearLectorSse(recibir);
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          procesar(value);
        }
      }
    } catch {
      // Red caída, servidor reiniciándose o conexión cortada al salir: se reintenta (salvo que haya terminado).
    }
    reintentar();
  };

  void abrir();
  return () => {
    terminada = true;
    window.clearTimeout(espera);
    control?.abort();
  };
}
```

- [ ] **Step 6: Una conexión por sesión, compartida entre pestañas**

`client/src/core/tiempoReal/coordinador.ts`:

```ts
import { conectarEnVivo } from "./conexion";
import type { SenalEnVivo } from "./lectorSse";

const nombre = (sid: string) => `babylon-tiempo-real:${sid}`;

// Una sola conexión por sesión aunque haya varias pestañas: la pestaña que obtiene el candado (Web Locks) la mantiene y
// reparte lo que llega a las demás por BroadcastChannel; si se cierra, otra toma el candado sola. El candado y el canal
// llevan el id de la sesión: dos cuentas abiertas en el mismo navegador nunca comparten señales, y BroadcastChannel no
// sale del mismo sitio. Sin esas APIs (navegadores viejos), cada pestaña abre su propia conexión.
export function iniciarTiempoReal(sid: string, token: string, alSenal: (senal: SenalEnVivo) => void): () => void {
  if (!("locks" in navigator) || typeof BroadcastChannel === "undefined") return conectarEnVivo(token, alSenal);

  const canal = new BroadcastChannel(nombre(sid));
  canal.onmessage = (e: MessageEvent<SenalEnVivo>) => alSenal(e.data);
  const salir = new AbortController();
  navigator.locks
    .request(nombre(sid), { signal: salir.signal }, () =>
      new Promise<void>((liberar) => {
        const cortar = conectarEnVivo(token, (senal) => {
          alSenal(senal);
          canal.postMessage(senal);
        });
        salir.signal.addEventListener("abort", () => {
          cortar();
          liberar();
        });
      }),
    )
    .catch(() => {
      // AbortError: la pestaña se fue antes de obtener el candado.
    });
  return () => {
    salir.abort();
    canal.close();
  };
}

// Se cerró la sesión desde esta pestaña: las demás pestañas de la misma sesión se enteran por el canal.
export function avisarCierreLocal(sid: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const canal = new BroadcastChannel(nombre(sid));
  const senal: SenalEnVivo = { tipo: "sesion-cerrada", datos: { motivo: "cerrada-por-el-usuario" } };
  canal.postMessage(senal);
  canal.close();
}
```

- [ ] **Step 7: El componente que lo mantiene vivo**

`client/src/core/tiempoReal/TiempoReal.tsx`:

```tsx
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { irAlLogin } from "@/core/lib/apiClient";
import { sidDelToken } from "@/core/lib/token";
import { useSessionStore } from "@/core/store/sessionStore";
import { avisarCierreLocal, iniciarTiempoReal } from "./coordinador";
import type { SenalEnVivo } from "./lectorSse";

const MOTIVOS_CON_MENSAJE = ["cerrada-por-el-usuario", "cerrada-desde-otro-dispositivo", "contrasena-cambiada", "cuenta-desactivada"];

// "vencida" (o un motivo desconocido) se muestra como la sesión vencida de siempre.
function motivoParaElLogin(datos: unknown): string {
  const motivo = (datos as { motivo?: unknown } | null)?.motivo;
  return typeof motivo === "string" && MOTIVOS_CON_MENSAJE.includes(motivo) ? motivo : "sesion-vencida";
}

// Mantiene la conexión en vivo mientras haya sesión (va dentro de AppLayout): actualiza la campana cuando llega una
// señal o al (re)conectarse, y lleva al login si la sesión se cerró desde otro lado.
export function TiempoReal() {
  const token = useSessionStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    const sid = token ? sidDelToken(token) : null;
    if (!token || !sid) return;
    const alSenal = (senal: SenalEnVivo) => {
      if (senal.tipo === "notificaciones" || senal.tipo === "listo") {
        void queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      } else if (senal.tipo === "sesion-cerrada") {
        irAlLogin(motivoParaElLogin(senal.datos));
      } else if (senal.tipo === "rechazo") {
        irAlLogin("sesion-vencida");
      }
    };
    const detener = iniciarTiempoReal(sid, token, alSenal);
    return () => {
      detener();
      // Si se cerró la sesión desde esta pestaña (ya no hay token), las demás pestañas de la misma sesión también salen.
      if (!useSessionStore.getState().token) avisarCierreLocal(sid);
    };
  }, [token, queryClient]);

  return null;
}
```

- [ ] **Step 8: Montarlo y explicar los motivos en el login**

En `core/components/layout/AppLayout.tsx`: importar `import { TiempoReal } from "@/core/tiempoReal/TiempoReal";` y renderizar `<TiempoReal />` como primer hijo del contenedor que devuelve `AppLayout`.

En `features/auth/pages/LoginPage.tsx`, sumar a `MENSAJES_MOTIVO`:

```ts
  "cerrada-por-el-usuario": { texto: "Cerraste la sesión en otra pestaña.", tono: "warning" },
  "cerrada-desde-otro-dispositivo": { texto: "Tu sesión se cerró desde otro dispositivo.", tono: "warning" },
  "contrasena-cambiada": { texto: "Tu contraseña cambió: ingresá con la nueva.", tono: "warning" },
  "cuenta-desactivada": { texto: "Tu cuenta fue desactivada. Consultá con el instituto.", tono: "warning" },
```

- [ ] **Step 9: Verificar**

```bash
cd client && pnpm typecheck && pnpm lint
cd ../server && pnpm exec tsx scripts/_lector-sse.ts 2>&1 | python3 $SCRATCH/chequear.py
pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-tiempo-real.js 2>&1 | python3 $SCRATCH/chequear.py
pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
lsof -ti tcp:4000,5173 -sTCP:LISTEN | wc -l
```
Expected: typecheck y lint limpios; `9 bien, 0 mal`; `15 bien, 0 mal`; `2` (solo la API y Vite).

- [ ] **Step 10: Commit**

```bash
git add client/src
git commit -m "Conexión en vivo en el navegador: una por sesión compartida entre pestañas, reconexión con espera creciente y salida al instante si la sesión se cierra

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Client — preferencias de avisos en Mi cuenta

**Files:**
- Create: `client/src/core/components/ui/interruptor.tsx`, `client/src/features/notificaciones/hooks/{usePreferenciasNotificaciones,useCambiarPreferencia}.ts`, `client/src/features/cuenta/components/PreferenciasNotificaciones.tsx`
- Modify: `client/src/features/usuarios/pages/UsuariosPage.tsx` (usa el interruptor compartido), `client/src/features/cuenta/pages/MiCuentaPage.tsx`
- Test: `$SCRATCH/e2e-preferencias.js`

**Interfaces:**
- Consumes: `notificacionService.preferencias / cambiarPreferencia` (Task 8).
- Produces: `Interruptor({ activo, onClick, deshabilitado?, titulo?, etiqueta? })`; query key `["preferencias-notificaciones"]`.

- [ ] **Step 1: Escribir el recorrido que falla**

`$SCRATCH/e2e-preferencias.js` (antes: `_mundo-avisos.ts crear` y `sincronizar`):

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const email = (q) => `prueba-tmp-av-${q}@prueba.babylon.test`;

async function entrar(pagina, quien) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', email(quien));
  await pagina.fill('input[name="password"]', "prueba1234");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const contador = (p) => p.locator("[data-contador]").textContent({ timeout: 1500 }).catch(() => "ninguno");

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const pagina = await navegador.newPage();
  await entrar(pagina, "padre");
  await pagina.goto(`${BASE}/mi-cuenta`);
  const interruptores = pagina.locator('[data-preferencia] [role="switch"]');
  ok("el padre ve sus 5 tipos", await interruptores.count(), 5);
  ok("todos encendidos", await pagina.locator('[data-preferencia] [role="switch"][aria-checked="true"]').count(), 5);
  ok("con nombre legible", await pagina.locator('[data-preferencia]:has-text("Documentación pendiente")').count(), 1);
  ok("hay avisos de documentación", await contador(pagina), "2");

  await pagina.click('[data-preferencia]:has-text("Documentación pendiente") [role="switch"]');
  await pagina.waitForTimeout(800);
  ok("apagado queda apagado", await pagina.locator('[data-preferencia]:has-text("Documentación pendiente") [role="switch"]').getAttribute("aria-checked"), "false");
  ok("sus avisos salen de la campana", await contador(pagina), "ninguno");
  await pagina.reload();
  ok("al recargar sigue apagado", await pagina.locator('[data-preferencia]:has-text("Documentación pendiente") [role="switch"]').getAttribute("aria-checked"), "false");

  await pagina.click('[data-preferencia]:has-text("Documentación pendiente") [role="switch"]');
  await pagina.waitForTimeout(800);
  ok("al encender vuelven", await contador(pagina), "2");

  const admin = await navegador.newPage();
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/mi-cuenta`);
  ok("administración ve sus 3 tipos", await admin.locator('[data-preferencia] [role="switch"]').count(), 3);

  await pagina.setViewportSize({ width: 390, height: 800 });
  await pagina.goto(`${BASE}/mi-cuenta`);
  await pagina.waitForSelector("[data-preferencia]");
  ok("sin desborde en celular", await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await navegador.close();
})();
```

Run: `bash $SCRATCH/e2e.sh $SCRATCH/e2e-preferencias.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no hay `[data-preferencia]`).

- [ ] **Step 2: Interruptor compartido**

Mover la función `Interruptor` de `features/usuarios/pages/UsuariosPage.tsx` a `client/src/core/components/ui/interruptor.tsx` como `export function Interruptor(…)`, **sin cambiar su contenido**. Solo se suma una prop opcional `etiqueta?: string`, que se pasa como `aria-label={etiqueta}` al `<button>`, para que el interruptor tenga nombre accesible cuando no hay texto visible asociado. En `UsuariosPage.tsx`, borrar la función local e importar `import { Interruptor } from "@/core/components/ui/interruptor";`.

- [ ] **Step 3: Hooks**

`features/notificaciones/hooks/usePreferenciasNotificaciones.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function usePreferenciasNotificaciones() {
  return useQuery({ queryKey: ["preferencias-notificaciones"], queryFn: notificacionService.preferencias });
}
```

`features/notificaciones/hooks/useCambiarPreferencia.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";
import type { TipoNotificacion } from "../types";

export function useCambiarPreferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, activa }: { tipo: TipoNotificacion; activa: boolean }) => notificacionService.cambiarPreferencia(tipo, activa),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferencias-notificaciones"] });
      // Apagar borra los avisos de ese tipo; encender los vuelve a traer.
      void queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    },
  });
}
```

- [ ] **Step 4: La sección en Mi cuenta**

`features/cuenta/components/PreferenciasNotificaciones.tsx`:

```tsx
import { Panel } from "@/core/components/ui/panel";
import { Interruptor } from "@/core/components/ui/interruptor";
import { useCambiarPreferencia } from "@/features/notificaciones/hooks/useCambiarPreferencia";
import { usePreferenciasNotificaciones } from "@/features/notificaciones/hooks/usePreferenciasNotificaciones";

// Qué avisos aparecen en la campana, para el rol con el que se entró (cada rol de una cuenta se configura aparte).
// Apagar un tipo no oculta la información: sigue en su pantalla.
export function PreferenciasNotificaciones() {
  const { data: preferencias, isLoading, isError } = usePreferenciasNotificaciones();
  const cambiar = useCambiarPreferencia();

  return (
    <Panel title="Notificaciones">
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Elegí qué avisos aparecen en la campana. Lo que apagues sigue disponible en su pantalla.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            No se pudieron cargar tus preferencias. Probá de nuevo en unos minutos.
          </p>
        )}
        {cambiar.isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            No se pudo guardar el cambio. Probá de nuevo.
          </p>
        )}
        <ul className="divide-y" style={{ borderColor: "var(--border-hex)" }}>
          {preferencias?.map((p) => (
            <li key={p.tipo} data-preferencia className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0 text-[13px]">{p.etiqueta}</span>
              <Interruptor
                activo={p.activa}
                etiqueta={p.etiqueta}
                deshabilitado={cambiar.isPending}
                onClick={() => cambiar.mutate({ tipo: p.tipo, activa: !p.activa })}
              />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
```

En `MiCuentaPage.tsx`: importar `PreferenciasNotificaciones` y renderizarlo entre `<CambiarContrasena />` y `<SesionesActivas />`.

- [ ] **Step 5: Verificar**

```bash
cd client && pnpm typecheck && pnpm lint
cd ../server && pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
bash $SCRATCH/e2e.sh $SCRATCH/e2e-preferencias.js 2>&1 | python3 $SCRATCH/chequear.py
pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
```
Expected: limpios; `10 bien, 0 mal`. Comprobar también a mano, en `/usuarios` como admin, que el interruptor de estado de las cuentas sigue igual.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Preferencias de avisos en Mi cuenta, por rol; interruptor compartido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Client — filtros en la dirección en Alumnos (con documentación) y Cuotas

**Files:**
- Create: `client/src/features/documentos/hooks/useDocumentosFaltantes.ts`
- Modify: `client/src/features/documentos/documentoService.ts`, `client/src/features/alumnos/pages/AlumnosListPage.tsx`, `client/src/features/cuotas/pages/CuotasPage.tsx`
- Test: `$SCRATCH/e2e-filtros-1.js`

**Interfaces:**
- Consumes: `useFiltrosDeUrl`, `elegir` (Task 8); `GET /api/documentos/faltantes` (Task 3).
- Produces:
  - `documentoService.faltantes(): Promise<Record<string, TipoDocumento[]>>`, `useDocumentosFaltantes()` (key `["documentos", "faltantes"]`);
  - en `/alumnos`, los parámetros `ciclo` (`activo` | `todos` | id; por defecto `activo`), `cuota` (`todas` | `pagada` | `pendiente` | `vencida`), `curso` (`todos` | id), `documentacion` (`todos` | `pendiente` | `formulario_inscripcion` | `copia_dni` | `autorizacion_imagen`) y `pagina`;
  - en `/cuotas`, `pestana` (`vencidas` | `pendientes` | `cobradas` | `todas`; por defecto `vencidas`).

- [ ] **Step 1: Escribir el recorrido que falla**

`$SCRATCH/e2e-filtros-1.js` (antes: `_mundo-avisos.ts crear` y `sincronizar`):

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";

async function entrar(pagina, quien) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', `prueba-tmp-av-${quien}@prueba.babylon.test`);
  await pagina.fill('input[name="password"]', "prueba1234");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const param = (p, nombre) => new URL(p.url()).searchParams.get(nombre);

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await navegador.newPage();
  await entrar(p, "admin");

  await p.click('button[aria-label^="Notificaciones"]');
  const aviso = p.locator('[data-notificacion]:has-text("con documentación pendiente")');
  const n = (await aviso.textContent()).match(/Hay (\d+) alumno/)[1];
  await aviso.click();
  await p.waitForURL(/documentacion=pendiente/);
  await p.waitForSelector("text=Tomasav");
  ok("el filtro de documentación viene puesto", await p.locator('select[aria-label="Documentación"]').inputValue(), "pendiente");
  ok("la lista cuenta lo mismo que el aviso", await p.locator("[data-cantidad-alumnos]").textContent(), `${n} alumno${n === "1" ? "" : "s"}`);
  ok("cada fila dice qué falta", await p.locator('tr:has-text("Tomasav") >> text=Falta formulario, DNI, imagen').count(), 1);
  await p.selectOption('select[aria-label="Documentación"]', "copia_dni");
  ok("el filtro queda en la dirección", param(p, "documentacion"), "copia_dni");
  await p.reload();
  await p.waitForSelector("text=Tomasav");
  ok("al recargar se mantiene", await p.locator('select[aria-label="Documentación"]').inputValue(), "copia_dni");
  await p.fill('input[placeholder^="Buscar por nombre"]', "Tomasav");
  await p.waitForTimeout(300);
  ok("el buscador no va a la dirección", p.url().includes("Tomasav") ? "sí" : "no", "no");
  await p.selectOption('select[aria-label="Cuota"]', "vencida");
  ok("cambiar un filtro vuelve a la página 1", param(p, "pagina"), null);
  await p.goBack();
  await p.waitForTimeout(500);
  ok("atrás vuelve a la pantalla anterior", new URL(p.url()).pathname, "/dashboard");

  await p.goto(`${BASE}/alumnos?documentacion=cualquiera&cuota=nada&curso=inexistente&ciclo=inexistente`);
  await p.waitForTimeout(1500);
  ok("inválidos: documentación por defecto", await p.locator('select[aria-label="Documentación"]').inputValue(), "todos");
  ok("inválidos: cuota por defecto", await p.locator('select[aria-label="Cuota"]').inputValue(), "todas");
  ok("inválidos: sin error", await p.locator("text=No se pudieron cargar los alumnos").count(), 0);

  const pestanaActiva = async () => (await p.locator('button[aria-pressed="true"]').first().textContent()).replace(/\d+/g, "").trim();
  await p.goto(`${BASE}/cuotas?pestana=pendientes`);
  await p.waitForTimeout(1000);
  ok("cuotas: abre en la pestaña pedida", await pestanaActiva(), "Pendientes");
  await p.click('button:has-text("Cobradas")');
  ok("cuotas: la pestaña queda en la dirección", param(p, "pestana"), "cobradas");
  await p.goto(`${BASE}/cuotas`);
  await p.waitForTimeout(1000);
  ok("cuotas: por defecto, Vencidas", await pestanaActiva(), "Vencidas");

  await p.setViewportSize({ width: 390, height: 800 });
  await p.goto(`${BASE}/alumnos?ciclo=activo&documentacion=pendiente`);
  await p.waitForSelector('[data-tarjeta-alumno]:has-text("Tomasav")');
  ok("celular: la tarjeta dice qué falta", await p.locator('[data-tarjeta-alumno]:has-text("Tomasav") >> text=Falta formulario, DNI, imagen').count(), 1);
  ok("celular: sin desborde", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await navegador.close();
})();
```

Run: `bash $SCRATCH/e2e.sh $SCRATCH/e2e-filtros-1.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (no existe el selector de Documentación).

- [ ] **Step 2: Servicio y hook de faltantes**

En `features/documentos/documentoService.ts`, importar `TipoDocumento` y agregar:

```ts
  // Admin/Secretario: qué le falta a cada alumno que debe documentación (solo los que deben algo).
  faltantes: () => apiClient.get<Record<string, TipoDocumento[]>>("/api/documentos/faltantes"),
```

`features/documentos/hooks/useDocumentosFaltantes.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useDocumentosFaltantes() {
  return useQuery({ queryKey: ["documentos", "faltantes"], queryFn: documentoService.faltantes });
}
```

- [ ] **Step 3: `AlumnosListPage` con los filtros en la dirección**

En `features/alumnos/pages/AlumnosListPage.tsx`:

1. Imports: `import { elegir, useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";`, `import { useDocumentosFaltantes } from "@/features/documentos/hooks/useDocumentosFaltantes";`, `import type { TipoDocumento } from "@/features/documentos/types";`.
2. Constantes de módulo, junto a `CUOTA_LABELS`:
   ```ts
   const FILTROS_CUOTA = ["todas", "pagada", "pendiente", "vencida"] as const;
   const FILTROS_DOCUMENTACION = ["todos", "pendiente", "formulario_inscripcion", "copia_dni", "autorizacion_imagen"] as const;
   const FALTA_CORTO: Record<TipoDocumento, string> = { formulario_inscripcion: "formulario", copia_dni: "DNI", autorizacion_imagen: "imagen" };
   const textoFaltante = (faltan: TipoDocumento[]) => `Falta ${faltan.map((t) => FALTA_CORTO[t]).join(", ")}`;
   ```
3. El efecto del aviso de la inscripción conserva los filtros: `navigate(location.pathname, { replace: true, state: null })` pasa a `navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })` (y agregar `location.search` a sus dependencias).
4. Reemplazar los `useState` de `filtroCiclo`, `filtroCuota`, `filtroCurso` y `pagina` (la `busqueda` se queda en `useState`) por:
   ```ts
     // Filtros en la dirección (los trae puesto el enlace de un aviso y sobreviven a recargar). El buscador no: ahí se
     // escriben nombres y DNI de menores.
     const { leer, escribir } = useFiltrosDeUrl();
     const cicloPedido = leer("ciclo") ?? "activo";
     // Mientras los ciclos cargan se respeta lo pedido; después, un id que no existe vuelve al ciclo activo.
     const filtroCiclo =
       cicloPedido === "activo" || cicloPedido === "todos" || !ciclos || ciclos.some((c) => c.id === cicloPedido) ? cicloPedido : "activo";
     const filtroCuota = elegir(leer("cuota"), FILTROS_CUOTA, "todas");
     const filtroDocumentacion = elegir(leer("documentacion"), FILTROS_DOCUMENTACION, "todos");
     const pagina = Math.max(1, Number(leer("pagina")) || 1);
     // Cambiar cualquier filtro vuelve a la primera página.
     const cambiarFiltros = (cambios: Record<string, string | null>) => escribir({ ...cambios, pagina: null });
   ```
   El cálculo de `cicloIdEfectivo` queda igual (usa `filtroCiclo`). El curso se valida contra los del ciclo, así que va **después** de `cursosDelCiclo`:
   ```ts
     const cursoPedido = leer("curso") ?? "todos";
     const filtroCurso = cursoPedido === "todos" || !cursosDelCiclo || cursosDelCiclo.some((c) => c.id === cursoPedido) ? cursoPedido : "todos";
   ```
5. Cargar los faltantes, junto a las otras consultas: `const { data: faltantes } = useDocumentosFaltantes();`, y la función `const faltanDe = (alumnoId: string): TipoDocumento[] => faltantes?.[alumnoId] ?? [];`.
6. En `filtrados`, sumar la condición y la dependencia `faltantes`/`filtroDocumentacion`:
   ```ts
         const matchDocumentacion =
           filtroDocumentacion === "todos" ||
           (filtroDocumentacion === "pendiente" ? faltanDe(alumno.id).length > 0 : faltanDe(alumno.id).includes(filtroDocumentacion));
         return matchTexto && matchCuota && matchCurso && matchDocumentacion;
   ```
7. Reemplazar `actualizarFiltro` por los setters nuevos:
   - buscador: `onChange={(e) => { setBusqueda(e.target.value); escribir({ pagina: null }); }}`;
   - ciclo: `onChange={(e) => cambiarFiltros({ ciclo: e.target.value === "activo" ? null : e.target.value, curso: null })}` con `aria-label="Ciclo"`;
   - cuota: `onChange={(e) => cambiarFiltros({ cuota: e.target.value === "todas" ? null : e.target.value })}` con `aria-label="Cuota"`;
   - curso: `onChange={(e) => cambiarFiltros({ curso: e.target.value === "todos" ? null : e.target.value })}` con `aria-label="Curso"`;
   - paginación: `onClick={() => escribir({ pagina: paginaActual - 1 === 1 ? null : String(paginaActual - 1) })}` y `onClick={() => escribir({ pagina: String(paginaActual + 1) })}`.
8. Nuevo `<Select>` después del de curso:
   ```tsx
             <Select
               aria-label="Documentación"
               value={filtroDocumentacion}
               onChange={(e) => cambiarFiltros({ documentacion: e.target.value === "todos" ? null : e.target.value })}
               className="w-auto"
             >
               <option value="todos">Toda la documentación</option>
               <option value="pendiente">Con documentación pendiente</option>
               <option value="formulario_inscripcion">Falta formulario de inscripción</option>
               <option value="copia_dni">Falta copia de DNI</option>
               <option value="autorizacion_imagen">Falta autorización de imagen</option>
             </Select>
   ```
9. Al `<span>` que dice "N alumno(s)", agregarle `data-cantidad-alumnos`.
10. En la tabla, debajo de "Hermano inscripto" (dentro del mismo `<div>` del nombre):
    ```tsx
                          {faltanDe(alumno.id).length > 0 && (
                            <div className="text-[11px]" style={{ color: "var(--warning)" }}>
                              {textoFaltante(faltanDe(alumno.id))}
                            </div>
                          )}
    ```
11. En la tarjeta de celular: agregar `data-tarjeta-alumno` al `<div key={alumno.id} className="card-hl p-4">` y, debajo del `<p>` del DNI, el mismo bloque con `text-[11.5px]`.

- [ ] **Step 4: `CuotasPage` con la pestaña en la dirección**

En `features/cuotas/pages/CuotasPage.tsx`:
- Import `useFiltrosDeUrl`.
- Constante de módulo:
  ```ts
  // Nombre de cada pestaña en la dirección (?pestana=vencidas): el enlace del aviso "Hay N cuotas vencidas" la abre.
  const PESTANA_EN_URL: Record<Tab, string> = { vencida: "vencidas", pendiente: "pendientes", pagada: "cobradas", todas: "todas" };
  ```
- Reemplazar `const [tab, setTab] = useState<Tab>("vencida");` por
  ```ts
    const { leer, escribir } = useFiltrosDeUrl();
    const tab = (Object.keys(PESTANA_EN_URL) as Tab[]).find((t) => PESTANA_EN_URL[t] === leer("pestana")) ?? "vencida";
    const setTab = (t: Tab) => escribir({ pestana: t === "vencida" ? null : PESTANA_EN_URL[t] });
  ```
- A cada botón de pestaña, agregarle `aria-pressed={tab === t.id}`.

- [ ] **Step 5: Verificar**

```bash
cd client && pnpm typecheck && pnpm lint
cd ../server && pnpm exec tsx scripts/_mundo-avisos.ts crear && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
bash $SCRATCH/e2e.sh $SCRATCH/e2e-filtros-1.js 2>&1 | python3 $SCRATCH/chequear.py
bash $SCRATCH/e2e.sh $SCRATCH/e2e-campana.js 2>&1 | python3 $SCRATCH/chequear.py  # después de preparar-campana.sh
pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
```
Expected: limpios; `17 bien, 0 mal`; la campana sigue en `13 bien, 0 mal` (correr `bash $SCRATCH/preparar-campana.sh` antes de ese recorrido).

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Alumnos y Cuotas con los filtros en la dirección; filtro y aviso de documentación faltante

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Client — filtros en la dirección en Asistencia, Calificaciones y Mis hijos

**Files:**
- Modify: `client/src/features/asistencia/pages/AsistenciaProfesorPage.tsx`, `client/src/features/calificaciones/pages/CalificacionesProfesorPage.tsx`, `client/src/features/alumnos/pages/ParentDashboardPage.tsx`
- Test: `$SCRATCH/preparar-filtros-2.sh`, `$SCRATCH/e2e-filtros-2.js`

**Interfaces:**
- Consumes: `useFiltrosDeUrl`, `elegir` (Task 8).
- Produces:
  - `/asistencia?curso=&fecha=AAAA-MM-DD`;
  - `/calificaciones?curso=&vista=cierre&evaluacion=&periodo=` (con `vista=cierre`, `periodo` es `julio` | `noviembre`; en evaluaciones filtra la lista);
  - `/mis-hijos…?hijo=`.
  Un id inválido o ajeno cae en el valor por defecto (el primer curso propio, la primera evaluación visible, el primer hijo).

- [ ] **Step 1: Preparar y escribir el recorrido que falla**

`$SCRATCH/preparar-filtros-2.sh`:

```bash
source $SCRATCH/lib.sh
cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null
q "insert into \"Curso\"(id,nombre,nivel,\"profesorId\",\"cicloId\",cupo,estado) select 'prueba-tmp-av-curso2','Pruebaav Teens','teens_a1','prueba-tmp-av-profe',id,30,'activo' from \"Ciclo\" where activo" >/dev/null
q "insert into \"Evaluacion\"(id,\"cursoId\",nombre,tipo,fecha,periodo,escala,estado) values ('prueba-tmp-av-ea','prueba-tmp-av-curso','Unit A','examen','2026-10-01','noviembre','numerica','borrador'),('prueba-tmp-av-eb','prueba-tmp-av-curso','Unit B','examen','2026-10-08','noviembre','numerica','borrador')" >/dev/null
pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
echo listo
```

`$SCRATCH/e2e-filtros-2.js`:

```js
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";

async function entrar(pagina, quien) {
  await pagina.goto(`${BASE}/login`);
  await pagina.fill('input[name="email"]', `${P}-${quien}@prueba.babylon.test`);
  await pagina.fill('input[name="password"]', "prueba1234");
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const param = (p, nombre) => new URL(p.url()).searchParams.get(nombre);

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const profe = await navegador.newPage();
  await entrar(profe, "profe");

  await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=2026-10-13`);
  await profe.waitForTimeout(1500);
  ok("asistencia: abre el curso pedido", await profe.locator("select").first().inputValue(), `${P}-curso`);
  ok("asistencia: en el día pedido", await profe.locator('input[type="date"]').inputValue(), "2026-10-13");
  await profe.fill('input[type="date"]', "2026-10-06");
  ok("asistencia: la fecha queda en la dirección", param(profe, "fecha"), "2026-10-06");
  await profe.selectOption("select >> nth=0", `${P}-curso2`);
  ok("asistencia: al cambiar de curso, el curso queda", param(profe, "curso"), `${P}-curso2`);
  ok("asistencia: y la fecha vuelve a la de ese curso", param(profe, "fecha"), null);
  await profe.goto(`${BASE}/asistencia?curso=${P}-curso-multi`);
  await profe.waitForTimeout(1500);
  ok("asistencia: un curso ajeno abre uno propio", (await profe.locator("select").first().inputValue()) === `${P}-curso-multi` ? "ajeno" : "propio", "propio");

  await profe.goto(`${BASE}/calificaciones?curso=${P}-curso&evaluacion=${P}-eb`);
  await profe.waitForSelector("text=Unit B");
  ok("calificaciones: abre la evaluación pedida", await profe.locator('button[aria-pressed="true"]:has-text("Unit B")').count(), 1);
  await profe.click('button:has-text("Unit A")');
  ok("calificaciones: la evaluación queda en la dirección", param(profe, "evaluacion"), `${P}-ea`);
  await profe.goto(`${BASE}/calificaciones?curso=${P}-curso&evaluacion=inexistente`);
  await profe.waitForSelector("text=Unit A");
  ok("calificaciones: una evaluación inexistente abre la primera", await profe.locator('button[aria-pressed="true"]:has-text("Unit")').count(), 1);
  await profe.goto(`${BASE}/calificaciones?curso=${P}-curso&vista=cierre&periodo=noviembre`);
  await profe.waitForTimeout(1500);
  ok("calificaciones: abre las notas de cierre", await profe.locator('button[aria-pressed="true"]:has-text("Notas de cierre")').count(), 1);
  ok("calificaciones: en el período pedido", await profe.locator('button[aria-pressed="true"]:has-text("Noviembre")').count(), 1);

  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/mis-hijos/cuotas?hijo=${P}-hijo2`);
  await padre.waitForTimeout(1500);
  ok("padre: abre en el hijo pedido", await padre.locator('button[aria-pressed="true"]:has-text("Lunaav")').count(), 1);
  await padre.click('nav >> text=Calificaciones');
  await padre.waitForURL(/\/mis-hijos\/calificaciones/);
  await padre.waitForTimeout(800);
  ok("padre: al cambiar de pestaña sigue en el mismo hijo", await padre.locator('button[aria-pressed="true"]:has-text("Lunaav")').count(), 1);
  await padre.click('button:has-text("Tomasav")');
  ok("padre: el hijo elegido queda en la dirección", param(padre, "hijo"), `${P}-hijo1`);
  await padre.goto(`${BASE}/mis-hijos?hijo=${P}-alumno-ajeno`);
  await padre.waitForTimeout(1500);
  ok("padre: un hijo ajeno no se muestra", await padre.locator("text=Ajenoav").count(), 0);
  ok("padre: abre en un hijo propio", await padre.locator('button[aria-pressed="true"]').filter({ hasText: /Tomasav|Lunaav/ }).count(), 1);
  await navegador.close();
})();
```

Run: `bash $SCRATCH/preparar-filtros-2.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-filtros-2.js 2>&1 | python3 $SCRATCH/chequear.py`
Expected: FAIL (los parámetros se ignoran).

- [ ] **Step 2: Asistencia**

En `AsistenciaProfesorPage.tsx`:
- Import `useFiltrosDeUrl`.
- Reemplazar `const [cursoId, setCursoId] = useState<string | undefined>(undefined);`, `const [fecha, setFecha] = useState(hoyLocalISO());` y los dos `useEffect` que eligen el primer curso y fijan la fecha al cambiar de curso, por:
  ```ts
    // Curso y fecha en la dirección (el aviso "Falta tomar asistencia de 3° A del 14/10" abre ese curso en ese día). Un
    // curso que no es del profesor cae en el primero propio; sin fecha, la última clase del curso.
    const { leer, escribir } = useFiltrosDeUrl();
    const cursoPedido = leer("curso");
    const cursoId = cursos?.some((c) => c.id === cursoPedido) ? (cursoPedido as string) : cursos?.[0]?.id;
    const setCursoId = (id: string) => escribir({ curso: id, fecha: null });
  ```
  y, **después** de calcular `primeraSesion`:
  ```ts
    const fechaPedida = leer("fecha");
    const fecha =
      fechaPedida && /^\d{4}-\d{2}-\d{2}$/.test(fechaPedida)
        ? fechaPedida
        : primeraSesion
          ? fechaLocalISO(new Date(primeraSesion))
          : hoyLocalISO();
    const setFecha = (nueva: string) => escribir({ fecha: nueva });
  ```
  El resto (el efecto que limpia lo tipeado al cambiar de curso o fecha, el selector, el `<Input type="date">` y los chips de clases) sigue usando `cursoId`, `fecha`, `setCursoId` y `setFecha`, sin cambios.

- [ ] **Step 3: Calificaciones**

En `CalificacionesProfesorPage.tsx`:
- Import `useFiltrosDeUrl`.
- En `CalificacionesProfesorPage`: reemplazar los `useState` de `cursoId` y `view` y el `useEffect` del primer curso por
  ```ts
    // Curso, vista, evaluación y período en la dirección: los avisos del profesor abren exactamente lo que señalan.
    const { leer, escribir } = useFiltrosDeUrl();
    const cursoPedido = leer("curso");
    const cursoId = cursos?.some((c) => c.id === cursoPedido) ? (cursoPedido as string) : cursos?.[0]?.id;
    const view: "evals" | "cierre" = leer("vista") === "cierre" ? "cierre" : "evals";
  ```
  - El `<Select>` del curso: `onChange={(e) => escribir({ curso: e.target.value, evaluacion: null, periodo: null })}`.
  - Los botones de vista: `onClick={() => escribir({ vista: id === "cierre" ? "cierre" : null, evaluacion: null, periodo: null })}` y `aria-pressed={view === id}`.
- En `SeccionEvaluaciones`: reemplazar los `useState` de `periodFilter` y `selectedEvalId` y el `useEffect` que elige la primera visible por
  ```ts
    const { leer, escribir } = useFiltrosDeUrl();
    const periodoPedido = leer("periodo");
    const periodFilter: "all" | PeriodoAcademico = periodoPedido === "julio" || periodoPedido === "noviembre" ? periodoPedido : "all";
    const setPeriodFilter = (id: "all" | PeriodoAcademico) => escribir({ periodo: id === "all" ? null : id, evaluacion: null });
  ```
  y, **después** de `visibleEvals`:
  ```ts
    const evaluacionPedida = leer("evaluacion");
    const selectedEvalId = visibleEvals.some((e) => e.id === evaluacionPedida) ? (evaluacionPedida as string) : visibleEvals[0]?.id;
    const setSelectedEvalId = (id: string) => escribir({ evaluacion: id });
  ```
  A los botones de período y a los de cada evaluación, agregarles `aria-pressed={periodFilter === id}` y `aria-pressed={selectedEvalId === e.id}`, respectivamente. `onCrearEvaluacion` sigue llamando a `setSelectedEvalId(creada.id)`.
- En `SeccionNotasCierre`: reemplazar `const [periodo, setPeriodo] = useState<PeriodoAcademico>("julio");` por
  ```ts
    const { leer, escribir } = useFiltrosDeUrl();
    const periodo: PeriodoAcademico = leer("periodo") === "noviembre" ? "noviembre" : "julio";
    const setPeriodo = (p: PeriodoAcademico) => escribir({ periodo: p === "julio" ? null : p });
  ```
  y agregar `aria-pressed={periodo === p}` a sus botones.
- Quitar los imports que queden sin uso (`useState` y `useEffect` siguen en uso en otras partes del archivo: revisar con `pnpm lint`).

- [ ] **Step 4: Mis hijos**

En `ParentDashboardPage.tsx`:
- Import `useFiltrosDeUrl`.
- Arriba del componente (nivel de módulo):
  ```ts
  // Último hijo elegido en esta pestaña: el menú lleva a /mis-hijos/cuotas, /mis-hijos/calificaciones… sin ?hijo, y al
  // cambiar de pestaña tiene que seguir el mismo hijo. Si no es un hijo de la cuenta actual, se ignora.
  let ultimoHijoElegido: string | null = null;
  ```
- Reemplazar `const [kidIdx, setKidIdx] = useState(0);` y `const kid = hijos?.[kidIdx];` por
  ```ts
    // Hijo en la dirección (?hijo=): el aviso "Cuota de Tomás por vencer" abre en Tomás. Un hijo que no es de la cuenta
    // se ignora y se muestra el último elegido o el primero.
    const { leer, escribir } = useFiltrosDeUrl();
    const hijoPedido = leer("hijo");
    const kid = hijos?.find((h) => h.id === hijoPedido) ?? hijos?.find((h) => h.id === ultimoHijoElegido) ?? hijos?.[0];
    const kidIdx = kid && hijos ? hijos.indexOf(kid) : 0;
    useEffect(() => {
      if (kid) ultimoHijoElegido = kid.id;
    }, [kid]);
    const elegirHijo = (id: string) => escribir({ hijo: id });
  ```
- En el selector de hijos: `onClick={() => setKidIdx(i)}` pasa a `onClick={() => elegirHijo(h.id)}` y se agrega `aria-pressed={i === kidIdx}`.

- [ ] **Step 5: Verificar**

```bash
cd client && pnpm typecheck && pnpm lint
bash $SCRATCH/preparar-filtros-2.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-filtros-2.js 2>&1 | python3 $SCRATCH/chequear.py
cd ../server && pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
```
Expected: limpios; `16 bien, 0 mal`. Además, a mano como profesor: tomar asistencia, cargar notas y publicar siguen funcionando igual que antes (el estado de lo tipeado no se pierde al guardar).

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Asistencia, Calificaciones y Mis hijos con curso, fecha, evaluación, período e hijo en la dirección

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentación y batería completa

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md`
- Modify (memoria, fuera del repo): `/home/agustin/.claude/projects/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/memory/proyecto_babylon_pendientes_futuros.md` y su línea en `MEMORY.md`

- [ ] **Step 1: Corrección en el spec**

En la tabla "Del recurso a la dirección", la fila "Evaluación (próxima)" pasa a `/dashboard` para administración y secretaría, con la nota: "`/reportes` es solo de admin: la secretaría terminaría rebotada; el panel de ambos roles muestra las próximas evaluaciones".

- [ ] **Step 2: `CLAUDE.md`**

1. **Nueva sección "Avisos guardados y en tiempo real (subproyecto 3a)"**, después de "Recuperación de contraseña y envío de correos". Debe explicar:
   - **El tablero de anuncios:** `core/eventos.ts`, `core/alConfirmar.ts`, el registro en `PrismaUnitOfWork`, `sinAnuncios` y `src/eventos.ts`. Regla: publicar siempre dentro de la transacción y pasando `tx`.
   - **El módulo `notificaciones/`:**
     - catálogo de tipos (`notificacion.tipos.ts`) y criterios (`notificacion.criterios.prisma.ts`);
     - sincronización por tipo completo con `pg_advisory_xact_lock` y las reglas de `reconciliar` (clave, nivel, reabrir, resolver);
     - eventos (una vez por clave);
     - destinatarios: solo cuentas activas, por rol;
     - preferencias (`NotificacionDesactivada`; apagar borra);
     - retención de 30 días;
     - `iniciarAvisosPeriodicos`: al arrancar, a las 03:00 y cada 15 minutos para la asistencia.
   - **La conexión en vivo:**
     - `CanalEnVivo`/`CanalEnMemoria` y `GET /api/tiempo-real`: SSE, `fetch` con `Authorization` y nunca el token en la dirección;
     - una conexión por sesión ("reemplazada"), latido de 25 s, corte al vencer, revalidación cada 5 min y 10 aperturas por minuto;
     - solo señales `{ noLeidas }` o `{ motivo }`, sin datos personales;
     - el anuncio `sesiones.cerradas` y cómo el canal corta lo que ya no vale;
     - los motivos de cierre.
   - **En el navegador:**
     - `core/tiempoReal/`: Web Locks y `BroadcastChannel` por `sid`, reconexión 1–30 s, `rechazo`;
     - `irAlLogin` y los mensajes del login;
     - `avisarCierreLocal`.
   - **Criterio único de documentación:** `documento.faltantes.ts`, `GET /api/documentos/faltantes` y el número del panel.
   - **Filtros en la dirección:**
     - `useFiltrosDeUrl`/`elegir` y las reglas (replace, nunca el buscador ni lo escrito sin guardar, un valor inválido cae en el de por defecto);
     - las pantallas de la tanda 1;
     - la tanda 2 pendiente;
     - la memoria `ultimoHijoElegido` de Mis hijos.
   - **Limitaciones:** feriados; un solo servidor (canal y límites en memoria; LISTEN/NOTIFY si hubiera varios).
2. **En la tabla de API:** reemplazar la fila de `GET /api/notificaciones` por las seis rutas nuevas de avisos y sumar `GET /api/tiempo-real` y `GET /api/documentos/faltantes`.
3. **En "Sistema de diseño":** la frase de `NotificationBell.tsx` pasa a describir la campana nueva (número de no leídos, "Ver todas" → `/notificaciones`, marcar leído al tocar). Sumar `Interruptor` (`core/components/ui/interruptor.tsx`) a los componentes de `core/components/ui/`.
4. **En "Mi cuenta":** sumar la sección "Notificaciones" (preferencias por rol).

- [ ] **Step 3: Batería completa**

```bash
cd server && pnpm typecheck && pnpm build
for s in _tablero _reconciliar _faltantes _criterios _canal _avisos-servicio _suscripciones _lector-sse; do echo "== $s"; pnpm exec tsx scripts/$s.ts 2>&1 | python3 $SCRATCH/chequear.py | tail -1; done
bash $SCRATCH/reiniciar-api.sh
for s in faltantes avisos-api anuncios; do echo "== $s"; bash $SCRATCH/$s.sh | python3 $SCRATCH/chequear.py | tail -1; done
pnpm exec tsx scripts/_tiempo-real.ts 2>&1 | python3 $SCRATCH/chequear.py | tail -1
for s in _sesiones _carrera-login _minors-sub2 _ficha-pendiente _invitaciones _activacion; do echo "== $s"; pnpm exec tsx scripts/$s.ts 2>&1 | python3 $SCRATCH/chequear.py | tail -1; done
cd ../client && pnpm typecheck && pnpm lint && pnpm build
bash $SCRATCH/iniciar-client.sh
bash $SCRATCH/preparar-campana.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-campana.js 2>&1 | python3 $SCRATCH/chequear.py | tail -1
cd ../server && pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null
for e in e2e-tiempo-real e2e-preferencias e2e-filtros-1; do echo "== $e"; bash $SCRATCH/e2e.sh $SCRATCH/$e.js 2>&1 | python3 $SCRATCH/chequear.py | tail -1; pnpm exec tsx scripts/_mundo-avisos.ts crear >/dev/null && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar >/dev/null; done
bash $SCRATCH/preparar-filtros-2.sh && bash $SCRATCH/e2e.sh $SCRATCH/e2e-filtros-2.js 2>&1 | python3 $SCRATCH/chequear.py | tail -1
```
Expected: todas `N bien, 0 mal`; typecheck, lint y build limpios en los dos proyectos. Los recorridos de las baterías de los subproyectos 1 y 2 que usan el navegador (`e2e-*.js` de esos subproyectos) ya no están en el scratchpad. Si hace falta volver a correrlos, se toman del historial de la sesión; no son parte de esta batería.

- [ ] **Step 4: Nada de prueba quedó en la base**

```bash
cd server && pnpm exec tsx scripts/_mundo-avisos.ts borrar && pnpm exec tsx scripts/_mundo-avisos.ts sincronizar
source $SCRATCH/lib.sh
ok "usuarios de prueba" "$(q "select count(*) from \"Usuario\" where id like 'prueba-tmp-%' or email like 'prueba-tmp-%'")" 0
ok "alumnos de prueba" "$(q "select count(*) from \"Alumno\" where id like 'prueba-tmp-%' or dni like '994000%'")" 0
ok "cursos de prueba" "$(q "select count(*) from \"Curso\" where id like 'prueba-tmp-%'")" 0
ok "avisos huérfanos" "$(q "select count(*) from \"Notificacion\" n left join \"Usuario\" u on u.id=n.\"usuarioId\" where u.id is null")" 0
ok "la contraseña de p6 sigue siendo la de siempre" "$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"p6@prueba.babylon.test","password":"prueba1234"}')" 200
```
(La salida va por `python3 $SCRATCH/chequear.py`.) Expected: `5 bien, 0 mal`.

- [ ] **Step 5: Memoria**

En `proyecto_babylon_pendientes_futuros.md`: el subproyecto 3a queda hecho (en rama, falta fusionar). Siguen 3b (chat en vivo + "visto" + aviso de mensaje nuevo, agrupado y que no le llega a quien lo manda), 3c (pantallas que se actualizan solas + aviso de versión nueva), la tanda 2 de filtros en la dirección (Reportes, Cursos, Usuarios, Profesores, Observaciones, Chats, pestañas del legajo) y el 4 (2FA: preguntar si es obligatorio por rol y qué método, TOTP o código por email). Actualizar la línea de `MEMORY.md`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-15-avisos-en-tiempo-real-design.md
git commit -m "Documentar los avisos guardados y en tiempo real, el tablero de anuncios y los filtros en la dirección

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
