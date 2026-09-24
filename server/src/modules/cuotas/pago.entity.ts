export type MetodoPago = "efectivo" | "transferencia" | "mercadopago" | "otro";

export interface Pago {
  id: string;
  cuotaId: string;
  fechaPago: Date;
  metodo: MetodoPago;
  monto: number;
  registradoPor: string;
  notas?: string | null;
}
