import type { Request, Response } from "express";
import { actualizarProfesorSchema, crearProfesorSchema } from "./profesor.schema";
import type { ProfesorService } from "./profesor.service";

export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  listar = async (_req: Request, res: Response) => {
    const profesores = await this.profesorService.listarProfesores();
    res.status(200).json(profesores);
  };

  crear = async (req: Request, res: Response) => {
    const datos = crearProfesorSchema.parse(req.body);
    const profesor = await this.profesorService.crearProfesor(datos);
    res.status(201).json(profesor);
  };

  actualizar = async (req: Request, res: Response) => {
    const datos = actualizarProfesorSchema.parse(req.body);
    const profesor = await this.profesorService.actualizarProfesor(String(req.params.id), datos);
    res.status(200).json(profesor);
  };
}
