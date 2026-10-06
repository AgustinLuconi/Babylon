import type { Request, Response } from "express";
import type { PadreService } from "../padres/padre.service";
import type { ProfesorService } from "../profesores/profesor.service";
import type { NotificacionService } from "./notificacion.service";

export class NotificacionController {
  constructor(
    private readonly notificacionService: NotificacionService,
    private readonly padreService: PadreService,
    private readonly profesorService: ProfesorService,
  ) {}

  listar = async (req: Request, res: Response) => {
    const { sub, rol } = req.auth!;
    if (rol === "padre") {
      const padre = await this.padreService.buscarPorUsuarioId(sub);
      res.status(200).json(await this.notificacionService.listarParaPadre(padre.id));
      return;
    }
    if (rol === "profesor") {
      const profesor = await this.profesorService.buscarPorUsuarioId(sub);
      res.status(200).json(await this.notificacionService.listarParaProfesor(profesor.id));
      return;
    }
    res.status(200).json(await this.notificacionService.listarParaStaff());
  };
}
