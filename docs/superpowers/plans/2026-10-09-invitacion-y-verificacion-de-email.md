# Invitación y verificación de email — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar acceso al sistema por invitación (la persona elige su contraseña con un enlace de 7 días), con una pestaña "Pendientes" en Usuarios para invitar de a uno o en lote a quienes no tienen cuenta, la alternativa "Asignar contraseña ahora", y la verificación del email desde Mi cuenta.

**Architecture:** La cuenta invitada se crea al invitar, en estado `pendiente`, con una contraseña inutilizable. Los enlaces por correo (recuperación, invitación, verificación) pasan a una sola tabla `TokenCuenta` con `tipo`. Un servicio nuevo, `InvitacionService` (módulo `usuarios/`), concentra crear cuentas pendientes, invitar, reenviar, cancelar, listar pendientes y activar; las altas existentes (padre, profesor, secretario, administrador) lo usan cuando no reciben contraseña. El correo siempre se envía después de confirmar la transacción.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4, bcrypt, nodemailer (`Mailer`), express-rate-limit; React 19, TanStack Query, react-hook-form + zod, React Router, Tailwind 4. Node 24 + pnpm 11. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-09-invitacion-y-verificacion-de-email-design.md`

## Global Constraints

- Arquitectura feature-first: `core/` no importa de `modules/`; los repositorios aceptan `tx?: unknown` al final; solo `container.ts` arma dependencias; los services lanzan errores de `core/errors.ts`. Toda escritura de varias filas va en `unitOfWork.runInTransaction` pasando `tx` a cada llamada al repositorio.
- **El correo se envía siempre después de confirmar la transacción, nunca adentro.** Una falla de envío no deshace nada: se informa como `"no-enviada"` / `"no se pudo enviar el correo"`.
- Vigencias: recuperación **1 hora**, invitación **7 días**, verificación de email **24 horas**. Un solo enlace vale a la vez por cuenta y tipo (uno nuevo anula los anteriores). En la base se guarda solo el SHA-256 del token.
- Reenviar invitación: espera mínima de **1 minuto** por cuenta. "¿Olvidaste tu contraseña?" sobre una cuenta pendiente reenvía la invitación con los límites de la recuperación (**1 minuto entre envíos y 3 por hora**). Enviar el enlace de verificación: **1 minuto y 3 por hora**, responde **429** al superarlo.
- Lotes: **hasta 100 personas por pedido**; el client divide en tandas de 100.
- Mensaje único de enlace inválido para invitación y verificación: **"El enlace no es válido o ya venció."** (la recuperación conserva el suyo).
- Una cuenta `pendiente` no inicia sesión y el login responde lo mismo que con una inexistente: "Email o contraseña incorrectos".
- Todo email se compara y guarda normalizado (`trim` + minúsculas); nunca `mode: "insensitive"`.
- Los profesores inactivos no se listan en Pendientes ni se pueden invitar.
- Textos de UI en español rioplatense. Las etiquetas visibles son exactamente: **"Sin cuenta"**, **"Pendiente de aceptación"**, **"Invitación vencida"**.
- El largo máximo de la contraseña se explica en **caracteres**: "La contraseña es demasiado larga: el máximo son 72 caracteres (las tildes y la ñ cuentan doble)" (el límite real sigue siendo 72 bytes).
- No hay test runner: las pruebas son scripts `tsx` en `server/scripts/_*.ts` (excluidos de git), scripts de shell y Playwright en `$SCRATCH`, cuya salida (`etiqueta: real (esperado X)`) se pasa por `chequear.py`. **Ningún script de prueba se commitea.** Toda fila creada por una prueba lleva un id o email `prueba-tmp-…` y se borra al terminar; no se toca ningún dato real. Reiniciar la API con `bash $SCRATCH/reiniciar-api.sh` tras cada cambio del server (también reinicia los límites por IP).
- En desarrollo no hay `SMTP_HOST`: los correos salen por consola al log `$SCRATCH/server.log`, de donde las pruebas leen los enlaces.
- Las pruebas con navegador que usen la pestaña Pendientes **siempre filtran por "Pruebainv"** antes de seleccionar filas: en la base hay padres y profesores reales sin cuenta que nunca deben invitarse.

`$SCRATCH` es `/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad` (allí están `chequear.py`, `reiniciar-api.sh`, `lib.sh`, `ts.sh`, `chk.sh`, `e2e.sh`).

## Review Focus

1. **Email del padre con mayúsculas o espacios** (`"  Maria@Correo.com "`) que ya pertenece a otra cuenta: debe detectarse como "email repetido", tanto al invitar como en la marca `emailEnUso` de la lista (Task 2).
2. **Dos pedidos simultáneos de invitar a la misma persona** (doble clic, dos pestañas): una sola cuenta, el otro pedido responde "ya tiene cuenta" (Task 2).
3. **Enlaces de un tipo usados en otro flujo**: un enlace de recuperación en `/activar-cuenta`, o uno de invitación en "restablecer contraseña", deben rechazarse con el mensaje de enlace inválido (Task 3 y Task 6).
4. **Dos activaciones simultáneas con el mismo enlace**: una sola gana (Task 3).
5. **Profesor inactivo sin cuenta**: no aparece en Pendientes y, si se lo pide por API, responde "profesor inactivo" sin crear la cuenta (Task 2).

---

## Estructura de archivos

**Server — crear** (`server/src/modules/usuarios/` salvo indicación):
- `tokenCuenta.entity.ts` (reemplaza a `tokenRecuperacion.entity.ts`): tipo, entidad y vigencias.
- `enlaces.ts`: `nuevoEnlace`, `hashDeToken`, `enlaceVigente`.
- `correoHtml.ts`: `escapar`, `fechaCorta` (compartidos por los correos).
- `correoInvitacion.ts`, `correoVerificacion.ts`.
- `invitacion.service.ts`, `invitacion.schema.ts`, `invitacion.controller.ts`, `invitacion.routes.ts`.
- Migración `server/prisma/migrations/20261009120000_invitacion_y_verificacion/migration.sql`.

**Server — modificar:** `prisma/schema.prisma`, `core/errors.ts` (`DemasiadosPedidosError`), `core/validacion.ts`, `core/middlewares/limitesDePedidos.ts`, `container.ts`, `server.ts`, y en `usuarios/`: `usuario.entity.ts`, `usuario.repository.ts`, `usuario.repository.prisma.ts`, `usuario.service.ts`, `usuario.schema.ts`, `usuario.controller.ts`, `usuario.routes.ts`, `correoRecuperacion.ts`; `padres/padre.service.ts`, `padres/padre.schema.ts`; `profesores/profesor.service.ts`, `profesores/profesor.schema.ts`.

**Client — crear:** `features/usuarios/components/{EtiquetaRol,PendientesTab,ModoDeAcceso}.tsx`, `features/usuarios/alta.ts`, `features/usuarios/hooks/{usePendientes,useInvitar,useReenviarInvitacion,useCancelarInvitacion}.ts`, `features/auth/components/{CampoContrasena,AvisoError}.tsx`, `features/auth/pages/{ActivarCuentaPage,VerificarEmailPage}.tsx`, `features/cuenta/hooks/{useYo,useEnviarVerificacion}.ts`, `features/cuenta/components/EmailSinVerificar.tsx`.

**Client — modificar:** `core/lib/validacion.ts`, `core/lib/utils.ts`, `core/routes/AppRoutes.tsx`, `features/usuarios/{types.ts,usuarioService.ts,pages/UsuariosPage.tsx,hooks/useCrearAdministrador.ts}`, `features/padres/types.ts`, `features/profesores/{types.ts,pages/ProfesoresAdminPage.tsx}`, `features/secretarios/types.ts`, `features/alumnos/pages/{InscribirAlumnoPage,AlumnosListPage}.tsx`, `features/auth/{authService.ts,pages/LoginPage.tsx}`, `features/cuenta/{types.ts,cuentaService.ts,pages/MiCuentaPage.tsx}`.

**Docs:** `CLAUDE.md`, memoria `proyecto_babylon_pendientes_futuros.md`.

---

### Task 1: Datos — cuenta pendiente, email verificado y tabla única de enlaces

**Files:**
- Modify: `server/prisma/schema.prisma`; Create: `server/prisma/migrations/20261009120000_invitacion_y_verificacion/migration.sql`
- Create: `server/src/modules/usuarios/tokenCuenta.entity.ts`, `server/src/modules/usuarios/enlaces.ts`; Delete: `server/src/modules/usuarios/tokenRecuperacion.entity.ts`
- Modify: `usuario.entity.ts`, `usuario.repository.ts`, `usuario.repository.prisma.ts`, `usuario.service.ts`, `padres/padre.service.ts`, `profesores/profesor.service.ts`
- Modify (verificación, no se commitean): `server/scripts/_sesiones.ts`, `server/scripts/_carrera-login.ts`; Create: `server/scripts/_token-cuenta.ts`

**Interfaces:**
- Produces: `type TipoTokenCuenta = "recuperacion" | "invitacion" | "verificacion_email"`; `interface TokenCuenta { id; usuarioId; tipo; hash; creadoEn: Date; expiraEn: Date; usadoEn: Date | null }`; `VIGENCIA_TOKEN_MS: Record<TipoTokenCuenta, number>`; `nuevoEnlace(usuarioId, tipo, ahora): { token: string; registro: TokenCuenta }`; `hashDeToken(token): string`; `enlaceVigente(t: TokenCuenta, ahora): boolean`; `EstadoUsuario = "activo" | "inactivo" | "pendiente"`; `Usuario.emailVerificadoEn: Date | null`; `CambiosUsuario` incluye `emailVerificadoEn`; `UsuarioRepository`: `crearToken(token, tx?)`, `findTokenPorHash(hash, tx?)`, `findTokensDesde(usuarioId, tipo, desde, tx?)`, `findTokensDeUsuarios(usuarioIds, tipo, tx?)`, `invalidarTokens(usuarioId, tipo, ahora, tx?)`, `marcarTokenUsado(id, ahora, tx?)`.

- [ ] **Step 1: Dejar un enlace de recuperación "viejo" y escribir el test que falla**

Antes de migrar, se guarda en la tabla actual un enlace de recuperación de p6 con un token conocido, para comprobar después que la migración lo conserva y sigue sirviendo:

```bash
source $SCRATCH/lib.sh
q "insert into \"TokenRecuperacion\"(id,\"usuarioId\",hash,\"creadoEn\",\"expiraEn\") values ('prueba-tmp-premig',(select id from \"Usuario\" where email='p6@prueba.babylon.test'),encode(sha256('token-premigracion-babylon'::bytea),'hex'),now(),now()+interval '1 hour')"
```

`server/scripts/_token-cuenta.ts`:

```ts
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { enlaceVigente, hashDeToken, nuevoEnlace } from "../src/modules/usuarios/enlaces";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const repo = new PrismaUsuarioRepository(prisma);
const U = "prueba-tmp-tokens";
const HORA = 3_600_000;

(async () => {
  // El enlace de recuperación creado antes de la migración se conserva, como tipo "recuperacion", y sigue sirviendo.
  const previo = await prisma.tokenCuenta.findUnique({ where: { id: "prueba-tmp-premig" } });
  ok("enlace previo a la migración: tipo", previo?.tipo, "recuperacion");
  const p6 = await prisma.usuario.findFirstOrThrow({ where: { email: "p6@prueba.babylon.test" } });
  await container.usuarioService.restablecerContrasena("token-premigracion-babylon", "NuevaClave12345");
  ok("el enlace previo sirve para restablecer", si((await prisma.tokenCuenta.findUniqueOrThrow({ where: { id: "prueba-tmp-premig" } })).usadoEn !== null), "sí");
  await prisma.usuario.update({ where: { id: p6.id }, data: { passwordHash: p6.passwordHash, emailVerificadoEn: null } });
  await prisma.tokenCuenta.deleteMany({ where: { id: "prueba-tmp-premig" } });

  ok("cuentas existentes con email verificado", await prisma.usuario.count({ where: { emailVerificadoEn: { not: null } } }), 0);

  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.usuario.create({ data: { id: U, nombre: "Tmp", email: `${U}@x.test`, passwordHash: "x", roles: ["padre"], estado: "pendiente", fechaCreacion: new Date() } });
  ok("una cuenta puede quedar pendiente", (await repo.findById(U))?.estado, "pendiente");
  ok("y nace sin email verificado", String((await repo.findById(U))?.emailVerificadoEn), "null");

  const ahora = new Date();
  const horas = (t: { expiraEn: Date }) => Math.round((t.expiraEn.getTime() - ahora.getTime()) / HORA);
  const inv = nuevoEnlace(U, "invitacion", ahora);
  const rec = nuevoEnlace(U, "recuperacion", ahora);
  ok("invitación: vence a los 7 días", horas(inv.registro), 168);
  ok("verificación: vence a las 24 horas", horas(nuevoEnlace(U, "verificacion_email", ahora).registro), 24);
  ok("recuperación: vence a la hora", horas(rec.registro), 1);
  ok("se guarda el SHA-256 del token", inv.registro.hash, createHash("sha256").update(inv.token).digest("hex"));
  await repo.crearToken(inv.registro);
  await repo.crearToken(rec.registro);
  ok("buscar por hash devuelve el tipo", (await repo.findTokenPorHash(hashDeToken(inv.token)))?.tipo, "invitacion");
  ok("buscar desde una fecha filtra por tipo", (await repo.findTokensDesde(U, "invitacion", new Date(ahora.getTime() - HORA))).length, 1);
  ok("enlaces de varias cuentas, por tipo", (await repo.findTokensDeUsuarios([U, "otra-cuenta"], "recuperacion")).map((t) => t.id).join(), rec.registro.id);
  await repo.invalidarTokens(U, "invitacion", ahora);
  ok("anular por tipo: la invitación queda usada", si((await repo.findTokenPorHash(hashDeToken(inv.token)))!.usadoEn !== null), "sí");
  ok("anular por tipo: la recuperación sigue vigente", si(enlaceVigente((await repo.findTokenPorHash(hashDeToken(rec.token)))!, ahora)), "sí");
  ok("marcar usado la primera vez", String(await repo.marcarTokenUsado(rec.registro.id, ahora)), "true");
  ok("marcar usado otra vez", String(await repo.marcarTokenUsado(rec.registro.id, ahora)), "false");
  ok("actualizarParcial cambia emailVerificadoEn", si((await repo.actualizarParcial(U, { emailVerificadoEn: ahora })).emailVerificadoEn !== null), "sí");

  await prisma.usuario.deleteMany({ where: { id: U } });
  ok("borrar la cuenta borra sus enlaces", await prisma.tokenCuenta.count({ where: { usuarioId: U } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

Este script es **de una sola corrida**: comprueba que la migración conserva el enlace creado antes de migrar y después lo borra, así que no forma parte de la batería posterior.

- [ ] **Step 2: Correrlo para ver que falla**

Run: `bash $SCRATCH/ts.sh scripts/_token-cuenta.ts | tail -3`
Expected: falla con errores del script (`prisma.tokenCuenta` no existe: `Cannot read properties of undefined`).

- [ ] **Step 3: Esquema y migración**

En `schema.prisma`:

```prisma
enum EstadoUsuario {
  activo
  inactivo
  // Creada por una invitación y todavía no activada: no puede iniciar sesión.
  pendiente
}

// Tipo de enlace de un solo uso que se manda por correo (ver TokenCuenta).
enum TipoTokenCuenta {
  recuperacion
  invitacion
  verificacion_email
}
```

En `model Usuario`, después de `fechaCreacion DateTime`: `  emailVerificadoEn DateTime?`; y reemplazar `  tokensRecuperacion TokenRecuperacion[]` por `  tokens             TokenCuenta[]`.

Reemplazar el bloque completo de `model TokenRecuperacion` (con su comentario) por:

```prisma
// Enlace de un solo uso que se manda por correo: recuperar la contraseña (1 h), activar una invitación (7 días) o
// verificar el email (24 h). Se guarda solo el SHA-256 del token (el token viaja únicamente en el correo).
model TokenCuenta {
  id        String          @id
  usuarioId String
  tipo      TipoTokenCuenta
  hash      String          @unique
  creadoEn  DateTime
  expiraEn  DateTime
  usadoEn   DateTime?

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId, tipo, creadoEn])
}
```

`server/prisma/migrations/20261009120000_invitacion_y_verificacion/migration.sql`:

```sql
-- Cuenta creada por una invitación y todavía no activada, y fecha de verificación del email.
ALTER TYPE "EstadoUsuario" ADD VALUE 'pendiente';
ALTER TABLE "Usuario" ADD COLUMN "emailVerificadoEn" TIMESTAMP(3);

-- Una sola tabla para los enlaces que se mandan por correo, con su tipo. Los enlaces de recuperación que ya existían
-- se conservan, con tipo "recuperacion".
CREATE TYPE "TipoTokenCuenta" AS ENUM ('recuperacion', 'invitacion', 'verificacion_email');
ALTER TABLE "TokenRecuperacion" RENAME TO "TokenCuenta";
ALTER TABLE "TokenCuenta" ADD COLUMN "tipo" "TipoTokenCuenta" NOT NULL DEFAULT 'recuperacion';
ALTER TABLE "TokenCuenta" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "TokenCuenta" RENAME CONSTRAINT "TokenRecuperacion_pkey" TO "TokenCuenta_pkey";
ALTER TABLE "TokenCuenta" RENAME CONSTRAINT "TokenRecuperacion_usuarioId_fkey" TO "TokenCuenta_usuarioId_fkey";
ALTER INDEX "TokenRecuperacion_hash_key" RENAME TO "TokenCuenta_hash_key";
DROP INDEX "TokenRecuperacion_usuarioId_creadoEn_idx";
CREATE INDEX "TokenCuenta_usuarioId_tipo_creadoEn_idx" ON "TokenCuenta"("usuarioId", "tipo", "creadoEn");
```

Run: `cd server && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; pnpm prisma migrate deploy 2>&1 | grep -E "Applying|Error"; pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code >/dev/null && echo "esquema = base: SIN DIFERENCIAS"; pnpm prisma generate 2>&1 | grep -ci generated`
Expected: `Applying migration 20261009120000_invitacion_y_verificacion`, `SIN DIFERENCIAS`, `1`.

- [ ] **Step 4: Entidades y utilidades de enlaces**

`server/src/modules/usuarios/tokenCuenta.entity.ts`:

```ts
// Entidad secundaria de usuarios/: enlace de un solo uso que se manda por correo.
export type TipoTokenCuenta = "recuperacion" | "invitacion" | "verificacion_email";

export interface TokenCuenta {
  id: string;
  usuarioId: string;
  tipo: TipoTokenCuenta;
  // SHA-256 (hex) del token; el token en sí nunca se guarda.
  hash: string;
  creadoEn: Date;
  expiraEn: Date;
  usadoEn: Date | null;
}

const UNA_HORA_MS = 60 * 60 * 1000;

export const VIGENCIA_TOKEN_MS: Record<TipoTokenCuenta, number> = {
  recuperacion: UNA_HORA_MS,
  invitacion: 7 * 24 * UNA_HORA_MS,
  verificacion_email: 24 * UNA_HORA_MS,
};
```

`server/src/modules/usuarios/enlaces.ts`:

```ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { VIGENCIA_TOKEN_MS, type TipoTokenCuenta, type TokenCuenta } from "./tokenCuenta.entity";

export const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Un enlace nuevo: el token (viaja solo en el correo) y la fila que se guarda (con su SHA-256 y su vencimiento).
export function nuevoEnlace(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date): { token: string; registro: TokenCuenta } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    registro: {
      id: randomUUID(),
      usuarioId,
      tipo,
      hash: hashDeToken(token),
      creadoEn: ahora,
      expiraEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS[tipo]),
      usadoEn: null,
    },
  };
}

// Sin usar y sin vencer.
export const enlaceVigente = (t: TokenCuenta, ahora: Date) => t.usadoEn === null && t.expiraEn.getTime() > ahora.getTime();
```

Run: `git rm -q server/src/modules/usuarios/tokenRecuperacion.entity.ts`

`usuario.entity.ts`: `export type EstadoUsuario = "activo" | "inactivo" | "pendiente";` y, después de `fechaCreacion: Date;`:

```ts
  // Cuándo se comprobó que el email es de la persona (activó una invitación, abrió el enlace de verificación o
  // recuperó la contraseña). Nulo: sin verificar.
  emailVerificadoEn: Date | null;
```

- [ ] **Step 5: Puerto y adaptador de enlaces**

`usuario.repository.ts` completo:

```ts
import type { Repository } from "../../core/ports";
import type { TipoTokenCuenta, TokenCuenta } from "./tokenCuenta.entity";
import type { Usuario } from "./usuario.entity";

export type CambiosUsuario = Partial<Pick<Usuario, "nombre" | "email" | "passwordHash" | "estado" | "emailVerificadoEn">>;

export interface UsuarioRepository extends Repository<Usuario> {
  findByEmail(email: string, tx?: unknown): Promise<Usuario | null>;

  // Cambia SOLO los campos indicados, sin reescribir el resto de la fila: así dos cambios simultáneos sobre la
  // misma cuenta (por ejemplo una contraseña nueva y un cambio de estado) no se pisan.
  actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario>;
  // Toma un bloqueo exclusivo hasta que termina la transacción: los pedidos simultáneos sobre la misma clave se hacen
  // de a uno (también entre varios servidores). La clave suele ser el id de la cuenta, pero puede ser cualquier texto
  // (ej. "padre:<id>" o "email:<email>" al invitar a alguien que todavía no tiene cuenta).
  bloquearCuenta(clave: string, tx: unknown): Promise<void>;

  crearToken(token: TokenCuenta, tx?: unknown): Promise<TokenCuenta>;
  findTokenPorHash(hash: string, tx?: unknown): Promise<TokenCuenta | null>;
  findTokensDesde(usuarioId: string, tipo: TipoTokenCuenta, desde: Date, tx?: unknown): Promise<TokenCuenta[]>;
  findTokensDeUsuarios(usuarioIds: string[], tipo: TipoTokenCuenta, tx?: unknown): Promise<TokenCuenta[]>;
  // Marca usados los enlaces aún sin usar de ese tipo (pedir uno nuevo anula los anteriores).
  invalidarTokens(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date, tx?: unknown): Promise<void>;
  // Marca usado un enlace solo si todavía no lo estaba; false si otro pedido lo usó primero.
  marcarTokenUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean>;
}
```

`usuario.repository.prisma.ts`: cambiar el import `import type { TokenRecuperacion } from "./tokenRecuperacion.entity";` por `import type { TipoTokenCuenta, TokenCuenta } from "./tokenCuenta.entity";`; en `bloquearCuenta` renombrar el parámetro `usuarioId` a `clave` (el SQL usa `${clave}`); y reemplazar los cinco métodos `crearTokenRecuperacion` … `marcarTokenRecuperacionUsado` por:

```ts
  async crearToken(token: TokenCuenta, tx?: unknown): Promise<TokenCuenta> {
    return this.client(tx).tokenCuenta.create({ data: token });
  }

  async findTokenPorHash(hash: string, tx?: unknown): Promise<TokenCuenta | null> {
    return this.client(tx).tokenCuenta.findUnique({ where: { hash } });
  }

  async findTokensDesde(usuarioId: string, tipo: TipoTokenCuenta, desde: Date, tx?: unknown): Promise<TokenCuenta[]> {
    return this.client(tx).tokenCuenta.findMany({ where: { usuarioId, tipo, creadoEn: { gte: desde } } });
  }

  async findTokensDeUsuarios(usuarioIds: string[], tipo: TipoTokenCuenta, tx?: unknown): Promise<TokenCuenta[]> {
    if (usuarioIds.length === 0) return [];
    return this.client(tx).tokenCuenta.findMany({ where: { usuarioId: { in: usuarioIds }, tipo } });
  }

  async invalidarTokens(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date, tx?: unknown): Promise<void> {
    await this.client(tx).tokenCuenta.updateMany({ where: { usuarioId, tipo, usadoEn: null }, data: { usadoEn: ahora } });
  }

  async marcarTokenUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).tokenCuenta.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: ahora } });
    return count === 1;
  }
```

- [ ] **Step 6: Recuperación con la tabla nueva y altas con `emailVerificadoEn`**

`usuario.service.ts`:
1. Imports: la primera línea pasa a `import { randomUUID } from "node:crypto";` y se agrega `import { enlaceVigente, hashDeToken, nuevoEnlace } from "./enlaces";`.
2. Constantes: borrar `VIGENCIA_ENLACE_MS` y la función local `hashDeToken`; agregar `const UNA_HORA_MS = 60 * 60 * 1000;`.
3. En `crearUsuarioSimple`, en el objeto `usuario`, después de `fechaCreacion: new Date(),` agregar `emailVerificadoEn: null,`.
4. En `cambiarContrasena`: `await this.usuarioRepo.invalidarTokensRecuperacion(usuarioId, ahora, tx);` → `await this.usuarioRepo.invalidarTokens(usuarioId, "recuperacion", ahora, tx);`.
5. Reemplazar `enviarEnlaceDeRecuperacion` y `restablecerContrasena` completos por:

```ts
  private async enviarEnlaceDeRecuperacion(usuario: Usuario, ahora: Date): Promise<void> {
    // Las comprobaciones y el alta del enlace van juntas bajo un bloqueo de la cuenta: si no,
    // varios pedidos simultáneos leerían "ningún enlace reciente" a la vez y pasarían todos.
    const token = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuario.id, tx);
      const recientes = await this.usuarioRepo.findTokensDesde(usuario.id, "recuperacion", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      if (recientes.length >= MAX_ENLACES_POR_HORA) return null;
      if (recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) return null;

      await this.usuarioRepo.invalidarTokens(usuario.id, "recuperacion", ahora, tx);
      const enlace = nuevoEnlace(usuario.id, "recuperacion", ahora);
      await this.usuarioRepo.crearToken(enlace.registro, tx);
      return enlace.token;
    });
    if (!token) return;

    const enlace = `${config.APP_URL}/restablecer-contrasena?token=${token}`;
    await this.mailer.enviar(correoRecuperacion(usuario.nombre, usuario.email, enlace)).catch((error) =>
      console.error(`[correo] no se pudo enviar la recuperación a ${usuario.email}:`, error),
    );
  }

  // Cambia la contraseña, marca el enlace como usado, invalida los demás y corta
  // todas las sesiones de la cuenta.
  async restablecerContrasena(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      // Solo enlaces de recuperación: uno de invitación o de verificación no sirve acá.
      if (!registro || registro.tipo !== "recuperacion" || !enlaceVigente(registro, ahora)) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_INVALIDO);

      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuario.id, ahora, undefined, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "recuperacion", ahora, tx);
    });
  }
```

`padres/padre.service.ts` y `profesores/profesor.service.ts`: en el objeto `usuario` de `crearPadre` / `crearProfesor`, después de `fechaCreacion: new Date(),` agregar `emailVerificadoEn: null,`.

Scripts de verificación que usaban la tabla vieja (no se commitean):

```bash
cd server && python3 - <<'EOF'
import re
for p in ("scripts/_sesiones.ts", "scripts/_carrera-login.ts"):
    s = open(p).read()
    s = re.sub(r"prisma\.tokenRecuperacion\.create\(\{(\s*)data: \{ ", r'prisma.tokenCuenta.create({\1data: { tipo: "recuperacion", ', s)
    s = s.replace("prisma.tokenRecuperacion.", "prisma.tokenCuenta.")
    open(p, "w").write(s)
EOF
grep -c "tokenRecuperacion" scripts/_sesiones.ts scripts/_carrera-login.ts
```
Expected: `0` en ambos.

- [ ] **Step 7: Correr el test, las verificaciones vecinas y el typecheck**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/ts.sh scripts/_token-cuenta.ts; echo "exit $?"; bash $SCRATCH/ts.sh scripts/_carrera-login.ts | tail -1; bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/verificar-regresion.sh | tail -1`
Expected: typecheck limpio; `--- 18/18 ok`, `exit 0`; `_carrera-login.ts` `--- 9/9 ok`; regresión `--- 19/19 ok`.

- [ ] **Step 8: Commit**

```bash
git add server/prisma server/src
git commit -m "Cuenta pendiente, email verificado y tabla única de enlaces por correo (TokenCuenta con tipo)"
```

---

### Task 2: `InvitacionService` — invitar, reenviar, cancelar y listar pendientes

**Files:**
- Create: `server/src/modules/usuarios/correoHtml.ts`, `correoInvitacion.ts`, `invitacion.service.ts`
- Modify: `server/src/modules/usuarios/correoRecuperacion.ts`
- Create (verificación): `server/scripts/_invitaciones.ts`

**Interfaces:**
- Consumes: `nuevoEnlace`, `enlaceVigente`, repositorio de enlaces (Task 1); `PadreRepository`, `ProfesorRepository` (existentes).
- Produces (en `invitacion.service.ts`): `class InvitacionService(usuarioRepo, padreRepo, profesorRepo, unitOfWork, mailer)` con `prepararCuentaPendiente(datos: DatosCuentaInvitada, ahora: Date, tx: unknown): Promise<CuentaPreparada>`, `enviarInvitacion(cuenta: CuentaPreparada): Promise<boolean>`, `invitar(padreIds: string[], profesorIds: string[], ahora?: Date): Promise<ResultadoEnvio[]>`, `reenviar(usuarioIds: string[], ahora?: Date): Promise<ResultadoEnvio[]>`, `cancelar(usuarioId: string): Promise<void>`, `listarPendientes(ahora?: Date): Promise<FilaPendiente[]>`; tipos `EstadoInvitacion = "enviada" | "no-enviada"`, `MotivoNoEnviada`, `ResultadoEnvio { id; nombre; resultado: EstadoInvitacion; motivo? }`, `EtiquetaAcceso = "sin-cuenta" | "pendiente" | "vencida"`, `FilaPendiente`, `DatosCuentaInvitada { nombre; email; roles: Rol[] }`, `CuentaPreparada { usuario: Usuario; token: string; venceEn: Date }`, constante `ENLACE_NO_VALIDO`; en `correoHtml.ts`: `escapar(s)`, `fechaCorta(instante): string` ("DD/MM/AAAA" en Argentina).

- [ ] **Step 1: Escribir el test que falla** — `server/scripts/_invitaciones.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { Mailer, MensajeCorreo } from "../src/core/ports";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { hashDeToken } from "../src/modules/usuarios/enlaces";
import { InvitacionService } from "../src/modules/usuarios/invitacion.service";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
// Guarda los correos en vez de mandarlos; con `fallar` simula un servidor de correo caído.
class CapturaMailer implements Mailer {
  enviados: MensajeCorreo[] = [];
  fallar = false;
  async enviar(m: MensajeCorreo) {
    if (this.fallar) throw new Error("SMTP caído (simulado)");
    this.enviados.push(m);
  }
}
const mailer = new CapturaMailer();
const svc = new InvitacionService(new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), new PrismaProfesorRepository(prisma), new PrismaUnitOfWork(prisma), mailer);
const P = "prueba-tmp-inv";
const MIN = 60_000;
const DIA = 86_400_000;
const tokenDe = (m: MensajeCorreo) => m.texto.match(/activar-cuenta\?token=([A-Za-z0-9_-]+)/)?.[1] ?? "";
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
async function limpiar() {
  const vinculados = [...(await prisma.padre.findMany({ where: { id: { startsWith: P } } })), ...(await prisma.profesor.findMany({ where: { id: { startsWith: P } } }))]
    .map((x) => x.usuarioId)
    .filter((x): x is string => !!x);
  await prisma.padre.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profesor.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { in: vinculados } }, { id: { startsWith: P } }, { email: { startsWith: P } }] } });
}
const padre = (n: number, email: string | null) =>
  prisma.padre.create({ data: { id: `${P}-p${n}`, nombre: "Pruebainv", apellido: `Padre ${n}`, dni: `9900000${n}`, email, vinculo: "madre" } });

