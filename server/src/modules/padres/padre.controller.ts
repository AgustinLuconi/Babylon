import type { Request, Response } from "express";
import { actualizarPadreSchema, crearPadreSchema } from "./padre.schema";
import type { PadreService } from "./padre.service";

export class PadreController {
  constructor(private readonly padreService: PadreService) {}

  listar = async (_req: Request, res: Response) => {
    const padres = await this.padreService.listarPadres();
    res.status(200).json(padres);
  };

  crear = async (req: Request, res: Response) => {
    const datos = crearPadreSchema.parse(req.body);
    const padre = await this.padreService.crearPadre(datos);
    res.status(201).json(padre);
  };

  actualizar = async (req: Request, res: Response) => {
    const datos = actualizarPadreSchema.parse(req.body);
    const padre = await this.padreService.actualizarPadre(String(req.params.id), datos);
    res.status(200).json(padre);
  };
}
