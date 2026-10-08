# Mi cuenta y sesiones por dispositivo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el contador de sesiones por una tabla de sesiones (una por dispositivo) y construir la pantalla "Mi cuenta" con datos, cambio de contraseña y sesiones activas, más un logout que cierra la sesión en el servidor.

**Architecture:** `Sesion` es una entidad secundaria del módulo `usuarios/` con su propio puerto (`SesionRepository`) y adaptador Prisma. El token lleva el id de la sesión (`sid`); `authMiddleware` valida con una sola consulta (sesión abierta, no vencida, de esa cuenta, cuenta activa) a través de un validador inyectado desde `container.ts`. Cambiar la contraseña, recuperarla o desactivar la cuenta cierran sesiones; el último uso se registra como máximo cada 5 minutos sin esperar la escritura; una tarea diaria compartida (03:00 de Argentina) depura las sesiones terminadas hace más de 90 días.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4, jsonwebtoken, bcrypt, `express-rate-limit`; React 19, TanStack Query, react-hook-form + zod, React Router, Tailwind 4. Node 24 + pnpm 11. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-08-mi-cuenta-y-sesiones-design.md`

## Global Constraints

- Arquitectura 100% feature-first; `core/` no importa de `modules/`; los repositorios aceptan `tx?: unknown` al final; solo `container.ts` arma dependencias; los services lanzan errores de `core/errors.ts`, nunca códigos HTTP. El puerto `SesionRepository` extiende `Repository<Sesion>`, como el resto.
- Hora de Argentina para todo cálculo de "qué día/hora es" (`core/fechas.ts`); la tarea diaria corre a las **03:00 de Argentina**.
- Token: `{ sub, rol, sid }` con el `exp` de siempre (8 h, o 30 días con "mantener sesión"); **no** hay claim `v`. `expiraEn` de la sesión = `exp` del token.
- Validación por pedido: **una sola consulta**; un token sin `sid`, o cuyo `sub` no es el dueño de la sesión, responde 401.
- `ultimoUsoEn`: se registra como máximo **una vez cada 5 minutos** (`MIN_ENTRE_REGISTROS_DE_USO_MS = 5 * 60 * 1000`) con una actualización condicional **sin esperarla**; también al iniciar sesión y en `GET /api/auth/sesiones` (solo la sesión actual).
- Retención: la tarea diaria borra toda sesión terminada (cerrada o vencida) hace **más de 90 días**, de cualquier cuenta; las activas nunca se borran.
- Cambiar contraseña: exige la actual, la nueva debe ser distinta y cumplir `passwordNueva` (mín. 8 caracteres, máx. 72 **bytes**); cierra las demás sesiones y deja abierta la actual. Una contraseña actual incorrecta responde **400** (no 401). Límite: **5 fallos cada 15 minutos por cuenta**, los exitosos no cuentan; 429 con `"Demasiados intentos, probá de nuevo en unos minutos"`.
- `DELETE /api/auth/sesiones/:id`: 404 si la sesión no existe, es de otra cuenta o ya estaba cerrada; 400 si es la sesión actual.
- Desactivar una cuenta (por `cambiarEstado` o desde la ficha del profesor) y la recuperación de contraseña cierran **todas** las sesiones de la cuenta; reactivarla no las revive.
- Textos de UI y mensajes de error en español rioplatense, como el resto del proyecto. Sin dependencias nuevas.
- No hay test runner: cada "test" de este plan es un script de verificación (curl, `tsx`, Playwright). Los de `tsx` viven en `server/scripts/_*.ts` (ya excluidos de git por `.git/info/exclude`) y los de shell/Playwright en el scratchpad (`$SCRATCH`); **ninguno se commitea**. Toda fila creada por una verificación se borra al terminar y no se toca ningún dato real. Tras cada cambio de código del server, reiniciar la API con `bash $SCRATCH/reiniciar-api.sh`.
- Convención de los scripts: imprimen líneas `etiqueta: real (esperado X)` (con `ok()` de `server/scripts/_check.ts` o con `echo`) y se pasan por `python3 $SCRATCH/chequear.py`, que falla (exit 1) si algún real no coincide con su esperado. `$SCRATCH` es `/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad`.

## Review Focus

1. **Token de una cuenta con la sesión de otra** (`sub` = A, `sid` = sesión de B) o sin `sid`: debe dar 401, no entrar como A (Task 3).
2. **Cuenta desactivada con la sesión todavía abierta en la base** (sin pasar por el service que las cierra): el pedido debe dar 401 igual, porque la consulta exige que la cuenta esté activa (Tasks 2 y 3).
3. **Primer paso del login multi-rol** (sin `rolElegido`): no emite token, así que **no** debe crear ninguna sesión; solo el segundo paso la crea (Task 3).
4. **Depuración**: nunca borra una sesión activa, ni una terminada hace 89 días; sí una terminada (cerrada o vencida) hace 91 (Task 7).
5. **`User-Agent` ausente, vacío o desconocido**: el login funciona y guarda "Dispositivo desconocido" (Tasks 1 y 3).

---

## Estructura de archivos

**Server — crear**
- `server/src/core/dispositivo.ts` — `describirDispositivo(userAgent)`: texto legible del navegador y sistema.
- `server/src/core/tareaDiaria.ts` — `programarTareaDiaria(nombre, tarea)` y `msHastaProximaCorrida` (movido desde cuotas).
- `server/src/modules/usuarios/sesion.entity.ts` — entidad `Sesion` y constante del registro de uso.
- `server/src/modules/usuarios/sesion.repository.ts` / `sesion.repository.prisma.ts` — puerto y adaptador.
- `server/src/modules/usuarios/sesion.validador.ts` — `crearValidadorDeSesion` (validación por pedido + registro de uso).
- `server/src/modules/usuarios/sesion.scheduler.ts` — depuración diaria.
- Migraciones: `20261008120000_sesiones`, `20261008121000_quitar_version_sesion`.

**Server — modificar**: `prisma/schema.prisma`, `core/ports.ts`, `core/middlewares/authMiddleware.ts`, `core/middlewares/limitesDePedidos.ts`, `container.ts`, `server.ts`, `modules/usuarios/{usuario.entity,usuario.repository,usuario.repository.prisma,usuario.service,usuario.controller,usuario.routes,usuario.schema}.ts`, `modules/padres/padre.service.ts`, `modules/profesores/profesor.service.ts`, `modules/cuotas/cuota.scheduler.ts`.

**Client — crear**: `features/cuenta/{types.ts,cuentaService.ts}`, `features/cuenta/hooks/{useCambiarContrasena,useSesiones,useCerrarSesion,useCerrarOtrasSesiones}.ts`, `features/cuenta/components/{CambiarContrasena,SesionesActivas}.tsx`, `features/cuenta/pages/MiCuentaPage.tsx`.

**Client — modificar**: `core/lib/apiClient.ts`, `core/lib/utils.ts`, `features/auth/authService.ts`, `features/auth/hooks/useAuth.ts`, `core/routes/AppRoutes.tsx`, `core/components/layout/AppLayout.tsx`, `core/components/layout/pageTitles.ts`.

**Docs**: `CLAUDE.md`, el spec `2026-10-06-…-design.md` (nota de reemplazo), memoria `proyecto_babylon_pendientes_futuros.md`.

---

### Task 1: Detector de dispositivo

**Files:**
- Create: `server/src/core/dispositivo.ts`
- Create (verificación, no se commitea): `server/scripts/_check.ts`, `server/scripts/_dispositivo.ts`

**Interfaces:**
- Produces: `describirDispositivo(userAgent: string | undefined): string` → `"Chrome en Windows"`, `"Safari en iOS"`, … o `"Dispositivo desconocido"`; `ok(etiqueta, real, esperado)` y `si(booleano)` en `scripts/_check.ts` (los reutilizan las verificaciones de las demás tareas).

- [ ] **Step 1: Escribir el helper y el test que falla**

`server/scripts/_check.ts`:

```ts
// Imprime "etiqueta: real (esperado X)": python3 $SCRATCH/chequear.py compara ambos valores.
export const ok = (etiqueta: string, real: unknown, esperado: unknown) => console.log(`${etiqueta}: ${real} (esperado ${esperado})`);
export const si = (b: boolean) => (b ? "sí" : "no");
```

`server/scripts/_dispositivo.ts`:

```ts
import { describirDispositivo } from "../src/core/dispositivo";
import { ok } from "./_check";

