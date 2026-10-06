# Sesión persistente, notificaciones por rol y recuperación de contraseña — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar función real al checkbox "Mantener sesión iniciada", a la campana de notificaciones para los cuatro roles y al flujo "¿Olvidaste tu contraseña?" por correo, con límites de pedidos.

**Architecture:** Tres entregas independientes sobre la arquitectura feature-first existente. El server valida la sesión contra la base en cada pedido (validador inyectado en `authMiddleware`), expone un módulo de lectura `notificaciones/` (mismo criterio que `reportes/`) y agrega a `usuarios/` los tokens de recuperación, un puerto `Mailer` con adaptadores SMTP/consola y límites de pedidos con `express-rate-limit`. El client cambia el almacenamiento de la sesión, maneja los 401 y suma dos pantallas públicas.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL 18, zod 4, jsonwebtoken, bcrypt, `express-rate-limit` (nuevo), `nodemailer` (nuevo); React 19, Zustand 5, TanStack Query, React Router, Tailwind 4. Node 24 + pnpm 11.

**Spec:** `docs/superpowers/specs/2026-10-06-sesion-notificaciones-recuperar-contrasena-design.md`

## Global Constraints

- Arquitectura 100% feature-first: nada de carpetas `domain/`, `data/`, `presentation/`. `core/` no importa de `modules/`.
- Repositorios: todo método nuevo acepta `tx?: unknown` al final; los services nunca instancian repositorios; solo `container.ts` arma dependencias.
- Errores de negocio: lanzar clases de `core/errors.ts`, nunca `res.status` en services.
- Fechas de "qué día/hora es": siempre `fechaHoraEnArgentina()` / `inicioDeHoyUtc()` de `core/fechas.ts`.
- Sesión corta: `JWT_EXPIRES_IN` = `8h`, en `sessionStorage`. Sesión larga: `JWT_EXPIRES_IN_RECORDAR` = `30d`, en `localStorage`.
- Token de recuperación: 32 bytes `randomBytes`, base64url; en la base solo su SHA-256; vence en **1 hora**; un solo uso; pedir uno nuevo invalida los anteriores.
- Contraseña nueva: mínimo **8**, máximo **72** caracteres.
- Límites por cuenta: máx. **3 enlaces por hora** y **60 s** entre pedidos (en la base; si se supera no se envía nada y la respuesta no cambia).
- Límites por IP (ventana **15 min**): olvidé-contraseña **5**; restablecer **5**; login fallido por IP+email **5**; login fallido por IP **20**. Logins exitosos no cuentan. Respuesta 429: `"Demasiados intentos, probá de nuevo en unos minutos"`.
- `POST /api/auth/olvide-contrasena` responde **siempre** 200 con el mismo mensaje. Token inválido/vencido/usado → 400 `"El enlace no es válido o ya venció. Pedí uno nuevo."`.
- En `NODE_ENV=production` el server no arranca sin `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.
- El correo se envía sin esperar al SMTP; un fallo solo se registra en el log.
- Campana: avisos derivados del estado actual, sin "leído", máx. **10**, orden danger → warning → info.
- Textos de UI y mensajes de error en español rioplatense, como el resto del proyecto.
- No hay test runner en el proyecto: cada "test" de este plan es un script de verificación (curl, `tsx` o Playwright) en el scratchpad, que se corre y cuyo resultado esperado se indica. Los scripts de verificación **no** se commitean. Todo dato creado por una verificación se borra al terminar (datos reales intactos).

## Review Focus

1. **Token emitido en el mismo segundo que el cambio de contraseña**: `iat` está en segundos; comparar contra `contrasenaCambiadaEn` en milisegundos rechazaría la sesión nueva que se abre justo después de restablecer. Se espera que el login inmediato posterior funcione (test en Task 1 y Task 7).
2. **Login multi-rol**: el primer paso (`requiereSeleccionRol`, 200) no debe contar como intento fallido, y el segundo paso debe llevar `recordarme` (tests en Task 2 y Task 5).
3. **Email con mayúsculas o espacios** (`" Admin@Babylon.test "`): debe encontrar la misma cuenta en login y en olvidé-contraseña, y contar para el mismo límite IP+email (test en Task 5 y Task 7).
4. **401 sin sesión**: un 401 del login, o en las pantallas públicas de recuperación, no debe redirigir ni entrar en bucle; solo redirige un 401 cuando había token (test en Task 2).
5. **Mismo enlace usado dos veces a la vez**: solo uno puede cambiar la contraseña (marcado atómico del token; test en Task 7).

---

## Entrega 1 — Mantener sesión iniciada

### Task 1: Server — sesión larga y validación de sesión en cada pedido

**Files:**
- Modify: `server/prisma/schema.prisma` (model `Usuario`)
- Create: migración `server/prisma/migrations/<timestamp>_usuario_contrasena_cambiada_en/migration.sql` (la genera Prisma)
- Modify: `server/src/modules/usuarios/usuario.entity.ts`
- Modify: `server/src/core/ports.ts`
- Modify: `server/src/core/middlewares/authMiddleware.ts`
- Modify: `server/src/core/config.ts`, `server/.env.example`
- Modify: `server/src/modules/usuarios/usuario.schema.ts`, `server/src/modules/usuarios/usuario.service.ts`
- Modify: `server/src/container.ts`
- Test: `$SCRATCH/verificar-sesion.sh`

**Interfaces:**
- Produces: `Usuario.contrasenaCambiadaEn?: Date | null`; `EstadoDeSesion`, `ValidadorDeSesion` (`core/ports.ts`); `configurarValidadorDeSesion(v: ValidadorDeSesion): void` (`authMiddleware.ts`); `credencialesSchema` acepta `recordarme?: boolean`; `config.JWT_EXPIRES_IN_RECORDAR`.

- [ ] **Step 1: Escribir el script de verificación** `$SCRATCH/verificar-sesion.sh`:

```bash
#!/usr/bin/env bash
# Requiere el server en :4000. Usa la cuenta de prueba p6@prueba.babylon.test.
set -u
API=localhost:4000/api
login() { curl -s -X POST $API/auth/login -H 'content-type: application/json' -d "$1"; }
tok() { python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"; }
dur() { python3 -c "import sys,json,base64;p=sys.argv[1].split('.')[1];p+='='*(-len(p)%4);d=json.loads(base64.urlsafe_b64decode(p));print(d['exp']-d['iat'])" "$1"; }
CORTA=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234"}' | tok)
LARGA=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234","recordarme":true}' | tok)
echo "duración corta: $(dur $CORTA) (esperado 28800)"
echo "duración larga: $(dur $LARGA) (esperado 2592000)"
ADMIN=$(login '{"email":"admin@babylon.test","password":"admin1234","rolElegido":"admin"}' | tok)
P6ID=$(docker exec babylon-postgres psql -U babylon -d babylon -Atc "select id from \"Usuario\" where email='p6@prueba.babylon.test'")
code() { curl -s -o /dev/null -w "%{http_code}" $API/alumnos/mios -H "authorization: Bearer $1"; }
echo "activa: $(code $LARGA) (esperado 200)"
curl -s -o /dev/null -X PATCH $API/auth/usuarios/$P6ID/estado -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"estado":"inactivo"}'
echo "desactivada: $(code $LARGA) (esperado 401)"
curl -s -o /dev/null -X PATCH $API/auth/usuarios/$P6ID/estado -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' -d '{"estado":"activo"}'
echo "reactivada: $(code $LARGA) (esperado 200)"
docker exec babylon-postgres psql -U babylon -d babylon -qc "update \"Usuario\" set \"contrasenaCambiadaEn\"=now() where id='$P6ID'"
echo "token previo al cambio: $(code $LARGA) (esperado 401)"
NUEVO=$(login '{"email":"p6@prueba.babylon.test","password":"prueba1234"}' | tok)
echo "login en el mismo segundo del cambio: $(code $NUEVO) (esperado 200)"
docker exec babylon-postgres psql -U babylon -d babylon -qc "update \"Usuario\" set \"contrasenaCambiadaEn\"=null where id='$P6ID'"
```

- [ ] **Step 2: Correrlo para ver que falla**

Run: `bash $SCRATCH/verificar-sesion.sh`
Expected: la duración larga sale 28800 (no 2592000), "desactivada" sale 200 (no 401) y el `update` falla porque la columna `contrasenaCambiadaEn` no existe.

- [ ] **Step 3: Agregar la columna** en `model Usuario` de `schema.prisma`, debajo de `fechaCreacion`:

```prisma
  // Último cambio de contraseña: invalida los tokens emitidos antes (ver authMiddleware).
  contrasenaCambiadaEn DateTime?
```

Run: `cd server && pnpm prisma migrate dev --name usuario_contrasena_cambiada_en`
Expected: migración creada y aplicada; `ALTER TABLE "Usuario" ADD COLUMN "contrasenaCambiadaEn" TIMESTAMP(3);`

En `usuario.entity.ts`, agregar al final de `Usuario`:

```ts
  // Último cambio de contraseña; los tokens emitidos antes dejan de valer.
  contrasenaCambiadaEn?: Date | null;
```

- [ ] **Step 4: Puerto del validador** — al final de `core/ports.ts`:

```ts
// Lo que authMiddleware necesita saber de una cuenta para aceptar su token.
// core/ no puede importar modules/, así que container.ts le inyecta la
// implementación con configurarValidadorDeSesion().
export interface EstadoDeSesion {
  activo: boolean;
  contrasenaCambiadaEn: Date | null;
}

export type ValidadorDeSesion = (usuarioId: string) => Promise<EstadoDeSesion | null>;
```

- [ ] **Step 5: Validación en `authMiddleware.ts`** — reemplazar `authMiddleware` completo:

```ts
let validadorDeSesion: ValidadorDeSesion | null = null;

