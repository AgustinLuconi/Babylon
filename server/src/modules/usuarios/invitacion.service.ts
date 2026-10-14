import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { config } from "../../core/config";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Mailer, Rol, UnitOfWork } from "../../core/ports";
import type { Padre } from "../padres/padre.entity";
import type { PadreRepository } from "../padres/padre.repository";
import type { Profesor } from "../profesores/profesor.entity";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import { correoInvitacion } from "./correoInvitacion";
import { enlaceVigente, hashDeToken, nuevoEnlace } from "./enlaces";
import type { Usuario } from "./usuario.entity";
import type { UsuarioRepository } from "./usuario.repository";

// Una cuenta pendiente no tiene contraseña utilizable: se guarda el hash de un valor al azar que nadie conoce.
const HASH_DE_CUENTA_PENDIENTE = bcrypt.hashSync(randomBytes(32).toString("hex"), 10);
const MAX_POR_PEDIDO = 100;
const UNA_HORA_MS = 60 * 60 * 1000;
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;
// Invitaciones nuevas pedidas desde "¿Olvidaste tu contraseña?" (los envíos del admin también cuentan).
const MAX_INVITACIONES_POR_HORA_A_PEDIDO = 3;

export const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

const normalizarEmail = (email: string) => email.trim().toLowerCase();
const nombreCompleto = (p: { nombre: string; apellido?: string }) => `${p.nombre} ${p.apellido ?? ""}`.trim();

export type EstadoInvitacion = "enviada" | "no-enviada";
export type MotivoNoEnviada =
  | "no existe"
  | "ya tiene cuenta"
  | "sin email"
  | "email repetido"
  | "profesor inactivo"
  | "ya activada"
  | "esperá un minuto para reenviar"
  | "no se pudo enviar el correo";

export interface ResultadoEnvio {
  id: string;
  nombre: string;
  resultado: EstadoInvitacion;
  motivo?: MotivoNoEnviada;
}

export type EtiquetaAcceso = "sin-cuenta" | "pendiente" | "vencida";

// Una fila de la pestaña Pendientes: un padre o profesor sin cuenta, o una cuenta pendiente de cualquier rol.
export interface FilaPendiente {
  clave: string; // "padre:<id>", "profesor:<id>" o "cuenta:<usuarioId>"
  origen: "padre" | "profesor" | "cuenta";
  padreId: string | null;
  profesorId: string | null;
  usuarioId: string | null;
  nombre: string;
  email: string | null;
  roles: Rol[];
  etiqueta: EtiquetaAcceso;
  invitacionEnviadaEn: Date | null;
  invitacionVenceEn: Date | null;
  sinEmail: boolean;
  emailEnUso: boolean;
}

export interface DatosCuentaInvitada {
  nombre: string;
  email: string;
  roles: Rol[];
}

export interface CuentaPreparada {
  usuario: Usuario;
  token: string;
  // Id de la fila del enlace: si el correo no sale, se borra para que no quede un enlace que nadie recibió.
  tokenId: string;
  venceEn: Date;
}

type Preparacion = { cuenta: CuentaPreparada; nombre: string } | { motivo: MotivoNoEnviada; nombre: string };