(async () => {
  await limpiar();
  await padre(1, `${P}-1@x.test`);
  await padre(2, null);
  await padre(3, `  ${P.toUpperCase()}-OCUPADO@X.TEST `); // mayúsculas y espacios, y ese email ya es de otra cuenta
  await padre(4, `${P}-4@x.test`);
  await padre(5, `${P}-5@x.test`);
  await prisma.usuario.create({ data: { id: `${P}-ocupante`, nombre: "Ocupa", email: `${P}-ocupado@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
  await prisma.profesor.create({ data: { id: `${P}-prof-inactivo`, nombre: "Pruebainv", apellido: "Inactivo", email: `${P}-prof-inactivo@x.test`, estado: "inactivo" } });
  await prisma.profesor.create({ data: { id: `${P}-prof`, nombre: "Pruebainv", apellido: "Profe", email: `${P}-profe@x.test`, estado: "activo" } });
  const ahora = new Date();

  // Lote con casos mezclados
  const r = await svc.invitar([`${P}-p1`, `${P}-p2`, `${P}-p3`, `${P}-inexistente`], [`${P}-prof-inactivo`, `${P}-prof`], ahora);
  const motivo = (id: string) => {
    const x = r.find((y) => y.id === id);
    return x?.resultado === "enviada" ? "enviada" : x?.motivo;
  };
  ok("padre con email: invitado", motivo(`${P}-p1`), "enviada");
  ok("padre sin email", motivo(`${P}-p2`), "sin email");
  ok("email ya usado por otra cuenta (mayúsculas y espacios)", motivo(`${P}-p3`), "email repetido");
  ok("padre inexistente", motivo(`${P}-inexistente`), "no existe");
  ok("profesor inactivo", motivo(`${P}-prof-inactivo`), "profesor inactivo");
  ok("profesor activo: invitado", motivo(`${P}-prof`), "enviada");
  ok("el resultado trae el nombre", r.find((y) => y.id === `${P}-p1`)?.nombre, "Pruebainv Padre 1");
  ok("al profesor inactivo no se le crea cuenta", String((await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-prof-inactivo` } })).usuarioId), "null");

  const p1 = await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p1` } });
  const cuenta1 = await prisma.usuario.findUniqueOrThrow({ where: { id: p1.usuarioId! } });
  ok("la cuenta nace pendiente", cuenta1.estado, "pendiente");
  ok("con el rol de padre", cuenta1.roles.join(), "padre");
  ok("con nombre y apellido", cuenta1.nombre, "Pruebainv Padre 1");
  ok("con el email sin verificar", String(cuenta1.emailVerificadoEn), "null");
  const correo1 = mailer.enviados.find((m) => m.para === `${P}-1@x.test`);
  ok("se mandó el correo", si(!!correo1), "sí");
  ok("asunto del correo", correo1?.asunto, "Te invitamos a Babylon English Institute");
  const tok1 = await prisma.tokenCuenta.findUniqueOrThrow({ where: { hash: hashDeToken(tokenDe(correo1!)) } });
  ok("el enlace del correo es de invitación", tok1.tipo, "invitacion");
  ok("vence a los 7 días", Math.round((tok1.expiraEn.getTime() - ahora.getTime()) / DIA), 7);
  ok("invitar otra vez al mismo padre", (await svc.invitar([`${P}-p1`], [], ahora))[0].motivo, "ya tiene cuenta");

  // Correo caído: la cuenta queda creada y pendiente igual
  mailer.fallar = true;
  const rf = await svc.invitar([`${P}-p4`], [], ahora);
  mailer.fallar = false;
  ok("correo caído: resultado", rf[0].motivo, "no se pudo enviar el correo");
  ok("correo caído: la cuenta quedó pendiente", (await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p4` }, include: { usuario: true } })).usuario?.estado, "pendiente");

  // Dos pedidos simultáneos para la misma persona: una sola cuenta
  const [x, y] = await Promise.all([svc.invitar([`${P}-p5`], [], ahora), svc.invitar([`${P}-p5`], [], ahora)]);
  ok("doble pedido simultáneo: enviadas", [x[0], y[0]].filter((z) => z.resultado === "enviada").length, 1);
  ok("doble pedido simultáneo: cuentas creadas", await prisma.usuario.count({ where: { email: `${P}-5@x.test` } }), 1);

  ok("más de 100 por pedido", await rechazo(svc.invitar(Array.from({ length: 101 }, (_, i) => `x${i}`), [], ahora)), "ValidationError");

  // Lista de Pendientes
  const filas = await svc.listarPendientes(ahora);
  const fila = (clave: string) => filas.find((f) => f.clave === clave);
  ok("sin cuenta y sin email", `${fila(`padre:${P}-p2`)?.etiqueta}/${fila(`padre:${P}-p2`)?.sinEmail}`, "sin-cuenta/true");
  ok("sin cuenta con el email ya usado", `${fila(`padre:${P}-p3`)?.etiqueta}/${fila(`padre:${P}-p3`)?.emailEnUso}`, "sin-cuenta/true");
  ok("invitado: pendiente de aceptación", fila(`cuenta:${cuenta1.id}`)?.etiqueta, "pendiente");
  ok("invitado: vinculado al padre", fila(`cuenta:${cuenta1.id}`)?.padreId, `${P}-p1`);
  ok("invitado: fecha de envío", si(fila(`cuenta:${cuenta1.id}`)?.invitacionEnviadaEn?.getTime() === tok1.creadoEn.getTime()), "sí");
  ok("el padre invitado ya no figura sin cuenta", si(!fila(`padre:${P}-p1`)), "sí");
  ok("profesor inactivo sin cuenta: no se lista", si(!fila(`profesor:${P}-prof-inactivo`)), "sí");
  ok("cuentas activas: no se listan", si(!fila(`cuenta:${P}-ocupante`)), "sí");
  ok("a los 8 días: invitación vencida", (await svc.listarPendientes(new Date(ahora.getTime() + 8 * DIA))).find((f) => f.clave === `cuenta:${cuenta1.id}`)?.etiqueta, "vencida");

  // Reenviar
  ok("reenviar enseguida", (await svc.reenviar([cuenta1.id], new Date(ahora.getTime() + 30_000)))[0].motivo, "esperá un minuto para reenviar");
  const antes = mailer.enviados.length;
  ok("reenviar pasado el minuto", (await svc.reenviar([cuenta1.id], new Date(ahora.getTime() + 2 * MIN)))[0].resultado, "enviada");
  ok("se mandó otro correo", mailer.enviados.length - antes, 1);
  ok("el enlace anterior quedó anulado", si((await prisma.tokenCuenta.findUniqueOrThrow({ where: { id: tok1.id } })).usadoEn !== null), "sí");
  ok("reenviar a una cuenta activa", (await svc.reenviar([`${P}-ocupante`], ahora))[0].motivo, "ya activada");
  ok("reenviar a una cuenta inexistente", (await svc.reenviar([`${P}-nadie`], ahora))[0].motivo, "no existe");

  // Cancelar
  await svc.cancelar(cuenta1.id);
  ok("cancelar: la cuenta pendiente se borra", await prisma.usuario.count({ where: { id: cuenta1.id } }), 0);
  ok("cancelar: el padre queda sin cuenta", String((await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p1` } })).usuarioId), "null");
  ok("cancelar: vuelve a figurar sin cuenta", (await svc.listarPendientes(ahora)).find((f) => f.clave === `padre:${P}-p1`)?.etiqueta, "sin-cuenta");
  ok("tras cancelar se lo puede invitar de nuevo", (await svc.invitar([`${P}-p1`], [], new Date(ahora.getTime() + 3 * MIN)))[0].resultado, "enviada");
  ok("cancelar una cuenta activa", await rechazo(svc.cancelar(`${P}-ocupante`)), "ConflictError");
  ok("cancelar una cuenta inexistente", await rechazo(svc.cancelar(`${P}-nadie`)), "EntityNotFoundError");

  await limpiar();
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: P } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `bash $SCRATCH/ts.sh scripts/_invitaciones.ts | tail -2`
Expected: error `Cannot find module '../src/modules/usuarios/invitacion.service'`.

- [ ] **Step 3: Utilidades de correo y correo de invitación**

`server/src/modules/usuarios/correoHtml.ts`:

```ts
import { fechaHoraEnArgentina } from "../../core/fechas";

export const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// "15/10/2026": el día tal como se ve en Argentina.
export function fechaCorta(instante: Date): string {
  const { dia, mes, anio } = fechaHoraEnArgentina(instante);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`;
}
```

`correoRecuperacion.ts`: borrar la constante local `escapar` y agregar `import { escapar } from "./correoHtml";`.

`server/src/modules/usuarios/correoInvitacion.ts`:

```ts
import type { MensajeCorreo } from "../../core/ports";
import { escapar, fechaCorta } from "./correoHtml";

export function correoInvitacion(nombre: string, para: string, enlace: string, venceEn: Date): MensajeCorreo {
  const asunto = "Te invitamos a Babylon English Institute";
  const aclaracion = `El enlace vence el ${fechaCorta(venceEn)} y sirve una sola vez. Si venció, ingresá tu email en "¿Olvidaste tu contraseña?" y te mandamos otro.`;
  const texto = [
    `Hola ${nombre}:`,
    "",
    "Babylon English Institute te creó una cuenta para que puedas ingresar al sistema del instituto.",
    "Abrí este enlace para elegir tu contraseña y activarla:",
    "",
    enlace,
    "",
    aclaracion,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Babylon English Institute te creó una cuenta para que puedas ingresar al sistema del instituto.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Activar mi cuenta</a></p>
  <p style="color:#6b7280;font-size:12px">${escapar(aclaracion)}</p>
</div>`;
  return { para, asunto, texto, html };
}
```

- [ ] **Step 4: El servicio** — `server/src/modules/usuarios/invitacion.service.ts`:

```ts
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { config } from "../../core/config";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Mailer, Rol, UnitOfWork } from "../../core/ports";
import type { Padre } from "../padres/padre.entity";
import type { PadreRepository } from "../padres/padre.repository";
import type { Profesor } from "../profesores/profesor.entity";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { correoInvitacion } from "./correoInvitacion";
import { enlaceVigente, nuevoEnlace } from "./enlaces";
import type { Usuario } from "./usuario.entity";
import type { UsuarioRepository } from "./usuario.repository";

// Una cuenta pendiente no tiene contraseña utilizable: se guarda el hash de un valor al azar que nadie conoce.
const HASH_DE_CUENTA_PENDIENTE = bcrypt.hashSync(randomBytes(32).toString("hex"), 10);
const MAX_POR_PEDIDO = 100;
const UNA_HORA_MS = 60 * 60 * 1000;
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;
// Invitaciones nuevas pedidas desde "¿Olvidaste tu contraseña?" (los envíos del admin también cuentan).
const MAX_INVITACIONES_POR_HORA_A_PEDIDO = 3;

export const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

const normalizarEmail = (email: string) => email.trim().toLowerCase();
const nombreCompleto = (p: { nombre: string; apellido?: string }) => `${p.nombre} ${p.apellido ?? ""}`.trim();

export type EstadoInvitacion = "enviada" | "no-enviada";
export type MotivoNoEnviada =
  | "no existe"
  | "ya tiene cuenta"
  | "sin email"
  | "email repetido"
  | "profesor inactivo"
  | "ya activada"
  | "esperá un minuto para reenviar"
  | "no se pudo enviar el correo";

export interface ResultadoEnvio {
  id: string;
  nombre: string;
  resultado: EstadoInvitacion;
  motivo?: MotivoNoEnviada;
}

export type EtiquetaAcceso = "sin-cuenta" | "pendiente" | "vencida";

// Una fila de la pestaña Pendientes: un padre o profesor sin cuenta, o una cuenta pendiente de cualquier rol.
export interface FilaPendiente {
  clave: string; // "padre:<id>", "profesor:<id>" o "cuenta:<usuarioId>"
  origen: "padre" | "profesor" | "cuenta";
  padreId: string | null;
  profesorId: string | null;
  usuarioId: string | null;
  nombre: string;
  email: string | null;
  roles: Rol[];
  etiqueta: EtiquetaAcceso;
  invitacionEnviadaEn: Date | null;
  invitacionVenceEn: Date | null;
  sinEmail: boolean;
  emailEnUso: boolean;
}

export interface DatosCuentaInvitada {
  nombre: string;
  email: string;
  roles: Rol[];
}

export interface CuentaPreparada {
  usuario: Usuario;
  token: string;
  venceEn: Date;
}

type Preparacion = { cuenta: CuentaPreparada; nombre: string } | { motivo: MotivoNoEnviada; nombre: string };

export class InvitacionService {
  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly padreRepo: PadreRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly mailer: Mailer,
  ) {}

  // Dentro de la transacción de quien da el alta: crea la cuenta pendiente y su enlace. El correo se manda después,
  // con enviarInvitacion, una vez confirmada la transacción.
  async prepararCuentaPendiente(datos: DatosCuentaInvitada, ahora: Date, tx: unknown): Promise<CuentaPreparada> {
    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: normalizarEmail(datos.email),
      passwordHash: HASH_DE_CUENTA_PENDIENTE,
      roles: datos.roles,
      estado: "pendiente",
      fechaCreacion: ahora,
      emailVerificadoEn: null,
    };
    await this.usuarioRepo.create(usuario, tx);
    const { token, registro } = nuevoEnlace(usuario.id, "invitacion", ahora);
    await this.usuarioRepo.crearToken(registro, tx);
    return { usuario, token, venceEn: registro.expiraEn };
  }

  // Nunca lanza: devuelve si el correo salió (una falla queda en el log y se informa en el resultado).
  async enviarInvitacion({ usuario, token, venceEn }: CuentaPreparada): Promise<boolean> {
    const enlace = `${config.APP_URL}/activar-cuenta?token=${token}`;
    try {
      await this.mailer.enviar(correoInvitacion(usuario.nombre, usuario.email, enlace, venceEn));
      return true;
    } catch (error) {
      console.error(`[correo] no se pudo enviar la invitación a ${usuario.email}:`, error);
      return false;
    }
  }

  async invitar(padreIds: string[], profesorIds: string[], ahora: Date = new Date()): Promise<ResultadoEnvio[]> {
    if (padreIds.length + profesorIds.length > MAX_POR_PEDIDO) {
      throw new ValidationError(`Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);
    }
    const resultados: ResultadoEnvio[] = [];
    // De a una persona: cada una en su propia transacción, y su correo recién después de confirmarla.
    for (const id of padreIds) resultados.push(await this.informar(id, await this.prepararInvitacion("padre", id, ahora)));
    for (const id of profesorIds) resultados.push(await this.informar(id, await this.prepararInvitacion("profesor", id, ahora)));
    return resultados;
  }

  async reenviar(usuarioIds: string[], ahora: Date = new Date()): Promise<ResultadoEnvio[]> {
    if (usuarioIds.length > MAX_POR_PEDIDO) {
      throw new ValidationError(`Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);
    }
    const resultados: ResultadoEnvio[] = [];
    for (const id of usuarioIds) resultados.push(await this.informar(id, await this.renovarInvitacion(id, ahora, false)));
    return resultados;
  }

  // Solo cuentas que nunca se activaron. La base deja en nulo el vínculo del padre o profesor (ON DELETE SET NULL)
  // y borra los enlaces y sesiones de la cuenta (CASCADE).
  async cancelar(usuarioId: string): Promise<void> {
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
      if (usuario.estado !== "pendiente") throw new ConflictError("La cuenta ya fue activada");
      await this.usuarioRepo.delete(usuarioId, tx);
    });
  }

  async listarPendientes(ahora: Date = new Date()): Promise<FilaPendiente[]> {
    const [usuarios, padres, profesores] = await Promise.all([this.usuarioRepo.findAll(), this.padreRepo.findAll(), this.profesorRepo.findAll()]);
    const emailsEnUso = new Set(usuarios.map((u) => normalizarEmail(u.email)));
    const pendientes = usuarios.filter((u) => u.estado === "pendiente");
    const invitaciones = await this.usuarioRepo.findTokensDeUsuarios(pendientes.map((u) => u.id), "invitacion");

    const sinCuenta = (origen: "padre" | "profesor", id: string, nombre: string, email: string | undefined): FilaPendiente => {
      const limpio = email?.trim() ? email.trim() : null;
      return {
        clave: `${origen}:${id}`,
        origen,
        padreId: origen === "padre" ? id : null,
        profesorId: origen === "profesor" ? id : null,
        usuarioId: null,
        nombre,
        email: limpio,
        roles: [origen],
        etiqueta: "sin-cuenta",
        invitacionEnviadaEn: null,
        invitacionVenceEn: null,
        sinEmail: !limpio,
        emailEnUso: !!limpio && emailsEnUso.has(normalizarEmail(limpio)),
      };
    };

    const filas: FilaPendiente[] = [
      ...padres.filter((p) => !p.usuarioId).map((p) => sinCuenta("padre", p.id, nombreCompleto(p), p.email)),
      // Los profesores inactivos no se invitan.
      ...profesores.filter((p) => !p.usuarioId && p.estado === "activo").map((p) => sinCuenta("profesor", p.id, nombreCompleto(p), p.email)),
      ...pendientes.map((u): FilaPendiente => {
        const propias = invitaciones.filter((t) => t.usuarioId === u.id).sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
        const ultima = propias[0] ?? null;
        return {
          clave: `cuenta:${u.id}`,
          origen: "cuenta",
          padreId: padres.find((p) => p.usuarioId === u.id)?.id ?? null,
          profesorId: profesores.find((p) => p.usuarioId === u.id)?.id ?? null,
          usuarioId: u.id,
          nombre: u.nombre,
          email: u.email,
          roles: u.roles,
          etiqueta: propias.some((t) => enlaceVigente(t, ahora)) ? "pendiente" : "vencida",
          invitacionEnviadaEn: ultima?.creadoEn ?? null,
          invitacionVenceEn: ultima?.expiraEn ?? null,
          sinEmail: false,
          emailEnUso: false,
        };
      }),
    ];
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  private async informar(id: string, preparacion: Preparacion): Promise<ResultadoEnvio> {
    if ("motivo" in preparacion) return { id, nombre: preparacion.nombre, resultado: "no-enviada", motivo: preparacion.motivo };
    const enviada = await this.enviarInvitacion(preparacion.cuenta);
    return enviada
      ? { id, nombre: preparacion.nombre, resultado: "enviada" }
      : { id, nombre: preparacion.nombre, resultado: "no-enviada", motivo: "no se pudo enviar el correo" };
  }

  private prepararInvitacion(rol: "padre" | "profesor", id: string, ahora: Date): Promise<Preparacion> {
    return this.unitOfWork.runInTransaction(async (tx): Promise<Preparacion> => {
      // Bloqueo por persona: dos pedidos simultáneos para la misma persona no crean dos cuentas.
      await this.usuarioRepo.bloquearCuenta(`${rol}:${id}`, tx);
      const persona: Padre | Profesor | null = rol === "padre" ? await this.padreRepo.findById(id, tx) : await this.profesorRepo.findById(id, tx);
      if (!persona) return { motivo: "no existe", nombre: "" };
      const nombre = nombreCompleto(persona);
      if (persona.usuarioId) return { motivo: "ya tiene cuenta", nombre };
      if (rol === "profesor" && (persona as Profesor).estado === "inactivo") return { motivo: "profesor inactivo", nombre };
      if (!persona.email?.trim()) return { motivo: "sin email", nombre };
      const email = normalizarEmail(persona.email);
      // Bloqueo por email: dos personas distintas con el mismo email tampoco pasan las dos.
      await this.usuarioRepo.bloquearCuenta(`email:${email}`, tx);
      if (await this.usuarioRepo.findByEmail(email, tx)) return { motivo: "email repetido", nombre };

      const cuenta = await this.prepararCuentaPendiente({ nombre, email, roles: [rol] }, ahora, tx);
      if (rol === "padre") await this.padreRepo.update(id, { ...(persona as Padre), usuarioId: cuenta.usuario.id }, tx);
      else await this.profesorRepo.update(id, { ...(persona as Profesor), usuarioId: cuenta.usuario.id }, tx);
      return { cuenta, nombre };
    });
  }

  // Un enlace de invitación nuevo para una cuenta todavía pendiente (anula los anteriores). `limitarPorHora` aplica el
  // tope de 3 por hora de los pedidos desde "¿Olvidaste tu contraseña?"; el minuto de espera vale siempre.
  private renovarInvitacion(usuarioId: string, ahora: Date, limitarPorHora: boolean): Promise<Preparacion> {
    return this.unitOfWork.runInTransaction(async (tx): Promise<Preparacion> => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) return { motivo: "no existe", nombre: "" };
      if (usuario.estado !== "pendiente") return { motivo: "ya activada", nombre: usuario.nombre };
      const recientes = await this.usuarioRepo.findTokensDesde(usuarioId, "invitacion", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      const muyPronto = recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENVIOS_MS);
      if (muyPronto || (limitarPorHora && recientes.length >= MAX_INVITACIONES_POR_HORA_A_PEDIDO)) {
        return { motivo: "esperá un minuto para reenviar", nombre: usuario.nombre };
      }
      await this.usuarioRepo.invalidarTokens(usuarioId, "invitacion", ahora, tx);
      const { token, registro } = nuevoEnlace(usuarioId, "invitacion", ahora);
      await this.usuarioRepo.crearToken(registro, tx);
      return { cuenta: { usuario, token, venceEn: registro.expiraEn }, nombre: usuario.nombre };
    });
  }
}
```

- [ ] **Step 5: Correr el test y el typecheck**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/ts.sh scripts/_invitaciones.ts; echo "exit $?"`
Expected: typecheck limpio; `--- 44/44 ok`, `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/usuarios
git commit -m "InvitacionService: invitar (de a uno o en lote), reenviar, cancelar y listar pendientes"
```

