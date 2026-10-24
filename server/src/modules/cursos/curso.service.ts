import { randomUUID } from "node:crypto";
import { EntityNotFoundError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { CicloRepository } from "../ciclos/ciclo.repository";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { CursoRepository } from "./curso.repository";
import type { Curso } from "./curso.entity";
import type { Horario } from "./horario.entity";
import type { ActualizarCursoInput, CrearCursoInput } from "./curso.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosCursos } from "./curso.eventos";

export class CursoService {
  constructor(
    private readonly cursoRepo: CursoRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly cicloRepo: CicloRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosCursos & EventosCambios> = sinAnuncios(),
  ) {}

  async listarCursos(): Promise<Curso[]> {
    return this.cursoRepo.findAll();
  }

  async listarPorProfesor(profesorId: string): Promise<Curso[]> {
    return this.cursoRepo.findByProfesorId(profesorId);
  }

  async listarPorCiclo(cicloId: string): Promise<Curso[]> {
    return this.cursoRepo.findByCicloId(cicloId);
  }

  async crearCurso(datos: CrearCursoInput): Promise<Curso> {
    const profesor = await this.profesorRepo.findById(datos.profesorId);
    if (!profesor) {
      throw new EntityNotFoundError("Profesor", datos.profesorId);
    }

    // Si no se especifica un ciclo (caso normal, alta desde la pantalla de
    // Admin), el curso nuevo queda asociado al ciclo activo. El import de
    // datos históricos es el único caso que manda `cicloId` explícito.
    let cicloId = datos.cicloId;
    if (!cicloId) {
      const activo = await this.cicloRepo.findActivo();
      if (!activo) {
        throw new EntityNotFoundError("Ciclo activo");
      }
      cicloId = activo.id;
    }

    const curso: Curso = {
      id: randomUUID(),
      nombre: datos.nombre,
      nivel: datos.nivel,
      profesorId: datos.profesorId,
      cicloId,
      aula: datos.aula,
      cupo: datos.cupo,
      estado: "activo",
    };
    // Atómico: el curso con sus horarios (antes podía quedar un curso sin horarios si fallaba a mitad de camino).
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.cursoRepo.create(curso, tx);
      for (const horario of datos.horarios) {
        await this.cursoRepo.agregarHorario({ id: randomUUID(), cursoId: curso.id, ...horario }, tx);
      }
      await this.anuncios.publicar("cursos.cambiaron", { cursoId: curso.id }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "cursos", accion: "alta", ids: { cursoIds: [curso.id], profesorIds: [curso.profesorId] } }, tx);
      return curso;
    });
  }

  async listarHorarios(): Promise<Horario[]> {
    return this.cursoRepo.findAllHorarios();
  }

  async actualizarCurso(id: string, datos: ActualizarCursoInput): Promise<Curso> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const actual = await this.cursoRepo.findById(id, tx);
      if (!actual) {
        throw new EntityNotFoundError("Curso", id);
      }
      if (datos.profesorId) {
        const profesor = await this.profesorRepo.findById(datos.profesorId, tx);
        if (!profesor) {
          throw new EntityNotFoundError("Profesor", datos.profesorId);
        }
      }

      const actualizado: Curso = {
        ...actual,
        nombre: datos.nombre ?? actual.nombre,
        nivel: datos.nivel ?? actual.nivel,
        profesorId: datos.profesorId ?? actual.profesorId,
        aula: datos.aula ?? actual.aula,
        cupo: datos.cupo ?? actual.cupo,
        estado: datos.estado ?? actual.estado,
      };
      await this.cursoRepo.update(id, actualizado, tx);

      if (datos.horarios) {
        await this.cursoRepo.eliminarHorariosByCursoId(id, tx);
        for (const horario of datos.horarios) {
          await this.cursoRepo.agregarHorario({ id: randomUUID(), cursoId: id, ...horario }, tx);
        }
      }

      await this.anuncios.publicar("cursos.cambiaron", { cursoId: id }, tx);
      // El profesor anterior y el nuevo: al anterior le desaparece el curso.
      const profesorIds = [...new Set([actual.profesorId, actualizado.profesorId])];
      await this.anuncios.publicar("datos.cambiaron", { dato: "cursos", accion: "edicion", ids: { cursoIds: [id], profesorIds } }, tx);
      return actualizado;
    });
  }
}
