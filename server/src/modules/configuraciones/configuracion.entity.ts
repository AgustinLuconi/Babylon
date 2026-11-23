// Ajustes globales del instituto. Existe una única instancia (ID_CONFIGURACION).
export const ID_CONFIGURACION = "instituto";

export interface Configuracion {
  id: string;
  // Cuota mensual, igual para todos los cursos. null = todavía no cargada.
  valorCuota: number | null;
  // Día del mes en que vencen las cuotas que se generen de acá en adelante (1 a 28).
  diaVencimiento: number;
}