---
### Task 3: La persona invitada — consultar, activar, login y "¿Olvidaste tu contraseña?"

**Files:**
- Modify: `server/src/modules/usuarios/invitacion.service.ts`, `usuario.service.ts`, `server/src/container.ts`
- Create (verificación): `server/scripts/_activacion.ts`

**Interfaces:**
- Consumes: `InvitacionService` (Task 2), `nuevoEnlace`/`hashDeToken`/`enlaceVigente` (Task 1).
- Produces: `InvitacionService.consultarInvitacion(token, ahora?): Promise<{ nombre: string; email: string }>`, `activarCuenta(token, password, ahora?): Promise<void>`, `reenviarPorOlvido(usuarioId, ahora): Promise<void>`; `UsuarioService` recibe `InvitacionService` como **último** parámetro del constructor: `new UsuarioService(usuarioRepo, sesionRepo, profesorRepo, unitOfWork, mailer, invitaciones)`; `container.invitacionService` interno (no exportado).

- [ ] **Step 1: Escribir el test que falla** — `server/scripts/_activacion.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { Mailer, MensajeCorreo } from "../src/core/ports";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { nuevoEnlace } from "../src/modules/usuarios/enlaces";
import { InvitacionService } from "../src/modules/usuarios/invitacion.service";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { UsuarioService } from "../src/modules/usuarios/usuario.service";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
class CapturaMailer implements Mailer {
  enviados: MensajeCorreo[] = [];
  async enviar(m: MensajeCorreo) {
    this.enviados.push(m);
  }
}
const mailer = new CapturaMailer();
const usuarioRepo = new PrismaUsuarioRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const uow = new PrismaUnitOfWork(prisma);
const svc = new InvitacionService(usuarioRepo, new PrismaPadreRepository(prisma), profesorRepo, uow, mailer);
const usuarios = new UsuarioService(usuarioRepo, new PrismaSesionRepository(prisma), profesorRepo, uow, mailer, svc);
const P = "prueba-tmp-act";
const MIN = 60_000;
const DIA = 86_400_000;
const ctx = { dispositivo: "x", ip: null };
const tokenDe = (m: MensajeCorreo) => m.texto.match(/activar-cuenta\?token=([A-Za-z0-9_-]+)/)?.[1] ?? "";
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function limpiar() {
  const vinculados = (await prisma.padre.findMany({ where: { id: { startsWith: P } } })).map((x) => x.usuarioId).filter((x): x is string => !!x);
  await prisma.padre.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { in: vinculados } }, { email: { startsWith: P } }] } });
}
const padre = (n: number) =>
  prisma.padre.create({ data: { id: `${P}-p${n}`, nombre: "Pruebainv", apellido: `Padre ${n}`, dni: `9910000${n}`, email: `${P}-${n}@x.test`, vinculo: "padre" } });

(async () => {
  await limpiar();
  await padre(1);
  await padre(2);
  const ahora = new Date();
  await svc.invitar([`${P}-p1`, `${P}-p2`], [], ahora);
  const usuarioId = (await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p1` } })).usuarioId!;
  const token1 = tokenDe(mailer.enviados.find((m) => m.para === `${P}-1@x.test`)!);

  const datos = await svc.consultarInvitacion(token1, ahora);
  ok("consultar: nombre", datos.nombre, "Pruebainv Padre 1");
  ok("consultar: email", datos.email, `${P}-1@x.test`);
  ok("consultar un enlace inventado", await rechazo(svc.consultarInvitacion("inventado", ahora)), "ValidationError");
  ok("consultar a los 8 días", await rechazo(svc.consultarInvitacion(token1, new Date(ahora.getTime() + 8 * DIA))), "ValidationError");
  ok("mensaje del enlace inválido", await svc.consultarInvitacion("inventado", ahora).then(() => "", (e: Error) => e.message), "El enlace no es válido o ya venció.");
  ok("login de una cuenta pendiente", await rechazo(usuarios.autenticar({ email: `${P}-1@x.test`, password: "cualquiera123" }, ctx)), "AuthenticationError");

  // "¿Olvidaste tu contraseña?" con la cuenta pendiente: llega una invitación nueva, no un enlace de recuperación.
  const base = mailer.enviados.length;
  const olvido = async (minutos: number) => {
    await usuarios.solicitarRecuperacion(`${P}-1@x.test`, new Date(ahora.getTime() + minutos * MIN));
    await espera(400);
    return mailer.enviados.length - base;
  };
  ok("olvidé con la cuenta pendiente: llega un correo", await olvido(2), 1);
  ok("ese correo es una invitación", mailer.enviados.at(-1)?.asunto, "Te invitamos a Babylon English Institute");
  ok("no se crean enlaces de recuperación", await prisma.tokenCuenta.count({ where: { usuarioId, tipo: "recuperacion" } }), 0);
  ok("el enlace anterior quedó anulado", await rechazo(svc.consultarInvitacion(token1, ahora)), "ValidationError");
  const token2 = tokenDe(mailer.enviados.at(-1)!);
  ok("otro pedido a los 10 segundos: no se envía", await olvido(2 + 1 / 6), 1);
  ok("tercer envío de la hora: se envía", await olvido(4), 2);
  ok("cuarto en la hora: no se envía", await olvido(6), 2);
  const token3 = tokenDe(mailer.enviados.at(-1)!);

  // Enlaces de otro tipo o anulados no activan la cuenta
  const recuperacion = nuevoEnlace(usuarioId, "recuperacion", ahora);
  await usuarioRepo.crearToken(recuperacion.registro);
  const tAct = new Date(ahora.getTime() + 7 * MIN);
  ok("activar con un enlace de recuperación", await rechazo(svc.activarCuenta(recuperacion.token, "MiClaveNueva123", tAct)), "ValidationError");
  ok("activar con un enlace anulado", await rechazo(svc.activarCuenta(token2, "MiClaveNueva123", tAct)), "ValidationError");

  await svc.activarCuenta(token3, "MiClaveNueva123", tAct);
  const activada = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  ok("activar: la cuenta queda activa", activada.estado, "activo");
  ok("activar: el email queda verificado", si(activada.emailVerificadoEn?.getTime() === tAct.getTime()), "sí");
  const sesion = await usuarios.autenticar({ email: `${P}-1@x.test`, password: "MiClaveNueva123" }, ctx);
  ok("activar: entra con la contraseña elegida", si(sesion.requiereSeleccionRol === false), "sí");
  ok("el enlace sirve una sola vez", await rechazo(svc.activarCuenta(token3, "OtraClave12345", tAct)), "ValidationError");
  const invitacionSuelta = nuevoEnlace(usuarioId, "invitacion", tAct);
  await usuarioRepo.crearToken(invitacionSuelta.registro);
  ok("restablecer con un enlace de invitación", await rechazo(usuarios.restablecerContrasena(invitacionSuelta.token, "OtraClave12345", tAct)), "ValidationError");

  // Dos activaciones simultáneas con el mismo enlace: una sola gana
  const token4 = tokenDe(mailer.enviados.find((m) => m.para === `${P}-2@x.test`)!);
  const dobles = await Promise.all([rechazo(svc.activarCuenta(token4, "ClaveUno123456", tAct)), rechazo(svc.activarCuenta(token4, "ClaveDos123456", tAct))]);
  ok("activación doble: una gana", dobles.filter((d) => d === "ok").length, 1);
  ok("activación doble: la otra es rechazada", dobles.filter((d) => d === "ValidationError").length, 1);

  await limpiar();
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: P } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `bash $SCRATCH/ts.sh scripts/_activacion.ts | tail -3`
Expected: falla (`svc.consultarInvitacion is not a function`, y el typecheck del constructor de `UsuarioService` no aplica en `tsx`).

- [ ] **Step 3: Métodos de la persona invitada** — en `invitacion.service.ts`, el import de enlaces pasa a `import { enlaceVigente, hashDeToken, nuevoEnlace } from "./enlaces";` y, después de `listarPendientes`, se agregan:

```ts
  // Para la pantalla de activación: a quién pertenece el enlace (saludo y email). Mismo mensaje para cualquier problema.
  async consultarInvitacion(token: string, ahora: Date = new Date()): Promise<{ nombre: string; email: string }> {
    const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token));
    if (!registro || registro.tipo !== "invitacion" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
    const usuario = await this.usuarioRepo.findById(registro.usuarioId);
    if (!usuario || usuario.estado !== "pendiente") throw new ValidationError(ENLACE_NO_VALIDO);
    return { nombre: usuario.nombre, email: usuario.email };
  }

  // La persona elige su contraseña: la cuenta queda activa y con el email verificado (el correo le llegó).
  async activarCuenta(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      if (!registro || registro.tipo !== "invitacion" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) throw new ValidationError(ENLACE_NO_VALIDO);
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "pendiente") throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash, estado: "activo", emailVerificadoEn: ahora }, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "invitacion", ahora, tx);
    });
  }

  // "¿Olvidaste tu contraseña?" con la invitación todavía pendiente: se manda una nueva, con los límites de la
  // recuperación (1 minuto entre envíos y 3 por hora). No informa nada: la respuesta al pedido es siempre la misma.
  async reenviarPorOlvido(usuarioId: string, ahora: Date): Promise<void> {
    const preparacion = await this.renovarInvitacion(usuarioId, ahora, true);
    if ("cuenta" in preparacion) await this.enviarInvitacion(preparacion.cuenta);
  }
```

`usuario.service.ts`: agregar `import type { InvitacionService } from "./invitacion.service";`, el parámetro `private readonly invitaciones: InvitacionService,` al final del constructor (después de `mailer`), y reemplazar `solicitarRecuperacion` por:

```ts
  async solicitarRecuperacion(email: string, ahora: Date = new Date()): Promise<void> {
    const usuario = await this.usuarioRepo.findByEmail(email);
    if (!usuario) return;
    // Invitación todavía sin aceptar: en vez de un enlace de recuperación se manda una invitación nueva.
    if (usuario.estado === "pendiente") {
      void this.invitaciones.reenviarPorOlvido(usuario.id, ahora).catch((error) =>
        console.error(`[correo] no se pudo preparar la invitación de ${usuario.email}:`, error),
      );
      return;
    }
    if (usuario.estado !== "activo") return;

    void this.enviarEnlaceDeRecuperacion(usuario, ahora).catch((error) =>
      console.error(`[correo] no se pudo preparar la recuperación de ${usuario.email}:`, error),
    );
  }
```

`container.ts`: agregar `import { InvitacionService } from "./modules/usuarios/invitacion.service";` y reemplazar la línea de `usuarioService` por:

```ts
const invitacionService = new InvitacionService(usuarioRepository, padreRepository, profesorRepository, unitOfWork, mailer);
const usuarioService = new UsuarioService(usuarioRepository, sesionRepository, profesorRepository, unitOfWork, mailer, invitacionService);
```

Los scripts de verificación que construyen `UsuarioService` a mano (`_carrera-login.ts`, `_menores.ts`) necesitan el parámetro nuevo:

```bash
cd server && python3 - <<'EOF'
for p in ("scripts/_carrera-login.ts", "scripts/_menores.ts"):
    s = open(p).read()
    if "InvitacionService" not in s:
        s = s.replace('import { UsuarioService } from "../src/modules/usuarios/usuario.service";',
                      'import { UsuarioService } from "../src/modules/usuarios/usuario.service";\nimport { InvitacionService } from "../src/modules/usuarios/invitacion.service";\nimport { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";')
        s = s.replace("new ConsoleMailer())", "new ConsoleMailer(), new InvitacionService(new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), new PrismaProfesorRepository(prisma), new PrismaUnitOfWork(prisma), new ConsoleMailer()))")
    open(p, "w").write(s)
EOF
grep -c "InvitacionService(" scripts/_carrera-login.ts scripts/_menores.ts
```
Expected: `1` en ambos.

- [ ] **Step 4: Correr el test, los vecinos y el typecheck**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/ts.sh scripts/_activacion.ts; echo "exit $?"; for s in _invitaciones _carrera-login _menores; do bash $SCRATCH/ts.sh scripts/$s.ts | tail -1; done`
Expected: typecheck limpio; `--- 23/23 ok`, `exit 0`; los otros tres en verde (44, 9 y 9).

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "Activar la invitación, consultar el enlace, y '¿Olvidaste tu contraseña?' reenvía la invitación pendiente"
```

---

### Task 4: API de invitaciones y de activación

**Files:**
- Create: `server/src/modules/usuarios/invitacion.schema.ts`, `invitacion.controller.ts`, `invitacion.routes.ts`
- Modify: `server/src/core/middlewares/limitesDePedidos.ts`, `server/src/container.ts`, `server/src/server.ts`
- Modify (verificación): `$SCRATCH/lib.sh`; Create: `$SCRATCH/verificar-invitaciones.sh`

**Interfaces:**
- Consumes: `InvitacionService` completo (Tasks 2 y 3).
- Produces: `GET /api/auth/pendientes` (admin) → `FilaPendiente[]`; `POST /api/auth/invitaciones` (admin) `{ padreIds?, profesorIds? }` → `{ resultados: ResultadoEnvio[] }`; `POST /api/auth/invitaciones/reenviar` (admin) `{ usuarioIds }` → `{ resultados }`; `DELETE /api/auth/invitaciones/:usuarioId` (admin) → 204/404/409; `POST /api/auth/activar-cuenta/consultar` `{ token }` → `{ nombre, email }`; `POST /api/auth/activar-cuenta` `{ token, password }` → 204. `container.invitacionController`. En `lib.sh`: `post TOKEN ruta JSON`, `http RESPUESTA`, `js EXPRESION`, `token_de EMAIL RUTA`.

- [ ] **Step 1: Helpers de prueba y verificación que falla**

Agregar al final de `$SCRATCH/lib.sh`:

```bash
# post TOKEN ruta JSON -> cuerpo de la respuesta seguido de " [código]"
post() { curl -s -w " [%{http_code}]" -X POST "$API/$2" -H "authorization: Bearer $1" -H 'content-type: application/json' -d "$3"; }
# http RESPUESTA -> el código HTTP de una respuesta de post
http() { echo "$1" | grep -o '\[[0-9]*\]$' | tr -d '[]'; }
# js EXPRESION -> evalúa la expresión de Python sobre el JSON (d) de una respuesta de post
js() { python3 -c "import sys,json;t=sys.stdin.read().rstrip();t=t.rsplit(' [',1)[0];d=json.loads(t);print($1)"; }
# token_de EMAIL RUTA -> último token enviado a EMAIL en un enlace a RUTA (lee los correos del log del server)
token_de() { python3 - "$1" "$2" <<'PY'
import re, sys
email, ruta = sys.argv[1], sys.argv[2]
log = open("/tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/server.log").read()
token = ""
for bloque in log.split("[correo] para: ")[1:]:
    if bloque.startswith(email):
        m = re.search(re.escape(ruta) + r"\?token=([A-Za-z0-9_-]+)", bloque)
        if m:
            token = m.group(1)
print(token)
PY
}
```

