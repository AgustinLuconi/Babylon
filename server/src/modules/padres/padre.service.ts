import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { soloPresentes } from "../../core/cambios";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { CuentaPreparada, EstadoInvitacion, InvitacionService } from "../usuarios/invitacion.service";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Usuario } from "../usuarios/usuario.entity";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { PadreRepository } from "./padre.repository";
import type { Padre } from "./padre.entity";
import type { ActualizarPadreInput, CrearPadreInput, CrearPadreSinCuentaInput, DatosDeFichaInput } from "./padre.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosUsuarios } from "../usuarios/usuario.eventos";

export type PadreCreado = Padre & { invitacion: EstadoInvitacion | null };

export class PadreService {
  constructor(
    private readonly padreRepo: PadreRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly invitaciones: InvitacionService,
    private readonly anuncios: Publicador<EventosUsuarios & EventosCambios> = sinAnuncios(),
  ) {}

  async listarPadres(): Promise<Padre[]> {
    return this.padreRepo.findAll();
  }

  async buscarPorUsuarioId(usuarioId: string): Promise<Padre> {
    const padre = await this.padreRepo.findByUsuarioId(usuarioId);
    if (!padre) {
      throw new EntityNotFoundError("Padre", usuarioId);
    }
    return padre;
  }

