import type { Repository } from "../../core/ports";
import type { Ciclo } from "./ciclo.entity";
import type { Inscripcion } from "./inscripcion.entity";

export interface CicloRepository extends Repository<Ciclo> {
  findByAnio(anio: number, tx?: unknown): Promise<Ciclo | null>;
  findActivo(tx?: unknown): Promise<Ciclo | null>;
  desactivarTodos(tx?: unknown): Promise<void>;
  // Toma la fila del ciclo con SELECT … FOR UPDATE: bloquear, desbloquear y activar se hacen de a uno y esperan a las
  // escrituras que ya verificaron el ciclo (ver `bloquearParaLectura`).
  bloquear(id: string, tx?: unknown): Promise<void>;
  // Lee el ciclo con SELECT … FOR SHARE: quien escribe algo de un ciclo lo toma dentro de su transacción, así un
  // bloqueo simultáneo espera a que esa escritura termine en vez de colarse en el medio.
  bloquearParaLectura(id: string, tx?: unknown): Promise<Ciclo | null>;

  crearInscripcion(inscripcion: Inscripcion, tx?: unknown): Promise<Inscripcion>;
  actualizarInscripcion(
    alumnoId: string,
    cicloId: string,
    datos: Partial<Pick<Inscripcion, "cursoId" | "aplicaDescuentoHermanos">>,
    tx?: unknown,
  ): Promise<Inscripcion>;
  findInscripcionByAlumnoYCiclo(alumnoId: string, cicloId: string, tx?: unknown): Promise<Inscripcion | null>;
  findInscripcionesByAlumnoId(alumnoId: string, tx?: unknown): Promise<Inscripcion[]>;
  findInscripcionesByCicloId(cicloId: string, tx?: unknown): Promise<Inscripcion[]>;
}
