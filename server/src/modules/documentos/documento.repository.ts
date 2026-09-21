import type { Repository } from "../../core/ports";
import type { Documento, TipoDocumento } from "./documento.entity";

export interface DocumentoRepository extends Repository<Documento> {
  findByAlumnoYTipo(alumnoId: string, tipo: TipoDocumento, tx?: unknown): Promise<Documento | null>;
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Documento[]>;
}
