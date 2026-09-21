import type { Evaluacion, PeriodoAcademico } from "./evaluacion.entity";
import type { Calificacion } from "./calificacion.entity";
import type { NotaCierre } from "./notaCierre.entity";

export interface CalificacionRepository {
  crearEvaluacion(evaluacion: Evaluacion, tx?: unknown): Promise<Evaluacion>;
  actualizarEvaluacion(id: string, evaluacion: Evaluacion, tx?: unknown): Promise<Evaluacion>;
  findEvaluacionById(id: string, tx?: unknown): Promise<Evaluacion | null>;
  findEvaluacionesByCursoId(cursoId: string, tx?: unknown): Promise<Evaluacion[]>;

  guardarCalificacion(calificacion: Calificacion, tx?: unknown): Promise<Calificacion>;
  findCalificacionesByAlumnoId(alumnoId: string, tx?: unknown): Promise<Calificacion[]>;
  findCalificacionesByEvaluacionId(evaluacionId: string, tx?: unknown): Promise<Calificacion[]>;

  guardarNotaCierre(notaCierre: NotaCierre, tx?: unknown): Promise<NotaCierre>;
  findNotaCierreById(id: string, tx?: unknown): Promise<NotaCierre | null>;
  findNotaCierre(alumnoId: string, cursoId: string, periodo: PeriodoAcademico, tx?: unknown): Promise<NotaCierre | null>;
  findNotasCierreByAlumnoId(alumnoId: string, tx?: unknown): Promise<NotaCierre[]>;
  findNotasCierreByCursoId(cursoId: string, periodo: PeriodoAcademico, tx?: unknown): Promise<NotaCierre[]>;
}
