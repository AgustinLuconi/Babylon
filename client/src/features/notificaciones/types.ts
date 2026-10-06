export type TonoNotificacion = "danger" | "warning" | "info";

export interface Notificacion {
  id: string;
  tono: TonoNotificacion;
  texto: string;
  // Pantalla donde se resuelve el aviso.
  ruta: string;
}
