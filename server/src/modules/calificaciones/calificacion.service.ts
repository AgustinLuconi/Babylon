import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { CursoRepository } from "../cursos/curso.repository";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { CalificacionRepository } from "./calificacion.repository";
import type { Evaluacion } from "./evaluacion.entity";
import type { Calificacion } from "./calificacion.entity";
import type { NotaCierre } from "./notaCierre.entity";
import type { CargarCalificacionesInput, CargarNotaCierreInput, CrearEvaluacionInput } from "./calificacion.schema";
import type { EventosCalificaciones } from "./calificacion.eventos";

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
    private readonly anuncios: Publicador<EventosCalificaciones> = sinAnuncios(),
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
    return this.unitOfWork.runInTransaction(async (tx) => {
      const creada = await this.calificacionRepo.crearEvaluacion(evaluacion, tx);
      await this.anuncios.publicar("evaluacion.creada", { evaluacionId: creada.id }, tx);
      return creada;
    });
  }

  async publicarEvaluacion(evaluacionId: string, profesorId: string): Promise<Evaluacion> {
    const evaluacion = await this.calificacionRepo.findEvaluacionById(evaluacionId);
    if (!evaluacion) {
      throw new EntityNotFoundError("Evaluacion", evaluacionId);
    }
    await this.verificarDuenoDelCurso(evaluacion.cursoId, profesorId);

    return this.unitOfWork.runInTransaction(async (tx) => {
      const publicada = await this.calificacionRepo.actualizarEvaluacion(
        evaluacionId,
        { ...evaluacion, estado: "publicada", publicadaEn: evaluacion.publicadaEn ?? new Date() },
        tx,
      );
      await this.anuncios.publicar("evaluacion.publicada", { evaluacionId }, tx);
      return publicada;
    });
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
      await this.anuncios.publicar("calificaciones.cargadas", { evaluacionId, alumnoIds: datos.notas.map((n) => n.alumnoId) }, tx);
      return calificaciones;
    });
  }

  // Notas de cierre de varios alumnos en una sola operación (todo o nada): la pantalla del profesor guarda el curso
  // entero de una vez, con un único anuncio para el lote (antes era un pedido y una transacción por alumno).
  async cargarNotasCierre(notas: CargarNotaCierreInput[], profesorId: string): Promise<NotaCierre[]> {
    for (const cursoId of new Set(notas.map((n) => n.cursoId))) await this.verificarDuenoDelCurso(cursoId, profesorId);

    return this.unitOfWork.runInTransaction(async (tx) => {
      const guardadas: NotaCierre[] = [];
      for (const datos of notas) {
        const existente = await this.calificacionRepo.findNotaCierre(datos.alumnoId, datos.cursoId, datos.periodo, tx);
        const notaCierre: NotaCierre = {
          id: existente?.id ?? randomUUID(),
          alumnoId: datos.alumnoId,
          cursoId: datos.cursoId,
          periodo: datos.periodo,
          nota: datos.nota,
          observacion: datos.observacion,
          estado: "borrador",
          // Vuelve a ser borrador: cuando se publique de nuevo cuenta como una publicación nueva (avisa al padre).
          publicadaEn: null,
        };
        guardadas.push(await this.calificacionRepo.guardarNotaCierre(notaCierre, tx));
      }
      await this.anuncios.publicar("cierre.cargado", { notaCierreIds: guardadas.map((n) => n.id) }, tx);
      return guardadas;
    });
  }

  // Publica varias notas de cierre en una sola operación (todo o nada), con un único anuncio para el lote.
  async publicarNotasCierre(notaCierreIds: string[], profesorId: string): Promise<NotaCierre[]> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const publicadas: NotaCierre[] = [];
      const cursosVerificados = new Set<string>();
      for (const id of notaCierreIds) {
        const notaCierre = await this.calificacionRepo.findNotaCierreById(id, tx);
        if (!notaCierre) {
          throw new EntityNotFoundError("NotaCierre", id);
        }
        if (!cursosVerificados.has(notaCierre.cursoId)) {
          await this.verificarDuenoDelCurso(notaCierre.cursoId, profesorId);
          cursosVerificados.add(notaCierre.cursoId);
        }
        publicadas.push(
          await this.calificacionRepo.guardarNotaCierre(
            { ...notaCierre, estado: "publicada", publicadaEn: notaCierre.publicadaEn ?? new Date() },
            tx,
          ),
        );
      }
      await this.anuncios.publicar("cierre.publicado", { notaCierreIds }, tx);
      return publicadas;
    });
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
