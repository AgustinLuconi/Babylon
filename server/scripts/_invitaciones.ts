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
  prisma.padre.create({ data: { id: `${P}-p${n}`, nombre: "Pruebainv", apellido: `Padre ${n}`, dni: `9900000${n}`, email } });

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
  const logOriginal = console.error;
  console.error = () => {}; // el servicio registra la falla del correo: acá es esperada
  const rf = await svc.invitar([`${P}-p4`], [], ahora);
  console.error = logOriginal;
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
