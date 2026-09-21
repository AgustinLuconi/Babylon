import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { CursoRepository } from "./curso.repository";
import type { Curso } from "./curso.entity";
import type { Horario } from "./horario.entity";

type FilaCurso = Awaited<ReturnType<PrismaClient["curso"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaCurso): Curso {
  return { ...fila, aula: fila.aula ?? undefined };
}

export class PrismaCursoRepository implements CursoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Curso | null> {
    const fila = await this.client(tx).curso.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByProfesorId(profesorId: string, tx?: unknown): Promise<Curso[]> {
    const filas = await this.client(tx).curso.findMany({ where: { profesorId } });
    return filas.map(aEntidad);
  }

  async findByCicloId(cicloId: string, tx?: unknown): Promise<Curso[]> {
    const filas = await this.client(tx).curso.findMany({ where: { cicloId } });
    return filas.map(aEntidad);
  }

  async findAll(tx?: unknown): Promise<Curso[]> {
    const filas = await this.client(tx).curso.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Curso, tx?: unknown): Promise<Curso> {
    const fila = await this.client(tx).curso.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Curso, tx?: unknown): Promise<Curso> {
    try {
      const fila = await this.client(tx).curso.update({ where: { id }, data: entidad });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Curso", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).curso.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Curso", id);
    }
  }

  async agregarHorario(horario: Horario, tx?: unknown): Promise<Horario> {
    return this.client(tx).horario.create({ data: horario });
  }

  async findHorariosByCursoId(cursoId: string, tx?: unknown): Promise<Horario[]> {
    return this.client(tx).horario.findMany({ where: { cursoId } });
  }

  async findAllHorarios(tx?: unknown): Promise<Horario[]> {
    return this.client(tx).horario.findMany();
  }

  async eliminarHorariosByCursoId(cursoId: string, tx?: unknown): Promise<void> {
    await this.client(tx).horario.deleteMany({ where: { cursoId } });
  }
}
