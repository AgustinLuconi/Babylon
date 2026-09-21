export type RolEmisorMensaje = "admin" | "secretario" | "padre";

export interface Mensaje {
  id: string;
  chatId: string;
  emisorId: string;
  rolEmisor: RolEmisorMensaje;
  texto: string;
  fecha: Date;
}
