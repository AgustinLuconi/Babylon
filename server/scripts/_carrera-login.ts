import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import type { UsuarioRepository } from "../src/modules/usuarios/usuario.repository";
import { UsuarioService } from "../src/modules/usuarios/usuario.service";
import { ok, si } from "./_check";

const prisma = new PrismaClient();
const U = "prueba-tmp-carrera";
const EMAIL = "prueba-tmp-carrera@x.test";
const ctx = { dispositivo: "x", ip: null };
const creds = (password: string) => ({ email: EMAIL, password });
// Quien cambia la contraseña es un administrador (no tiene sesión en esta cuenta).
const actor = { usuarioId: "otro-admin", sesionId: "ninguna" };
const abiertas = () => prisma.sesion.count({ where: { usuarioId: U, cerradaEn: null, expiraEn: { gt: new Date() } } });

const usuarioRepo = new PrismaUsuarioRepository(prisma);
const sesionRepo = new PrismaSesionRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const unitOfWork = new PrismaUnitOfWork(prisma);
const nuevo = (repo: UsuarioRepository) => new UsuarioService(repo, sesionRepo, profesorRepo, new PrismaPadreRepository(prisma), {} as never, {} as never, unitOfWork);
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

  // A) login en curso + cambio de contraseña por el administrador
  const a = servicioPausado();
  const loginA = rechazo(a.svc.autenticar(creds("ClaveVieja1234"), ctx));
  await a.yaLeyo;
  await servicio.actualizarCuenta(U, { password: "ClaveNueva5678" }, actor);
  a.soltar();
  ok("A: el login que se cruzó con el cambio de contraseña", await loginA, "AuthenticationError");
  ok("A: sesiones abiertas (el administrador las cerró todas)", await abiertas(), 0);

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

  ok("limpieza", si((await prisma.usuario.deleteMany({ where: { id: U } })).count === 1), "sí");
  await prisma.$disconnect();
  process.exit(0);
})();
