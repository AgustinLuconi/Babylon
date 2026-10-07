import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Mailer, Rol, UnitOfWork } from "../../core/ports";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { correoRecuperacion } from "./correoRecuperacion";
import type { UsuarioRepository } from "./usuario.repository";
import { conEstado, type Usuario } from "./usuario.entity";
import type { CambiarEstadoUsuarioInput, CredencialesInput, CrearAdministradorInput, CrearSecretarioInput } from "./usuario.schema";

const RONDAS_BCRYPT = 10;
const VIGENCIA_ENLACE_MS = 60 * 60 * 1000;
const MAX_ENLACES_POR_HORA = 3;
const ESPERA_ENTRE_ENLACES_MS = 60 * 1000;
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo.";

const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

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
    private readonly mailer: Mailer,
  ) {}

  async autenticar({ email, password, rolElegido, recordarme }: CredencialesInput): Promise<ResultadoAutenticacion> {
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
      expiresIn: (recordarme ? config.JWT_EXPIRES_IN_RECORDAR : config.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
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
      passwordHash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
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
      const resultado = await this.usuarioRepo.update(id, conEstado(usuario, estado), tx);
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      return resultado;
    });

    const { passwordHash: _passwordHash, ...usuarioSinPassword } = actualizado;
    return usuarioSinPassword;
  }

  // Siempre termina sin error, exista o no la cuenta: la respuesta no puede
  // revelar qué emails están registrados. Tampoco puede revelarlo el tiempo: tras
  // buscar la cuenta (una consulta, igual para ambos casos) se responde, y todo lo
  // demás (límites, alta del token, correo) corre en segundo plano. Si la cuenta
  // superó su límite de pedidos, tampoco se envía nada.
  async solicitarRecuperacion(email: string, ahora: Date = new Date()): Promise<void> {
    const usuario = await this.usuarioRepo.findByEmail(email);
    if (!usuario || usuario.estado !== "activo") return;

    void this.enviarEnlaceDeRecuperacion(usuario, ahora).catch((error) =>
      console.error(`[correo] no se pudo preparar la recuperación de ${usuario.email}:`, error),
    );
  }

  private async enviarEnlaceDeRecuperacion(usuario: Usuario, ahora: Date): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    // Las comprobaciones y el alta del token van juntas bajo un bloqueo de la cuenta: si no,
    // varios pedidos simultáneos leerían "ningún enlace reciente" a la vez y pasarían todos.
    const creado = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuario.id, tx);
      const recientes = await this.usuarioRepo.findTokensRecuperacionDesde(usuario.id, new Date(ahora.getTime() - VIGENCIA_ENLACE_MS), tx);
      if (recientes.length >= MAX_ENLACES_POR_HORA) return false;
      if (recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) return false;

      await this.usuarioRepo.invalidarTokensRecuperacion(usuario.id, ahora, tx);
      await this.usuarioRepo.crearTokenRecuperacion(
        { id: randomUUID(), usuarioId: usuario.id, hash: hashDeToken(token), creadoEn: ahora, expiraEn: new Date(ahora.getTime() + VIGENCIA_ENLACE_MS), usadoEn: null },
        tx,
      );
      return true;
    });
    if (!creado) return;

    const enlace = `${config.APP_URL}/restablecer-contrasena?token=${token}`;
    await this.mailer.enviar(correoRecuperacion(usuario.nombre, usuario.email, enlace)).catch((error) =>
      console.error(`[correo] no se pudo enviar la recuperación a ${usuario.email}:`, error),
    );
  }

  // Cambia la contraseña, marca el enlace como usado, invalida los demás y corta
  // las sesiones abiertas (sesionesValidasDesde, ver authMiddleware).
  async restablecerContrasena(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenRecuperacionPorHash(hashDeToken(token), tx);
      if (!registro || registro.usadoEn || registro.expiraEn.getTime() <= ahora.getTime()) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenRecuperacionUsado(registro.id, ahora, tx))) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_INVALIDO);

      await this.usuarioRepo.update(usuario.id, { ...usuario, passwordHash, sesionesValidasDesde: ahora }, tx);
      await this.usuarioRepo.invalidarTokensRecuperacion(usuario.id, ahora, tx);
    });
  }
}
