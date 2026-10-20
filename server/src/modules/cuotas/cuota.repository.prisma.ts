import type { Prisma, PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";
import type { CuotaRepository } from "./cuota.repository";
import type { Cuota } from "./cuota.entity";
import type { Pago } from "./pago.entity";

export class PrismaCuotaRepository implements CuotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Cuota | null> {
    return this.client(tx).cuota.findUnique({ where: { id } });
  }

  async findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Cuota[]> {
    return this.client(tx).cuota.findMany({ where: { alumnoId } });
  }

  async findByMesYAnio(mes: number, anio: number, tx?: unknown): Promise<Cuota[]> {
    return this.client(tx).cuota.findMany({ where: { mes, anio } });
  }

  async marcarVencidas(vencimientoAnteriorA: Date, tx?: unknown): Promise<{ id: string; alumnoId: string }[]> {
    const db = this.client(tx);
    const cuotas = await db.cuota.findMany({
      where: { estado: "pendiente", vencimiento: { lt: vencimientoAnteriorA } },
      select: { id: true, alumnoId: true },
    });
    // Por id y todavía pendiente: si otra operación la cobró entre la lectura y esta escritura, no se toca.
    await db.cuota.updateMany({ where: { id: { in: cuotas.map((c) => c.id) }, estado: "pendiente" }, data: { estado: "vencida" } });
    return cuotas;
  }

  async findAll(tx?: unknown): Promise<Cuota[]> {
    return this.client(tx).cuota.findMany();
  }

  async create(entidad: Cuota, tx?: unknown): Promise<Cuota> {
    return this.client(tx).cuota.create({ data: entidad });
  }

  async update(id: string, entidad: Cuota, tx?: unknown): Promise<Cuota> {
    try {
      return await this.client(tx).cuota.update({ where: { id }, data: entidad });
    } catch {
      throw new EntityNotFoundError("Cuota", id);
    }
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    try {
      await this.client(tx).cuota.delete({ where: { id } });
    } catch {
      throw new EntityNotFoundError("Cuota", id);
    }
  }

  async registrarPago(pago: Pago, tx?: unknown): Promise<Pago> {
    return this.client(tx).pago.create({ data: pago });
  }

  async findAllPagos(tx?: unknown): Promise<Pago[]> {
    return this.client(tx).pago.findMany();
  }

  async findPagosByCuotaIds(cuotaIds: string[], tx?: unknown): Promise<Pago[]> {
    return this.client(tx).pago.findMany({ where: { cuotaId: { in: cuotaIds } } });
  }
}
