import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { Cambios } from "../../core/ports";
import { traducirErrorDeEscritura } from "../../core/adapters/prismaErrores";
import type { PadreRepository } from "./padre.repository";
import type { Padre } from "./padre.entity";

type FilaPadre = Awaited<ReturnType<PrismaClient["padre"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaPadre): Padre {
  return {
    ...fila,
    dni: fila.dni ?? undefined,
    direccion: fila.direccion ?? undefined,
    telefono: fila.telefono ?? undefined,
    email: fila.email ?? undefined,
    usuarioId: fila.usuarioId ?? undefined,
  };
}

export class PrismaPadreRepository implements PadreRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Padre | null> {
    const fila = await this.client(tx).padre.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Padre | null> {
    const fila = await this.client(tx).padre.findUnique({ where: { usuarioId } });
    return fila ? aEntidad(fila) : null;
  }

  async findByDni(dni: string, tx?: unknown): Promise<Padre | null> {
    const fila = await this.client(tx).padre.findUnique({ where: { dni } });
    return fila ? aEntidad(fila) : null;
  }

  async findAll(tx?: unknown): Promise<Padre[]> {
    const filas = await this.client(tx).padre.findMany();
    return filas.map(aEntidad);
  }

  async create(entidad: Padre, tx?: unknown): Promise<Padre> {
    try {
      const fila = await this.client(tx).padre.create({ data: entidad });
      return aEntidad(fila);
    } catch (error) {
      // Dos altas simultáneas con el mismo DNI: la restricción de la base deja pasar una sola y la otra es un 409.
      throw traducirErrorDeEscritura(error, "Padre", entidad.id, "responsable");
    }
  }

  async update(id: string, entidad: Padre, tx?: unknown): Promise<Padre> {
    try {
      const fila = await this.client(tx).padre.update({
        where: { id },
        data: {
          ...entidad,
          dni: entidad.dni ?? null,
          direccion: entidad.direccion ?? null,
          telefono: entidad.telefono ?? null,
          email: entidad.email ?? null,
          usuarioId: entidad.usuarioId ?? null,
        },
      });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Padre", id);
    }
  }

  async vincularUsuario(id: string, usuarioId: string, tx?: unknown): Promise<void> {
    await this.client(tx).padre.updateMany({ where: { id }, data: { usuarioId } });
  }

  async actualizarParcial(id: string, cambios: Cambios<Padre>, tx?: unknown): Promise<Padre> {
    try {
      const fila = await this.client(tx).padre.update({ where: { id }, data: cambios });
      return aEntidad(fila);
    } catch (error) {
      throw traducirErrorDeEscritura(error, "Padre", id);
    }
  }

  async bloquear(id: string, tx?: unknown): Promise<void> {
    await this.client(tx).$queryRaw`SELECT "id" FROM "Padre" WHERE "id" = ${id} FOR UPDATE`;
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).padre.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Padre", id);
    }
  }
}