`$SCRATCH/verificar-invitaciones.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
P=prueba-tmp-api
limpiar() { q "delete from \"Usuario\" where id in (select \"usuarioId\" from \"Padre\" where id like '$P%' and \"usuarioId\" is not null); delete from \"Padre\" where id like '$P%'; delete from \"Usuario\" where email like '$P%'" >/dev/null; }
bash $SCRATCH/reiniciar-api.sh >/dev/null
limpiar
q "insert into \"Padre\"(id,nombre,apellido,dni,email,vinculo) values ('$P-p1','Pruebainv','Api Uno','99100001','$P-1@x.test','madre'),('$P-p2','Pruebainv','Api Dos','99100002','$P-2@x.test','padre')" >/dev/null
ADMIN=$(login '{"email":"admin@babylon.test","password":"admin1234","rolElegido":"admin"}' | tok)
SEC=$(login '{"email":"secretario@babylon.test","password":"secretario1234"}' | tok)
borrar() { curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/auth/invitaciones/$2" -H "authorization: Bearer $1"; }

echo "pendientes sin token: $(curl -s -o /dev/null -w '%{http_code}' $API/auth/pendientes) (esperado 401)"
echo "pendientes como secretario: $(code "$SEC" auth/pendientes) (esperado 403)"
FILAS=$(curl -s $API/auth/pendientes -H "authorization: Bearer $ADMIN")
echo "el padre de prueba figura sin cuenta: $(echo "$FILAS" | python3 -c "import sys,json;print([f['etiqueta'] for f in json.load(sys.stdin) if f['clave']=='padre:$P-p1'][0])") (esperado sin-cuenta)"
echo "invitar como secretario: $(http "$(post "$SEC" auth/invitaciones '{"padreIds":["'$P-p1'"]}')") (esperado 403)"
echo "invitar sin nadie: $(http "$(post "$ADMIN" auth/invitaciones '{}')") (esperado 400)"
IDS=$(python3 -c "import json;print(json.dumps([f'x{i}' for i in range(101)]))")
echo "invitar a 101: $(http "$(post "$ADMIN" auth/invitaciones "{\"padreIds\":$IDS}")") (esperado 400)"
R=$(post "$ADMIN" auth/invitaciones '{"padreIds":["'$P-p1'","'$P-p2'"]}')
echo "invitar a dos: $(http "$R") (esperado 200)"
echo "invitar a dos: enviadas: $(echo "$R" | js 'sum(1 for x in d["resultados"] if x["resultado"]=="enviada")') (esperado 2)"
sleep 0.5
FILAS=$(curl -s $API/auth/pendientes -H "authorization: Bearer $ADMIN")
echo "ahora figura pendiente de aceptación: $(echo "$FILAS" | python3 -c "import sys,json;print([f['etiqueta'] for f in json.load(sys.stdin) if f['email']=='$P-1@x.test'][0])") (esperado pendiente)"
UID1=$(q "select \"usuarioId\" from \"Padre\" where id='$P-p1'")
UID2=$(q "select \"usuarioId\" from \"Padre\" where id='$P-p2'")
T1=$(token_de "$P-1@x.test" /activar-cuenta)
echo "el correo trae el enlace: $([ -n "$T1" ] && echo sí || echo no) (esperado sí)"
R=$(post "" auth/activar-cuenta/consultar "{\"token\":\"$T1\"}")
echo "consultar: $(http "$R") (esperado 200)"
echo "consultar: nombre: $(echo "$R" | js 'd["nombre"]') (esperado Pruebainv Api Uno)"
echo "consultar un enlace inventado: $(http "$(post "" auth/activar-cuenta/consultar '{"token":"inventado"}')") (esperado 400)"
echo "login antes de activar: $(login '{"email":"'$P-1@x.test'","password":"MiClaveNueva123"}' | grep -c 'incorrectos') (esperado 1)"
echo "activar con contraseña corta: $(http "$(post "" auth/activar-cuenta "{\"token\":\"$T1\",\"password\":\"corta\"}")") (esperado 400)"
echo "activar: $(http "$(post "" auth/activar-cuenta "{\"token\":\"$T1\",\"password\":\"MiClaveNueva123\"}")") (esperado 204)"
R=$(post "" auth/activar-cuenta "{\"token\":\"$T1\",\"password\":\"MiClaveNueva123\"}")
echo "activar otra vez: $(http "$R") (esperado 400)"
echo "activar otra vez: mensaje: $(echo "$R" | grep -c 'El enlace no es válido o ya venció.') (esperado 1)"
echo "login después de activar: $(code "$(login '{"email":"'$P-1@x.test'","password":"MiClaveNueva123"}' | tok)" alumnos/mios) (esperado 200)"
echo "reenviar a una cuenta activa: $(post "$ADMIN" auth/invitaciones/reenviar "{\"usuarioIds\":[\"$UID1\"]}" | js 'd["resultados"][0]["motivo"]') (esperado ya activada)"
echo "reenviar enseguida: $(post "$ADMIN" auth/invitaciones/reenviar "{\"usuarioIds\":[\"$UID2\"]}" | js 'd["resultados"][0]["motivo"]') (esperado esperá un minuto para reenviar)"
echo "reenviar sin nadie: $(http "$(post "$ADMIN" auth/invitaciones/reenviar '{"usuarioIds":[]}')") (esperado 400)"
echo "cancelar como secretario: $(borrar "$SEC" "$UID2") (esperado 403)"
echo "cancelar una cuenta activa: $(borrar "$ADMIN" "$UID1") (esperado 409)"
echo "cancelar: $(borrar "$ADMIN" "$UID2") (esperado 204)"
echo "cancelar de nuevo: $(borrar "$ADMIN" "$UID2") (esperado 404)"
echo "tras cancelar, el padre queda sin cuenta: $(q "select coalesce(\"usuarioId\",'nulo') from \"Padre\" where id='$P-p2'") (esperado nulo)"

# límites por IP de los enlaces públicos: 5 cada 15 minutos
bash $SCRATCH/reiniciar-api.sh >/dev/null
for i in 1 2 3 4 5; do post "" auth/activar-cuenta '{"token":"inventado","password":"MiClaveNueva123"}' >/dev/null; done
echo "6.º intento de activar: $(http "$(post "" auth/activar-cuenta '{"token":"inventado","password":"MiClaveNueva123"}')") (esperado 429)"
for i in 1 2 3 4 5; do post "" auth/activar-cuenta/consultar '{"token":"inventado"}' >/dev/null; done
echo "6.ª consulta: $(http "$(post "" auth/activar-cuenta/consultar '{"token":"inventado"}')") (esperado 429)"
bash $SCRATCH/reiniciar-api.sh >/dev/null
limpiar
echo "limpieza: $(q "select count(*) from \"Usuario\" where email like '$P%'") (esperado 0)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/chk.sh $SCRATCH/verificar-invitaciones.sh | tail -5`
Expected: falla (404 en todas las rutas nuevas).

- [ ] **Step 3: Esquemas, controller, rutas y límites**

`server/src/modules/usuarios/invitacion.schema.ts`:

```ts
import { z } from "zod";
import { passwordNueva } from "../../core/validacion";

const MAX_POR_PEDIDO = 100;
const listaDeIds = z.array(z.string().min(1)).max(MAX_POR_PEDIDO, `Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);

export const invitarSchema = z
  .object({ padreIds: listaDeIds.default([]), profesorIds: listaDeIds.default([]) })
  .refine((d) => d.padreIds.length + d.profesorIds.length > 0, { message: "Elegí al menos una persona" })
  .refine((d) => d.padreIds.length + d.profesorIds.length <= MAX_POR_PEDIDO, {
    message: `Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`,
  });

export const reenviarSchema = z.object({
  usuarioIds: listaDeIds.min(1, "Elegí al menos una persona"),
});

export const tokenInvitacionSchema = z.object({ token: z.string().min(1, "Falta el enlace") });

export const activarCuentaSchema = z.object({
  token: z.string().min(1, "Falta el enlace"),
  password: passwordNueva,
});
```

`server/src/modules/usuarios/invitacion.controller.ts`:

```ts
import type { Request, Response } from "express";
import { activarCuentaSchema, invitarSchema, reenviarSchema, tokenInvitacionSchema } from "./invitacion.schema";
import type { InvitacionService } from "./invitacion.service";

export class InvitacionController {
  constructor(private readonly invitaciones: InvitacionService) {}

  listarPendientes = async (_req: Request, res: Response) => {
    res.status(200).json(await this.invitaciones.listarPendientes());
  };

  invitar = async (req: Request, res: Response) => {
    const { padreIds, profesorIds } = invitarSchema.parse(req.body);
    res.status(200).json({ resultados: await this.invitaciones.invitar(padreIds, profesorIds) });
  };

  reenviar = async (req: Request, res: Response) => {
    const { usuarioIds } = reenviarSchema.parse(req.body);
    res.status(200).json({ resultados: await this.invitaciones.reenviar(usuarioIds) });
  };

  cancelar = async (req: Request, res: Response) => {
    await this.invitaciones.cancelar(String(req.params.usuarioId));
    res.status(204).end();
  };

  consultar = async (req: Request, res: Response) => {
    const { token } = tokenInvitacionSchema.parse(req.body);
    res.status(200).json(await this.invitaciones.consultarInvitacion(token));
  };

  activar = async (req: Request, res: Response) => {
    const { token, password } = activarCuentaSchema.parse(req.body);
    await this.invitaciones.activarCuenta(token, password);
    res.status(204).end();
  };
}
```

`server/src/modules/usuarios/invitacion.routes.ts`:

```ts
import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import { limiteActivarCuenta, limiteConsultarInvitacion } from "../../core/middlewares/limitesDePedidos";
import type { InvitacionController } from "./invitacion.controller";

// Montado en /api/auth, junto a las rutas de usuario.routes.ts.
export function invitacionRoutes(controller: InvitacionController): Router {
  const router = Router();

  // Públicas: el enlace del correo es la única credencial (el token va en el cuerpo, nunca en la URL de la API).
  router.post("/activar-cuenta/consultar", limiteConsultarInvitacion, controller.consultar);
  router.post("/activar-cuenta", limiteActivarCuenta, controller.activar);

  router.get("/pendientes", authMiddleware, requireRole("admin"), controller.listarPendientes);
  router.post("/invitaciones", authMiddleware, requireRole("admin"), controller.invitar);
  router.post("/invitaciones/reenviar", authMiddleware, requireRole("admin"), controller.reenviar);
  router.delete("/invitaciones/:usuarioId", authMiddleware, requireRole("admin"), controller.cancelar);

  return router;
}
```

Al final de `limitesDePedidos.ts`:

```ts
// Enlaces públicos de invitación: quien prueba enlaces al azar choca con el límite.
export const limiteConsultarInvitacion = rateLimit({ ...base, limit: 5 });
export const limiteActivarCuenta = rateLimit({ ...base, limit: 5 });
```

`container.ts`: `import { InvitacionController } from "./modules/usuarios/invitacion.controller";` y, en el objeto `container`, después de `usuarioController: new UsuarioController(usuarioService),`:

```ts
  invitacionController: new InvitacionController(invitacionService),
```

`server.ts`: `import { invitacionRoutes } from "./modules/usuarios/invitacion.routes";` y, después de `app.use("/api/auth", usuarioRoutes(container.usuarioController));`:

```ts
app.use("/api/auth", invitacionRoutes(container.invitacionController));
```

- [ ] **Step 4: Correr la verificación**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/chk.sh $SCRATCH/verificar-invitaciones.sh; echo "exit $?"`
Expected: typecheck limpio; `--- 30/30 ok`, `exit 0`.

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "API de invitaciones (pendientes, invitar, reenviar, cancelar) y de activación de cuenta"
```

---

### Task 5: Altas con invitación o con contraseña asignada

**Files:**
- Modify: `server/src/modules/padres/padre.schema.ts`, `padre.service.ts`; `server/src/modules/profesores/profesor.schema.ts`, `profesor.service.ts`; `server/src/modules/usuarios/usuario.schema.ts`, `usuario.service.ts`; `server/src/container.ts`
- Create (verificación): `$SCRATCH/verificar-altas.sh`

**Interfaces:**
- Consumes: `InvitacionService.prepararCuentaPendiente`, `enviarInvitacion`, `EstadoInvitacion` (Task 2).
- Produces: `password` opcional en `POST /api/padres`, `/api/profesores`, `/api/auth/secretarios`, `/api/auth/administradores`; sus respuestas suman `invitacion: "enviada" | "no-enviada" | null`. `PadreService(padreRepo, usuarioRepo, unitOfWork, invitaciones)`, `ProfesorService(profesorRepo, usuarioRepo, sesionRepo, unitOfWork, invitaciones)`; tipos `PadreCreado`, `ProfesorCreado`, `UsuarioCreado`. `GET /api/auth/usuarios` excluye las cuentas pendientes; `PATCH /api/auth/usuarios/:id/estado` sobre una pendiente → 400 "La cuenta todavía no fue activada".

- [ ] **Step 1: Escribir la verificación que falla** — `$SCRATCH/verificar-altas.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
P=prueba-tmp-alta
limpiar() { q "delete from \"Padre\" where email like '$P%'; delete from \"Profesor\" where email like '$P%'; delete from \"Usuario\" where email like '$P%'" >/dev/null; }
bash $SCRATCH/reiniciar-api.sh >/dev/null
limpiar
ADMIN=$(login '{"email":"admin@babylon.test","password":"admin1234","rolElegido":"admin"}' | tok)
SEC=$(login '{"email":"secretario@babylon.test","password":"secretario1234"}' | tok)
estado() { q "select estado from \"Usuario\" where email='$1'"; }
padre() { echo '{"nombre":"Pruebainv","apellido":"Alta","dni":"'$1'","email":"'$2'","vinculo":"madre"'${3:+,\"password\":\"$3\"}'}'; }

R=$(post "$ADMIN" padres "$(padre 99200001 $P-padre@x.test)")
echo "padre sin contraseña: $(http "$R") (esperado 201)"
echo "padre sin contraseña: invitación: $(echo "$R" | js 'd["invitacion"]') (esperado enviada)"
echo "padre sin contraseña: cuenta pendiente: $(estado $P-padre@x.test) (esperado pendiente)"
echo "padre sin contraseña: padre vinculado: $(q "select count(*) from \"Padre\" p join \"Usuario\" u on u.id=p.\"usuarioId\" where p.dni='99200001'") (esperado 1)"
sleep 0.3
echo "padre sin contraseña: llegó el enlace: $([ -n "$(token_de $P-padre@x.test /activar-cuenta)" ] && echo sí || echo no) (esperado sí)"
R=$(post "$ADMIN" padres "$(padre 99200002 $P-padre2@x.test ClaveAsignada123)")
echo "padre con contraseña: $(http "$R") (esperado 201)"
echo "padre con contraseña: sin invitación: $(echo "$R" | js 'd["invitacion"] is None') (esperado True)"
echo "padre con contraseña: cuenta activa: $(estado $P-padre2@x.test) (esperado activo)"
echo "padre con contraseña: email sin verificar: $(q "select \"emailVerificadoEn\" is null from \"Usuario\" where email='$P-padre2@x.test'") (esperado t)"
echo "padre con contraseña corta: $(http "$(post "$ADMIN" padres "$(padre 99200003 $P-padre3@x.test corta)")") (esperado 400)"
echo "el secretario también invita al dar de alta un padre: $(post "$SEC" padres "$(padre 99200004 $P-padre4@x.test)" | js 'd["invitacion"]') (esperado enviada)"
R=$(post "$ADMIN" profesores '{"nombre":"Pruebainv","apellido":"Profe","dni":"99200005","email":"'$P'-profe@x.test"}')
echo "profesor sin contraseña: $(echo "$R" | js 'd["invitacion"]') (esperado enviada)"
echo "profesor sin contraseña: cuenta pendiente de profesor: $(q "select estado||'/'||array_to_string(roles,',') from \"Usuario\" where email='$P-profe@x.test'") (esperado pendiente/profesor)"
echo "profesor con contraseña: $(post "$ADMIN" profesores '{"nombre":"Pruebainv","apellido":"Profe Dos","dni":"99200006","email":"'$P'-profe2@x.test","password":"ClaveAsignada123"}' | js 'd["invitacion"] is None') (esperado True)"
echo "secretario sin contraseña: $(post "$ADMIN" auth/secretarios '{"nombre":"Pruebainv Secretaria","email":"'$P'-sec@x.test"}' | js 'd["invitacion"]+"/"+d["estado"]') (esperado enviada/pendiente)"
echo "secretario con contraseña: $(post "$ADMIN" auth/secretarios '{"nombre":"Pruebainv Secretaria Dos","email":"'$P'-sec2@x.test","password":"ClaveAsignada123"}' | js 'str(d["invitacion"])+"/"+d["estado"]') (esperado None/activo)"
echo "administrador sin contraseña: $(post "$ADMIN" auth/administradores '{"nombre":"Pruebainv Admin","email":"'$P'-adm@x.test"}' | js 'd["invitacion"]') (esperado enviada)"
echo "la respuesta nunca trae el hash: $(post "$ADMIN" auth/secretarios '{"nombre":"Pruebainv Sec Tres","email":"'$P'-sec3@x.test"}' | grep -c passwordHash) (esperado 0)"
LISTA=$(curl -s $API/auth/usuarios -H "authorization: Bearer $ADMIN")
echo "Cuentas no lista las pendientes: $(echo "$LISTA" | python3 -c "import sys,json;print(sum(1 for u in json.load(sys.stdin) if u['email'].startswith('$P') and u['estado']=='pendiente'))") (esperado 0)"
echo "Cuentas lista las activas: $(echo "$LISTA" | python3 -c "import sys,json;print(sum(1 for u in json.load(sys.stdin) if u['email'].startswith('$P')))") (esperado 3)"
PEND=$(q "select id from \"Usuario\" where email='$P-sec@x.test'")
R=$(curl -s -w " [%{http_code}]" -X PATCH $API/auth/usuarios/$PEND/estado -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"estado":"inactivo"}')
echo "cambiar el estado de una cuenta pendiente: $(http "$R") (esperado 400)"
echo "el mensaje lo explica: $(echo "$R" | grep -c 'La cuenta todavía no fue activada') (esperado 1)"
echo "alta con un email ya usado: $(http "$(post "$ADMIN" auth/secretarios '{"nombre":"Pruebainv X","email":"'$P'-sec@x.test"}')") (esperado 409)"
limpiar
echo "limpieza: $(q "select count(*) from \"Usuario\" where email like '$P%'") (esperado 0)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/chk.sh $SCRATCH/verificar-altas.sh | tail -6`
Expected: falla (las altas sin contraseña dan 400 y las respuestas no traen `invitacion`).

- [ ] **Step 3: Esquemas** — en `padre.schema.ts` (`crearPadreSchema`), `profesor.schema.ts` (`crearProfesorSchema`) y `usuario.schema.ts` (`crearSecretarioSchema`), la línea `password: passwordNueva,` pasa a:

```ts
  // Sin contraseña, la cuenta se crea pendiente y se manda una invitación por email.
  password: passwordNueva.optional(),
```

- [ ] **Step 4: Servicios**

`padre.service.ts`: agregar `import type { CuentaPreparada, EstadoInvitacion, InvitacionService } from "../usuarios/invitacion.service";`, el tipo exportado y el parámetro nuevo:

```ts
export type PadreCreado = Padre & { invitacion: EstadoInvitacion | null };
```

```ts
  constructor(
    private readonly padreRepo: PadreRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly invitaciones: InvitacionService,
  ) {}
```

y reemplazar `crearPadre` completo por:

```ts
  async crearPadre(datos: CrearPadreInput): Promise<PadreCreado> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const dniExistente = await this.padreRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un padre/tutor con el DNI ${datos.dni}`);
    }

    const ahora = new Date();
    const nombreCuenta = `${datos.nombre} ${datos.apellido}`;
    const { padre, cuenta } = await this.unitOfWork.runInTransaction(async (tx) => {
      let usuarioId: string;
      let cuenta: CuentaPreparada | null = null;
      if (datos.password) {
        const usuario: Usuario = {
          id: randomUUID(),
          nombre: nombreCuenta,
          email: datos.email,
          passwordHash: await bcrypt.hash(datos.password, 10),
          roles: ["padre"],
          estado: "activo",
          fechaCreacion: ahora,
          emailVerificadoEn: null,
        };
        await this.usuarioRepo.create(usuario, tx);
        usuarioId = usuario.id;
      } else {
        // Sin contraseña: la cuenta queda pendiente y la invitación se manda después de confirmar la transacción.
        cuenta = await this.invitaciones.prepararCuentaPendiente({ nombre: nombreCuenta, email: datos.email, roles: ["padre"] }, ahora, tx);
        usuarioId = cuenta.usuario.id;
      }

      const padre: Padre = {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        vinculo: datos.vinculo,
        usuarioId,
      };
      return { padre: await this.padreRepo.create(padre, tx), cuenta };
    });

    if (!cuenta) return { ...padre, invitacion: null };
    return { ...padre, invitacion: (await this.invitaciones.enviarInvitacion(cuenta)) ? "enviada" : "no-enviada" };
  }
```

`profesor.service.ts`: mismo import, `export type ProfesorCreado = Profesor & { invitacion: EstadoInvitacion | null };`, el parámetro `private readonly invitaciones: InvitacionService,` al final del constructor (después de `unitOfWork`), y `crearProfesor` completo:

```ts
  async crearProfesor(datos: CrearProfesorInput): Promise<ProfesorCreado> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const dniExistente = await this.profesorRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un profesor con el DNI ${datos.dni}`);
    }

    const ahora = new Date();
    const nombreCuenta = `${datos.nombre} ${datos.apellido}`;
    const { profesor, cuenta } = await this.unitOfWork.runInTransaction(async (tx) => {
      let usuarioId: string;
      let cuenta: CuentaPreparada | null = null;
      if (datos.password) {
        const usuario: Usuario = {
          id: randomUUID(),
          nombre: nombreCuenta,
          email: datos.email,
          passwordHash: await bcrypt.hash(datos.password, 10),
          roles: ["profesor"],
          estado: "activo",
          fechaCreacion: ahora,
          emailVerificadoEn: null,
        };
        await this.usuarioRepo.create(usuario, tx);
        usuarioId = usuario.id;
      } else {
        // Sin contraseña: la cuenta queda pendiente y la invitación se manda después de confirmar la transacción.
        cuenta = await this.invitaciones.prepararCuentaPendiente({ nombre: nombreCuenta, email: datos.email, roles: ["profesor"] }, ahora, tx);
        usuarioId = cuenta.usuario.id;
      }

      const profesor: Profesor = {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        usuarioId,
        estado: "activo",
      };
      return { profesor: await this.profesorRepo.create(profesor, tx), cuenta };
    });

    if (!cuenta) return { ...profesor, invitacion: null };
    return { ...profesor, invitacion: (await this.invitaciones.enviarInvitacion(cuenta)) ? "enviada" : "no-enviada" };
  }
```

`usuario.service.ts`: el import de `./invitacion.service` pasa a `import type { EstadoInvitacion, InvitacionService } from "./invitacion.service";`; debajo de `UsuarioSinPassword`:

```ts
export type UsuarioCreado = UsuarioSinPassword & { invitacion: EstadoInvitacion | null };
```

`crearSecretario`, `crearAdministrador` y `crearUsuarioSimple` pasan a devolver `Promise<UsuarioCreado>`, y `crearUsuarioSimple` queda:

```ts
  private async crearUsuarioSimple(datos: CrearSecretarioInput, rol: Rol): Promise<UsuarioCreado> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const ahora = new Date();

    if (!datos.password) {
      // Sin contraseña: cuenta pendiente e invitación por email (enviada después de confirmar la transacción).
      const cuenta = await this.unitOfWork.runInTransaction((tx) =>
        this.invitaciones.prepararCuentaPendiente({ nombre: datos.nombre, email: datos.email, roles: [rol] }, ahora, tx),
      );
      const enviada = await this.invitaciones.enviarInvitacion(cuenta);
      const { passwordHash: _passwordHash, ...sinPassword } = cuenta.usuario;
      return { ...sinPassword, invitacion: enviada ? "enviada" : "no-enviada" };
    }

    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
      roles: [rol],
      estado: "activo",
      fechaCreacion: ahora,
      emailVerificadoEn: null,
    };
    await this.usuarioRepo.create(usuario);

    const { passwordHash: _passwordHash, ...sinPassword } = usuario;
    return { ...sinPassword, invitacion: null };
  }
