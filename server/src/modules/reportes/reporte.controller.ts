import type { Request, Response } from "express";
import type { ReporteService } from "./reporte.service";

export class ReporteController {
  constructor(private readonly reporteService: ReporteService) {}

  obtenerResumenDashboard = async (req: Request, res: Response) => {
    const cicloId = typeof req.query.cicloId === "string" ? req.query.cicloId : undefined;
    const resumen = await this.reporteService.obtenerResumenDashboard(cicloId);
    res.status(200).json(resumen);
  };

  listarReporteAlumnos = async (req: Request, res: Response) => {
    const cicloId = typeof req.query.cicloId === "string" ? req.query.cicloId : undefined;
    const reporte = await this.reporteService.listarReporteAlumnos(cicloId);
    res.status(200).json(reporte);
  };
}
