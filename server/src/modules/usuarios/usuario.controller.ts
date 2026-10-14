import type { Request, Response } from "express";
import { describirDispositivo } from "../../core/dispositivo";
import {
  cambiarContrasenaSchema,
  cambiarEstadoUsuarioSchema,
  crearAdministradorSchema,
  crearSecretarioSchema,
  credencialesSchema,
  olvideContrasenaSchema,
  restablecerContrasenaSchema,
  verificarEmailSchema,
} from "./usuario.schema";
import type { UsuarioService } from "./usuario.service";

export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  login = async (req: Request, res: Response) => {
    const credenciales = credencialesSchema.parse(req.body);
    const sesion = await this.usuarioService.autenticar(credenciales, {
      dispositivo: describirDispositivo(req.headers["user-agent"]),
      ip: req.ip ?? null,
    });
    res.status(200).json(sesion);
  };

  cambiarContrasena = async (req: Request, res: Response) => {
    const datos = cambiarContrasenaSchema.parse(req.body);
    await this.usuarioService.cambiarContrasena(req.auth!.sub, req.auth!.sesionId, datos);
    res.status(204).end();
  };

  yo = async (req: Request, res: Response) => {
    res.status(200).json(await this.usuarioService.yo(req.auth!.sub, req.auth!.rol));
  };

  enviarVerificacion = async (req: Request, res: Response) => {
    await this.usuarioService.enviarVerificacion(req.auth!.sub);
    res.status(204).end();
  };

  verificarEmail = async (req: Request, res: Response) => {
    const { token } = verificarEmailSchema.parse(req.body);
    await this.usuarioService.verificarEmail(token);
    res.status(204).end();
  };

  logout = async (req: Request, res: Response) => {
    await this.usuarioService.cerrarSesion(req.auth!.sesionId, req.auth!.sub);
    res.status(204).end();
  };

  listarSesiones = async (req: Request, res: Response) => {
    res.status(200).json(await this.usuarioService.listarSesiones(req.auth!.sub, req.auth!.sesionId));
  };

  cerrarSesionAjena = async (req: Request, res: Response) => {
    await this.usuarioService.cerrarSesionAjena(req.auth!.sub, req.auth!.sesionId, String(req.params.id));
    res.status(204).end();
  };

  cerrarOtrasSesiones = async (req: Request, res: Response) => {
    const cerradas = await this.usuarioService.cerrarOtrasSesiones(req.auth!.sub, req.auth!.sesionId);
    res.status(200).json({ cerradas });
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

  olvideContrasena = async (req: Request, res: Response) => {
    const { email } = olvideContrasenaSchema.parse(req.body);
    await this.usuarioService.solicitarRecuperacion(email);
    res.status(200).json({
      mensaje: "Si el email está registrado, te enviamos un enlace para restablecer la contraseña. Revisá también la carpeta de spam.",
    });
  };

  restablecerContrasena = async (req: Request, res: Response) => {
    const { token, password } = restablecerContrasenaSchema.parse(req.body);
    await this.usuarioService.restablecerContrasena(token, password);
    res.status(204).end();
  };
}
