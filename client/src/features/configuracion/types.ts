export interface Configuracion {
  id: string;
  // Cuota mensual global; null si todavía no se cargó.
  valorCuota: number | null;
  // Día del mes en que vencen las cuotas que se generen de acá en adelante (1 a 28).
  diaVencimiento: number;
}

export interface ActualizarConfiguracionInput {
  valorCuota?: number;
  diaVencimiento?: number;
}
