import type { Request, Response } from "express";
import type { ProfesorService } from "../profesores/profesor.service";
import type { AlumnoService } from "../alumnos/alumno.service";
import { actualizarCursoSchema, crearCursoSchema } from "./curso.schema";
import type { CursoService } from "./curso.service";

export class CursoController {
  constructor(
    private readonly cursoService: CursoService,
    private readonly profesorService: ProfesorService,
    private readonly alumnoService: AlumnoService,
  ) {}

  listar = async (req: Request, res: Response) => {
    if (req.auth!.rol === "profesor") {
      const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
      const cursos = await this.cursoService.listarPorProfesor(profesor.id);
      res.status(200).json(cursos);
      return;
    }

    if (typeof req.query.cicloId === "string") {
      const cursos = await this.cursoService.listarPorCiclo(req.query.cicloId);
      res.status(200).json(cursos);
      return;
    }

    const cursos = await this.cursoService.listarCursos();
    res.status(200).json(cursos);
  };

  crear = async (req: Request, res: Response) => {
    const datos = crearCursoSchema.parse(req.body);
    const curso = await this.cursoService.crearCurso(datos);
    res.status(201).json(curso);
  };

  actualizar = async (req: Request, res: Response) => {
    const datos = actualizarCursoSchema.parse(req.body);
    const curso = await this.cursoService.actualizarCurso(String(req.params.id), datos);
    res.status(200).json(curso);
  };

  listarHorarios = async (_req: Request, res: Response) => {
    const horarios = await this.cursoService.listarHorarios();
    res.status(200).json(horarios);
  };

  listarAlumnos = async (req: Request, res: Response) => {
    let profesorId: string | undefined;
    if (req.auth!.rol === "profesor") {
      const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
      profesorId = profesor.id;
    }

    const alumnos = await this.alumnoService.listarPorCurso(String(req.params.id), profesorId);
    res.status(200).json(alumnos);
  };
}