```

En `listarUsuarios`, después de `return usuarios` agregar el filtro `.filter((u) => u.estado !== "pendiente")` (las pendientes se ven en la pestaña Pendientes). En `cambiarEstado`, dentro de la transacción, después de `await this.usuarioRepo.bloquearCuenta(id, tx);`:

```ts
      const actual = await this.usuarioRepo.findById(id, tx);
      if (!actual) throw new EntityNotFoundError("Usuario", id);
      // Una invitación sin aceptar se gestiona desde Pendientes (reenviar o cancelar), no con el interruptor de estado.
      if (actual.estado === "pendiente") throw new ValidationError("La cuenta todavía no fue activada");
```

`container.ts`: las construcciones de `padreService` y `profesorService` pasan a

```ts
const padreService = new PadreService(padreRepository, usuarioRepository, unitOfWork, invitacionService);
const profesorService = new ProfesorService(profesorRepository, usuarioRepository, sesionRepository, unitOfWork, invitacionService);
```

(y `invitacionService` tiene que estar declarado antes que ambas: moverlas debajo de su declaración si hace falta).

- [ ] **Step 5: Correr la verificación y las vecinas**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/chk.sh $SCRATCH/verificar-altas.sh; echo "exit $?"; bash $SCRATCH/chk.sh $SCRATCH/verificar-sesiones.sh | tail -1`
Expected: typecheck limpio; `--- 24/24 ok`, `exit 0`; sesiones `--- 25/25 ok` (desactivar desde la ficha y por estado sigue funcionando).

- [ ] **Step 6: Commit**

```bash
git add server/src
git commit -m "Altas de padre, profesor, secretario y administrador con invitación por email o contraseña asignada"
```

---

### Task 6: Verificación del email (server)

**Files:**
- Modify: `server/src/core/errors.ts`, `server/src/core/middlewares/limitesDePedidos.ts`, `usuario.service.ts`, `usuario.schema.ts`, `usuario.controller.ts`, `usuario.routes.ts`
- Create: `server/src/modules/usuarios/correoVerificacion.ts`
- Create (verificación): `$SCRATCH/verificar-verificacion.sh`

**Interfaces:**
- Consumes: enlaces con tipo (Task 1), `ENLACE_NO_VALIDO` (Task 2).
- Produces: `class DemasiadosPedidosError extends DomainError` (429); `UsuarioService.enviarVerificacion(usuarioId, ahora?)`, `verificarEmail(token, ahora?)`, `yo(usuarioId, rol): Promise<DatosPropios>`; `interface DatosPropios { id; nombre; email; rol: Rol; emailVerificado: boolean }`; `GET /api/auth/yo`, `POST /api/auth/enviar-verificacion` (autenticado), `POST /api/auth/verificar-email` (público, `{ token }`); `limiteVerificarEmail`. Recuperar la contraseña con éxito deja el email verificado.

- [ ] **Step 1: Escribir la verificación que falla** — `$SCRATCH/verificar-verificacion.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
P6=$(uid p6@prueba.babylon.test)
reset() { q "update \"Usuario\" set \"emailVerificadoEn\"=null where id='$P6'; delete from \"TokenCuenta\" where \"usuarioId\"='$P6'" >/dev/null; }
bash $SCRATCH/reiniciar-api.sh >/dev/null
reset
T=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234"}' | tok)
yo() { curl -s $API/auth/yo -H "authorization: Bearer $T" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }

echo "yo sin token: $(curl -s -o /dev/null -w '%{http_code}' $API/auth/yo) (esperado 401)"
echo "yo: email: $(yo email) (esperado p6@prueba.babylon.test)"
echo "yo: rol: $(yo rol) (esperado padre)"
echo "yo: sin verificar: $(yo emailVerificado) (esperado False)"
echo "enviar el enlace: $(http "$(post "$T" auth/enviar-verificacion '{}')") (esperado 204)"
R=$(post "$T" auth/enviar-verificacion '{}')
echo "enviar otra vez enseguida: $(http "$R") (esperado 429)"
echo "el mensaje lo explica: $(echo "$R" | grep -c 'Ya te enviamos un enlace hace poco') (esperado 1)"
sleep 0.3
TV=$(token_de p6@prueba.babylon.test /verificar-email)
echo "el correo trae el enlace: $([ -n "$TV" ] && echo sí || echo no) (esperado sí)"
echo "vence a las 24 horas: $(q "select round(extract(epoch from \"expiraEn\"-\"creadoEn\")/3600) from \"TokenCuenta\" where \"usuarioId\"='$P6' and tipo='verificacion_email' and \"usadoEn\" is null") (esperado 24)"
echo "verificar un enlace inventado: $(http "$(post "" auth/verificar-email '{"token":"inventado"}')") (esperado 400)"
echo "verificar: $(http "$(post "" auth/verificar-email "{\"token\":\"$TV\"}")") (esperado 204)"
echo "yo: verificado: $(yo emailVerificado) (esperado True)"
echo "verificar otra vez con el mismo enlace: $(http "$(post "" auth/verificar-email "{\"token\":\"$TV\"}")") (esperado 400)"
R=$(post "$T" auth/enviar-verificacion '{}')
echo "enviar con el email ya verificado: $(http "$R") (esperado 400)"
echo "el mensaje: $(echo "$R" | grep -c 'Tu email ya está verificado') (esperado 1)"

# 3 envíos por hora: se atrasa 2 minutos el reloj de los enlaces entre pedido y pedido
q "update \"Usuario\" set \"emailVerificadoEn\"=null where id='$P6'" >/dev/null
atrasar() { q "update \"TokenCuenta\" set \"creadoEn\"=\"creadoEn\"-interval '2 minutes' where \"usuarioId\"='$P6' and tipo='verificacion_email'" >/dev/null; }
atrasar; echo "segundo envío de la hora: $(http "$(post "$T" auth/enviar-verificacion '{}')") (esperado 204)"
atrasar; echo "tercer envío de la hora: $(http "$(post "$T" auth/enviar-verificacion '{}')") (esperado 204)"
atrasar; echo "cuarto envío de la hora: $(http "$(post "$T" auth/enviar-verificacion '{}')") (esperado 429)"

# un enlace de invitación no verifica el email
q "insert into \"TokenCuenta\"(id,\"usuarioId\",tipo,hash,\"creadoEn\",\"expiraEn\") values ('prueba-tmp-cruzado','$P6','invitacion',encode(sha256('token-cruzado-babylon'::bytea),'hex'),now(),now()+interval '1 day')" >/dev/null
echo "verificar con un enlace de invitación: $(http "$(post "" auth/verificar-email '{"token":"token-cruzado-babylon"}')") (esperado 400)"

# recuperar la contraseña con éxito también verifica el email
reset
bash $SCRATCH/reiniciar-api.sh >/dev/null
curl -s -o /dev/null -X POST $API/auth/olvide-contrasena -H 'content-type: application/json' -d '{"email":"p6@prueba.babylon.test"}'; sleep 1
TR=$(token_de p6@prueba.babylon.test /restablecer-contrasena)
echo "restablecer: $(http "$(post "" auth/restablecer-contrasena "{\"token\":\"$TR\",\"password\":\"NuevaClave12345\"}")") (esperado 204)"
echo "recuperar la contraseña verifica el email: $(q "select \"emailVerificadoEn\" is not null from \"Usuario\" where id='$P6'") (esperado t)"
restaurar_p6

# límite por IP de verificar-email: 5 cada 15 minutos
bash $SCRATCH/reiniciar-api.sh >/dev/null
for i in 1 2 3 4 5; do post "" auth/verificar-email '{"token":"inventado"}' >/dev/null; done
echo "6.º intento de verificar: $(http "$(post "" auth/verificar-email '{"token":"inventado"}')") (esperado 429)"
reset
bash $SCRATCH/reiniciar-api.sh >/dev/null
echo "limpieza: $(q "select count(*) from \"TokenCuenta\" where \"usuarioId\"='$P6'") (esperado 0)"
echo "contraseña de prueba restaurada: $(code "$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234"}' | tok)" alumnos/mios) (esperado 200)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/chk.sh $SCRATCH/verificar-verificacion.sh | tail -6`
Expected: falla (404 en `/yo`, `/enviar-verificacion`, `/verificar-email`; la recuperación no marca el email).

- [ ] **Step 3: Error 429, correo y límite**

Al final de `core/errors.ts`:

```ts
// Demasiados pedidos seguidos de la misma cuenta (ej. reenviar el enlace de verificación).
export class DemasiadosPedidosError extends DomainError {
  readonly statusCode = 429;
}
```

Al final de `limitesDePedidos.ts`:

```ts
export const limiteVerificarEmail = rateLimit({ ...base, limit: 5 });
```

`server/src/modules/usuarios/correoVerificacion.ts`:

```ts
import type { MensajeCorreo } from "../../core/ports";
import { escapar } from "./correoHtml";

export function correoVerificacion(nombre: string, para: string, enlace: string): MensajeCorreo {
  const asunto = "Verificá tu email — Babylon English Institute";
  const aclaracion = "El enlace vence en 24 horas y sirve una sola vez. Si no lo pediste, ignorá este correo.";
  const texto = [`Hola ${nombre}:`, "", "Abrí este enlace para confirmar que este email es tuyo:", "", enlace, "", aclaracion].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Abrí este enlace para confirmar que este email es tuyo.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Verificar mi email</a></p>
  <p style="color:#6b7280;font-size:12px">${escapar(aclaracion)}</p>
</div>`;
  return { para, asunto, texto, html };
}
```

- [ ] **Step 4: Servicio, esquema, controller y rutas**

`usuario.service.ts`:
1. Imports: `DemasiadosPedidosError` en el import de `../../core/errors`; `import { correoVerificacion } from "./correoVerificacion";`; el import de `./invitacion.service` suma `ENLACE_NO_VALIDO` (deja de ser `import type`: `import { ENLACE_NO_VALIDO, type EstadoInvitacion, type InvitacionService } from "./invitacion.service";`).
2. Debajo de `UsuarioCreado`:

```ts
// Lo que la persona ve de su propia cuenta (Mi cuenta).
export interface DatosPropios {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  emailVerificado: boolean;
}
```

3. En `restablecerContrasena`, la línea `await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash }, tx);` pasa a:

```ts
      // El enlace llegó a su correo: si el email no estaba verificado, ahora lo está.
      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash, ...(usuario.emailVerificadoEn ? {} : { emailVerificadoEn: ahora }) }, tx);
```

4. Métodos nuevos (antes de `solicitarRecuperacion`):

```ts
  async yo(usuarioId: string, rol: Rol): Promise<DatosPropios> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
    return { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol, emailVerificado: usuario.emailVerificadoEn !== null };
  }

  // Manda el enlace de verificación (24 h). Límites por cuenta: 1 minuto entre envíos y 3 por hora.
  async enviarVerificacion(usuarioId: string, ahora: Date = new Date()): Promise<void> {
    const { usuario, token } = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
      if (usuario.emailVerificadoEn) throw new ValidationError("Tu email ya está verificado");
      const recientes = await this.usuarioRepo.findTokensDesde(usuarioId, "verificacion_email", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      if (recientes.length >= MAX_ENLACES_POR_HORA || recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) {
        throw new DemasiadosPedidosError("Ya te enviamos un enlace hace poco, probá de nuevo en unos minutos");
      }
      await this.usuarioRepo.invalidarTokens(usuarioId, "verificacion_email", ahora, tx);
      const enlace = nuevoEnlace(usuarioId, "verificacion_email", ahora);
      await this.usuarioRepo.crearToken(enlace.registro, tx);
      return { usuario, token: enlace.token };
    });
    await this.mailer.enviar(correoVerificacion(usuario.nombre, usuario.email, `${config.APP_URL}/verificar-email?token=${token}`));
  }

  async verificarEmail(token: string, ahora: Date = new Date()): Promise<void> {
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      if (!registro || registro.tipo !== "verificacion_email" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) throw new ValidationError(ENLACE_NO_VALIDO);
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_NO_VALIDO);
      if (!usuario.emailVerificadoEn) await this.usuarioRepo.actualizarParcial(usuario.id, { emailVerificadoEn: ahora }, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "verificacion_email", ahora, tx);
    });
  }
```

`usuario.schema.ts`, al final:

```ts
export const verificarEmailSchema = z.object({ token: z.string().min(1, "Falta el enlace") });
```

`usuario.controller.ts`: sumar `verificarEmailSchema` al import de `./usuario.schema` y, dentro de la clase:

```ts
  yo = async (req: Request, res: Response) => {
    res.status(200).json(await this.usuarioService.yo(req.auth!.sub, req.auth!.rol));
  };

  enviarVerificacion = async (req: Request, res: Response) => {
    await this.usuarioService.enviarVerificacion(req.auth!.sub);
    res.status(204).end();
  };

  verificarEmail = async (req: Request, res: Response) => {
    const { token } = verificarEmailSchema.parse(req.body);
    await this.usuarioService.verificarEmail(token);
    res.status(204).end();
  };
```

`usuario.routes.ts`: sumar `limiteVerificarEmail` al import de límites y, después de la ruta de `restablecer-contrasena`:

```ts
  router.post("/verificar-email", limiteVerificarEmail, controller.verificarEmail);
  router.get("/yo", authMiddleware, controller.yo);
  router.post("/enviar-verificacion", authMiddleware, controller.enviarVerificacion);
```

- [ ] **Step 5: Correr la verificación y las vecinas**

Run: `cd server && pnpm typecheck 2>&1 | tail -2; bash $SCRATCH/chk.sh $SCRATCH/verificar-verificacion.sh; echo "exit $?"; bash $SCRATCH/chk.sh $SCRATCH/verificar-regresion.sh | tail -1`
Expected: typecheck limpio; `--- 24/24 ok`, `exit 0`; regresión `--- 19/19 ok`.

- [ ] **Step 6: Commit**

```bash
git add server/src
git commit -m "Verificación del email: enviar y confirmar el enlace, datos propios (/yo), y recuperar la contraseña verifica el email"
```

---
### Task 7: Client — pestaña "Pendientes" en Usuarios

**Files:**
- Modify: `client/src/features/usuarios/types.ts`, `usuarioService.ts`, `pages/UsuariosPage.tsx`; `client/src/core/lib/utils.ts`
- Create: `client/src/features/usuarios/hooks/{accesos,usePendientes,useInvitar,useReenviarInvitacion,useCancelarInvitacion}.ts`, `components/{EtiquetaRol,PendientesTab}.tsx`
- Create (verificación): `$SCRATCH/e2e-pendientes.js`

**Interfaces:**
- Consumes: API de la Task 4.
- Produces: tipos `EstadoCuenta` (suma `"pendiente"`), `EstadoInvitacion`, `CuentaCreada`, `EtiquetaAcceso`, `FilaPendiente`, `ResultadoEnvio`, `InvitarInput`; `usuarioService.pendientes/invitar/reenviar/cancelarInvitacion`; `formatFechaCorta(iso)`; `EtiquetaRol` (movida desde `UsuariosPage`); `<PendientesTab />`; pestañas con `role="tab"` "Cuentas" y "Pendientes".

- [ ] **Step 1: Escribir la prueba que falla** — `$SCRATCH/e2e-pendientes.js`:

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const REAL = "http://localhost:5173";
const P = "prueba-tmp-e2e";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
const psql = (sql) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qAtc", sql]).toString().trim();
const limpiar = () => {
  psql(`delete from "Usuario" where id in (select "usuarioId" from "Padre" where id like '${P}%' and "usuarioId" is not null)`);
  psql(`delete from "Padre" where id like '${P}%'`);
  psql(`delete from "Usuario" where email like '${P}%'`);
};
async function entrarAdmin(b, viewport = { width: 1440, height: 900 }) {
  const p = await (await b.newContext({ viewport })).newPage();
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill("admin@babylon.test");
  await p.locator('input[type="password"]').fill("admin1234");
  await p.locator('button[type="submit"]').click();
  await p.getByRole("button", { name: /Administrador/ }).click();
  await p.waitForURL(/dashboard/);
  await p.waitForTimeout(500);
  return p;
}
async function abrirPendientes(p) {
  await p.goto(`${REAL}/usuarios`, { waitUntil: "networkidle" });
  await p.getByRole("tab", { name: "Pendientes" }).click();
  await p.waitForTimeout(500);
  // Siempre filtrado: en la base hay padres y profesores reales sin cuenta que nunca deben invitarse.
  await p.getByLabel("Buscar").fill("Pruebainv");
  await p.waitForTimeout(300);
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  try {
    limpiar();
    psql(`insert into "Padre"(id,nombre,apellido,dni,email,vinculo) values ('${P}-1','Pruebainv','Uno','99400001','${P}-1@x.test','madre'),('${P}-2','Pruebainv','Dos','99400002',null,'padre'),('${P}-3','Pruebainv','Tres','99400003','${P}-3@x.test','tutor')`);
    const p = await entrarAdmin(b);
    await abrirPendientes(p);
    ok("la búsqueda muestra los tres de prueba", await p.locator("tbody tr").count(), 3);
    ok("los tres figuran sin cuenta", await p.locator("tbody").getByText("Sin cuenta", { exact: true }).count(), 3);
    ok("sin email: Invitar deshabilitado", si(await p.getByRole("button", { name: "Invitar a Pruebainv Dos" }).isDisabled()), "sí");
    ok("sin email: se explica por qué", await p.getByText("Cargá un email para poder invitar").count(), 1);
    await p.getByLabel("Filtrar por estado").selectOption("pendiente");
    await p.waitForTimeout(200);
    ok("filtrar por pendiente de aceptación: ninguno", await p.getByText("No hay personas pendientes con estos filtros.").count(), 1);
    await p.getByLabel("Filtrar por estado").selectOption("");
    await p.getByLabel("Marcar todas las visibles").check();
    ok("invitar seleccionados cuenta solo a quienes tienen email", await p.getByRole("button", { name: "Invitar seleccionados (2)" }).count(), 1);

    // Pide confirmación; cancelarla no envía nada
    await p.getByRole("button", { name: "Invitar seleccionados (2)" }).click();
    ok("pide confirmación con la cantidad", await p.getByText("¿Enviar 2 invitaciones?").count(), 1);
    await p.getByRole("button", { name: "Cancelar", exact: true }).click();
    await p.waitForTimeout(300);
    ok("cancelar la confirmación no envía nada", psql(`select count(*) from "Padre" where id like '${P}%' and "usuarioId" is not null`), "0");
    await p.getByRole("button", { name: "Invitar seleccionados (2)" }).click();
    await p.getByRole("button", { name: "Enviar 2 invitaciones" }).click();
    await p.waitForTimeout(1500);
    ok("resumen del envío", await p.getByRole("status").filter({ hasText: "2 enviadas" }).count(), 1);
    ok("ahora figuran pendientes de aceptación", await p.locator("tbody").getByText("Pendiente de aceptación", { exact: true }).count(), 2);
    ok("muestran cuándo vence", await p.locator("tbody").getByText(/vence el \d\d\/\d\d\/\d{4}/).count(), 2);

    // Reenviar enseguida: no se envía y el resumen lo explica
    await p.getByRole("button", { name: "Reenviar la invitación a Pruebainv Uno" }).click();
    ok("confirmación del reenvío", await p.getByText(`¿Reenviar la invitación a Pruebainv Uno (${P}-1@x.test)?`).count(), 1);
    await p.getByRole("button", { name: "Reenviar invitación" }).click();
    await p.waitForTimeout(1200);
    ok("reenviar enseguida: se explica", await p.getByRole("status").filter({ hasText: "esperá un minuto para reenviar" }).count(), 1);

    // Vencida: etiqueta, fecha y botón resaltado
    psql(`update "TokenCuenta" set "expiraEn"=now()-interval '1 day' where "usuarioId"=(select "usuarioId" from "Padre" where id='${P}-1')`);
    await abrirPendientes(p);
    ok("invitación vencida", await p.locator("tbody").getByText("Invitación vencida", { exact: true }).count(), 1);
    ok("muestra cuándo venció", await p.locator("tbody").getByText(/venció el \d\d\/\d\d\/\d{4}/).count(), 1);
    ok("Reenviar queda resaltado en la vencida", await p.getByRole("button", { name: "Reenviar la invitación a Pruebainv Uno" }).getAttribute("data-resaltado"), "true");

    // Cancelar la invitación
    await p.getByRole("button", { name: "Cancelar la invitación de Pruebainv Tres" }).click();
    ok("confirmación de cancelar", await p.getByText(`¿Cancelar la invitación de Pruebainv Tres (${P}-3@x.test)? Se borra la cuenta pendiente.`).count(), 1);
    await p.getByRole("button", { name: "Sí, cancelar invitación" }).click();
    await p.waitForTimeout(1000);
    ok("vuelve a figurar sin cuenta", await p.locator("tr", { hasText: "Pruebainv Tres" }).getByText("Sin cuenta", { exact: true }).count(), 1);
    ok("la cuenta pendiente se borró", psql(`select count(*) from "Usuario" where email='${P}-3@x.test'`), "0");
    await p.screenshot({ path: `${process.env.SCRATCH}/shots/pendientes-1440.png`, fullPage: true });

    await p.getByRole("tab", { name: "Cuentas" }).click();
    await p.waitForTimeout(400);
    ok("Cuentas no lista la invitación pendiente", await p.getByText(`${P}-1@x.test`).count(), 0);

    const m = await entrarAdmin(b, { width: 390, height: 844 });
    await abrirPendientes(m);
    ok("móvil: sin desborde horizontal", await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await m.screenshot({ path: `${process.env.SCRATCH}/shots/pendientes-390.png`, fullPage: true });
  } catch (e) {
    console.log("ERROR del script: " + String(e).split("\n")[0]);
  } finally {
    limpiar();
    await b.close();
    console.log("limpieza hecha");
  }
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-pendientes.js | tail -3`
Expected: falla (no existe la pestaña "Pendientes": `ERROR del script: TimeoutError`).

- [ ] **Step 3: Tipos, servicio, utilidades y hooks**

`client/src/features/usuarios/types.ts` completo:

```ts
import type { Rol } from "@/features/auth/types";

export type EstadoCuenta = "activo" | "inactivo" | "pendiente";

// Cuenta de acceso (Usuario) — la API nunca expone el hash de la contraseña.
export interface CuentaUsuario {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
  estado: EstadoCuenta;
  fechaCreacion: string;
}

// Cómo terminó la invitación de un alta; null: se asignó contraseña y no hubo invitación.
export type EstadoInvitacion = "enviada" | "no-enviada";
export type CuentaCreada = CuentaUsuario & { invitacion: EstadoInvitacion | null };

export interface CrearAdministradorInput {
  nombre: string;
  email: string;
  // Sin contraseña, la cuenta queda pendiente y se manda una invitación por email.
  password?: string;
}

export type EtiquetaAcceso = "sin-cuenta" | "pendiente" | "vencida";

// Una fila de la pestaña Pendientes (GET /api/auth/pendientes).
export interface FilaPendiente {
  clave: string;
  origen: "padre" | "profesor" | "cuenta";
  padreId: string | null;
  profesorId: string | null;
  usuarioId: string | null;
  nombre: string;
  email: string | null;
  roles: Rol[];
  etiqueta: EtiquetaAcceso;
  invitacionEnviadaEn: string | null;
  invitacionVenceEn: string | null;
  sinEmail: boolean;
  emailEnUso: boolean;
}

export interface ResultadoEnvio {
  id: string;
  nombre: string;
  resultado: EstadoInvitacion;
  motivo?: string;
}

export interface InvitarInput {
  padreIds: string[];
  profesorIds: string[];
}
```

