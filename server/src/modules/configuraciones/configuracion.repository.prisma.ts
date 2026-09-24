import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { ConfiguracionRepository } from "./configuracion.repository";
import { ID_CONFIGURACION, type Configuracion } from "./configuracion.entity";

export class PrismaConfiguracionRepository implements ConfiguracionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async obtener(tx?: unknown): Promise<Configuracion> {
    return this.client(tx).configuracion.upsert({
      where: { id: ID_CONFIGURACION },
      update: {},
      create: { id: ID_CONFIGURACION, valorCuota: null },
    });
  }

  async findById(id: string, tx?: unknown): Promise<Configuracion | null> {
    return this.client(tx).configuracion.findUnique({ where: { id } });
  }

  async findAll(tx?: unknown): Promise<Configuracion[]> {
    return this.client(tx).configuracion.findMany();
  }

  async create(entidad: Configuracion, tx?: unknown): Promise<Configuracion> {
    return this.client(tx).configuracion.create({ data: entidad });
  }

  async update(id: string, entidad: Configuracion, tx?: unknown): Promise<Configuracion> {
    try {
      return await this.client(tx).configuracion.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Configuracion", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).configuracion.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Configuracion", id);
    }
  }
}
