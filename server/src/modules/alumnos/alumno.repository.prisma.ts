import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { AlumnoRepository } from "./alumno.repository";
import type { Alumno } from "./alumno.entity";

type FilaAlumno = Awaited<ReturnType<PrismaClient["alumno"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaAlumno): Alumno {
  return {
    ...fila,
    direccion: fila.direccion ?? undefined,
    telefono: fila.telefono ?? undefined,
    email: fila.email ?? undefined,
    foto: fila.foto ?? undefined,
    observacionesMedicas: fila.observacionesMedicas ?? undefined,
    cursoId: fila.cursoId ?? undefined,
    padreId: fila.padreId ?? undefined,
  };
}

export class PrismaAlumnoRepository implements AlumnoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Alumno | null> {
    const fila = await this.client(tx).alumno.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByDni(dni: string, tx?: unknown): Promise<Alumno | null> {
    const fila = await this.client(tx).alumno.findUnique({ where: { dni } });
    return fila ? aEntidad(fila) : null;
  }

  async findByPadreId(padreId: string, tx?: unknown): Promise<Alumno[]> {
    const filas = await this.client(tx).alumno.findMany({ where: { padreId } });
    return filas.map(aEntidad);
  }

  async findByCursoId(cursoId: string, tx?: unknown): Promise<Alumno[]> {
    const filas = await this.client(tx).alumno.findMany({ where: { cursoId } });
    return filas.map(aEntidad);
  }

  async findAll(tx?: unknown): Promise<Alumno[]> {
    const filas = await this.client(tx).alumno.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Alumno, tx?: unknown): Promise<Alumno> {
    const fila = await this.client(tx).alumno.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Alumno, tx?: unknown): Promise<Alumno> {
    try {
      const fila = await this.client(tx).alumno.update({
        where: { id },
        data: {
          ...entidad,
          direccion: entidad.direccion ?? null,
          telefono: entidad.telefono ?? null,
          email: entidad.email ?? null,
          foto: entidad.foto ?? null,
          observacionesMedicas: entidad.observacionesMedicas ?? null,
          cursoId: entidad.cursoId ?? null,
          padreId: entidad.padreId ?? null,
        },
      });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Alumno", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).alumno.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Alumno", id);
    }
  }
}
