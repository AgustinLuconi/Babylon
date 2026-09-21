import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { ObservacionRepository } from "./observacion.repository";
import type { CategoriaPersonalizada, Observacion } from "./observacion.entity";

export class PrismaObservacionRepository implements ObservacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Observacion | null> {
    return this.client(tx).observacion.findUnique({ where: { id } });
  }

  async findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Observacion[]> {
    return this.client(tx).observacion.findMany({ where: { alumnoId } });
  }

  async findAll(tx?: unknown): Promise<Observacion[]> {
    return this.client(tx).observacion.findMany();
  }

  async create(entidad: Observacion, tx?: unknown): Promise<Observacion> {
    return this.client(tx).observacion.create({ data: entidad });
  }

  async update(id: string, entidad: Observacion, tx?: unknown): Promise<Observacion> {
    try {
      return await this.client(tx).observacion.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Observacion", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).observacion.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Observacion", id);
    }
  }

  async crearCategoriaPersonalizada(categoria: CategoriaPersonalizada, tx?: unknown): Promise<CategoriaPersonalizada> {
    return this.client(tx).categoriaPersonalizada.create({ data: categoria });
  }

  async findCategoriaPersonalizadaById(id: string, tx?: unknown): Promise<CategoriaPersonalizada | null> {
    return this.client(tx).categoriaPersonalizada.findUnique({ where: { id } });
  }

  async findCategoriasPersonalizadasByCursoId(cursoId: string, tx?: unknown): Promise<CategoriaPersonalizada[]> {
    return this.client(tx).categoriaPersonalizada.findMany({ where: { cursoId } });
  }
}
