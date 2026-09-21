import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { UnitOfWork } from "../../core/ports";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Usuario } from "../usuarios/usuario.entity";
import type { ProfesorRepository } from "./profesor.repository";
import type { Profesor } from "./profesor.entity";
import type { ActualizarProfesorInput, CrearProfesorInput, CrearProfesorSinCuentaInput } from "./profesor.schema";

export class ProfesorService {
  constructor(
    private readonly profesorRepo: ProfesorRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly unitOfWork: UnitOfWork,
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

  async crearProfesor(datos: CrearProfesorInput): Promise<Profesor> {
    const emailExistente = await this.usuarioRepo.findByEmail(datos.email);
    if (emailExistente) {
      throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
    }
    const dniExistente = await this.profesorRepo.findByDni(datos.dni);
    if (dniExistente) {
      throw new ConflictError(`Ya existe un profesor con el DNI ${datos.dni}`);
    }

    return this.unitOfWork.runInTransaction(async (tx) => {
      const usuario: Usuario = {
        id: randomUUID(),
        nombre: `${datos.nombre} ${datos.apellido}`,
        email: datos.email,
        passwordHash: await bcrypt.hash(datos.password, 10),
        roles: ["profesor"],
        estado: "activo",
        fechaCreacion: new Date(),
      };
      await this.usuarioRepo.create(usuario, tx);

      const profesor: Profesor = {
        id: randomUUID(),
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        email: datos.email,
        usuarioId: usuario.id,
        estado: "activo",
      };
      return this.profesorRepo.create(profesor, tx);
    });
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
    return this.profesorRepo.create(profesor);
  }

  // Si el profesor tiene cuenta de acceso, el login (nombre, email, estado)
  // se mantiene sincronizado con la ficha en la misma transacción: un
  // profesor inactivo no puede iniciar sesión (ver UsuarioService.autenticar).
  async actualizarProfesor(id: string, datos: ActualizarProfesorInput): Promise<Profesor> {
    const profesor = await this.profesorRepo.findById(id);
    if (!profesor) {
      throw new EntityNotFoundError("Profesor", id);
    }

    if (datos.dni && datos.dni !== profesor.dni) {
      const dniExistente = await this.profesorRepo.findByDni(datos.dni);
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

    return this.unitOfWork.runInTransaction(async (tx) => {
      if (profesor.usuarioId) {
        const usuario = await this.usuarioRepo.findById(profesor.usuarioId, tx);
        if (usuario) {
          if (datos.email && datos.email !== usuario.email) {
            const emailExistente = await this.usuarioRepo.findByEmail(datos.email, tx);
            if (emailExistente && emailExistente.id !== usuario.id) {
              throw new ConflictError(`Ya existe un usuario con el email ${datos.email}`);
            }
          }
          await this.usuarioRepo.update(
            usuario.id,
            {
              ...usuario,
              nombre: `${actualizado.nombre} ${actualizado.apellido ?? ""}`.trim(),
              email: datos.email ?? usuario.email,
              estado: actualizado.estado,
            },
            tx,
          );
        }
      }
      return this.profesorRepo.update(id, actualizado, tx);
    });
  }
}