// Lo llama container.ts al arrancar. Sin validador el middleware rechaza todo
// (falla cerrado): nunca acepta un token sin revisar el estado de la cuenta.
export function configurarValidadorDeSesion(validador: ValidadorDeSesion): void {
  validadorDeSesion = validador;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Token no provisto" });
    return;
  }

  let payload: AuthPayload & { iat?: number };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload & { iat?: number };
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  if (!validadorDeSesion) {
    throw new Error("authMiddleware: falta configurar el validador de sesión");
  }
  // Una cuenta desactivada, o cuya contraseña cambió después de emitido el
  // token, pierde la sesión en el próximo pedido aunque el token no haya vencido.
  // `iat` está en segundos: se compara contra el segundo del cambio, así un
  // login hecho en el mismo segundo que el cambio sigue siendo válido.
  const estado = await validadorDeSesion(payload.sub);
  const cambioEnSegundos = estado?.contrasenaCambiadaEn ? Math.floor(estado.contrasenaCambiadaEn.getTime() / 1000) : null;
  const emitidoAntesDelCambio = cambioEnSegundos !== null && (payload.iat ?? 0) < cambioEnSegundos;
  if (!estado || !estado.activo || emitidoAntesDelCambio) {
    res.status(401).json({ error: "Tu sesión ya no es válida, ingresá de nuevo" });
    return;
  }

  req.auth = { sub: payload.sub, rol: payload.rol };
  next();
}
```

Y en los imports: `import type { Rol, ValidadorDeSesion } from "../ports";`.

- [ ] **Step 6: Duración según `recordarme`**

`config.ts`, debajo de `JWT_EXPIRES_IN`:

```ts
  // Duración del token cuando se marca "Mantener sesión iniciada".
  JWT_EXPIRES_IN_RECORDAR: z.string().default("30d"),
```

`.env.example`, debajo de `JWT_EXPIRES_IN`:

```
# Duración de la sesión cuando se marca "Mantener sesión iniciada".
JWT_EXPIRES_IN_RECORDAR="30d"
```

`usuario.schema.ts`, en `credencialesSchema` debajo de `rolElegido`:

```ts
  // "Mantener sesión iniciada": token de JWT_EXPIRES_IN_RECORDAR en vez de JWT_EXPIRES_IN.
  recordarme: z.boolean().optional(),
