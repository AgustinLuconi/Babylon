import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { AsistenciaRepository } from "./asistencia.repository";
import type { Asistencia } from "./asistencia.entity";

type FilaAsistencia = Awaited<ReturnType<PrismaClient["asistencia"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaAsistencia): Asistencia {
  return { ...fila, minutosRetraso: fila.minutosRetraso ?? undefined, motivo: fila.motivo ?? undefined };
}

export class PrismaAsistenciaRepository implements AsistenciaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Asistencia | null> {
    const fila = await this.client(tx).asistencia.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByAlumnoCursoFecha(
    alumnoId: string,
    cursoId: string,
    fecha: Date,
    tx?: unknown,
  ): Promise<Asistencia | null> {
    const fila = await this.client(tx).asistencia.findUnique({
      where: { alumnoId_cursoId_fecha: { alumnoId, cursoId, fecha } },
    });
    return fila ? aEntidad(fila) : null;
  }

  async findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Asistencia[]> {
    const filas = await this.client(tx).asistencia.findMany({ where: { alumnoId }, orderBy: { fecha: "desc" } });
    return filas.map(aEntidad);
  }

  async findAll(tx?: unknown): Promise<Asistencia[]> {
    const filas = await this.client(tx).asistencia.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Asistencia, tx?: unknown): Promise<Asistencia> {
    const fila = await this.client(tx).asistencia.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Asistencia, tx?: unknown): Promise<Asistencia> {
    try {
      const fila = await this.client(tx).asistencia.update({ where: { id }, data: entidad });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Asistencia", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).asistencia.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Asistencia", id);
    }
  }
}