`usuarioService.ts` completo:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { CrearAdministradorInput, CuentaCreada, CuentaUsuario, EstadoCuenta, FilaPendiente, InvitarInput, ResultadoEnvio } from "./types";

export const usuarioService = {
  listar: () => apiClient.get<CuentaUsuario[]>("/api/auth/usuarios"),
  cambiarEstado: (id: string, estado: EstadoCuenta) =>
    apiClient.patch<CuentaUsuario>(`/api/auth/usuarios/${id}/estado`, { estado }),
  crearAdministrador: (datos: CrearAdministradorInput) =>
    apiClient.post<CuentaCreada>("/api/auth/administradores", datos),
  pendientes: () => apiClient.get<FilaPendiente[]>("/api/auth/pendientes"),
  invitar: (datos: InvitarInput) =>
    apiClient.post<{ resultados: ResultadoEnvio[] }>("/api/auth/invitaciones", datos).then((r) => r.resultados),
  reenviar: (usuarioIds: string[]) =>
    apiClient.post<{ resultados: ResultadoEnvio[] }>("/api/auth/invitaciones/reenviar", { usuarioIds }).then((r) => r.resultados),
  cancelarInvitacion: (usuarioId: string) => apiClient.delete<void>(`/api/auth/invitaciones/${usuarioId}`),
};
```

En `core/lib/utils.ts`, junto a `formatFechaHora`:

```ts
// "15/10/2026" en la hora local del navegador (para instantes reales, como el envío de una invitación).
export function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
```

`hooks/accesos.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";

// El server acepta hasta 100 personas por pedido: un lote más grande se manda en tandas.
export const TAMANO_TANDA = 100;

// Invitar, reenviar o cancelar cambia Pendientes y, con eso, las cuentas y los vínculos de padres y profesores.
export function invalidarAccesos(queryClient: QueryClient) {
  for (const clave of ["pendientes", "usuarios", "padres", "profesores"]) {
    void queryClient.invalidateQueries({ queryKey: [clave] });
  }
}
```

`hooks/usePendientes.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function usePendientes() {
  return useQuery({ queryKey: ["pendientes"], queryFn: usuarioService.pendientes });
}
```

`hooks/useInvitar.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvitarInput, ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useInvitar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ padreIds, profesorIds }: InvitarInput) => {
      const personas = [...padreIds.map((id) => ({ rol: "padre" as const, id })), ...profesorIds.map((id) => ({ rol: "profesor" as const, id }))];
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < personas.length; i += TAMANO_TANDA) {
        const tanda = personas.slice(i, i + TAMANO_TANDA);
        resultados.push(
          ...(await usuarioService.invitar({
            padreIds: tanda.filter((p) => p.rol === "padre").map((p) => p.id),
            profesorIds: tanda.filter((p) => p.rol === "profesor").map((p) => p.id),
          })),
        );
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
```

`hooks/useReenviarInvitacion.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useReenviarInvitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (usuarioIds: string[]) => {
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < usuarioIds.length; i += TAMANO_TANDA) {
        resultados.push(...(await usuarioService.reenviar(usuarioIds.slice(i, i + TAMANO_TANDA))));
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
```

`hooks/useCancelarInvitacion.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";
import { invalidarAccesos } from "./accesos";

export function useCancelarInvitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usuarioService.cancelarInvitacion,
    onSettled: () => invalidarAccesos(queryClient),
  });
}
```

- [ ] **Step 4: Componentes**

`components/EtiquetaRol.tsx` (se mueve tal cual desde `UsuariosPage.tsx`, junto con `ESTILO_ROL`):

```tsx
import { ROL_LABELS, type Rol } from "@/features/auth/types";

// Colores de la etiqueta de rol, calcados de ROLE_LABELS del prototipo.
const ESTILO_ROL: Record<Rol, { color: string; bg: string; dot: string }> = {
  admin: { color: "#09090B", bg: "#F4F4F5", dot: "#0F3D2E" },
  secretario: { color: "#09090B", bg: "#F4F4F5", dot: "#71717A" },
  profesor: { color: "#0F3D2E", bg: "#F0F4F2", dot: "#1B7A4F" },
  padre: { color: "#52525B", bg: "#FAFAFA", dot: "#A1A1AA" },
};

export function EtiquetaRol({ rol, compacta = false }: { rol: Rol; compacta?: boolean }) {
  const estilo = ESTILO_ROL[rol];
  return (
    <span
      className={`inline-flex shrink-0 items-center font-medium ${
        compacta ? "gap-1 px-2 py-0.5 text-[11px]" : "gap-1.5 px-2 py-0.5 text-[11.5px]"
      }`}
      style={{ background: estilo.bg, color: estilo.color, borderRadius: 2 }}
    >
      <span className={`rounded-full ${compacta ? "h-1 w-1" : "h-1.5 w-1.5"}`} style={{ background: estilo.dot }} />
      {ROL_LABELS[rol]}
    </span>
  );
}
```

`components/PendientesTab.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Mail, RotateCw, X } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { formatFechaCorta, normalizarTexto } from "@/core/lib/utils";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { useCancelarInvitacion } from "../hooks/useCancelarInvitacion";
import { useInvitar } from "../hooks/useInvitar";
import { usePendientes } from "../hooks/usePendientes";
import { useReenviarInvitacion } from "../hooks/useReenviarInvitacion";
import type { EtiquetaAcceso, FilaPendiente, ResultadoEnvio } from "../types";
import { EtiquetaRol } from "./EtiquetaRol";

const ETIQUETAS: Record<EtiquetaAcceso, { texto: string; variante: "neutral" | "warning" | "danger" }> = {
  "sin-cuenta": { texto: "Sin cuenta", variante: "neutral" },
  pendiente: { texto: "Pendiente de aceptación", variante: "warning" },
  vencida: { texto: "Invitación vencida", variante: "danger" },
};
const ORDEN_ROLES: Rol[] = ["admin", "secretario", "profesor", "padre"];

type Accion = "invitar" | "reenviar" | "cancelar";
interface Confirmacion {
  accion: Accion;
  filas: FilaPendiente[];
}

const sePuedeInvitar = (f: FilaPendiente) => f.etiqueta === "sin-cuenta" && !f.sinEmail && !f.emailEnUso;
const sePuedeReenviar = (f: FilaPendiente) => f.etiqueta !== "sin-cuenta";

function motivoParaNoInvitar(f: FilaPendiente): string | null {
  if (f.sinEmail) return "Cargá un email para poder invitar";
  if (f.emailEnUso) return "Email repetido: ya pertenece a otra cuenta";
  return null;
}

function detalle(f: FilaPendiente): string | null {
  if (f.etiqueta === "pendiente" && f.invitacionEnviadaEn && f.invitacionVenceEn) {
    return `enviada el ${formatFechaCorta(f.invitacionEnviadaEn)} · vence el ${formatFechaCorta(f.invitacionVenceEn)}`;
  }
  if (f.etiqueta === "vencida" && f.invitacionVenceEn) return `venció el ${formatFechaCorta(f.invitacionVenceEn)}`;
  return motivoParaNoInvitar(f);
}

function textos({ accion, filas }: Confirmacion) {
  const una = filas.length === 1 ? filas[0] : null;
  const quien = una ? `${una.nombre}${una.email ? ` (${una.email})` : ""}` : "";
  if (accion === "invitar") {
    return {
      titulo: "Enviar invitación",
      pregunta: una ? `¿Enviar invitación a ${quien}?` : `¿Enviar ${filas.length} invitaciones?`,
      confirmar: una ? "Enviar invitación" : `Enviar ${filas.length} invitaciones`,
      volver: "Cancelar",
    };
  }
  if (accion === "reenviar") {
    return {
      titulo: "Reenviar invitación",
      pregunta: una ? `¿Reenviar la invitación a ${quien}?` : `¿Reenviar ${filas.length} invitaciones?`,
      confirmar: una ? "Reenviar invitación" : `Reenviar ${filas.length} invitaciones`,
      volver: "Cancelar",
    };
  }
  return {
    titulo: "Cancelar invitación",
    pregunta: `¿Cancelar la invitación de ${quien}? Se borra la cuenta pendiente.`,
    confirmar: "Sí, cancelar invitación",
    volver: "Volver",
  };
}

