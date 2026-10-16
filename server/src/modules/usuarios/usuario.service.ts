import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import {
  AuthenticationError,
  ConflictError,
  DemasiadosPedidosError,
  EntityNotFoundError,
  ServicioNoDisponibleError,
  ValidationError,
} from "../../core/errors";
import type { Mailer, Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { correoRecuperacion } from "./correoRecuperacion";
import { correoVerificacion } from "./correoVerificacion";
import { enlaceVigente, hashDeToken, nuevoEnlace } from "./enlaces";
import { ENLACE_NO_VALIDO, type EstadoInvitacion, type InvitacionService } from "./invitacion.service";
import { PasswordActualIncorrectaError } from "./usuario.errors";
import { MAX_SESIONES_ACTIVAS } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";
import type { EventosUsuarios } from "./usuario.eventos";
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
const UNA_HORA_MS = 60 * 60 * 1000;
const MAX_ENLACES_POR_HORA = 3;
const ESPERA_ENTRE_ENLACES_MS = 60 * 1000;
const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo.";

export type UsuarioSinPassword = Omit<Usuario, "passwordHash">;
export type UsuarioCreado = UsuarioSinPassword & { invitacion: EstadoInvitacion | null };

// Lo que la persona ve de su propia cuenta (Mi cuenta).
export interface DatosPropios {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  emailVerificado: boolean;
}

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
    private readonly invitaciones: InvitacionService,
    private readonly anuncios: Publicador<EventosUsuarios> = sinAnuncios(),
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
      // En el tope de sesiones abiertas, la nueva desplaza a la menos usada.
      const activas = await this.sesionRepo.findActivasByUsuario(usuario.id, ahora, tx);
      const sobrantes = activas.length - MAX_SESIONES_ACTIVAS + 1;
      if (sobrantes > 0) {
        const menosUsadas = [...activas].sort((a, b) => a.ultimoUsoEn.getTime() - b.ultimoUsoEn.getTime()).slice(0, sobrantes);
        for (const s of menosUsadas) await this.sesionRepo.cerrar(s.id, usuario.id, ahora, tx);
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
  async crearSecretario(datos: CrearSecretarioInput): Promise<UsuarioCreado> {
    return this.crearUsuarioSimple(datos, "secretario");
  }

  // Mismo criterio que Secretario: sin entidad propia, es solo un Usuario.
  async crearAdministrador(datos: CrearAdministradorInput): Promise<UsuarioCreado> {
    return this.crearUsuarioSimple(datos, "admin");
  }

  private async crearUsuarioSimple(datos: CrearSecretarioInput, rol: Rol): Promise<UsuarioCreado> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const ahora = new Date();

    if (!datos.password) {
      // Sin contraseña: cuenta pendiente e invitación por email (enviada después de confirmar la transacción).
      const cuenta = await this.unitOfWork.runInTransaction((tx) =>
        this.invitaciones.prepararCuentaPendiente({ nombre: datos.nombre, email: datos.email, roles: [rol] }, ahora, tx),
      );
      const enviada = await this.invitaciones.enviarInvitacion(cuenta);
      const { passwordHash: _passwordHash, ...sinPassword } = cuenta.usuario;
      return { ...sinPassword, invitacion: enviada ? "enviada" : "no-enviada" };
    }

    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
      roles: [rol],
      estado: "activo",
      fechaCreacion: ahora,
      emailVerificadoEn: null,
    };
    // Con contraseña la cuenta nace activa: ya le corresponden avisos.
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.create(usuario, tx);
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
    });

    const { passwordHash: _passwordHash, ...sinPassword } = usuario;
    return { ...sinPassword, invitacion: null };
  }

  async listarUsuarios(): Promise<UsuarioSinPassword[]> {
    const usuarios = await this.usuarioRepo.findAll();
    return usuarios
      // Las pendientes (invitación sin aceptar) se ven en la pestaña Pendientes, no acá.
      .filter((u) => u.estado !== "pendiente")
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
      const actual = await this.usuarioRepo.findById(id, tx);
      if (!actual) throw new EntityNotFoundError("Usuario", id);
      // Una invitación sin aceptar se gestiona desde Pendientes (reenviar o cancelar), no con el interruptor de estado.
      if (actual.estado === "pendiente") throw new ValidationError("La cuenta todavía no fue activada");
      // Solo cambia el estado (no se reescribe la fila).
      const resultado = await this.usuarioRepo.actualizarParcial(id, { estado }, tx);
      // Al desactivar se cierran todas las sesiones de la cuenta: reactivarla más tarde no las revive.
      if (estado === "inactivo") await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: id }, tx);
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
      throw new PasswordActualIncorrectaError("La contraseña actual no es correcta");
    }
    if (datos.passwordActual === datos.passwordNueva) {
      throw new ValidationError("La contraseña nueva debe ser distinta de la actual");
    }
    const passwordHash = await bcrypt.hash(datos.passwordNueva, RONDAS_BCRYPT);
    const ahora = new Date();
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      // Con el bloqueo tomado se vuelve a comprobar que la sesión desde la que se pide siga abierta: si la cerraron
      // desde otro dispositivo justo ahora, el cambio no se aplica (y no cerraría la sesión de su verdadero dueño).
      const abiertas = await this.sesionRepo.findActivasByUsuario(usuarioId, ahora, tx);
      if (!abiertas.some((s) => s.id === sesionActualId)) {
        throw new AuthenticationError("Tu sesión ya no es válida, ingresá de nuevo");
      }
      await this.usuarioRepo.actualizarParcial(usuarioId, { passwordHash }, tx);
      await this.sesionRepo.cerrarTodas(usuarioId, ahora, sesionActualId, tx);
      // Un enlace de recuperación pedido antes ya no debe poder cambiar la contraseña.
      await this.usuarioRepo.invalidarTokens(usuarioId, "recuperacion", ahora, tx);
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

  async yo(usuarioId: string, rol: Rol): Promise<DatosPropios> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
    return { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol, emailVerificado: usuario.emailVerificadoEn !== null };
  }

  // Manda el enlace de verificación (24 h). Límites por cuenta: 1 minuto entre envíos y 3 por hora.
  async enviarVerificacion(usuarioId: string, ahora: Date = new Date()): Promise<void> {
    const { usuario, token, tokenId } = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
      if (usuario.emailVerificadoEn) throw new ValidationError("Tu email ya está verificado");
      const recientes = await this.usuarioRepo.findTokensDesde(usuarioId, "verificacion_email", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      if (recientes.length >= MAX_ENLACES_POR_HORA || recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) {
        throw new DemasiadosPedidosError("Ya te enviamos un enlace hace poco, probá de nuevo en unos minutos");
      }
      await this.usuarioRepo.invalidarTokens(usuarioId, "verificacion_email", ahora, tx);
      const enlace = nuevoEnlace(usuarioId, "verificacion_email", ahora);
      await this.usuarioRepo.crearToken(enlace.registro, tx);
      return { usuario, token: enlace.token, tokenId: enlace.registro.id };
    });
    try {
      await this.mailer.enviar(correoVerificacion(usuario.nombre, usuario.email, `${config.APP_URL}/verificar-email?token=${token}`));
    } catch (error) {
      console.error(`[correo] no se pudo enviar la verificación a ${usuario.email}:`, error);
      // El enlace nunca llegó: se borra para que reintentar no choque con el límite de envíos.
      await this.usuarioRepo.eliminarToken(tokenId).catch((e) => console.error("[correo] no se pudo borrar el enlace sin enviar:", e));
      throw new ServicioNoDisponibleError("No pudimos enviar el correo, probá de nuevo en unos minutos");
    }
  }

  async verificarEmail(token: string, ahora: Date = new Date()): Promise<void> {
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      if (!registro || registro.tipo !== "verificacion_email" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) throw new ValidationError(ENLACE_NO_VALIDO);
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_NO_VALIDO);
      if (!usuario.emailVerificadoEn) await this.usuarioRepo.actualizarParcial(usuario.id, { emailVerificadoEn: ahora }, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "verificacion_email", ahora, tx);
    });
  }

  // Siempre termina sin error, exista o no la cuenta: la respuesta no puede
  // revelar qué emails están registrados. Tampoco puede revelarlo el tiempo: tras
  // buscar la cuenta (una consulta, igual para ambos casos) se responde, y todo lo
  // demás (límites, alta del token, correo) corre en segundo plano. Si la cuenta
  // superó su límite de pedidos, tampoco se envía nada.
  async solicitarRecuperacion(email: string, ahora: Date = new Date()): Promise<void> {
    const usuario = await this.usuarioRepo.findByEmail(email);
    if (!usuario) return;
    // Invitación todavía sin aceptar: en vez de un enlace de recuperación se manda una invitación nueva.
    if (usuario.estado === "pendiente") {
      void this.invitaciones.reenviarPorOlvido(usuario.id, ahora).catch((error) =>
        console.error(`[correo] no se pudo preparar la invitación de ${usuario.email}:`, error),
      );
      return;
    }
    if (usuario.estado !== "activo") return;

    void this.enviarEnlaceDeRecuperacion(usuario, ahora).catch((error) =>
      console.error(`[correo] no se pudo preparar la recuperación de ${usuario.email}:`, error),
    );
  }

  private async enviarEnlaceDeRecuperacion(usuario: Usuario, ahora: Date): Promise<void> {
    // Las comprobaciones y el alta del enlace van juntas bajo un bloqueo de la cuenta: si no,
    // varios pedidos simultáneos leerían "ningún enlace reciente" a la vez y pasarían todos.
    const token = await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuario.id, tx);
      const recientes = await this.usuarioRepo.findTokensDesde(usuario.id, "recuperacion", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      if (recientes.length >= MAX_ENLACES_POR_HORA) return null;
      if (recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENLACES_MS)) return null;

      await this.usuarioRepo.invalidarTokens(usuario.id, "recuperacion", ahora, tx);
      const enlace = nuevoEnlace(usuario.id, "recuperacion", ahora);
      await this.usuarioRepo.crearToken(enlace.registro, tx);
      return enlace.token;
    });
    if (!token) return;

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
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      // Solo enlaces de recuperación: uno de invitación o de verificación no sirve acá.
      if (!registro || registro.tipo !== "recuperacion" || !enlaceVigente(registro, ahora)) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) {
        throw new ValidationError(ENLACE_INVALIDO);
      }
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "activo") throw new ValidationError(ENLACE_INVALIDO);

      // El enlace llegó a su correo: si el email no estaba verificado, ahora lo está.
      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash, ...(usuario.emailVerificadoEn ? {} : { emailVerificadoEn: ahora }) }, tx);
      await this.sesionRepo.cerrarTodas(usuario.id, ahora, undefined, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "recuperacion", ahora, tx);
    });
  }
}