const CASOS: [string, string | undefined, string][] = [
  ["Chrome/Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome en Windows"],
  ["Edge/Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "Edge en Windows"],
  ["Opera/Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0", "Opera en Windows"],
  ["Firefox/Linux", "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox en Linux"],
  ["Safari/macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Safari en macOS"],
  ["Chrome/Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "Chrome en Android"],
  ["Safari/iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Safari en iOS"],
  ["Chrome/iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1", "Chrome en iOS"],
  ["curl", "curl/8.5.0", "Dispositivo desconocido"],
  ["sin encabezado", undefined, "Dispositivo desconocido"],
  ["vacío", "", "Dispositivo desconocido"],
];
for (const [etiqueta, ua, esperado] of CASOS) ok(etiqueta, describirDispositivo(ua), esperado);
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `cd server && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; pnpm exec tsx scripts/_dispositivo.ts 2>&1 | grep -v injected | tail -4`
Expected: error `Cannot find module '../src/core/dispositivo'`.

- [ ] **Step 3: Implementar**

`server/src/core/dispositivo.ts`:

```ts
// Texto legible del dispositivo ("Chrome en Windows") a partir del encabezado User-Agent. Función pura y sin
// dependencias: alcanza para que la persona reconozca sus sesiones, no pretende ser un analizador completo.
// El orden importa: Edge y Opera también dicen "Chrome", y Chrome también dice "Safari"; Android dice
// "Linux" y el iPhone dice "Mac OS X", así que esos se miran antes.
const NAVEGADORES: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SISTEMAS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux|X11/, "Linux"],
];

export function describirDispositivo(userAgent: string | undefined): string {
  if (!userAgent) return "Dispositivo desconocido";
  const navegador = NAVEGADORES.find(([patron]) => patron.test(userAgent))?.[1];
  const sistema = SISTEMAS.find(([patron]) => patron.test(userAgent))?.[1];
  if (navegador && sistema) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? "Dispositivo desconocido";
}
```

- [ ] **Step 4: Correrlo para ver que pasa**

Run: `cd server && pnpm exec tsx scripts/_dispositivo.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[2]}"; pnpm typecheck 2>&1 | tail -1`
Expected: `--- 11/11 ok`, `exit 0`, typecheck sin errores.

- [ ] **Step 5: Commit**

```bash
git add server/src/core/dispositivo.ts
git commit -m "Detector de dispositivo a partir del User-Agent"
```

---

### Task 2: Tabla `Sesion` y su repositorio (todavía sin cablear)

**Files:**
- Modify: `server/prisma/schema.prisma` (model `Sesion` nuevo, relación en `Usuario`)
- Create: `server/prisma/migrations/20261008120000_sesiones/migration.sql`
- Create: `server/src/modules/usuarios/sesion.entity.ts`, `sesion.repository.ts`, `sesion.repository.prisma.ts`
- Create (verificación): `server/scripts/_sesion-repo.ts`

**Interfaces:**
- Consumes: `ok`, `si` (Task 1).
- Produces: interfaz `Sesion { id; usuarioId; dispositivo; ip: string | null; creadaEn: Date; ultimoUsoEn: Date; expiraEn: Date; cerradaEn: Date | null }`; `MIN_ENTRE_REGISTROS_DE_USO_MS`; `SesionRepository extends Repository<Sesion>` con
  `buscarValida(id, usuarioId, ahora): Promise<Sesion | null>`,
  `registrarUso(id, ahora, antesDe): Promise<boolean>` (escribe solo si `ultimoUsoEn < antesDe`),
  `tocar(id, ahora): Promise<void>`,
  `findActivasByUsuario(usuarioId, ahora, tx?): Promise<Sesion[]>` (más recientes primero),
  `cerrar(id, usuarioId, ahora, tx?): Promise<boolean>`,
  `cerrarTodas(usuarioId, ahora, excepto?, tx?): Promise<number>`,
  `depurarTerminadasAntesDe(limite): Promise<number>`; adaptador `PrismaSesionRepository(prisma)`.

- [ ] **Step 1: Escribir el test que falla** — `server/scripts/_sesion-repo.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import type { Sesion } from "../src/modules/usuarios/sesion.entity";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const repo = new PrismaSesionRepository(prisma);
const U = "prueba-tmp-sesiones";
const OTRO = "prueba-tmp-sesiones-otro";
const MIN = 60_000;
const DIA = 86_400_000;
const ahora = new Date();
const en = (ms: number) => new Date(ahora.getTime() + ms);
let n = 0;
const sesion = (c: Partial<Sesion> = {}): Sesion => ({
  id: `prueba-tmp-s${++n}`, usuarioId: U, dispositivo: "Chrome en Windows", ip: "10.0.0.1",
  creadaEn: ahora, ultimoUsoEn: ahora, expiraEn: en(8 * 3_600_000), cerradaEn: null, ...c,
});
const crearUsuario = (id: string) =>
  prisma.usuario.create({ data: { id, nombre: "Tmp", email: `${id}@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
const limpiar = () => prisma.usuario.deleteMany({ where: { id: { in: [U, OTRO] } } }); // la cascada borra sus sesiones

(async () => {
  await limpiar(); await crearUsuario(U); await crearUsuario(OTRO);

  const a = await repo.create(sesion());
  ok("crear y leer", (await repo.findById(a.id))?.dispositivo, "Chrome en Windows");

  ok("sesión abierta es válida", si((await repo.buscarValida(a.id, U, ahora)) !== null), "sí");
  ok("la de otra cuenta no vale", si((await repo.buscarValida(a.id, OTRO, ahora)) === null), "sí");
  const vencida = await repo.create(sesion({ expiraEn: en(-MIN) }));
  ok("vencida no vale", si((await repo.buscarValida(vencida.id, U, ahora)) === null), "sí");
  const cerrada = await repo.create(sesion({ cerradaEn: en(-MIN) }));
  ok("cerrada no vale", si((await repo.buscarValida(cerrada.id, U, ahora)) === null), "sí");
  await prisma.usuario.update({ where: { id: U }, data: { estado: "inactivo" } });
  ok("cuenta desactivada con la sesión abierta no vale", si((await repo.buscarValida(a.id, U, ahora)) === null), "sí");
  await prisma.usuario.update({ where: { id: U }, data: { estado: "activo" } });

  ok("uso reciente no escribe", String(await repo.registrarUso(a.id, ahora, en(-5 * MIN))), "false");
  await prisma.sesion.update({ where: { id: a.id }, data: { ultimoUsoEn: en(-6 * MIN) } });
  const escrituras = await Promise.all(Array.from({ length: 10 }, () => repo.registrarUso(a.id, ahora, en(-5 * MIN))));
  ok("10 pedidos a la vez con el uso vencido: escrituras", escrituras.filter(Boolean).length, 1);
  await prisma.sesion.update({ where: { id: a.id }, data: { ultimoUsoEn: en(-3_600_000) } });
  await repo.tocar(a.id, ahora);
  ok("tocar deja la hora actual", si(Math.abs((await repo.findById(a.id))!.ultimoUsoEn.getTime() - ahora.getTime()) < 1000), "sí");

  ok("activas (excluye vencida y cerrada)", (await repo.findActivasByUsuario(U, ahora)).map((s) => s.id).join(), a.id);
  const b = await repo.create(sesion({ creadaEn: en(MIN) }));
  ok("activas, más reciente primero", (await repo.findActivasByUsuario(U, ahora)).map((s) => s.id).join(), `${b.id},${a.id}`);

  ok("cerrar la propia", String(await repo.cerrar(b.id, U, ahora)), "true");
  ok("cerrar otra vez", String(await repo.cerrar(b.id, U, ahora)), "false");
  ok("cerrar la de otra cuenta", String(await repo.cerrar(a.id, OTRO, ahora)), "false");
  ok("la ajena sigue abierta", si((await repo.buscarValida(a.id, U, ahora)) !== null), "sí");

  const c = await repo.create(sesion());
  const d = await repo.create(sesion());
  ok("cerrarTodas menos una: cantidad", await repo.cerrarTodas(U, ahora, c.id), 2); // a y d
  ok("la exceptuada sigue abierta", si((await repo.buscarValida(c.id, U, ahora)) !== null), "sí");
  ok("la otra quedó cerrada", si((await repo.buscarValida(d.id, U, ahora)) === null), "sí");

  const viejaCerrada = await repo.create(sesion({ cerradaEn: en(-91 * DIA), expiraEn: en(-90 * DIA) }));
  const viejaVencida = await repo.create(sesion({ expiraEn: en(-91 * DIA) }));
  const recienteCerrada = await repo.create(sesion({ cerradaEn: en(-89 * DIA), expiraEn: en(DIA) }));
  const recienteVencida = await repo.create(sesion({ expiraEn: en(-89 * DIA) }));
  ok("depurar: cantidad borrada", await repo.depurarTerminadasAntesDe(en(-90 * DIA)), 2);
  ok("hace 91 días cerrada: borrada", si((await repo.findById(viejaCerrada.id)) === null), "sí");
  ok("hace 91 días vencida: borrada", si((await repo.findById(viejaVencida.id)) === null), "sí");
  ok("hace 89 días cerrada: se conserva", si((await repo.findById(recienteCerrada.id)) !== null), "sí");
  ok("hace 89 días vencida: se conserva", si((await repo.findById(recienteVencida.id)) !== null), "sí");
  ok("activa: se conserva", si((await repo.findById(c.id)) !== null), "sí");

  await repo.create(sesion({ usuarioId: OTRO }));
  await prisma.usuario.delete({ where: { id: OTRO } });
  ok("borrar la cuenta borra sus sesiones", await prisma.sesion.count({ where: { usuarioId: OTRO } }), 0);

  await limpiar();
  ok("limpieza", await prisma.sesion.count({ where: { id: { startsWith: "prueba-tmp-s" } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `cd server && pnpm exec tsx scripts/_sesion-repo.ts 2>&1 | grep -v injected | tail -3`
Expected: error `Cannot find module '../src/modules/usuarios/sesion.repository.prisma'`.

- [ ] **Step 3: Esquema y migración**

En `schema.prisma`, dentro de `model Usuario`, después de `tokensRecuperacion TokenRecuperacion[]` agregar `  sesiones           Sesion[]`, y al final del archivo:

```prisma
// Una sesión por inicio de sesión (por dispositivo). El token lleva su id (`sid`) y solo vale mientras la
// sesión esté abierta (sin `cerradaEn`), no haya vencido (`expiraEn`) y la cuenta esté activa.
model Sesion {
  id          String    @id
  usuarioId   String
  dispositivo String
  ip          String?
  creadaEn    DateTime
  ultimoUsoEn DateTime
  expiraEn    DateTime
  cerradaEn   DateTime?

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId, cerradaEn, expiraEn])
}
```

`server/prisma/migrations/20261008120000_sesiones/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dispositivo" TEXT NOT NULL,
    "ip" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL,
    "ultimoUsoEn" TIMESTAMP(3) NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_cerradaEn_expiraEn_idx" ON "Sesion"("usuarioId", "cerradaEn", "expiraEn");

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Run: `cd server && pnpm prisma migrate deploy 2>&1 | grep -E "Applying|applied|Error"; pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code >/dev/null && echo "esquema = base: SIN DIFERENCIAS"; pnpm prisma generate 2>&1 | grep -ci generated`
Expected: migración aplicada, `SIN DIFERENCIAS`, `1`.

- [ ] **Step 4: Entidad, puerto y adaptador**

`sesion.entity.ts`:

```ts
// Entidad secundaria de usuarios/: una sesión por inicio de sesión (por dispositivo).
export interface Sesion {
  id: string;
  usuarioId: string;
  // Texto legible deducido del navegador, ej. "Chrome en Windows".
  dispositivo: string;
  ip: string | null;
  creadaEn: Date;
  ultimoUsoEn: Date;
  expiraEn: Date;
  cerradaEn: Date | null;
}

// El último uso se registra como máximo una vez cada 5 minutos: una sesión que no se usa no escribe y una que
// se usa sin parar escribe 12 veces por hora, nunca en cada pedido.
export const MIN_ENTRE_REGISTROS_DE_USO_MS = 5 * 60 * 1000;
```

`sesion.repository.ts`:

```ts
import type { Repository } from "../../core/ports";
import type { Sesion } from "./sesion.entity";

export interface SesionRepository extends Repository<Sesion> {
  // Una sola consulta: la sesión solo si es de esa cuenta, no está cerrada ni vencida y la cuenta está activa.
  buscarValida(id: string, usuarioId: string, ahora: Date): Promise<Sesion | null>;
  // Actualiza `ultimoUsoEn` solo si el valor guardado es anterior a `antesDe` (actualización condicional: si dos
  // pedidos coinciden, solo uno escribe). Devuelve si escribió.
  registrarUso(id: string, ahora: Date, antesDe: Date): Promise<boolean>;
  // Marca la sesión como usada ahora, sin condición.
  tocar(id: string, ahora: Date): Promise<void>;
  // Sesiones abiertas y no vencidas de la cuenta, las más recientes primero.
  findActivasByUsuario(usuarioId: string, ahora: Date, tx?: unknown): Promise<Sesion[]>;
  // Cierra una sesión de esa cuenta; false si no existe, es de otra cuenta o ya estaba cerrada/vencida.
  cerrar(id: string, usuarioId: string, ahora: Date, tx?: unknown): Promise<boolean>;
  // Cierra todas las sesiones abiertas de la cuenta, menos `excepto`; devuelve cuántas cerró.
  cerrarTodas(usuarioId: string, ahora: Date, excepto?: string, tx?: unknown): Promise<number>;
  // Borra las sesiones que terminaron (cerradas o vencidas) antes de `limite`; devuelve cuántas. Nunca toca las activas.
  depurarTerminadasAntesDe(limite: Date): Promise<number>;
}
```

`sesion.repository.prisma.ts`:

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Sesion } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";

export class PrismaSesionRepository implements SesionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Sesion | null> {
    return this.client(tx).sesion.findUnique({ where: { id } });
  }

  async findAll(tx?: unknown): Promise<Sesion[]> {
    return this.client(tx).sesion.findMany();
  }

  async create(entidad: Sesion, tx?: unknown): Promise<Sesion> {
    return this.client(tx).sesion.create({ data: entidad });
  }

  async update(id: string, entidad: Sesion, tx?: unknown): Promise<Sesion> {
    try {
      return await this.client(tx).sesion.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Sesion", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).sesion.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Sesion", id);
    }
  }

  async buscarValida(id: string, usuarioId: string, ahora: Date): Promise<Sesion | null> {
    return this.prisma.sesion.findFirst({
      where: { id, usuarioId, cerradaEn: null, expiraEn: { gt: ahora }, usuario: { estado: "activo" } },
    });
  }

  async registrarUso(id: string, ahora: Date, antesDe: Date): Promise<boolean> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { id, ultimoUsoEn: { lt: antesDe } },
      data: { ultimoUsoEn: ahora },
    });
    return count === 1;
  }

  async tocar(id: string, ahora: Date): Promise<void> {
    await this.prisma.sesion.updateMany({ where: { id }, data: { ultimoUsoEn: ahora } });
  }

  async findActivasByUsuario(usuarioId: string, ahora: Date, tx?: unknown): Promise<Sesion[]> {
    return this.client(tx).sesion.findMany({
      where: { usuarioId, cerradaEn: null, expiraEn: { gt: ahora } },
      orderBy: { creadaEn: "desc" },
    });
  }

  async cerrar(id: string, usuarioId: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).sesion.updateMany({
      where: { id, usuarioId, cerradaEn: null, expiraEn: { gt: ahora } },
      data: { cerradaEn: ahora },
    });
    return count === 1;
  }

  async cerrarTodas(usuarioId: string, ahora: Date, excepto?: string, tx?: unknown): Promise<number> {
    const { count } = await this.client(tx).sesion.updateMany({
      where: { usuarioId, cerradaEn: null, ...(excepto ? { id: { not: excepto } } : {}) },
      data: { cerradaEn: ahora },
    });
    return count;
  }

  async depurarTerminadasAntesDe(limite: Date): Promise<number> {
    // Una sesión con `cerradaEn` o `expiraEn` anterior al límite terminó antes del límite; una activa tiene
    // `cerradaEn` nulo y `expiraEn` en el futuro, así que nunca coincide.
    const { count } = await this.prisma.sesion.deleteMany({
      where: { OR: [{ cerradaEn: { lt: limite } }, { expiraEn: { lt: limite } }] },
    });
    return count;
  }
}
```

- [ ] **Step 5: Correr el test y el typecheck**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; pnpm exec tsx scripts/_sesion-repo.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[2]}"`
Expected: typecheck limpio, `--- 26/26 ok`, `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add server/prisma server/src/modules/usuarios/sesion.entity.ts server/src/modules/usuarios/sesion.repository.ts server/src/modules/usuarios/sesion.repository.prisma.ts
git commit -m "Tabla Sesion y su repositorio (sin cablear todavía)"
```

---

### Task 3: El acceso pasa a sesiones (login crea, pedido valida, flujos cierran, se elimina el contador)

**Files:**
- Modify: `server/prisma/schema.prisma` (quitar `versionSesion`), create `server/prisma/migrations/20261008121000_quitar_version_sesion/migration.sql`
- Modify: `server/src/core/ports.ts`, `server/src/core/middlewares/authMiddleware.ts`, `server/src/container.ts`
- Create: `server/src/modules/usuarios/sesion.validador.ts`
- Modify: `usuario.entity.ts`, `usuario.repository.ts`, `usuario.repository.prisma.ts`, `usuario.service.ts`, `usuario.controller.ts`, `padres/padre.service.ts`, `profesores/profesor.service.ts`
- Create (verificación): `$SCRATCH/lib.sh`, `$SCRATCH/verificar-sesiones.sh`, `server/scripts/_forjar-token.ts`, `server/scripts/_sesiones.ts`

**Interfaces:**
- Consumes: `describirDispositivo` (Task 1); `SesionRepository`, `PrismaSesionRepository` (Task 2).
- Produces: `ValidadorDeSesion = (sesionId: string, usuarioId: string) => Promise<boolean>`; `AuthPayload { sub; rol; sesionId }` (`req.auth.sesionId`); `crearValidadorDeSesion(sesionRepo: SesionRepository, reloj?: () => Date): ValidadorDeSesion`; `ContextoDeAcceso { dispositivo: string; ip: string | null }`; `UsuarioService.autenticar(credenciales, contexto)`; constructores `UsuarioService(usuarioRepo, sesionRepo, profesorRepo, unitOfWork, mailer)` y `ProfesorService(profesorRepo, usuarioRepo, sesionRepo, unitOfWork)`; `container.usuarioService` expuesto.

- [ ] **Step 1: Escribir las verificaciones que fallan**

`$SCRATCH/lib.sh` (lo usan también las Tasks 4, 5 y 10):

```bash
SCRATCH=/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad
SERVER="/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server"
API=localhost:4000/api
UA_CHROME_WIN="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
UA_FIREFOX_LINUX="Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"
UA_SAFARI_IPHONE="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
q() { docker exec babylon-postgres psql -U babylon -d babylon -Atc "$1"; }
# login '<json>' (con UA="..." delante para elegir el User-Agent)
login() { curl -s -A "${UA:-curl/8.5.0}" -X POST $API/auth/login -H 'content-type: application/json' -d "$1"; }
tok() { python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"; }
# code TOKEN ruta -> código HTTP de un GET
code() { curl -s -o /dev/null -w "%{http_code}" "$API/$2" -H "authorization: Bearer $1"; }
# claim TOKEN nombre -> valor del claim del JWT
claim() { python3 -c "import sys,base64,json;p=sys.argv[1].split('.')[1];p+='='*(-len(p)%4);print(json.loads(base64.urlsafe_b64decode(p)).get(sys.argv[2],''))" "$1" "$2"; }
uid() { q "select id from \"Usuario\" where email='$1'"; }
cerrar_sesiones() { q "update \"Sesion\" set \"cerradaEn\"=now() where \"usuarioId\"='$(uid "$1")' and \"cerradaEn\" is null" >/dev/null; }
restaurar_p6() { (cd "$SERVER" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && pnpm exec tsx -e 'const {PrismaClient}=require("@prisma/client");const b=require("bcrypt");(async()=>{const p=new PrismaClient();await p.usuario.update({where:{email:"p6@prueba.babylon.test"},data:{passwordHash:await b.hash("prueba1234",10)}});await p.$disconnect();})()' >/dev/null 2>&1); }
```

`server/scripts/_forjar-token.ts` (firma un token con el secreto del server, para probar tokens ajenos o sin `sid`):

```ts
import jwt from "jsonwebtoken";
import { config } from "../src/core/config";

const [sub, rol, sid] = process.argv.slice(2);
process.stdout.write(jwt.sign({ sub, rol, ...(sid ? { sid } : {}) }, config.JWT_SECRET, { expiresIn: "1h" }));
```

`$SCRATCH/verificar-sesiones.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
cd "$SERVER" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null
P6=$(uid p6@prueba.babylon.test); P5=$(uid p5@prueba.babylon.test)
forjar() { pnpm exec tsx scripts/_forjar-token.ts "$@" 2>/dev/null; }
OKP6='{"email":"p6@prueba.babylon.test","password":"prueba1234"}'
cerrar_sesiones p6@prueba.babylon.test

# login: crea la sesión y el token lleva su id
T=$(UA="$UA_CHROME_WIN" login "$OKP6" | tok); SID=$(claim "$T" sid)
echo "el token lleva sid: $([ -n "$SID" ] && echo sí || echo no) (esperado sí)"
echo "el token no lleva el claim v: $([ -z "$(claim "$T" v)" ] && echo sí || echo no) (esperado sí)"
echo "la sesión guardó el dispositivo: $(q "select dispositivo from \"Sesion\" where id='$SID'") (esperado Chrome en Windows)"
echo "la sesión guardó la IP: $([ -n "$(q "select ip from \"Sesion\" where id='$SID'")" ] && echo sí || echo no) (esperado sí)"
echo "vence igual que el token: $(q "select abs(extract(epoch from \"expiraEn\") - $(claim "$T" exp))::int from \"Sesion\" where id='$SID'") (esperado 0)"
echo "duración de la sesión corta: $(( $(claim "$T" exp) - $(claim "$T" iat) )) (esperado 28800)"
TL=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234","recordarme":true}' | tok)
echo "duración con mantener sesión: $(( $(claim "$TL" exp) - $(claim "$TL" iat) )) (esperado 2592000)"
echo "pedido con la sesión abierta: $(code "$T" alumnos/mios) (esperado 200)"

# sin encabezado User-Agent
TS=$(curl -s -H 'User-Agent:' -X POST $API/auth/login -H 'content-type: application/json' -d "$OKP6" | tok)
echo "sin User-Agent: $(q "select dispositivo from \"Sesion\" where id='$(claim "$TS" sid)'") (esperado Dispositivo desconocido)"

# tokens que no deben entrar
echo "token sin sid: $(code "$(forjar "$P6" padre)" alumnos/mios) (esperado 401)"
T5=$(login '{"email":"p5@prueba.babylon.test","password":"prueba1234"}' | tok)
echo "sub de una cuenta con la sesión de otra: $(code "$(forjar "$P6" padre "$(claim "$T5" sid)")" alumnos/mios) (esperado 401)"
echo "sid inexistente: $(code "$(forjar "$P6" padre sesion-que-no-existe)" alumnos/mios) (esperado 401)"
q "update \"Sesion\" set \"expiraEn\"=now()-interval '1 minute' where id='$SID'" >/dev/null
echo "sesión vencida por tiempo: $(code "$T" alumnos/mios) (esperado 401)"
T=$(login "$OKP6" | tok); SID=$(claim "$T" sid)
q "update \"Sesion\" set \"cerradaEn\"=now() where id='$SID'" >/dev/null
echo "sesión cerrada: $(code "$T" alumnos/mios) (esperado 401)"

# cuenta desactivada directamente en la base (sin cerrar las sesiones): igual no entra
T=$(login "$OKP6" | tok)
q "update \"Usuario\" set estado='inactivo' where id='$P6'" >/dev/null
echo "cuenta desactivada con la sesión abierta: $(code "$T" alumnos/mios) (esperado 401)"
q "update \"Usuario\" set estado='activo' where id='$P6'" >/dev/null

# desactivar por el servicio cierra todas; reactivar no las revive
ADMIN=$(login '{"email":"admin@babylon.test","password":"admin1234","rolElegido":"admin"}' | tok)
T1=$(login "$OKP6" | tok); T2=$(login "$OKP6" | tok)
estado() { curl -s -o /dev/null -X PATCH $API/auth/usuarios/$P6/estado -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d "{\"estado\":\"$1\"}"; }
estado inactivo
echo "desactivada: sesiones abiertas: $(q "select count(*) from \"Sesion\" where \"usuarioId\"='$P6' and \"cerradaEn\" is null") (esperado 0)"
estado activo
echo "reactivada: la sesión de antes: $(code "$T1" alumnos/mios) (esperado 401)"
echo "reactivada: login nuevo: $(code "$(login "$OKP6" | tok)" alumnos/mios) (esperado 200)"

# desactivar un profesor desde su ficha cierra sus sesiones
PROF=$(q "select p.id from \"Profesor\" p join \"Usuario\" u on u.id=p.\"usuarioId\" where u.email='profesor@babylon.test'")
TP=$(login '{"email":"profesor@babylon.test","password":"profesor1234"}' | tok)
patch() { curl -s -o /dev/null -X PATCH $API/profesores/$PROF -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d "{\"estado\":\"$1\"}"; }
patch inactivo; patch activo
echo "profesor reactivado: la sesión de antes: $(code "$TP" cursos) (esperado 401)"
echo "profesor reactivado: login nuevo: $(code "$(login '{"email":"profesor@babylon.test","password":"profesor1234"}' | tok)" cursos) (esperado 200)"

# multi-rol: el primer paso no crea sesión, el segundo sí
ADM='{"email":"admin@babylon.test","password":"admin1234"}'
cuenta() { q "select count(*) from \"Sesion\" where \"usuarioId\"='$(uid admin@babylon.test)'"; }
ANTES=$(cuenta); login "$ADM" >/dev/null; DESPUES=$(cuenta)
echo "multi-rol, primer paso: sesiones nuevas: $((DESPUES - ANTES)) (esperado 0)"
login '{"email":"admin@babylon.test","password":"admin1234","rolElegido":"admin"}' >/dev/null
echo "multi-rol, segundo paso: sesiones nuevas: $(( $(cuenta) - DESPUES )) (esperado 1)"

# recuperación de contraseña (servicio directo)
timeout 120 pnpm exec tsx scripts/_sesiones.ts 2>&1 | grep -v injected
```

`server/scripts/_sesiones.ts`:

```ts
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { ok } from "./_check";

const prisma = new PrismaClient();
(async () => {
  const p6 = await prisma.usuario.findFirstOrThrow({ where: { email: "p6@prueba.babylon.test" } });
  const ahora = new Date();
  const abiertas = () => prisma.sesion.count({ where: { usuarioId: p6.id, cerradaEn: null, expiraEn: { gt: new Date() } } });
  await prisma.sesion.createMany({
    data: [1, 2].map((i) => ({ id: `prueba-tmp-rec${i}`, usuarioId: p6.id, dispositivo: "x", ip: null, creadaEn: ahora, ultimoUsoEn: ahora, expiraEn: new Date(ahora.getTime() + 3_600_000) })),
  });
  const token = "token-de-prueba-recuperacion";
  await prisma.tokenRecuperacion.create({
    data: { id: "prueba-tmp-tok", usuarioId: p6.id, hash: createHash("sha256").update(token).digest("hex"), creadoEn: ahora, expiraEn: new Date(ahora.getTime() + 3_600_000) },
  });
  const antes = await abiertas();
  await container.usuarioService.restablecerContrasena(token, "NuevaClave12345");
  ok("recuperación: había sesiones abiertas", antes >= 2 ? "2 o más" : antes, "2 o más");
  ok("recuperación: sesiones abiertas después", await abiertas(), 0);
  await prisma.usuario.update({ where: { id: p6.id }, data: { passwordHash: p6.passwordHash } });
  await prisma.sesion.deleteMany({ where: { id: { startsWith: "prueba-tmp-rec" } } });
  await prisma.tokenRecuperacion.deleteMany({ where: { id: "prueba-tmp-tok" } });
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlas para ver que fallan**

Run: `bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/verificar-sesiones.sh 2>&1 | python3 $SCRATCH/chequear.py | tail -8`
Expected: fallan (el token lleva `v` y no `sid`, no se crea ninguna sesión, `_sesiones.ts` da error porque `container.usuarioService` no existe).

- [ ] **Step 3: Puerto del validador y middleware**

En `core/ports.ts`, reemplazar el bloque `EstadoDeSesion` + `ValidadorDeSesion` (y su comentario) por:

```ts
// Lo que authMiddleware necesita para aceptar un token: que la sesión (`sid`) exista, sea de esa cuenta, esté
// abierta y sin vencer, y que la cuenta siga activa. core/ no puede importar modules/, así que container.ts le
// inyecta la implementación con configurarValidadorDeSesion().
export type ValidadorDeSesion = (sesionId: string, usuarioId: string) => Promise<boolean>;
```

En `core/middlewares/authMiddleware.ts`: `AuthPayload` pasa a

```ts
export interface AuthPayload {
  sub: string;
  rol: Rol;
  // Id de la Sesion con la que se inició (claim `sid` del token): identifica "esta sesión".
  sesionId: string;
}
```

y la función `authMiddleware` completa a:

```ts
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Token no provisto" });
    return;
  }

  let payload: { sub: string; rol: Rol; sid?: string };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as typeof payload;
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  if (!validadorDeSesion) {
    throw new Error("authMiddleware: falta configurar el validador de sesión");
  }
  // Sin `sid` (token emitido antes de existir las sesiones), con una sesión cerrada, vencida o de otra cuenta, o con
  // la cuenta desactivada: 401. Es una sola consulta por pedido.
  if (!payload.sid || !(await validadorDeSesion(payload.sid, payload.sub))) {
    res.status(401).json({ error: "Tu sesión ya no es válida, ingresá de nuevo" });
    return;
  }

  req.auth = { sub: payload.sub, rol: payload.rol, sesionId: payload.sid };
  next();
}
```

`server/src/modules/usuarios/sesion.validador.ts`:

```ts
import type { ValidadorDeSesion } from "../../core/ports";
import type { SesionRepository } from "./sesion.repository";

// Validador que inyecta container.ts en authMiddleware. `reloj` existe para poder fijar la hora en las verificaciones.
export function crearValidadorDeSesion(sesionRepo: SesionRepository, reloj: () => Date = () => new Date()): ValidadorDeSesion {
  return async (sesionId, usuarioId) => {
    const sesion = await sesionRepo.buscarValida(sesionId, usuarioId, reloj());
    return sesion !== null;
  };
}
```

- [ ] **Step 4: Entidad, repositorio de usuarios, servicios y controller**

`usuario.entity.ts`: borrar el campo y su comentario (`// Versión de las sesiones: ...` y `versionSesion: number;`).

`usuario.repository.ts`: dejar `CambiosUsuario` así y ajustar el comentario de `actualizarParcial`:

```ts
export type CambiosUsuario = Partial<Pick<Usuario, "nombre" | "email" | "passwordHash" | "estado">>;
```

```ts
  // Cambia SOLO los campos indicados, sin reescribir el resto de la fila: así dos cambios simultáneos sobre la
  // misma cuenta (por ejemplo una contraseña nueva y un cambio de estado) no se pisan.
  actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario>;
```

`usuario.repository.prisma.ts`, `actualizarParcial` completo:

```ts
  async actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario> {
    try {
      const fila = await this.client(tx).usuario.update({
        where: { id },
        data: { ...cambios, ...(cambios.email !== undefined ? { email: normalizarEmail(cambios.email) } : {}) },
      });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Usuario", id);
    }
  }
```

`usuario.service.ts`:
1. Agregar `import { describirDispositivo }`? No: el controller lo usa. Agregar `import type { SesionRepository } from "./sesion.repository";` y, debajo de `UsuarioSinPassword`:

```ts
// Datos del pedido de login que se guardan en la sesión (los arma el controller a partir de la request).
export interface ContextoDeAcceso {
  dispositivo: string;
  ip: string | null;
}
```

2. Constructor:

```ts
  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly sesionRepo: SesionRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly mailer: Mailer,
  ) {}
```

3. `autenticar`: la firma pasa a `async autenticar({ email, password, rolElegido, recordarme }: CredencialesInput, contexto: ContextoDeAcceso): Promise<ResultadoAutenticacion>` y el bloque que firma el token (`const token = jwt.sign(...)` completo) a:

```ts
    const sesionId = randomUUID();
    const token = jwt.sign({ sub: usuario.id, rol: rolActivo, sid: sesionId }, config.JWT_SECRET, {
      expiresIn: (recordarme ? config.JWT_EXPIRES_IN_RECORDAR : config.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
    });
    // La sesión vence cuando vence el token.
    const { exp } = jwt.decode(token) as { exp: number };
    const ahora = new Date();
    await this.sesionRepo.create({
      id: sesionId,
      usuarioId: usuario.id,
      dispositivo: contexto.dispositivo,
      ip: contexto.ip,
      creadaEn: ahora,
      ultimoUsoEn: ahora,
      expiraEn: new Date(exp * 1000),
      cerradaEn: null,
    });
```

4. `crearUsuarioSimple`: borrar la línea `      versionSesion: 0,`.

5. `cambiarEstado`, bloque dentro de `runInTransaction`:

```ts
    const actualizado = await this.unitOfWork.runInTransaction(async (tx) => {
      const resultado = await this.usuarioRepo.actualizarParcial(id, { estado }, tx);
      // Al desactivar se cierran todas las sesiones de la cuenta: reactivarla más tarde no las revive.
      if (estado === "inactivo") await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      return resultado;
    });
```

6. `restablecerContrasena`: el comentario pasa a `// ...y cierra todas las sesiones abiertas.` y la línea de `actualizarParcial` a:

```ts
      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuario.id, ahora, undefined, tx);
```

`usuario.controller.ts`: importar `import { describirDispositivo } from "../../core/dispositivo";` y reemplazar `login`:

```ts
  login = async (req: Request, res: Response) => {
    const credenciales = credencialesSchema.parse(req.body);
    const sesion = await this.usuarioService.autenticar(credenciales, {
      dispositivo: describirDispositivo(req.headers["user-agent"]),
      ip: req.ip ?? null,
    });
    res.status(200).json(sesion);
  };
```

`padres/padre.service.ts`: borrar la línea `        versionSesion: 0,` (queda `fechaCreacion: new Date(),` seguido de `};`).

`profesores/profesor.service.ts`: borrar `        versionSesion: 0,`; importar `import type { SesionRepository } from "../usuarios/sesion.repository";`; constructor:

```ts
  constructor(
    private readonly profesorRepo: ProfesorRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly sesionRepo: SesionRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}
```

y en `actualizarProfesor`, reemplazar la llamada a `actualizarParcial` (con `invalidarSesiones`) por:

```ts
          // Solo los campos que cambian (no se reescribe la fila).
          await this.usuarioRepo.actualizarParcial(
            usuario.id,
            {
              nombre: `${actualizado.nombre} ${actualizado.apellido ?? ""}`.trim(),
              ...(datos.email ? { email: datos.email } : {}),
              estado: actualizado.estado,
            },
            tx,
          );
          // Desactivar al profesor cierra todas sus sesiones: reactivarlo más tarde no las revive.
          if (actualizado.estado === "inactivo") await this.sesionRepo.cerrarTodas(usuario.id, new Date(), undefined, tx);
```

- [ ] **Step 5: `container.ts`**

Agregar los imports `PrismaSesionRepository`, `crearValidadorDeSesion`; reemplazar el bloque del validador (el `configurarValidadorDeSesion(async (usuarioId) => {...});` que usa `usuarioRepository`) por:

```ts
const sesionRepository = new PrismaSesionRepository(prisma);
configurarValidadorDeSesion(crearValidadorDeSesion(sesionRepository));
```

Cambiar las dos construcciones y exponer el service:

```ts
const usuarioService = new UsuarioService(usuarioRepository, sesionRepository, profesorRepository, unitOfWork, mailer);
```
```ts
const profesorService = new ProfesorService(profesorRepository, usuarioRepository, sesionRepository, unitOfWork);
```

y en el objeto `container`, junto a `cuotaService`: `  // Expuesto para la depuración diaria de sesiones y para verificar los flujos.` / `  usuarioService,`.

- [ ] **Step 6: Esquema y migración que quitan el contador**

En `schema.prisma`, borrar de `model Usuario` el comentario y la línea `versionSesion Int @default(0)`. Crear `server/prisma/migrations/20261008121000_quitar_version_sesion/migration.sql`:

```sql
-- Las sesiones pasan a la tabla "Sesion" (una por dispositivo): el contador por cuenta ya no se usa. Los tokens
-- emitidos antes de este cambio no llevan el id de sesión y dejan de valer: hay que iniciar sesión de nuevo.
ALTER TABLE "Usuario" DROP COLUMN "versionSesion";
```

Run: `cd server && pnpm prisma migrate deploy 2>&1 | grep -E "Applying|Error"; pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code >/dev/null && echo "esquema = base: SIN DIFERENCIAS"; pnpm prisma generate 2>&1 | grep -ci generated; pnpm typecheck 2>&1 | tail -6`
Expected: migración aplicada, `SIN DIFERENCIAS`, `1`, typecheck sin errores (si falla por algún `versionSesion` restante, `grep -rn versionSesion src` y quitarlo).

- [ ] **Step 7: Correr las verificaciones**

Run: `bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/verificar-sesiones.sh 2>&1 | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[1]}"`
Expected: todas las líneas coinciden (`--- 24/24 ok`, `exit 0`).

- [ ] **Step 8: Retirar los scripts viejos que dependían del contador, compilar y commit**

Run: `rm -f $SCRATCH/verificar-sesion.sh; cd server && pnpm build 2>&1 | tail -1` (`verificar-sesion.sh` probaba el contador y queda reemplazado por `verificar-sesiones.sh`; `verificar-menores.sh` se adapta en la Task 10)

```bash
git add server/prisma server/src
git commit -m "El acceso pasa a sesiones por dispositivo: login crea, cada pedido valida, desactivar y recuperar cierran; se elimina versionSesion"
```

---

### Task 4: Cerrar sesión de verdad y administrar las sesiones (API)

**Files:**
- Modify: `server/src/modules/usuarios/usuario.service.ts`, `usuario.controller.ts`, `usuario.routes.ts`
- Create (verificación): `$SCRATCH/verificar-sesiones-api.sh`

**Interfaces:**
- Consumes: `SesionRepository` (Task 2), `req.auth.sesionId` (Task 3), `$SCRATCH/lib.sh`.
- Produces: `POST /api/auth/logout` → 204; `GET /api/auth/sesiones` → `SesionActivaVista[]`; `DELETE /api/auth/sesiones/:id` → 204; `POST /api/auth/sesiones/cerrar-otras` → `{ cerradas: number }`. `SesionActivaVista { id; dispositivo; ip: string | null; creadaEn: Date; ultimoUsoEn: Date; actual: boolean }`.

- [ ] **Step 1: Escribir la verificación que falla** — `$SCRATCH/verificar-sesiones-api.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
OKP6='{"email":"p6@prueba.babylon.test","password":"prueba1234"}'
cerrar_sesiones p6@prueba.babylon.test; cerrar_sesiones p5@prueba.babylon.test
TA=$(UA="$UA_CHROME_WIN" login "$OKP6" | tok); sleep 0.05
TB=$(UA="$UA_FIREFOX_LINUX" login "$OKP6" | tok); sleep 0.05
TC=$(UA="$UA_SAFARI_IPHONE" login "$OKP6" | tok)
T5=$(login '{"email":"p5@prueba.babylon.test","password":"prueba1234"}' | tok)
SA=$(claim "$TA" sid); SB=$(claim "$TB" sid); SC=$(claim "$TC" sid); S5=$(claim "$T5" sid)
get() { curl -s "$API/auth/sesiones" -H "authorization: Bearer $1"; }
js() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
borrar() { curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/auth/sesiones/$2" -H "authorization: Bearer $1"; }

echo "sin token: $(curl -s -o /dev/null -w '%{http_code}' $API/auth/sesiones) (esperado 401)"
LISTA=$(get "$TA")
echo "lista: cantidad de sesiones: $(echo "$LISTA" | js 'len(d)') (esperado 3)"
echo "lista: la más reciente primero: $(echo "$LISTA" | js 'd[0]["dispositivo"]') (esperado Safari en iOS)"
echo "lista: dispositivos: $(echo "$LISTA" | js '",".join(sorted(x["dispositivo"] for x in d))') (esperado Chrome en Windows,Firefox en Linux,Safari en iOS)"
echo "lista: solo una es la actual: $(echo "$LISTA" | js 'sum(1 for x in d if x["actual"])') (esperado 1)"
echo "lista: la actual es la propia: $(echo "$LISTA" | js '[x["dispositivo"] for x in d if x["actual"]][0]') (esperado Chrome en Windows)"
echo "lista: no expone datos de otras cuentas: $(echo "$LISTA" | grep -c "$S5") (esperado 0)"

q "update \"Sesion\" set \"ultimoUsoEn\"=now()-interval '1 hour' where id='$SA'" >/dev/null
get "$TA" >/dev/null
echo "abrir la lista deja la sesión actual con la hora actual: $(q "select (now()-\"ultimoUsoEn\" < interval '1 minute') from \"Sesion\" where id='$SA'") (esperado t)"

echo "cerrar la sesión actual desde la lista: $(borrar "$TA" "$SA") (esperado 400)"
echo "cerrar una sesión de otra cuenta: $(borrar "$TA" "$S5") (esperado 404)"
echo "la de la otra cuenta sigue abierta: $(code "$T5" alumnos/mios) (esperado 200)"
echo "cerrar una inexistente: $(borrar "$TA" sesion-que-no-existe) (esperado 404)"
echo "cerrar la de Firefox: $(borrar "$TA" "$SB") (esperado 204)"
echo "la de Firefox ya no entra: $(code "$TB" alumnos/mios) (esperado 401)"
echo "cerrarla otra vez: $(borrar "$TA" "$SB") (esperado 404)"
echo "la propia sigue: $(code "$TA" alumnos/mios) (esperado 200)"

R=$(curl -s -X POST "$API/auth/sesiones/cerrar-otras" -H "authorization: Bearer $TA")
echo "cerrar las demás: cantidad: $(echo "$R" | js 'd["cerradas"]') (esperado 1)"
echo "la de iPhone ya no entra: $(code "$TC" alumnos/mios) (esperado 401)"
echo "la propia sigue tras cerrar las demás: $(code "$TA" alumnos/mios) (esperado 200)"
echo "cerrar las demás sin otras: cantidad: $(curl -s -X POST "$API/auth/sesiones/cerrar-otras" -H "authorization: Bearer $TA" | js 'd["cerradas"]') (esperado 0)"

echo "logout: $(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/logout -H "authorization: Bearer $TA") (esperado 204)"
echo "tras el logout el mismo token: $(code "$TA" alumnos/mios) (esperado 401)"
echo "logout otra vez con el token cerrado: $(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/logout -H "authorization: Bearer $TA") (esperado 401)"
echo "el logout no toca otras cuentas: $(code "$T5" alumnos/mios) (esperado 200)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/verificar-sesiones-api.sh 2>&1 | python3 $SCRATCH/chequear.py | tail -5`
Expected: fallan (404 en las rutas nuevas).

- [ ] **Step 3: Servicio** — en `usuario.service.ts`, importar `EntityNotFoundError` (`import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";`), agregar el tipo debajo de `ContextoDeAcceso`:

```ts
// Lo que ve la persona de cada una de sus sesiones activas.
export interface SesionActivaVista {
  id: string;
  dispositivo: string;
  ip: string | null;
  creadaEn: Date;
  ultimoUsoEn: Date;
  actual: boolean;
}
```

y estos métodos dentro de la clase (antes de `solicitarRecuperacion`):

```ts
  // Cierra la sesión con la que se hizo el pedido (el token deja de valer en el servidor).
  async cerrarSesion(sesionId: string, usuarioId: string): Promise<void> {
    await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
  }

  // Abrir la lista cuenta como usar la sesión actual (queda con la hora de ahora).
  async listarSesiones(usuarioId: string, sesionActualId: string): Promise<SesionActivaVista[]> {
    const ahora = new Date();
    await this.sesionRepo.tocar(sesionActualId, ahora);
    const sesiones = await this.sesionRepo.findActivasByUsuario(usuarioId, ahora);
    return sesiones.map((s) => ({
      id: s.id,
      dispositivo: s.dispositivo,
      ip: s.ip,
      creadaEn: s.creadaEn,
      ultimoUsoEn: s.ultimoUsoEn,
      actual: s.id === sesionActualId,
    }));
  }

  // 404 si no existe, es de otra cuenta o ya estaba cerrada (no se distingue, para no revelar sesiones ajenas).
  async cerrarSesionAjena(usuarioId: string, sesionActualId: string, sesionId: string): Promise<void> {
    if (sesionId === sesionActualId) {
      throw new ValidationError("Esta es tu sesión actual: usá Cerrar sesión");
    }
    const cerrada = await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
    if (!cerrada) throw new EntityNotFoundError("Sesion", sesionId);
  }

  async cerrarOtrasSesiones(usuarioId: string, sesionActualId: string): Promise<number> {
    return this.sesionRepo.cerrarTodas(usuarioId, new Date(), sesionActualId);
  }
```

- [ ] **Step 4: Controller y rutas** — en `usuario.controller.ts`, agregar dentro de la clase:

```ts
  logout = async (req: Request, res: Response) => {
    await this.usuarioService.cerrarSesion(req.auth!.sesionId, req.auth!.sub);
    res.status(204).end();
  };

  listarSesiones = async (req: Request, res: Response) => {
    res.status(200).json(await this.usuarioService.listarSesiones(req.auth!.sub, req.auth!.sesionId));
  };

  cerrarSesionAjena = async (req: Request, res: Response) => {
    await this.usuarioService.cerrarSesionAjena(req.auth!.sub, req.auth!.sesionId, String(req.params.id));
    res.status(204).end();
  };

  cerrarOtrasSesiones = async (req: Request, res: Response) => {
    const cerradas = await this.usuarioService.cerrarOtrasSesiones(req.auth!.sub, req.auth!.sesionId);
    res.status(200).json({ cerradas });
  };
```

En `usuario.routes.ts`, después de la ruta de `restablecer-contrasena`:

```ts
  // Cualquier rol autenticado: cada persona ve y cierra solo sus propias sesiones.
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/sesiones", authMiddleware, controller.listarSesiones);
  router.post("/sesiones/cerrar-otras", authMiddleware, controller.cerrarOtrasSesiones);
  router.delete("/sesiones/:id", authMiddleware, controller.cerrarSesionAjena);
```

- [ ] **Step 5: Correr la verificación**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/reiniciar-api.sh && bash $SCRATCH/verificar-sesiones-api.sh 2>&1 | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[1]}"`
Expected: typecheck limpio, `--- 24/24 ok`, `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/usuarios
git commit -m "Logout real y administración de sesiones: listar, cerrar una y cerrar las demás"
```

---

### Task 5: Cambiar la contraseña desde "Mi cuenta" (API)

**Files:**
- Modify: `server/src/modules/usuarios/usuario.schema.ts`, `usuario.service.ts`, `usuario.controller.ts`, `usuario.routes.ts`, `server/src/core/middlewares/limitesDePedidos.ts`
- Create (verificación): `$SCRATCH/verificar-cambio-contrasena.sh`

**Interfaces:**
- Consumes: `passwordNueva` (`core/validacion.ts`), `SesionRepository.cerrarTodas` (Task 2), `req.auth.sesionId` (Task 3).
- Produces: `POST /api/auth/cambiar-contrasena` `{ passwordActual, passwordNueva }` → 204; `cambiarContrasenaSchema`; `UsuarioService.cambiarContrasena(usuarioId, sesionActualId, datos)`; `limiteCambioContrasena`.

- [ ] **Step 1: Escribir la verificación que falla** — `$SCRATCH/verificar-cambio-contrasena.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
OKP6='{"email":"p6@prueba.babylon.test","password":"prueba1234"}'
cambiar() { curl -s -w " [%{http_code}]" -X POST "$API/auth/cambiar-contrasena" -H "authorization: Bearer $1" -H 'content-type: application/json' -d "$2"; }
http() { echo "$1" | grep -o '\[[0-9]*\]$' | tr -d '[]'; }

bash $SCRATCH/reiniciar-api.sh >/dev/null
cerrar_sesiones p6@prueba.babylon.test
TA=$(login "$OKP6" | tok); TB=$(UA="$UA_FIREFOX_LINUX" login "$OKP6" | tok)

R=$(cambiar "$TA" '{"passwordActual":"incorrecta","passwordNueva":"NuevaClave12345"}')
echo "contraseña actual incorrecta: $(http "$R") (esperado 400)"
echo "el mensaje lo explica: $(echo "$R" | grep -c 'La contraseña actual no es correcta') (esperado 1)"
echo "equivocarse no cierra la sesión: $(code "$TA" alumnos/mios) (esperado 200)"
echo "nueva igual a la actual: $(http "$(cambiar "$TA" '{"passwordActual":"prueba1234","passwordNueva":"prueba1234"}')") (esperado 400)"
echo "nueva demasiado corta: $(http "$(cambiar "$TA" '{"passwordActual":"prueba1234","passwordNueva":"corta"}')") (esperado 400)"
ENIES=$(python3 -c "print('ñ'*37)")
echo "nueva de 74 bytes: $(http "$(cambiar "$TA" "{\"passwordActual\":\"prueba1234\",\"passwordNueva\":\"$ENIES\"}")") (esperado 400)"
echo "sin token: $(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/cambiar-contrasena -H 'content-type: application/json' -d '{}') (esperado 401)"

bash $SCRATCH/reiniciar-api.sh >/dev/null
cerrar_sesiones p6@prueba.babylon.test
TA=$(login "$OKP6" | tok); TB=$(UA="$UA_FIREFOX_LINUX" login "$OKP6" | tok)
echo "cambio correcto: $(http "$(cambiar "$TA" '{"passwordActual":"prueba1234","passwordNueva":"NuevaClave12345"}')") (esperado 204)"
echo "la sesión desde la que se cambió sigue: $(code "$TA" alumnos/mios) (esperado 200)"
echo "las demás sesiones se cerraron: $(code "$TB" alumnos/mios) (esperado 401)"
echo "con la contraseña vieja ya no entra: $(echo "$(login "$OKP6")" | grep -c 'incorrectos') (esperado 1)"
echo "con la nueva entra: $(code "$(login '{"email":"p6@prueba.babylon.test","password":"NuevaClave12345"}' | tok)" alumnos/mios) (esperado 200)"

bash $SCRATCH/reiniciar-api.sh >/dev/null
TN=$(login '{"email":"p6@prueba.babylon.test","password":"NuevaClave12345"}' | tok)
for i in 1 2 3 4 5; do R=$(cambiar "$TN" '{"passwordActual":"mala","passwordNueva":"OtraClave123456"}'); done
echo "5 intentos fallidos: el último da: $(http "$R") (esperado 400)"
echo "el 6.º intento, aunque sea correcto: $(http "$(cambiar "$TN" '{"passwordActual":"NuevaClave12345","passwordNueva":"OtraClave123456"}')") (esperado 429)"

restaurar_p6
bash $SCRATCH/reiniciar-api.sh >/dev/null
echo "contraseña de prueba restaurada: $(code "$(login "$OKP6" | tok)" alumnos/mios) (esperado 200)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/verificar-cambio-contrasena.sh 2>&1 | python3 $SCRATCH/chequear.py | tail -4`
Expected: fallan (404 en `cambiar-contrasena`). Si el script deja la cuenta de prueba en un estado raro, `restaurar_p6` desde `lib.sh` la deja con `prueba1234`.

- [ ] **Step 3: Schema, límite, servicio, controller y ruta**

`usuario.schema.ts`, al final:

```ts
export const cambiarContrasenaSchema = z.object({
  passwordActual: z.string().min(1, "Ingresá tu contraseña actual"),
  passwordNueva,
});
export type CambiarContrasenaInput = z.infer<typeof cambiarContrasenaSchema>;
```

`limitesDePedidos.ts`, al final:

```ts
// Cambiar la contraseña desde "Mi cuenta": quien tenga una sesión robada no puede adivinar la contraseña actual.
// La clave es la cuenta (va después de authMiddleware) y los cambios exitosos no cuentan.
export const limiteCambioContrasena = rateLimit({
  ...base,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.auth?.sub ?? ipKeyGenerator(req.ip ?? ""),
});
```

`usuario.service.ts`: importar `CambiarContrasenaInput` en el `import type {...} from "./usuario.schema"` y agregar el método (antes de `solicitarRecuperacion`):

```ts
  // Con la sesión abierta: exige la contraseña actual (400 si no coincide, no 401: la sesión sigue válida), la nueva
  // tiene que ser distinta, y se cierran las demás sesiones; la actual sigue abierta.
  async cambiarContrasena(usuarioId: string, sesionActualId: string, datos: CambiarContrasenaInput): Promise<void> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
    if (!(await bcrypt.compare(datos.passwordActual, usuario.passwordHash))) {
      throw new ValidationError("La contraseña actual no es correcta");
    }
    if (datos.passwordActual === datos.passwordNueva) {
      throw new ValidationError("La contraseña nueva debe ser distinta de la actual");
    }
    const passwordHash = await bcrypt.hash(datos.passwordNueva, RONDAS_BCRYPT);
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.actualizarParcial(usuarioId, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuarioId, new Date(), sesionActualId, tx);
    });
  }
```

`usuario.controller.ts`: sumar `cambiarContrasenaSchema` al import de `./usuario.schema` y:

```ts
  cambiarContrasena = async (req: Request, res: Response) => {
    const datos = cambiarContrasenaSchema.parse(req.body);
    await this.usuarioService.cambiarContrasena(req.auth!.sub, req.auth!.sesionId, datos);
    res.status(204).end();
  };
```

`usuario.routes.ts`: importar `limiteCambioContrasena` y agregar junto a las rutas de sesiones:

```ts
  router.post("/cambiar-contrasena", authMiddleware, limiteCambioContrasena, controller.cambiarContrasena);
```

- [ ] **Step 4: Correr la verificación**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/verificar-cambio-contrasena.sh 2>&1 | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[1]}"`
Expected: typecheck limpio, `--- 15/15 ok`, `exit 0`; p6 queda con `prueba1234`.

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "Cambiar la contraseña con la sesión abierta: cierra las demás sesiones, con límite de intentos por cuenta"
```

---

### Task 6: Último uso: registro como máximo cada 5 minutos, sin esperar la escritura

**Files:**
- Modify: `server/src/modules/usuarios/sesion.validador.ts`
- Create (verificación): `server/scripts/_uso.ts`

**Interfaces:**
- Consumes: `SesionRepository.registrarUso`, `MIN_ENTRE_REGISTROS_DE_USO_MS` (Task 2), `crearValidadorDeSesion` (Task 3).
- Produces: el validador pasa a registrar el uso (misma firma `crearValidadorDeSesion(sesionRepo, reloj?)`).

- [ ] **Step 1: Escribir el test que falla** — `server/scripts/_uso.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import { crearValidadorDeSesion } from "../src/modules/usuarios/sesion.validador";
import { MIN_ENTRE_REGISTROS_DE_USO_MS } from "../src/modules/usuarios/sesion.entity";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const real = new PrismaSesionRepository(prisma);
const U = "prueba-tmp-uso";
let escrituras = 0;
let retraso = 0;
// Cuenta las escrituras efectivas de registrarUso y permite demorarlas, para comprobar que no frenan el pedido.
const repo = new Proxy(real, {
  get(obj, prop, rec) {
    const v = Reflect.get(obj, prop, rec);
    if (typeof v !== "function") return v;
    if (prop === "registrarUso") {
      return async (...args: unknown[]) => {
        if (retraso) await new Promise((r) => setTimeout(r, retraso));
        const escribio = await (v as (...a: unknown[]) => Promise<boolean>).apply(obj, args);
        if (escribio) escrituras++;
        return escribio;
      };
    }
    return v.bind(obj);
  },
}) as PrismaSesionRepository;
const validar = crearValidadorDeSesion(repo);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hace = (ms: number) => new Date(Date.now() - ms);

(async () => {
  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.usuario.create({ data: { id: U, nombre: "Tmp", email: `${U}@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
  const sesion = (id: string, c: Record<string, unknown> = {}) =>
    prisma.sesion.create({ data: { id, usuarioId: U, dispositivo: "x", ip: null, creadaEn: new Date(), ultimoUsoEn: new Date(), expiraEn: new Date(Date.now() + 3_600_000), ...c } });
  const ultimo = async (id: string) => (await prisma.sesion.findUniqueOrThrow({ where: { id } })).ultimoUsoEn.getTime();

  await sesion("prueba-tmp-u1");
  for (let i = 0; i < 20; i++) await validar("prueba-tmp-u1", U);
  await espera(300);
  ok("20 pedidos seguidos con el uso reciente: escrituras", escrituras, 0);

  await prisma.sesion.update({ where: { id: "prueba-tmp-u1" }, data: { ultimoUsoEn: hace(MIN_ENTRE_REGISTROS_DE_USO_MS + 60_000) } });
  await Promise.all(Array.from({ length: 10 }, () => validar("prueba-tmp-u1", U)));
  await espera(400);
  ok("10 pedidos a la vez con el uso vencido: escrituras", escrituras, 1);
  ok("el uso quedó con la hora actual", si(Date.now() - (await ultimo("prueba-tmp-u1")) < 5_000), "sí");
  await validar("prueba-tmp-u1", U);
  await espera(300);
  ok("un pedido más enseguida: escrituras", escrituras, 1);

  await sesion("prueba-tmp-u2", { cerradaEn: new Date(), ultimoUsoEn: hace(MIN_ENTRE_REGISTROS_DE_USO_MS + 60_000) });
  ok("sesión cerrada: el validador responde", String(await validar("prueba-tmp-u2", U)), "false");
  await espera(300);
  ok("sesión cerrada con el uso vencido: escrituras", escrituras, 1);

  await prisma.sesion.update({ where: { id: "prueba-tmp-u1" }, data: { ultimoUsoEn: hace(MIN_ENTRE_REGISTROS_DE_USO_MS + 60_000) } });
  retraso = 500;
  const t0 = Date.now();
  const valida = await validar("prueba-tmp-u1", U);
  const ms = Date.now() - t0;
  ok("la escritura demorada no frena el pedido", si(valida && ms < 150), "sí");
  await espera(900);
  ok("y se completa después: escrituras", escrituras, 2);

  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `cd server && pnpm exec tsx scripts/_uso.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py | tail -6`
Expected: fallan (el validador todavía no registra uso: `escrituras` queda en 0 en el caso de uso vencido).

- [ ] **Step 3: Implementar** — reemplazar `sesion.validador.ts` por:

```ts
import type { ValidadorDeSesion } from "../../core/ports";
import { MIN_ENTRE_REGISTROS_DE_USO_MS } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";

// Validador que inyecta container.ts en authMiddleware. `reloj` existe para poder fijar la hora en las verificaciones.
//
// Además de validar, registra el último uso de la sesión, pero sin escribir en cada pedido: la consulta de validación
// ya trae `ultimoUsoEn`, y solo si pasaron 5 minutos se lanza una actualización condicional que NO se espera (no suma
// tiempo al pedido; si dos pedidos coinciden, solo uno escribe). Una sesión sin uso no escribe nada.
export function crearValidadorDeSesion(sesionRepo: SesionRepository, reloj: () => Date = () => new Date()): ValidadorDeSesion {
  return async (sesionId, usuarioId) => {
    const ahora = reloj();
    const sesion = await sesionRepo.buscarValida(sesionId, usuarioId, ahora);
    if (!sesion) return false;

    if (ahora.getTime() - sesion.ultimoUsoEn.getTime() >= MIN_ENTRE_REGISTROS_DE_USO_MS) {
      const antesDe = new Date(ahora.getTime() - MIN_ENTRE_REGISTROS_DE_USO_MS);
      void sesionRepo
        .registrarUso(sesionId, ahora, antesDe)
        .catch((error) => console.error("[sesiones] no se pudo registrar el último uso:", error));
    }
    return true;
  };
}
```

- [ ] **Step 4: Correr el test, la verificación de sesiones y el typecheck**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; pnpm exec tsx scripts/_uso.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[2]}"; bash $SCRATCH/reiniciar-api.sh >/dev/null && bash $SCRATCH/verificar-sesiones.sh 2>&1 | python3 $SCRATCH/chequear.py | tail -2`
Expected: typecheck limpio, `--- 8/8 ok`, `exit 0`, y la verificación de sesiones de la Task 3 sigue en `--- 24/24 ok`.

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/usuarios/sesion.validador.ts
git commit -m "Último uso de la sesión: registro como máximo cada 5 minutos, sin esperar la escritura"
```

---

### Task 7: Tarea diaria compartida y depuración de sesiones terminadas (90 días)

**Files:**
- Create: `server/src/core/tareaDiaria.ts`, `server/src/modules/usuarios/sesion.scheduler.ts`
- Modify: `server/src/modules/cuotas/cuota.scheduler.ts`, `server/src/modules/usuarios/usuario.service.ts`, `server/src/server.ts`
- Create (verificación): `server/scripts/_depuracion.ts`

**Interfaces:**
- Consumes: `SesionRepository.depurarTerminadasAntesDe` (Task 2), `container.usuarioService` (Task 3), `fechaHoraEnArgentina` (`core/fechas.ts`).
- Produces: `msHastaProximaCorrida(ahora?): number` y `programarTareaDiaria(nombre: string, tarea: () => Promise<void>): void` en `core/tareaDiaria.ts`; `UsuarioService.depurarSesionesTerminadas(ahora?): Promise<number>`; `iniciarDepuracionDeSesiones(usuarioService)`.

- [ ] **Step 1: Escribir la verificación que falla** — `server/scripts/_depuracion.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { msHastaProximaCorrida } from "../src/core/tareaDiaria";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const U = "prueba-tmp-depuracion";
const DIA = 86_400_000;
const ahora = new Date();
const en = (ms: number) => new Date(ahora.getTime() + ms);
const min = (iso: string) => Math.round(msHastaProximaCorrida(new Date(iso)) / 60_000);

(async () => {
  // La hora de corrida es las 03:00 de Argentina (UTC-3), sin importar la zona del servidor.
  ok("00:00 AR", min("2026-10-01T03:00:00Z"), 180);
  ok("02:59 AR", min("2026-10-01T05:59:00Z"), 1);
  ok("03:00 AR (ya pasó: mañana)", min("2026-10-01T06:00:00Z"), 1440);
  ok("15:30 AR", min("2026-10-01T18:30:00Z"), 690);

  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.usuario.create({ data: { id: U, nombre: "Tmp", email: `${U}@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
  const sesion = (id: string, c: Record<string, unknown>) =>
    prisma.sesion.create({ data: { id: `prueba-tmp-d-${id}`, usuarioId: U, dispositivo: "x", ip: null, creadaEn: ahora, ultimoUsoEn: ahora, expiraEn: en(DIA), cerradaEn: null, ...c } });
  await sesion("cerrada91", { cerradaEn: en(-91 * DIA), expiraEn: en(-90 * DIA) });
  await sesion("vencida91", { expiraEn: en(-91 * DIA) });
  await sesion("cerrada89", { cerradaEn: en(-89 * DIA) });
  await sesion("vencida89", { expiraEn: en(-89 * DIA) });
  await sesion("activa", {});
  await sesion("activa-vieja", { creadaEn: en(-200 * DIA), expiraEn: en(DIA) }); // inicio viejo pero sigue abierta

  const borradas = await container.usuarioService.depurarSesionesTerminadas(ahora);
  ok("sesiones borradas", borradas, 2);
  const existe = async (id: string) => (await prisma.sesion.count({ where: { id: `prueba-tmp-d-${id}` } })) === 1;
  ok("cerrada hace 91 días: borrada", si(!(await existe("cerrada91"))), "sí");
  ok("vencida hace 91 días: borrada", si(!(await existe("vencida91"))), "sí");
  ok("cerrada hace 89 días: se conserva", si(await existe("cerrada89")), "sí");
  ok("vencida hace 89 días: se conserva", si(await existe("vencida89")), "sí");
  ok("activa: se conserva", si(await existe("activa")), "sí");
  ok("activa con inicio viejo: se conserva", si(await existe("activa-vieja")), "sí");

  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `cd server && pnpm exec tsx scripts/_depuracion.ts 2>&1 | grep -v injected | tail -3`
Expected: error `Cannot find module '../src/core/tareaDiaria'`.

- [ ] **Step 3: Utilidad de tarea diaria**

`server/src/core/tareaDiaria.ts`:

```ts
import { fechaHoraEnArgentina } from "./fechas";

// Hora de Argentina a la que corren las tareas diarias, sin importar en qué región u huso horario esté el servidor.
const HORA_DE_CORRIDA = 3;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Milisegundos desde `ahora` hasta la próxima ocurrencia de HORA_DE_CORRIDA:00 (hora de Argentina). Argentina no usa
// horario de verano, así que el día dura siempre 24 h y alcanza con restar sobre el reloj civil.
export function msHastaProximaCorrida(ahora: Date = new Date()): number {
  const { hora, minuto, segundo } = fechaHoraEnArgentina(ahora);
  const transcurridoDelDia = ((hora * 60 + minuto) * 60 + segundo) * 1000 + ahora.getMilliseconds();
  const espera = HORA_DE_CORRIDA * 60 * 60 * 1000 - transcurridoDelDia;
  return espera > 0 ? espera : espera + UN_DIA_MS;
}

// Corre `tarea` al arrancar y después una vez por día, a las 03:00 de Argentina. Cada tarea maneja sus propios
// errores: una que falla se registra con su nombre y no impide que corran las demás ni la del día siguiente.
export function programarTareaDiaria(nombre: string, tarea: () => Promise<void>): void {
  const correr = async () => {
    try {
      await tarea();
    } catch (error) {
      console.error(`[${nombre}] falló la tarea diaria:`, error);
    }
  };
  const programarSiguiente = () => {
    setTimeout(async () => {
      await correr();
      programarSiguiente();
    }, msHastaProximaCorrida()).unref();
  };
  void correr();
  programarSiguiente();
}
```

`cuota.scheduler.ts` completo:

```ts
import { programarTareaDiaria } from "../../core/tareaDiaria";
import type { CuotaService } from "./cuota.service";

// Mantenimiento de cuotas: corre al arrancar y una vez por día a las 03:00 de Argentina (ver core/tareaDiaria.ts). No
// depende de que sea día 1 o día 11: mira el estado (cuotas pendientes ya vencidas, alumnos sin cuota del mes), así que el
// día 1 crea las del mes, el día 11 marca las vencidas y el resto de los días no cambia nada. Si el servidor estuvo
// apagado en esas fechas, la corrida de arranque lo pone al día.
export function iniciarMantenimientoDeCuotas(cuotaService: CuotaService): void {
  programarTareaDiaria("cuotas", async () => {
    const { vencidas, generadas } = await cuotaService.mantenerCuotas();
    if (vencidas > 0 || generadas > 0) {
      console.log(`[cuotas] ${generadas} generada(s), ${vencidas} pasada(s) a vencida`);
    }
  });
}
```

`sesion.scheduler.ts`:

```ts
import { programarTareaDiaria } from "../../core/tareaDiaria";
import type { UsuarioService } from "./usuario.service";

// Depuración de sesiones terminadas (cerradas o vencidas hace más de 90 días): misma tarea diaria de las 03:00.
export function iniciarDepuracionDeSesiones(usuarioService: UsuarioService): void {
  programarTareaDiaria("sesiones", async () => {
    const borradas = await usuarioService.depurarSesionesTerminadas();
    if (borradas > 0) console.log(`[sesiones] ${borradas} sesión(es) terminada(s) hace más de 90 días borrada(s)`);
  });
}
```

En `usuario.service.ts`, junto a las constantes de arriba (`const RONDAS_BCRYPT...`): `const DIAS_DE_HISTORIAL_DE_SESIONES = 90;` y el método dentro de la clase:

```ts
  // Borra las sesiones terminadas (cerradas o vencidas) hace más de 90 días, de cualquier cuenta. Las activas no se tocan.
  async depurarSesionesTerminadas(ahora: Date = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - DIAS_DE_HISTORIAL_DE_SESIONES * 24 * 60 * 60 * 1000);
    return this.sesionRepo.depurarTerminadasAntesDe(limite);
  }
```

`server.ts`: importar `import { iniciarDepuracionDeSesiones } from "./modules/usuarios/sesion.scheduler";` y dentro del `app.listen`, después de `iniciarMantenimientoDeCuotas(container.cuotaService);`:

```ts
  iniciarDepuracionDeSesiones(container.usuarioService);
```

- [ ] **Step 4: Correr las verificaciones (también con otra zona horaria del servidor)**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; pnpm exec tsx scripts/_depuracion.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py; echo "exit ${PIPESTATUS[2]}"; TZ=Asia/Tokyo pnpm exec tsx scripts/_depuracion.ts 2>&1 | grep -v injected | python3 $SCRATCH/chequear.py | tail -1; bash $SCRATCH/reiniciar-api.sh; tail -3 $SCRATCH/server.log`
Expected: typecheck limpio, `--- 11/11 ok` con `exit 0` y también con `TZ=Asia/Tokyo`; la API arranca sin errores (`Babylon API escuchando…`).

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "Tarea diaria compartida (03:00 Argentina) y depuración de sesiones terminadas hace más de 90 días"
```

---

### Task 8: Client — logout real y pantalla "Mi cuenta" (datos y contraseña)

**Files:**
- Modify: `client/src/features/auth/authService.ts`, `features/auth/hooks/useAuth.ts`, `core/routes/AppRoutes.tsx`, `core/components/layout/AppLayout.tsx`, `core/components/layout/pageTitles.ts`
- Create: `client/src/features/cuenta/types.ts`, `cuentaService.ts`, `hooks/useCambiarContrasena.ts`, `components/CambiarContrasena.tsx`, `pages/MiCuentaPage.tsx`
- Create (verificación): `$SCRATCH/e2e-cuenta.js`

**Interfaces:**
- Consumes: `POST /api/auth/logout` (Task 4), `POST /api/auth/cambiar-contrasena` (Task 5), `passwordNueva` del client (`core/lib/validacion.ts`).
- Produces: ruta `/mi-cuenta` (todos los roles); `cuentaService.cambiarContrasena`; `authService.logout`; el enlace con `title="Mi cuenta"` al pie del menú.

- [ ] **Step 1: Escribir la prueba e2e que falla** — `$SCRATCH/e2e-cuenta.js`:

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const REAL = "http://localhost:5173", API = "http://localhost:4000";
const SERVER = "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server";
const tokenDe = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem("babylon-session") ?? localStorage.getItem("babylon-session")).state.token);
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
async function entrar(p, email, pass) {
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill(email); await p.locator('input[type="password"]').fill(pass);
  await p.locator('button[type="submit"]').click(); await p.waitForURL(/\/(dashboard|cursos|mis-hijos)/); await p.waitForTimeout(800);
}
function restaurarP6() {
  const hash = execFileSync("node", ["-e", "require('bcrypt').hash('prueba1234',10).then(console.log)"], { cwd: SERVER }).toString().trim();
  execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qc", `update "Usuario" set "passwordHash"='${hash}' where email='p6@prueba.babylon.test'`]);
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await entrar(p, "p6@prueba.babylon.test", "prueba1234");

  await p.locator('a[title="Mi cuenta"]').click(); await p.waitForURL(/mi-cuenta/);
  ok("el enlace del menú lleva a /mi-cuenta", si(p.url().endsWith("/mi-cuenta")), "sí");
  const texto = await p.locator("main").innerText();
  ok("muestra el email", si(texto.includes("p6@prueba.babylon.test")), "sí");
  ok("muestra el rol", si(texto.includes("Padre/Madre/Tutor")), "sí");

  const campos = p.locator('input[type="password"]');
  await campos.nth(0).fill("equivocada1"); await campos.nth(1).fill("NuevaClave12345"); await campos.nth(2).fill("NuevaClave12345");
  await p.getByRole("button", { name: /Cambiar contraseña/ }).click(); await p.waitForTimeout(800);
  ok("contraseña actual incorrecta: muestra el error", si((await p.getByText("La contraseña actual no es correcta").count()) > 0), "sí");
  ok("y sigue en la pantalla con la sesión abierta", si(p.url().endsWith("/mi-cuenta")), "sí");
  const tk = await tokenDe(p);
  ok("el token sigue valiendo", (await fetch(`${API}/api/alumnos/mios`, { headers: { Authorization: `Bearer ${tk}` } })).status, 200);

  await campos.nth(0).fill("prueba1234");
  await p.getByRole("button", { name: /Cambiar contraseña/ }).click(); await p.waitForTimeout(1000);
  ok("cambio correcto: aviso", si((await p.getByText("Contraseña actualizada").count()) > 0), "sí");
  ok("los campos se vacían", await campos.nth(0).inputValue(), "");
  ok("el token sigue valiendo tras cambiarla", (await fetch(`${API}/api/alumnos/mios`, { headers: { Authorization: `Bearer ${tk}` } })).status, 200);

  // validación en el formulario
  await campos.nth(0).fill("NuevaClave12345"); await campos.nth(1).fill("corta"); await campos.nth(2).fill("corta");
  await p.getByRole("button", { name: /Cambiar contraseña/ }).click(); await p.waitForTimeout(400);
  ok("nueva demasiado corta: aviso del formulario", si((await p.getByText("al menos 8 caracteres").count()) > 0), "sí");

  // logout real: el token deja de valer en el servidor
  await p.locator('button[title="Cerrar sesión"]').click(); await p.waitForURL(/login/); await p.waitForTimeout(500);
  ok("tras cerrar sesión, el mismo token en el servidor", (await fetch(`${API}/api/alumnos/mios`, { headers: { Authorization: `Bearer ${tk}` } })).status, 401);

  // mobile
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await entrar(m, "p6@prueba.babylon.test", "NuevaClave12345");
  await m.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await m.waitForTimeout(500);
  ok("móvil: sin desborde horizontal", await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  await m.screenshot({ path: `${process.env.SCRATCH}/shots/mi-cuenta-390.png`, fullPage: true });
  await p.screenshot({ path: `${process.env.SCRATCH}/shots/mi-cuenta-1440.png`, fullPage: true });

  restaurarP6();
  await b.close();
  console.log("limpieza hecha");
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `mkdir -p $SCRATCH/shots; cd $SCRATCH && SCRATCH=$SCRATCH timeout 120 node e2e-cuenta.js 2>&1 | tail -4`
Expected: falla (no existe `a[title="Mi cuenta"]`). Si dejó a p6 con otra contraseña, `restaurar_p6` de `lib.sh` la repone.

- [ ] **Step 3: Logout real, utilidades y servicio**

`authService.ts`, dentro del objeto, agregar:

```ts
  // Cierra la sesión en el servidor; si falla (por ejemplo, ya había vencido) el cierre local igual se hace.
  logout: () => apiClient.post<void>("/api/auth/logout"),
```

`useAuth.ts`, en `useAuth()`:

```ts
  const logout = () => {
    // El pedido sale con el token actual (apiClient lo lee antes de que se borre la sesión local).
    void authService.logout().catch(() => {});
    cerrarSesion();
    queryClient.clear();
    navigate("/login", { replace: true });
  };
```

`features/cuenta/types.ts`:

```ts
export interface CambiarContrasenaInput {
  passwordActual: string;
  passwordNueva: string;
}
```

`features/cuenta/cuentaService.ts`:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { CambiarContrasenaInput } from "./types";

export const cuentaService = {
  cambiarContrasena: (datos: CambiarContrasenaInput) => apiClient.post<void>("/api/auth/cambiar-contrasena", datos),
};
```

`features/cuenta/hooks/useCambiarContrasena.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCambiarContrasena() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cambiarContrasena,
    // Cambiar la contraseña cierra las demás sesiones: la lista de sesiones activas queda desactualizada.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
```

- [ ] **Step 4: Componente de contraseña y página**

`features/cuenta/components/CambiarContrasena.tsx`:

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { passwordNueva } from "@/core/lib/validacion";
import { useCambiarContrasena } from "../hooks/useCambiarContrasena";

const schema = z
  .object({
    passwordActual: z.string().min(1, "Ingresá tu contraseña actual"),
    passwordNueva,
    repetir: z.string(),
  })
  .refine((d) => d.passwordNueva === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" })
  .refine((d) => d.passwordNueva !== d.passwordActual, {
    path: ["passwordNueva"],
    message: "La contraseña nueva debe ser distinta de la actual",
  });
type Formulario = z.infer<typeof schema>;

export function CambiarContrasena() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const cambiar = useCambiarContrasena();
  const [aviso, setAviso] = useState<string | null>(null);

  const onSubmit = ({ passwordActual, passwordNueva }: Formulario) => {
    setAviso(null);
    cambiar.mutate(
      { passwordActual, passwordNueva },
      {
        onSuccess: () => {
          reset();
          setAviso("Contraseña actualizada. Se cerraron tus otras sesiones.");
        },
      },
    );
  };

  const campo = (id: "passwordActual" | "passwordNueva" | "repetir", etiqueta: string, autoComplete: string) => (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <Input id={id} type="password" autoComplete={autoComplete} {...register(id)} />
      {errors[id] && <p className="mt-1.5 text-[12px] text-destructive">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <Panel title="Cambiar contraseña">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4 p-5" noValidate>
        {campo("passwordActual", "Contraseña actual", "current-password")}
        {campo("passwordNueva", "Contraseña nueva", "new-password")}
        {campo("repetir", "Repetir contraseña nueva", "new-password")}
        {cambiar.isError && (
          <p className="text-[12.5px] text-destructive">
            {cambiar.error instanceof ApiError ? cambiar.error.message : "No se pudo cambiar la contraseña"}
          </p>
        )}
        {aviso && (
          <p className="text-[12.5px]" style={{ color: "var(--success)" }}>
            {aviso}
          </p>
        )}
        <Button type="submit" disabled={cambiar.isPending}>
          {cambiar.isPending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </Panel>
  );
}
```

`features/cuenta/pages/MiCuentaPage.tsx`:

```tsx
import { Panel } from "@/core/components/ui/panel";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS } from "@/features/auth/types";
import { CambiarContrasena } from "../components/CambiarContrasena";

export default function MiCuentaPage() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const datos: [string, string][] = [
    ["Nombre", usuario.nombre],
    ["Email", usuario.email],
    ["Rol", ROL_LABELS[usuario.rol]],
  ];

  return (
    <div className="space-y-4">
      <Panel title="Datos">
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-0">
              <dt className="eyebrow">{etiqueta}</dt>
              <dd className="mt-1 break-words text-[13.5px]">{valor}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <CambiarContrasena />
    </div>
  );
}
```

- [ ] **Step 5: Ruta, título y enlace en el menú**

`AppRoutes.tsx`: importar `import MiCuentaPage from "@/features/cuenta/pages/MiCuentaPage";` y, junto a la ruta `/dashboard` (dentro del `ProtectedRoute` sin roles):

```tsx
          <Route path="/mi-cuenta" element={<MiCuentaPage />} />
```

`pageTitles.ts`: agregar a `TITULOS` (antes de `/mis-hijos/calificaciones`): `  { prefijo: "/mi-cuenta", titulo: "Mi cuenta", subtitulo: "Datos, contraseña y sesiones" },`.

`AppLayout.tsx`, en `SidebarContent`, reemplazar el bloque de avatar + nombre:

```tsx
          <Avatar name={usuario.nombre} tone="brand" className="bg-white/10! text-white! border-white/20!" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium text-white">{usuario.nombre}</div>
            <div className="truncate text-[11px]" style={{ color: "var(--sidebar-text-muted)" }}>
              {ROL_LABELS[usuario.rol]}
            </div>
          </div>
```

por:

```tsx
          <Link
            to="/mi-cuenta"
            onClick={onNavigate}
            title="Mi cuenta"
            className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded p-1 transition-colors hover:bg-white/5"
          >
            <Avatar name={usuario.nombre} tone="brand" className="bg-white/10! text-white! border-white/20!" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-white">{usuario.nombre}</div>
              <div className="truncate text-[11px]" style={{ color: "var(--sidebar-text-muted)" }}>
                {ROL_LABELS[usuario.rol]}
              </div>
            </div>
          </Link>
```

- [ ] **Step 6: Typecheck, lint y e2e**

Run: `cd client && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; cd $SCRATCH && SCRATCH=$SCRATCH timeout 150 node e2e-cuenta.js 2>&1 | python3 chequear.py; echo "exit ${PIPESTATUS[1]}"`
Expected: typecheck limpio, lint con los 2 avisos de siempre y 0 errores, `--- 12/12 ok`, `exit 0`, y `limpieza hecha`. Mirar `$SCRATCH/shots/mi-cuenta-1440.png` y `mi-cuenta-390.png`.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "Mi cuenta: datos y cambio de contraseña, y logout que cierra la sesión en el servidor"
```

---

### Task 9: Client — sesiones activas en "Mi cuenta"

**Files:**
- Modify: `client/src/core/lib/apiClient.ts`, `core/lib/utils.ts`, `features/cuenta/types.ts`, `features/cuenta/cuentaService.ts`, `features/cuenta/pages/MiCuentaPage.tsx`
- Create: `client/src/features/cuenta/hooks/useSesiones.ts`, `useCerrarSesion.ts`, `useCerrarOtrasSesiones.ts`, `components/SesionesActivas.tsx`
- Create (verificación): `$SCRATCH/e2e-sesiones.js`

**Interfaces:**
- Consumes: `GET /api/auth/sesiones`, `DELETE /api/auth/sesiones/:id`, `POST /api/auth/sesiones/cerrar-otras` (Task 4).
- Produces: `apiClient.delete`, `formatFechaHora(iso)`, `SesionActiva` (tipo del client), la sección "Sesiones activas".

- [ ] **Step 1: Escribir la prueba e2e que falla** — `$SCRATCH/e2e-sesiones.js` (dos contextos de navegador = dos dispositivos):

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const REAL = "http://localhost:5173";
const SERVER = "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server";
const UA_A = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const UA_B = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const UA_C = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
const psql = (sql) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qAtc", sql]).toString().trim();
async function entrar(browser, ua, email, pass) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill(email); await p.locator('input[type="password"]').fill(pass);
  await p.locator('button[type="submit"]').click(); await p.waitForURL(/\/(dashboard|cursos|mis-hijos)/); await p.waitForTimeout(600);
  return p;
}
const filas = (p) => p.locator("section tbody tr, .panel tbody tr, tbody tr");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  psql(`update "Sesion" set "cerradaEn"=now() where "usuarioId"=(select id from "Usuario" where email='p6@prueba.babylon.test') and "cerradaEn" is null`);
  const A = await entrar(b, UA_A, "p6@prueba.babylon.test", "prueba1234");
  const B = await entrar(b, UA_B, "p6@prueba.babylon.test", "prueba1234");
  const C = await entrar(b, UA_C, "p6@prueba.babylon.test", "prueba1234");

  await A.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await A.waitForTimeout(500);
  ok("A ve tres sesiones", await filas(A).count(), 3);
  const textoA = await A.locator("main").innerText();
  ok("figuran los tres dispositivos", si(["Chrome en Windows", "Chrome en Android", "Firefox en Linux"].every((d) => textoA.includes(d))), "sí");
  ok("una sola dice 'Esta sesión'", await A.getByText("Esta sesión", { exact: true }).count(), 1);
  ok("la actual no tiene botón Cerrar (solo las otras dos)", await A.getByRole("button", { name: "Cerrar", exact: true }).count(), 2);
  ok("hay un botón para cerrar las demás", await A.getByRole("button", { name: /Cerrar todas las demás/ }).count(), 1);
  ok("la nota aclara la precisión del último uso", si((await A.getByText(/± 5 min/).count()) > 0), "sí");
  await A.screenshot({ path: `${process.env.SCRATCH}/shots/sesiones-1440.png`, fullPage: true });

  // A cierra la de Android
  await A.locator("tr", { hasText: "Chrome en Android" }).getByRole("button", { name: "Cerrar", exact: true }).click();
  await A.waitForTimeout(800);
  ok("tras cerrar una, A ve dos", await filas(A).count(), 2);
  // B (cerrada) cae al login con el aviso al volver a pedir algo
  await B.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await B.waitForTimeout(1200);
  ok("B termina en el login", si(B.url().includes("/login")), "sí");
  ok("con el aviso de sesión vencida", si((await B.getByText("Tu sesión venció").count()) > 0), "sí");

  // A cierra todas las demás
  await A.getByRole("button", { name: /Cerrar todas las demás/ }).click(); await A.waitForTimeout(800);
  ok("tras cerrar las demás, A ve una", await filas(A).count(), 1);
  ok("ya no hay botón de cerrar las demás", await A.getByRole("button", { name: /Cerrar todas las demás/ }).count(), 0);
  await C.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await C.waitForTimeout(1200);
  ok("C también cayó al login", si(C.url().includes("/login")), "sí");

  // cambiar la contraseña desde A cierra las demás (D es otro dispositivo)
  const D = await entrar(b, UA_B, "p6@prueba.babylon.test", "prueba1234");
  const campos = A.locator('input[type="password"]');
  await A.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await A.waitForTimeout(500);
  ok("A ve dos sesiones (con D)", await filas(A).count(), 2);
  await campos.nth(0).fill("prueba1234"); await campos.nth(1).fill("NuevaClave12345"); await campos.nth(2).fill("NuevaClave12345");
  await A.getByRole("button", { name: /Cambiar contraseña/ }).click(); await A.waitForTimeout(1200);
  ok("tras cambiar la contraseña, la lista de A se actualiza a una", await filas(A).count(), 1);
  await D.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await D.waitForTimeout(1200);
  ok("D cayó al login", si(D.url().includes("/login")), "sí");

  // móvil
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await m.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await m.locator('input[type="email"]').fill("p6@prueba.babylon.test"); await m.locator('input[type="password"]').fill("NuevaClave12345");
  await m.locator('button[type="submit"]').click(); await m.waitForURL(/mis-hijos/); await m.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" }); await m.waitForTimeout(500);
  ok("móvil: sin desborde horizontal de la página", await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  await m.screenshot({ path: `${process.env.SCRATCH}/shots/sesiones-390.png`, fullPage: true });

  const hash = execFileSync("node", ["-e", "require('bcrypt').hash('prueba1234',10).then(console.log)"], { cwd: SERVER }).toString().trim();
  execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qc", `update "Usuario" set "passwordHash"='${hash}' where email='p6@prueba.babylon.test'`]);
  await b.close();
  console.log("limpieza hecha");
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `cd $SCRATCH && SCRATCH=$SCRATCH timeout 180 node e2e-sesiones.js 2>&1 | tail -4`
Expected: la primera comprobación falla (no hay filas de sesiones en "Mi cuenta"). Si dejó a p6 con otra contraseña, `restaurar_p6` de `lib.sh` la repone.

- [ ] **Step 3: `delete` en el cliente HTTP, formato de fecha y tipos**

`apiClient.ts`, dentro del objeto `apiClient`:

```ts
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
```

`utils.ts`, junto a `formatFecha`:

```ts
// "08/10/2026 14:35" en la hora local del navegador (para instantes reales, como el inicio de una sesión).
export function formatFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(",", "");
}
```

`features/cuenta/types.ts`, agregar:

```ts
export interface SesionActiva {
  id: string;
  dispositivo: string;
  ip: string | null;
  creadaEn: string;
  ultimoUsoEn: string;
  // true en la sesión desde la que se está mirando.
  actual: boolean;
}
```

`cuentaService.ts` completo:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { CambiarContrasenaInput, SesionActiva } from "./types";

export const cuentaService = {
  cambiarContrasena: (datos: CambiarContrasenaInput) => apiClient.post<void>("/api/auth/cambiar-contrasena", datos),
  // Abrir la lista cuenta como usar esta sesión (el servidor registra el último uso).
  listarSesiones: () => apiClient.get<SesionActiva[]>("/api/auth/sesiones"),
  cerrarSesion: (id: string) => apiClient.delete<void>(`/api/auth/sesiones/${id}`),
  cerrarOtras: () => apiClient.post<{ cerradas: number }>("/api/auth/sesiones/cerrar-otras"),
};
```

- [ ] **Step 4: Hooks y componente**

`hooks/useSesiones.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useSesiones() {
  return useQuery({ queryKey: ["sesiones"], queryFn: cuentaService.listarSesiones });
}
```

`hooks/useCerrarSesion.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cerrarSesion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
```

`hooks/useCerrarOtrasSesiones.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCerrarOtrasSesiones() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cerrarOtras,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
```

`components/SesionesActivas.tsx`:

```tsx
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/components/ui/table";
import { ApiError } from "@/core/lib/apiClient";
import { formatFechaHora } from "@/core/lib/utils";
import { useCerrarOtrasSesiones } from "../hooks/useCerrarOtrasSesiones";
import { useCerrarSesion } from "../hooks/useCerrarSesion";
import { useSesiones } from "../hooks/useSesiones";

export function SesionesActivas() {
  const { data: sesiones, isLoading } = useSesiones();
  const cerrar = useCerrarSesion();
  const cerrarOtras = useCerrarOtrasSesiones();
  const hayOtras = (sesiones ?? []).some((s) => !s.actual);
  const error = cerrar.error ?? cerrarOtras.error;

  return (
    <Panel
      title="Sesiones activas"
      action={
        hayOtras ? (
          <Button variant="outline" size="sm" disabled={cerrarOtras.isPending} onClick={() => cerrarOtras.mutate()}>
            Cerrar todas las demás
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Son los dispositivos donde tu cuenta tiene la sesión abierta. Si no reconocés alguno, ciérralo y cambiá tu
          contraseña.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {error && (
          <p className="text-[12.5px] text-destructive">
            {error instanceof ApiError ? error.message : "No se pudo cerrar la sesión"}
          </p>
        )}
        {sesiones && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Último uso (± 5 min)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sesiones.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.dispositivo}</span>
                        {s.actual && <Badge variant="success">Esta sesión</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tnum">{s.ip ?? "—"}</TableCell>
                    <TableCell className="tnum whitespace-nowrap">{formatFechaHora(s.creadaEn)}</TableCell>
                    <TableCell className="tnum whitespace-nowrap">{formatFechaHora(s.ultimoUsoEn)}</TableCell>
                    <TableCell className="text-right">
                      {!s.actual && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cerrar.isPending}
                          onClick={() => cerrar.mutate(s.id)}
                        >
                          Cerrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Panel>
  );
}
```

`MiCuentaPage.tsx`: importar `import { SesionesActivas } from "../components/SesionesActivas";` y agregar `      <SesionesActivas />` debajo de `<CambiarContrasena />`.

- [ ] **Step 5: Typecheck, lint y e2e**

Run: `cd client && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; pnpm build 2>&1 | grep "built in"; cd $SCRATCH && SCRATCH=$SCRATCH timeout 200 node e2e-sesiones.js 2>&1 | python3 chequear.py; echo "exit ${PIPESTATUS[1]}"`
Expected: typecheck y build limpios, lint con los 2 avisos de siempre, `--- 16/16 ok`, `exit 0`, `limpieza hecha`. Mirar `$SCRATCH/shots/sesiones-1440.png` y `sesiones-390.png`.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Mi cuenta: sesiones activas, con cierre individual y de todas las demás"
```

---

### Task 10: Adaptar la batería existente, documentar y verificar todo

**Files:**
- Modify (scratchpad, no se commitea): `$SCRATCH/e2e-sesion.js`, `$SCRATCH/verificar-recuperacion.sh`, `$SCRATCH/e2e-recuperacion.js`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-06-sesion-notificaciones-recuperar-contrasena-design.md`, memoria `proyecto_babylon_pendientes_futuros.md` y `MEMORY.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Buscar los restos del contador en los scripts de verificación**

Run: `grep -n "versionSesion" $SCRATCH/*.sh $SCRATCH/*.js`
Expected: aparecen líneas en `e2e-sesion.js` (el caso "sesión vencida") y posiblemente en `verificar-recuperacion.sh` / `e2e-recuperacion.js` (limpieza). Reglas para cada una:
- Una línea que **incrementaba** `versionSesion` para simular un cambio → pasa a cerrar las sesiones de la cuenta: `update "Sesion" set "cerradaEn"=now() where "usuarioId"=(select id from "Usuario" where email='p6@prueba.babylon.test') and "cerradaEn" is null`.
- Una línea que dejaba `versionSesion` igual (sin efecto) → se elimina.
- Una cláusula `, "versionSesion"=...` dentro de un `update` más largo → se quita la cláusula.

- [ ] **Step 2: Correr toda la batería (reiniciando la API donde los límites por IP lo exigen)**

```bash
cd $SCRATCH; R=final-sesiones.out; : > $R
run() { echo "== $1" >> $R; shift; "$@" 2>&1 | python3 chequear.py >> $R; echo "exit ${PIPESTATUS[1]}" >> $R; }
bash reiniciar-api.sh >/dev/null
run "sesiones (api)" bash verificar-sesiones.sh
run "sesiones: administración (api)" bash verificar-sesiones-api.sh
run "cambio de contraseña (api)" bash verificar-cambio-contrasena.sh
run "último uso" bash -c 'cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && pnpm exec tsx scripts/_uso.ts 2>&1 | grep -v injected'
run "depuración y tarea diaria" bash -c 'cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && pnpm exec tsx scripts/_depuracion.ts 2>&1 | grep -v injected'
run "repositorio de sesiones" bash -c 'cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && pnpm exec tsx scripts/_sesion-repo.ts 2>&1 | grep -v injected'
run "dispositivo" bash -c 'cd "/home/agustin/PROYECTOS/Babylon Instituto de Ingles/server" && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null && pnpm exec tsx scripts/_dispositivo.ts 2>&1 | grep -v injected'
bash reiniciar-api.sh >/dev/null
run "mi cuenta (e2e)" env SCRATCH=$SCRATCH node e2e-cuenta.js
run "sesiones activas (e2e)" env SCRATCH=$SCRATCH node e2e-sesiones.js
run "sesión (e2e, adaptado)" node e2e-sesion.js
run "campana (api)" bash verificar-notif-api.sh
run "caché entre usuarios (e2e)" node e2e-cache.js
run "correo" bash verificar-mailer.sh
bash reiniciar-api.sh >/dev/null
run "límites del login" bash verificar-limites-login.sh
bash reiniciar-api.sh >/dev/null
run "recuperación (api)" bash verificar-recuperacion.sh
bash reiniciar-api.sh >/dev/null
run "recuperación (e2e)" env SCRATCH=$SCRATCH node e2e-recuperacion.js
grep -E "^==|^---|^exit|NO COINCIDE|VACÍO|MAL" $R
```

Expected: cada bloque con `exit 0` y sin `NO COINCIDE`/`VALOR VACÍO`. Si `e2e-campana.js` y `e2e-recuperacion.js` imprimen líneas sin el formato `(esperado …)`, el verificador las pasa por sus marcas `MAL`/`ok`; revisar a ojo las líneas que no cumplan el formato. Al final: `select count(*) from "Sesion" where id like 'prueba-tmp-%'` = 0, `select count(*) from "TokenRecuperacion"` = 0, y `p6@prueba.babylon.test` entra con `prueba1234`.

- [ ] **Step 3: Documentación**

`CLAUDE.md`:
1. Reemplazar por completo el punto **"La sesión se valida contra la base en cada pedido"** (en "Autenticación y roles") por:

```
- **Sesiones por dispositivo** (`Sesion`, entidad secundaria de `usuarios/` con su propio `SesionRepository`): cada login crea una fila (dispositivo deducido del `User-Agent` con `core/dispositivo.ts`, IP, inicio, último uso, vencimiento) y el token lleva su id (`sid`; no hay claim `v`). `authMiddleware` valida **en cada pedido con una sola consulta** (validador inyectado por `container.ts` con `configurarValidadorDeSesion(crearValidadorDeSesion(sesionRepository))`, porque `core/` no puede importar `modules/`; sin validador falla cerrado): la sesión existe, es de esa cuenta (`sub`), no está cerrada (`cerradaEn`), no venció (`expiraEn`) y la cuenta está activa; si no, 401, y también para un token sin `sid`. `req.auth` trae `sesionId`. Se cierran sesiones al **cerrar sesión** (`POST /api/auth/logout`, el token deja de valer en el servidor), al **cambiar la contraseña** desde "Mi cuenta" (las demás; la actual sigue), al **recuperarla** y al **desactivar** la cuenta (todas, por cualquier camino: `UsuarioService.cambiarEstado` o la ficha del profesor); reactivar no las revive. **El último uso** (`ultimoUsoEn`) no se escribe en cada pedido: el validador lo registra como máximo cada 5 min con una actualización condicional que no se espera, y también al iniciar sesión y en `GET /api/auth/sesiones`. **Los cambios sobre `Usuario` usan `actualizarParcial` (solo los campos que cambian), no `update` con la fila entera**: así dos cambios simultáneos no se pisan.
- **Retención de sesiones**: las terminadas (cerradas o vencidas) se conservan 90 días y la tarea diaria de las 03:00 (`core/tareaDiaria.ts`, `programarTareaDiaria`, compartida con las cuotas) las borra, de cualquier cuenta; las activas nunca se tocan.
```

2. En "Recuperación de contraseña", reemplazar `incrementa \`versionSesion\` (corta las sesiones abiertas)` por `cierra todas las sesiones de la cuenta`.
3. En la tabla de API, agregar filas: `POST /api/auth/logout` | autenticado | cierra la sesión actual (204); `GET /api/auth/sesiones` | autenticado | sesiones activas propias (marca la actual y registra su uso); `DELETE /api/auth/sesiones/:id` | autenticado | cierra otra sesión propia (404 si no es propia o ya estaba cerrada, 400 si es la actual); `POST /api/auth/sesiones/cerrar-otras` | autenticado | cierra las demás → `{ cerradas }`; `POST /api/auth/cambiar-contrasena` | autenticado | `{ passwordActual, passwordNueva }` → 204, cierra las demás sesiones; actual incorrecta → 400; límite de 5 fallos cada 15 min por cuenta.
4. En "Client — piezas base", agregar: `**Mi cuenta** (`/mi-cuenta`, todos los roles, enlace en el bloque nombre+rol al pie del menú; `features/cuenta/`): datos de la sesión, cambio de contraseña y sesiones activas. `logout()` avisa al servidor (si falla, igual cierra localmente).`

`docs/superpowers/specs/2026-10-06-sesion-notificaciones-recuperar-contrasena-design.md`, al final:

```
## Actualización (2026-10-08): sesiones por dispositivo

Reemplaza a "Sesiones por versión" de la actualización anterior: `Usuario.versionSesion` se eliminó y el acceso pasó a la tabla `Sesion` (una por dispositivo; el token lleva `sid`). Ver `2026-10-08-mi-cuenta-y-sesiones-design.md`.
```

Memoria `proyecto_babylon_pendientes_futuros.md`: reemplazar el párrafo "Próximo, a pedido del usuario…" por: `**Subproyecto 1 de 4 (Mi cuenta y sesiones por dispositivo) hecho el 2026-10-08** (spec y plan en docs/superpowers/). Siguen, en este orden: (2) invitación y verificación de email (invitación por defecto + alta manual alternativa), (3) notificaciones: historial real (30 días, leído/no leído) y preferencias, (4) autenticación en dos pasos. Fuera de alcance de los cuatro: editar nombre/email y cambiar el email con verificación.` y actualizar la línea de `MEMORY.md` en consecuencia.

- [ ] **Step 4: Compilar todo y commit**

Run: `source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; (cd server && pnpm typecheck 2>&1 | tail -1 && pnpm build 2>&1 | tail -1); (cd client && pnpm typecheck 2>&1 | tail -1 && pnpm lint 2>&1 | tail -2 && pnpm build 2>&1 | grep "built in")`
Expected: todo limpio (lint con los 2 avisos de siempre).

```bash
git add CLAUDE.md docs
git commit -m "Documentar sesiones por dispositivo y Mi cuenta"
```
