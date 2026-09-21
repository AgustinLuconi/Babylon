import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Rol, UnitOfWork } from "../../core/ports";
import type { CursoRepository } from "../cursos/curso.repository";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { CalificacionRepository } from "./calificacion.repository";
import type { Evaluacion } from "./evaluacion.entity";
import type { Calificacion } from "./calificacion.entity";
import type { NotaCierre } from "./notaCierre.entity";
import type { CargarCalificacionesInput, CargarNotaCierreInput, CrearEvaluacionInput } from "./calificacion.schema";

export interface Solicitante {
  rol: Rol;
  padreId?: string;
}

export interface CalificacionConEvaluacion extends Calificacion {
  evaluacionNombre: string;
  evaluacionTipo: string;
  evaluacionFecha: Date;
  evaluacionPeriodo: string;
}

export class CalificacionService {
  constructor(
    private readonly calificacionRepo: CalificacionRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  private async verificarDuenoDelCurso(cursoId: string, profesorId: string): Promise<void> {
    const curso = await this.cursoRepo.findById(cursoId);
    if (!curso) {
      throw new EntityNotFoundError("Curso", cursoId);
    }
    if (curso.profesorId !== profesorId) {
      throw new AuthorizationError("Un profesor solo puede operar sobre sus propios cursos");
    }
  }

  private async verificarAccesoAlAlumno(alumnoId: string, solicitante: Solicitante): Promise<void> {
    if (solicitante.rol !== "padre") return;

    const alumno = await this.alumnoRepo.findById(alumnoId);
    if (!alumno || alumno.padreId !== solicitante.padreId) {
      throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
    }
  }

  async listarEvaluacionesPorCurso(cursoId: string, profesorId?: string): Promise<Evaluacion[]> {
    if (profesorId) {
      await this.verificarDuenoDelCurso(cursoId, profesorId);
    }
    return this.calificacionRepo.findEvaluacionesByCursoId(cursoId);
  }

  async listarCalificacionesDeEvaluacion(evaluacionId: string, profesorId?: string): Promise<Calificacion[]> {
    const evaluacion = await this.calificacionRepo.findEvaluacionById(evaluacionId);
    if (!evaluacion) {
      throw new EntityNotFoundError("Evaluacion", evaluacionId);
    }
    if (profesorId) {
      await this.verificarDuenoDelCurso(evaluacion.cursoId, profesorId);
    }
    return this.calificacionRepo.findCalificacionesByEvaluacionId(evaluacionId);
  }

  async crearEvaluacion(datos: CrearEvaluacionInput, profesorId: string): Promise<Evaluacion> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);

