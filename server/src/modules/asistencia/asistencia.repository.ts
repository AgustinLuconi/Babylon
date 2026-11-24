import type { Repository } from "../../core/ports";
import type { Asistencia, ClaseSinDictar } from "./asistencia.entity";

export interface AsistenciaRepository extends Repository<Asistencia> {
  findByAlumnoCursoFecha(alumnoId: string, cursoId: string, fecha: Date, tx?: unknown): Promise<Asistencia | null>;
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Asistencia[]>;

  // Clases sin dictar (entidad secundaria, una por curso y día).
  findClaseSinDictar(cursoId: string, fecha: Date, tx?: unknown): Promise<ClaseSinDictar | null>;
  crearClaseSinDictar(clase: ClaseSinDictar, tx?: unknown): Promise<ClaseSinDictar>;
  actualizarMotivoDeClaseSinDictar(id: string, motivo: string | null, tx?: unknown): Promise<ClaseSinDictar>;
  eliminarClaseSinDictar(id: string, tx?: unknown): Promise<void>;
  // La más nueva primero.
  findSinDictarByCursoId(cursoId: string, tx?: unknown): Promise<ClaseSinDictar[]>;
  // De los cursos en los que el alumno está o estuvo inscripto.
  findSinDictarByAlumnoId(alumnoId: string, tx?: unknown): Promise<ClaseSinDictar[]>;
  // Filas de asistencia de ese curso y día (para no marcar "sin clases" una clase que ya tiene asistencia).
  contarRegistrosDelDia(cursoId: string, fecha: Date, tx?: unknown): Promise<number>;
  // Marcar "sin clases" y guardar asistencia de la misma clase toman este mismo bloqueo (pg_advisory_xact_lock): no se cruzan.
  bloquearClase(cursoId: string, fecha: Date, tx?: unknown): Promise<void>;
}
