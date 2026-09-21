import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import type { ProfesorService } from "../profesores/profesor.service";
import { crearCategoriaPersonalizadaSchema, crearObservacionSchema } from "./observacion.schema";
import type { ObservacionService, Solicitante } from "./observacion.service";

export class ObservacionController {
  constructor(
    private readonly observacionService: ObservacionService,
    private readonly padreService: PadreService,
    private readonly profesorService: ProfesorService,
  ) {}

  private async resolverSolicitante(req: Request): Promise<Solicitante> {
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      return { rol: "padre", padreId: padre.id };
    }
    return { rol: req.auth!.rol };
  }

  private async resolverProfesorIdSiCorresponde(req: Request): Promise<string | undefined> {
    if (req.auth!.rol !== "profesor") return undefined;
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    return profesor.id;
  }

  crear = async (req: Request, res: Response) => {
    const datos = crearObservacionSchema.parse(req.body);
    const observacion = await this.observacionService.crearObservacion(datos, req.auth!.sub, req.auth!.rol);
    res.status(201).json(observacion);
  };

  listarPorAlumno = async (req: Request, res: Response) => {
    const solicitante = await this.resolverSolicitante(req);
    const observaciones = await this.observacionService.listarPorAlumno(req.params.alumnoId, solicitante);
    res.status(200).json(observaciones);
  };

  crearCategoriaPersonalizada = async (req: Request, res: Response) => {
    const datos = crearCategoriaPersonalizadaSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const categoria = await this.observacionService.crearCategoriaPersonalizada(datos, profesor.id);
    res.status(201).json(categoria);
  };

  listarCategoriasPersonalizadas = async (req: Request, res: Response) => {
    const profesorId = await this.resolverProfesorIdSiCorresponde(req);
    const categorias = await this.observacionService.listarCategoriasPersonalizadas(req.params.cursoId, profesorId);
    res.status(200).json(categorias);
  };
}