export function PendientesTab() {
  const { data: filas, isLoading, isError } = usePendientes();
  const invitar = useInvitar();
  const reenviar = useReenviarInvitacion();
  const cancelar = useCancelarInvitacion();
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [etiqueta, setEtiqueta] = useState<EtiquetaAcceso | "">("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    return (filas ?? []).filter(
      (f) =>
        (!rol || f.roles.includes(rol)) &&
        (!etiqueta || f.etiqueta === etiqueta) &&
        (!termino || normalizarTexto(`${f.nombre} ${f.email ?? ""}`).includes(termino)),
    );
  }, [filas, busqueda, rol, etiqueta]);

  const seleccionadas = visibles.filter((f) => seleccion.has(f.clave));
  const paraInvitar = seleccionadas.filter(sePuedeInvitar);
  const paraReenviar = seleccionadas.filter(sePuedeReenviar);
  const todasMarcadas = visibles.length > 0 && visibles.every((f) => seleccion.has(f.clave));
  const ocupado = invitar.isPending || reenviar.isPending || cancelar.isPending;

  const alternar = (clave: string) =>
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(clave)) nueva.delete(clave);
      else nueva.add(clave);
      return nueva;
    });
  const alternarTodas = () => setSeleccion(todasMarcadas ? new Set() : new Set(visibles.map((f) => f.clave)));

  const confirmar = async () => {
    if (!confirmacion) return;
    const { accion, filas: objetivo } = confirmacion;
    setError(null);
    try {
      if (accion === "invitar") {
        setResultados(
          await invitar.mutateAsync({
            padreIds: objetivo.filter((f) => f.origen === "padre").map((f) => f.padreId!),
            profesorIds: objetivo.filter((f) => f.origen === "profesor").map((f) => f.profesorId!),
          }),
        );
      } else if (accion === "reenviar") {
        setResultados(await reenviar.mutateAsync(objetivo.map((f) => f.usuarioId!)));
      } else {
        await cancelar.mutateAsync(objetivo[0].usuarioId!);
        setResultados(null);
      }
      setSeleccion(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo completar la operación");
    } finally {
      setConfirmacion(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Buscar"
          placeholder="Buscar por nombre o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <Select aria-label="Filtrar por rol" value={rol} onChange={(e) => setRol(e.target.value as Rol | "")} className="w-auto">
          <option value="">Todos los roles</option>
          {ORDEN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value as EtiquetaAcceso | "")}
          className="w-auto"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETAS) as EtiquetaAcceso[]).map((e) => (
            <option key={e} value={e}>
              {ETIQUETAS[e].texto}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={paraInvitar.length === 0 || ocupado} onClick={() => setConfirmacion({ accion: "invitar", filas: paraInvitar })}>
            <Mail size={13} /> Invitar seleccionados ({paraInvitar.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={paraReenviar.length === 0 || ocupado}
            onClick={() => setConfirmacion({ accion: "reenviar", filas: paraReenviar })}
          >
            <RotateCw size={13} /> Reenviar seleccionados ({paraReenviar.length})
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {resultados && <Resumen resultados={resultados} onCerrar={() => setResultados(null)} />}

      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Marcar todas las visibles"
                  checked={todasMarcadas}
                  onChange={alternarTodas}
                  disabled={visibles.length === 0}
                />
              </th>
              <th>Persona</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="h-20 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} role="alert" className="h-20 text-center text-destructive">
                  No se pudo cargar la lista.
                </td>
              </tr>
            )}
            {filas && visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="h-20 text-center text-muted-foreground">
                  No hay personas pendientes con estos filtros.
                </td>
              </tr>
            )}
            {visibles.map((f) => {
              const textoDetalle = detalle(f);
              return (
                <tr key={f.clave}>
                  <td>
                    <input type="checkbox" aria-label={`Seleccionar a ${f.nombre}`} checked={seleccion.has(f.clave)} onChange={() => alternar(f.clave)} />
                  </td>
                  <td className="font-medium">{f.nombre}</td>
                  <td className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {f.email ?? "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {f.roles.map((r) => (
                        <EtiquetaRol key={r} rol={r} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge variant={ETIQUETAS[f.etiqueta].variante}>{ETIQUETAS[f.etiqueta].texto}</Badge>
                    {textoDetalle && (
                      <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                        {textoDetalle}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {f.etiqueta === "sin-cuenta" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!sePuedeInvitar(f) || ocupado}
                        title={motivoParaNoInvitar(f) ?? undefined}
                        aria-label={`Invitar a ${f.nombre}`}
                        onClick={() => setConfirmacion({ accion: "invitar", filas: [f] })}
                      >
                        Invitar
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant={f.etiqueta === "vencida" ? "default" : "outline"}
                          data-resaltado={f.etiqueta === "vencida" ? "true" : undefined}
                          disabled={ocupado}
                          aria-label={`Reenviar la invitación a ${f.nombre}`}
                          onClick={() => setConfirmacion({ accion: "reenviar", filas: [f] })}
                        >
                          Reenviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ocupado}
                          aria-label={`Cancelar la invitación de ${f.nombre}`}
                          onClick={() => setConfirmacion({ accion: "cancelar", filas: [f] })}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmacion && (
        <ModalConfirmacion confirmacion={confirmacion} ocupado={ocupado} onConfirmar={confirmar} onCerrar={() => setConfirmacion(null)} />
      )}
    </div>
  );
}

function Resumen({ resultados, onCerrar }: { resultados: ResultadoEnvio[]; onCerrar: () => void }) {
  const enviadas = resultados.filter((r) => r.resultado === "enviada").length;
  const fallidas = resultados.filter((r) => r.resultado === "no-enviada");
  return (
    <div role="status" className="card-hl px-4 py-3 text-[13px]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {enviadas} {enviadas === 1 ? "enviada" : "enviadas"}
          {fallidas.length > 0 && ` · ${fallidas.length} ${fallidas.length === 1 ? "no se pudo enviar" : "no se pudieron enviar"}`}
        </p>
        <button type="button" aria-label="Cerrar el resumen" onClick={onCerrar} className="rounded p-0.5 text-muted-foreground hover:bg-accent">
          <X size={14} />
        </button>
      </div>
      {fallidas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {fallidas.map((r) => (
            <li key={r.id}>
              {r.nombre || r.id}: {r.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModalConfirmacion({
  confirmacion,
  ocupado,
  onConfirmar,
  onCerrar,
}: {
  confirmacion: Confirmacion;
  ocupado: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const t = textos(confirmacion);
  return (
    <Modal
      title={t.titulo}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            {t.volver}
          </Button>
          <Button className="flex-1" disabled={ocupado} onClick={onConfirmar}>
            {ocupado ? "Procesando…" : t.confirmar}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px]">{t.pregunta}</p>
      {confirmacion.filas.length > 1 && (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {confirmacion.filas.map((f) => (
            <li key={f.clave}>
              {f.nombre}
              {f.email ? ` · ${f.email}` : ""}
            </li>
          ))}
        </ul>
      )}
      {confirmacion.accion !== "cancelar" && (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Cada persona recibe un correo con un enlace que vale 7 días.
        </p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 5: Pestañas en `UsuariosPage.tsx`**

1. Borrar `ESTILO_ROL` y la función `EtiquetaRol` del archivo, e importar `import { EtiquetaRol } from "../components/EtiquetaRol";` y `import { PendientesTab } from "../components/PendientesTab";`.
2. Debajo de `const [toast, setToast] = useState("");`: `const [pestana, setPestana] = useState<"cuentas" | "pendientes">("cuentas");`
3. Reemplazar el bloque `<div className="flex items-center justify-between">` (el contador de usuarios activos y el botón "Crear usuario") por:

```tsx
      <div className="flex flex-wrap items-end justify-between gap-3 border-b" style={{ borderColor: "var(--border-hex)" }}>
        <div role="tablist" aria-label="Usuarios" className="flex gap-1">
          {(
            [
              ["cuentas", "Cuentas"],
              ["pendientes", "Pendientes"],
            ] as const
          ).map(([id, etiqueta]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className="-mb-px px-3.5 py-2 text-[13px] font-medium transition-colors"
              style={{
                borderBottom: `2px solid ${pestana === id ? "var(--brand)" : "transparent"}`,
                color: pestana === id ? "var(--brand)" : "var(--text-muted)",
              }}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <Button className="mb-2" onClick={abrirModal}>
          <UserPlus size={14} /> Crear usuario
        </Button>
      </div>

      {pestana === "pendientes" ? (
        <PendientesTab />
      ) : (
        <>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            <span className="font-medium" style={{ color: "var(--text)" }}>
              {activas}
            </span>{" "}
            usuarios activos
            <span style={{ color: "var(--text-faint)" }}> · {cuentas?.length ?? 0} en total</span>
          </p>
```

4. Cerrar el fragmento con `        </>\n      )}` inmediatamente antes de `{mostrarModal && (` (el error de `cambiarEstado`, la tabla de escritorio y las tarjetas móviles quedan adentro, sin cambios).

- [ ] **Step 6: Typecheck, lint y la prueba**

Run: `cd client && source ~/.nvm/nvm.sh >/dev/null && nvm use >/dev/null; pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-pendientes.js; echo "exit $?"`
Expected: typecheck limpio; lint `✖ 2 problems (0 errors, 2 warnings)` (los de siempre); `--- 21/21 ok`, `exit 0`, `limpieza hecha`. Mirar `$SCRATCH/shots/pendientes-1440.png` y `pendientes-390.png`.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "Usuarios: pestaña Pendientes con filtros, selección, invitar/reenviar/cancelar y confirmación"
```

---

### Task 8: Client — "¿Cómo accede?" en las tres altas

**Files:**
- Create: `client/src/features/usuarios/components/ModoDeAcceso.tsx`, `client/src/features/usuarios/alta.ts`
- Modify: `client/src/features/usuarios/pages/UsuariosPage.tsx`, `hooks/useCrearAdministrador.ts`; `client/src/features/padres/{types.ts,padreService.ts,hooks/useCrearPadre.ts}`; `client/src/features/profesores/{types.ts,profesorService.ts,hooks/useCrearProfesor.ts,pages/ProfesoresAdminPage.tsx}`; `client/src/features/secretarios/{types.ts,secretarioService.ts,hooks/useCrearSecretario.ts}`; `client/src/features/alumnos/pages/{InscribirAlumnoPage,AlumnosListPage}.tsx`
- Create (verificación): `$SCRATCH/e2e-altas.js`

**Interfaces:**
- Consumes: altas del server con `password` opcional y `invitacion` en la respuesta (Task 5); `EstadoInvitacion` (Task 7).
- Produces: `type ModoAcceso = "invitacion" | "contrasena"`; `<ModoDeAcceso valor onCambiar nombre? />` (radios con etiqueta "Enviar invitación por email" / "Asignar contraseña ahora"); `mensajeDeAlta(email, invitacion): string`; `PadreCreado`, `ProfesorCreado`, `SecretarioCreado`.

- [ ] **Step 1: Escribir la prueba que falla** — `$SCRATCH/e2e-altas.js`:

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const REAL = "http://localhost:5173";
const P = "prueba-tmp-e2ealta";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
const psql = (sql) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qAtc", sql]).toString().trim();
const limpiar = () => {
  psql(`delete from "Profesor" where email like '${P}%'`);
  psql(`delete from "Usuario" where email like '${P}%'`);
};
async function entrar(b, email, pass, rol) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[type="password"]').fill(pass);
  await p.locator('button[type="submit"]').click();
  if (rol) await p.getByRole("button", { name: rol }).click();
  await p.waitForURL(/\/(dashboard|cursos|mis-hijos)/);
  await p.waitForTimeout(500);
  return p;
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  try {
    limpiar();
    const p = await entrar(b, "admin@babylon.test", "admin1234", /Administrador/);

    // Usuarios → Crear usuario: por defecto, invitación
    await p.goto(`${REAL}/usuarios`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /Crear usuario/ }).first().click();
    await p.getByRole("button", { name: /^Secretario/ }).click();
    ok("por defecto: invitación por email", si(await p.getByLabel("Enviar invitación por email").isChecked()), "sí");
    ok("con invitación no se pide contraseña", await p.locator('input[name="password"]').count(), 0);
    await p.locator('input[name="nombre"]').fill("Pruebainv Secretaria");
    await p.locator('input[name="email"]').fill(`${P}-sec@x.test`);
    await p.getByRole("button", { name: "Crear usuario" }).last().click();
    await p.waitForTimeout(1200);
    ok("aviso: invitación enviada", await p.getByText(`Invitación enviada a ${P}-sec@x.test`).count(), 1);
    ok("la cuenta quedó pendiente", psql(`select estado from "Usuario" where email='${P}-sec@x.test'`), "pendiente");

    // Asignar contraseña ahora
    await p.getByRole("button", { name: /Crear usuario/ }).first().click();
    await p.getByRole("button", { name: /^Secretario/ }).click();
    await p.getByLabel("Asignar contraseña ahora").check();
    ok("con contraseña asignada aparece el campo", await p.locator('input[name="password"]').count(), 1);
    await p.locator('input[name="nombre"]').fill("Pruebainv Secretaria Dos");
    await p.locator('input[name="email"]').fill(`${P}-sec2@x.test`);
    await p.getByRole("button", { name: "Crear usuario" }).last().click();
    await p.waitForTimeout(400);
    ok("sin contraseña no deja crear", await p.getByText("La contraseña debe tener al menos 8 caracteres").count(), 1);
    await p.locator('input[name="password"]').fill("ClaveAsignada123");
    await p.getByRole("button", { name: "Crear usuario" }).last().click();
    await p.waitForTimeout(1200);
    ok("aviso: usuario creado", await p.getByText(`Usuario ${P}-sec2@x.test creado`).count(), 1);
    ok("la cuenta nació activa", psql(`select estado from "Usuario" where email='${P}-sec2@x.test'`), "activo");

    // Profesores → Nuevo profesor
    await p.goto(`${REAL}/profesores`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /Nuevo profesor/ }).click();
    ok("profesor: por defecto invitación", si(await p.getByLabel("Enviar invitación por email").isChecked()), "sí");
    ok("profesor: no se pide contraseña", await p.locator('input[name="password"]').count(), 0);
    await p.locator('input[name="nombre"]').fill("Pruebainv");
    await p.locator('input[name="apellido"]').fill("Profe");
    await p.locator('input[name="dni"]').fill("99700001");
    await p.locator('input[name="email"]').fill(`${P}-profe@x.test`);
    await p.getByRole("button", { name: "Crear profesor" }).click();
    await p.waitForTimeout(1200);
    ok("profesor: aviso de invitación enviada", await p.getByText(`Invitación enviada a ${P}-profe@x.test`).count(), 1);
    ok("profesor: cuenta pendiente", psql(`select estado from "Usuario" where email='${P}-profe@x.test'`), "pendiente");

    // Inscribir alumno (secretario) → padre nuevo: solo hasta pasar el paso del padre (no se guarda nada)
    const s = await entrar(b, "secretario@babylon.test", "secretario1234");
    await s.goto(`${REAL}/alumnos/inscribir`, { waitUntil: "networkidle" });
    await s.locator("#nombre").fill("Pruebainv");
    await s.locator("#apellido").fill("Alumno");
    await s.locator("#dni").fill("99500001");
    await s.locator("#fechaNacimiento").fill("2015-03-10");
    await s.getByRole("button", { name: /Siguiente/ }).click();
    await s.getByRole("button", { name: "No, crear nuevo" }).click();
    ok("inscripción: por defecto invitación", si(await s.getByLabel("Enviar invitación por email").isChecked()), "sí");
    ok("inscripción: no se pide contraseña", await s.locator("#padrePassword").count(), 0);
    await s.locator("#padreNombre").fill("Pruebainv");
    await s.locator("#padreApellido").fill("Madre");
    await s.locator("#padreDni").fill("99500002");
    await s.locator("#vinculo").selectOption("madre");
    await s.locator("#padreEmail").fill(`${P}-madre@x.test`);
    await s.getByLabel("Asignar contraseña ahora").check();
    ok("inscripción: con contraseña asignada aparece el campo", await s.locator("#padrePassword").count(), 1);
    await s.locator("#padrePassword").fill("corta");
    await s.getByRole("button", { name: /Siguiente/ }).click();
    await s.waitForTimeout(300);
    ok("inscripción: contraseña corta frena el paso", await s.getByText("La contraseña debe tener al menos 8 caracteres").count(), 1);
    await s.locator("#padrePassword").fill("ClaveAsignada123");
    await s.getByRole("button", { name: /Siguiente/ }).click();
    await s.waitForTimeout(300);
    ok("inscripción: pasa al paso del curso", await s.locator("#padreNombre").count(), 0);
    await s.screenshot({ path: `${process.env.SCRATCH}/shots/altas-inscripcion.png`, fullPage: true });
  } catch (e) {
    console.log("ERROR del script: " + String(e).split("\n")[0]);
  } finally {
    limpiar();
    await b.close();
    console.log("limpieza hecha");
  }
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-altas.js | tail -3`
Expected: falla (no existe la opción "Enviar invitación por email").

- [ ] **Step 3: Componente, mensaje y tipos**

`client/src/features/usuarios/components/ModoDeAcceso.tsx`:

```tsx
export type ModoAcceso = "invitacion" | "contrasena";

const OPCIONES: { valor: ModoAcceso; titulo: string; descripcion: string }[] = [
  {
    valor: "invitacion",
    titulo: "Enviar invitación por email",
    descripcion: "Recibe un correo para elegir su contraseña. El enlace vale 7 días.",
  },
  {
    valor: "contrasena",
    titulo: "Asignar contraseña ahora",
    descripcion: "Le entregás la contraseña en persona. Su email queda sin verificar hasta que lo confirme desde Mi cuenta.",
  },
];

// "¿Cómo accede?": invitación por email (por defecto) o contraseña asignada en el momento.
export function ModoDeAcceso({
  valor,
  onCambiar,
  nombre = "modo-acceso",
}: {
  valor: ModoAcceso;
  onCambiar: (modo: ModoAcceso) => void;
  nombre?: string;
}) {
  return (
    <fieldset>
      <legend className="label">¿Cómo accede?</legend>
      <div className="space-y-1.5">
        {OPCIONES.map((o) => {
          const elegida = valor === o.valor;
          return (
            <label
              key={o.valor}
              className="flex cursor-pointer items-start gap-2.5 px-3.5 py-3"
              style={{
                border: `1px solid ${elegida ? "var(--brand)" : "var(--border-hex)"}`,
                background: elegida ? "var(--brand-soft)" : "var(--bg)",
                borderRadius: 4,
              }}
            >
              <input
                type="radio"
                name={nombre}
                value={o.valor}
                checked={elegida}
                onChange={() => onCambiar(o.valor)}
                className="mt-0.5"
                style={{ accentColor: "var(--brand)" }}
              />
              <span>
                <span className="block text-[13px] font-medium" style={{ color: elegida ? "var(--brand)" : "var(--text)" }}>
                  {o.titulo}
                </span>
                <span className="mt-1 block text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  {o.descripcion}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

`client/src/features/usuarios/alta.ts`:

```ts
import type { EstadoInvitacion } from "./types";

// Aviso tras un alta, según cómo quedó la invitación (null: se asignó contraseña).
export function mensajeDeAlta(email: string, invitacion: EstadoInvitacion | null): string {
  if (invitacion === "enviada") return `Invitación enviada a ${email}`;
  if (invitacion === "no-enviada") return "La cuenta quedó creada pero no se pudo enviar el correo; reenviala desde Usuarios → Pendientes.";
  return `Usuario ${email} creado`;
}
```

Tipos y servicios (en los tres, `password` pasa a opcional y el alta devuelve también `invitacion`):

- `features/padres/types.ts`: en `CrearPadreInput`, `password?: string;`; agregar `import type { EstadoInvitacion } from "@/features/usuarios/types";` y `export type PadreCreado = Padre & { invitacion: EstadoInvitacion | null };`. En `padreService.ts`: `crear: (datos: CrearPadreInput) => apiClient.post<PadreCreado>("/api/padres", datos),` (importando `PadreCreado`).
- `features/profesores/types.ts`: en `CrearProfesorInput`, `password?: string;`; el mismo import y `export type ProfesorCreado = Profesor & { invitacion: EstadoInvitacion | null };`. En `profesorService.ts`: `crear: (datos: CrearProfesorInput) => apiClient.post<ProfesorCreado>("/api/profesores", datos),`.
- `features/secretarios/types.ts`: `Secretario.estado: "activo" | "inactivo" | "pendiente";`, `CrearSecretarioInput.password?: string;`, el mismo import y `export type SecretarioCreado = Secretario & { invitacion: EstadoInvitacion | null };`. En `secretarioService.ts`: `crear: (datos: CrearSecretarioInput) => apiClient.post<SecretarioCreado>("/api/auth/secretarios", datos),`.
- En `useCrearPadre.ts`, `useCrearProfesor.ts`, `useCrearSecretario.ts` y `usuarios/hooks/useCrearAdministrador.ts`, dentro de `onSuccess`, agregar `queryClient.invalidateQueries({ queryKey: ["pendientes"] });` (una invitación nueva aparece en Pendientes).

- [ ] **Step 4: Las tres pantallas**

**`UsuariosPage.tsx`** (modal "Crear usuario"):
1. Imports: `import { ModoDeAcceso } from "../components/ModoDeAcceso";`, `import { mensajeDeAlta } from "../alta";`, y `EstadoInvitacion` en el import de tipos (`import type { CuentaUsuario, EstadoInvitacion } from "../types";`).
2. En `cuentaSchema`: `password: passwordNueva,` pasa a `password: z.string().optional(),` y se agrega `modo: z.enum(["invitacion", "contrasena"]),`; al final del `superRefine`:

```ts
    if (datos.modo === "contrasena") {
      const resultado = passwordNueva.safeParse(datos.password ?? "");
      if (!resultado.success) ctx.addIssue({ code: "custom", path: ["password"], message: resultado.error.issues[0].message });
    }
```

3. `VALORES_INICIALES` suma `modo: "invitacion",`; debajo de `const password = watch("password");` agregar `const modo = watch("modo");`.
4. `onSubmit` completo:

```ts
  const onSubmit = handleSubmit(async (d) => {
    const apellido = d.apellido?.trim() ?? "";
    const dni = d.dni?.trim() ?? "";
    const telefono = d.telefono?.trim() || undefined;
    // Sin contraseña, el server crea la cuenta pendiente y manda la invitación.
    const password = d.modo === "contrasena" ? d.password : undefined;

    let creado: { invitacion: EstadoInvitacion | null };
    if (d.rol === "admin") {
      creado = await crearAdministrador.mutateAsync({ nombre: d.nombre, email: d.email, password });
    } else if (d.rol === "secretario") {
      creado = await crearSecretario.mutateAsync({ nombre: d.nombre, email: d.email, password });
    } else if (d.rol === "profesor") {
      creado = await crearProfesor.mutateAsync({ nombre: d.nombre, apellido, dni, telefono, email: d.email, password });
    } else {
      creado = await crearPadre.mutateAsync({
        nombre: d.nombre,
        apellido,
        dni,
        telefono,
        email: d.email,
        password,
        vinculo: d.vinculo as VinculoPadre,
      });
    }
    setMostrarModal(false);
    setToast(mensajeDeAlta(d.email, creado.invitacion));
  });
```

5. El bloque `<div className="col-span-2 space-y-1.5">` de "Contraseña de acceso" pasa a mostrarse solo con contraseña asignada, precedido por el selector:

```tsx
              <div className="col-span-2">
                <ModoDeAcceso
                  valor={modo}
                  onCambiar={(m) => {
                    setValue("modo", m);
                    clearErrors("password");
                  }}
                />
              </div>
              {modo === "contrasena" && (
                <div className="col-span-2 space-y-1.5">
                  {/* … el contenido actual del campo "Contraseña de acceso", sin cambios … */}
                </div>
              )}
```

**`ProfesoresAdminPage.tsx`**:
1. Imports: `import { ModoDeAcceso, type ModoAcceso } from "@/features/usuarios/components/ModoDeAcceso";` y `import { mensajeDeAlta } from "@/features/usuarios/alta";`.
2. Estado: `const [modoAcceso, setModoAcceso] = useState<ModoAcceso>("invitacion");`; en `abrirNuevo`, `setModoAcceso("invitacion");`.
3. En `onSubmit`, la rama de alta queda:

```ts
    } else {
      let password: string | undefined;
      if (modoAcceso === "contrasena") {
        const resultadoPassword = passwordNueva.safeParse(datos.password ?? "");
        if (!resultadoPassword.success) {
          setError("password", { message: resultadoPassword.error.issues[0].message });
          return;
        }
        password = resultadoPassword.data;
      }
      const creado = await crearProfesor.mutateAsync({ ...datos, password });
      setToast(mensajeDeAlta(datos.email, creado.invitacion));
    }
```

4. El bloque `{modal.mode === "new" && ( … "Contraseña de acceso" … )}` pasa a:

```tsx
              {modal.mode === "new" && (
                <div className="col-span-2">
                  <ModoDeAcceso valor={modoAcceso} onCambiar={setModoAcceso} />
                </div>
              )}
              {modal.mode === "new" && modoAcceso === "contrasena" && (
                <div className="col-span-2 space-y-1.5">
                  <label className="label">Contraseña de acceso</label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
              )}
```

**`InscribirAlumnoPage.tsx`**:
1. Imports: `import { ModoDeAcceso, type ModoAcceso } from "@/features/usuarios/components/ModoDeAcceso";` y, debajo de los schemas:

```ts
const AVISO_INVITACION_NO_ENVIADA =
  "La inscripción quedó hecha, pero no se pudo enviar el correo de invitación al padre/madre/tutor. Se puede reenviar desde Usuarios → Pendientes.";
```

2. En `nuevoPadreSchema`: `password: passwordNueva,` → `password: z.string().optional(),`.
3. Estado: `const [modoAcceso, setModoAcceso] = useState<ModoAcceso>("invitacion");`.
4. En `irAlSiguientePaso`, rama `if (modoPadre === "crear")`, después de `if (!valido) return;`:

```ts
        if (modoAcceso === "contrasena") {
          const resultado = passwordNueva.safeParse(padreForm.getValues("password") ?? "");
          if (!resultado.success) {
            padreForm.setError("password", { message: resultado.error.issues[0].message });
            return;
          }
        }
```

5. El bloque del campo `padrePassword` (el `<div className="space-y-2">` con "Contraseña de acceso") pasa a:

```tsx
                <ModoDeAcceso
                  valor={modoAcceso}
                  onCambiar={(m) => {
                    setModoAcceso(m);
                    padreForm.clearErrors("password");
                  }}
                />
                {modoAcceso === "contrasena" && (
                  <div className="space-y-2">
                    <Label htmlFor="padrePassword">Contraseña de acceso</Label>
                    <Input id="padrePassword" type="password" {...padreForm.register("password")} />
                    {padreForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.password.message}</p>
                    )}
                  </div>
                )}
```

6. En `onConfirmar`, la creación del padre y la navegación quedan:

```ts
    let aviso: string | undefined;
    if (modoPadre === "crear") {
      const valores = padreForm.getValues();
      const nuevoPadre = await crearPadre.mutateAsync({ ...valores, password: modoAcceso === "contrasena" ? valores.password : undefined });
      padreId = nuevoPadre.id;
      if (nuevoPadre.invitacion === "no-enviada") aviso = AVISO_INVITACION_NO_ENVIADA;
    }
```

y `navigate("/alumnos");` → `navigate("/alumnos", aviso ? { state: { aviso } } : undefined);`.

7. En el resumen del paso 4, debajo del email del padre:

```tsx
                {modoPadre === "crear" && (
                  <p className="text-xs text-muted-foreground">
                    Acceso: {modoAcceso === "invitacion" ? "invitación por email" : "contraseña asignada"}
                  </p>
                )}
```

**`AlumnosListPage.tsx`**: `useLocation` en el import de `react-router-dom`; al principio del componente `const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;`; y como primer hijo del `<div className="space-y-4">` del `return`:

```tsx
      {aviso && (
        <p
          role="status"
          className="px-3.5 py-3 text-[12.5px]"
          style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 4 }}
        >
          {aviso}
        </p>
      )}
```

- [ ] **Step 5: Typecheck, lint y la prueba**

Run: `cd client && pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-altas.js; echo "exit $?"`
Expected: typecheck limpio, lint con los 2 avisos de siempre, `--- 17/17 ok`, `exit 0`.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Altas con '¿Cómo accede?': invitación por email por defecto o contraseña asignada (Usuarios, Profesores e inscripción)"
```

---
### Task 9: Client — pantalla de activación de la cuenta

**Files:**
- Create: `client/src/features/auth/components/{CampoContrasena,AvisoError}.tsx`, `client/src/features/auth/pages/ActivarCuentaPage.tsx`
- Modify: `client/src/features/auth/authService.ts`, `pages/LoginPage.tsx`; `client/src/core/routes/AppRoutes.tsx`
- Create (verificación): `$SCRATCH/e2e-activacion.js`

**Interfaces:**
- Consumes: `POST /api/auth/activar-cuenta/consultar` y `POST /api/auth/activar-cuenta` (Task 4).
- Produces: ruta pública `/activar-cuenta`; `authService.consultarInvitacion(token)`, `authService.activarCuenta(token, password)`; `<CampoContrasena id etiqueta error? …inputProps />`, `<AvisoError>` (con `role="alert"`); aviso de login `?motivo=cuenta-activada`.

- [ ] **Step 1: Escribir la prueba que falla** — `$SCRATCH/e2e-activacion.js`:

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const fs = require("fs");
const REAL = "http://localhost:5173";
const API = "http://localhost:4000";
const P = "prueba-tmp-e2eact";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
const psql = (sql) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qAtc", sql]).toString().trim();
const limpiar = () => {
  psql(`delete from "Usuario" where email like '${P}%'`);
  psql(`delete from "Padre" where id like '${P}%'`);
};
// Último token enviado a `email` en un enlace a `ruta` (los correos salen por consola al log del server).
function tokenDe(email, ruta) {
  let token = "";
  for (const bloque of fs.readFileSync(`${process.env.SCRATCH}/server.log`, "utf8").split("[correo] para: ").slice(1)) {
    if (!bloque.startsWith(email)) continue;
    const m = bloque.match(new RegExp(`${ruta}\\?token=([A-Za-z0-9_-]+)`));
    if (m) token = m[1];
  }
  return token;
}
async function invitarPorApi(padreId) {
  const sesion = await (
    await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@babylon.test", password: "admin1234", rolElegido: "admin" }),
    })
  ).json();
  const r = await fetch(`${API}/api/auth/invitaciones`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sesion.token}` },
    body: JSON.stringify({ padreIds: [padreId] }),
  });
  return (await r.json()).resultados[0].resultado;
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  try {
    limpiar();
    psql(`insert into "Padre"(id,nombre,apellido,dni,email,vinculo) values ('${P}-1','Pruebainv','Activa','99600001','${P}-1@x.test','madre')`);
    ok("invitación enviada", await invitarPorApi(`${P}-1`), "enviada");
    await new Promise((r) => setTimeout(r, 500));
    const token = tokenDe(`${P}-1@x.test`, "/activar-cuenta");

    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(`${REAL}/activar-cuenta?token=${token}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    ok("el token se quita de la barra", si(!p.url().includes("token=")), "sí");
    ok("saludo con el nombre", await p.getByText("Hola Pruebainv Activa, elegí tu contraseña").count(), 1);
    ok("muestra el email de la cuenta", await p.getByText(`${P}-1@x.test`).count(), 1);
    await p.screenshot({ path: `${process.env.SCRATCH}/shots/activar-1440.png`, fullPage: true });
    await p.locator("#password").fill("MiClaveNueva123");
    await p.locator("#repetir").fill("OtraCosa12345");
    await p.getByRole("button", { name: "Activar mi cuenta" }).click();
    await p.waitForTimeout(300);
    ok("contraseñas distintas", await p.getByText("Las contraseñas no coinciden").count(), 1);
    await p.locator("#repetir").fill("MiClaveNueva123");
    await p.getByRole("button", { name: "Activar mi cuenta" }).click();
    await p.waitForURL(/login/);
    await p.waitForTimeout(300);
    ok("lleva al inicio de sesión", si(p.url().includes("motivo=cuenta-activada")), "sí");
    ok("con el aviso", await p.getByText("Cuenta activada. Ingresá con tu email y contraseña.").count(), 1);
    await p.locator('input[type="email"]').fill(`${P}-1@x.test`);
    await p.locator('input[type="password"]').fill("MiClaveNueva123");
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/mis-hijos/, { timeout: 10000 }).catch(() => {});
    ok("entra con la contraseña elegida", si(p.url().includes("/mis-hijos")), "sí");

    const q = await (await b.newContext()).newPage();
    await q.goto(`${REAL}/activar-cuenta?token=${token}`, { waitUntil: "networkidle" });
    await q.waitForTimeout(800);
    ok("el enlace usado ya no sirve", await q.getByText("El enlace no es válido o ya venció.").count(), 1);
    ok("ofrece pedir una invitación nueva", await q.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).count(), 1);
    await q.goto(`${REAL}/activar-cuenta`, { waitUntil: "networkidle" });
    ok("sin enlace: mensaje de enlace inválido", await q.getByText("El enlace no es válido o ya venció.").count(), 1);

    const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await m.goto(`${REAL}/activar-cuenta`, { waitUntil: "networkidle" });
    ok("móvil: sin desborde horizontal", await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  } catch (e) {
    console.log("ERROR del script: " + String(e).split("\n")[0]);
  } finally {
    limpiar();
    await b.close();
    console.log("limpieza hecha");
  }
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-activacion.js | tail -4`
Expected: falla (la ruta `/activar-cuenta` no existe y el comodín lleva al login).

- [ ] **Step 3: Componentes compartidos, servicio y página**

`client/src/features/auth/components/AvisoError.tsx`:

```tsx
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

// Aviso de error de las pantallas públicas de acceso.
export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 px-3.5 py-3"
      style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
    >
      <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
      <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>
        {children}
      </span>
    </div>
  );
}
```

`client/src/features/auth/components/CampoContrasena.tsx`:

```tsx
import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

type Props = ComponentProps<"input"> & { id: string; etiqueta: string; error?: string };

// Campo de contraseña de las pantallas públicas de acceso, con el botón para mostrarla. Acepta lo que devuelve
// `register()` de react-hook-form (incluida la ref).
export function CampoContrasena({ id, etiqueta, error, ...props }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          placeholder="••••••••"
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{ paddingLeft: 34, paddingRight: 36, paddingTop: 10, paddingBottom: 10 }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-zinc-100"
          style={{ color: "var(--text-muted)" }}
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {mostrar ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

`authService.ts`, dentro del objeto:

```ts
  consultarInvitacion: (token: string) =>
    apiClient.post<{ nombre: string; email: string }>("/api/auth/activar-cuenta/consultar", { token }),
  activarCuenta: (token: string, password: string) => apiClient.post<void>("/api/auth/activar-cuenta", { token, password }),
```

`client/src/features/auth/pages/ActivarCuentaPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { passwordNueva } from "@/core/lib/validacion";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";
import { AvisoError } from "../components/AvisoError";
import { CampoContrasena } from "../components/CampoContrasena";

const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

const schema = z
  .object({ password: passwordNueva, repetir: z.string() })
  .refine((d) => d.password === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" });
type Formulario = z.infer<typeof schema>;

export default function ActivarCuentaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Se lee una sola vez y se quita de la barra de direcciones, para que el token no quede en el historial.
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", "/activar-cuenta");
  }, [params]);

  const invitacion = useQuery({
    queryKey: ["invitacion", token],
    queryFn: () => authService.consultarInvitacion(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async ({ password }: Formulario) => {
    setError(null);
    try {
      await authService.activarCuenta(token, password);
      navigate("/login?motivo=cuenta-activada", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo activar la cuenta. Probá de nuevo.");
    }
  };

  const invalido = !token || invitacion.isError;

  return (
    <AuthLayout>
      {/* El enlace lleva el token: que no se filtre a otros sitios como referrer. */}
      <meta name="referrer" content="no-referrer" />
      <p className="eyebrow mb-3">Activar cuenta</p>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
        {invitacion.data ? `Hola ${invitacion.data.nombre}, elegí tu contraseña` : "Activá tu cuenta"}
      </h2>
      {invitacion.data && (
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Vas a ingresar con <span className="font-mono">{invitacion.data.email}</span>.
        </p>
      )}
      {invitacion.isLoading && (
        <p className="mt-6 flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Revisando el enlace…
        </p>
      )}

      {invitacion.data && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <CampoContrasena id="password" etiqueta="Contraseña" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <CampoContrasena id="repetir" etiqueta="Repetir contraseña" autoComplete="new-password" error={errors.repetir?.message} {...register("repetir")} />
          {error && <AvisoError>{error}</AvisoError>}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full justify-center" style={{ padding: "12px 16px", fontSize: 14 }}>
            {isSubmitting ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                Activando…
              </>
            ) : (
              "Activar mi cuenta"
            )}
          </button>
        </form>
      )}

      {invalido && (
        <div className="mt-8 space-y-3">
          <AvisoError>{ENLACE_NO_VALIDO}</AvisoError>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Ingresá tu email en{" "}
            <Link to="/olvide-contrasena" className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
              ¿Olvidaste tu contraseña?
            </Link>{" "}
            y te enviamos una invitación nueva.
          </p>
        </div>
      )}

      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />
      <Link to="/login" className="flex items-center gap-1.5 text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
        <ArrowLeft size={13} /> Volver al inicio de sesión
      </Link>
    </AuthLayout>
  );
}
```

`LoginPage.tsx`, en `MENSAJES_MOTIVO`:

```ts
  "cuenta-activada": { texto: "Cuenta activada. Ingresá con tu email y contraseña.", tono: "success" },
```

`AppRoutes.tsx`: `import ActivarCuentaPage from "@/features/auth/pages/ActivarCuentaPage";` y, junto a `/restablecer-contrasena`:

```tsx
      <Route path="/activar-cuenta" element={<ActivarCuentaPage />} />
```

- [ ] **Step 4: Typecheck, lint y la prueba**

Run: `cd client && pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-activacion.js; echo "exit $?"`
Expected: typecheck limpio, lint con los 2 avisos de siempre, `--- 12/12 ok`, `exit 0`. Mirar `$SCRATCH/shots/activar-1440.png`.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "Pantalla de activación de la cuenta invitada"
```

---

### Task 10: Client — verificar el email desde Mi cuenta

**Files:**
- Create: `client/src/features/cuenta/hooks/{useYo,useEnviarVerificacion}.ts`, `client/src/features/cuenta/components/EmailSinVerificar.tsx`, `client/src/features/auth/pages/VerificarEmailPage.tsx`
- Modify: `client/src/features/cuenta/{types.ts,cuentaService.ts,pages/MiCuentaPage.tsx}`, `client/src/features/auth/authService.ts`, `client/src/core/routes/AppRoutes.tsx`
- Create (verificación): `$SCRATCH/e2e-verificacion.js`

**Interfaces:**
- Consumes: `GET /api/auth/yo`, `POST /api/auth/enviar-verificacion`, `POST /api/auth/verificar-email` (Task 6); `AuthLayout`, `AvisoError` (Task 9).
- Produces: `DatosPropios` (client); `cuentaService.yo()`, `cuentaService.enviarVerificacion()`; `authService.verificarEmail(token)`; ruta pública `/verificar-email`; consulta `["yo"]`.

- [ ] **Step 1: Escribir la prueba que falla** — `$SCRATCH/e2e-verificacion.js`:

```js
const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const fs = require("fs");
const REAL = "http://localhost:5173";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
const si = (b) => (b ? "sí" : "no");
const psql = (sql) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-qAtc", sql]).toString().trim();
const P6 = `(select id from "Usuario" where email='p6@prueba.babylon.test')`;
const reset = () => {
  psql(`update "Usuario" set "emailVerificadoEn"=null where id=${P6}`);
  psql(`delete from "TokenCuenta" where "usuarioId"=${P6}`);
};
function tokenDe(email, ruta) {
  let token = "";
  for (const bloque of fs.readFileSync(`${process.env.SCRATCH}/server.log`, "utf8").split("[correo] para: ").slice(1)) {
    if (!bloque.startsWith(email)) continue;
    const m = bloque.match(new RegExp(`${ruta}\\?token=([A-Za-z0-9_-]+)`));
    if (m) token = m[1];
  }
  return token;
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  try {
    reset();
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
    await p.locator('input[type="email"]').fill("p6@prueba.babylon.test");
    await p.locator('input[type="password"]').fill("prueba1234");
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/mis-hijos/);
    await p.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    ok("aviso de email sin verificar", await p.getByText("Tu email no está verificado").count(), 1);
    await p.getByRole("button", { name: "Enviar enlace de verificación" }).click();
    await p.waitForTimeout(1000);
    ok("confirma el envío", await p.getByRole("status").filter({ hasText: "Te enviamos un enlace a p6@prueba.babylon.test. Vence en 24 horas." }).count(), 1);
    await p.getByRole("button", { name: "Enviar enlace de verificación" }).click();
    await p.waitForTimeout(800);
    ok("un segundo pedido enseguida se rechaza", await p.getByRole("alert").filter({ hasText: "Ya te enviamos un enlace hace poco" }).count(), 1);
    await p.screenshot({ path: `${process.env.SCRATCH}/shots/mi-cuenta-sin-verificar.png`, fullPage: true });

    const token = tokenDe("p6@prueba.babylon.test", "/verificar-email");
    await p.goto(`${REAL}/verificar-email?token=${token}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    ok("verificado", await p.getByText("Listo, tu email quedó verificado.").count(), 1);
    ok("el token se quita de la barra", si(!p.url().includes("token=")), "sí");
    await p.getByRole("link", { name: "Ir a Mi cuenta" }).click();
    await p.waitForURL(/mi-cuenta/);
    await p.waitForTimeout(800);
    ok("Mi cuenta ya no muestra el aviso", await p.getByText("Tu email no está verificado").count(), 0);
    await p.goto(`${REAL}/verificar-email?token=${token}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    ok("el mismo enlace otra vez: inválido", await p.getByText("El enlace no es válido o ya venció.").count(), 1);
    ok("indica cómo pedir otro", await p.getByText("Pedí uno nuevo desde Mi cuenta.").count(), 1);

    const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await m.goto(`${REAL}/verificar-email`, { waitUntil: "networkidle" });
    ok("móvil: sin desborde horizontal", await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  } catch (e) {
    console.log("ERROR del script: " + String(e).split("\n")[0]);
  } finally {
    reset();
    await b.close();
    console.log("limpieza hecha");
  }
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-verificacion.js | tail -3`
Expected: falla (no aparece "Tu email no está verificado").

- [ ] **Step 3: Tipos, servicio y hooks**

`cuenta/types.ts`, al final:

```ts
// Lo que la persona ve de su propia cuenta (GET /api/auth/yo).
export interface DatosPropios {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  emailVerificado: boolean;
}
```

(con `import type { Rol } from "@/features/auth/types";` al principio del archivo).

`cuentaService.ts`: sumar `DatosPropios` al import de tipos y, dentro del objeto:

```ts
  yo: () => apiClient.get<DatosPropios>("/api/auth/yo"),
  enviarVerificacion: () => apiClient.post<void>("/api/auth/enviar-verificacion"),
```

`authService.ts`, dentro del objeto:

```ts
  verificarEmail: (token: string) => apiClient.post<void>("/api/auth/verificar-email", { token }),
```

`cuenta/hooks/useYo.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useYo() {
  return useQuery({ queryKey: ["yo"], queryFn: cuentaService.yo });
}
```

`cuenta/hooks/useEnviarVerificacion.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useEnviarVerificacion() {
  return useMutation({ mutationFn: cuentaService.enviarVerificacion });
}
```

- [ ] **Step 4: Aviso en Mi cuenta y pantalla de verificación**

`cuenta/components/EmailSinVerificar.tsx`:

```tsx
import { Button } from "@/core/components/ui/button";
import { ApiError } from "@/core/lib/apiClient";
import { useEnviarVerificacion } from "../hooks/useEnviarVerificacion";
import { useYo } from "../hooks/useYo";

// Aviso de Mi cuenta mientras el email no esté verificado. No bloquea nada: solo ofrece mandar el enlace.
export function EmailSinVerificar() {
  const { data: yo } = useYo();
  const enviar = useEnviarVerificacion();
  if (!yo || yo.emailVerificado) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 4 }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
          Tu email no está verificado
        </p>
        {enviar.isSuccess ? (
          <p role="status" className="mt-0.5 text-[12.5px]" style={{ color: "var(--text)" }}>
            Te enviamos un enlace a {yo.email}. Vence en 24 horas.
          </p>
        ) : (
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Te mandamos un enlace a {yo.email} para confirmar que es tuyo.
          </p>
        )}
        {enviar.isError && (
          <p role="alert" className="mt-0.5 text-[12.5px] text-destructive">
            {enviar.error instanceof ApiError ? enviar.error.message : "No se pudo enviar el enlace"}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" disabled={enviar.isPending} onClick={() => enviar.mutate()}>
        {enviar.isPending ? "Enviando…" : "Enviar enlace de verificación"}
      </Button>
    </div>
  );
}
```

`MiCuentaPage.tsx`: `import { EmailSinVerificar } from "../components/EmailSinVerificar";` y `<EmailSinVerificar />` como primer hijo del `<div className="space-y-4">`.

`client/src/features/auth/pages/VerificarEmailPage.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { useSessionStore } from "@/core/store/sessionStore";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";
import { AvisoError } from "../components/AvisoError";

const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

export default function VerificarEmailPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [estado, setEstado] = useState<"verificando" | "listo" | "error">(token ? "verificando" : "error");
  const [mensaje, setMensaje] = useState(ENLACE_NO_VALIDO);
  const conSesion = useSessionStore((s) => !!s.token);
  const queryClient = useQueryClient();
  const iniciado = useRef(false);

  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", "/verificar-email");
  }, [params]);

  useEffect(() => {
    // Un solo intento: el enlace sirve una vez (y en desarrollo React ejecuta los efectos dos veces).
    if (!token || iniciado.current) return;
    iniciado.current = true;
    authService.verificarEmail(token).then(
      () => {
        setEstado("listo");
        void queryClient.invalidateQueries({ queryKey: ["yo"] });
      },
      (e) => {
        setMensaje(e instanceof ApiError ? e.message : "No se pudo verificar el email. Probá de nuevo.");
        setEstado("error");
      },
    );
  }, [token, queryClient]);

  const destino = conSesion ? { to: "/mi-cuenta", texto: "Ir a Mi cuenta" } : { to: "/login", texto: "Ir al inicio de sesión" };

  return (
    <AuthLayout>
      <meta name="referrer" content="no-referrer" />
      <p className="eyebrow mb-3">Verificar email</p>
      {estado === "verificando" && (
        <p className="flex items-center gap-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={15} className="animate-spin" /> Verificando tu email…
        </p>
      )}
      {estado === "listo" && (
        <div role="status" className="flex items-start gap-2.5">
          <CheckCircle2 size={20} style={{ color: "var(--success)", flexShrink: 0, marginTop: 3 }} />
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>Listo, tu email quedó verificado.</h2>
        </div>
      )}
      {estado === "error" && (
        <div className="space-y-3">
          <AvisoError>{mensaje}</AvisoError>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Pedí uno nuevo desde Mi cuenta.
          </p>
        </div>
      )}
      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />
      <Link to={destino.to} className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
        {destino.texto}
      </Link>
    </AuthLayout>
  );
}
```

`AppRoutes.tsx`: `import VerificarEmailPage from "@/features/auth/pages/VerificarEmailPage";` y, junto a `/activar-cuenta`:

```tsx
      <Route path="/verificar-email" element={<VerificarEmailPage />} />
```

- [ ] **Step 5: Typecheck, lint y la prueba**

Run: `cd client && pnpm typecheck 2>&1 | tail -2; pnpm lint 2>&1 | tail -2; bash $SCRATCH/reiniciar-api.sh >/dev/null; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-verificacion.js; echo "exit $?"`
Expected: typecheck limpio, lint con los 2 avisos de siempre, `--- 9/9 ok`, `exit 0`. Mirar `$SCRATCH/shots/mi-cuenta-sin-verificar.png`.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Verificar el email desde Mi cuenta y pantalla de verificación"
```

---

### Task 11: El largo máximo de la contraseña, explicado en caracteres

**Files:**
- Modify: `server/src/core/validacion.ts`, `client/src/core/lib/validacion.ts`
- Create (verificación): `$SCRATCH/verificar-mensaje-largo.sh`, `$SCRATCH/e2e-mensaje-largo.js`

**Interfaces:**
- Produces: mensaje "La contraseña es demasiado larga: el máximo son 72 caracteres (las tildes y la ñ cuentan doble)" en server y client. El límite sigue midiéndose en bytes (`MAX_BYTES_PASSWORD = 72`).

- [ ] **Step 1: Escribir las pruebas que fallan**

`$SCRATCH/verificar-mensaje-largo.sh`:

```bash
#!/usr/bin/env bash
source /tmp/claude-1000/-home-agustin-PROYECTOS-Babylon-Instituto-de-Ingles/4d000f4c-489a-4b08-b670-4d28de4b7ccd/scratchpad/lib.sh
bash $SCRATCH/reiniciar-api.sh >/dev/null
T=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234"}' | tok)
ENIES=$(python3 -c "print('ñ'*37)")
R=$(post "$T" auth/cambiar-contrasena "{\"passwordActual\":\"prueba1234\",\"passwordNueva\":\"$ENIES\"}")
echo "cambiar contraseña con 37 eñes: $(http "$R") (esperado 400)"
echo "el mensaje habla de caracteres: $(echo "$R" | grep -c 'el máximo son 72 caracteres (las tildes y la ñ cuentan doble)') (esperado 1)"
R=$(post "" auth/activar-cuenta "{\"token\":\"x\",\"password\":\"$ENIES\"}")
echo "activar cuenta: el mensaje habla de caracteres: $(echo "$R" | grep -c '72 caracteres') (esperado 1)"
echo "ya no habla de bytes: $(echo "$R" | grep -c 'bytes') (esperado 0)"
```

`$SCRATCH/e2e-mensaje-largo.js`:

```js
const { chromium } = require("playwright-core");
const REAL = "http://localhost:5173";
const ok = (e, real, esp) => console.log(`${e}: ${real} (esperado ${esp})`);
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  try {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
    await p.locator('input[type="email"]').fill("p6@prueba.babylon.test");
    await p.locator('input[type="password"]').fill("prueba1234");
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/mis-hijos/);
    await p.goto(`${REAL}/mi-cuenta`, { waitUntil: "networkidle" });
    const campos = p.locator('input[type="password"]');
    await campos.nth(0).fill("prueba1234");
    await campos.nth(1).fill("ñ".repeat(37));
    await campos.nth(2).fill("ñ".repeat(37));
    await p.getByRole("button", { name: /Cambiar contraseña/ }).click();
    await p.waitForTimeout(400);
    ok("el formulario explica el largo en caracteres", await p.getByText("el máximo son 72 caracteres (las tildes y la ñ cuentan doble)", { exact: false }).count(), 1);
    ok("y no habla de bytes", await p.getByText(/bytes/).count(), 0);
  } catch (e) {
    console.log("ERROR del script: " + String(e).split("\n")[0]);
  } finally {
    await b.close();
  }
})();
```

- [ ] **Step 2: Correrlas para ver que fallan**

Run: `bash $SCRATCH/chk.sh $SCRATCH/verificar-mensaje-largo.sh | tail -3; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-mensaje-largo.js | tail -2`
Expected: fallan (el mensaje todavía dice "72 bytes").

- [ ] **Step 3: Cambiar el mensaje en los dos lados**

`server/src/core/validacion.ts`, el mensaje del `refine`:

```ts
    "La contraseña es demasiado larga: el máximo son 72 caracteres (las tildes y la ñ cuentan doble)",
```

y el comentario de arriba suma: `// Para la persona se explica en caracteres: los comunes cuentan 1 y las tildes y la ñ, 2.`

`client/src/core/lib/validacion.ts`:

```ts
// Para la persona se explica en caracteres: los comunes cuentan 1 y las tildes y la ñ, 2.
export const MENSAJE_PASSWORD_LARGA = `La contraseña es demasiado larga: el máximo son ${MAX_BYTES_PASSWORD} caracteres (las tildes y la ñ cuentan doble)`;
```

- [ ] **Step 4: Correr las pruebas**

Run: `cd server && pnpm typecheck 2>&1 | tail -1; cd ../client && pnpm typecheck 2>&1 | tail -1; bash $SCRATCH/chk.sh $SCRATCH/verificar-mensaje-largo.sh; bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-mensaje-largo.js`
Expected: `--- 4/4 ok` y `--- 2/2 ok`.

- [ ] **Step 5: Commit**

```bash
git add server/src/core/validacion.ts client/src/core/lib/validacion.ts
git commit -m "El largo máximo de la contraseña se explica en caracteres"
```

---

### Task 12: Documentación y batería completa

**Files:**
- Modify: `CLAUDE.md`; memoria `proyecto_babylon_pendientes_futuros.md` y `MEMORY.md`; `$SCRATCH/bateria.sh` (no se commitea)

- [ ] **Step 1: `CLAUDE.md`**

1. Tabla de errores, debajo de la fila de `AuthorizationError`:

```
| `DemasiadosPedidosError` | 429 | Demasiados pedidos seguidos de la misma cuenta (ej. reenviar el enlace de verificación del email) |
```

2. Debajo del punto **Retención de sesiones** (en "Autenticación y roles"):

```
- **Invitaciones y verificación de email**: las altas (padre, profesor, secretario, administrador) aceptan `password` opcional: **con contraseña** la cuenta nace `activa` con el email sin verificar; **sin contraseña** se crea en estado **`pendiente`** (contraseña inutilizable, no puede iniciar sesión) y se manda una invitación con un enlace de **7 días** para que la persona elija su contraseña (`/activar-cuenta`; al activarla queda `activa` y con el email verificado). `InvitacionService` (`usuarios/`) concentra crear cuentas pendientes, invitar (de a uno o en lote, hasta 100 por pedido), reenviar (1 minuto de espera por cuenta), cancelar (borra la cuenta pendiente; el padre/profesor vuelve a "sin cuenta" por `ON DELETE SET NULL`), listar pendientes y activar; invitar toma bloqueos por persona y por email, así dos pedidos simultáneos no crean dos cuentas. **El correo se manda después de confirmar la transacción**: si falla, el alta queda hecha y se informa `invitacion: "no-enviada"`. "¿Olvidaste tu contraseña?" sobre una cuenta pendiente reenvía la invitación (1 minuto y 3 por hora). `Usuario.emailVerificadoEn` se completa al activar una invitación, al recuperar la contraseña y con el enlace de **24 horas** que se pide desde Mi cuenta (`POST /api/auth/enviar-verificacion`, 1 minuto y 3 por hora → 429). Los profesores inactivos no se invitan. Todos los enlaces por correo viven en **`TokenCuenta`** con `tipo` (`recuperacion` 1 h, `invitacion` 7 días, `verificacion_email` 24 h); se guarda solo su SHA-256 y un enlace de un tipo nunca sirve en el flujo de otro.
```

3. En "Recuperación de contraseña": `crea un \`TokenRecuperacion\` (entidad secundaria de \`usuarios/\`)` → `crea un enlace de tipo \`recuperacion\` en \`TokenCuenta\` (entidad secundaria de \`usuarios/\`, compartida con invitaciones y verificación)`; `\`TokenRecuperacion\` se borra en cascada` → `\`TokenCuenta\` se borra en cascada`; y donde dice que `restablecer-contrasena` cambia la contraseña, agregar "y deja el email verificado".
4. En "Panel de Usuarios (Admin)": el comienzo `\`UsuariosPage\` (client) es **una única tabla con todas las cuentas** (\`GET /api/auth/usuarios\`:` pasa a:

```
`UsuariosPage` (client) tiene dos pestañas. **Pendientes** (`PendientesTab`, `GET /api/auth/pendientes`) lista a quienes todavía no entraron nunca —padres y profesores activos sin cuenta y cuentas con la invitación pendiente o vencida—, con buscador, filtros por rol y estado, selección múltiple, Invitar / Reenviar / Cancelar invitación y confirmación en cada envío; la etiqueta se calcula ("Sin cuenta", "Pendiente de aceptación", "Invitación vencida"). **Cuentas** es la tabla de las cuentas activas e inactivas (`GET /api/auth/usuarios`, que excluye las pendientes:
```

y al final de ese párrafo: `Las tres altas (modal de Usuarios, Profesores e inscripción de alumno) eligen "¿Cómo accede?" (\`ModoDeAcceso\`): invitación por email (por defecto) o contraseña asignada.`

5. Tabla de la API, debajo de la fila de `GET /api/auth/usuarios`:

```
| `GET /api/auth/pendientes` | admin | Filas de la pestaña Pendientes (sin cuenta, pendientes de aceptación y vencidas), con marcas `sinEmail`/`emailEnUso` |
| `POST /api/auth/invitaciones` | admin | `{ padreIds?, profesorIds? }` (hasta 100) → `{ resultados }` con "enviada" o el motivo (sin email, email repetido, ya tiene cuenta, profesor inactivo, no se pudo enviar el correo) |
| `POST /api/auth/invitaciones/reenviar` | admin | `{ usuarioIds }` (hasta 100) → `{ resultados }`; 1 minuto de espera por cuenta |
| `DELETE /api/auth/invitaciones/:usuarioId` | admin | Cancela la invitación (borra la cuenta pendiente); 404 si no existe, 409 si ya se activó |
| `POST /api/auth/activar-cuenta/consultar` | público | `{ token }` → `{ nombre, email }` para el saludo; 400 "El enlace no es válido o ya venció."; 5 cada 15 min por IP |
| `POST /api/auth/activar-cuenta` | público | `{ token, password }` → 204: cuenta activa y email verificado; 5 cada 15 min por IP |
| `GET /api/auth/yo` | autenticado | `{ id, nombre, email, rol, emailVerificado }` |
| `POST /api/auth/enviar-verificacion` | autenticado | Envía el enlace de verificación (24 h); 400 si ya está verificado; 429 por límite |
| `POST /api/auth/verificar-email` | público | `{ token }` → 204; 400 con el mensaje de enlace inválido; 5 cada 15 min por IP |
```

y en las filas de `POST /api/padres`, `POST /api/profesores`, `POST /api/auth/secretarios` y `POST /api/auth/administradores` agregar: `— \`password\` opcional: sin ella, cuenta pendiente + invitación; la respuesta trae \`invitacion\``.

- [ ] **Step 2: Memoria**

En `proyecto_babylon_pendientes_futuros.md`, reemplazar `Siguen, en este orden: (2) invitación y verificación de email (invitación por defecto + alta manual alternativa), (3)` por `**Subproyecto 2 de 4 (invitación y verificación de email) hecho el <fecha de cierre>**, pestaña Pendientes en Usuarios. Siguen: (3)`. En `MEMORY.md`, la línea de pendientes pasa a decir `subproyectos 1 (Mi cuenta/sesiones) y 2 (invitación/verificación de email) hechos; siguen historial de notificaciones y 2FA`.

- [ ] **Step 3: Batería completa**

En `$SCRATCH/bateria.sh`: el archivo de salida pasa a `final4.out`, y se suman, en los bloques que corresponda (cada bloque de API empieza con un reinicio, porque los límites por IP se comparten):

```bash
run "invitaciones (servicio)" bash $SCRATCH/ts.sh scripts/_invitaciones.ts
run "activación (servicio)" bash $SCRATCH/ts.sh scripts/_activacion.ts
bash $SCRATCH/reiniciar-api.sh >/dev/null
run "invitaciones (api)" bash $SCRATCH/chk.sh $SCRATCH/verificar-invitaciones.sh
run "altas (api)" bash $SCRATCH/chk.sh $SCRATCH/verificar-altas.sh
run "verificación (api)" bash $SCRATCH/chk.sh $SCRATCH/verificar-verificacion.sh
run "mensaje largo (api)" bash $SCRATCH/chk.sh $SCRATCH/verificar-mensaje-largo.sh
bash $SCRATCH/reiniciar-api.sh >/dev/null
run "e2e pendientes" bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-pendientes.js
run "e2e altas" bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-altas.js
run "e2e activación" bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-activacion.js
run "e2e verificación" bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-verificacion.js
run "e2e mensaje largo" bash $SCRATCH/chk.sh $SCRATCH/e2e.sh e2e-mensaje-largo.js
```

Run (en segundo plano, tarda varios minutos): `(setsid nohup bash $SCRATCH/bateria.sh >/dev/null 2>&1 &)` y, al aparecer `FIN` en `$SCRATCH/final4.out`: `grep -E "^==|^---|^exit|NO COINCIDE" $SCRATCH/final4.out`
Expected: todos los bloques con `exit 0` y sin `NO COINCIDE` (los del subproyecto 1 incluidos). Después: `select count(*) from "Usuario" where email like 'prueba-tmp%'` = 0, `select count(*) from "Padre" where id like 'prueba-tmp%'` = 0, y p6 entra con `prueba1234` y `emailVerificadoEn` nulo.

- [ ] **Step 4: Compilar todo y commit**

Run: `bash $SCRATCH/compilar.sh`
Expected: server typecheck + build ok; client lint con los 2 avisos de siempre y build ok.

```bash
git add CLAUDE.md
git commit -m "Documentar invitaciones, pestaña Pendientes y verificación de email"
```
