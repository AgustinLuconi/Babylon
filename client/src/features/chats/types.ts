import type { Rol } from "@/features/auth/types";

export interface Chat {
  id: string;
  padreId: string;
  creadoEn: string;
}

export interface Mensaje {
  id: string;
  chatId: string;
  emisorId: string;
  rolEmisor: Rol;
  texto: string;
  fecha: string;
}

export interface EnviarMensajeInput {
  texto: string;
}