  // Crea la ficha de un responsable dentro de una transacción en curso (la usan el alta de un padre y la inscripción de un
  // alumno, que crea al responsable y al alumno juntos). Con email crea la cuenta: con contraseña, activa; sin ella,
  // pendiente (la invitación se manda con `enviarInvitacion` DESPUÉS de confirmar la transacción). Sin email, no hay cuenta.
  async crearFichaEnTransaccion(datos: DatosDeFichaInput, tx: unknown): Promise<{ padre: Padre; cuenta: CuentaPreparada | null }> {
    if (datos.email && (await this.usuarioRepo.findByEmail(datos.email, tx))) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    if (datos.dni && (await this.padreRepo.findByDni(datos.dni, tx))) {
      throw new ConflictError(`Ya existe un responsable con el DNI ${datos.dni}`);
    }

    const ahora = new Date();
    const nombreCuenta = `${datos.nombre} ${datos.apellido}`;
    let usuarioId: string | undefined;
    let cuenta: CuentaPreparada | null = null;
    if (datos.email && datos.password) {
      const usuario: Usuario = {
        id: randomUUID(),
        nombre: nombreCuenta,
        email: datos.email,
        passwordHash: await bcrypt.hash(datos.password, 10),
        roles: ["padre"],
        estado: "activo",
        fechaCreacion: ahora,
        emailVerificadoEn: null,
      };
      await this.usuarioRepo.create(usuario, tx);
      usuarioId = usuario.id;
    } else if (datos.email) {
      cuenta = await this.invitaciones.prepararCuentaPendiente({ nombre: nombreCuenta, email: datos.email, roles: ["padre"] }, ahora, tx);
      usuarioId = cuenta.usuario.id;
    }

    const padre = await this.padreRepo.create(
      {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        direccion: datos.direccion,
        usuarioId,
      },
      tx,
    );
    // Con contraseña la cuenta nace activa: ya le corresponden avisos (con invitación, cuando la active).
    if (usuarioId && !cuenta) await this.anuncios.publicar("cuenta.cambio", { usuarioId }, tx);
    await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "alta", ids: { padreIds: [padre.id] } }, tx);
    if (usuarioId) await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "alta", ids: { usuarioIds: [usuarioId] } }, tx);
    return { padre, cuenta };
  }

  // Manda la invitación de una cuenta pendiente (ya confirmada la transacción). Sin cuenta pendiente no hay invitación.
  async enviarInvitacion(cuenta: CuentaPreparada | null): Promise<EstadoInvitacion | null> {
    if (!cuenta) return null;
    return (await this.invitaciones.enviarInvitacion(cuenta)) ? "enviada" : "no-enviada";
  }

  async crearPadre(datos: CrearPadreInput): Promise<PadreCreado> {
    const { padre, cuenta } = await this.unitOfWork.runInTransaction((tx) => this.crearFichaEnTransaccion(datos, tx));
    return { ...padre, invitacion: await this.enviarInvitacion(cuenta) };
  }

  // Sin `UnitOfWork`: a diferencia de `crearPadre`, acá no hay un segundo
  // registro (Usuario) que crear en la misma operación — es un único insert.
  async crearPadreSinCuenta(datos: CrearPadreSinCuentaInput): Promise<Padre> {
    const dniExistente = await this.padreRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un responsable con el DNI ${datos.dni}`);
    }

    const padre: Padre = {
      id: randomUUID(),
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      direccion: datos.direccion,
      telefono: datos.telefono,
    };
    const creado = await this.padreRepo.create(padre);
    await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "alta", ids: { padreIds: [creado.id] } });
    return creado;
  }

  async actualizarPadre(id: string, datos: ActualizarPadreInput): Promise<Padre> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      // Si es el responsable "propio" de un alumno (una persona = un nombre), nombre, apellido y DNI se cambian en las dos
      // fichas a la vez. Bloqueos siempre en el mismo orden: primero el alumno, después la ficha.
      const sincroniza = datos.nombre !== undefined || datos.apellido !== undefined || datos.dni !== undefined;
      const propio = sincroniza ? (await this.alumnoRepo.findByPadreId(id, tx)).find((a) => a.vinculoResponsable === "propio") : undefined;
      if (propio) await this.alumnoRepo.bloquear(propio.id, tx);
      await this.padreRepo.bloquear(id, tx);
      // Con los bloqueos tomados se comprueba que el alumno "propio" siga siendo el mismo: si otro cambio lo movió mientras
      // tanto, no se escribe sobre un alumno que ya no corresponde.
      if (sincroniza) {
        const ahora = (await this.alumnoRepo.findByPadreId(id, tx)).find((a) => a.vinculoResponsable === "propio");
        if (ahora?.id !== propio?.id) throw new ConflictError("El responsable cambió mientras se guardaba: volvé a intentarlo");
      }

      const actual = await this.padreRepo.findById(id, tx);
      if (!actual) {
        throw new EntityNotFoundError("Padre", id);
      }
      if (datos.dni && datos.dni !== actual.dni) {
        const otra = await this.padreRepo.findByDni(datos.dni, tx);
        if (otra && otra.id !== id) throw new ConflictError(`Ya existe un responsable con el DNI ${datos.dni}`);
        const alumnoConEseDni = await this.alumnoRepo.findByDni(datos.dni, tx);
        if (propio && alumnoConEseDni && alumnoConEseDni.id !== propio.id) {
          throw new ConflictError(`Ya existe un alumno con el DNI ${datos.dni}`);
        }
      }
      // El email de la ficha es el de su cuenta de acceso: con cuenta, no se puede dejar sin email.
      if (datos.email === null && actual.usuarioId) {
        throw new ValidationError("Este responsable ya tiene una cuenta de acceso: no se puede borrar su email");
      }

      // Con una invitación todavía sin aceptar, corregir el email de la ficha corrige el de la cuenta y anula la invitación
      // que se mandó a la dirección anterior (queda "vencida" hasta reenviarla a la nueva). Una cuenta ya activa conserva su
      // email de acceso: cambiarlo es otra operación (fuera de alcance).
      if (typeof datos.email === "string" && datos.email !== actual.email && actual.usuarioId) {
        const usuarioId = actual.usuarioId;
        await this.usuarioRepo.bloquearCuenta(usuarioId, tx);
        const usuario = await this.usuarioRepo.findById(usuarioId, tx);
        if (usuario?.estado === "pendiente") {
          const otra = await this.usuarioRepo.findByEmail(datos.email, tx);
          if (otra && otra.id !== usuario.id) throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
          await this.usuarioRepo.actualizarParcial(usuario.id, { email: datos.email }, tx);
          await this.usuarioRepo.invalidarTokens(usuario.id, "invitacion", new Date(), tx);
        }
      }

      // Solo las columnas que vinieron en el pedido: ausente no se toca, null borra.
      const guardado = await this.padreRepo.actualizarParcial(id, soloPresentes(datos), tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: [id] } }, tx);
      if (propio) {
        await this.alumnoRepo.actualizarParcial(propio.id, soloPresentes({ nombre: datos.nombre, apellido: datos.apellido, dni: datos.dni }), tx);
        await this.anuncios.publicar(
          "datos.cambiaron",
          { dato: "alumnos", accion: "edicion", ids: { alumnoIds: [propio.id], cursoIds: propio.cursoId ? [propio.cursoId] : [] } },
          tx,
        );
      }
      return guardado;
    });
  }
}
