export interface EventosChats {
  // Un mensaje nuevo o una conversación leída: cambian los avisos y llega una señal en vivo a los dos lados.
  "chat.mensaje": { chatId: string; padreId: string; usuarioIdPadre: string | null };
  "chat.leido": { chatId: string; padreId: string; usuarioIdPadre: string | null };
  // Una conversación nueva (todavía vacía): aparece en la lista del resto del instituto.
  "chat.creada": { chatId: string; padreId: string };
}
