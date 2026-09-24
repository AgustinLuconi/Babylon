import type { Repository } from "../../core/ports";
import type { Cuota } from "./cuota.entity";
import type { Pago } from "./pago.entity";

export interface CuotaRepository extends Repository<Cuota> {
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Cuota[]>;
  findByMesYAnio(mes: number, anio: number, tx?: unknown): Promise<Cuota[]>;
  // Pasa a "vencida" toda cuota pendiente con vencimiento anterior a la fecha
  // dada; devuelve cuántas cambiaron.
  marcarVencidas(vencimientoAnteriorA: Date, tx?: unknown): Promise<number>;
  registrarPago(pago: Pago, tx?: unknown): Promise<Pago>;
  findAllPagos(tx?: unknown): Promise<Pago[]>;
  findPagosByCuotaIds(cuotaIds: string[], tx?: unknown): Promise<Pago[]>;
}
