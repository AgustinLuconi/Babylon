import type { Request, Response } from "express";
import { actualizarConfiguracionSchema } from "./configuracion.schema";
import type { ConfiguracionService } from "./configuracion.service";

export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  obtener = async (_req: Request, res: Response) => {
    res.status(200).json(await this.configuracionService.obtener());
  };

  actualizar = async (req: Request, res: Response) => {
    const datos = actualizarConfiguracionSchema.parse(req.body);
    res.status(200).json(await this.configuracionService.actualizar(datos));
  };
}
