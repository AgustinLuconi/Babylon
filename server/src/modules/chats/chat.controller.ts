import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { enviarMensajeSchema } from "./chat.schema";
import type { ChatService } from "./chat.service";
import type { RolEmisorMensaje } from "./mensaje.entity";

export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly padreService: PadreService,
  ) {}

  private async resolverPadreIdSiCorresponde(req: Request): Promise<string | undefined> {
    if (req.auth!.rol !== "padre") {
      return undefined;
    }
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    return padre.id;
  }

  listar = async (_req: Request, res: Response) => {
    const chats = await this.chatService.listarChats();
    res.status(200).json(chats);
  };

  miChat = async (req: Request, res: Response) => {
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    const chat = await this.chatService.obtenerOCrearChatDePadre(padre.id);
    res.status(200).json(chat);
  };

  listarMensajes = async (req: Request, res: Response) => {
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    const mensajes = await this.chatService.listarMensajes(String(req.params.id), padreId);
    res.status(200).json(mensajes);
  };

  enviarMensaje = async (req: Request, res: Response) => {
    const datos = enviarMensajeSchema.parse(req.body);
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    // requireRole("admin", "secretario", "padre") en la ruta ya garantiza que
    // el rol autenticado es uno de estos tres (profesor no llega hasta acá).
    const rolEmisor = req.auth!.rol as RolEmisorMensaje;

    const mensaje = await this.chatService.enviarMensaje(String(req.params.id), datos.texto, req.auth!.sub, rolEmisor, padreId);
    res.status(201).json(mensaje);
  };
}
