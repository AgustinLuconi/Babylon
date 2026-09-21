import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import type { ProfesorService } from "../profesores/profesor.service";
import { registrarAsistenciaMasivaSchema } from "./asistencia.schema";
import type { AsistenciaService, Solicitante } from "./asistencia.service";

export class AsistenciaController {
  constructor(
    private readonly asistenciaService: AsistenciaService,
    private readonly profesorService: ProfesorService,
    private readonly padreService: PadreService,
  ) {}

  registrarMasiva = async (req: Request, res: Response) => {
    const datos = registrarAsistenciaMasivaSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const asistencias = await this.asistenciaService.registrarAsistenciaMasiva(datos, profesor.id);
    res.status(201).json(asistencias);
  };

  listarPorAlumno = async (req: Request, res: Response) => {
    let solicitante: Solicitante;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      solicitante = { rol: "padre", padreId: padre.id };
    } else {
      solicitante = { rol: req.auth!.rol };
    }
    const asistencias = await this.asistenciaService.listarPorAlumno(req.params.alumnoId, solicitante);
    res.status(200).json(asistencias);
  };
}
