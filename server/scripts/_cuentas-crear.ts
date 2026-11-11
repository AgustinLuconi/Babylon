// Crear cuenta (solo el administrador): desde una ficha sin cuenta o con ficha nueva, vinculando la ficha a una cuenta que ya
// existe, y la lista "Sin cuenta". Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
type Cuerpo = Record<string, unknown>;
async function entrar(correo: string, password: string): Promise<number> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: correo, password }) });
  return r.status;
}
async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(metodo: string, ruta: string, token: string | null, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined || metodo === "GET" ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: texto.startsWith("{") || texto.startsWith("[") ? (JSON.parse(texto) as any) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre] = await Promise.all([login("admin"), login("secre")]);
  const ficha = (id: string, dni: string, correo: string | null) =>
    prisma.padre.create({ data: { id: `${P}-${id}`, nombre: "Pruebaav", apellido: id.toUpperCase(), dni, telefono: "+5493515551234", email: correo } });
  const f1 = await ficha("f1", "99400201", email("f1-contacto"));
  const f2 = await ficha("f2", "99400202", null);
  const f3 = await ficha("f3", "99400203", null);
  const pf1 = await prisma.profesor.create({ data: { id: `${P}-pf1`, nombre: "Pruebaav", apellido: "Pf1", dni: "99400211", email: email("pf1-contacto"), estado: "activo" } });
  const pfInactivo = await prisma.profesor.create({ data: { id: `${P}-pfinactivo`, nombre: "Pruebaav", apellido: "Inactivo", dni: "99400212", estado: "inactivo" } });
  const cuenta = (correo: string, password = "clavecuenta1") => ({ email: correo, password });

  // ── Lista "Sin cuenta" ──
  const lista = await pedir("GET", "/api/auth/sin-cuenta", admin);
  const claves = new Set<string>(((lista.d ?? []) as { clave: string }[]).map((f) => f.clave));
  ok("sin-cuenta: el responsable sin cuenta figura", claves.has(`padre:${f1.id}`), true);
  ok("sin-cuenta: el profesor activo sin cuenta figura", claves.has(`profesor:${pf1.id}`), true);
  ok("sin-cuenta: el profesor inactivo no figura", claves.has(`profesor:${pfInactivo.id}`), false);
  ok("sin-cuenta: el responsable que ya tiene cuenta no figura", claves.has(`padre:${m.padreId}`), false);
  const fila = ((lista.d ?? []) as { clave: string; tipo: string; fichaId: string; nombre: string; email: string | null }[]).find((f) => f.clave === `padre:${f1.id}`);
  ok("sin-cuenta: trae tipo, ficha, nombre y el email de la ficha", `${fila?.tipo} ${fila?.fichaId === f1.id} ${fila?.nombre} ${fila?.email}`, `padre true Pruebaav F1 ${email("f1-contacto")}`);
  ok("sin-cuenta: un responsable sin email trae null", ((lista.d ?? []) as { clave: string; email: string | null }[]).find((f) => f.clave === `padre:${f2.id}`)?.email, null);

  // ── Crear cuenta para una ficha ──
  const nueva = await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("cuenta-f1")), roles: ["padre"], padre: { fichaId: f1.id } });
  ok("crear cuenta para un responsable", `${nueva.status} ${nueva.d?.vinculada}`, "201 false");
  const u1 = await prisma.usuario.findUniqueOrThrow({ where: { email: email("cuenta-f1") } });
  ok("la cuenta nace activa, con rol padre y el nombre de la ficha", `${u1.estado} ${u1.roles.join()} ${u1.nombre}`, "activo padre Pruebaav F1");
  const f1d = await prisma.padre.findUniqueOrThrow({ where: { id: f1.id } });
  ok("la ficha queda vinculada y toma el email de la cuenta", `${f1d.usuarioId === u1.id} ${f1d.email}`, `true ${email("cuenta-f1")}`);
  ok("no devuelve el hash", "passwordHash" in (nueva.d?.usuario ?? {}), false);
  ok("la persona entra con la contraseña asignada", await entrar(email("cuenta-f1"), "clavecuenta1"), 200);
  const lista2 = await pedir("GET", "/api/auth/sin-cuenta", admin);
  ok("sin-cuenta: ya no figura", ((lista2.d ?? []) as { clave: string }[]).some((f) => f.clave === `padre:${f1.id}`), false);
  ok("una ficha que ya tiene cuenta: 409", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("otra")), roles: ["padre"], padre: { fichaId: f1.id } })).status, 409);
  ok("una ficha que no existe: 404", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("otra")), roles: ["padre"], padre: { fichaId: "no-existe" } })).status, 404);
  ok("un profesor inactivo: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("pf-inactivo")), roles: ["profesor"], profesor: { fichaId: pfInactivo.id } })).status, 400);

  // ── Email que ya tiene cuenta: se vincula la ficha ──
  const vinculo = await pedir("POST", "/api/auth/cuentas", admin, { email: email("secre"), password: "ignorada123", roles: ["padre"], padre: { fichaId: f2.id } });
  ok("email de una cuenta existente: vincula la ficha", `${vinculo.status} ${vinculo.d?.vinculada}`, "201 true");
  const secreD = await prisma.usuario.findUniqueOrThrow({ where: { id: m.secre } });
  ok("la cuenta suma el rol", secreD.roles.slice().sort().join(), "padre,secretario");
  ok("la contraseña no cambió", `${await entrar(email("secre"), CLAVE)} ${await entrar(email("secre"), "ignorada123")}`, "200 401");
  ok("la ficha queda vinculada a la cuenta existente y con su email", `${(await prisma.padre.findUniqueOrThrow({ where: { id: f2.id } })).usuarioId === m.secre} ${(await prisma.padre.findUniqueOrThrow({ where: { id: f2.id } })).email}`, `true ${email("secre")}`);
  ok("esa cuenta ya tiene un responsable: otra ficha de responsable es 409", (await pedir("POST", "/api/auth/cuentas", admin, { email: email("secre"), roles: ["padre"], padre: { fichaId: f3.id } })).status, 409);
  ok("pedir un rol que ya tiene (admin sobre un admin) es 409", (await pedir("POST", "/api/auth/cuentas", admin, { email: email("admin"), nombre: "Pruebaav", roles: ["admin"] })).status, 409);

  // ── Validaciones ──
  const base = { roles: ["padre"], padre: { fichaId: f3.id } };
  ok("sin contraseña y sin cuenta previa: 400", (await pedir("POST", "/api/auth/cuentas", admin, { email: email("sin-pass"), ...base })).status, 400);
  ok("contraseña de 7 caracteres: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("c7"), "abcdefg"), ...base })).status, 400);
  ok("contraseña de 73 bytes (ñ × 37): 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("c73"), "ñ".repeat(37)), ...base })).status, 400);
  ok("contraseña de 8 espacios: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("c8"), "        "), ...base })).status, 400);
  ok("solo admin y sin nombre: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("sin-nombre")), roles: ["admin"] })).status, 400);
  ok("rol padre sin ficha: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("x")), roles: ["padre"] })).status, 400);
  ok("ficha de padre sin el rol: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("x")), nombre: "Pruebaav", roles: ["secretario"], padre: { fichaId: f3.id } })).status, 400);
  ok("un campo desconocido: 400", (await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("x")), ...base, extra: 1 })).status, 400);
  ok("secretario y administrador sin ficha", `${(await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("sec-dos")), nombre: "Pruebaav Dos", roles: ["secretario", "admin"] })).status}`, "201");
  const dos = await prisma.usuario.findUniqueOrThrow({ where: { email: email("sec-dos") } });
  ok("con varios roles", dos.roles.slice().sort().join(), "admin,secretario");

  // ── Ficha nueva ──
  const conFicha = await pedir("POST", "/api/auth/cuentas", admin, {
    ...cuenta(email("prof-nuevo")),
    roles: ["profesor"],
    profesor: { nueva: { nombre: "Pruebaav", apellido: "Nuevo", dni: "99400221" } },
  });
  ok("profesor con ficha nueva y cuenta en un pedido", conFicha.status, 201);
  const pNuevo = await prisma.profesor.findFirstOrThrow({ where: { dni: "99400221" } });
  const uNuevo = await prisma.usuario.findUniqueOrThrow({ where: { email: email("prof-nuevo") } });
  ok("la ficha nueva queda vinculada y con el email de la cuenta", `${pNuevo.usuarioId === uNuevo.id} ${pNuevo.email}`, `true ${email("prof-nuevo")}`);
  const choque = await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("prof-choque")), roles: ["profesor"], profesor: { nueva: { nombre: "Pruebaav", apellido: "Otro", dni: "99400221" } } });
  ok("ficha nueva con DNI repetido: 409", choque.status, 409);
  ok("y no quedó ninguna cuenta a medias", await prisma.usuario.count({ where: { email: email("prof-choque") } }), 0);
  const padreNuevo = await pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("padre-nuevo")), roles: ["padre"], padre: { nueva: { nombre: "Pruebaav", apellido: "Nueva", telefono: "351 555-1234" } } });
  ok("responsable con ficha nueva", padreNuevo.status, 201);

  // ── Pedidos simultáneos con el mismo email ──
  const fichas = await Promise.all(Array.from({ length: 8 }, (_, i) => ficha(`g${i}`, `9940023${i}`, null)));
  const ronda = await Promise.all(fichas.map((f) => pedir("POST", "/api/auth/cuentas", admin, { ...cuenta(email("carrera")), roles: ["padre"], padre: { fichaId: f.id } })));
  const conteo = ronda.reduce<Record<number, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  ok("8 pedidos a la vez con el mismo email: una cuenta y el resto 409", `${conteo[201]} ${conteo[409]}`, "1 7");
  ok("queda una sola cuenta con ese email", await prisma.usuario.count({ where: { email: email("carrera") } }), 1);
  ok("y una sola ficha vinculada a ella", await prisma.padre.count({ where: { id: { in: fichas.map((f) => f.id) }, usuarioId: { not: null } } }), 1);

  // ── Búsqueda por email ──
  const hay = await pedir("GET", `/api/auth/usuarios/por-email?email=${encodeURIComponent(email("secre"))}`, admin);
  ok("por-email: una cuenta existente", `${hay.status} ${hay.d?.id === m.secre} ${hay.d?.roles?.slice().sort().join()}`, "200 true padre,secretario");
  const nadie = await pedir("GET", `/api/auth/usuarios/por-email?email=${encodeURIComponent(email("no-existe"))}`, admin);
  ok("por-email: un email sin cuenta", `${nadie.status} ${JSON.stringify(nadie.d)}`, "200 null");
  ok("por-email: un email inválido", (await pedir("GET", "/api/auth/usuarios/por-email?email=xx", admin)).status, 400);

  // ── Permisos ──
  ok("Sin cuenta: la secretaria no entra", (await pedir("GET", "/api/auth/sin-cuenta", secre)).status, 403);
  ok("Crear cuenta: la secretaria no entra", (await pedir("POST", "/api/auth/cuentas", secre, { ...cuenta(email("x")), roles: ["padre"], padre: { fichaId: f3.id } })).status, 403);
  ok("por-email: la secretaria no entra", (await pedir("GET", `/api/auth/usuarios/por-email?email=${encodeURIComponent(email("secre"))}`, secre)).status, 403);
  ok("sin sesión", (await pedir("POST", "/api/auth/cuentas", null, {})).status, 401);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
