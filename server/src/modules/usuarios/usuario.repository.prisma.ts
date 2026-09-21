import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Rol } from "../../core/ports";
import type { UsuarioRepository } from "./usuario.repository";
import type { Usuario } from "./usuario.entity";

type FilaUsuario = Awaited<ReturnType<PrismaClient["usuario"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaUsuario): Usuario {
  return { ...fila, roles: fila.roles as Rol[] };
}

export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Usuario | null> {
    const fila = await this.client(tx).usuario.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByEmail(email: string, tx?: unknown): Promise<Usuario | null> {
    const fila = await this.client(tx).usuario.findUnique({ where: { email } });
    return fila ? aEntidad(fila) : null;
  }

  async findAll(tx?: unknown): Promise<Usuario[]> {
    const filas = await this.client(tx).usuario.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Usuario, tx?: unknown): Promise<Usuario> {
    const fila = await this.client(tx).usuario.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Usuario, tx?: unknown): Promise<Usuario> {
    try {
      const fila = await this.client(tx).usuario.update({ where: { id }, data: entidad });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Usuario", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).usuario.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Usuario", id);
    }
  }
}
