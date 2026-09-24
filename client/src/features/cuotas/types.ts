export type EstadoCuota = "pagada" | "vencida";
export type MetodoPago = "efectivo" | "transferencia" | "tarjeta" | "mercadopago" | "otro";

export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  mercadopago: "Mercado Pago",
  otro: "Otro",
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
  // Fecha en que se registró el pago, si la cuota está pagada.
  fechaPago?: string;
}

export interface Pago {
  id: string;
  cuotaId: string;
  fechaPago: string;
  metodo: MetodoPago;
  monto: number;
  registradoPor: string;
  notas?: string | null;
}

export interface RegistrarPagoInput {
  cuotaIds: string[];
  metodo: MetodoPago;
  // AAAA-MM-DD; si falta, el server usa hoy.
  fechaPago?: string;
  notas?: string;
}
