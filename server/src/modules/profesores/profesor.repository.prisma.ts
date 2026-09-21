import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { ProfesorRepository } from "./profesor.repository";
import type { Profesor } from "./profesor.entity";

type FilaProfesor = Awaited<ReturnType<PrismaClient["profesor"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaProfesor): Profesor {
  return {
    ...fila,
    apellido: fila.apellido ?? undefined,
    dni: fila.dni ?? undefined,
    telefono: fila.telefono ?? undefined,
    email: fila.email ?? undefined,
    usuarioId: fila.usuarioId ?? undefined,
  };
}

export class PrismaProfesorRepository implements ProfesorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Profesor | null> {
    const fila = await this.client(tx).profesor.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Profesor | null> {
    const fila = await this.client(tx).profesor.findUnique({ where: { usuarioId } });
    return fila ? aEntidad(fila) : null;
  }

  async findByDni(dni: string, tx?: unknown): Promise<Profesor | null> {
    const fila = await this.client(tx).profesor.findUnique({ where: { dni } });
    return fila ? aEntidad(fila) : null;
  }

  async findAll(tx?: unknown): Promise<Profesor[]> {
    const filas = await this.client(tx).profesor.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Profesor, tx?: unknown): Promise<Profesor> {
    const fila = await this.client(tx).profesor.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Profesor, tx?: unknown): Promise<Profesor> {
    try {
      const fila = await this.client(tx).profesor.update({
        where: { id },
        data: {
          ...entidad,
          apellido: entidad.apellido ?? null,
          dni: entidad.dni ?? null,
          telefono: entidad.telefono ?? null,
          email: entidad.email ?? null,
          usuarioId: entidad.usuarioId ?? null,
        },
      });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Profesor", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).profesor.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Profesor", id);
    }
  }
}
