export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export interface Pago {
  id: string;
  cuotaId: string;
  fechaPago: Date;
  metodo: MetodoPago;
  monto: number;
  registradoPor: string;
}
