export interface Chat {
  id: string;
  padreId: string;
  creadoEn: Date;
}

// Una conversación vista desde la lista del instituto.
export interface ResumenChat {
  chatId: string;
  padreId: string;
  padreNombre: string;
  hijos: string[];
  ultimoMensaje: { texto: string; fecha: Date; delInstituto: boolean } | null;
  // Mensajes de la familia que el instituto todavía no vio.
  noLeidos: number;
  creadoEn: Date;
}
