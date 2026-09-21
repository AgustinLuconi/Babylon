export type EstadoCuota = "pagada" | "vencida";

export interface Cuota {
  id: string;
  alumnoId: string;
  mes: number;
  anio: number;
  montoBase: number;
  descuento: number;
  montoFinal: number;
  vencimiento: Date;
  estado: EstadoCuota;
}
