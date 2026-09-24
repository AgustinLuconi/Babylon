// Ajustes globales del instituto. Existe una única instancia (ID_CONFIGURACION).
export const ID_CONFIGURACION = "instituto";

export interface Configuracion {
  id: string;
  // Cuota mensual, igual para todos los cursos. null = todavía no cargada.
  valorCuota: number | null;
}
