export type RolEmisorMensaje = "admin" | "secretario" | "padre";

export interface Mensaje {
  id: string;
  chatId: string;
  emisorId: string;
  rolEmisor: RolEmisorMensaje;
  texto: string;
  fecha: Date;
  // Cuándo lo vio el otro lado (null = todavía no).
  vistoEn: Date | null;
}

// Quién lee una conversación: el instituto (cualquier cuenta de administración o secretaría, bandeja compartida) o la
// familia. Leer marca solo los mensajes del otro lado.
export type Lector = "instituto" | "familia";