```

`usuario.service.ts`: la firma pasa a `async autenticar({ email, password, rolElegido, recordarme }: CredencialesInput)` y el `jwt.sign` usa:

```ts
      expiresIn: (recordarme ? config.JWT_EXPIRES_IN_RECORDAR : config.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
```

- [ ] **Step 7: Inyectar el validador** en `container.ts`, después de crear `usuarioRepository`:

```ts
configurarValidadorDeSesion(async (usuarioId) => {
  const usuario = await usuarioRepository.findById(usuarioId);
  return usuario ? { activo: usuario.estado === "activo", contrasenaCambiadaEn: usuario.contrasenaCambiadaEn ?? null } : null;
});
```

con `import { configurarValidadorDeSesion } from "./core/middlewares/authMiddleware";`.

- [ ] **Step 8: Typecheck y verificación**

Run: `cd server && pnpm typecheck`, reiniciar el server, luego `bash $SCRATCH/verificar-sesion.sh`
Expected: 28800 / 2592000 / 200 / 401 / 200 / 401 / 200, como indica cada línea.

- [ ] **Step 9: Commit**

```bash
git add server/prisma server/src server/.env.example
git commit -m "Sesión: token largo con 'recordarme' y validación de cuenta en cada pedido"
```

### Task 2: Client — "Mantener sesión iniciada" y manejo de sesión vencida

**Files:**
- Modify: `client/src/core/store/sessionStore.ts`
- Modify: `client/src/features/auth/types.ts`, `client/src/features/auth/hooks/useAuth.ts`
- Modify: `client/src/core/lib/apiClient.ts`
- Modify: `client/src/features/auth/pages/LoginPage.tsx`
- Test: `$SCRATCH/e2e-sesion.js`

**Interfaces:**
- Consumes: `POST /api/auth/login` con `recordarme` (Task 1).
- Produces: `iniciarSesion(token, usuario, recordar: boolean)`; `LoginPage` lee `?motivo=` con los valores `sesion-vencida` y `contrasena-actualizada` (este último lo usa Task 8).

- [ ] **Step 1: Escribir la prueba** `$SCRATCH/e2e-sesion.js` (Playwright, `playwright-core` + Chrome del sistema):

```js
const { chromium } = require("playwright-core");
const REAL = "http://localhost:5173";
async function login(p, email, pass, recordar, rol) {
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[type="password"]').fill(pass);
  if (recordar) await p.getByLabel("Mantener sesión iniciada").check();
  await p.locator('button[type="submit"]').click();
  if (rol) await p.getByRole("button", { name: rol }).click();
  await p.waitForURL(/\/(dashboard|cursos|mis-hijos)/);
}
const donde = (p) => p.evaluate(() => ({ local: !!localStorage.getItem("babylon-session"), session: !!sessionStorage.getItem("babylon-session") }));
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  // 1) sin recordar → sessionStorage; una pestaña nueva no tiene sesión
  let ctx = await b.newContext(); let p = await ctx.newPage();
  await login(p, "p6@prueba.babylon.test", "prueba1234", false);
  console.log("sin recordar:", JSON.stringify(await donde(p)), "(esperado session=true, local=false)");
  let p2 = await ctx.newPage(); await p2.goto(`${REAL}/mis-hijos`, { waitUntil: "networkidle" });
  console.log("pestaña nueva:", p2.url().includes("/login") ? "pide login (ok)" : "SIGUE LOGUEADO (mal)");
  await ctx.close();
  // 2) con recordar → localStorage; una pestaña nueva conserva la sesión
  ctx = await b.newContext(); p = await ctx.newPage();
  await login(p, "p6@prueba.babylon.test", "prueba1234", true);
  console.log("con recordar:", JSON.stringify(await donde(p)), "(esperado local=true, session=false)");
  p2 = await ctx.newPage(); await p2.goto(`${REAL}/mis-hijos`, { waitUntil: "networkidle" });
  console.log("pestaña nueva:", p2.url().includes("/mis-hijos") ? "sigue logueado (ok)" : "PIDE LOGIN (mal)");
  // 3) sesión invalidada en el server → vuelve al login con aviso
  const { execSync } = require("child_process");
  execSync(`docker exec babylon-postgres psql -U babylon -d babylon -qc "update \\"Usuario\\" set \\"contrasenaCambiadaEn\\"=now()+interval '1 minute' where email='p6@prueba.babylon.test'"`);
  await p.goto(`${REAL}/mis-hijos/cuotas`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const aviso = await p.getByText("Tu sesión venció").count();
  console.log("sesión vencida:", p.url().includes("/login?motivo=sesion-vencida") && aviso > 0 ? "login con aviso (ok)" : "MAL: " + p.url());
  execSync(`docker exec babylon-postgres psql -U babylon -d babylon -qc "update \\"Usuario\\" set \\"contrasenaCambiadaEn\\"=null where email='p6@prueba.babylon.test'"`);
  await ctx.close();
  // 4) multi-rol con recordar → localStorage; contraseña mala no redirige en bucle
  ctx = await b.newContext(); p = await ctx.newPage();
  await login(p, "admin@babylon.test", "admin1234", true, "Administrador");
  console.log("multi-rol con recordar:", JSON.stringify(await donde(p)), "(esperado local=true)");
  await ctx.close();
  ctx = await b.newContext(); p = await ctx.newPage();
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').fill("p6@prueba.babylon.test"); await p.locator('input[type="password"]').fill("mala");
  await p.locator('button[type="submit"]').click(); await p.waitForTimeout(1200);
  console.log("contraseña mala:", p.url().endsWith("/login") ? "se queda en /login sin motivo (ok)" : "MAL: " + p.url());
  await b.close();
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `node $SCRATCH/e2e-sesion.js`
Expected: falla al buscar el checkbox "Mantener sesión iniciada" (no existe).

- [ ] **Step 3: Almacenamiento según "mantener sesión"** — reemplazar `sessionStore.ts`:

```ts
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Usuario } from "@/features/auth/types";

const CLAVE = "babylon-session";

// Con "Mantener sesión iniciada" la sesión vive en localStorage (sobrevive al
// cierre del navegador); sin él, en sessionStorage (se borra al cerrarlo). Al
// recargar, la sesión está en el que corresponda a como se inició.
let recordarSesion = localStorage.getItem(CLAVE) !== null;

const almacenamientoSesion: StateStorage = {
  getItem: (nombre) => localStorage.getItem(nombre) ?? sessionStorage.getItem(nombre),
  setItem: (nombre, valor) => {
    (recordarSesion ? localStorage : sessionStorage).setItem(nombre, valor);
    (recordarSesion ? sessionStorage : localStorage).removeItem(nombre);
  },
  removeItem: (nombre) => {
    localStorage.removeItem(nombre);
    sessionStorage.removeItem(nombre);
  },
};

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  iniciarSesion: (token: string, usuario: Usuario, recordar: boolean) => void;
  cerrarSesion: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      iniciarSesion: (token, usuario, recordar) => {
        recordarSesion = recordar;
        set({ token, usuario });
      },
      cerrarSesion: () => set({ token: null, usuario: null }),
    }),
    { name: CLAVE, storage: createJSONStorage(() => almacenamientoSesion) },
  ),
);
```

- [ ] **Step 4: Tipos y login**

`features/auth/types.ts`, en `CredencialesInput`:

```ts
  // "Mantener sesión iniciada".
  recordarme?: boolean;
```

`useAuth.ts`, en `useLogin`: `onSuccess: (resultado, credenciales) => { ... iniciarSesion(resultado.token, resultado.usuario, credenciales.recordarme ?? false); ... }`.

Buscar otros llamadores: `grep -rn "iniciarSesion(" client/src` — todos deben pasar el tercer argumento.

- [ ] **Step 5: 401 → login** — en `apiClient.ts`, dentro de `if (!res.ok)`, antes de `throw`:

```ts
    // Sesión vencida o invalidada en el server: se cierra y se vuelve al login.
    // Solo si había token (las pantallas públicas no redirigen) y no es el
    // propio login (credenciales incorrectas también responden 401).
    if (res.status === 401 && token && !path.startsWith("/api/auth/login")) {
      useSessionStore.getState().cerrarSesion();
      window.location.assign("/login?motivo=sesion-vencida");
    }
```

- [ ] **Step 6: LoginPage** — leer el archivo y:
  - Agregar `recordarme: z.boolean().optional()` al schema del formulario y `defaultValues: { recordarme: false }`.
  - Debajo del campo contraseña, el checkbox (mismo estilo de label que el resto del formulario):

```tsx
<label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
  <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--brand)]" {...register("recordarme")} />
  Mantener sesión iniciada
</label>
```

  - `elegirRol` ya reenvía `{ ...credenciales, rolElegido }`, así que `recordarme` viaja en el segundo paso sin cambios.
  - Aviso según `?motivo=` (con `useSearchParams` de `react-router-dom`), arriba del formulario:

```tsx
const MENSAJES_MOTIVO: Record<string, { texto: string; tono: "warning" | "success" }> = {
  "sesion-vencida": { texto: "Tu sesión venció, ingresá de nuevo.", tono: "warning" },
  "contrasena-actualizada": { texto: "Contraseña actualizada, ya podés ingresar.", tono: "success" },
};
```

```tsx
{aviso && (
  <p
    className="rounded border p-3 text-[12.5px]"
    style={{ borderColor: `var(--${aviso.tono})`, background: `var(--${aviso.tono}-soft)`, color: `var(--${aviso.tono})` }}
  >
    {aviso.texto}
  </p>
)}
```

  con `const [params] = useSearchParams(); const aviso = MENSAJES_MOTIVO[params.get("motivo") ?? ""];`.

- [ ] **Step 7: Verificar**

Run: `cd client && pnpm typecheck && pnpm lint`, luego `node $SCRATCH/e2e-sesion.js`
Expected: todas las líneas terminan en "(ok)" o coinciden con el "esperado".

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "Login: 'Mantener sesión iniciada' y vuelta al login cuando la sesión vence"
```

## Entrega 2 — Campana de notificaciones por rol

### Task 3: Server — fecha de publicación y módulo `notificaciones/`

**Files:**
- Modify: `server/prisma/schema.prisma` (`Evaluacion`, `NotaCierre`) + migración
- Modify: `server/src/modules/calificaciones/evaluacion.entity.ts`, `notaCierre.entity.ts`, `calificacion.service.ts` (`publicarEvaluacion`, `publicarNotaCierre`), y `calificacion.repository.prisma.ts` si `guardarNotaCierre` descarta campos
- Create: `server/src/modules/notificaciones/notificacion.service.ts`, `notificacion.controller.ts`, `notificacion.routes.ts`
- Modify: `server/src/container.ts`, `server/src/server.ts`
- Modify: `docs/superpowers/specs/2026-10-06-sesion-notificaciones-recuperar-contrasena-design.md` (forma de la respuesta y `publicadaEn`)
- Test: `$SCRATCH/verificar-notificaciones.ts` (corrido con `pnpm exec tsx` desde `server/`)

**Interfaces:**
- Consumes: `fechaHoraEnArgentina`, `inicioDeHoyUtc` (`core/fechas.ts`); `ReporteService.obtenerResumenDashboard(cicloId?)`; `PadreService.buscarPorUsuarioId`, `ProfesorService.buscarPorUsuarioId`.
- Produces: `GET /api/notificaciones` → `Notificacion[]` con `Notificacion = { id: string; tono: "danger" | "warning" | "info"; texto: string; ruta: string }`; `NotificacionService.listarParaStaff(ahora?)`, `listarParaProfesor(profesorId, ahora?)`, `listarParaPadre(padreId, ahora?)`.

- [ ] **Step 1: Escribir la verificación** `$SCRATCH/verificar-notificaciones.ts` — llama al service con fechas fijas, imprime los avisos por rol y los compara con consultas directas:

```ts
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";

const prisma = new PrismaClient();
const svc = container.notificacionService;
const enAr = (iso: string) => new Date(iso); // instantes en UTC; AR = UTC-3

(async () => {
  const profe = await prisma.profesor.findFirstOrThrow({ where: { usuario: { email: "profesor@babylon.test" } } });
  const padre = await prisma.padre.findFirstOrThrow({ where: { usuario: { email: "p1@prueba.babylon.test" } } });

  console.log("STAFF:", await svc.listarParaStaff());

  // Martes 6/10/2026: Teens A2 tiene clase martes 18:30 (AR).
  console.log("PROFESOR 18:00 AR (antes de la clase):", await svc.listarParaProfesor(profe.id, enAr("2026-10-06T21:00:00Z")));
  console.log("PROFESOR 19:00 AR (clase empezada):", await svc.listarParaProfesor(profe.id, enAr("2026-10-06T22:00:00Z")));
  // 23:30 AR del martes = miércoles en UTC: debe seguir contando como martes.
  console.log("PROFESOR 23:30 AR:", await svc.listarParaProfesor(profe.id, enAr("2026-10-07T02:30:00Z")));

  console.log("PADRE p1 (2/10, la cuota de octubre vence en ≤5 días):", await svc.listarParaPadre(padre.id, enAr("2026-10-06T15:00:00Z")));

  const otroPadre = await prisma.padre.findFirstOrThrow({ where: { usuario: { email: "p2@prueba.babylon.test" } } });
  const deP1 = (await svc.listarParaPadre(padre.id)).map((n) => n.texto).join(" | ");
  const hijosP2 = await prisma.alumno.findMany({ where: { padreId: otroPadre.id }, select: { nombre: true } });
  console.log("p1 no ve hijos de p2:", hijosP2.every((h) => !deP1.includes(h.nombre)) ? "ok" : "MAL");
  await prisma.$disconnect();
  process.exit(0);
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `cd server && pnpm exec tsx $SCRATCH/verificar-notificaciones.ts`
Expected: error de TypeScript/runtime: `container.notificacionService` no existe.

- [ ] **Step 3: Fecha de publicación**

En `schema.prisma`, en `model Evaluacion` y en `model NotaCierre`, debajo de `estado`:

```prisma
  // Cuándo pasó a "publicada" (null en las publicadas antes de que existiera el campo).
  publicadaEn DateTime?
```

Run: `pnpm prisma migrate dev --name publicada_en`

En `evaluacion.entity.ts` y `notaCierre.entity.ts`: `publicadaEn?: Date | null;`.

En `calificacion.service.ts`:

```ts
    return this.calificacionRepo.actualizarEvaluacion(evaluacionId, {
      ...evaluacion,
      estado: "publicada",
      publicadaEn: evaluacion.publicadaEn ?? new Date(),
    });
```

```ts
    return this.calificacionRepo.guardarNotaCierre({
      ...notaCierre,
      estado: "publicada",
      publicadaEn: notaCierre.publicadaEn ?? new Date(),
    });
```

Leer `guardarNotaCierre` y `actualizarEvaluacion` en `calificacion.repository.prisma.ts`: si arman el `data` campo por campo, agregar `publicadaEn`.

- [ ] **Step 4: Service** — crear `server/src/modules/notificaciones/notificacion.service.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { fechaHoraEnArgentina, inicioDeHoyUtc } from "../../core/fechas";
import type { ReporteService } from "../reportes/reporte.service";

// Avisos de la campana: se derivan del estado actual (algo pendiente o vencido
// que hay que atender), no de un historial de eventos — no existe "leído". Igual
// que reportes/, es una composición de lectura sobre otros módulos, así que
// consulta Prisma directo. Todo "hoy" se calcula en hora de Argentina.

export type TonoNotificacion = "danger" | "warning" | "info";

export interface Notificacion {
  id: string;
  tono: TonoNotificacion;
  texto: string;
  ruta: string;
}

const MAX_NOTIFICACIONES = 10;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_AVISO_VENCIMIENTO = 5;
const DIAS_NOVEDADES = 7;
const ORDEN_TONO: Record<TonoNotificacion, number> = { danger: 0, warning: 1, info: 2 };
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PERIODOS: Record<string, string> = { julio: "1° Cierre", noviembre: "2° Cierre" };

const formatMonto = (monto: number) => `$${monto.toLocaleString("es-AR")}`;
const formatDiaMes = (fecha: Date) => `${String(fecha.getUTCDate()).padStart(2, "0")}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;

function ordenar(lista: Notificacion[]): Notificacion[] {
  return lista.sort((a, b) => ORDEN_TONO[a.tono] - ORDEN_TONO[b.tono]).slice(0, MAX_NOTIFICACIONES);
}

export class NotificacionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly reporteService: ReporteService,
  ) {}

  // Admin/Secretario: lo mismo que mostraba la campana derivándolo en el client.
  async listarParaStaff(): Promise<Notificacion[]> {
    const resumen = await this.reporteService.obtenerResumenDashboard();
    const lista: Notificacion[] = resumen.cuotasVencidas.slice(0, 5).map((c) => ({
      id: `cuota-${c.alumnoId}-${c.mes}-${c.anio}`,
      tono: "danger",
      texto: `Cuota vencida: ${c.alumnoNombre} — ${formatMonto(c.monto)}`,
      ruta: "/cuotas",
    }));
    if (resumen.documentacionPendienteCount > 0) {
      const n = resumen.documentacionPendienteCount;
      lista.push({
        id: "documentacion-pendiente",
        tono: "warning",
        texto: `${n} alumno${n !== 1 ? "s" : ""} con autorización de imagen pendiente`,
        ruta: "/alumnos",
      });
    }
    for (const e of resumen.proximasEvaluaciones.slice(0, 3)) {
      lista.push({ id: `evaluacion-${e.evaluacionId}`, tono: "info", texto: `Evaluación próxima: ${e.nombre} — ${e.cursoNombre}`, ruta: "/reportes" });
    }
    return ordenar(lista);
  }

  async listarParaProfesor(profesorId: string, ahora: Date = new Date()): Promise<Notificacion[]> {
    const cursos = await this.prisma.curso.findMany({
      where: { profesorId, estado: "activo", ciclo: { activo: true } },
      include: { horarios: true },
    });
    const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]));
    const cursoIds = cursos.map((c) => c.id);
    const lista: Notificacion[] = [];

    // Clase de hoy (hora de Argentina) que ya empezó y no tiene asistencia.
    const { hora, minuto } = fechaHoraEnArgentina(ahora);
    const ahoraHHMM = `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    const hoy = inicioDeHoyUtc(ahora);
    const diaSemana = DIAS_SEMANA[hoy.getUTCDay()];
    for (const curso of cursos) {
      const clase = curso.horarios.find((h) => h.diaSemana === diaSemana && h.horaInicio <= ahoraHHMM);
      if (!clase) continue;
      const tomada = await this.prisma.asistencia.count({
        where: { cursoId: curso.id, fecha: { gte: hoy, lt: new Date(hoy.getTime() + DIA_MS) } },
      });
      if (tomada === 0) {
        lista.push({ id: `asistencia-${curso.id}`, tono: "warning", texto: `Falta tomar asistencia de ${curso.nombre} (hoy ${clase.horaInicio})`, ruta: "/asistencia" });
      }
    }

    // Evaluaciones con notas cargadas que siguen en borrador.
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: { cursoId: { in: cursoIds }, estado: "borrador", calificaciones: { some: {} } },
    });
    for (const e of evaluaciones) {
      lista.push({ id: `evaluacion-borrador-${e.id}`, tono: "info", texto: `"${e.nombre}" (${nombreCurso.get(e.cursoId)}) tiene notas cargadas y sigue sin publicar`, ruta: "/calificaciones" });
    }

    // Notas de cierre en borrador, una por curso y período.
    const cierres = await this.prisma.notaCierre.groupBy({
      by: ["cursoId", "periodo"],
      where: { cursoId: { in: cursoIds }, estado: "borrador" },
    });
    for (const c of cierres) {
      lista.push({ id: `cierre-${c.cursoId}-${c.periodo}`, tono: "info", texto: `Notas de cierre de ${nombreCurso.get(c.cursoId)} (${PERIODOS[c.periodo] ?? c.periodo}) en borrador`, ruta: "/calificaciones" });
    }
    return ordenar(lista);
  }

  async listarParaPadre(padreId: string, ahora: Date = new Date()): Promise<Notificacion[]> {
    const hijos = await this.prisma.alumno.findMany({ where: { padreId, estado: "activo" }, select: { id: true, nombre: true } });
    const nombreHijo = new Map(hijos.map((h) => [h.id, h.nombre]));
    const ids = hijos.map((h) => h.id);
    const hoy = inicioDeHoyUtc(ahora);
    const desde = new Date(ahora.getTime() - DIAS_NOVEDADES * DIA_MS);
    const lista: Notificacion[] = [];

    const cuotas = await this.prisma.cuota.findMany({ where: { alumnoId: { in: ids }, estado: { in: ["vencida", "pendiente"] } } });
    for (const c of cuotas) {
      const mes = `${MESES[c.mes - 1]} ${c.anio}`;
      if (c.estado === "vencida") {
        lista.push({ id: `cuota-${c.id}`, tono: "danger", texto: `Cuota de ${mes} de ${nombreHijo.get(c.alumnoId)} vencida — ${formatMonto(c.montoFinal)}`, ruta: "/mis-hijos/cuotas" });
        continue;
      }
      const dias = Math.round((c.vencimiento.getTime() - hoy.getTime()) / DIA_MS);
      if (dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO) {
        lista.push({ id: `cuota-${c.id}`, tono: "warning", texto: `La cuota de ${mes} de ${nombreHijo.get(c.alumnoId)} vence el ${formatDiaMes(c.vencimiento)}`, ruta: "/mis-hijos/cuotas" });
      }
    }

    const conDocPendiente = await this.prisma.documento.findMany({
      where: { alumnoId: { in: ids }, estado: "pendiente" },
      distinct: ["alumnoId"],
      select: { alumnoId: true },
    });
    for (const d of conDocPendiente) {
      lista.push({ id: `documentacion-${d.alumnoId}`, tono: "warning", texto: `${nombreHijo.get(d.alumnoId)} tiene documentación pendiente`, ruta: "/mis-hijos/documentacion" });
    }

    // Novedades de los últimos 7 días. Nunca borradores: solo lo publicado.
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: { estado: "publicada", publicadaEn: { gte: desde }, calificaciones: { some: { alumnoId: { in: ids } } } },
      include: { calificaciones: { where: { alumnoId: { in: ids } }, select: { alumnoId: true } } },
    });
    for (const e of evaluaciones) {
      for (const cal of e.calificaciones) {
        lista.push({ id: `nota-${e.id}-${cal.alumnoId}`, tono: "info", texto: `Nueva nota de ${nombreHijo.get(cal.alumnoId)}: ${e.nombre}`, ruta: "/mis-hijos/calificaciones" });
      }
    }
    const cierres = await this.prisma.notaCierre.findMany({ where: { alumnoId: { in: ids }, estado: "publicada", publicadaEn: { gte: desde } } });
    for (const c of cierres) {
      lista.push({ id: `cierre-${c.id}`, tono: "info", texto: `Nota de cierre (${PERIODOS[c.periodo] ?? c.periodo}) de ${nombreHijo.get(c.alumnoId)} publicada`, ruta: "/mis-hijos/calificaciones" });
    }
    const observaciones = await this.prisma.observacion.findMany({ where: { alumnoId: { in: ids }, fecha: { gte: desde } } });
    for (const o of observaciones) {
      lista.push({ id: `observacion-${o.id}`, tono: "info", texto: `Nueva observación sobre ${nombreHijo.get(o.alumnoId)}`, ruta: "/mis-hijos" });
    }
    return ordenar(lista);
  }
}
```

- [ ] **Step 5: Controller y rutas**

`notificacion.controller.ts` (la rama por rol vive en el controller, como `GET /api/cursos`):

```ts
import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import type { ProfesorService } from "../profesores/profesor.service";
import type { NotificacionService } from "./notificacion.service";

export class NotificacionController {
  constructor(
    private readonly notificacionService: NotificacionService,
    private readonly padreService: PadreService,
    private readonly profesorService: ProfesorService,
  ) {}

  listar = async (req: Request, res: Response) => {
    const { sub, rol } = req.auth!;
    if (rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(sub);
      res.status(200).json(await this.notificacionService.listarParaPadre(padre.id));
      return;
    }
    if (rol === "profesor") {
      const profesor = await this.profesorService.buscarPorUsuarioId(sub);
      res.status(200).json(await this.notificacionService.listarParaProfesor(profesor.id));
      return;
    }
    res.status(200).json(await this.notificacionService.listarParaStaff());
  };
}
```

`notificacion.routes.ts`:

```ts
import { Router } from "express";
import { authMiddleware } from "../../core/middlewares/authMiddleware";
import type { NotificacionController } from "./notificacion.controller";

export function notificacionRoutes(controller: NotificacionController): Router {
  const router = Router();
  // Todos los roles autenticados; cada uno recibe solo lo suyo (ver controller).
  router.get("/", authMiddleware, controller.listar);
  return router;
}
```

`container.ts`: `const notificacionService = new NotificacionService(prisma, reporteService);` y en el objeto exportado `notificacionService,` y `notificacionController: new NotificacionController(notificacionService, padreService, profesorService),`.
`server.ts`: `app.use("/api/notificaciones", notificacionRoutes(container.notificacionController));`.

- [ ] **Step 6: Actualizar el spec** — en la sección "Server — módulo `notificaciones/`": la respuesta es `{ id, tono, texto, ruta }[]` (sin `tipo`), y agregar: "Para las novedades del padre, `Evaluacion` y `NotaCierre` ganan `publicadaEn DateTime?`, que se completa al publicar; lo publicado antes de este cambio no genera aviso."

- [ ] **Step 7: Verificar**

Run: `cd server && pnpm typecheck`, reiniciar el server, `pnpm exec tsx $SCRATCH/verificar-notificaciones.ts`, y para cada uno de los 4 roles `curl -s localhost:4000/api/notificaciones -H "authorization: Bearer $TOKEN"`.
Expected:
- STAFF: los mismos avisos que hoy muestra la campana para admin.
- PROFESOR 18:00 → sin aviso de asistencia de Teens A2; 19:00 y 23:30 → con aviso "Falta tomar asistencia de Teens A2 (hoy 18:30)" (si no hay asistencia de esa fecha; confirmarlo con `select count(*) from "Asistencia" where "cursoId"=... and fecha='2026-10-06'`).
- PADRE p1: avisos de cuotas coherentes con `select estado, mes, vencimiento from "Cuota" where "alumnoId" in (hijos de p1)`; ningún texto con borradores; "p1 no ve hijos de p2: ok".
- Los 4 `curl` → 200 con un array de ≤10 elementos.

- [ ] **Step 8: Commit**

```bash
git add server/prisma server/src docs/superpowers/specs
git commit -m "Notificaciones por rol (GET /api/notificaciones) y fecha de publicación de notas"
```

### Task 4: Client — campana para los cuatro roles

**Files:**
- Create: `client/src/features/notificaciones/types.ts`, `notificacionService.ts`, `hooks/useNotificaciones.ts`
- Modify: `client/src/core/components/layout/NotificationBell.tsx`
- Test: `$SCRATCH/e2e-campana.js`

**Interfaces:**
- Consumes: `GET /api/notificaciones` → `Notificacion[]` (Task 3).

- [ ] **Step 1: Escribir la prueba** `$SCRATCH/e2e-campana.js`: para cada cuenta (`admin@babylon.test`/Administrador, `secretario@babylon.test`, `profesor@babylon.test`, `p1@prueba.babylon.test`), iniciar sesión, hacer clic en `button[title="Notificaciones"]`, leer los textos del panel y compararlos con `GET /api/notificaciones` de la misma cuenta (pedido con `fetch` desde la página usando el token guardado); luego hacer clic en el primer aviso y verificar que la URL coincide con su `ruta`; registrar errores de consola.

```js
const { chromium } = require("playwright-core");
const REAL = "http://localhost:5173";
const CUENTAS = [["admin@babylon.test", "admin1234", "Administrador"], ["secretario@babylon.test", "secretario1234"], ["profesor@babylon.test", "profesor1234"], ["p1@prueba.babylon.test", "prueba1234"]];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  for (const [email, pass, rol] of CUENTAS) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
    await p.locator('input[type="email"]').fill(email); await p.locator('input[type="password"]').fill(pass);
    await p.locator('button[type="submit"]').click(); if (rol) await p.getByRole("button", { name: rol }).click();
    await p.waitForURL(/\/(dashboard|cursos|mis-hijos)/); await p.waitForTimeout(1200);
    const api = await p.evaluate(async () => {
      const s = JSON.parse(sessionStorage.getItem("babylon-session") ?? localStorage.getItem("babylon-session")).state;
      const r = await fetch("http://localhost:4000/api/notificaciones", { headers: { Authorization: `Bearer ${s.token}` } });
      return r.json();
    });
    await p.locator('button[title="Notificaciones"]').click(); await p.waitForTimeout(400);
    const textos = await p.locator('[data-notificacion]').allTextContents();
    const iguales = JSON.stringify(textos) === JSON.stringify(api.map((n) => n.texto));
    let navega = "sin avisos";
    if (api.length > 0) { await p.locator('[data-notificacion]').first().click(); await p.waitForTimeout(800); navega = p.url().endsWith(api[0].ruta) ? "ok" : "MAL: " + p.url(); }
    console.log(`${email}: ${api.length} avisos, panel=api ${iguales ? "ok" : "MAL"}, clic → ${navega}, errores ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await b.close();
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `node $SCRATCH/e2e-campana.js`
Expected: para profesor y padre el panel no coincide con la API (hoy la campana está vacía para esos roles) y no existe `[data-notificacion]`.

- [ ] **Step 3: Feature `notificaciones` del client**

`types.ts`:

```ts
export type TonoNotificacion = "danger" | "warning" | "info";

export interface Notificacion {
  id: string;
  tono: TonoNotificacion;
  texto: string;
  // Pantalla donde se resuelve el aviso.
  ruta: string;
}
```

`notificacionService.ts`:

```ts
import { apiClient } from "@/core/lib/apiClient";
import type { Notificacion } from "./types";

export const notificacionService = {
  listar: () => apiClient.get<Notificacion[]>("/api/notificaciones"),
};
```

`hooks/useNotificaciones.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

const CINCO_MINUTOS = 5 * 60 * 1000;

export function useNotificaciones() {
  return useQuery({
    queryKey: ["notificaciones"],
    queryFn: notificacionService.listar,
    refetchInterval: CINCO_MINUTOS,
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 4: Reescribir `NotificationBell.tsx`** — misma estructura visual de hoy (botón, punto, panel con borde), pero los items vienen de `useNotificaciones()`:
  - Quitar `useAuth`, `useResumenDashboard`, `formatMonto` y el `useMemo` que armaba la lista.
  - Íconos por tono: `const ICONO = { danger: AlertCircle, warning: Clock, info: Info } as const;` (de `lucide-react`).
  - Cada item: `<button data-notificacion key={n.id} onClick={() => { navigate(n.ruta); setAbierto(false); }} ...>` con el ícono y `n.texto`.
  - Estado vacío único: `"No hay nada pendiente."`.
  - El punto rojo: `(notificaciones?.length ?? 0) > 0`.

- [ ] **Step 5: Verificar**

Run: `cd client && pnpm typecheck && pnpm lint`, luego `node $SCRATCH/e2e-campana.js`
Expected: las 4 cuentas con "panel=api ok", clic "ok" (o "sin avisos") y sin errores de consola.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "Campana de notificaciones para los cuatro roles desde /api/notificaciones"
```

## Entrega 3 — Recuperación de contraseña por correo

### Task 5: Server — límites de pedidos del login y `TRUST_PROXY`

**Files:**
- Modify: `server/package.json` (dependencia `express-rate-limit`)
- Create: `server/src/core/middlewares/limitesDePedidos.ts`
- Modify: `server/src/core/config.ts`, `server/.env.example`, `server/src/server.ts`
- Modify: `server/src/modules/usuarios/usuario.routes.ts`
- Modify: `server/src/modules/usuarios/usuario.repository.prisma.ts` (`findByEmail` sin distinguir mayúsculas)
- Test: `$SCRATCH/verificar-limites-login.sh`

**Interfaces:**
- Produces: `limiteLoginPorIp`, `limiteLoginPorCuenta`, `limiteOlvideContrasena`, `limiteRestablecerContrasena` (middlewares de `limitesDePedidos.ts`); `config.TRUST_PROXY`.

- [ ] **Step 1: Escribir la verificación** `$SCRATCH/verificar-limites-login.sh` (reiniciar el server antes: los contadores viven en memoria):

```bash
#!/usr/bin/env bash
API=localhost:4000/api/auth/login
intento() { curl -s -o /dev/null -w "%{http_code}" -X POST $API -H 'content-type: application/json' -d "$1"; }
echo -n "5 fallidos misma cuenta: "; for i in 1 2 3 4 5; do echo -n "$(intento '{"email":"p5@prueba.babylon.test","password":"mala"}') "; done; echo "(esperado 401 x5)"
echo "6.º misma cuenta: $(intento '{"email":"p5@prueba.babylon.test","password":"mala"}') (esperado 429)"
echo "misma cuenta con mayúsculas y espacios: $(intento '{"email":" P5@Prueba.Babylon.TEST ","password":"mala"}') (esperado 429)"
echo "otra cuenta desde la misma IP: $(intento '{"email":"p4@prueba.babylon.test","password":"mala"}') (esperado 401)"
echo "login correcto de otra cuenta: $(intento '{"email":"p3@prueba.babylon.test","password":"prueba1234"}') (esperado 200)"
echo "primer paso multi-rol (no cuenta): $(intento '{"email":"admin@babylon.test","password":"admin1234"}') (esperado 200)"
echo -n "fallidos con emails distintos: "; for i in $(seq 1 14); do echo -n "$(intento "{\"email\":\"nadie$i@x.test\",\"password\":\"x\"}") "; done; echo
echo "21.º fallido de la IP: $(intento '{"email":"nadie99@x.test","password":"x"}') (esperado 429)"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/verificar-limites-login.sh`
Expected: nunca aparece 429 (no hay límites).

- [ ] **Step 3: Instalar la dependencia**

Run: `cd server && pnpm add express-rate-limit`
Revisar en `node_modules/express-rate-limit` que exporta `ipKeyGenerator` y el nombre exacto de la opción de límite (`limit` en v7+); ajustar el código del paso siguiente si difiere.

- [ ] **Step 4: Middlewares** — crear `server/src/core/middlewares/limitesDePedidos.ts`:

```ts
import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Límites de pedidos por IP, en memoria del proceso: alcanzan con un solo
// servidor. Con varias instancias habría que pasarlos a un almacén compartido.
const QUINCE_MINUTOS = 15 * 60 * 1000;

function responderDemasiados(_req: Request, res: Response) {
  res.status(429).json({ error: "Demasiados intentos, probá de nuevo en unos minutos" });
}

function emailDelPedido(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

const base = { windowMs: QUINCE_MINUTOS, standardHeaders: "draft-8" as const, legacyHeaders: false, handler: responderDemasiados };

// Fuerza bruta contra una cuenta: la clave combina IP y email, así un padre
// que se equivoca no bloquea a otro que comparte su red (wifi, CGNAT).
export const limiteLoginPorCuenta = rateLimit({
  ...base,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${emailDelPedido(req)}`,
});

