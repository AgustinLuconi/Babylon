// Sin correo, invitaciones, recuperación, verificación ni cambio de contraseña propio: las rutas ya no existen, las altas no
// crean cuentas con contraseña de ficha y las cuentas de secretario y administrador exigen contraseña.
// Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
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
  return { status: r.status, d: texto.startsWith("{") ? (JSON.parse(texto) as Record<string, unknown>) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre] = await Promise.all([login("admin"), login("secre")]);

  // Rutas que dejan de existir.
  const eliminadas: [string, string][] = [
    ["POST", "/api/auth/olvide-contrasena"],
    ["POST", "/api/auth/restablecer-contrasena"],
    ["POST", "/api/auth/verificar-email"],
    ["POST", "/api/auth/enviar-verificacion"],
    ["POST", "/api/auth/cambiar-contrasena"],
    ["POST", "/api/auth/activar-cuenta"],
    ["POST", "/api/auth/activar-cuenta/consultar"],
    ["POST", "/api/auth/invitaciones"],
    ["POST", "/api/auth/invitaciones/reenviar"],
    ["DELETE", `/api/auth/invitaciones/${m.secre}`],
    ["GET", "/api/auth/pendientes"],
    ["POST", "/api/auth/secretarios"],
    ["POST", "/api/auth/administradores"],
  ];
  for (const [metodo, ruta] of eliminadas) ok(`${metodo} ${ruta} ya no existe`, (await pedir(metodo, ruta, admin, {})).status, 404);

  const yo = await pedir("GET", "/api/auth/yo", admin);
  ok("GET /yo no trae emailVerificado", "emailVerificado" in (yo.d ?? {}), false);
  ok("GET /yo trae lo básico", Object.keys(yo.d ?? {}).sort().join(","), "email,id,nombre,rol");

  // Secretario y administrador: la contraseña es obligatoria.
  const nuevoSecre = (extra: object) => pedir("POST", "/api/auth/cuentas", admin, { nombre: "Pruebaav Nueva", email: email("secre-nueva"), roles: ["secretario"], ...extra });
  ok("secretario sin contraseña", (await nuevoSecre({})).status, 400);
  ok("secretario con contraseña de 7 caracteres", (await nuevoSecre({ password: "abcdefg" })).status, 400);
  const creado = await nuevoSecre({ password: "clavenueva1" });
  ok("secretario con contraseña válida", creado.status, 201);
  ok("la respuesta no trae el hash ni la invitación", `${"passwordHash" in (creado.d?.usuario ?? {})} ${"invitacion" in (creado.d ?? {})}`, "false false");
  const entra = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("secre-nueva"), password: "clavenueva1" }) });
  ok("el secretario nuevo inicia sesión", entra.status, 200);
  ok("administrador sin contraseña", (await pedir("POST", "/api/auth/cuentas", admin, { nombre: "Pruebaav Adm", email: email("adm-nuevo"), roles: ["admin"] })).status, 400);
  ok("administrador con contraseña", (await pedir("POST", "/api/auth/cuentas", admin, { nombre: "Pruebaav Adm", email: email("adm-nuevo"), roles: ["admin"], password: "clavenueva1" })).status, 201);

  // Las altas de fichas no crean cuentas ni aceptan contraseña.
  const ficha = { nombre: "Pruebaav", apellido: "Sincuenta", telefono: "351 555-1234", email: email("ficha-padre") };
  ok("responsable con contraseña", (await pedir("POST", "/api/padres", secre, { ...ficha, password: "clavenueva1" })).status, 400);
  const padre = await pedir("POST", "/api/padres", secre, ficha);
  ok("responsable sin contraseña", padre.status, 201);
  ok("el responsable no tiene cuenta", `${padre.d?.usuarioId ?? null} ${"invitacion" in (padre.d ?? {})}`, "null false");
  ok("y no se creó una cuenta con su email", (await prisma.usuario.count({ where: { email: email("ficha-padre") } })), 0);

  const profe = { nombre: "Pruebaav", apellido: "Docente", dni: "99400160", email: email("ficha-profe") };
  ok("profesor con contraseña", (await pedir("POST", "/api/profesores", admin, { ...profe, password: "clavenueva1" })).status, 400);
  const prof = await pedir("POST", "/api/profesores", admin, profe);
  ok("profesor sin contraseña", prof.status, 201);
  ok("el profesor no tiene cuenta", `${prof.d?.usuarioId ?? null} ${"invitacion" in (prof.d ?? {})}`, "null false");

  // La inscripción no pide ni acepta contraseñas.
  const base = { nombre: "Pruebaav", apellido: "Nene", cursoId: m.cursoId };
  const conPassword = (responsable: object) => pedir("POST", "/api/alumnos", secre, { ...base, responsable });
  ok("responsable nuevo con contraseña", (await conPassword({ tipo: "nuevo", vinculo: "madre", datos: { nombre: "Pruebaav", apellido: "Mama", telefono: "351 555-1234", password: "clavenueva1" } })).status, 400);
  ok("alumno propio con contraseña", (await conPassword({ tipo: "propio", telefono: "351 555-1234", password: "clavenueva1" })).status, 400);
  const sinPassword = await conPassword({ tipo: "nuevo", vinculo: "madre", datos: { nombre: "Pruebaav", apellido: "Mama", telefono: "351 555-1234", email: email("mama-contacto") } });
  ok("responsable nuevo con email de contacto", sinPassword.status, 201);
  ok("sin invitación en la respuesta", "invitacion" in (sinPassword.d ?? {}), false);
  ok("y sin cuenta creada", await prisma.usuario.count({ where: { email: email("mama-contacto") } }), 0);

  await limpiarMundo(prisma);
  void P;
  await prisma.$disconnect();
})();
