import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { enviarMensajeSchema, iniciarConversacionSchema, marcarLeidoSchema } from "./chat.schema";
import type { ChatService } from "./chat.service";
import type { Lector, RolEmisorMensaje } from "./mensaje.entity";

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

  // Quien lee: el padre es "familia"; administración y secretaría son "instituto" (bandeja compartida).
  private lector(req: Request): Lector {
    return req.auth!.rol === "padre" ? "familia" : "instituto";
  }

  listar = async (_req: Request, res: Response) => {
    res.status(200).json(await this.chatService.listarResumenes());
  };

  iniciar = async (req: Request, res: Response) => {
    const { padreId } = iniciarConversacionSchema.parse(req.body);
    res.status(200).json(await this.chatService.iniciarConversacion(padreId));
  };

  miChat = async (req: Request, res: Response) => {
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    res.status(200).json(await this.chatService.miConversacion(padre.id));
  };

  noLeidos = async (req: Request, res: Response) => {
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    res.status(200).json(await this.chatService.noLeidos(this.lector(req), padreId));
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

  marcarLeido = async (req: Request, res: Response) => {
    // Sin cuerpo, Express 5 deja `req.body` en undefined.
    const { hasta } = marcarLeidoSchema.parse(req.body ?? {});
    const padreId = await this.resolverPadreIdSiCorresponde(req);
    await this.chatService.marcarLeido(String(req.params.id), this.lector(req), padreId, hasta);
    res.status(204).end();
  };
}
