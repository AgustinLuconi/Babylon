import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import { autorizarImagenSchema, marcarCargadoSchema } from "./documento.schema";
import type { DocumentoService } from "./documento.service";

export class DocumentoController {
  constructor(
    private readonly documentoService: DocumentoService,
    private readonly padreService: PadreService,
  ) {}

  listarPorAlumno = async (req: Request, res: Response) => {
    let padreId: string | undefined;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      padreId = padre.id;
    }
    const documentos = await this.documentoService.listarPorAlumno(req.params.alumnoId, padreId);
    res.status(200).json(documentos);
  };

  marcarCargado = async (req: Request, res: Response) => {
    const { tipo } = marcarCargadoSchema.parse(req.body);
    let padreId: string | undefined;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      padreId = padre.id;
    }
    const documento = await this.documentoService.marcarCargado(req.params.alumnoId, tipo, padreId);
    res.status(200).json(documento);
  };

  autorizarImagen = async (req: Request, res: Response) => {
    const datos = autorizarImagenSchema.parse(req.body);
    const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
    const documento = await this.documentoService.autorizarImagen(datos, padre.id);
    res.status(200).json(documento);
  };

  obtenerAutorizacionImagen = async (req: Request, res: Response) => {
    let padreId: string | undefined;
    if (req.auth!.rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(req.auth!.sub);
      padreId = padre.id;
    }
    const documento = await this.documentoService.obtenerAutorizacionImagen(req.params.alumnoId, padreId);
    res.status(200).json(documento);
  };

  marcarAutorizacionManual = async (req: Request, res: Response) => {
    const documento = await this.documentoService.marcarAutorizacionManual(req.params.alumnoId);
    res.status(200).json(documento);
  };

  revocarAutorizacion = async (req: Request, res: Response) => {
    const documento = await this.documentoService.revocarAutorizacion(req.params.alumnoId);
    res.status(200).json(documento);
  };
}
