import type { Request, Response } from "express";
import type { ProfesorService } from "../profesores/profesor.service";
import type { PadreService } from "../padres/padre.service";
import {
  cargarCalificacionesSchema,
  cargarNotaCierreSchema,
  crearEvaluacionSchema,
} from "./calificacion.schema";
import type { CalificacionService, Solicitante } from "./calificacion.service";

export class CalificacionController {
  constructor(
    private readonly calificacionService: CalificacionService,
    private readonly profesorService: ProfesorService,
    private readonly padreService: PadreService,
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

  listarEvaluacionesPorCurso = async (req: Request, res: Response) => {
    const profesorId = await this.resolverProfesorIdSiCorresponde(req);
    const evaluaciones = await this.calificacionService.listarEvaluacionesPorCurso(req.params.cursoId, profesorId);
    res.status(200).json(evaluaciones);
  };

  listarNotasCierrePorCurso = async (req: Request, res: Response) => {
    const profesorId = await this.resolverProfesorIdSiCorresponde(req);
    const periodo = req.query.periodo === "noviembre" ? "noviembre" : "julio";
    const notas = await this.calificacionService.listarNotasCierrePorCurso(req.params.cursoId, periodo, profesorId);
    res.status(200).json(notas);
  };

  listarCalificacionesDeEvaluacion = async (req: Request, res: Response) => {
    const profesorId = await this.resolverProfesorIdSiCorresponde(req);
    const calificaciones = await this.calificacionService.listarCalificacionesDeEvaluacion(
      req.params.id,
      profesorId,
    );
    res.status(200).json(calificaciones);
  };

  crearEvaluacion = async (req: Request, res: Response) => {
    const datos = crearEvaluacionSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const evaluacion = await this.calificacionService.crearEvaluacion(datos, profesor.id);
    res.status(201).json(evaluacion);
  };

  publicarEvaluacion = async (req: Request, res: Response) => {
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const evaluacion = await this.calificacionService.publicarEvaluacion(req.params.id, profesor.id);
    res.status(200).json(evaluacion);
  };

  cargarCalificaciones = async (req: Request, res: Response) => {
    const datos = cargarCalificacionesSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const calificaciones = await this.calificacionService.cargarCalificaciones(req.params.id, datos, profesor.id);
    res.status(201).json(calificaciones);
  };

  cargarNotaCierre = async (req: Request, res: Response) => {
    const datos = cargarNotaCierreSchema.parse(req.body);
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const notaCierre = await this.calificacionService.cargarNotaCierre(datos, profesor.id);
    res.status(201).json(notaCierre);
  };

  publicarNotaCierre = async (req: Request, res: Response) => {
    const profesor = await this.profesorService.buscarPorUsuarioId(req.auth!.sub);
    const notaCierre = await this.calificacionService.publicarNotaCierre(req.params.id, profesor.id);
    res.status(200).json(notaCierre);
  };

  listarCalificacionesPorAlumno = async (req: Request, res: Response) => {
    const solicitante = await this.resolverSolicitante(req);
    const calificaciones = await this.calificacionService.listarCalificacionesDeAlumno(
      req.params.alumnoId,
      solicitante,
    );
    res.status(200).json(calificaciones);
  };

  listarNotasCierrePorAlumno = async (req: Request, res: Response) => {
    const solicitante = await this.resolverSolicitante(req);
    const notas = await this.calificacionService.listarNotasCierreDeAlumno(req.params.alumnoId, solicitante);
    res.status(200).json(notas);
  };
}