export class InvitacionService {
  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly padreRepo: PadreRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly mailer: Mailer,
  ) {}

  // Dentro de la transacción de quien da el alta: crea la cuenta pendiente y su enlace. El correo se manda después,
  // con enviarInvitacion, una vez confirmada la transacción.
  async prepararCuentaPendiente(datos: DatosCuentaInvitada, ahora: Date, tx: unknown): Promise<CuentaPreparada> {
    const usuario: Usuario = {
      id: randomUUID(),
      nombre: datos.nombre,
      email: normalizarEmail(datos.email),
      passwordHash: HASH_DE_CUENTA_PENDIENTE,
      roles: datos.roles,
      estado: "pendiente",
      fechaCreacion: ahora,
      emailVerificadoEn: null,
    };
    await this.usuarioRepo.create(usuario, tx);
    const { token, registro } = nuevoEnlace(usuario.id, "invitacion", ahora);
    await this.usuarioRepo.crearToken(registro, tx);
    return { usuario, token, tokenId: registro.id, venceEn: registro.expiraEn };
  }

  // Nunca lanza: devuelve si el correo salió (una falla queda en el log y se informa en el resultado).
  async enviarInvitacion({ usuario, token, tokenId, venceEn }: CuentaPreparada): Promise<boolean> {
    const enlace = `${config.APP_URL}/activar-cuenta?token=${token}`;
    try {
      await this.mailer.enviar(correoInvitacion(usuario.nombre, usuario.email, enlace, venceEn));
      return true;
    } catch (error) {
      console.error(`[correo] no se pudo enviar la invitación a ${usuario.email}:`, error);
      // El enlace nunca llegó a la persona: se borra. Así la cuenta figura como "vencida" (para reenviar) y el minuto de
      // espera entre reenvíos no cuenta un envío que no salió.
      await this.usuarioRepo.eliminarToken(tokenId).catch((e) => console.error("[invitaciones] no se pudo borrar el enlace sin enviar:", e));
      return false;
    }
  }

  async invitar(padreIds: string[], profesorIds: string[], ahora: Date = new Date()): Promise<ResultadoEnvio[]> {
    if (padreIds.length + profesorIds.length > MAX_POR_PEDIDO) {
      throw new ValidationError(`Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);
    }
    const resultados: ResultadoEnvio[] = [];
    // De a una persona: cada una en su propia transacción, y su correo recién después de confirmarla.
    for (const id of padreIds) resultados.push(await this.informar(id, await this.prepararInvitacion("padre", id, ahora)));
    for (const id of profesorIds) resultados.push(await this.informar(id, await this.prepararInvitacion("profesor", id, ahora)));
    return resultados;
  }

  async reenviar(usuarioIds: string[], ahora: Date = new Date()): Promise<ResultadoEnvio[]> {
    if (usuarioIds.length > MAX_POR_PEDIDO) {
      throw new ValidationError(`Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);
    }
    const resultados: ResultadoEnvio[] = [];
    for (const id of usuarioIds) resultados.push(await this.informar(id, await this.renovarInvitacion(id, ahora, false)));
    return resultados;
  }

  // Solo cuentas que nunca se activaron. La base deja en nulo el vínculo del padre o profesor (ON DELETE SET NULL)
  // y borra los enlaces y sesiones de la cuenta (CASCADE).
  async cancelar(usuarioId: string): Promise<void> {
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) throw new EntityNotFoundError("Usuario", usuarioId);
      if (usuario.estado !== "pendiente") throw new ConflictError("La cuenta ya fue activada");
      await this.usuarioRepo.delete(usuarioId, tx);
    });
  }

  async listarPendientes(ahora: Date = new Date()): Promise<FilaPendiente[]> {
    const [usuarios, padres, profesores] = await Promise.all([this.usuarioRepo.findAll(), this.padreRepo.findAll(), this.profesorRepo.findAll()]);
    const emailsEnUso = new Set(usuarios.map((u) => normalizarEmail(u.email)));
    const pendientes = usuarios.filter((u) => u.estado === "pendiente");
    const invitaciones = await this.usuarioRepo.findTokensDeUsuarios(pendientes.map((u) => u.id), "invitacion");

    const sinCuenta = (origen: "padre" | "profesor", id: string, nombre: string, email: string | undefined): FilaPendiente => {
      const limpio = email?.trim() ? email.trim() : null;
      return {
        clave: `${origen}:${id}`,
        origen,
        padreId: origen === "padre" ? id : null,
        profesorId: origen === "profesor" ? id : null,
        usuarioId: null,
        nombre,
        email: limpio,
        roles: [origen],
        etiqueta: "sin-cuenta",
        invitacionEnviadaEn: null,
        invitacionVenceEn: null,
        sinEmail: !limpio,
        emailEnUso: !!limpio && emailsEnUso.has(normalizarEmail(limpio)),
      };
    };

    const filas: FilaPendiente[] = [
      ...padres.filter((p) => !p.usuarioId).map((p) => sinCuenta("padre", p.id, nombreCompleto(p), p.email)),
      // Los profesores inactivos no se invitan.
      ...profesores.filter((p) => !p.usuarioId && p.estado === "activo").map((p) => sinCuenta("profesor", p.id, nombreCompleto(p), p.email)),
      ...pendientes.map((u): FilaPendiente => {
        const propias = invitaciones.filter((t) => t.usuarioId === u.id).sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
        const ultima = propias[0] ?? null;
        return {
          clave: `cuenta:${u.id}`,
          origen: "cuenta",
          padreId: padres.find((p) => p.usuarioId === u.id)?.id ?? null,
          profesorId: profesores.find((p) => p.usuarioId === u.id)?.id ?? null,
          usuarioId: u.id,
          nombre: u.nombre,
          email: u.email,
          roles: u.roles,
          etiqueta: propias.some((t) => enlaceVigente(t, ahora)) ? "pendiente" : "vencida",
          invitacionEnviadaEn: ultima?.creadoEn ?? null,
          invitacionVenceEn: ultima?.expiraEn ?? null,
          sinEmail: false,
          emailEnUso: false,
        };
      }),
    ];
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  // Para la pantalla de activación: a quién pertenece el enlace (saludo y email). Mismo mensaje para cualquier problema.
  async consultarInvitacion(token: string, ahora: Date = new Date()): Promise<{ nombre: string; email: string }> {
    const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token));
    if (!registro || registro.tipo !== "invitacion" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
    const usuario = await this.usuarioRepo.findById(registro.usuarioId);
    if (!usuario || usuario.estado !== "pendiente") throw new ValidationError(ENLACE_NO_VALIDO);
    return { nombre: usuario.nombre, email: usuario.email };
  }

  // La persona elige su contraseña: la cuenta queda activa y con el email verificado (el correo le llegó).
  async activarCuenta(token: string, password: string, ahora: Date = new Date()): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const registro = await this.usuarioRepo.findTokenPorHash(hashDeToken(token), tx);
      if (!registro || registro.tipo !== "invitacion" || !enlaceVigente(registro, ahora)) throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.bloquearCuenta(registro.usuarioId, tx);
      // Marcado atómico: si dos pedidos usan el mismo enlace a la vez, solo uno gana.
      if (!(await this.usuarioRepo.marcarTokenUsado(registro.id, ahora, tx))) throw new ValidationError(ENLACE_NO_VALIDO);
      const usuario = await this.usuarioRepo.findById(registro.usuarioId, tx);
      if (!usuario || usuario.estado !== "pendiente") throw new ValidationError(ENLACE_NO_VALIDO);
      await this.usuarioRepo.actualizarParcial(usuario.id, { passwordHash, estado: "activo", emailVerificadoEn: ahora }, tx);
      await this.usuarioRepo.invalidarTokens(usuario.id, "invitacion", ahora, tx);
    });
  }

  // "¿Olvidaste tu contraseña?" con la invitación todavía pendiente: se manda una nueva, con los límites de la
  // recuperación (1 minuto entre envíos y 3 por hora). No informa nada: la respuesta al pedido es siempre la misma.
  async reenviarPorOlvido(usuarioId: string, ahora: Date): Promise<void> {
    const preparacion = await this.renovarInvitacion(usuarioId, ahora, true);
    if ("cuenta" in preparacion) await this.enviarInvitacion(preparacion.cuenta);
  }

  private async informar(id: string, preparacion: Preparacion): Promise<ResultadoEnvio> {
    if ("motivo" in preparacion) return { id, nombre: preparacion.nombre, resultado: "no-enviada", motivo: preparacion.motivo };
    const enviada = await this.enviarInvitacion(preparacion.cuenta);
    return enviada
      ? { id, nombre: preparacion.nombre, resultado: "enviada" }
      : { id, nombre: preparacion.nombre, resultado: "no-enviada", motivo: "no se pudo enviar el correo" };
  }

  private async prepararInvitacion(rol: "padre" | "profesor", id: string, ahora: Date): Promise<Preparacion> {
    let nombre = "";
    try {
      return await this.unitOfWork.runInTransaction(async (tx): Promise<Preparacion> => {
        // Bloqueo por persona: dos pedidos simultáneos para la misma persona no crean dos cuentas.
        await this.usuarioRepo.bloquearCuenta(`${rol}:${id}`, tx);
        const persona: Padre | Profesor | null = rol === "padre" ? await this.padreRepo.findById(id, tx) : await this.profesorRepo.findById(id, tx);
        if (!persona) return { motivo: "no existe", nombre: "" };
        nombre = nombreCompleto(persona);
        if (persona.usuarioId) return { motivo: "ya tiene cuenta", nombre };
        if (rol === "profesor" && (persona as Profesor).estado === "inactivo") return { motivo: "profesor inactivo", nombre };
        if (!persona.email?.trim()) return { motivo: "sin email", nombre };
        const email = normalizarEmail(persona.email);
        // Bloqueo por email: dos personas distintas con el mismo email tampoco pasan las dos.
        await this.usuarioRepo.bloquearCuenta(`email:${email}`, tx);
        if (await this.usuarioRepo.findByEmail(email, tx)) return { motivo: "email repetido", nombre };

        const cuenta = await this.prepararCuentaPendiente({ nombre, email, roles: [rol] }, ahora, tx);
        // Solo se asigna la cuenta: no se reescribe el resto de la ficha, que alguien pudo haber editado mientras tanto.
        if (rol === "padre") await this.padreRepo.vincularUsuario(id, cuenta.usuario.id, tx);
        else await this.profesorRepo.vincularUsuario(id, cuenta.usuario.id, tx);
        return { cuenta, nombre };
      });
    } catch (error) {
      // Un alta con ese mismo email, simultánea a esta invitación, ganó la carrera (restricción única de la base): esta
      // persona queda como "email repetido" y el resto del lote sigue.
      if (error instanceof ConflictError) return { motivo: "email repetido", nombre };
      throw error;
    }
  }

  // Un enlace de invitación nuevo para una cuenta todavía pendiente (anula los anteriores). `limitarPorHora` aplica el
  // tope de 3 por hora de los pedidos desde "¿Olvidaste tu contraseña?"; el minuto de espera vale siempre.
  private renovarInvitacion(usuarioId: string, ahora: Date, limitarPorHora: boolean): Promise<Preparacion> {
    return this.unitOfWork.runInTransaction(async (tx): Promise<Preparacion> => {
      await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
      const usuario = await this.usuarioRepo.findById(usuarioId, tx);
      if (!usuario) return { motivo: "no existe", nombre: "" };
      if (usuario.estado !== "pendiente") return { motivo: "ya activada", nombre: usuario.nombre };
      const recientes = await this.usuarioRepo.findTokensDesde(usuarioId, "invitacion", new Date(ahora.getTime() - UNA_HORA_MS), tx);
      const muyPronto = recientes.some((t) => ahora.getTime() - t.creadoEn.getTime() < ESPERA_ENTRE_ENVIOS_MS);
      if (muyPronto || (limitarPorHora && recientes.length >= MAX_INVITACIONES_POR_HORA_A_PEDIDO)) {
        return { motivo: "esperá un minuto para reenviar", nombre: usuario.nombre };
      }
      await this.usuarioRepo.invalidarTokens(usuarioId, "invitacion", ahora, tx);
      const { token, registro } = nuevoEnlace(usuarioId, "invitacion", ahora);
      await this.usuarioRepo.crearToken(registro, tx);
      return { cuenta: { usuario, token, tokenId: registro.id, venceEn: registro.expiraEn }, nombre: usuario.nombre };
    });
  }
}
