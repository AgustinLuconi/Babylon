import type { Request, Response } from "express";
import { cambiarEstadoUsuarioSchema, crearAdministradorSchema, crearSecretarioSchema, credencialesSchema } from "./usuario.schema";
import type { UsuarioService } from "./usuario.service";

export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  login = async (req: Request, res: Response) => {
    const credenciales = credencialesSchema.parse(req.body);
    const sesion = await this.usuarioService.autenticar(credenciales);
    res.status(200).json(sesion);
  };

  crearSecretario = async (req: Request, res: Response) => {
    const datos = crearSecretarioSchema.parse(req.body);
    const secretario = await this.usuarioService.crearSecretario(datos);
    res.status(201).json(secretario);
  };

  crearAdministrador = async (req: Request, res: Response) => {
    const datos = crearAdministradorSchema.parse(req.body);
    const administrador = await this.usuarioService.crearAdministrador(datos);
    res.status(201).json(administrador);
  };

  listarUsuarios = async (_req: Request, res: Response) => {
    const usuarios = await this.usuarioService.listarUsuarios();
    res.status(200).json(usuarios);
  };

  cambiarEstado = async (req: Request, res: Response) => {
    const datos = cambiarEstadoUsuarioSchema.parse(req.body);
    const usuario = await this.usuarioService.cambiarEstado(String(req.params.id), datos, req.auth!.sub);
    res.status(200).json(usuario);
  };
}
