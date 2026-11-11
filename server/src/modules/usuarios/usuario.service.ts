import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { MAX_SESIONES_ACTIVAS } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosUsuarios } from "./usuario.eventos";
import type { CambiarEstadoUsuarioInput, CredencialesInput, CrearAdministradorInput, CrearSecretarioInput } from "./usuario.schema";

const RONDAS_BCRYPT = 10;
const DIAS_DE_HISTORIAL_DE_SESIONES = 90;
// Hash de una contraseña que nadie conoce: para gastar el mismo tiempo cuando la cuenta no existe.
const HASH_DE_RELLENO = bcrypt.hashSync(randomUUID(), RONDAS_BCRYPT);

export type UsuarioSinPassword = Omit<Usuario, "passwordHash">;

// Lo que la persona ve de su propia cuenta (Mi cuenta).
export interface DatosPropios {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
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
    private readonly anuncios: Publicador<EventosUsuarios & EventosCambios> = sinAnuncios(),
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
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "cerrada-desde-otro-dispositivo" }, tx);
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
      // La lista de sesiones de Mi cuenta (en cualquier dispositivo de esa cuenta) suma la nueva.
      await this.anuncios.publicar("datos.cambiaron", { dato: "sesiones", accion: "inicio", ids: { usuarioIds: [usuario.id] } }, tx);
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
    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await bcrypt.hash(datos.password, RONDAS_BCRYPT),
      roles: [rol],
      estado: "activo",
      fechaCreacion: new Date(),
    };
    await this.unitOfWork.runInTransaction(async (tx) => {
      // El mismo bloqueo por email que usa `crearCuenta`: dos pedidos con el mismo email se hacen de a uno.
      await this.usuarioRepo.bloquearCuenta(`email:${usuario.email}`, tx);
      if (await this.usuarioRepo.findByEmail(usuario.email, tx)) throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
      await this.usuarioRepo.create(usuario, tx);
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "alta", ids: { usuarioIds: [usuario.id] } }, tx);
    });
    const { passwordHash: _passwordHash, ...sinPassword } = usuario;
    return sinPassword;
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
      const actual = await this.usuarioRepo.findById(id, tx);
      if (!actual) throw new EntityNotFoundError("Usuario", id);
      // Solo cambia el estado (no se reescribe la fila).
      const resultado = await this.usuarioRepo.actualizarParcial(id, { estado }, tx);
      // Al desactivar se cierran todas las sesiones de la cuenta: reactivarla más tarde no las revive.
      if (estado === "inactivo") {
        await this.sesionRepo.cerrarTodas(id, new Date(), undefined, tx);
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId: id, motivo: "cuenta-desactivada" }, tx);
      }
      const profesor = await this.profesorRepo.findByUsuarioId(id, tx);
      if (profesor) {
        await this.profesorRepo.update(profesor.id, { ...profesor, estado }, tx);
      }
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: id }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "estado", ids: { usuarioIds: [id] } }, tx);
      return resultado;
    });

    const { passwordHash: _passwordHash, ...usuarioSinPassword } = actualizado;
    return usuarioSinPassword;
  }

  // Borra las sesiones terminadas (cerradas o vencidas) hace más de 90 días, de cualquier cuenta. Las activas no se tocan.
  async depurarSesionesTerminadas(ahora: Date = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - DIAS_DE_HISTORIAL_DE_SESIONES * 24 * 60 * 60 * 1000);
    return this.sesionRepo.depurarTerminadasAntesDe(limite);
  }

  // Cierra la sesión con la que se hizo el pedido (el token deja de valer en el servidor).
  async cerrarSesion(sesionId: string, usuarioId: string): Promise<void> {
    await this.sesionRepo.cerrar(sesionId, usuarioId, new Date());
    await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-por-el-usuario" });
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
    await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-desde-otro-dispositivo" });
  }

  async cerrarOtrasSesiones(usuarioId: string, sesionActualId: string): Promise<number> {
    const cerradas = await this.sesionRepo.cerrarTodas(usuarioId, new Date(), sesionActualId);
    if (cerradas > 0) await this.anuncios.publicar("sesiones.cerradas", { usuarioId, motivo: "cerrada-desde-otro-dispositivo" });
    return cerradas;
  }

  async yo(usuarioId: string, rol: Rol): Promise<DatosPropios> {
    const usuario = await this.usuarioRepo.findById(usuarioId);
    if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
    return { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol };
  }
}
