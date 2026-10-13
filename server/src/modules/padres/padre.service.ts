import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { UnitOfWork } from "../../core/ports";
import type { CuentaPreparada, EstadoInvitacion, InvitacionService } from "../usuarios/invitacion.service";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Usuario } from "../usuarios/usuario.entity";
import type { PadreRepository } from "./padre.repository";
import type { Padre } from "./padre.entity";
import type { ActualizarPadreInput, CrearPadreInput, CrearPadreSinCuentaInput } from "./padre.schema";

export type PadreCreado = Padre & { invitacion: EstadoInvitacion | null };

export class PadreService {
  constructor(
    private readonly padreRepo: PadreRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly invitaciones: InvitacionService,
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

  async crearPadre(datos: CrearPadreInput): Promise<PadreCreado> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const dniExistente = await this.padreRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un padre/tutor con el DNI ${datos.dni}`);
    }

    const ahora = new Date();
    const nombreCuenta = `${datos.nombre} ${datos.apellido}`;
    const { padre, cuenta } = await this.unitOfWork.runInTransaction(async (tx) => {
      let usuarioId: string;
      let cuenta: CuentaPreparada | null = null;
      if (datos.password) {
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
      } else {
        // Sin contraseña: la cuenta queda pendiente y la invitación se manda después de confirmar la transacción.
        cuenta = await this.invitaciones.prepararCuentaPendiente({ nombre: nombreCuenta, email: datos.email, roles: ["padre"] }, ahora, tx);
        usuarioId = cuenta.usuario.id;
      }

      const padre: Padre = {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        vinculo: datos.vinculo,
        usuarioId,
      };
      return { padre: await this.padreRepo.create(padre, tx), cuenta };
    });

    if (!cuenta) return { ...padre, invitacion: null };
    return { ...padre, invitacion: (await this.invitaciones.enviarInvitacion(cuenta)) ? "enviada" : "no-enviada" };
  }

  // Sin `UnitOfWork`: a diferencia de `crearPadre`, acá no hay un segundo
  // registro (Usuario) que crear en la misma operación — es un único insert.
  async crearPadreSinCuenta(datos: CrearPadreSinCuentaInput): Promise<Padre> {
    const dniExistente = await this.padreRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un padre/tutor con el DNI ${datos.dni}`);
    }

    const padre: Padre = {
      id: randomUUID(),
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      direccion: datos.direccion,
      telefono: datos.telefono,
      vinculo: datos.vinculo,
    };
    return this.padreRepo.create(padre);
  }

  async actualizarPadre(id: string, datos: ActualizarPadreInput): Promise<Padre> {
    const actual = await this.padreRepo.findById(id);
    if (!actual) {
      throw new EntityNotFoundError("Padre", id);
    }

    const actualizado: Padre = {
      ...actual,
      nombre: datos.nombre ?? actual.nombre,
      apellido: datos.apellido ?? actual.apellido,
      direccion: datos.direccion ?? actual.direccion,
      telefono: datos.telefono ?? actual.telefono,
      email: datos.email ?? actual.email,
      vinculo: datos.vinculo ?? actual.vinculo,
    };
    return this.padreRepo.update(id, actualizado);
  }
}
