import { sinAnuncios } from "../../core/eventos";
import type { Publicador } from "../../core/ports";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { ConfiguracionRepository } from "./configuracion.repository";
import type { Configuracion } from "./configuracion.entity";
import type { ActualizarConfiguracionInput } from "./configuracion.schema";

export class ConfiguracionService {
  constructor(
    private readonly configuracionRepo: ConfiguracionRepository,
    private readonly anuncios: Publicador<EventosCambios> = sinAnuncios(),
  ) {}

  async obtener(): Promise<Configuracion> {
    return this.configuracionRepo.obtener();
  }

  // El nuevo valor rige para las cuotas que se generen de acá en adelante; las
  // ya generadas (pendientes incluidas) conservan el monto con el que nacieron.
  async actualizar(datos: ActualizarConfiguracionInput): Promise<Configuracion> {
    const actual = await this.configuracionRepo.obtener();
    const guardada = await this.configuracionRepo.update(actual.id, { ...actual, valorCuota: datos.valorCuota });
    await this.anuncios.publicar("datos.cambiaron", { dato: "configuracion", accion: "edicion", ids: {} });
    return guardada;
  }
}
