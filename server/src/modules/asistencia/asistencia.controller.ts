import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import type { ProfesorService } from "../profesores/profesor.service";
import { marcarSinClasesSchema, quitarSinClasesSchema, registrarAsistenciaMasivaSchema } from "./asistencia.schema";
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

  marcarSinClases = async (req: Request, res: Response) => {
    const datos = marcarSinClasesSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const clase = await this.asistenciaService.marcarSinClases(datos, profesor.id, req.auth!.sub);
    res.status(201).json(clase);
  };

  quitarSinClases = async (req: Request, res: Response) => {
    const datos = quitarSinClasesSchema.parse({ cursoId: req.params.cursoId, fecha: req.params.fecha });
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    await this.asistenciaService.quitarSinClases(datos, profesor.id);
    res.status(204).send();
  };

  listarPorAlumno = async (req: Request, res: Response) => {
    let solicitante: Solicitante;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      solicitante = { rol: "padre", padreId: padre.id };
    } else {
      solicitante = { rol: req.auth!.rol };
    }
    const asistencias = await this.asistenciaService.listarPorAlumno(String(req.params.alumnoId), solicitante);
    res.status(200).json(asistencias);
  };

  listarSinClasesDeCurso = async (req: Request, res: Response) => {
    const solicitante =
      req.auth!.rol === "profesor"
        ? { rol: req.auth!.rol, profesorId: (await this.profesorService.buscarPorUsuarioId(req.auth!.sub)).id }
        : { rol: req.auth!.rol };
    res.status(200).json(await this.asistenciaService.listarSinClasesDeCurso(String(req.params.cursoId), solicitante));
  };

  listarSinClasesDeAlumno = async (req: Request, res: Response) => {
    let solicitante: Solicitante;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      solicitante = { rol: "padre", padreId: padre.id };
    } else {
      solicitante = { rol: req.auth!.rol };
    }
    res.status(200).json(await this.asistenciaService.listarSinClasesDeAlumno(String(req.params.alumnoId), solicitante));
  };
}