// Techo general contra quien prueba muchas cuentas desde una IP.
export const limiteLoginPorIp = rateLimit({ ...base, limit: 20, skipSuccessfulRequests: true });

export const limiteOlvideContrasena = rateLimit({ ...base, limit: 5 });
export const limiteRestablecerContrasena = rateLimit({ ...base, limit: 5 });
```

- [ ] **Step 5: Aplicarlos y `TRUST_PROXY`**

`usuario.routes.ts`: `router.post("/login", limiteLoginPorIp, limiteLoginPorCuenta, controller.login);` (import desde `../../core/middlewares/limitesDePedidos`).

`config.ts`:

```ts
  // Detrás de un proxy o plataforma de despliegue: "true", la cantidad de
  // saltos ("1") o "false". Sin esto todos los usuarios compartirían la IP del
  // proxy y se bloquearían entre sí en los límites de pedidos.
  TRUST_PROXY: z.string().default("false"),
```

`.env.example`:

```
# Detrás de un proxy (Render, Railway, Nginx…): "1" o "true". En local, "false".
TRUST_PROXY="false"
```

`server.ts`, después de `const app = express();`:

```ts
const trustProxy = config.TRUST_PROXY;
app.set("trust proxy", trustProxy === "true" ? true : trustProxy === "false" ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
```

- [ ] **Step 6: Email sin distinguir mayúsculas** — en `usuario.repository.prisma.ts`, `findByEmail`:

```ts
  async findByEmail(email: string, tx?: unknown): Promise<Usuario | null> {
    const fila = await this.client(tx).usuario.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
    return fila ? aEntidad(fila) : null;
  }
```

(conservar la forma de retorno que ya tenga el método).

- [ ] **Step 7: Verificar**

Run: `cd server && pnpm typecheck`, reiniciar el server, `bash $SCRATCH/verificar-limites-login.sh`
Expected: cada línea coincide con su "esperado"; los 14 fallidos con emails distintos devuelven 401 hasta llegar al techo y el 21.º fallido de la IP devuelve 429.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml server/src server/.env.example
git commit -m "Límites de pedidos en el login (IP + email e IP) y TRUST_PROXY"
```

### Task 6: Server — envío de correos (puerto `Mailer`, SMTP y consola)

**Files:**
- Modify: `server/package.json` (`nodemailer`, `@types/nodemailer` como dev)
- Modify: `server/src/core/ports.ts`
- Create: `server/src/core/adapters/ConsoleMailer.ts`, `server/src/core/adapters/SmtpMailer.ts`
- Modify: `server/src/core/config.ts`, `server/.env.example`, `server/src/container.ts`
- Test: `$SCRATCH/verificar-mailer.ts`

**Interfaces:**
- Produces: `MensajeCorreo`, `Mailer` (`core/ports.ts`); `ConsoleMailer`, `SmtpMailer`; `config.SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS/MAIL_FROM/APP_URL`; `container.mailer`.

- [ ] **Step 1: Escribir la verificación** `$SCRATCH/verificar-mailer.ts`:

```ts
import { container } from "../src/container";

(async () => {
  console.log("adaptador:", container.mailer.constructor.name, "(esperado ConsoleMailer sin SMTP_HOST)");
  await container.mailer.enviar({ para: "alguien@ejemplo.test", asunto: "Prueba", texto: "Hola\nEnlace: http://x/y", html: "<p>Hola</p>" });
  process.exit(0);
})();
```

y la verificación de producción sin SMTP:

```bash
cd server && NODE_ENV=production pnpm exec tsx -e 'require("./src/core/config")' 2>&1 | tail -3
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `cd server && pnpm exec tsx $SCRATCH/verificar-mailer.ts`
Expected: `container.mailer` no existe.

- [ ] **Step 3: Dependencias**

Run: `cd server && pnpm add nodemailer && pnpm add -D @types/nodemailer`

- [ ] **Step 4: Puerto** — en `core/ports.ts`:

```ts
export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

// Envío de correos. container.ts elige el adaptador: SMTP real si está
// configurado, consola en desarrollo.
export interface Mailer {
  enviar(mensaje: MensajeCorreo): Promise<void>;
}
```

- [ ] **Step 5: Adaptadores**

`core/adapters/ConsoleMailer.ts`:

```ts
import type { Mailer, MensajeCorreo } from "../ports";

// Desarrollo: no envía nada, escribe el correo en la consola del server
// (ahí se lee, por ejemplo, el enlace de recuperación de contraseña).
export class ConsoleMailer implements Mailer {
  async enviar({ para, asunto, texto }: MensajeCorreo): Promise<void> {
    console.log(`[correo] para: ${para}\n[correo] asunto: ${asunto}\n${texto}\n[correo] ———`);
  }
}
```

`core/adapters/SmtpMailer.ts`:

```ts
import nodemailer, { type Transporter } from "nodemailer";
import type { Mailer, MensajeCorreo } from "../ports";

export interface OpcionesSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// Cualquier servidor SMTP: Gmail del instituto (con contraseña de aplicación),
// Resend, Brevo, el del hosting, etc.
export class SmtpMailer implements Mailer {
  private readonly transporte: Transporter;

  constructor(private readonly opciones: OpcionesSmtp) {
    this.transporte = nodemailer.createTransport({
      host: opciones.host,
      port: opciones.port,
      secure: opciones.secure,
      auth: { user: opciones.user, pass: opciones.pass },
    });
  }

  async enviar({ para, asunto, texto, html }: MensajeCorreo): Promise<void> {
    await this.transporte.sendMail({ from: this.opciones.from, to: para, subject: asunto, text: texto, html });
  }
}
```

- [ ] **Step 6: Configuración** — en `config.ts`, agregar al `envSchema`:

```ts
  // Envío de correos (recuperación de contraseña). Sin SMTP_HOST, los correos se
  // escriben en la consola del server; en producción es obligatorio.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Babylon English Institute <no-reply@babylon.local>"),
  // Base de los enlaces que van en los correos (la URL del client).
  APP_URL: z.string().optional(),
```

y convertir el schema en:

```ts
const envSchema = z
  .object({ /* ...campos... */ })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      for (const clave of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
        if (!env[clave]) ctx.addIssue({ code: "custom", path: [clave], message: `${clave} es requerida en producción` });
      }
    }
  })
  .transform((env) => ({ ...env, APP_URL: env.APP_URL ?? env.CORS_ORIGIN }));
