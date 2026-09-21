import type { Request, Response } from "express";
import { crearCicloSchema } from "./ciclo.schema";
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
    const ciclo = await this.cicloService.marcarActivo(req.params.id);
    res.status(200).json(ciclo);
  };
}
