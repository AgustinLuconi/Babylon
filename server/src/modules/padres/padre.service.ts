import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { UnitOfWork } from "../../core/ports";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Usuario } from "../usuarios/usuario.entity";
import type { PadreRepository } from "./padre.repository";
import type { Padre } from "./padre.entity";
import type { ActualizarPadreInput, CrearPadreInput, CrearPadreSinCuentaInput } from "./padre.schema";

export class PadreService {
  constructor(
    private readonly padreRepo: PadreRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly unitOfWork: UnitOfWork,
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

  async crearPadre(datos: CrearPadreInput): Promise<Padre> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const dniExistente = await this.padreRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un padre/tutor con el DNI ${datos.dni}`);
    }

    return this.unitOfWork.runInTransaction(async (tx) => {
      const usuario: Usuario = {
        id: randomUUID(),
        nombre: `${datos.nombre} ${datos.apellido}`,
        email: datos.email,
        passwordHash: await bcrypt.hash(datos.password, 10),
        roles: ["padre"],
        estado: "activo",
        fechaCreacion: new Date(),
      };
      await this.usuarioRepo.create(usuario, tx);

      const padre: Padre = {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        vinculo: datos.vinculo,
        usuarioId: usuario.id,
      };
      return this.padreRepo.create(padre, tx);
    });
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
