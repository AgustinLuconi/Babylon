import type { Request, Response } from "express";
import { crearCicloSchema, crearPausaSchema, editarFechasSchema, editarPausaSchema } from "./ciclo.schema";
import type { CicloService } from "./ciclo.service";

export class CicloController {
  constructor(private readonly cicloService: CicloService) {}

  listar = async (_req: Request, res: Response) => {
    const ciclos = await this.cicloService.listarCiclos();
    res.status(200).json(ciclos);
  };

  crear = async (req: Request, res: Response) => {
    const datos = crearCicloSchema.parse(req.body);
    const ciclo = await this.cicloService.crearCiclo(datos);
    res.status(201).json(ciclo);
  };

  marcarActivo = async (req: Request, res: Response) => {
    const ciclo = await this.cicloService.marcarActivo(String(req.params.id));
    res.status(200).json(ciclo);
  };

  bloquear = async (req: Request, res: Response) => {
    res.status(200).json(await this.cicloService.bloquearCiclo(String(req.params.id)));
  };

  desbloquear = async (req: Request, res: Response) => {
    res.status(200).json(await this.cicloService.desbloquearCiclo(String(req.params.id)));
  };

  editarFechas = async (req: Request, res: Response) => {
    const datos = editarFechasSchema.parse(req.body);
    res.status(200).json(await this.cicloService.editarFechas(String(req.params.id), datos));
  };

  agregarPausa = async (req: Request, res: Response) => {
    const datos = crearPausaSchema.parse(req.body);
    res.status(201).json(await this.cicloService.agregarPausa(String(req.params.id), datos));
  };

  editarPausa = async (req: Request, res: Response) => {
    const datos = editarPausaSchema.parse(req.body);
    res.status(200).json(await this.cicloService.editarPausa(String(req.params.id), String(req.params.pausaId), datos));
  };

  eliminarPausa = async (req: Request, res: Response) => {
    await this.cicloService.eliminarPausa(String(req.params.id), String(req.params.pausaId));
    res.status(204).send();
  };
}
