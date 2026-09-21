import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Rol } from "../../core/ports";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { CursoRepository } from "../cursos/curso.repository";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { ObservacionRepository } from "./observacion.repository";
import { CATEGORIAS_PREDEFINIDAS, type CategoriaPersonalizada, type Observacion } from "./observacion.entity";
import type { CrearCategoriaPersonalizadaInput, CrearObservacionInput } from "./observacion.schema";

export interface Solicitante {
  rol: Rol;
  padreId?: string;
}

export interface ObservacionConEmisor extends Observacion {
  emisorNombre: string;
}

export class ObservacionService {
  constructor(
    private readonly observacionRepo: ObservacionRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly usuarioRepo: UsuarioRepository,
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

  async crearObservacion(datos: CrearObservacionInput, emisorId: string, emisorRol: Rol): Promise<Observacion> {
    const alumno = await this.alumnoRepo.findById(datos.alumnoId);
    if (!alumno) {
      throw new EntityNotFoundError("Alumno", datos.alumnoId);
    }

    const esPredefinida = (CATEGORIAS_PREDEFINIDAS as string[]).includes(datos.categoria);
    if (!esPredefinida) {
      const categoriaPersonalizada = await this.observacionRepo.findCategoriaPersonalizadaById(datos.categoria);
      if (!categoriaPersonalizada || categoriaPersonalizada.cursoId !== alumno.cursoId) {
        throw new ValidationError("La categoría indicada no existe o no corresponde al curso del alumno");
      }
    }

    const observacion: Observacion = {
      id: randomUUID(),
      alumnoId: datos.alumnoId,
      emisorId,
      emisorRol,
      fecha: new Date(),
      texto: datos.texto,
      categoria: datos.categoria,
    };
    return this.observacionRepo.create(observacion);
  }

  // Enriquecida con el nombre real del emisor (join a Usuario por emisorId)
  // — necesario para mostrarle al padre quién escribió cada observación
  // ("Mensajes del instituto" en su resumen), no solo el texto pelado.
  async listarPorAlumno(alumnoId: string, solicitante: Solicitante): Promise<ObservacionConEmisor[]> {
    if (solicitante.rol === "padre") {
      const alumno = await this.alumnoRepo.findById(alumnoId);
      if (!alumno || alumno.padreId !== solicitante.padreId) {
        throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
      }
    }

    const observaciones = await this.observacionRepo.findByAlumnoId(alumnoId);
    const emisoresPorId = new Map<string, string>();
    const enriquecidas: ObservacionConEmisor[] = [];
    for (const o of observaciones) {
      if (!emisoresPorId.has(o.emisorId)) {
        const emisor = await this.usuarioRepo.findById(o.emisorId);
        emisoresPorId.set(o.emisorId, emisor?.nombre ?? "Instituto");
      }
      enriquecidas.push({ ...o, emisorNombre: emisoresPorId.get(o.emisorId)! });
    }
    return enriquecidas;
  }

  // Categoría creada por un profesor, scopeada a un curso puntual — no se
  // comparte con otros cursos ni otros profesores, mismo comportamiento que Evaluacion.
  async crearCategoriaPersonalizada(
    datos: CrearCategoriaPersonalizadaInput,
    profesorId: string,
  ): Promise<CategoriaPersonalizada> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);

    const categoria: CategoriaPersonalizada = {
      id: randomUUID(),
      cursoId: datos.cursoId,
      profesorId,
      nombre: datos.nombre,
    };
    return this.observacionRepo.crearCategoriaPersonalizada(categoria);
  }

  async listarCategoriasPersonalizadas(cursoId: string, profesorId?: string): Promise<CategoriaPersonalizada[]> {
    if (profesorId) {
      await this.verificarDuenoDelCurso(cursoId, profesorId);
    }
    return this.observacionRepo.findCategoriasPersonalizadasByCursoId(cursoId);
  }
}