```

`.env.example`:

```
# Correo (recuperación de contraseña). Vacío en desarrollo: los correos se
# escriben en la consola del server. Obligatorio en producción.
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="Babylon English Institute <no-reply@babylon.local>"
# URL del client, para armar los enlaces de los correos.
APP_URL="http://localhost:5173"
```

Ojo: `SMTP_HOST=""` vacío debe tratarse como no configurado: usar `z.string().optional().transform((v) => v || undefined)` en `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`.

- [ ] **Step 7: Elegir adaptador** — en `container.ts`:

```ts
const mailer: Mailer = config.SMTP_HOST
  ? new SmtpMailer({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      user: config.SMTP_USER ?? "",
      pass: config.SMTP_PASS ?? "",
      from: config.MAIL_FROM,
    })
  : new ConsoleMailer();
```

y exportar `mailer` en `container`.

- [ ] **Step 8: Verificar**

Run: `cd server && pnpm typecheck && pnpm exec tsx $SCRATCH/verificar-mailer.ts`, luego la línea de producción sin SMTP.
Expected: "adaptador: ConsoleMailer" y el correo impreso en la consola; en producción sin SMTP, error "Configuración de entorno inválida" que nombra `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`.

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml server/src server/.env.example
git commit -m "Envío de correos: puerto Mailer con adaptadores SMTP y consola"
```

