import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { DocumentoRepository } from "./documento.repository";
import type { Documento, TipoDocumento } from "./documento.entity";

type FilaDocumento = Awaited<ReturnType<PrismaClient["documento"]["findUniqueOrThrow"]>>;

function aEntidad(fila: FilaDocumento): Documento {
  return {
    ...fila,
    urlArchivo: fila.urlArchivo ?? undefined,
    fechaCarga: fila.fechaCarga ?? undefined,
    autorizadoPor: fila.autorizadoPor ?? undefined,
    fechaAutorizacion: fila.fechaAutorizacion ?? undefined,
    tipoAutorizacion: fila.tipoAutorizacion ?? undefined,
  };
}

export class PrismaDocumentoRepository implements DocumentoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Documento | null> {
    const fila = await this.client(tx).documento.findUnique({ where: { id } });
    return fila ? aEntidad(fila) : null;
  }

  async findByAlumnoYTipo(alumnoId: string, tipo: TipoDocumento, tx?: unknown): Promise<Documento | null> {
    const fila = await this.client(tx).documento.findUnique({ where: { alumnoId_tipo: { alumnoId, tipo } } });
    return fila ? aEntidad(fila) : null;
  }

  async findAll(tx?: unknown): Promise<Documento[]> {
    const filas = await this.client(tx).documento.findMany();
    return filas.map(aEntidad);
  }

  async findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Documento[]> {
    const filas = await this.client(tx).documento.findMany({ where: { alumnoId } });
    return filas.map(aEntidad);
  }

  async create(entidad: Documento, tx?: unknown): Promise<Documento> {
    const fila = await this.client(tx).documento.create({ data: entidad });
    return aEntidad(fila);
  }

  async update(id: string, entidad: Documento, tx?: unknown): Promise<Documento> {
    try {
      // Prisma trata `undefined` como "no tocar esta columna" — si el service
      // quiere limpiar un campo opcional (ej. al revocar una autorización)
      // hay que mandarle `null` explícito, no `undefined`.
      const fila = await this.client(tx).documento.update({
        where: { id },
        data: {
          ...entidad,
          urlArchivo: entidad.urlArchivo ?? null,
          fechaCarga: entidad.fechaCarga ?? null,
          autorizadoPor: entidad.autorizadoPor ?? null,
          fechaAutorizacion: entidad.fechaAutorizacion ?? null,
          tipoAutorizacion: entidad.tipoAutorizacion ?? null,
        },
      });
      return aEntidad(fila);
    } catch {
      throw new EntityNotFoundError("Documento", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).documento.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Documento", id);
    }
  }
}
