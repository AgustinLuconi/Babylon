import type { Request, Response } from "express";
import type { Destinatario } from "./notificacion.entity";
import { historialSchema, preferenciaSchema, tipoNotificacionSchema } from "./notificacion.schema";
import type { NotificacionService } from "./notificacion.service";

// Cada pedido trabaja solo con los avisos de la cuenta y el rol de la sesión.
const destinatario = (req: Request): Destinatario => ({ usuarioId: req.auth!.sub, rol: req.auth!.rol });

export class NotificacionController {
  constructor(private readonly notificacionService: NotificacionService) {}

  campana = async (req: Request, res: Response) => {
    res.status(200).json(await this.notificacionService.campana(destinatario(req)));
  };

  historial = async (req: Request, res: Response) => {
    const { filtro, despuesDe } = historialSchema.parse(req.query);
    res.status(200).json(await this.notificacionService.historial(destinatario(req), filtro, despuesDe));
  };

  marcarLeida = async (req: Request, res: Response) => {
    await this.notificacionService.marcarLeida(destinatario(req), String(req.params.id));
    res.status(204).end();
  };

  leerTodas = async (req: Request, res: Response) => {
    res.status(200).json({ marcadas: await this.notificacionService.leerTodas(destinatario(req)) });
  };

  preferencias = async (req: Request, res: Response) => {
    res.status(200).json(await this.notificacionService.preferencias(destinatario(req)));
  };

  cambiarPreferencia = async (req: Request, res: Response) => {
    const tipo = tipoNotificacionSchema.parse(req.params.tipo);
    const { activa } = preferenciaSchema.parse(req.body);
    await this.notificacionService.cambiarPreferencia(destinatario(req), tipo, activa);
    res.status(204).end();
  };
}
