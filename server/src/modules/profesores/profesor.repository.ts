import type { Cambios, Repository } from "../../core/ports";
import type { Profesor } from "./profesor.entity";

export interface ProfesorRepository extends Repository<Profesor> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Profesor | null>;
  findByDni(dni: string, tx?: unknown): Promise<Profesor | null>;
  // Escribe solo las columnas recibidas (null borra): dos ediciones de campos distintos no se pisan.
  actualizarParcial(id: string, cambios: Cambios<Profesor>, tx?: unknown): Promise<Profesor>;
  // Solo asigna la cuenta de acceso, sin reescribir el resto de la ficha (una edición simultánea no se pisa).
  vincularUsuario(id: string, usuarioId: string, tx?: unknown): Promise<void>;
  // La ficha vuelve a quedar sin cuenta de acceso (la ficha y lo que tiene a su cargo no se tocan).
  desvincularUsuario(id: string, tx?: unknown): Promise<void>;
}
