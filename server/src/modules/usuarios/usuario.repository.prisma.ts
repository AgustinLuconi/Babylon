import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Rol } from "../../core/ports";
import type { UsuarioRepository } from "./usuario.repository";
import type { TokenRecuperacion } from "./tokenRecuperacion.entity";
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
    // Sin distinguir mayúsculas ni espacios: " Admin@Babylon.test " es la misma cuenta.
    const fila = await this.client(tx).usuario.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
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

  async crearTokenRecuperacion(token: TokenRecuperacion, tx?: unknown): Promise<TokenRecuperacion> {
    return this.client(tx).tokenRecuperacion.create({ data: token });
  }

  async findTokenRecuperacionPorHash(hash: string, tx?: unknown): Promise<TokenRecuperacion | null> {
    return this.client(tx).tokenRecuperacion.findUnique({ where: { hash } });
  }

  async findTokensRecuperacionDesde(usuarioId: string, desde: Date, tx?: unknown): Promise<TokenRecuperacion[]> {
    return this.client(tx).tokenRecuperacion.findMany({ where: { usuarioId, creadoEn: { gte: desde } } });
  }

  async invalidarTokensRecuperacion(usuarioId: string, ahora: Date, tx?: unknown): Promise<void> {
    await this.client(tx).tokenRecuperacion.updateMany({ where: { usuarioId, usadoEn: null }, data: { usadoEn: ahora } });
  }

  async marcarTokenRecuperacionUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).tokenRecuperacion.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: ahora } });
    return count === 1;
  }
}
