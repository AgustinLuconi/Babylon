import type { Cambios, Repository } from "../../core/ports";
import type { Configuracion } from "./configuracion.entity";

export interface ConfiguracionRepository extends Repository<Configuracion> {
  // La configuración es de instancia única: devuelve la fila, o la crea vacía
  // la primera vez.
  obtener(tx?: unknown): Promise<Configuracion>;
  // Escribe solo lo recibido: editar el valor de la cuota y el día de vencimiento a la vez, desde dos pantallas, no se pisa.
  actualizarParcial(id: string, cambios: Cambios<Configuracion>, tx?: unknown): Promise<Configuracion>;
}
