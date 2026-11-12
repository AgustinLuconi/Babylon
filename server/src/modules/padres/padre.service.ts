import { randomUUID } from "node:crypto";
import { soloPresentes } from "../../core/cambios";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { PadreRepository } from "./padre.repository";
import type { Padre } from "./padre.entity";
import type { ActualizarPadreInput, CrearPadreInput, CrearPadreSinCuentaInput, DatosDeFichaInput } from "./padre.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosUsuarios } from "../usuarios/usuario.eventos";

export class PadreService {
  constructor(
    private readonly padreRepo: PadreRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
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

  // Crea la ficha de un responsable dentro de una transacción en curso (la usan el alta de un padre, la inscripción de un
  // alumno —que crea al responsable y al alumno juntos— y la creación de una cuenta con ficha nueva). Solo la ficha: la cuenta
  // de acceso la crea el administrador después (ver `UsuarioService.crearCuenta`); el email es un dato de contacto.
  async crearFichaEnTransaccion(datos: DatosDeFichaInput, tx: unknown): Promise<{ padre: Padre }> {
    if (datos.dni && (await this.padreRepo.findByDni(datos.dni, tx))) {
      throw new ConflictError(`Ya existe un responsable con el DNI ${datos.dni}`);
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
      },
      tx,
    );
    await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "alta", ids: { padreIds: [padre.id] } }, tx);
    return { padre };
  }

  async crearPadre(datos: CrearPadreInput): Promise<Padre> {
    return this.unitOfWork.runInTransaction(async (tx) => (await this.crearFichaEnTransaccion(datos, tx)).padre);
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

      // El email y el nombre de la ficha son los de su cuenta: si cambian, cambian también en la cuenta (409 si el email lo usa
      // otra, sin cambiar ninguno), y el email también en la otra ficha de la cuenta si la hay (profesor).
      const emailCambia = typeof datos.email === "string" && datos.email !== actual.email;
      const nombreCambia = (datos.nombre !== undefined && datos.nombre !== actual.nombre) || (datos.apellido !== undefined && datos.apellido !== actual.apellido);
      if (actual.usuarioId && (emailCambia || nombreCambia)) {
        await this.usuarioRepo.bloquearCuenta(actual.usuarioId, tx);
        if (emailCambia) {
          await this.usuarioRepo.bloquearCuenta(`email:${datos.email}`, tx);
          const otra = await this.usuarioRepo.findByEmail(datos.email as string, tx);
          if (otra && otra.id !== actual.usuarioId) throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
          const comoProfesor = await this.profesorRepo.findByUsuarioId(actual.usuarioId, tx);
          if (comoProfesor) {
            await this.profesorRepo.actualizarParcial(comoProfesor.id, { email: datos.email as string }, tx);
            await this.anuncios.publicar("datos.cambiaron", { dato: "profesores", accion: "edicion", ids: { profesorIds: [comoProfesor.id] } }, tx);
          }
        }
        await this.usuarioRepo.actualizarParcial(
          actual.usuarioId,
          {
            ...(emailCambia ? { email: datos.email as string } : {}),
            ...(nombreCambia ? { nombre: `${datos.nombre ?? actual.nombre} ${datos.apellido ?? actual.apellido}`.trim() } : {}),
          },
          tx,
        );
        await this.anuncios.publicar("datos.cambiaron", { dato: "usuarios", accion: "edicion", ids: { usuarioIds: [actual.usuarioId] } }, tx);
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
