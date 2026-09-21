import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError } from "../../core/errors";
import type { UnitOfWork } from "../../core/ports";
import type { CicloRepository } from "../ciclos/ciclo.repository";
import type { CursoRepository } from "../cursos/curso.repository";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { AlumnoRepository } from "./alumno.repository";
import type { Alumno } from "./alumno.entity";
import type { ActualizarAlumnoInput, NuevoAlumnoInput } from "./alumno.schema";

export interface HijoConCurso extends Alumno {
  cursoNombre: string | null;
  cursoNivel: string | null;
  profesorNombre: string | null;
}

export class AlumnoService {
  constructor(
    private readonly alumnoRepo: AlumnoRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly cicloRepo: CicloRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async listarAlumnos(): Promise<Alumno[]> {
    return this.alumnoRepo.findAll();
  }

  async listarPorPadre(padreId: string): Promise<Alumno[]> {
    return this.alumnoRepo.findByPadreId(padreId);
  }

  // Vista enriquecida para el dashboard del padre — el rol padre no tiene
  // acceso a /api/cursos ni /api/profesores (son admin/secretario/profesor),
  // así que el nombre de curso/nivel/profesor se resuelve acá y se devuelve
  // ya embebido, sin abrir esos endpoints a un rol que solo debe ver lo suyo.
  async listarPorPadreConCurso(padreId: string): Promise<HijoConCurso[]> {
    const alumnos = await this.alumnoRepo.findByPadreId(padreId);
    return Promise.all(
      alumnos.map(async (alumno) => {
        const curso = alumno.cursoId ? await this.cursoRepo.findById(alumno.cursoId) : null;
        const profesor = curso ? await this.profesorRepo.findById(curso.profesorId) : null;
        return {
          ...alumno,
          cursoNombre: curso?.nombre ?? null,
          cursoNivel: curso?.nivel ?? null,
          profesorNombre: profesor ? `${profesor.nombre} ${profesor.apellido}` : null,
        };
      }),
    );
  }

  // Vía Inscripcion (historial real), no `Alumno.cursoId` — un alumno
  // reinscripto en un ciclo posterior sigue apareciendo en la nómina del
  // ciclo histórico donde realmente cursó.
  async listarPorCiclo(cicloId: string): Promise<Alumno[]> {
    const inscripciones = await this.cicloRepo.findInscripcionesByCicloId(cicloId);
    const alumnos = await Promise.all(inscripciones.map((i) => this.alumnoRepo.findById(i.alumnoId)));
    return alumnos.filter((a): a is Alumno => a !== null);
  }

  async listarPorCurso(cursoId: string, profesorId?: string): Promise<Alumno[]> {
    if (profesorId) {
      const curso = await this.cursoRepo.findById(cursoId);
      if (!curso) {
        throw new EntityNotFoundError("Curso", cursoId);
      }
      if (curso.profesorId !== profesorId) {
        throw new AuthorizationError("Un profesor solo puede ver la nómina de sus propios cursos");
      }
    }

    return this.alumnoRepo.findByCursoId(cursoId);
  }

  async inscribirAlumno(datos: NuevoAlumnoInput): Promise<Alumno> {
    const existente = await this.alumnoRepo.findByDni(datos.dni);
    if (existente) {
      throw new ConflictError(`Ya existe un alumno inscripto con el DNI ${datos.dni}`);
    }

    const hermanosActivos = (await this.alumnoRepo.findByPadreId(datos.padreId)).filter(
      (hermano) => hermano.estado === "activo",
    );
    const aplicaDescuentoHermanos = hermanosActivos.length >= 1;

    const alumno: Alumno = {
      id: randomUUID(),
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      fechaNacimiento: datos.fechaNacimiento,
      direccion: datos.direccion,
      telefono: datos.telefono,
      email: datos.email,
      foto: datos.foto,
      observacionesMedicas: datos.observacionesMedicas,
      padreId: datos.padreId,
      cursoId: datos.cursoId,
      fechaInscripcion: new Date(),
      estado: "activo",
      // Descuento del 10% a partir del segundo hijo: si ya hay al menos
      // un hermano activo inscripto, este nuevo alumno también lo aplica.
      aplicaDescuentoHermanos,
    };

    // Además del alta del Alumno, se deja asentada la inscripción del ciclo
    // activo (historial por año) — atómico, para no crear el alumno sin su
    // registro de inscripción si algo falla a mitad de camino.
    return this.unitOfWork.runInTransaction(async (tx) => {
      const creado = await this.alumnoRepo.create(alumno, tx);
      if (creado.cursoId) {
        const cicloActivo = await this.cicloRepo.findActivo(tx);
        if (cicloActivo) {
          await this.cicloRepo.crearInscripcion(
            {
              id: randomUUID(),
              alumnoId: creado.id,
              cursoId: creado.cursoId,
              cicloId: cicloActivo.id,
              fecha: creado.fechaInscripcion,
              aplicaDescuentoHermanos,
            },
            tx,
          );
        }
      }
      return creado;
    });
  }

  async actualizarAlumno(id: string, datos: ActualizarAlumnoInput): Promise<Alumno> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const actual = await this.alumnoRepo.findById(id, tx);
      if (!actual) {
        throw new EntityNotFoundError("Alumno", id);
      }

      const actualizado: Alumno = {
        ...actual,
        nombre: datos.nombre ?? actual.nombre,
        apellido: datos.apellido ?? actual.apellido,
        fechaNacimiento: datos.fechaNacimiento ?? actual.fechaNacimiento,
        direccion: datos.direccion ?? actual.direccion,
        telefono: datos.telefono ?? actual.telefono,
        email: datos.email ?? actual.email,
        observacionesMedicas: datos.observacionesMedicas ?? actual.observacionesMedicas,
        cursoId: datos.cursoId ?? actual.cursoId,
        estado: datos.estado ?? actual.estado,
      };
      const resultado = await this.alumnoRepo.update(id, actualizado, tx);

      // Si cambió de curso, la inscripción del ciclo activo tiene que
      // reflejar el nuevo curso — si no existía todavía (ej. no tenía curso
      // asignado al inscribirse), se crea recién ahora.
      if (datos.cursoId && datos.cursoId !== actual.cursoId) {
        const cicloActivo = await this.cicloRepo.findActivo(tx);
        if (cicloActivo) {
          const inscripcionExistente = await this.cicloRepo.findInscripcionByAlumnoYCiclo(id, cicloActivo.id, tx);
          if (inscripcionExistente) {
            await this.cicloRepo.actualizarInscripcion(id, cicloActivo.id, { cursoId: datos.cursoId }, tx);
          } else {
            await this.cicloRepo.crearInscripcion(
              {
                id: randomUUID(),
                alumnoId: id,
                cursoId: datos.cursoId,
                cicloId: cicloActivo.id,
                fecha: new Date(),
                aplicaDescuentoHermanos: resultado.aplicaDescuentoHermanos,
              },
              tx,
            );
          }
        }
      }

      return resultado;
    });
  }
}
