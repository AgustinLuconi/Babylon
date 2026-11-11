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
  prisma.padre.create({ data: { id: `${P}-p${n}`, nombre: "Pruebainv", apellido: `Padre ${n}`, dni: `9910000${n}`, email: `${P}-${n}@x.test` } });

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
