import type { AlertaAutomatica, ConfigDeRegla, MotivoCierre, ReglaId } from "./automatizacion.entity";

// Una fila del historial con los nombres ya resueltos (para el panel).
export interface AlertaConNombres extends AlertaAutomatica {
  alumnoNombre: string;
  cursoNombre: string | null;
}

export interface AutomatizacionRepository {
  // La configuración de una regla; la crea con los valores por defecto del catálogo la primera vez.
  obtenerConfig(regla: ReglaId, tx?: unknown): Promise<ConfigDeRegla>;
  actualizarConfig(regla: ReglaId, cambios: Partial<Pick<ConfigDeRegla, "activa" | "umbral" | "ultimaRevisionEn">>, tx?: unknown): Promise<ConfigDeRegla>;
  // Bloquea la regla hasta el fin de la transacción: dos revisiones de la misma regla van de a una.
  bloquearRegla(regla: ReglaId, tx?: unknown): Promise<void>;
  findAbiertas(regla: ReglaId, tx?: unknown): Promise<AlertaAutomatica[]>;
  contarAbiertas(regla: ReglaId, tx?: unknown): Promise<number>;
  crearAlertas(alertas: AlertaAutomatica[], tx?: unknown): Promise<void>;
  actualizarNivel(id: string, nivel: number, tx?: unknown): Promise<void>;
  cerrarAlertas(cierres: { id: string; motivo: MotivoCierre }[], ahora: Date, tx?: unknown): Promise<void>;
  // Historial de la regla, las más nuevas primero, de a páginas (la primera es la 1).
  historial(regla: ReglaId, pagina: number, porPagina: number, tx?: unknown): Promise<{ filas: AlertaConNombres[]; total: number }>;
}
