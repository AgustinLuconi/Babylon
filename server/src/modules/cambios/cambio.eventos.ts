import type { CambioDeDatos } from "./cambio.entity";

export interface EventosCambios {
  // Cualquier escritura: qué dato cambió. Se publica dentro de la transacción de la operación; la señal en vivo sale
  // recién al confirmar, a quienes pueden ver ese dato.
  "datos.cambiaron": CambioDeDatos;
}
