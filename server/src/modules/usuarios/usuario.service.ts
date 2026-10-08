import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Mailer, Rol, UnitOfWork } from "../../core/ports";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { correoRecuperacion } from "./correoRecuperacion";
import type { SesionRepository } from "./sesion.repository";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";
import type {
  CambiarContrasenaInput,
  CambiarEstadoUsuarioInput,
  CredencialesInput,
  CrearAdministradorInput,
  CrearSecretarioInput,
} from "./usuario.schema";

const RONDAS_BCRYPT = 10;
const DIAS_DE_HISTORIAL_DE_SESIONES = 90;
// Hash de una contraseña que nadie conoce: para gastar el mismo tiempo cuando la cuenta no existe.
const HASH_DE_RELLENO = bcrypt.hashSync(randomUUID(), RONDAS_BCRYPT);
const VIGENCIA_ENLACE_MS = 60 * 60 * 1000;
const MAX_ENLACES_POR_HORA = 3;
const ESPERA_ENTRE_ENLACES_MS = 60 * 1000;
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo.";

const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type UsuarioSinPassword = Omit<Usuario, "passwordHash">;

// Datos del pedido de login que se guardan en la sesión (los arma el controller a partir de la request).
export interface ContextoDeAcceso {
  dispositivo: string;
  ip: string | null;
}

