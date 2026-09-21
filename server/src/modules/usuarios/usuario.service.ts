import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Rol, UnitOfWork } from "../../core/ports";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";
import type { CambiarEstadoUsuarioInput, CredencialesInput, CrearAdministradorInput, CrearSecretarioInput } from "./usuario.schema";

export type UsuarioSinPassword = Omit<Usuario, "passwordHash">;

export interface SesionAutenticada {
  requiereSeleccionRol: false;
  token: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
  };
}

export interface SeleccionRolRequerida {
  requiereSeleccionRol: true;
  rolesDisponibles: Rol[];
}

export type ResultadoAutenticacion = SesionAutenticada | SeleccionRolRequerida;

export class UsuarioService {
  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async autenticar({ email, password, rolElegido }: CredencialesInput): Promise<ResultadoAutenticacion> {
    const usuario = await this.usuarioRepo.findByEmail(email);

    // Mismo mensaje genérico para usuario inexistente, inactivo o contraseña
    // incorrecta: evita que la respuesta permita enumerar emails registrados.
    if (!usuario || usuario.estado !== "activo") {
      throw new AuthenticationError("Email o contraseña incorrectos");
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValida) {
      throw new AuthenticationError("Email o contraseña incorrectos");
    }

    let rolActivo: Rol;
    if (usuario.roles.length === 1) {
      rolActivo = usuario.roles[0];
    } else if (!rolElegido) {
      return { requiereSeleccionRol: true, rolesDisponibles: usuario.roles };
    } else if (!usuario.roles.includes(rolElegido)) {
      throw new ValidationError("El rol elegido no está habilitado para esta cuenta");
    } else {
      rolActivo = rolElegido;
    }

    const token = jwt.sign({ sub: usuario.id, rol: rolActivo }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });

    return {
      requiereSeleccionRol: false,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: rolActivo,
      },
    };
  }

  // Secretario no tiene entidad propia (a diferencia de Padre/Profesor): no
  // guarda ningún dato que Usuario no tenga ya, así que el alta es directa acá.
  async crearSecretario(datos: CrearSecretarioInput): Promise<UsuarioSinPassword> {
    return this.crearUsuarioSimple(datos, "secretario");
  }

  // Mismo criterio que Secretario: sin entidad propia, es solo un Usuario.
  async crearAdministrador(datos: CrearAdministradorInput): Promise<UsuarioSinPassword> {
    return this.crearUsuarioSimple(datos, "admin");
  }

  private async crearUsuarioSimple(datos: CrearSecretarioInput, rol: Rol): Promise<UsuarioSinPassword> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }

    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await bcrypt.hash(datos.password, 10),
      roles: [rol],
      estado: "activo",
      fechaCreacion: new Date(),
    };
    await this.usuarioRepo.create(usuario);

    const { passwordHash: _passwordHash, ...usuarioSinPassword } = usuario;
    return usuarioSinPassword;
  }

  async listarUsuarios(): Promise<UsuarioSinPassword[]> {
    const usuarios = await this.usuarioRepo.findAll();
    return usuarios
      .map(({ passwordHash: _passwordHash, ...usuarioSinPassword }) => usuarioSinPassword)
      .sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime());
  }

  // Un usuario inactivo no puede iniciar sesión (ver `autenticar`). Si la
  // cuenta es la de un profesor, su ficha se mantiene sincronizada en la
  // misma transacción (ver también `ProfesorService.actualizarProfesor`).
  async cambiarEstado(id: string, { estado }: CambiarEstadoUsuarioInput, actorId: string): Promise<UsuarioSinPassword> {
    if (id === actorId && estado === "inactivo") {
      throw new ValidationError("No podés desactivar tu propia cuenta");
    }

    const usuario = await this.usuarioRepo.findById(id);
    if (!usuario) {
      throw new EntityNotFoundError("Usuario", id);
    }

    const actualizado = await this.unitOfWork.runInTransaction(async (tx) => {
      const resultado = await this.usuarioRepo.update(id, { ...usuario, estado }, tx);
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      return resultado;
    });

    const { passwordHash: _passwordHash, ...usuarioSinPassword } = actualizado;
    return usuarioSinPassword;
  }
}
