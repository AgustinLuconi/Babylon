// Menores de la revisión final de las cuentas: crear una cuenta sobre una existente toma el bloqueo de la cuenta y cierra sus
// sesiones, el último administrador se protege con un bloqueo global, un error de la base ya no se disfraza de "404", editar el
// email desde la cuenta y desde la ficha a la vez no se traba, y "por email" dice si la cuenta está inactiva.
// Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PadreService } from "../src/modules/padres/padre.service";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { ProfesorService } from "../src/modules/profesores/profesor.service";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import type { UsuarioRepository } from "../src/modules/usuarios/usuario.repository";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { UsuarioService } from "../src/modules/usuarios/usuario.service";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
async function entrar(quien: string, rolElegido?: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE, ...(rolElegido ? { rolElegido } : {}) }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(metodo: string, ruta: string, token: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo === undefined || metodo === "GET" ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  return { status: r.status, d: texto.startsWith("{") || texto.startsWith("[") ? JSON.parse(texto) : null };
}

// Un servicio con los repositorios reales, pero que anota qué bloqueos pide.
const claves: string[] = [];
const uow = new PrismaUnitOfWork(prisma);
const usuarioReal = new PrismaUsuarioRepository(prisma);
const usuarioRepo = new Proxy(usuarioReal, {
  get(obj, prop, rec) {
    const v = Reflect.get(obj, prop, rec);
    if (prop === "bloquearCuenta") return (clave: string, tx: unknown) => (claves.push(clave), obj.bloquearCuenta(clave, tx));
    return typeof v === "function" ? v.bind(obj) : v;
  },
}) as UsuarioRepository;
const padreRepo = new PrismaPadreRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const sesionRepo = new PrismaSesionRepository(prisma);
const padreService = new PadreService(padreRepo, usuarioRepo, profesorRepo, new PrismaAlumnoRepository(prisma), uow);
const profesorService = new ProfesorService(profesorRepo, usuarioRepo, sesionRepo, padreRepo, uow);
const servicio = new UsuarioService(usuarioRepo, sesionRepo, profesorRepo, padreRepo, padreService, profesorService, uow);

