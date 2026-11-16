import type { ReglaId } from "./automatizacion.reconciliar";

export interface EventosAutomatizaciones {
  // Se publica dentro de la transacción de la revisión, solo si cambió alguna alerta de esas reglas: los avisos de la
  // campana se sincronizan con esto.
  "alertas.cambiaron": { reglaIds: ReglaId[] };
}
