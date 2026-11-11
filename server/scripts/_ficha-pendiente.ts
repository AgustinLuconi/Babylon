import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { SmtpMailer } from "../src/core/adapters/SmtpMailer";
import type { Mailer, MensajeCorreo } from "../src/core/ports";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { ProfesorService } from "../src/modules/profesores/profesor.service";
import { InvitacionService } from "../src/modules/usuarios/invitacion.service";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok, si } from "./_check";
import { TAMANO_TANDA } from "../../client/src/features/usuarios/hooks/accesos";

const prisma = new PrismaClient();
class CapturaMailer implements Mailer {
  async enviar(_m: MensajeCorreo) {}
}
const usuarioRepo = new PrismaUsuarioRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const uow = new PrismaUnitOfWork(prisma);
const inv = new InvitacionService(usuarioRepo, new PrismaPadreRepository(prisma), profesorRepo, uow, new CapturaMailer());
const profes = new ProfesorService(profesorRepo, usuarioRepo, new PrismaSesionRepository(prisma), uow, inv);
const P = "prueba-tmp-ficha";
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
async function limpiar() {
  const ids = (await prisma.profesor.findMany({ where: { id: { startsWith: P } } })).map((x) => x.usuarioId).filter((x): x is string => !!x);
  await prisma.profesor.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { in: ids } }, { email: { startsWith: P } }] } });
}

(async () => {
  await limpiar();
  await prisma.profesor.create({ data: { id: `${P}-1`, nombre: "Pruebainv", apellido: "Ficha", email: `${P}-1@x.test`, estado: "activo" } });
  const ahora = new Date();
  await inv.invitar([], [`${P}-1`], ahora);
  const cuentaId = (await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-1` } })).usuarioId!;
  const estado = async () => (await prisma.usuario.findUniqueOrThrow({ where: { id: cuentaId } })).estado;
  const fila = async () => (await inv.listarPendientes()).find((f) => f.clave === `cuenta:${cuentaId}`);
  ok("punto de partida: cuenta pendiente", await estado(), "pendiente");

  // A) Editar la ficha sin cambiar el estado (el modal siempre manda el estado actual) no toca la cuenta
  await profes.actualizarProfesor(`${P}-1`, { telefono: "2664-000000", estado: "activo" });
  ok("A: editar el teléfono deja la cuenta pendiente", await estado(), "pendiente");
  ok("A: la invitación sigue vigente", (await fila())?.etiqueta, "pendiente");
  ok("A: el cambio de la ficha se guardó", (await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-1` } })).telefono, "2664-000000");

  // B) Cambiar el estado de la ficha mientras la cuenta está pendiente se rechaza y no cambia nada
  ok("B: desactivar al profesor con la cuenta pendiente", await rechazo(profes.actualizarProfesor(`${P}-1`, { estado: "inactivo" })), "ValidationError");
  ok("B: la cuenta sigue pendiente", await estado(), "pendiente");
  ok("B: el profesor sigue activo", (await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-1` } })).estado, "activo");

  // C) Cambiar el email de la ficha con la cuenta pendiente anula la invitación (no la puede activar quien la recibió antes)
  await profes.actualizarProfesor(`${P}-1`, { email: `${P}-nuevo@x.test`, estado: "activo" });
  ok("C: el email de la cuenta se actualizó", (await prisma.usuario.findUniqueOrThrow({ where: { id: cuentaId } })).email, `${P}-nuevo@x.test`);
  ok("C: sigue pendiente", await estado(), "pendiente");
  ok("C: la invitación anterior quedó anulada (vencida)", (await fila())?.etiqueta, "vencida");

  // D) Con la cuenta ya activa, la ficha sigue sincronizando el estado como antes
  await prisma.usuario.update({ where: { id: cuentaId }, data: { estado: "activo" } });
  await profes.actualizarProfesor(`${P}-1`, { estado: "inactivo" });
  ok("D: cuenta activa: desactivar desde la ficha la desactiva", await estado(), "inactivo");

  // Correo: una conexión reutilizable (pool) y tandas cortas desde el client
  const smtp = new SmtpMailer({ host: "localhost", port: 2525, secure: false, user: "u", pass: "p", from: "a@b.test" });
  const opcionesDelTransporte = (smtp as unknown as { transporte: { options: { pool?: boolean } } }).transporte.options;
  ok("SMTP: reutiliza la conexión (pool)", String(opcionesDelTransporte.pool), "true");
  ok("client: tanda de invitaciones de 20 como máximo", si(TAMANO_TANDA <= 20), "sí");

  await limpiar();
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: P } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
