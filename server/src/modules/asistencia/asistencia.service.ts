import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError } from "../../core/errors";
import type { Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import { cicloSiempreAbierto, type VerificadorDeCiclo } from "../ciclos/ciclo.guarda";
import type { CursoRepository } from "../cursos/curso.repository";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { AsistenciaRepository } from "./asistencia.repository";
import type { Asistencia } from "./asistencia.entity";
import type { RegistrarAsistenciaMasivaInput } from "./asistencia.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosAsistencia } from "./asistencia.eventos";

export interface Solicitante {
  rol: Rol;
  padreId?: string;
}

export class AsistenciaService {
  constructor(
    private readonly asistenciaRepo: AsistenciaRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosAsistencia & EventosCambios> = sinAnuncios(),
    private readonly verificador: VerificadorDeCiclo = cicloSiempreAbierto(),
  ) {}

  private async verificarDuenoDelCurso(cursoId: string, profesorId: string): Promise<void> {
    const curso = await this.cursoRepo.findById(cursoId);
    if (!curso) {
      throw new EntityNotFoundError("Curso", cursoId);
    }
    if (curso.profesorId !== profesorId) {
      throw new AuthorizationError("Un profesor solo puede registrar asistencia en sus propios cursos");
    }
  }

  // Toma (o corrige) la asistencia de toda la nómina de un curso en una sola
  // operación atómica: si un alumno ya tenía asistencia cargada esa fecha, se
  // actualiza en vez de duplicarse — permite navegar a una clase anterior y
  // corregirla, igual que el prototipo ("cargarla o corregirla").
  async registrarAsistenciaMasiva(datos: RegistrarAsistenciaMasivaInput, profesorId: string): Promise<Asistencia[]> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);

    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.verificador.verificarCicloDelCurso(datos.cursoId, tx);
      // Solo se toma asistencia un día con clases del calendario del ciclo del curso (no en feriados, pausas ni fuera del ciclo).
      await this.verificador.verificarDiaDeClases(datos.cursoId, datos.fecha.toISOString().slice(0, 10), tx);
      const asistencias: Asistencia[] = [];

      for (const registro of datos.registros) {
        const existente = await this.asistenciaRepo.findByAlumnoCursoFecha(
          registro.alumnoId,
          datos.cursoId,
          datos.fecha,
          tx,
        );

        if (existente) {
          const actualizada: Asistencia = {
            ...existente,
            estado: registro.estado,
            minutosRetraso: registro.minutosRetraso,
            motivo: registro.motivo,
            justificada: registro.estado === "ausente" && registro.justificada === true,
          };
          await this.asistenciaRepo.update(existente.id, actualizada, tx);
          asistencias.push(actualizada);
          continue;
        }

        const asistencia: Asistencia = {
          id: randomUUID(),
          alumnoId: registro.alumnoId,
          cursoId: datos.cursoId,
          fecha: datos.fecha,
          estado: registro.estado,
          minutosRetraso: registro.minutosRetraso,
          motivo: registro.motivo,
          justificada: registro.estado === "ausente" && registro.justificada === true,
        };
        await this.asistenciaRepo.create(asistencia, tx);
        asistencias.push(asistencia);
      }

      await this.anuncios.publicar("asistencia.registrada", { cursoId: datos.cursoId }, tx);
      await this.anuncios.publicar(
        "datos.cambiaron",
        { dato: "asistencia", accion: "registro", ids: { cursoIds: [datos.cursoId], alumnoIds: datos.registros.map((r) => r.alumnoId) } },
        tx,
      );
      return asistencias;
    });
  }

  async listarPorAlumno(alumnoId: string, solicitante: Solicitante): Promise<Asistencia[]> {
    if (solicitante.rol === "padre") {
      const alumno = await this.alumnoRepo.findById(alumnoId);
      if (!alumno || alumno.padreId !== solicitante.padreId) {
        throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
      }
    }
    return this.asistenciaRepo.findByAlumnoId(alumnoId);
  }
}
