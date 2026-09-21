import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { CicloRepository } from "./ciclo.repository";
import type { Ciclo } from "./ciclo.entity";
import type { Inscripcion } from "./inscripcion.entity";

export class PrismaCicloRepository implements CicloRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Ciclo | null> {
    return this.client(tx).ciclo.findUnique({ where: { id } });
  }

  async findByAnio(anio: number, tx?: unknown): Promise<Ciclo | null> {
    return this.client(tx).ciclo.findUnique({ where: { anio } });
  }

  async findActivo(tx?: unknown): Promise<Ciclo | null> {
    return this.client(tx).ciclo.findFirst({ where: { activo: true } });
  }

  async desactivarTodos(tx?: unknown): Promise<void> {
    await this.client(tx).ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
  }

  async findAll(tx?: unknown): Promise<Ciclo[]> {
    return this.client(tx).ciclo.findMany({ orderBy: { anio: "desc" } });
  }

  async create(entidad: Ciclo, tx?: unknown): Promise<Ciclo> {
    return this.client(tx).ciclo.create({ data: entidad });
  }

  async update(id: string, entidad: Ciclo, tx?: unknown): Promise<Ciclo> {
    try {
      return await this.client(tx).ciclo.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Ciclo", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).ciclo.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Ciclo", id);
    }
  }

  async crearInscripcion(inscripcion: Inscripcion, tx?: unknown): Promise<Inscripcion> {
    return this.client(tx).inscripcion.create({ data: inscripcion });
  }

  async actualizarInscripcion(
    alumnoId: string,
    cicloId: string,
    datos: Partial<Pick<Inscripcion, "cursoId" | "aplicaDescuentoHermanos">>,
    tx?: unknown,
  ): Promise<Inscripcion> {
    return this.client(tx).inscripcion.update({
      where: { alumnoId_cicloId: { alumnoId, cicloId } },
      data: datos,
    });
  }

  async findInscripcionByAlumnoYCiclo(alumnoId: string, cicloId: string, tx?: unknown): Promise<Inscripcion | null> {
    return this.client(tx).inscripcion.findUnique({ where: { alumnoId_cicloId: { alumnoId, cicloId } } });
  }

  async findInscripcionesByAlumnoId(alumnoId: string, tx?: unknown): Promise<Inscripcion[]> {
    return this.client(tx).inscripcion.findMany({ where: { alumnoId } });
  }

  async findInscripcionesByCicloId(cicloId: string, tx?: unknown): Promise<Inscripcion[]> {
    return this.client(tx).inscripcion.findMany({ where: { cicloId } });
  }
}
