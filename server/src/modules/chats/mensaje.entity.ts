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

// Qué marca como visto quien lee: los mensajes que tenía en pantalla (`ids`) y, si la conversación tiene páginas
// anteriores sin cargar, los anteriores a lo cargado (`antesDe`). Lo que llegó después no se marca, aunque tenga la
// misma fecha que el último que se ve.
export interface AlcanceLectura {
  ids: string[];
  antesDe?: Date;
}

// Página de una conversación: el más reciente al final. `antesDe` marca dónde sigue la página anterior.
export interface PaginaDeMensajes {
  antesDe?: { fecha: Date; id: string };
  limite: number;
}
