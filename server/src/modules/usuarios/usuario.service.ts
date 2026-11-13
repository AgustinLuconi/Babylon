import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../core/config";
import { soloPresentes } from "../../core/cambios";
import { AuthenticationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { PadreRepository } from "../padres/padre.repository";
import type { PadreService } from "../padres/padre.service";
import type { Padre } from "../padres/padre.entity";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { ProfesorService } from "../profesores/profesor.service";
import type { Profesor } from "../profesores/profesor.entity";
import { MAX_SESIONES_ACTIVAS } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";
import { BLOQUEO_DE_ADMINISTRADORES, cambioDeRoles, contarOtrosAdminsActivos, validarCambioDeRoles } from "./usuario.roles";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosUsuarios } from "./usuario.eventos";
import type {
  ActualizarCuentaInput,
  CambiarEstadoUsuarioInput,
  CrearCuentaInput,
  CredencialesInput,
  FichaDePadreInput,
  FichaDeProfesorInput,
} from "./usuario.schema";

const RONDAS_BCRYPT = 10;
const DIAS_DE_HISTORIAL_DE_SESIONES = 90;
// Hash de una contraseña que nadie conoce: para gastar el mismo tiempo cuando la cuenta no existe.
const HASH_DE_RELLENO = bcrypt.hashSync(randomUUID(), RONDAS_BCRYPT);

export type UsuarioSinPassword = Omit<Usuario, "passwordHash">;

