import type { Prisma, PrismaClient } from "@prisma/client";
import { traducirErrorDeEscritura } from "../../core/adapters/prismaErrores";
import { EntityNotFoundError } from "../../core/errors";
import type { AsistenciaRepository } from "./asistencia.repository";
import type { Asistencia, ClaseSinDictar } from "./asistencia.entity";

type FilaAsistencia = Awaited<ReturnType<PrismaClient["asistencia"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaAsistencia): Asistencia {
  return { ...fila, minutosRetraso: fila.minutosRetraso ?? undefined, motivo: fila.motivo ?? undefined };
}

type FilaClaseSinDictar = Awaited<ReturnType<PrismaClient["claseSinDictar"]["findUniqueOrThrow"]>>;

function claseAEntidad(fila: FilaClaseSinDictar): ClaseSinDictar {
  return { ...fila, motivo: fila.motivo ?? undefined };
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

  async findClaseSinDictar(cursoId: string, fecha: Date, tx?: unknown): Promise<ClaseSinDictar | null> {
    const fila = await this.client(tx).claseSinDictar.findUnique({ where: { cursoId_fecha: { cursoId, fecha } } });
    return fila ? claseAEntidad(fila) : null;
  }

  async crearClaseSinDictar(clase: ClaseSinDictar, tx?: unknown): Promise<ClaseSinDictar> {
    return claseAEntidad(await this.client(tx).claseSinDictar.create({ data: clase }));
  }

  async actualizarMotivoDeClaseSinDictar(id: string, motivo: string | null, tx?: unknown): Promise<ClaseSinDictar> {
    try {
      return claseAEntidad(await this.client(tx).claseSinDictar.update({ where: { id }, data: { motivo } }));
    } catch (error) {
      throw traducirErrorDeEscritura(error, "Clase sin dictar", id);
    }
  }

  async eliminarClaseSinDictar(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).claseSinDictar.delete({ where: { id } });
    } catch (error) {
      throw traducirErrorDeEscritura(error, "Clase sin dictar", id);
    }
  }

  async findSinDictarByCursoId(cursoId: string, tx?: unknown): Promise<ClaseSinDictar[]> {
    const filas = await this.client(tx).claseSinDictar.findMany({ where: { cursoId }, orderBy: [{ fecha: "desc" }, { id: "asc" }] });
    return filas.map(claseAEntidad);
  }

  async findSinDictarByAlumnoId(alumnoId: string, tx?: unknown): Promise<ClaseSinDictar[]> {
    const filas = await this.client(tx).claseSinDictar.findMany({
      where: { curso: { inscripciones: { some: { alumnoId } } } },
      orderBy: [{ fecha: "desc" }, { id: "asc" }],
    });
    return filas.map(claseAEntidad);
  }

  async contarRegistrosDelDia(cursoId: string, fecha: Date, tx?: unknown): Promise<number> {
    return this.client(tx).asistencia.count({ where: { cursoId, fecha } });
  }

  async bloquearClase(cursoId: string, fecha: Date, tx?: unknown): Promise<void> {
    const clave = `asistencia:${cursoId}:${fecha.toISOString().slice(0, 10)}`;
    await this.client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))`;
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
