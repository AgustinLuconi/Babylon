export interface Configuracion {
  id: string;
  // Cuota mensual global; null si todavía no se cargó.
  valorCuota: number | null;
}
