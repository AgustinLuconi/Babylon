import type { Request, Response } from "express";
import { actualizarAutomatizacionSchema, historialDeAutomatizacionSchema } from "./automatizacion.schema";
import type { AutomatizacionService } from "./automatizacion.service";

export class AutomatizacionController {
  constructor(private readonly automatizacionService: AutomatizacionService) {}

  listar = async (_req: Request, res: Response) => {
    res.status(200).json(await this.automatizacionService.listar());
  };

  actualizar = async (req: Request, res: Response) => {
    const cambios = actualizarAutomatizacionSchema.parse(req.body);
    res.status(200).json(await this.automatizacionService.actualizar(String(req.params.regla), cambios));
  };

  historial = async (req: Request, res: Response) => {
    const { pagina } = historialDeAutomatizacionSchema.parse(req.query);
    res.status(200).json(await this.automatizacionService.historial(String(req.params.regla), pagina));
  };
}
