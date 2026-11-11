import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { ConsoleMailer } from "../src/core/adapters/ConsoleMailer";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import type { UsuarioRepository } from "../src/modules/usuarios/usuario.repository";
import { UsuarioService } from "../src/modules/usuarios/usuario.service";
import { InvitacionService } from "../src/modules/usuarios/invitacion.service";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const U = "prueba-tmp-carrera";
const EMAIL = "prueba-tmp-carrera@x.test";
const ctx = { dispositivo: "x", ip: null };
const creds = (password: string) => ({ email: EMAIL, password, recordarme: false });
const abiertas = () => prisma.sesion.count({ where: { usuarioId: U, cerradaEn: null, expiraEn: { gt: new Date() } } });

const usuarioRepo = new PrismaUsuarioRepository(prisma);
const sesionRepo = new PrismaSesionRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const unitOfWork = new PrismaUnitOfWork(prisma);
const nuevo = (repo: UsuarioRepository) => new UsuarioService(repo, sesionRepo, profesorRepo, unitOfWork, new ConsoleMailer(), new InvitacionService(new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), new PrismaProfesorRepository(prisma), new PrismaUnitOfWork(prisma), new ConsoleMailer()));
const servicio = nuevo(usuarioRepo);

// Un servicio cuyo login se queda "a mitad de camino": ya leyó la cuenta (con la contraseña vieja) y espera una señal
// antes de seguir. Así se reproduce, sin depender de tiempos, un login que se cruza con otro cambio de la cuenta.
function servicioPausado() {
  let soltar!: () => void;
  const puerta = new Promise<void>((r) => (soltar = r));
  let leyo!: () => void;
  const yaLeyo = new Promise<void>((r) => (leyo = r));
  const repo = new Proxy(usuarioRepo, {
    get(obj, prop, rec) {
      const v = Reflect.get(obj, prop, rec);
      if (prop !== "findByEmail") return typeof v === "function" ? v.bind(obj) : v;
      return async (...args: unknown[]) => {
        const u = await (v as (...a: unknown[]) => Promise<unknown>).apply(obj, args);
        leyo();
        await puerta;
        return u;
      };
    },
  }) as UsuarioRepository;
  return { svc: nuevo(repo), soltar, yaLeyo };
}
const rechazo = (p: Promise<unknown>) => p.then(() => "entró", (e: Error) => e.name);

(async () => {
  await prisma.usuario.deleteMany({ where: { id: U } });
  await prisma.usuario.create({ data: { id: U, nombre: "Tmp", email: EMAIL, passwordHash: await bcrypt.hash("ClaveVieja1234", 10), roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });

  // 0) un login normal sigue funcionando
  const normal = await servicio.autenticar(creds("ClaveVieja1234"), ctx);
  ok("login normal", normal.requiereSeleccionRol === false ? "entró" : "no", "entró");
  const sesionNormal = (await prisma.sesion.findFirstOrThrow({ where: { usuarioId: U } })).id;

  // A) login en curso + cambio de contraseña desde otra sesión
  const a = servicioPausado();
  const loginA = rechazo(a.svc.autenticar(creds("ClaveVieja1234"), ctx));
  await a.yaLeyo;
  await servicio.cambiarContrasena(U, sesionNormal, { passwordActual: "ClaveVieja1234", passwordNueva: "ClaveNueva5678" });
  a.soltar();
  ok("A: el login que se cruzó con el cambio de contraseña", await loginA, "AuthenticationError");
  ok("A: sesiones abiertas (solo la que hizo el cambio)", await abiertas(), 1);

  // B) login en curso + desactivación de la cuenta
  await prisma.sesion.updateMany({ where: { usuarioId: U }, data: { cerradaEn: new Date() } });
  const b = servicioPausado();
  const loginB = rechazo(b.svc.autenticar(creds("ClaveNueva5678"), ctx));
  await b.yaLeyo;
  await servicio.cambiarEstado(U, { estado: "inactivo" }, "otro-admin");
  b.soltar();
  ok("B: el login que se cruzó con la desactivación", await loginB, "AuthenticationError");
  await servicio.cambiarEstado(U, { estado: "activo" }, "otro-admin");
  ok("B: tras reactivar, sesiones abiertas", await abiertas(), 0);

  // C) login en curso + recuperación de contraseña
  const c = servicioPausado();
  const loginC = rechazo(c.svc.autenticar(creds("ClaveNueva5678"), ctx));
  await c.yaLeyo;
  const token = "token-de-prueba-carrera";
  await prisma.tokenCuenta.create({ data: { tipo: "recuperacion", id: "prueba-tmp-tok-c", usuarioId: U, hash: createHash("sha256").update(token).digest("hex"), creadoEn: new Date(), expiraEn: new Date(Date.now() + 3_600_000) } });
  await servicio.restablecerContrasena(token, "ClaveRecuperada9");
  c.soltar();
  ok("C: el login que se cruzó con la recuperación", await loginC, "AuthenticationError");
  ok("C: sesiones abiertas", await abiertas(), 0);

  // D) cambiar la contraseña desde Mi cuenta invalida los enlaces de recuperación pendientes
  const ses = await servicio.autenticar(creds("ClaveRecuperada9"), ctx);
  const sid = ses.requiereSeleccionRol === false ? (await prisma.sesion.findFirstOrThrow({ where: { usuarioId: U, cerradaEn: null } })).id : "";
  await prisma.tokenCuenta.create({ data: { tipo: "recuperacion", id: "prueba-tmp-tok-d", usuarioId: U, hash: createHash("sha256").update("otro-token-carrera").digest("hex"), creadoEn: new Date(), expiraEn: new Date(Date.now() + 3_600_000) } });
  await servicio.cambiarContrasena(U, sid, { passwordActual: "ClaveRecuperada9", passwordNueva: "ClaveFinal123456" });
  ok("D: el enlace de recuperación pendiente ya no sirve", await rechazo(servicio.restablecerContrasena("otro-token-carrera", "Hackeada123456")), "ValidationError");

  ok("limpieza", si((await prisma.usuario.deleteMany({ where: { id: U } })).count === 1), "sí");
  await prisma.$disconnect();
  process.exit(0);
})();
