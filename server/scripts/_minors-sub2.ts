import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { Mailer, MensajeCorreo } from "../src/core/ports";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PadreService } from "../src/modules/padres/padre.service";
import type { PadreRepository } from "../src/modules/padres/padre.repository";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import type { ProfesorRepository } from "../src/modules/profesores/profesor.repository";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { InvitacionService } from "../src/modules/usuarios/invitacion.service";
import { PrismaSesionRepository } from "../src/modules/usuarios/sesion.repository.prisma";
import type { UsuarioRepository } from "../src/modules/usuarios/usuario.repository";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { UsuarioService } from "../src/modules/usuarios/usuario.service";
import { ok } from "./_check";

const prisma = new PrismaClient();
class CapturaMailer implements Mailer {
  enviados: MensajeCorreo[] = [];
  fallar = false;
  async enviar(m: MensajeCorreo) {
    if (this.fallar) throw new Error("SMTP caído (simulado)");
    this.enviados.push(m);
  }
}
const mailer = new CapturaMailer();
const usuarioRepo = new PrismaUsuarioRepository(prisma);
const padreRepo = new PrismaPadreRepository(prisma);
const profesorRepo = new PrismaProfesorRepository(prisma);
const uow = new PrismaUnitOfWork(prisma);
const inv = new InvitacionService(usuarioRepo, padreRepo, profesorRepo, uow, mailer);
const usuarios = new UsuarioService(usuarioRepo, new PrismaSesionRepository(prisma), profesorRepo, uow, mailer, inv);
const padres = new PadreService(padreRepo, usuarioRepo, new PrismaAlumnoRepository(prisma), uow, inv);
const P = "prueba-tmp-m2";
const MIN = 60_000;
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
const silencio = async <T>(f: () => Promise<T>): Promise<T> => {
  const original = console.error;
  console.error = () => {}; // los servicios registran las fallas de correo: acá son esperadas
  try {
    return await f();
  } finally {
    console.error = original;
  }
};
async function limpiar() {
  const vinculados = [...(await prisma.padre.findMany({ where: { id: { startsWith: P } } })), ...(await prisma.profesor.findMany({ where: { id: { startsWith: P } } }))]
    .map((x) => x.usuarioId)
    .filter((x): x is string => !!x);
  await prisma.padre.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profesor.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { in: vinculados } }, { id: { startsWith: P } }, { email: { startsWith: P } }] } });
}
const padre = (n: number, extra: Record<string, unknown> = {}) =>
  prisma.padre.create({ data: { id: `${P}-p${n}`, nombre: "Pruebainv", apellido: `Padre ${n}`, dni: `9930000${n}`, email: `${P}-${n}@x.test`, ...extra } });
const cuentaDe = async (id: string) => (await prisma.padre.findUniqueOrThrow({ where: { id } })).usuarioId!;

