import type { Request, Response } from "express";
import { paseDeAnioSchema } from "./paseDeAnio.schema";
import type { PaseDeAnioService } from "./paseDeAnio.service";

export class PaseDeAnioController {
  constructor(private readonly servicio: PaseDeAnioService) {}

  vistaPrevia = async (req: Request, res: Response) => {
    res.status(200).json(await this.servicio.vistaPrevia(paseDeAnioSchema.parse(req.body)));
  };

  confirmar = async (req: Request, res: Response) => {
    res.status(200).json(await this.servicio.confirmar(paseDeAnioSchema.parse(req.body)));
  };
}