### Task 7: Server — tokens de recuperación y endpoints

**Files:**
- Modify: `server/prisma/schema.prisma` (model `TokenRecuperacion`, relación en `Usuario`) + migración
- Create: `server/src/modules/usuarios/tokenRecuperacion.entity.ts`, `server/src/modules/usuarios/correoRecuperacion.ts`
- Modify: `server/src/modules/usuarios/usuario.repository.ts`, `usuario.repository.prisma.ts`, `usuario.schema.ts`, `usuario.service.ts`, `usuario.controller.ts`, `usuario.routes.ts`
- Modify: `server/src/container.ts` (pasar `mailer` a `UsuarioService`)
- Test: `$SCRATCH/verificar-recuperacion.sh`

**Interfaces:**
- Consumes: `Mailer`, `config.APP_URL` (Task 6); `limiteOlvideContrasena`, `limiteRestablecerContrasena` (Task 5); `contrasenaCambiadaEn` (Task 1).
- Produces: `POST /api/auth/olvide-contrasena` `{ email }` → 200 `{ mensaje }`; `POST /api/auth/restablecer-contrasena` `{ token, password }` → 204 | 400; `UsuarioService.solicitarRecuperacion(email, ahora?)`, `UsuarioService.restablecerContrasena(token, password, ahora?)`.

- [ ] **Step 1: Escribir la verificación** `$SCRATCH/verificar-recuperacion.sh` (server corriendo con `ConsoleMailer` y su salida en `$SCRATCH/server.log`; reiniciar el server antes):

```bash
#!/usr/bin/env bash
API=localhost:4000/api/auth
LOG=$SCRATCH/server.log
post() { curl -s -w " [%{http_code}]" -X POST $API/$1 -H 'content-type: application/json' -d "$2"; echo; }
enlace() { grep -o 'restablecer-contrasena?token=[A-Za-z0-9_-]*' $LOG | tail -1 | sed 's/.*token=//'; }
q() { docker exec babylon-postgres psql -U babylon -d babylon -Atc "$1"; }
PID=$(q "select id from \"Usuario\" where email='p6@prueba.babylon.test'")
VIEJO=$(curl -s -X POST $API/login -H 'content-type: application/json' -d '{"email":"p6@prueba.babylon.test","password":"prueba1234","recordarme":true}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "inexistente: $(post olvide-contrasena '{"email":"nadie@x.test"}')"
echo "existente:   $(post olvide-contrasena '{"email":" P6@prueba.babylon.test "}')   (mismo mensaje y 200)"
sleep 1; T1=$(enlace); echo "token en el log: ${T1:0:8}… (no vacío)"
echo "hash guardado, no el token: $(q "select count(*) from \"TokenRecuperacion\" where hash='$T1'") (esperado 0)"
echo "2.º pedido antes de 60 s: $(post olvide-contrasena '{"email":"p6@prueba.babylon.test"}')"
echo "tokens de la cuenta: $(q "select count(*) from \"TokenRecuperacion\" where \"usuarioId\"='$PID'") (esperado 1: no se creó otro)"
echo "token inventado: $(post restablecer-contrasena '{"token":"inventado","password":"nueva12345"}') (esperado 400)"
echo "contraseña corta: $(post restablecer-contrasena "{\"token\":\"$T1\",\"password\":\"corta\"}") (esperado 400)"
# dos usos simultáneos del mismo enlace: solo uno gana
( post restablecer-contrasena "{\"token\":\"$T1\",\"password\":\"nueva12345\"}" > $SCRATCH/r1 ) & ( post restablecer-contrasena "{\"token\":\"$T1\",\"password\":\"otra123456\"}" > $SCRATCH/r2 ) & wait
echo "uso simultáneo: $(cat $SCRATCH/r1 $SCRATCH/r2 | grep -o '\[[0-9]*\]' | sort | tr '\n' ' ') (esperado [204] [400])"
echo "sesión anterior: $(curl -s -o /dev/null -w '%{http_code}' localhost:4000/api/alumnos/mios -H "authorization: Bearer $VIEJO") (esperado 401)"
NUEVA=$(grep -l '\[204\]' $SCRATCH/r1 >/dev/null && echo nueva12345 || echo otra123456)
echo "login con la nueva: $(curl -s -o /dev/null -w '%{http_code}' -X POST $API/login -H 'content-type: application/json' -d "{\"email\":\"p6@prueba.babylon.test\",\"password\":\"$NUEVA\"}") (esperado 200)"
echo "reusar el enlace: $(post restablecer-contrasena "{\"token\":\"$T1\",\"password\":\"otra999999\"}") (esperado 400)"
# vencido: forzar expiración de un enlace nuevo
q "update \"TokenRecuperacion\" set \"creadoEn\"=now()-interval '2 minutes' where \"usuarioId\"='$PID'" >/dev/null
post olvide-contrasena '{"email":"p6@prueba.babylon.test"}' >/dev/null; sleep 1; T2=$(enlace)
q "update \"TokenRecuperacion\" set \"expiraEn\"=now()-interval '1 second' where \"usadoEn\" is null and \"usuarioId\"='$PID'" >/dev/null
echo "enlace vencido: $(post restablecer-contrasena "{\"token\":\"$T2\",\"password\":\"nueva12345\"}") (esperado 400)"
# Hasta acá la IP hizo 4 pedidos a olvide-contrasena. El bloque siguiente necesita 2 más
# y el límite por IP (5) taparía el límite por cuenta: reiniciar el server antes de seguir.
read -p "Reiniciá el server (vacía los contadores por IP) y apretá Enter… "
# 4.º pedido en una hora: no se envía
q "update \"TokenRecuperacion\" set \"creadoEn\"=now()-interval '2 minutes' where \"usuarioId\"='$PID'" >/dev/null
post olvide-contrasena '{"email":"p6@prueba.babylon.test"}' >/dev/null
q "update \"TokenRecuperacion\" set \"creadoEn\"=now()-interval '2 minutes' where \"usuarioId\"='$PID'" >/dev/null
ANTES=$(q "select count(*) from \"TokenRecuperacion\" where \"usuarioId\"='$PID'")
post olvide-contrasena '{"email":"p6@prueba.babylon.test"}' >/dev/null
echo "4.º pedido en la hora: tokens $ANTES → $(q "select count(*) from \"TokenRecuperacion\" where \"usuarioId\"='$PID'") (esperado sin cambio)"
echo -n "límite por IP (pedidos 3 a 6 desde esta IP tras el reinicio): "; for i in 3 4 5 6; do echo -n "$(post olvide-contrasena "{\"email\":\"nadie$i@x.test\"}" | grep -o '\[[0-9]*\]') "; done; echo "(esperado [200] [200] [200] [429])"
# limpieza: contraseña de prueba original y tokens
HASH=$(cd server && node -e "require('bcrypt').hash('prueba1234',10).then(console.log)")
q "update \"Usuario\" set \"passwordHash\"='$HASH', \"contrasenaCambiadaEn\"=null where id='$PID'; delete from \"TokenRecuperacion\" where \"usuarioId\"='$PID'" >/dev/null
echo "limpieza hecha"
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `bash $SCRATCH/verificar-recuperacion.sh`
Expected: `olvide-contrasena` responde 404 (la ruta no existe).

- [ ] **Step 3: Modelo** — en `schema.prisma`:

```prisma
// Enlace de recuperación de contraseña. Se guarda solo el SHA-256 del token
// (el token viaja únicamente en el correo). Vence a la hora y es de un solo uso.
model TokenRecuperacion {
  id        String    @id
  usuarioId String
  hash      String    @unique
  creadoEn  DateTime
  expiraEn  DateTime
  usadoEn   DateTime?

  usuario Usuario @relation(fields: [usuarioId], references: [id])

  @@index([usuarioId, creadoEn])
}
```

y en `model Usuario`: `tokensRecuperacion TokenRecuperacion[]`.

Run: `pnpm prisma migrate dev --name token_recuperacion`

`tokenRecuperacion.entity.ts`:

```ts
// Entidad secundaria de usuarios/: enlace de recuperación de contraseña.
export interface TokenRecuperacion {
  id: string;
  usuarioId: string;
  // SHA-256 (hex) del token; el token en sí nunca se guarda.
  hash: string;
  creadoEn: Date;
  expiraEn: Date;
  usadoEn: Date | null;
}
```

- [ ] **Step 4: Repositorio** — en `usuario.repository.ts`:

```ts
  crearTokenRecuperacion(token: TokenRecuperacion, tx?: unknown): Promise<TokenRecuperacion>;
  findTokenRecuperacionPorHash(hash: string, tx?: unknown): Promise<TokenRecuperacion | null>;
  findTokensRecuperacionDesde(usuarioId: string, desde: Date, tx?: unknown): Promise<TokenRecuperacion[]>;
  // Marca usados los enlaces aún sin usar de la cuenta (pedir uno nuevo o cambiar la contraseña invalida los anteriores).
  invalidarTokensRecuperacion(usuarioId: string, ahora: Date, tx?: unknown): Promise<void>;
  // Marca usado un enlace solo si todavía no lo estaba; false si otro pedido lo usó primero.
  marcarTokenRecuperacionUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean>;
