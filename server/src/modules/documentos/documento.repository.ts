import type { Repository } from "../../core/ports";
import type { Documento, TipoDocumento } from "./documento.entity";
import type { AlumnoConFaltantes } from "./documento.faltantes";

export interface DocumentoRepository extends Repository<Documento> {
  findByAlumnoYTipo(alumnoId: string, tipo: TipoDocumento, tx?: unknown): Promise<Documento | null>;
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Documento[]>;

  // Alumnos que deben documentación (activos e inscriptos en el ciclo activo), solo los que tienen algo pendiente.
  findFaltantes(tx?: unknown): Promise<AlumnoConFaltantes[]>;
}
