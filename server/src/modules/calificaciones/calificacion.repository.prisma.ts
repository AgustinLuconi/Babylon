import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { CalificacionRepository } from "./calificacion.repository";
import type { Evaluacion, PeriodoAcademico } from "./evaluacion.entity";
import type { Calificacion } from "./calificacion.entity";
import type { NotaCierre } from "./notaCierre.entity";

type FilaCalificacion = Awaited<ReturnType<PrismaClient["calificacion"]["findUniqueOrThrow"]>>;
type FilaNotaCierre = Awaited<ReturnType<PrismaClient["notaCierre"]["findUniqueOrThrow"]>>;

const aCalificacion = (fila: FilaCalificacion): Calificacion => ({
  ...fila,
  observacion: fila.observacion ?? undefined,
});

const aNotaCierre = (fila: FilaNotaCierre): NotaCierre => ({
  ...fila,
  observacion: fila.observacion ?? undefined,
});

export class PrismaCalificacionRepository implements CalificacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async crearEvaluacion(evaluacion: Evaluacion, tx?: unknown): Promise<Evaluacion> {
    return this.client(tx).evaluacion.create({ data: evaluacion });
  }

  async actualizarEvaluacion(id: string, evaluacion: Evaluacion, tx?: unknown): Promise<Evaluacion> {
    try {
      return await this.client(tx).evaluacion.update({ where: { id }, data: evaluacion });
    } catch {
      throw new EntityNotFoundError("Evaluacion", id);
    }
  }

  async findEvaluacionById(id: string, tx?: unknown): Promise<Evaluacion | null> {
    return this.client(tx).evaluacion.findUnique({ where: { id } });
  }

  async findEvaluacionesByCursoId(cursoId: string, tx?: unknown): Promise<Evaluacion[]> {
    return this.client(tx).evaluacion.findMany({ where: { cursoId } });
  }

  async guardarCalificacion(calificacion: Calificacion, tx?: unknown): Promise<Calificacion> {
    const fila = await this.client(tx).calificacion.upsert({
      where: { evaluacionId_alumnoId: { evaluacionId: calificacion.evaluacionId, alumnoId: calificacion.alumnoId } },
      create: calificacion,
      update: calificacion,
    });
    return aCalificacion(fila);
  }

  async findCalificacionesByAlumnoId(alumnoId: string, tx?: unknown): Promise<Calificacion[]> {
    const filas = await this.client(tx).calificacion.findMany({ where: { alumnoId } });
    return filas.map(aCalificacion);
  }

  async findCalificacionesByEvaluacionId(evaluacionId: string, tx?: unknown): Promise<Calificacion[]> {
    const filas = await this.client(tx).calificacion.findMany({ where: { evaluacionId } });
    return filas.map(aCalificacion);
  }

  async guardarNotaCierre(notaCierre: NotaCierre, tx?: unknown): Promise<NotaCierre> {
    const fila = await this.client(tx).notaCierre.upsert({
      where: { id: notaCierre.id },
      create: notaCierre,
      update: notaCierre,
    });
    return aNotaCierre(fila);
  }

  async findNotaCierreById(id: string, tx?: unknown): Promise<NotaCierre | null> {
    const fila = await this.client(tx).notaCierre.findUnique({ where: { id } });
    return fila ? aNotaCierre(fila) : null;
  }

  async findNotaCierre(
    alumnoId: string,
    cursoId: string,
    periodo: PeriodoAcademico,
    tx?: unknown,
  ): Promise<NotaCierre | null> {
    const fila = await this.client(tx).notaCierre.findUnique({
      where: { alumnoId_cursoId_periodo: { alumnoId, cursoId, periodo } },
    });
    return fila ? aNotaCierre(fila) : null;
  }

  async findNotasCierreByAlumnoId(alumnoId: string, tx?: unknown): Promise<NotaCierre[]> {
    const filas = await this.client(tx).notaCierre.findMany({ where: { alumnoId } });
    return filas.map(aNotaCierre);
  }

  async findNotasCierreByCursoId(cursoId: string, periodo: PeriodoAcademico, tx?: unknown): Promise<NotaCierre[]> {
    const filas = await this.client(tx).notaCierre.findMany({ where: { cursoId, periodo } });
    return filas.map(aNotaCierre);
  }
}
