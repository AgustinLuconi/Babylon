import type { Repository } from "../../core/ports";
import type { Configuracion } from "./configuracion.entity";

export interface ConfiguracionRepository extends Repository<Configuracion> {
  // La configuración es de instancia única: devuelve la fila, o la crea vacía
  // la primera vez.
  obtener(tx?: unknown): Promise<Configuracion>;
}
