import type { Cambios, Repository } from "../../core/ports";
import type { Alumno } from "./alumno.entity";
import type { AlumnoConDatosFaltantes } from "./alumno.incompleto";

export interface AlumnoRepository extends Repository<Alumno> {
  findByDni(dni: string, tx?: unknown): Promise<Alumno | null>;
  findByPadreId(padreId: string, tx?: unknown): Promise<Alumno[]>;
  findByCursoId(cursoId: string, tx?: unknown): Promise<Alumno[]>;
  // Alumnos activos del ciclo activo con datos que faltan (criterio único: `datosFaltantes`).
  findIncompletos(tx?: unknown): Promise<AlumnoConDatosFaltantes[]>;
  // Escribe solo las columnas recibidas (null borra): dos ediciones de campos distintos no se pisan.
  actualizarParcial(id: string, cambios: Cambios<Alumno>, tx?: unknown): Promise<Alumno>;
  // Toma el bloqueo de la fila hasta el fin de la transacción (para cambios que tocan dos fichas a la vez).
  bloquear(id: string, tx?: unknown): Promise<void>;
}
