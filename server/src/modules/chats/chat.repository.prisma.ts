import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { ChatRepository } from "./chat.repository";
import type { Chat, ResumenChat } from "./chat.entity";
import type { Lector, Mensaje, RolEmisorMensaje } from "./mensaje.entity";

// El schema de Prisma reutiliza el enum Rol (admin/secretario/profesor/padre)
// para Mensaje.rolEmisor por simplicidad — un profesor nunca manda mensajes
// en la práctica (ChatService no expone esa ruta), pero el tipo de columna
// es más ancho que RolEmisorMensaje. Angostarlo acá es seguro.
const aMensaje = (fila: { rolEmisor: string } & Omit<Mensaje, "rolEmisor">): Mensaje => ({
  ...fila,
  rolEmisor: fila.rolEmisor as RolEmisorMensaje,
});

// Los mensajes "del otro lado" según quién lee: el instituto lee los de la familia y la familia los del instituto.
const delOtroLado = (lector: Lector): Prisma.MensajeWhereInput =>
  lector === "instituto" ? { rolEmisor: "padre" } : { rolEmisor: { in: ["admin", "secretario"] } };

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Chat | null> {
    return this.client(tx).chat.findUnique({ where: { id } });
  }

  async findByPadreId(padreId: string, tx?: unknown): Promise<Chat | null> {
    return this.client(tx).chat.findUnique({ where: { padreId } });
  }

  async findAll(tx?: unknown): Promise<Chat[]> {
    return this.client(tx).chat.findMany();
  }

  async create(entidad: Chat, tx?: unknown): Promise<Chat> {
    return this.client(tx).chat.create({ data: entidad });
  }

  async update(id: string, entidad: Chat, tx?: unknown): Promise<Chat> {
    try {
      return await this.client(tx).chat.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Chat", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).chat.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Chat", id);
    }
  }

  async agregarMensaje(mensaje: Mensaje, tx?: unknown): Promise<Mensaje> {
    const fila = await this.client(tx).mensaje.create({ data: mensaje });
    return aMensaje(fila);
  }

  async findMensajesByChatId(chatId: string, tx?: unknown): Promise<Mensaje[]> {
    const filas = await this.client(tx).mensaje.findMany({ where: { chatId }, orderBy: { fecha: "asc" } });
    return filas.map(aMensaje);
  }

  async marcarVistos(chatId: string, lector: Lector, ahora: Date, hasta?: Date, tx?: unknown): Promise<number> {
    const { count } = await this.client(tx).mensaje.updateMany({
      where: { chatId, vistoEn: null, ...delOtroLado(lector), ...(hasta ? { fecha: { lte: hasta } } : {}) },
      data: { vistoEn: ahora },
    });
    return count;
  }

  async contarNoVistos(chatId: string, lector: Lector, tx?: unknown): Promise<number> {
    return this.client(tx).mensaje.count({ where: { chatId, vistoEn: null, ...delOtroLado(lector) } });
  }

  async contarConversacionesConNoVistos(tx?: unknown): Promise<number> {
    return this.client(tx).chat.count({ where: { mensajes: { some: { vistoEn: null, ...delOtroLado("instituto") } } } });
  }

  async findResumenes(tx?: unknown): Promise<ResumenChat[]> {
    const db = this.client(tx);
    const [chats, sinVer] = await Promise.all([
      db.chat.findMany({
        include: {
          padre: { select: { nombre: true, apellido: true, alumnos: { select: { nombre: true, apellido: true } } } },
          mensajes: { orderBy: { fecha: "desc" }, take: 1 },
        },
      }),
      db.mensaje.groupBy({ by: ["chatId"], where: { vistoEn: null, ...delOtroLado("instituto") }, _count: { _all: true } }),
    ]);
    const noLeidos = new Map(sinVer.map((g) => [g.chatId, g._count._all]));
    const resumenes: ResumenChat[] = chats.map((c) => {
      const ultimo = c.mensajes[0];
      return {
        chatId: c.id,
        padreId: c.padreId,
        padreNombre: `${c.padre.nombre} ${c.padre.apellido}`,
        hijos: c.padre.alumnos.map((a) => `${a.nombre} ${a.apellido}`),
        ultimoMensaje: ultimo ? { texto: ultimo.texto, fecha: ultimo.fecha, delInstituto: ultimo.rolEmisor !== "padre" } : null,
        noLeidos: noLeidos.get(c.id) ?? 0,
        creadoEn: c.creadoEn,
      };
    });
    // Por el último mensaje (el más reciente primero); las conversaciones sin mensajes van al final, por su creación.
    return resumenes.sort((a, b) => {
      if (a.ultimoMensaje && b.ultimoMensaje) return b.ultimoMensaje.fecha.getTime() - a.ultimoMensaje.fecha.getTime();
      if (a.ultimoMensaje) return -1;
      if (b.ultimoMensaje) return 1;
      return b.creadoEn.getTime() - a.creadoEn.getTime();
    });
  }
}
