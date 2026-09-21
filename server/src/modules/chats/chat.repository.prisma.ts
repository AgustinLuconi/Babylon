import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { ChatRepository } from "./chat.repository";
import type { Chat } from "./chat.entity";
import type { Mensaje, RolEmisorMensaje } from "./mensaje.entity";

// El schema de Prisma reutiliza el enum Rol (admin/secretario/profesor/padre)
// para Mensaje.rolEmisor por simplicidad — un profesor nunca manda mensajes
// en la práctica (ChatService no expone esa ruta), pero el tipo de columna
// es más ancho que RolEmisorMensaje. Angostarlo acá es seguro.
const aMensaje = (fila: { rolEmisor: string } & Omit<Mensaje, "rolEmisor">): Mensaje => ({
  ...fila,
  rolEmisor: fila.rolEmisor as RolEmisorMensaje,
});

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
}
