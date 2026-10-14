import { Prisma, type PrismaClient } from "@prisma/client";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { Rol } from "../../core/ports";
import type { CambiosUsuario, UsuarioRepository } from "./usuario.repository";
import type { TipoTokenCuenta, TokenCuenta } from "./tokenCuenta.entity";
import type { Usuario } from "./usuario.entity";

type FilaUsuario = Awaited<ReturnType<PrismaClient["usuario"]["findUniqueOrThrow"]>>;

// Sin espacios y en minúsculas: " Admin@Babylon.test " es la misma cuenta que "admin@babylon.test".
const normalizarEmail = (email: string) => email.trim().toLowerCase();

// El email es único: si dos pedidos lo usan a la vez, el segundo choca con la restricción de la base. Se traduce a un
// error de dominio (409) en vez de dejar escapar el error de Prisma (500).
function esEmailRepetido(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

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
    // Los emails se guardan normalizados (ver normalizarEmail), así que alcanza con una búsqueda
    // exacta por el índice único. No se usa `mode: "insensitive"`: Prisma lo traduce a ILIKE, donde
    // "_" y "%" funcionan como comodines y "a_min@x" encontraría la cuenta "admin@x".
    const fila = await this.client(tx).usuario.findUnique({ where: { email: normalizarEmail(email) } });
    return fila ? aEntidad(fila) : null;
  }

  async findAll(tx?: unknown): Promise<Usuario[]> {
    const filas = await this.client(tx).usuario.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Usuario, tx?: unknown): Promise<Usuario> {
    try {
      const fila = await this.client(tx).usuario.create({ data: { ...entidad, email: normalizarEmail(entidad.email) } });
      return aEntidad(fila);
    } catch (error) {
      if (esEmailRepetido(error)) throw new ConflictError(`Ya existe un usuario con el email ${entidad.email}`);
      throw error;
    }
  }

  async update(id: string, entidad: Usuario, tx?: unknown): Promise<Usuario> {
    try {
      const fila = await this.client(tx).usuario.update({ where: { id }, data: { ...entidad, email: normalizarEmail(entidad.email) } });
      return aEntidad(fila);
    } catch (error) {
      if (esEmailRepetido(error)) throw new ConflictError(`Ya existe un usuario con el email ${entidad.email}`);
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

  async actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario> {
    try {
      const fila = await this.client(tx).usuario.update({
        where: { id },
        data: { ...cambios, ...(cambios.email !== undefined ? { email: normalizarEmail(cambios.email) } : {}) },
      });
      return aEntidad(fila);
    } catch (error) {
      if (esEmailRepetido(error)) throw new ConflictError(`Ya existe un usuario con el email ${cambios.email}`);
      throw new EntityNotFoundError("Usuario", id);
    }
  }

  async bloquearCuenta(clave: string, tx: unknown): Promise<void> {
    await this.client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))`;
  }

  async crearToken(token: TokenCuenta, tx?: unknown): Promise<TokenCuenta> {
    return this.client(tx).tokenCuenta.create({ data: token });
  }

  async eliminarToken(id: string, tx?: unknown): Promise<void> {
    await this.client(tx).tokenCuenta.deleteMany({ where: { id } });
  }

  async findTokenPorHash(hash: string, tx?: unknown): Promise<TokenCuenta | null> {
    return this.client(tx).tokenCuenta.findUnique({ where: { hash } });
  }

  async findTokensDesde(usuarioId: string, tipo: TipoTokenCuenta, desde: Date, tx?: unknown): Promise<TokenCuenta[]> {
    return this.client(tx).tokenCuenta.findMany({ where: { usuarioId, tipo, creadoEn: { gte: desde } } });
  }

  async findTokensDeUsuarios(usuarioIds: string[], tipo: TipoTokenCuenta, tx?: unknown): Promise<TokenCuenta[]> {
    if (usuarioIds.length === 0) return [];
    return this.client(tx).tokenCuenta.findMany({ where: { usuarioId: { in: usuarioIds }, tipo } });
  }

  async invalidarTokens(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date, tx?: unknown): Promise<void> {
    await this.client(tx).tokenCuenta.updateMany({ where: { usuarioId, tipo, usadoEn: null }, data: { usadoEn: ahora } });
  }

  async marcarTokenUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).tokenCuenta.updateMany({ where: { id, usadoEn: null }, data: { usadoEn: ahora } });
    return count === 1;
  }
}
