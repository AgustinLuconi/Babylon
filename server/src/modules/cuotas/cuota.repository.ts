import type { Repository } from "../../core/ports";
import type { Cuota } from "./cuota.entity";
import type { Pago } from "./pago.entity";

export interface CuotaRepository extends Repository<Cuota> {
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Cuota[]>;
  registrarPago(pago: Pago, tx?: unknown): Promise<Pago>;
  findAllPagos(tx?: unknown): Promise<Pago[]>;
  findPagosByCuotaIds(cuotaIds: string[], tx?: unknown): Promise<Pago[]>;
}