(async () => {
  const m = await crearMundo(prisma);
  const admin = await entrar("admin");
  const ficha = (id: string, dni: string) => prisma.padre.create({ data: { id: `${P}-${id}`, nombre: "Pruebaav", apellido: id.toUpperCase(), dni, telefono: "+5493515551234" } });
  const actor = { usuarioId: "ninguno", sesionId: "ninguna" };

  // 1) Crear una cuenta sobre una que ya existe toma el bloqueo de esa cuenta (no solo el del email).
  const f1 = await ficha("m1", "99400501");
  claves.length = 0;
  await servicio.crearCuenta({ email: email("secre"), roles: ["padre"], padre: { fichaId: f1.id } }, actor);
  ok("crear sobre una cuenta existente: toma el bloqueo de la cuenta", claves.includes(m.secre), true);
  ok("y sigue tomando el del email", claves.includes(`email:${email("secre")}`), true);

  // 2) Y le cierra las sesiones (como al editar sus roles), salvo la propia si el administrador se agrega un rol a sí mismo.
  const secreViejo = await entrar("secre");
  const f2 = await ficha("m2", "99400502");
  await servicio.crearCuenta({ email: email("secre"), roles: ["profesor"], profesor: { nueva: { nombre: "Pruebaav", apellido: "Nuevo", dni: "99400503" } } }, actor);
  ok("agregar un rol por Crear cuenta cierra las sesiones de esa cuenta", (await pedir("GET", "/api/auth/yo", secreViejo)).status, 401);
  const adminOtra = await entrar("admin");
  const propia = await pedir("POST", "/api/auth/cuentas", admin, { email: email("admin"), nombre: "Pruebaav admin", roles: ["secretario"] });
  ok("el administrador se agrega un rol a sí mismo", propia.status, 201);
  ok("conserva la sesión desde la que lo hizo", (await pedir("GET", "/api/auth/yo", admin)).status, 200);
  ok("pero sus otras sesiones se cierran", (await pedir("GET", "/api/auth/yo", adminOtra)).status, 401);
  void f2;

  // 3) El último administrador: quitar el rol de administrador o desactivar a uno toma un bloqueo global ("administradores").
  const admin2 = await entrar("admin");
  void admin2;
  claves.length = 0;
  await servicio.actualizarCuenta(m.multi, { roles: ["profesor"] }, actor);
  ok("quitar el rol de administrador toma el bloqueo global", claves.includes("administradores"), true);
  claves.length = 0;
  await servicio.cambiarEstado(m.admin, { estado: "inactivo" }, actor.usuarioId);
  ok("desactivar a un administrador toma el bloqueo global", claves.includes("administradores"), true);
  claves.length = 0;
  await servicio.cambiarEstado(m.ajeno, { estado: "inactivo" }, actor.usuarioId);
  ok("desactivar a quien no es administrador no lo toma", claves.includes("administradores"), false);
  await servicio.cambiarEstado(m.admin, { estado: "activo" }, actor.usuarioId);
  await servicio.cambiarEstado(m.ajeno, { estado: "activo" }, actor.usuarioId);

  const admin3 = await entrar("admin", "admin");

  // 4) Un error de la base ya no se disfraza de "no existe".
  const roto = new PrismaUsuarioRepository({ usuario: { update: async () => { throw new Error("la base se cayó"); } } } as never);
  const nombreDelError = await roto.actualizarParcial("x", { nombre: "a" }).then(() => "sin error", (e: Error) => e.name);
  ok("un error cualquiera de la base no es 404", nombreDelError, "Error");
  const fila = new PrismaUsuarioRepository({ usuario: { update: async () => { const { Prisma } = await import("@prisma/client"); throw new Prisma.PrismaClientKnownRequestError("no existe", { code: "P2025", clientVersion: "x" }); } } } as never);
  ok("una fila que no existe sigue siendo 404", await fila.actualizarParcial("x", { nombre: "a" }).then(() => "sin error", (e: Error) => e.name), "EntityNotFoundError");

  // 5) Cambiar el email a la vez desde la cuenta y desde la ficha: nunca un 404 ni un 500 (a lo sumo un 409 por el choque).
  const raros: string[] = [];
  for (let i = 0; i < 15; i++) {
    const rs = await Promise.all([
      pedir("PATCH", `/api/auth/usuarios/${m.padre}`, admin3, { email: email(`carrera-cuenta-${i}`) }),
      pedir("PATCH", `/api/padres/${m.padreId}`, admin3, { email: email(`carrera-ficha-${i}`) }),
    ]);
    for (const r of rs) if (![200, 409].includes(r.status)) raros.push(String(r.status));
  }
  ok("15 rondas de cambio simultáneo de email: respuestas que no son 200 ni 409", raros.join(",") || "ninguna", "ninguna");
  const [u, p] = [await prisma.usuario.findUniqueOrThrow({ where: { id: m.padre } }), await prisma.padre.findUniqueOrThrow({ where: { id: m.padreId } })];
  ok("al final cuenta y ficha tienen el mismo email", u.email === p.email, true);

  // 6) "Por email" dice si la cuenta está inactiva.
  const activa = await pedir("GET", `/api/auth/usuarios/por-email?email=${encodeURIComponent(email("secre"))}`, admin3);
  ok("por email: una cuenta activa", activa.d?.estado, "activo");
  await pedir("PATCH", `/api/auth/usuarios/${m.ajeno}/estado`, admin3, { estado: "inactivo" });
  const inactiva = await pedir("GET", `/api/auth/usuarios/por-email?email=${encodeURIComponent(email("ajeno"))}`, admin3);
  ok("por email: una cuenta desactivada", inactiva.d?.estado, "inactivo");

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
