import { randomUUID } from "node:crypto";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { soloPresentes } from "../../core/cambios";
import { sinAnuncios } from "../../core/eventos";
import type { PadreRepository } from "../padres/padre.repository";
import type { SesionRepository } from "../usuarios/sesion.repository";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { ProfesorRepository } from "./profesor.repository";
import type { Profesor } from "./profesor.entity";
import type { ActualizarProfesorInput, CrearProfesorInput, CrearProfesorSinCuentaInput } from "./profesor.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosUsuarios } from "../usuarios/usuario.eventos";

export class ProfesorService {
  constructor(
    private readonly profesorRepo: ProfesorRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly sesionRepo: SesionRepository,
    private readonly padreRepo: PadreRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosUsuarios & EventosCambios> = sinAnuncios(),
  ) {}

  async listarProfesores(): Promise<Profesor[]> {
    return this.profesorRepo.findAll();
  }

  async buscarPorUsuarioId(usuarioId: string): Promise<Profesor> {
    const profesor = await this.profesorRepo.findByUsuarioId(usuarioId);
    if (!profesor) {
      throw new EntityNotFoundError("Profesor", usuarioId);
    }
    return profesor;
  }

  // Crea solo la ficha: la cuenta de acceso la crea el administrador después (ver `UsuarioService.crearCuenta`).
  async crearProfesor(datos: CrearProfesorInput): Promise<Profesor> {
    return this.unitOfWork.runInTransaction(async (tx) => (await this.crearFichaEnTransaccion(datos, tx)).profesor);
  }

  // La ficha de un profesor dentro de una transacción en curso (la usan el alta y la creación de una cuenta con ficha nueva).
  async crearFichaEnTransaccion(datos: CrearProfesorInput, tx: unknown): Promise<{ profesor: Profesor }> {
    if (await this.profesorRepo.findByDni(datos.dni, tx)) {
      throw new ConflictError(`Ya existe un profesor con el DNI ${datos.dni}`);
    }
    const profesor = await this.profesorRepo.create(
      {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        estado: "activo",
      },
      tx,
    );
    await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "alta", ids: { profesorIds: [profesor.id] } }, tx);
    return { profesor };
  }

  // Sin `UnitOfWork`: un único insert, no hay Usuario que crear en la misma
  // operación (ver nota de `crearProfesorSinCuentaSchema`).
  async crearProfesorSinCuenta(datos: CrearProfesorSinCuentaInput): Promise<Profesor> {
    const profesor: Profesor = {
      id: randomUUID(),
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      estado: "activo",
    };
    const creado = await this.profesorRepo.create(profesor);
    await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "alta", ids: { profesorIds: [creado.id] } });
    return creado;
  }

  // Si el profesor tiene cuenta de acceso, el login (nombre, email, estado)
  // se mantiene sincronizado con la ficha en la misma transacción: un
  // profesor inactivo no puede iniciar sesión (ver UsuarioService.autenticar).
  async actualizarProfesor(id: string, datos: ActualizarProfesorInput): Promise<Profesor> {
    // Esta lectura solo dice si existe y si tiene cuenta (para saber qué bloquear); los datos con los que se decide se
    // leen de nuevo dentro de la transacción.
    const previo = await this.profesorRepo.findById(id);
    if (!previo) {
      throw new EntityNotFoundError("Profesor", id);
    }

    return this.unitOfWork.runInTransaction(async (tx) => {
      // El bloqueo de la cuenta serializa las ediciones de un profesor con cuenta (y los cambios de estado de esa cuenta):
      // con él tomado se relee la ficha, así el nombre de la cuenta sale de lo último guardado y no de una lectura vieja.
      if (previo.usuarioId) await this.usuarioRepo.bloquearCuenta(previo.usuarioId, tx);
      const profesor = await this.profesorRepo.findById(id, tx);
      if (!profesor) {
        throw new EntityNotFoundError("Profesor", id);
      }
      if (profesor.usuarioId !== previo.usuarioId) {
        throw new ConflictError("El profesor cambió mientras se guardaba: volvé a intentarlo");
      }

      if (datos.dni && datos.dni !== profesor.dni) {
        const dniExistente = await this.profesorRepo.findByDni(datos.dni, tx);
        if (dniExistente && dniExistente.id !== id) {
          throw new ConflictError(`Ya existe un profesor con el DNI ${datos.dni}`);
        }
      }

      const actualizado: Profesor = {
        ...profesor,
        nombre: datos.nombre ?? profesor.nombre,
        apellido: datos.apellido ?? profesor.apellido,
        dni: datos.dni ?? profesor.dni,
        telefono: datos.telefono ?? profesor.telefono,
        email: datos.email ?? profesor.email,
        estado: datos.estado ?? profesor.estado,
      };

      if (profesor.usuarioId) {
        const usuario = await this.usuarioRepo.findById(profesor.usuarioId, tx);
        if (usuario) {
          if (datos.email && datos.email !== usuario.email) {
            const emailExistente = await this.usuarioRepo.findByEmail(datos.email, tx);
            if (emailExistente && emailExistente.id !== usuario.id) {
              throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
            }
          }
          // El estado de la ficha solo pasa a la cuenta si el pedido lo cambia Y la cuenta es solo de profesor: una cuenta con
          // más roles (por ejemplo, administración) no se desactiva —ni se deja afuera a su dueño— por desactivar la ficha; eso
          // se hace a propósito desde Usuarios. Editar otros datos nunca toca el estado de la cuenta.
          const cambiaElEstado = datos.estado !== undefined && datos.estado !== profesor.estado;
          const cuentaSoloProfesor = usuario.roles.length === 1 && usuario.roles[0] === "profesor";
          const sincronizaEstado = cambiaElEstado && cuentaSoloProfesor;
          // Solo los campos que cambian (no se reescribe la fila).
          await this.usuarioRepo.actualizarParcial(
            usuario.id,
            {
              nombre: `${actualizado.nombre} ${actualizado.apellido ?? ""}`.trim(),
              ...(datos.email ? { email: datos.email } : {}),
              ...(sincronizaEstado ? { estado: actualizado.estado } : {}),
            },
            tx,
          );
          // El email es el mismo en todas las fichas de la cuenta: si hay también una de responsable, la acompaña.
          if (datos.email) {
            const comoPadre = await this.padreRepo.findByUsuarioId(usuario.id, tx);
            if (comoPadre && comoPadre.email !== datos.email) {
              await this.padreRepo.actualizarParcial(comoPadre.id, { email: datos.email }, tx);
              await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: [comoPadre.id] } }, tx);
            }
          }
          if (sincronizaEstado) {
            // Desactivar al profesor cierra todas sus sesiones: reactivarlo más tarde no las revive.
            if (actualizado.estado === "inactivo") {
              await this.sesionRepo.cerrarTodas(usuario.id, new Date(), undefined, tx);
              await this.anuncios.publicar("sesiones.cerradas", { usuarioId: usuario.id, motivo: "cuenta-desactivada" }, tx);
            }
            await this.anuncios.publicar("cuenta.cambio", { usuarioId: usuario.id }, tx);
            await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "estado", ids: { usuarioIds: [usuario.id] } }, tx);
          }
        }
      }
      // Solo las columnas que vinieron en el pedido: ausente no se toca, null borra.
      const guardado = await this.profesorRepo.actualizarParcial(id, soloPresentes(datos), tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "edicion", ids: { profesorIds: [id] } }, tx);
      return guardado;
    });
  }
}