// Una fila de la lista "Sin cuenta": un responsable o un profesor activo que todavía no tiene cuenta de acceso.
export interface FilaSinCuenta {
  clave: string; // "padre:<id>" o "profesor:<id>"
  tipo: "padre" | "profesor";
  fichaId: string;
  nombre: string;
  email: string | null;
}

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
    private readonly padreRepo: PadreRepository,
    private readonly padreService: PadreService,
    private readonly profesorService: ProfesorService,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosUsuarios & EventosCambios> = sinAnuncios(),
  ) {}

  async autenticar(
    { email, password, rolElegido }: CredencialesInput,
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
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
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

  // Los responsables y los profesores activos que todavía no tienen cuenta (el administrador les crea una desde acá).
  async listarSinCuenta(): Promise<FilaSinCuenta[]> {
    const [padres, profesores] = await Promise.all([this.padreRepo.findAll(), this.profesorRepo.findAll()]);
    const fila = (tipo: "padre" | "profesor", f: Padre | Profesor): FilaSinCuenta => ({
      clave: `${tipo}:${f.id}`,
      tipo,
      fichaId: f.id,
      nombre: `${f.nombre} ${f.apellido ?? ""}`.trim(),
      email: f.email?.trim() ? f.email.trim() : null,
    });
    return [
      ...padres.filter((p) => !p.usuarioId).map((p) => fila("padre", p)),
      ...profesores.filter((p) => !p.usuarioId && p.estado === "activo").map((p) => fila("profesor", p)),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  // Para avisarle al administrador, antes de guardar, que ese email ya tiene cuenta (se le va a agregar el rol).
  async buscarPorEmail(email: string): Promise<{ id: string; nombre: string; roles: Rol[]; estado: Usuario["estado"] } | null> {
    const usuario = await this.usuarioRepo.findByEmail(email);
    return usuario ? { id: usuario.id, nombre: usuario.nombre, roles: usuario.roles, estado: usuario.estado } : null;
  }

  // Crea una cuenta con uno o varios roles. Si el email ya es de una cuenta, no falla: le agrega los roles pedidos y le
  // vincula las fichas (sin tocar su contraseña ni su nombre). El email de cada ficha pasa a ser el de la cuenta. Todo en una
  // transacción: o queda la cuenta con sus fichas o no queda nada.
  async crearCuenta(datos: CrearCuentaInput, actor: { usuarioId: string; sesionId: string }): Promise<{ usuario: UsuarioSinPassword; vinculada: boolean }> {
    // El hash se calcula antes de abrir la transacción (bcrypt tarda ~100 ms y no hace falta tener la cuenta bloqueada).
    const passwordHash = datos.password ? await bcrypt.hash(datos.password, RONDAS_BCRYPT) : null;
    return this.unitOfWork.runInTransaction(async (tx) => {
      // Dos pedidos con el mismo email se hacen de a uno: el segundo ve la cuenta que creó el primero.
      await this.usuarioRepo.bloquearCuenta(`email:${datos.email}`, tx);
      let existente = await this.usuarioRepo.findByEmail(datos.email, tx);
      if (existente) {
        // Con la cuenta bloqueada (como al editarla) y releída: si otro administrador le cambió los roles hace un instante, se parte
        // de lo último guardado y no se pisa.
        await this.usuarioRepo.bloquearCuenta(existente.id, tx);
        existente = await this.usuarioRepo.findById(existente.id, tx);
        if (!existente) throw new EntityNotFoundError("Usuario", datos.email);
        const rolesActuales = existente.roles;
        const repetidos = datos.roles.filter((r) => rolesActuales.includes(r));
        if (repetidos.length > 0) throw new ConflictError(`Esa cuenta ya tiene el rol ${repetidos.join(", ")}`);
        if (datos.padre && (await this.padreRepo.findByUsuarioId(existente.id, tx))) throw new ConflictError("Esa cuenta ya tiene un responsable vinculado");
        if (datos.profesor && (await this.profesorRepo.findByUsuarioId(existente.id, tx))) throw new ConflictError("Esa cuenta ya tiene un profesor vinculado");
      } else if (!passwordHash) {
        const mensaje = "La contraseña es requerida para crear la cuenta";
        throw new ValidationError(mensaje, { password: [mensaje] });
      }

      const padre = datos.padre ? await this.fichaDePadre(datos.padre, datos.email, tx) : null;
      const profesor = datos.profesor ? await this.fichaDeProfesor(datos.profesor, datos.email, tx) : null;

      let usuario: Usuario;
      if (existente) {
        usuario = await this.usuarioRepo.actualizarParcial(existente.id, { roles: [...existente.roles, ...datos.roles] }, tx);
      } else {
        // El nombre de una cuenta con ficha es el de la ficha (se cambia desde ella).
        const nombre = padre ? `${padre.nombre} ${padre.apellido}` : profesor ? `${profesor.nombre} ${profesor.apellido ?? ""}`.trim() : (datos.nombre as string);
        usuario = await this.usuarioRepo.create(
          { id: randomUUID(), nombre, email: datos.email, passwordHash: passwordHash as string, roles: datos.roles, estado: "activo", fechaCreacion: new Date() },
          tx,
        );
      }

      if (padre) {
        await this.padreRepo.vincularUsuario(padre.id, usuario.id, tx);
        await this.padreRepo.actualizarParcial(padre.id, { email: datos.email }, tx);
        await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: [padre.id] } }, tx);
      }
      if (profesor) {
        await this.profesorRepo.vincularUsuario(profesor.id, usuario.id, tx);
        await this.profesorRepo.actualizarParcial(profesor.id, { email: datos.email }, tx);
        await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "edicion", ids: { profesorIds: [profesor.id] } }, tx);
      }
      // Agregar roles a una cuenta que ya existe cierra sus sesiones (igual que al editar sus roles); la del propio administrador
      // que lo hace se conserva.
      if (existente) {
        await this.sesionRepo.cerrarTodas(usuario.id, new Date(), usuario.id === actor.usuarioId ? actor.sesionId : undefined, tx);
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "roles-cambiados" }, tx);
      }
      await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: existente ? "edicion" : "alta", ids: { usuarioIds: [usuario.id] } }, tx);

      const { passwordHash: _passwordHash, ...sinPassword } = usuario;
      return { usuario: sinPassword, vinculada: existente !== null };
    });
  }

  // Edita una cuenta: solo se escribe lo que vino. Cambiar la contraseña o los roles cierra las sesiones de esa cuenta (menos la
  // desde la que se hace el cambio, si el administrador se edita a sí mismo). Agregar `padre`/`profesor` vincula una ficha;
  // quitarlo la desvincula (la ficha y sus alumnos o cursos no se tocan). El email de las fichas es siempre el de la cuenta.
  async actualizarCuenta(id: string, datos: ActualizarCuentaInput, actor: { usuarioId: string; sesionId: string }): Promise<UsuarioSinPassword> {
    const passwordHash = datos.password ? await bcrypt.hash(datos.password, RONDAS_BCRYPT) : undefined;
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(id, tx);
      const actual = await this.usuarioRepo.findById(id, tx);
      if (!actual) throw new EntityNotFoundError("Usuario", id);
      const padreActual = await this.padreRepo.findByUsuarioId(id, tx);
      const profesorActual = await this.profesorRepo.findByUsuarioId(id, tx);

      const emailCambia = datos.email !== undefined && datos.email !== actual.email;
      if (emailCambia) {
        await this.usuarioRepo.bloquearCuenta(`email:${datos.email}`, tx);
        const otro = await this.usuarioRepo.findByEmail(datos.email as string, tx);
        if (otro && otro.id !== id) throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
      }
      if (datos.nombre !== undefined && datos.nombre !== actual.nombre && (padreActual || profesorActual)) {
        const mensaje = "El nombre de una cuenta de responsable o profesor se cambia desde su ficha";
        throw new ValidationError(mensaje, { nombre: [mensaje] });
      }

      const finales = datos.roles ?? actual.roles;
      const { agregados, quitados } = cambioDeRoles(actual.roles, finales);
      const rolesCambian = agregados.length + quitados.length > 0;
      if (datos.roles) {
        // Quitar el rol de administrador: bloqueo global para que dos administradores que se lo quitan entre sí a la vez no dejen al
        // sistema sin ninguno (el segundo cuenta ya sin el primero).
        if (quitados.includes("admin")) await this.usuarioRepo.bloquearCuenta(BLOQUEO_DE_ADMINISTRADORES, tx);
        const otrosAdminsActivos = contarOtrosAdminsActivos(await this.usuarioRepo.findAll(tx), id);
        validarCambioDeRoles({ cuentaId: id, actorId: actor.usuarioId, actuales: actual.roles, finales, otrosAdminsActivos });
      }
      const exigeFicha = (rol: "padre" | "profesor", ref: unknown) => {
        if (agregados.includes(rol) && !ref) throw new ValidationError("Elegí la ficha", { [rol]: ["Elegí la ficha"] });
        if (!agregados.includes(rol) && ref) throw new ValidationError("La ficha solo se elige al agregar el rol", { [rol]: ["La ficha solo se elige al agregar el rol"] });
      };
      exigeFicha("padre", datos.padre);
      exigeFicha("profesor", datos.profesor);

      const emailFinal = datos.email ?? actual.email;
      let padre = padreActual;
      let profesor = profesorActual;
      const fichasTocadas: { padre: boolean; profesor: boolean } = { padre: false, profesor: false };
      if (quitados.includes("padre") && padre) {
        await this.padreRepo.desvincularUsuario(padre.id, tx);
        padre = null;
        fichasTocadas.padre = true;
      }
      if (quitados.includes("profesor") && profesor) {
        await this.profesorRepo.desvincularUsuario(profesor.id, tx);
        profesor = null;
        fichasTocadas.profesor = true;
      }
      if (datos.padre) {
        if (padre) throw new ConflictError("Esa cuenta ya tiene un responsable vinculado");
        padre = await this.fichaDePadre(datos.padre, emailFinal, tx);
        await this.padreRepo.vincularUsuario(padre.id, id, tx);
        fichasTocadas.padre = true;
      }
      if (datos.profesor) {
        if (profesor) throw new ConflictError("Esa cuenta ya tiene un profesor vinculado");
        profesor = await this.fichaDeProfesor(datos.profesor, emailFinal, tx);
        await this.profesorRepo.vincularUsuario(profesor.id, id, tx);
        fichasTocadas.profesor = true;
      }
      // El email de cada ficha vinculada es el de la cuenta.
      if (padre && (emailCambia || datos.padre)) await this.padreRepo.actualizarParcial(padre.id, { email: emailFinal }, tx);
      if (profesor && (emailCambia || datos.profesor)) await this.profesorRepo.actualizarParcial(profesor.id, { email: emailFinal }, tx);

      const cambios = soloPresentes({
        nombre: datos.nombre !== undefined && datos.nombre !== actual.nombre ? datos.nombre : undefined,
        email: emailCambia ? datos.email : undefined,
        passwordHash,
        roles: rolesCambian ? finales : undefined,
      });
      const guardado = Object.keys(cambios).length > 0 ? await this.usuarioRepo.actualizarParcial(id, cambios, tx) : actual;

      if (passwordHash || rolesCambian) {
        await this.sesionRepo.cerrarTodas(id, new Date(), id === actor.usuarioId ? actor.sesionId : undefined, tx);
        await this.anuncios.publicar("sesiones.cerradas", { usuarioId: id, motivo: rolesCambian ? "roles-cambiados" : "contrasena-cambiada" }, tx);
      }
      if (rolesCambian) await this.anuncios.publicar("cuenta.cambio", { usuarioId: id, rolesQuitados: quitados }, tx);
      if (padre && (fichasTocadas.padre || emailCambia)) await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: [padre.id] } }, tx);
      if (profesor && (fichasTocadas.profesor || emailCambia)) await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "edicion", ids: { profesorIds: [profesor.id] } }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "edicion", ids: { usuarioIds: [id] } }, tx);

      const { passwordHash: _passwordHash, ...sinPassword } = guardado;
      return sinPassword;
    });
  }

  // La ficha de responsable que va a tener la cuenta: una sin cuenta (bloqueada mientras dura la transacción) o una nueva.
  private async fichaDePadre(ref: FichaDePadreInput, email: string, tx: unknown): Promise<Padre> {
    if ("nueva" in ref) return (await this.padreService.crearFichaEnTransaccion({ ...ref.nueva, email }, tx)).padre;
    await this.usuarioRepo.bloquearCuenta(`ficha:padre:${ref.fichaId}`, tx);
    const padre = await this.padreRepo.findById(ref.fichaId, tx);
    if (!padre) throw new EntityNotFoundError("Padre", ref.fichaId);
    if (padre.usuarioId) throw new ConflictError("Esa ficha ya tiene una cuenta");
    return padre;
  }

  private async fichaDeProfesor(ref: FichaDeProfesorInput, email: string, tx: unknown): Promise<Profesor> {
    if ("nueva" in ref) return (await this.profesorService.crearFichaEnTransaccion({ ...ref.nueva, email }, tx)).profesor;
    await this.usuarioRepo.bloquearCuenta(`ficha:profesor:${ref.fichaId}`, tx);
    const profesor = await this.profesorRepo.findById(ref.fichaId, tx);
    if (!profesor) throw new EntityNotFoundError("Profesor", ref.fichaId);
    if (profesor.usuarioId) throw new ConflictError("Esa ficha ya tiene una cuenta");
    if (profesor.estado !== "activo") throw new ValidationError("El profesor está inactivo: reactivalo antes de crearle una cuenta");
    return profesor;
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
      // Desactivar a un administrador: bloqueo global y el sistema no puede quedarse sin ningún administrador activo (dos que se
      // desactivan entre sí a la vez: el segundo ya no cuenta al primero).
      if (estado === "inactivo" && actual.roles.includes("admin")) {
        await this.usuarioRepo.bloquearCuenta(BLOQUEO_DE_ADMINISTRADORES, tx);
        if (contarOtrosAdminsActivos(await this.usuarioRepo.findAll(tx), id) === 0) {
          throw new ValidationError("No se puede desactivar: el sistema se quedaría sin ningún administrador activo");
        }
      }
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
