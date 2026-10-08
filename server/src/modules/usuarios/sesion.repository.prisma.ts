import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Sesion } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";

export class PrismaSesionRepository implements SesionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Sesion | null> {
    return this.client(tx).sesion.findUnique({ where: { id } });
  }

  async findAll(tx?: unknown): Promise<Sesion[]> {
    return this.client(tx).sesion.findMany();
  }

  async create(entidad: Sesion, tx?: unknown): Promise<Sesion> {
    return this.client(tx).sesion.create({ data: entidad });
  }

  async update(id: string, entidad: Sesion, tx?: unknown): Promise<Sesion> {
    try {
      return await this.client(tx).sesion.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Sesion", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).sesion.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Sesion", id);
    }
  }

  async buscarValida(id: string, usuarioId: string, ahora: Date): Promise<Sesion | null> {
    return this.prisma.sesion.findFirst({
      where: { id, usuarioId, cerradaEn: null, expiraEn: { gt: ahora }, usuario: { estado: "activo" } },
    });
  }

  async registrarUso(id: string, ahora: Date, antesDe: Date): Promise<boolean> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { id, ultimoUsoEn: { lt: antesDe } },
      data: { ultimoUsoEn: ahora },
    });
    return count === 1;
  }

  async tocar(id: string, ahora: Date): Promise<void> {
    await this.prisma.sesion.updateMany({ where: { id }, data: { ultimoUsoEn: ahora } });
  }

  async findActivasByUsuario(usuarioId: string, ahora: Date, tx?: unknown): Promise<Sesion[]> {
    return this.client(tx).sesion.findMany({
      where: { usuarioId, cerradaEn: null, expiraEn: { gt: ahora } },
      orderBy: { creadaEn: "desc" },
    });
  }

  async cerrar(id: string, usuarioId: string, ahora: Date, tx?: unknown): Promise<boolean> {
    const { count } = await this.client(tx).sesion.updateMany({
      where: { id, usuarioId, cerradaEn: null, expiraEn: { gt: ahora } },
      data: { cerradaEn: ahora },
    });
    return count === 1;
  }

  async cerrarTodas(usuarioId: string, ahora: Date, excepto?: string, tx?: unknown): Promise<number> {
    const { count } = await this.client(tx).sesion.updateMany({
      // Solo las abiertas de verdad: una sesión ya vencida no cuenta como cerrada ahora.
      where: { usuarioId, cerradaEn: null, expiraEn: { gt: ahora }, ...(excepto ? { id: { not: excepto } } : {}) },
      data: { cerradaEn: ahora },
    });
    return count;
  }

  async depurarTerminadasAntesDe(limite: Date): Promise<number> {
    // Una sesión con `cerradaEn` o `expiraEn` anterior al límite terminó antes del límite; una activa tiene
    // `cerradaEn` nulo y `expiraEn` en el futuro, así que nunca coincide.
    const { count } = await this.prisma.sesion.deleteMany({
      where: { OR: [{ cerradaEn: { lt: limite } }, { expiraEn: { lt: limite } }] },
    });
    return count;
  }
}
