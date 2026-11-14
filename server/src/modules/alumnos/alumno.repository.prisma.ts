import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Cambios } from "../../core/ports";
import { traducirErrorDeEscritura } from "../../core/adapters/prismaErrores";
import type { AlumnoRepository } from "./alumno.repository";
import type { Alumno } from "./alumno.entity";
import { datosFaltantes, type AlumnoConDatosFaltantes } from "./alumno.incompleto";

type FilaAlumno = Awaited<ReturnType<PrismaClient["alumno"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaAlumno): Alumno {
  return {
    ...fila,
    dni: fila.dni ?? undefined,
    fechaNacimiento: fila.fechaNacimiento ?? undefined,
    vinculoResponsable: fila.vinculoResponsable ?? undefined,
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

  // La lista de alumnos de un curso sale de las inscripciones (no de `Alumno.cursoId`, que es solo el curso actual):
  // un curso de un ciclo viejo sigue mostrando para siempre a quienes cursaron en él.
  async findByCursoId(cursoId: string, tx?: unknown): Promise<Alumno[]> {
    const filas = await this.client(tx).alumno.findMany({ where: { inscripciones: { some: { cursoId } } } });
    return filas.map(aEntidad);
  }

  async findAll(tx?: unknown): Promise<Alumno[]> {
    const filas = await this.client(tx).alumno.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Alumno, tx?: unknown): Promise<Alumno> {
    try {
      const fila = await this.client(tx).alumno.create({ data: entidad });
      return aEntidad(fila);
    } catch (error) {
      // Dos altas simultáneas con el mismo DNI: la restricción de la base deja pasar una sola y la otra es un 409.
      throw traducirErrorDeEscritura(error, "Alumno", entidad.id, "alumno");
    }
  }

  async update(id: string, entidad: Alumno, tx?: unknown): Promise<Alumno> {
    try {
      const fila = await this.client(tx).alumno.update({
        where: { id },
        data: {
          ...entidad,
          dni: entidad.dni ?? null,
          fechaNacimiento: entidad.fechaNacimiento ?? null,
          vinculoResponsable: entidad.vinculoResponsable ?? null,
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

  async findIncompletos(tx?: unknown): Promise<AlumnoConDatosFaltantes[]> {
    const alumnos = await this.client(tx).alumno.findMany({
      where: { estado: "activo", inscripciones: { some: { ciclo: { activo: true } } } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        dni: true,
        fechaNacimiento: true,
        padreId: true,
        vinculoResponsable: true,
        padre: { select: { dni: true, telefono: true, email: true } },
      },
    });
    return alumnos
      .map((a) => ({
        alumnoId: a.id,
        nombre: `${a.nombre} ${a.apellido}`,
        faltan: datosFaltantes(
          {
            dni: a.dni ?? undefined,
            fechaNacimiento: a.fechaNacimiento ?? undefined,
            padreId: a.padreId ?? undefined,
            vinculoResponsable: a.vinculoResponsable ?? undefined,
          },
          a.padre ? { dni: a.padre.dni ?? undefined, telefono: a.padre.telefono ?? undefined, email: a.padre.email ?? undefined } : null,
        ),
      }))
      .filter((a) => a.faltan.length > 0);
  }

  async actualizarParcial(id: string, cambios: Cambios<Alumno>, tx?: unknown): Promise<Alumno> {
    try {
      const fila = await this.client(tx).alumno.update({ where: { id }, data: cambios });
      return aEntidad(fila);
    } catch (error) {
      throw traducirErrorDeEscritura(error, "Alumno", id);
    }
  }

  async bloquear(id: string, tx?: unknown): Promise<void> {
    await this.client(tx).$queryRaw`SELECT "id" FROM "Alumno" WHERE "id" = ${id} FOR UPDATE`;
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).alumno.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Alumno", id);
    }
  }
}