```

En `usuario.repository.prisma.ts`:

```ts
  async crearTokenRecuperacion(token: TokenRecuperacion, tx?: unknown): Promise<TokenRecuperacion> {
    return this.client(tx).tokenRecuperacion.create({ data: token });
  }

  async findTokenRecuperacionPorHash(hash: string, tx?: unknown): Promise<TokenRecuperacion | null> {
    return this.client(tx).tokenRecuperacion.findUnique({ where: { hash } });
  }

  async findTokensRecuperacionDesde(usuarioId: string, desde: Date, tx?: unknown): Promise<TokenRecuperacion[]> {
    return this.client(tx).tokenRecuperacion.findMany({ where: { usuarioId, creadoEn: { gte: desde } } });
  }

  async invalidarTokensRecuperacion(usuarioId: string, ahora: Date, tx?: unknown): Promise<void> {
    await this.client(tx).tokenRecuperacion.updateMany({ where: { usuarioId, usadoEn: null }, data: { usadoEn: ahora } });
  }

  async marcarTokenRecuperacionUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).tokenRecuperacion.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: ahora } });
    return count === 1;
  }
```

- [ ] **Step 5: Correo** — `usuarios/correoRecuperacion.ts`:

```ts
import type { MensajeCorreo } from "../../core/ports";

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function correoRecuperacion(nombre: string, para: string, enlace: string): MensajeCorreo {
  const asunto = "Restablecé tu contraseña — Babylon English Institute";
  const texto = [
    `Hola ${nombre}:`,
    "",
    "Recibimos un pedido para restablecer la contraseña de tu cuenta en Babylon.",
    "Abrí este enlace para elegir una nueva (vence en 1 hora y sirve una sola vez):",
    "",
    enlace,
    "",
    "Si no pediste este cambio, ignorá este correo: tu contraseña sigue siendo la misma.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Recibimos un pedido para restablecer la contraseña de tu cuenta en Babylon.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Elegir una contraseña nueva</a></p>
  <p style="color:#6b7280;font-size:12px">El enlace vence en 1 hora y sirve una sola vez. Si no pediste este cambio, ignorá este correo: tu contraseña sigue siendo la misma.</p>
</div>`;
  return { para, asunto, texto, html };
}
```

- [ ] **Step 6: Schemas** — en `usuario.schema.ts`:

```ts
export const olvideContrasenaSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Email inválido")),
});

export const restablecerContrasenaSchema = z.object({
  token: z.string().min(1, "Falta el enlace"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña puede tener como máximo 72 caracteres"),
});
```

- [ ] **Step 7: Service** — `UsuarioService` recibe `private readonly mailer: Mailer` como último parámetro del constructor (actualizar `container.ts`). Agregar:

```ts
const VIGENCIA_ENLACE_MS = 60 * 60 * 1000;
const MAX_ENLACES_POR_HORA = 3;
const ESPERA_ENTRE_ENLACES_MS = 60 * 1000;
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo.";

const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");
```

```ts
  // Siempre termina sin error, exista o no la cuenta: la respuesta no puede
  // revelar qué emails están registrados. Si la cuenta superó su límite de
  // pedidos, tampoco se envía nada.
  async solicitarRecuperacion(email: string, ahora: Date = new Date()): Promise<void> {
    const usuario = await this.usuarioRepo.findByEmail(email);
    if (!usuario || usuario.estado !== "activo") return;

    const recientes = await this.usuarioRepo.findTokensRecuperacionDesde(usuario.id, new Date(ahora.getTime() - VIGENCIA_ENLACE_MS));
    if (recientes.length >= MAX_ENLACES_POR_HORA) return;
    if (recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) return;

    const token = randomBytes(32).toString("base64url");
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.invalidarTokensRecuperacion(usuario.id, ahora, tx);
      await this.usuarioRepo.crearTokenRecuperacion(
        { id: randomUUID(), usuarioId: usuario.id, hash: hashDeToken(token), creadoEn: ahora, expiraEn: new Date(ahora.getTime() + VIGENCIA_ENLACE_MS), usadoEn: null },
        tx,
      );
    });

    // Sin esperar al SMTP: la respuesta tarda lo mismo exista o no la cuenta.
    const enlace = `${config.APP_URL}/restablecer-contrasena?token=${token}`;
    void this.mailer
      .enviar(correoRecuperacion(usuario.nombre, usuario.email, enlace))
      .catch((error) => console.error(`[correo] no se pudo enviar la recuperación a ${usuario.email}:`, error));
  }

  // Cambia la contraseña, marca el enlace como usado, invalida los demás y corta
  // las sesiones abiertas (contrasenaCambiadaEn, ver authMiddleware).
  async restablecerContrasena(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenRecuperacionPorHash(hashDeToken(token), tx);
      if (!registro || registro.usadoEn || registro.expiraEn.getTime() <= ahora.getTime()) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenRecuperacionUsado(registro.id, ahora, tx))) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_INVALIDO);

      await this.usuarioRepo.update(usuario.id, { ...usuario, passwordHash, contrasenaCambiadaEn: ahora }, tx);
      await this.usuarioRepo.invalidarTokensRecuperacion(usuario.id, ahora, tx);
    });
  }
```

`RONDAS_BCRYPT`: usar la misma cantidad de rondas que ya usan las altas de cuenta (`grep -rn "bcrypt.hash(" server/src`); si es un literal repetido, declararlo una vez como constante en `usuario.service.ts`. Imports nuevos: `createHash, randomBytes` de `node:crypto`, `Mailer` de `core/ports`, `correoRecuperacion`.

- [ ] **Step 8: Controller y rutas**

```ts
  olvideContrasena = async (req: Request, res: Response) => {
    const { email } = olvideContrasenaSchema.parse(req.body);
    await this.usuarioService.solicitarRecuperacion(email);
    res.status(200).json({
      mensaje: "Si el email está registrado, te enviamos un enlace para restablecer la contraseña. Revisá también la carpeta de spam.",
    });
  };

  restablecerContrasena = async (req: Request, res: Response) => {
    const { token, password } = restablecerContrasenaSchema.parse(req.body);
    await this.usuarioService.restablecerContrasena(token, password);
    res.status(204).end();
  };
```

```ts
  router.post("/olvide-contrasena", limiteOlvideContrasena, controller.olvideContrasena);
  router.post("/restablecer-contrasena", limiteRestablecerContrasena, controller.restablecerContrasena);
```

- [ ] **Step 9: Verificar**

Run: `cd server && pnpm typecheck`, reiniciar el server con la salida a `$SCRATCH/server.log`, `bash $SCRATCH/verificar-recuperacion.sh`
Expected: cada línea coincide con su "esperado"; al final "limpieza hecha" y `p6@prueba.babylon.test` vuelve a entrar con `prueba1234`.

- [ ] **Step 10: Commit**

```bash
git add server/prisma server/src
git commit -m "Recuperación de contraseña: enlaces de un solo uso por correo, con límites por cuenta e IP"
```

### Task 8: Client — pantallas "Olvidé mi contraseña" y "Restablecer contraseña"

**Files:**
- Create: `client/src/features/auth/components/AuthLayout.tsx` (panel verde + panel blanco, extraído de `LoginPage`)
- Create: `client/src/features/auth/pages/OlvideContrasenaPage.tsx`, `RestablecerContrasenaPage.tsx`
- Modify: `client/src/features/auth/pages/LoginPage.tsx` (usar `AuthLayout`, link "¿Olvidaste tu contraseña?")
- Modify: `client/src/features/auth/authService.ts`
- Modify: `client/src/core/routes/AppRoutes.tsx`
- Test: `$SCRATCH/e2e-recuperacion.js`

**Interfaces:**
- Consumes: endpoints de Task 7; `?motivo=contrasena-actualizada` de `LoginPage` (Task 2).
- Produces: rutas públicas `/olvide-contrasena` y `/restablecer-contrasena`.

- [ ] **Step 1: Escribir la prueba** `$SCRATCH/e2e-recuperacion.js` (server con `ConsoleMailer` y log en `$SCRATCH/server.log`; reiniciar el server antes para vaciar los límites):

```js
const { chromium } = require("playwright-core");
const fs = require("fs"); const { execSync } = require("child_process");
const REAL = "http://localhost:5173"; const LOG = process.env.SCRATCH + "/server.log";
const enlace = () => (fs.readFileSync(LOG, "utf8").match(/http:\/\/localhost:5173\/restablecer-contrasena\?token=[\w-]+/g) ?? []).pop();
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  const p = await (await b.newContext()).newPage();
  await p.goto(`${REAL}/login`, { waitUntil: "networkidle" });
  await p.getByText("¿Olvidaste tu contraseña?").click(); await p.waitForURL(/olvide-contrasena/);
  await p.locator('input[type="email"]').fill("p6@prueba.babylon.test"); await p.getByRole("button", { name: /Enviar/ }).click();
  await p.waitForTimeout(1200);
  console.log("confirmación genérica:", (await p.getByText("Si el email está registrado").count()) > 0 ? "ok" : "MAL");
  const url = enlace(); console.log("enlace en el log:", url ? "ok" : "MAL");
  await p.goto(url, { waitUntil: "networkidle" });
  console.log("token quitado de la barra:", p.url().endsWith("/restablecer-contrasena") ? "ok" : "MAL: " + p.url());
  console.log("referrer no-referrer:", await p.evaluate(() => document.querySelector('meta[name="referrer"]')?.getAttribute("content")));
  const campos = p.locator('input[type="password"]');
  await campos.nth(0).fill("nueva12345"); await campos.nth(1).fill("distinta123");
  await p.getByRole("button", { name: /Guardar/ }).click(); await p.waitForTimeout(500);
  console.log("no coinciden:", (await p.getByText("no coinciden").count()) > 0 ? "ok" : "MAL");
  await campos.nth(1).fill("nueva12345"); await p.getByRole("button", { name: /Guardar/ }).click();
  await p.waitForURL(/login\?motivo=contrasena-actualizada/);
  console.log("vuelve al login con aviso:", (await p.getByText("Contraseña actualizada").count()) > 0 ? "ok" : "MAL");
  await p.locator('input[type="email"]').fill("p6@prueba.babylon.test"); await p.locator('input[type="password"]').fill("nueva12345");
  await p.locator('button[type="submit"]').click(); await p.waitForURL(/mis-hijos/);
  console.log("entra con la nueva: ok");
  await p.goto(url, { waitUntil: "networkidle" });
  await p.locator('input[type="password"]').nth(0).fill("otra123456"); await p.locator('input[type="password"]').nth(1).fill("otra123456");
  await p.getByRole("button", { name: /Guardar/ }).click(); await p.waitForTimeout(800);
  console.log("enlace reusado:", (await p.getByText("no es válido o ya venció").count()) > 0 ? "ok" : "MAL");
  await b.close();
  const hash = execSync(`cd server && node -e "require('bcrypt').hash('prueba1234',10).then(console.log)"`).toString().trim();
  execSync(`docker exec babylon-postgres psql -U babylon -d babylon -qc "update \\"Usuario\\" set \\"passwordHash\\"='${hash}', \\"contrasenaCambiadaEn\\"=null where email='p6@prueba.babylon.test'; delete from \\"TokenRecuperacion\\""`);
  console.log("limpieza hecha");
})();
```

- [ ] **Step 2: Correrla para ver que falla**

Run: `SCRATCH=$SCRATCH node $SCRATCH/e2e-recuperacion.js`
Expected: no encuentra el link "¿Olvidaste tu contraseña?".

- [ ] **Step 3: Servicio** — en `authService.ts`:

```ts
  solicitarRecuperacion: (email: string) =>
    apiClient.post<{ mensaje: string }>("/api/auth/olvide-contrasena", { email }),
  restablecerContrasena: (token: string, password: string) =>
    apiClient.post<void>("/api/auth/restablecer-contrasena", { token, password }),
```

- [ ] **Step 4: `AuthLayout`** — leer `LoginPage.tsx`, mover el contenedor de dos paneles (panel verde con logo, grilla y tagline; panel blanco centrado) a `features/auth/components/AuthLayout.tsx` como `export function AuthLayout({ children }: { children: ReactNode })`, y hacer que `LoginPage` lo use. Verificar con una captura que el login se ve igual que antes (comparar con una captura previa al cambio, tomada al empezar esta tarea).

- [ ] **Step 5: Link en el login** — debajo del checkbox "Mantener sesión iniciada", alineado a la derecha:

```tsx
<Link to="/olvide-contrasena" className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
  ¿Olvidaste tu contraseña?
</Link>
```

- [ ] **Step 6: `OlvideContrasenaPage.tsx`** — dentro de `AuthLayout`: título "Recuperar contraseña", texto "Escribí el email de tu cuenta y te enviamos un enlace para elegir una nueva.", formulario con `react-hook-form` + zod (`email: z.email("Email inválido")`), botón "Enviar enlace" (deshabilitado mientras envía), y al responder reemplazar el formulario por el `mensaje` de la API. Si la API responde 429, mostrar su mensaje. Link "Volver al inicio de sesión" a `/login`. Mismo estilo de inputs (con ícono `Mail`) que `LoginPage`.

- [ ] **Step 7: `RestablecerContrasenaPage.tsx`** — dentro de `AuthLayout`:

```tsx
const [params] = useSearchParams();
// Se lee una sola vez y se quita de la barra de direcciones, para que el token
// no quede en el historial del navegador.
const [token] = useState(() => params.get("token") ?? "");
useEffect(() => {
  if (params.has("token")) window.history.replaceState(null, "", "/restablecer-contrasena");
}, [params]);
```

  - En el JSX, `<meta name="referrer" content="no-referrer" />` (React 19 lo sube al `<head>`).
  - Sin token: mensaje "El enlace no es válido o ya venció. Pedí uno nuevo." y link a `/olvide-contrasena`.
  - Formulario: "Contraseña nueva" y "Repetir contraseña", schema zod `password` min 8 / max 72 con los mensajes del server, `.refine((d) => d.password === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" })`, toggle mostrar/ocultar como en `LoginPage`.
  - Al guardar: `authService.restablecerContrasena(token, password)` → `navigate("/login?motivo=contrasena-actualizada", { replace: true })`. Si la API responde 400, mostrar su mensaje y el link para pedir otro enlace.

- [ ] **Step 8: Rutas públicas** — en `AppRoutes.tsx`, junto a `/login`:

```tsx
<Route path="/olvide-contrasena" element={<OlvideContrasenaPage />} />
<Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
```

- [ ] **Step 9: Verificar**

Run: `cd client && pnpm typecheck && pnpm lint`, reiniciar el server con log, `SCRATCH=$SCRATCH node $SCRATCH/e2e-recuperacion.js`; además capturas a 1440 y 390 px de las tres pantallas.
Expected: todas las líneas "ok", "referrer no-referrer: no-referrer", "limpieza hecha"; el login se ve igual que antes salvo el checkbox y el link; sin desborde horizontal a 390 px.

- [ ] **Step 10: Commit**

```bash
git add client/src
git commit -m "Pantallas de recuperación de contraseña y link en el login"
```

### Task 9: Documentación y verificación final

**Files:**
- Modify: `CLAUDE.md`
- Modify: memoria `proyecto_babylon_pendientes_futuros.md` (las tres funciones dejan de estar pendientes)

- [ ] **Step 1: CLAUDE.md**
  - "Autenticación y roles": validación de sesión por pedido (`configurarValidadorDeSesion`, `contrasenaCambiadaEn`), `recordarme` (8 h / 30 d, `sessionStorage`/`localStorage`), 401 → `/login?motivo=sesion-vencida`.
  - Nueva sección "Recuperación de contraseña y correo": flujo, token hasheado, límites (tabla del spec), `Mailer` + adaptadores, variables `SMTP_*`/`MAIL_FROM`/`APP_URL`/`TRUST_PROXY`, producción exige SMTP.
  - Tabla de API: `POST /api/auth/olvide-contrasena`, `POST /api/auth/restablecer-contrasena`, `GET /api/notificaciones`; `POST /api/auth/login` con `recordarme` y límites.
  - "Sistema de diseño": quitar las frases que dicen que la campana, "mantener sesión" y "¿olvidaste tu contraseña?" no existen; describir la campana por rol (`notificaciones/`, sin "leído", `publicadaEn`).

- [ ] **Step 2: Verificación completa**

Run: en `server/`: `pnpm typecheck && pnpm build`; en `client/`: `pnpm typecheck && pnpm lint && pnpm build`; reiniciar server y client y volver a correr `verificar-sesion.sh`, `e2e-sesion.js`, `e2e-campana.js`, `verificar-limites-login.sh` (con server recién reiniciado) y `e2e-recuperacion.js`.
Expected: todo limpio (lint con los 2 avisos ya existentes), todas las verificaciones en "ok"/"esperado"; `select count(*) from "TokenRecuperacion"` = 0 y `contrasenaCambiadaEn` null en las cuentas de prueba.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Documentar sesión persistente, notificaciones por rol y recuperación de contraseña"
```
