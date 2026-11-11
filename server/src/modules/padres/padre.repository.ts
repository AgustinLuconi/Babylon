import type { Cambios, Repository } from "../../core/ports";
import type { Padre } from "./padre.entity";

export interface PadreRepository extends Repository<Padre> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Padre | null>;
  findByDni(dni: string, tx?: unknown): Promise<Padre | null>;
  // Escribe solo las columnas recibidas (null borra): dos ediciones de campos distintos no se pisan.
  actualizarParcial(id: string, cambios: Cambios<Padre>, tx?: unknown): Promise<Padre>;
  // Toma el bloqueo de la fila hasta el fin de la transacción (para cambios que tocan dos fichas a la vez).
  bloquear(id: string, tx?: unknown): Promise<void>;
  // Solo asigna la cuenta de acceso, sin reescribir el resto de la ficha (una edición simultánea no se pisa).
  vincularUsuario(id: string, usuarioId: string, tx?: unknown): Promise<void>;
  // La ficha vuelve a quedar sin cuenta de acceso (la ficha y lo que tiene a su cargo no se tocan).
  desvincularUsuario(id: string, tx?: unknown): Promise<void>;
}
