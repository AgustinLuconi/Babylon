export type EstadoCuota = "pagada" | "vencida";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export interface Cuota {
  id: string;
  alumnoId: string;
  mes: number;
  anio: number;
  montoBase: number;
  descuento: number;
  montoFinal: number;
  vencimiento: string;
  estado: EstadoCuota;
}

export interface Pago {
  id: string;
  cuotaId: string;
  fechaPago: string;
  metodo: MetodoPago;
  monto: number;
  registradoPor: string;
}

export interface RegistrarPagoInput {
  cuotaIds: string[];
  metodo: MetodoPago;
}