// Lo que ve la persona de cada una de sus sesiones activas.
export interface SesionActivaVista {
  id: string;
  dispositivo: string;
  ip: string | null;
  creadaEn: Date;
  ultimoUsoEn: Date;
  actual: boolean;
}

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
    private readonly sesionRepo: SesionRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly mailer: Mailer,
  ) {}

  async autenticar(
    { email, password, rolElegido, recordarme }: CredencialesInput,
    contexto: ContextoDeAcceso,
  ): Promise<ResultadoAutenticacion> {
    const usuario = await this.usuarioRepo.findByEmail(email);

    // Mismo mensaje genérico para usuario inexistente, inactivo o contraseña incorrecta, y también el
    // mismo tiempo: sin cuenta se compara igual contra un hash de relleno (bcrypt tarda ~100 ms y un
    // rechazo inmediato delataría qué emails existen).
    const passwordValida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_DE_RELLENO);
    if (!usuario || usuario.estado !== "activo" || !passwordValida) {
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

    const sesionId = randomUUID();
    const token = jwt.sign({ sub: usuario.id, rol: rolActivo, sid: sesionId }, config.JWT_SECRET, {
      expiresIn: (recordarme ? config.JWT_EXPIRES_IN_RECORDAR : config.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
    });
    // La sesión vence cuando vence el token.
    const { exp } = jwt.decode(token) as { exp: number };
    const ahora = new Date();
    // La sesión se crea con el bloqueo de la cuenta y releyéndola: si mientras corría la verificación de la contraseña
    // (~100 ms) otro pedido cambió la contraseña o desactivó la cuenta, ese cambio ya cerró las sesiones y esta
    // no puede nacer después, abierta (los cambios toman el mismo bloqueo, ver bloquearCuenta).
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuario.id, tx);
      const actual = await this.usuarioRepo.findById(usuario.id, tx);
      if (!actual || actual.estado !== "activo" || actual.passwordHash !== usuario.passwordHash) {
        throw new AuthenticationError("Email o contraseña incorrectos");
      }
      await this.sesionRepo.create(
        {
          id: sesionId,
          usuarioId: usuario.id,
          dispositivo: contexto.dispositivo,
          ip: contexto.ip,
          creadaEn: ahora,
          ultimoUsoEn: ahora,
          expiraEn: new Date(exp * 1000),
          cerradaEn: null,
        },
        tx,
      );
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

    const actualizado = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(id, tx);
      // Solo cambia el estado (no se reescribe la fila).
      const resultado = await this.usuarioRepo.actualizarParcial(id, { estado }, tx);
      // Al desactivar se cierran todas las sesiones de la cuenta: reactivarla más tarde no las revive.
      if (estado === "inactivo") await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      return resultado;
    });

    const { passwordHash: _passwordHash, ...usuarioSinPassword } = actualizado;
    return usuarioSinPassword;
  }

  // Con la sesión abierta: exige la contraseña actual (400 si no coincide, no 401: la sesión sigue válida), la nueva
  // tiene que ser distinta, y se cierran las demás sesiones; la actual sigue abierta.
  async cambiarContrasena(usuarioId: string, sesionActualId: string, datos: CambiarContrasenaInput): Promise<void> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
    if (!(await bcrypt.compare(datos.passwordActual, usuario.passwordHash))) {
      throw new ValidationError("La contraseña actual no es correcta");
    }
    if (datos.passwordActual === datos.passwordNueva) {
      throw new ValidationError("La contraseña nueva debe ser distinta de la actual");
    }
    const passwordHash = await bcrypt.hash(datos.passwordNueva, RONDAS_BCRYPT);
    const ahora = new Date();
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      await this.usuarioRepo.actualizarParcial(usuarioId, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuarioId, ahora, sesionActualId, tx);
      // Un enlace de recuperación pedido antes ya no debe poder cambiar la contraseña.
      await this.usuarioRepo.invalidarTokensRecuperacion(usuarioId, ahora, tx);
    });
  }

  // Borra las sesiones terminadas (cerradas o vencidas) hace más de 90 días, de cualquier cuenta. Las activas no se tocan.
  async depurarSesionesTerminadas(ahora: Date = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - DIAS_DE_HISTORIAL_DE_SESIONES * 24 * 60 * 60 * 1000);
    return this.sesionRepo.depurarTerminadasAntesDe(limite);
  }

  // Cierra la sesión con la que se hizo el pedido (el token deja de valer en el servidor).
  async cerrarSesion(sesionId: string, usuarioId: string): Promise<void> {
    await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
  }

  // Abrir la lista cuenta como usar la sesión actual (queda con la hora de ahora).
  async listarSesiones(usuarioId: string, sesionActualId: string): Promise<SesionActivaVista[]> {
    const ahora = new Date();
    await this.sesionRepo.tocar(sesionActualId, ahora);
    const sesiones = await this.sesionRepo.findActivasByUsuario(usuarioId, ahora);
    return sesiones.map((s) => ({
      id: s.id,
      dispositivo: s.dispositivo,
      ip: s.ip,
      creadaEn: s.creadaEn,
      ultimoUsoEn: s.ultimoUsoEn,
      actual: s.id === sesionActualId,
    }));
  }

  // 404 si no existe, es de otra cuenta o ya estaba cerrada (no se distingue, para no revelar sesiones ajenas).
  async cerrarSesionAjena(usuarioId: string, sesionActualId: string, sesionId: string): Promise<void> {
    if (sesionId === sesionActualId) {
      throw new ValidationError("Esta es tu sesión actual: usá Cerrar sesión");
    }
    const cerrada = await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
    if (!cerrada) throw new EntityNotFoundError("Sesion", sesionId);
  }

  async cerrarOtrasSesiones(usuarioId: string, sesionActualId: string): Promise<number> {
    return this.sesionRepo.cerrarTodas(usuarioId, new Date(), sesionActualId);
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
  // todas las sesiones de la cuenta.
  async restablecerContrasena(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, RONDAS_BCRYPT);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenRecuperacionPorHash(hashDeToken(token), tx);
      if (!registro || registro.usadoEn || registro.expiraEn.getTime() <= ahora.getTime()) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenRecuperacionUsado(registro.id, ahora, tx))) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_INVALIDO);

      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuario.id, ahora, undefined, tx);
      await this.usuarioRepo.invalidarTokensRecuperacion(usuario.id, ahora, tx);
    });
  }
}
