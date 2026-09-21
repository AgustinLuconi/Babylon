import type { Repository } from "../../core/ports";
import type { CategoriaPersonalizada, Observacion } from "./observacion.entity";

export interface ObservacionRepository extends Repository<Observacion> {
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Observacion[]>;

  crearCategoriaPersonalizada(categoria: CategoriaPersonalizada, tx?: unknown): Promise<CategoriaPersonalizada>;
  findCategoriaPersonalizadaById(id: string, tx?: unknown): Promise<CategoriaPersonalizada | null>;
  findCategoriasPersonalizadasByCursoId(cursoId: string, tx?: unknown): Promise<CategoriaPersonalizada[]>;
}
