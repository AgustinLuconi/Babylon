import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { registrarPagoSchema } from "./cuota.schema";
import type { CuotaService, Solicitante } from "./cuota.service";

export class CuotaController {
  constructor(
    private readonly cuotaService: CuotaService,
    private readonly padreService: PadreService,
  ) {}

  listarPorAlumno = async (req: Request, res: Response) => {
    let solicitante: Solicitante;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      solicitante = { rol: "padre", padreId: padre.id };
    } else {
      solicitante = { rol: req.auth!.rol };
    }
    const cuotas = await this.cuotaService.listarPorAlumno(String(req.params.alumnoId), solicitante);
    res.status(200).json(cuotas);
  };

  listarTodas = async (_req: Request, res: Response) => {
    const cuotas = await this.cuotaService.listarTodas();
    res.status(200).json(cuotas);
  };

  listarPagos = async (_req: Request, res: Response) => {
    const pagos = await this.cuotaService.listarPagos();
    res.status(200).json(pagos);
  };

  registrarPago = async (req: Request, res: Response) => {
    const body = registrarPagoSchema.parse(req.body);
    const registradoPor = req.auth!.sub;
    const pagos = await this.cuotaService.registrarPago({ ...body, registradoPor });
    res.status(201).json(pagos);
  };
}
