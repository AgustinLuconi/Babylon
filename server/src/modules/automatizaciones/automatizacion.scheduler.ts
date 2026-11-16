import { programarTareaDiaria } from "../../core/tareaDiaria";
import type { AutomatizacionService } from "./automatizacion.service";

// Red de seguridad: al arrancar y a las 03:00 se revisan todas las reglas enteras (los anuncios ya las mantienen al día).
export function iniciarAutomatizaciones(servicio: AutomatizacionService): void {
  programarTareaDiaria("automatizaciones", () => servicio.evaluarTodas());
}