    const evaluacion: Evaluacion = {
      id: randomUUID(),
      cursoId: datos.cursoId,
      nombre: datos.nombre,
      tipo: datos.tipo,
      fecha: datos.fecha,
      periodo: datos.periodo,
      escala: datos.escala,
      estado: "borrador",
    };
    return this.calificacionRepo.crearEvaluacion(evaluacion);
  }

  async publicarEvaluacion(evaluacionId: string, profesorId: string): Promise<Evaluacion> {
    const evaluacion = await this.calificacionRepo.findEvaluacionById(evaluacionId);
    if (!evaluacion) {
      throw new EntityNotFoundError("Evaluacion", evaluacionId);
    }
    await this.verificarDuenoDelCurso(evaluacion.cursoId, profesorId);

    return this.calificacionRepo.actualizarEvaluacion(evaluacionId, { ...evaluacion, estado: "publicada" });
  }

  // Todo o nada: si algún alumno de la lista no pertenece a la nómina del
  // curso de la evaluación, no se guarda ninguna nota — mismo patrón que
  // AsistenciaService.registrarAsistenciaMasiva.
  async cargarCalificaciones(
    evaluacionId: string,
    datos: CargarCalificacionesInput,
    profesorId: string,
  ): Promise<Calificacion[]> {
    const evaluacion = await this.calificacionRepo.findEvaluacionById(evaluacionId);
    if (!evaluacion) {
      throw new EntityNotFoundError("Evaluacion", evaluacionId);
    }
    await this.verificarDuenoDelCurso(evaluacion.cursoId, profesorId);

    const nomina = await this.alumnoRepo.findByCursoId(evaluacion.cursoId);
    const idsNomina = new Set(nomina.map((alumno) => alumno.id));

    return this.unitOfWork.runInTransaction(async (tx) => {
      const calificaciones: Calificacion[] = [];
      for (const nota of datos.notas) {
        if (!idsNomina.has(nota.alumnoId)) {
          throw new ValidationError(`El alumno ${nota.alumnoId} no pertenece a la nómina de este curso`);
        }

        const calificacion: Calificacion = {
          id: randomUUID(),
          evaluacionId,
          alumnoId: nota.alumnoId,
          nota: nota.nota,
          observacion: nota.observacion,
        };
        calificaciones.push(await this.calificacionRepo.guardarCalificacion(calificacion, tx));
      }
      return calificaciones;
    });
  }

  async cargarNotaCierre(datos: CargarNotaCierreInput, profesorId: string): Promise<NotaCierre> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);

    const existente = await this.calificacionRepo.findNotaCierre(datos.alumnoId, datos.cursoId, datos.periodo);
    const notaCierre: NotaCierre = {
      id: existente?.id ?? randomUUID(),
      alumnoId: datos.alumnoId,
      cursoId: datos.cursoId,
      periodo: datos.periodo,
      nota: datos.nota,
      observacion: datos.observacion,
      estado: "borrador",
    };
    return this.calificacionRepo.guardarNotaCierre(notaCierre);
  }

  async publicarNotaCierre(notaCierreId: string, profesorId: string): Promise<NotaCierre> {
    const notaCierre = await this.calificacionRepo.findNotaCierreById(notaCierreId);
    if (!notaCierre) {
      throw new EntityNotFoundError("NotaCierre", notaCierreId);
    }
    await this.verificarDuenoDelCurso(notaCierre.cursoId, profesorId);

    return this.calificacionRepo.guardarNotaCierre({ ...notaCierre, estado: "publicada" });
  }

  async listarCalificacionesDeAlumno(alumnoId: string, solicitante: Solicitante): Promise<CalificacionConEvaluacion[]> {
    await this.verificarAccesoAlAlumno(alumnoId, solicitante);

    const calificaciones = await this.calificacionRepo.findCalificacionesByAlumnoId(alumnoId);

    const enriquecidas: CalificacionConEvaluacion[] = [];
    for (const calificacion of calificaciones) {
      const evaluacion = await this.calificacionRepo.findEvaluacionById(calificacion.evaluacionId);
      if (!evaluacion) continue;
      // El padre nunca ve calificaciones de evaluaciones que siguen en borrador.
      if (solicitante.rol === "padre" && evaluacion.estado !== "publicada") continue;

      enriquecidas.push({
        ...calificacion,
        evaluacionNombre: evaluacion.nombre,
        evaluacionTipo: evaluacion.tipo,
        evaluacionFecha: evaluacion.fecha,
        evaluacionPeriodo: evaluacion.periodo,
      });
    }
    return enriquecidas;
  }

  async listarNotasCierrePorCurso(
    cursoId: string,
    periodo: "julio" | "noviembre",
    profesorId?: string,
  ): Promise<NotaCierre[]> {
    if (profesorId) {
      await this.verificarDuenoDelCurso(cursoId, profesorId);
    }
    return this.calificacionRepo.findNotasCierreByCursoId(cursoId, periodo);
  }

  async listarNotasCierreDeAlumno(alumnoId: string, solicitante: Solicitante): Promise<NotaCierre[]> {
    await this.verificarAccesoAlAlumno(alumnoId, solicitante);

    const notas = await this.calificacionRepo.findNotasCierreByAlumnoId(alumnoId);
    if (solicitante.rol !== "padre") {
      return notas;
    }
    return notas.filter((nota) => nota.estado === "publicada");
  }
}
