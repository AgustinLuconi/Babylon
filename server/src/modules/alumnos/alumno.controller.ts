import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { actualizarAlumnoSchema, nuevoAlumnoSchema, responsableSchema } from "./alumno.schema";
import type { AlumnoService } from "./alumno.service";

export class AlumnoController {
  constructor(
    private readonly alumnoService: AlumnoService,
    private readonly padreService: PadreService,
  ) {}

  listar = async (req: Request, res: Response) => {
    if (typeof req.query.cicloId === "string") {
      const alumnos = await this.alumnoService.listarPorCiclo(req.query.cicloId);
      res.status(200).json(alumnos);
      return;
    }
    const alumnos = await this.alumnoService.listarAlumnos();
    res.status(200).json(alumnos);
  };

  incompletos = async (_req: Request, res: Response) => {
    res.status(200).json(await this.alumnoService.listarIncompletos());
  };

  misHijos = async (req: Request, res: Response) => {
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    const alumnos = await this.alumnoService.listarPorPadreConCurso(padre.id);
    res.status(200).json(alumnos);
  };

  inscribir = async (req: Request, res: Response) => {
    const datos = nuevoAlumnoSchema.parse(req.body);
    const alumno = await this.alumnoService.inscribirAlumno(datos);
    res.status(201).json(alumno);
  };

  asignarResponsable = async (req: Request, res: Response) => {
    const responsable = responsableSchema.parse(req.body);
    const alumno = await this.alumnoService.asignarResponsable(String(req.params.id), responsable);
    res.status(200).json(alumno);
  };

  historialDeCursos = async (req: Request, res: Response) => {
    // Una familia ve solo el de su hijo; administración y secretaría, el de cualquier alumno.
    const padreId = req.auth!.rol === "padre" ? (await this.padreService.buscarPorUsuarioId(req.auth!.sub)).id : undefined;
    res.status(200).json(await this.alumnoService.listarHistorialDeCursos(String(req.params.id), padreId));
  };

  actualizar = async (req: Request, res: Response) => {
    const datos = actualizarAlumnoSchema.parse(req.body);
    const alumno = await this.alumnoService.actualizarAlumno(String(req.params.id), datos);
    res.status(200).json(alumno);
  };
}
