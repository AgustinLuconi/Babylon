import type { Request, Response } from "express";
import { activarCuentaSchema, invitarSchema, reenviarSchema, tokenInvitacionSchema } from "./invitacion.schema";
import type { InvitacionService } from "./invitacion.service";

export class InvitacionController {
  constructor(private readonly invitaciones: InvitacionService) {}

  listarPendientes = async (_req: Request, res: Response) => {
    res.status(200).json(await this.invitaciones.listarPendientes());
  };

  invitar = async (req: Request, res: Response) => {
    const { padreIds, profesorIds } = invitarSchema.parse(req.body);
    res.status(200).json({ resultados: await this.invitaciones.invitar(padreIds, profesorIds) });
  };

  reenviar = async (req: Request, res: Response) => {
    const { usuarioIds } = reenviarSchema.parse(req.body);
    res.status(200).json({ resultados: await this.invitaciones.reenviar(usuarioIds) });
  };

  cancelar = async (req: Request, res: Response) => {
    await this.invitaciones.cancelar(String(req.params.usuarioId));
    res.status(204).end();
  };

  consultar = async (req: Request, res: Response) => {
    const { token } = tokenInvitacionSchema.parse(req.body);
    res.status(200).json(await this.invitaciones.consultarInvitacion(token));
  };

  activar = async (req: Request, res: Response) => {
    const { token, password } = activarCuentaSchema.parse(req.body);
    await this.invitaciones.activarCuenta(token, password);
    res.status(204).end();
  };
}
