import type { TableroDeAnuncios } from "../../core/eventos";
import type { CanalEnVivo } from "../../core/ports";
import type { EventosDelSistema } from "../../eventos";
import type { EventosChats } from "./chat.eventos";

// Después de confirmar un mensaje o una lectura, avisa en vivo a los dos lados: a todo el instituto (bandeja compartida)
// y al padre de esa conversación. Solo el identificador de la conversación: la pantalla vuelve a pedir lo que cambió.
export function suscribirChatEnVivo(tablero: TableroDeAnuncios<EventosDelSistema>, canal: CanalEnVivo): void {
  const avisar = ({ chatId, usuarioIdPadre }: EventosChats["chat.mensaje"]) => {
    const senal = { tipo: "chat", datos: { chatId } };
    canal.enviarARoles(["admin", "secretario"], senal);
    if (usuarioIdPadre) canal.enviarA(usuarioIdPadre, "padre", senal);
  };
  tablero.alConfirmarse("chat.mensaje", avisar);
  tablero.alConfirmarse("chat.leido", avisar);
}
