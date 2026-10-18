import type { Rol } from "@/features/auth/types";

export interface Chat {
  id: string;
  padreId: string;
  creadoEn: string;
}

// La conversación del padre, con los mensajes del instituto que todavía no vio.
export interface ChatConNoLeidos extends Chat {
  noLeidos: number;
}

// Lo que devuelve "Nueva conversación": si el padre todavía no tiene cuenta activa, va a verla cuando entre.
// Si el padre puede leer la conversación: con cuenta activa sí; sin cuenta o con la invitación pendiente, cuando entre;
// con la cuenta desactivada no puede entrar al sistema hasta que se reactive.
export type EstadoCuentaPadre = "activa" | "pendiente" | "inactiva" | "sin-cuenta";

export interface ConversacionIniciada extends Chat {
  estadoCuenta: EstadoCuentaPadre;
}

// Una página de la conversación (el más reciente al final) y el marcador para pedir la anterior (null = no hay más).
export interface MensajesPaginados {
  mensajes: Mensaje[];
  anteriores: string | null;
}

// Una conversación vista desde la lista del instituto.
export interface ResumenChat {
  chatId: string;
  padreId: string;
  padreNombre: string;
  hijos: string[];
  ultimoMensaje: { texto: string; fecha: string; delInstituto: boolean } | null;
  noLeidos: number;
  creadoEn: string;
}

// El número del menú: conversaciones (instituto) o mensajes (padre) sin leer.
export interface NoLeidosChat {
  conversaciones?: number;
  mensajes?: number;
}

export interface Mensaje {
  id: string;
  chatId: string;
  emisorId: string;
  rolEmisor: Rol;
  texto: string;
  fecha: string;
  // Cuándo lo vio el otro lado (null = todavía no).
  vistoEn: string | null;
  // Solo viene al listar los mensajes de una conversación.
  emisorNombre?: string;
}

export interface EnviarMensajeInput {
  texto: string;
}