(async () => {
  await limpiar();
  const ahora = new Date();

  // 1) Carrera con la restricción única del email: el lote sigue y la persona figura como "email repetido"
  await prisma.usuario.create({ data: { id: `${P}-ocupante`, nombre: "Ocupa", email: `${P}-1@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
  await padre(1); // su email ya es de otra cuenta
  await padre(2);
  // Un repositorio que "no vio" la cuenta existente: reproduce el instante entre la comprobación y el alta.
  const ciegoAlEmail = new Proxy(usuarioRepo, {
    get(obj, prop, rec) {
      const v = Reflect.get(obj, prop, rec);
      if (prop === "findByEmail") return async () => null;
      return typeof v === "function" ? v.bind(obj) : v;
    },
  }) as UsuarioRepository;
  const invCarrera = new InvitacionService(ciegoAlEmail, padreRepo, profesorRepo, uow, mailer);
  const lote = await silencio(() => invCarrera.invitar([`${P}-p1`, `${P}-p2`], [], ahora).then((r) => r, (e: Error) => e));
  ok("1: la carrera no corta el lote", lote instanceof Error ? lote.name : "devuelve resultados", "devuelve resultados");
  const resultados = Array.isArray(lote) ? lote : [];
  ok("1: la persona del email repetido", resultados.find((r) => r.id === `${P}-p1`)?.motivo, "email repetido");
  ok("1: la siguiente del lote se invita igual", resultados.find((r) => r.id === `${P}-p2`)?.resultado, "enviada");

  // 2) Si el correo no salió, se puede reenviar enseguida (no hay que esperar el minuto)
  await padre(3);
  mailer.fallar = true;
  const rf = await silencio(() => inv.invitar([`${P}-p3`], [], ahora));
  mailer.fallar = false;
  ok("2: el envío fallido se informa", rf[0].motivo, "no se pudo enviar el correo");
  const cuenta3 = await cuentaDe(`${P}-p3`);
  ok("2: no queda un enlace que nadie recibió", await prisma.tokenCuenta.count({ where: { usuarioId: cuenta3 } }), 0);
  ok("2: figura como invitación vencida (para reenviar)", (await inv.listarPendientes(ahora)).find((f) => f.clave === `cuenta:${cuenta3}`)?.etiqueta, "vencida");
  ok("2: reenviar enseguida funciona", (await inv.reenviar([cuenta3], ahora))[0].resultado, "enviada");

  // 3) Verificación del email: si el correo falla se informa y no se consume el límite
  await prisma.usuario.create({ data: { id: `${P}-act`, nombre: "Activa Prueba", email: `${P}-act@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() } });
  mailer.fallar = true;
  ok("3: correo caído al verificar", await silencio(() => rechazo(usuarios.enviarVerificacion(`${P}-act`, ahora))), "ServicioNoDisponibleError");
  mailer.fallar = false;
  ok("3: no queda un enlace sin enviar", await prisma.tokenCuenta.count({ where: { usuarioId: `${P}-act` } }), 0);
  ok("3: reintentar enseguida funciona", await rechazo(usuarios.enviarVerificacion(`${P}-act`, ahora)), "ok");

  // 9) Corregir el email de un padre con la invitación pendiente: llega a la cuenta y anula la invitación vieja
  await padre(4);
  await inv.invitar([`${P}-p4`], [], ahora);
  const cuenta4 = await cuentaDe(`${P}-p4`);
  await padres.actualizarPadre(`${P}-p4`, { email: `${P}-4-corregido@x.test` });
  const u4 = await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta4 } });
  ok("9: el email de la cuenta pendiente se corrigió", u4.email, `${P}-4-corregido@x.test`);
  ok("9: sigue pendiente", u4.estado, "pendiente");
  ok("9: la invitación al email viejo quedó anulada", (await inv.listarPendientes(ahora)).find((f) => f.clave === `cuenta:${cuenta4}`)?.etiqueta, "vencida");
  ok("9: se puede reenviar al email nuevo", (await inv.reenviar([cuenta4], new Date(ahora.getTime() + 2 * MIN)))[0].resultado, "enviada");
  ok("9: el correo salió al email corregido", mailer.enviados.at(-1)?.para, `${P}-4-corregido@x.test`);
  ok("9: corregir a un email ya usado", await rechazo(padres.actualizarPadre(`${P}-p4`, { email: `${P}-act@x.test` })), "ConflictError");
  ok("9: y no cambia nada", (await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta4 } })).email, `${P}-4-corregido@x.test`);

  // 10) Invitar no pisa lo que se editó en la ficha mientras tanto (solo vincula la cuenta)
  await padre(5, { telefono: "NUEVO" });
  await prisma.profesor.create({ data: { id: `${P}-prof`, nombre: "Pruebainv", apellido: "Profe", email: `${P}-prof@x.test`, telefono: "NUEVO", estado: "activo" } });
  const padreViejo = new Proxy(padreRepo, {
    get(obj, prop, rec) {
      const v = Reflect.get(obj, prop, rec);
      if (prop === "findById") return async (id: string, tx?: unknown) => ({ ...(await obj.findById(id, tx))!, telefono: "VIEJO" });
      return typeof v === "function" ? v.bind(obj) : v;
    },
  }) as PadreRepository;
  const profeViejo = new Proxy(profesorRepo, {
    get(obj, prop, rec) {
      const v = Reflect.get(obj, prop, rec);
      if (prop === "findById") return async (id: string, tx?: unknown) => ({ ...(await obj.findById(id, tx))!, telefono: "VIEJO" });
      return typeof v === "function" ? v.bind(obj) : v;
    },
  }) as ProfesorRepository;
  const invViejo = new InvitacionService(usuarioRepo, padreViejo, profeViejo, uow, mailer);
  await invViejo.invitar([`${P}-p5`], [`${P}-prof`], ahora);
  ok("10: el padre quedó vinculado", String((await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p5` } })).usuarioId !== null), "true");
  ok("10: el teléfono editado del padre se conserva", (await prisma.padre.findUniqueOrThrow({ where: { id: `${P}-p5` } })).telefono, "NUEVO");
  ok("10: el profesor quedó vinculado", String((await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-prof` } })).usuarioId !== null), "true");
  ok("10: el teléfono editado del profesor se conserva", (await prisma.profesor.findUniqueOrThrow({ where: { id: `${P}-prof` } })).telefono, "NUEVO");

  // 11) Un profesor solo puede estar activo o inactivo: la base lo impide
  const aceptado = await prisma.$executeRawUnsafe(`INSERT INTO "Profesor"(id, nombre, estado) VALUES ('${P}-estado', 'Pruebainv', 'pendiente')`).then(() => "aceptado", () => "rechazado");
  ok("11: un profesor 'pendiente'", aceptado, "rechazado");

  await limpiar();
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: P } } }) + (await prisma.profesor.count({ where: { id: { startsWith: P } } })), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
